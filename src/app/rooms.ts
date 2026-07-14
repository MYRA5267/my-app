import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase, supabaseEnabled } from "./supabase";

export interface RoomState { trackId: number; playing: boolean; progress: number }

export interface RoomHandle { channel: RealtimeChannel; code: string }

// Без похожих на вид символов (0/O, 1/I) — код читают и вслух, и с экрана
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function makeRoomCode(): string {
  let s = "";
  for (let i = 0; i < 5; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}
// Валидация — по тому же алфавиту, что и генерация (не [A-Z2-9] целиком):
// иначе код с I/O проходит проверку формата и просто зависает в пустом канале
const CODE_RE = new RegExp(`^[${CODE_CHARS}]{5}$`);
export const isValidRoomCode = (code: string) => CODE_RE.test(code);

/**
 * Настоящая комната на Supabase Realtime: код — это имя канала, поэтому он
 * либо реально соединяет двух человек, либо нет — никакого "мёртвого"
 * состояния, как у демо-инвайтов в остальном приложении (genInviteCode
 * никуда не ведёт без бэкенда). Без Supabase — null, и вызывающий код
 * должен честно показать, что комнаты недоступны, а не подделать связь.
 */
export function connectRoom(code: string, handlers: {
  onState: (s: RoomState) => void;
  onCount: (n: number) => void;
  onStatus: (s: "connected" | "reconnecting" | "closed") => void;
}): RoomHandle | null {
  if (!supabaseEnabled || !supabase) return null;
  const memberKey = Math.random().toString(36).slice(2);
  const channel = supabase.channel(`room:${code}`, { config: { presence: { key: memberKey } } });
  channel
    .on("broadcast", { event: "state" }, ({ payload }) => handlers.onState(payload as RoomState))
    .on("presence", { event: "sync" }, () => handlers.onCount(Object.keys(channel.presenceState()).length))
    .subscribe(status => {
      // LIVE-бейдж в UI не должен молча врать при обрыве связи — статусы
      // разрыва (TIMED_OUT/CHANNEL_ERROR/CLOSED) реально приходят от библиотеки
      if (status === "SUBSCRIBED") { channel.track({ at: Date.now() }); handlers.onStatus("connected"); }
      else if (status === "TIMED_OUT" || status === "CHANNEL_ERROR") handlers.onStatus("reconnecting");
      else if (status === "CLOSED") handlers.onStatus("closed");
    });
  return { channel, code };
}

export function broadcastRoomState(handle: RoomHandle, state: RoomState) {
  handle.channel.send({ type: "broadcast", event: "state", payload: state });
}

export function disconnectRoom(handle: RoomHandle) {
  // unsubscribe() закрывает подписку, но НЕ убирает канал из внутреннего
  // списка клиента (supabase.channel(topic) с тем же именем вернул бы этот
  // же мёртвый объект при следующем входе в комнату) — removeChannel() зовёт
  // unsubscribe() и делает teardown(), реально освобождая канал
  if (supabase) supabase.removeChannel(handle.channel);
  else handle.channel.unsubscribe();
}
