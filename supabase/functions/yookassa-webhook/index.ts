// ─── Edge Function: вебхук ЮKassa (подтверждение статуса платежа) ────────────
// Публичный эндпоинт — его вызывает напрямую сама ЮKassa (server-to-server),
// без JWT нашего пользователя, поэтому auth.getUser() тут не применяется.
//
// КРИТИЧЕСКИ ВАЖНО, не упрощать: в этом MVP мы НЕ проверяем криптографическую
// подпись входящего запроса (ЮKassa её не подписывает по умолчанию, а IP-
// allowlist ненадёжен за прокси/эджем) — значит ЛЮБОЙ человек в интернете
// может прислать сюда поддельный POST вида
//   {"object": {"id": "любой-id", "status": "succeeded"}}
// и тело само по себе не доказывает вообще ничего. Поэтому из входящего тела
// достаём ТОЛЬКО object.id (какой платёж вообще имеется в виду), а настоящий
// статус независимо перезапрашиваем GET-ом к самой ЮKassa нашим секретным
// ключом — это единственный источник истины здесь. Если в будущем добавится
// проверка подписи вебхука — это лишь дополнительный слой, а не замена этой
// перепроверки.

import { createClient } from "npm:@supabase/supabase-js@2";

const JSON_HEADERS = { "Content-Type": "application/json" };

Deno.serve(async (req: Request) => {
  try {
    const body = await req.json().catch(() => null);
    const paymentId = body?.object?.id;
    // Не похоже на уведомление ЮKassa вообще — отвечаем 200, чтобы не словить
    // бесконечные ретраи чего-то, что мы всё равно не сможем обработать
    if (typeof paymentId !== "string" || !paymentId) {
      return new Response(JSON.stringify({ ok: true }), { headers: JSON_HEADERS });
    }

    const shopId = Deno.env.get("YOOKASSA_SHOP_ID");
    const secretKey = Deno.env.get("YOOKASSA_SECRET_KEY");
    if (!shopId || !secretKey) {
      // Не должно происходить в проде (ЮKassa не может дёргать вебхук без
      // настроенного мерчанта), но на всякий случай — явная ошибка, а не тихий сбой
      console.error("yookassa-webhook: YOOKASSA secrets not configured");
      return new Response(JSON.stringify({ error: "payments_not_configured" }), { status: 503, headers: JSON_HEADERS });
    }

    // Источник истины — независимый GET к ЮKassa нашим же секретным ключом,
    // а НЕ то, что написано в теле входящего вебхука (см. комментарий в шапке)
    const ykRes = await fetch(`https://api.yookassa.ru/v3/payments/${encodeURIComponent(paymentId)}`, {
      headers: { "Authorization": `Basic ${btoa(`${shopId}:${secretKey}`)}` },
    });
    if (!ykRes.ok) {
      console.error("yookassa-webhook: status check failed", ykRes.status, await ykRes.text());
      return new Response(JSON.stringify({ error: "yookassa_error" }), { status: 502, headers: JSON_HEADERS });
    }
    const truth = await ykRes.json();
    const trueStatus = truth?.status;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: row, error: fetchError } = await serviceClient
      .from("payments")
      .select("*")
      .eq("id", paymentId)
      .maybeSingle();
    if (fetchError) {
      console.error("yookassa-webhook: fetch payment row error", fetchError);
      return new Response(JSON.stringify({ error: "internal error" }), { status: 500, headers: JSON_HEADERS });
    }
    // Платёж нам не знаком (не создавался через create-payment, или чужой
    // мерчант) — игнорируем, отвечаем 200, чтобы ЮKassa не ретраила вечно
    if (!row) {
      return new Response(JSON.stringify({ ok: true }), { headers: JSON_HEADERS });
    }
    // Уже обработан ранее — ЮKassa может доставлять один и тот же вебхук
    // несколько раз, это НЕ повод повторно вставлять донат/продлевать подписку
    if (row.status === "succeeded") {
      return new Response(JSON.stringify({ ok: true }), { headers: JSON_HEADERS });
    }

    if (trueStatus === "succeeded") {
      const { error: updateError } = await serviceClient
        .from("payments")
        .update({ status: "succeeded", updated_at: new Date().toISOString() })
        .eq("id", paymentId);
      if (updateError) {
        console.error("yookassa-webhook: update payment error", updateError);
        return new Response(JSON.stringify({ error: "internal error" }), { status: 500, headers: JSON_HEADERS });
      }

      const metadata = (row.metadata ?? {}) as Record<string, unknown>;
      if (row.kind === "donation") {
        const { error: donationError } = await serviceClient.from("donations").insert({
          from_user: metadata.user_id,
          to_artist: (metadata.to_artist as string | null) ?? "",
          amount: row.amount,
          to_user_id: (metadata.to_user_id as string | null) ?? null,
        });
        if (donationError) console.error("yookassa-webhook: insert donation error", donationError);
      } else if (row.kind === "subscription") {
        const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        const { error: subError } = await serviceClient
          .from("subscriptions")
          .upsert({ user_id: metadata.user_id, status: "active", current_period_end: periodEnd }, { onConflict: "user_id" });
        if (subError) console.error("yookassa-webhook: upsert subscription error", subError);
      }
    } else if (trueStatus === "canceled") {
      const { error: updateError } = await serviceClient
        .from("payments")
        .update({ status: "canceled", updated_at: new Date().toISOString() })
        .eq("id", paymentId);
      if (updateError) console.error("yookassa-webhook: update payment (canceled) error", updateError);
    }
    // Любой другой статус (pending, waiting_for_capture...) — просто не финальный
    // случай, ничего не делаем, ждём следующего вебхука с уже финальным статусом

    return new Response(JSON.stringify({ ok: true }), { headers: JSON_HEADERS });
  } catch (err) {
    console.error("yookassa-webhook error:", err);
    return new Response(JSON.stringify({ error: "internal error" }), { status: 500, headers: JSON_HEADERS });
  }
});
