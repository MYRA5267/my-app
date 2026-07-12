// ─── Офлайн-очередь синхронизации ────────────────────────────────────────────
// До этого файла фоновые записи в Supabase (донаты, комментарии) при обрыве
// сети молча логировались в консоль и терялись НАВСЕГДА — приложение вело себя
// так, будто отправило то, чего не отправляло. Очередь чинит эту нечестность:
// операция, упавшая по СЕТЕВОЙ причине, сохраняется локально и доотправляется,
// когда сеть вернулась (событие 'online' или следующий запуск приложения).
//
// Сознательные границы:
// - В очередь попадают только сетевые сбои (fetch не долетел). Отказ сервера
//   (RLS, валидация) не ретраится — повтор дал бы тот же отказ или дубликат.
// - Публикация треков сюда не входит: у неё большой бинарный payload и своя
//   логика (remoteId в состоянии приложения) — отдельная задача.
// - Остаточный риск дубликата: запрос дошёл до сервера, а ответ потерялся.
//   Честная защита потребовала бы идемпотентного ключа в схеме donations —
//   отмечено как известное ограничение.

import { ls } from "./data";
import { recordDonation, postComment } from "./supabase";

export interface SyncOp {
  id: string;
  kind: "donation" | "comment";
  payload: Record<string, unknown>;
  ts: number;
}

const QUEUE_KEY = "syncQueue";
const QUEUE_CAP = 100; // защита от бесконечного роста, старое вытесняется

export function loadSyncQueue(): SyncOp[] {
  return ls.get<SyncOp[]>(QUEUE_KEY, []);
}

function saveSyncQueue(q: SyncOp[]) {
  ls.set(QUEUE_KEY, q.slice(-QUEUE_CAP));
}

export function enqueueSyncOp(kind: SyncOp["kind"], payload: Record<string, unknown>) {
  const op: SyncOp = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, kind, payload, ts: Date.now() };
  saveSyncQueue([...loadSyncQueue(), op]);
  return op;
}

/** Сетевая ли это ошибка (fetch не долетел), а не отказ сервера */
export function isNetworkError(err: unknown): boolean {
  const msg = String((err as { message?: string })?.message ?? err ?? "").toLowerCase();
  return msg.includes("failed to fetch") || msg.includes("networkerror") || msg.includes("network request failed") || msg.includes("load failed");
}

type Senders = Record<SyncOp["kind"], (uid: string, payload: Record<string, unknown>) => Promise<{ error: unknown }>>;

// Отправители по типу операции; выделены параметром ради юнит-тестируемости
const DEFAULT_SENDERS: Senders = {
  donation: (uid, p) => recordDonation(uid, p.artist as string, p.amount as number, p.toUserId as string | undefined),
  comment: (uid, p) => postComment(uid, p.trackId as string, p.pct as number, p.text as string),
};

/** Доотправляет очередь по порядку. Возвращает число успешных операций.
    Останавливается на первом сетевом сбое (сети всё ещё нет — нет смысла
    долбить остальные); серверный отказ выбрасывает операцию из очереди
    (повтор бессмыслен) и идёт дальше. */
export async function flushSyncQueue(uid: string, senders: Senders = DEFAULT_SENDERS): Promise<number> {
  const queue = loadSyncQueue();
  if (!queue.length) return 0;
  let sent = 0;
  const remaining = [...queue];
  while (remaining.length) {
    const op = remaining[0];
    try {
      const { error } = await senders[op.kind](uid, op.payload);
      if (error && isNetworkError(error)) break; // сеть всё ещё лежит
      // успех или серверный отказ — в обоих случаях операция покидает очередь
      if (!error) sent += 1;
      else console.warn("syncQueue: сервер отклонил операцию, повтор бессмыслен:", op.kind, error);
      remaining.shift();
    } catch (err) {
      if (isNetworkError(err)) break;
      console.warn("syncQueue: операция выброшена:", op.kind, err);
      remaining.shift();
    }
  }
  saveSyncQueue(remaining);
  return sent;
}
