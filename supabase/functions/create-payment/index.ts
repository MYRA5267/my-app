// ─── Edge Function: создание платежа в ЮKassa (донат или подписка) ───────────
// ЮKassa (https://yookassa.ru) — процессинг реальных платежей. Работает ТОЛЬКО
// когда в секретах этой функции заданы YOOKASSA_SHOP_ID и YOOKASSA_SECRET_KEY:
//   supabase secrets set YOOKASSA_SHOP_ID=... YOOKASSA_SECRET_KEY=...
// Сейчас (регистрация бизнеса ещё не завершена, мерчант-аккаунта ЮKassa пока
// не существует) эти секреты сознательно не заданы — тогда функция ниже
// отвечает 503 { error: "payments_not_configured" }. Это ОЖИДАЕМОЕ нормальное
// состояние, а не сбой: клиент (см. createPayment в src/app/supabase.ts и его
// вызовы в src/app/overlays.tsx) трактует именно эту ошибку как сигнал
// "откатись на прежний симулированный флоу", а не как повод падать.
// Тот же приём, что и с OPENROUTER_API_KEY в support-chat/index.ts — секрет
// живёт только на сервере и никогда не попадает в клиентский бандл, в отличие
// от VITE_-переменных.

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const JSON_HEADERS = { ...CORS_HEADERS, "Content-Type": "application/json" };

const VALID_KINDS = ["donation", "subscription"];
const SUBSCRIPTION_PRICE_RUB = 499;
const MIN_DONATION = 10;
// Разумный потолок суммы — защита от опечатки в лишний ноль, не бизнес-лимит.
const MAX_AMOUNT = 100_000;
const MAX_BODY_BYTES = 8_192;
const YOOKASSA_TIMEOUT_MS = 12_000;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...JSON_HEADERS, Allow: "POST, OPTIONS" },
    });
  }

  try {
    const contentLength = Number(req.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
      return new Response(JSON.stringify({ error: "payload_too_large" }), {
        status: 413,
        headers: JSON_HEADERS,
      });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Проверяем личность запросившего обычным (anon + JWT) клиентом — платёж
    // всегда создаётся от имени реально залогиненного пользователя
    const authedClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userError } = await authedClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: JSON_HEADERS });
    }

    const shopId = Deno.env.get("YOOKASSA_SHOP_ID");
    const secretKey = Deno.env.get("YOOKASSA_SECRET_KEY");
    if (!shopId || !secretKey) {
      return new Response(JSON.stringify({ error: "payments_not_configured" }), { status: 503, headers: JSON_HEADERS });
    }

    const body = await req.json().catch(() => null);
    const kind = body?.kind;
    const requestedAmount = Number(body?.amount);
    const toArtist = typeof body?.toArtist === "string"
      ? body.toArtist.trim().slice(0, 120)
      : undefined;
    const toUserId = typeof body?.toUserId === "string" && body.toUserId ? body.toUserId : undefined;

    if (!VALID_KINDS.includes(kind)) {
      return new Response(JSON.stringify({ error: "invalid kind" }), { status: 400, headers: JSON_HEADERS });
    }
    const amount = kind === "subscription" ? SUBSCRIPTION_PRICE_RUB : requestedAmount;
    const planId = kind === "subscription" ? "pro" : undefined;
    if (!Number.isFinite(amount) || amount < MIN_DONATION || amount > MAX_AMOUNT) {
      return new Response(JSON.stringify({ error: "invalid amount" }), { status: 400, headers: JSON_HEADERS });
    }
    if (kind === "donation" && !toArtist) {
      return new Response(JSON.stringify({ error: "toArtist required for donation" }), { status: 400, headers: JSON_HEADERS });
    }

    // Не доверяем Origin запроса: иначе авторизованный вредоносный сайт может
    // подменить страницу возврата после оплаты. Значение задаётся только
    // серверным секретом и обязано быть HTTPS.
    const returnUrlRaw = Deno.env.get("PAYMENT_RETURN_URL")?.trim()
      || "https://app.myramusic.ru/";
    let returnUrl: string;
    try {
      const parsedReturnUrl = new URL(returnUrlRaw);
      if (parsedReturnUrl.protocol !== "https:") throw new Error("HTTPS required");
      returnUrl = parsedReturnUrl.toString();
    } catch {
      console.error("create-payment: invalid PAYMENT_RETURN_URL");
      return new Response(JSON.stringify({ error: "server_not_configured" }), {
        status: 503,
        headers: JSON_HEADERS,
      });
    }

    const description = kind === "donation"
      ? `MYRA: донат артисту ${toArtist}`
      : `MYRA: подписка ${planId ?? "Pro/Plus"}`;

    const ykRes = await fetch("https://api.yookassa.ru/v3/payments", {
      method: "POST",
      signal: AbortSignal.timeout(YOOKASSA_TIMEOUT_MS),
      headers: {
        "Authorization": `Basic ${btoa(`${shopId}:${secretKey}`)}`,
        "Idempotence-Key": crypto.randomUUID(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: { value: amount.toFixed(2), currency: "RUB" },
        confirmation: { type: "redirect", return_url: returnUrl },
        capture: true,
        description,
        metadata: {
          user_id: userData.user.id,
          kind,
          to_artist: toArtist ?? null,
          to_user_id: toUserId ?? null,
          plan_id: planId ?? null,
          price_version: kind === "subscription" ? "pro-rub-499-v1" : null,
        },
      }),
    });

    if (!ykRes.ok) {
      console.error("create-payment: YooKassa error", ykRes.status, await ykRes.text());
      return new Response(JSON.stringify({ error: "yookassa_error" }), { status: 502, headers: JSON_HEADERS });
    }

    const payment = await ykRes.json();
    const confirmationUrl = payment?.confirmation?.confirmation_url;
    if (!payment?.id || !confirmationUrl) {
      console.error("create-payment: unexpected YooKassa response", payment);
      return new Response(JSON.stringify({ error: "yookassa_error" }), { status: 502, headers: JSON_HEADERS });
    }

    // Пишем pending-строку service-role клиентом — этот insert должен пройти
    // всегда, независимо от RLS (обычный клиент вообще не может писать в
    // payments напрямую, см. schema.sql)
    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { error: insertError } = await serviceClient.from("payments").insert({
      id: payment.id,
      user_id: userData.user.id,
      kind,
      status: "pending",
      amount,
      metadata: {
        user_id: userData.user.id,
        kind,
        to_artist: toArtist ?? null,
        to_user_id: toUserId ?? null,
        plan_id: planId ?? null,
        price_version: kind === "subscription" ? "pro-rub-499-v1" : null,
      },
    });

    if (insertError) {
      console.error("create-payment: insert error", insertError);
      return new Response(JSON.stringify({ error: "internal error" }), { status: 500, headers: JSON_HEADERS });
    }

    return new Response(JSON.stringify({ confirmation_url: confirmationUrl, payment_id: payment.id }), { headers: JSON_HEADERS });
  } catch (err) {
    console.error("create-payment error:", err);
    return new Response(JSON.stringify({ error: "internal error" }), { status: 500, headers: JSON_HEADERS });
  }
});
