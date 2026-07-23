// ─── Edge Function: ИИ-ответ в чате поддержки ────────────────────────────────
// Держит ключ OpenRouter только на сервере — фронтенд его никогда не видит,
// в отличие от VITE_-переменных, которые зашиваются прямо в клиентский бандл.

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const JSON_HEADERS = { ...CORS_HEADERS, "Content-Type": "application/json" };

// OpenRouter стоит реальных денег за каждый вызов — без этого порога любой
// залогиненный пользователь мог бы в цикле гонять эндпоинт и раздуть счёт.
// 8 сообщений в минуту — с большим запасом выше обычного темпа переписки
// человека (даже быстрый диалог — это несколько сообщений за минуты, не
// секунды), но достаточно низко, чтобы остановить скрипт-спам
const RATE_LIMIT_PER_MINUTE = 8;
const MAX_BODY_BYTES = 32_768;
const OPENROUTER_TIMEOUT_MS = 15_000;

// Контекст о приложении — чтобы модель отвечала по делу, а не общими фразами
const SYSTEM_PROMPT = `Ты — служба поддержки музыкального стриминга MYRA. Отвечай кратко (2-4 предложения), дружелюбно и по делу, на языке, на котором пишет пользователь.

Пиши обычным простым текстом, как в мессенджере — без разметки Markdown: никаких звёздочек для выделения, никаких decorated-заголовков, никаких настоящих нумерованных или маркированных списков. Если нужно перечислить несколько шагов — впиши их в одно-два предложения через запятую или точку с запятой, а не списком.

Контекст о приложении:
- MYRA — стриминг музыки: каталог треков, лайки, плейлисты, подкасты, чарты, персональные рекомендации ("Моя волна").
- Донаты артистам: без комиссии, вся сумма уходит артисту напрямую.
- На первом публичном релизе пользовательские функции бесплатны. Не обещай активную платную подписку или успешный платёж: оплата доступна только после отдельного подключения официального процессинга.
- Студия — только для артистов: публикация своих треков через форму (название, жанр, текст песни, обложка).
- Обычные слушатели тоже могут загружать свою музыку в Медиатеке — просто для прослушивания и обмена с друзьями, без формы публикации.
- Уровни и опыт: 10 XP за каждую минуту прослушанной музыки, пороги уровней растут (300, 500, 700, 900 XP...). Награды на уровнях 5, 10, 25, 50, 100 — бейджи, рамка аватара, ранний доступ, скидка на MYRA Pro.
- Достижения в разделе "Рейтинг" — за прослушивания, стрики, лайки, плейлисты, релизы, донаты, уровни.

Если вопрос касается конкретных данных аккаунта пользователя (баланс, история платежей и т.п.) — честно скажи, что не можешь проверить детали аккаунта напрямую, и предложи описать ситуацию подробнее для передачи команде.`;

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

    // Проверяем, что запрос пришёл от реально залогиненного пользователя приложения —
    // иначе кто угодно из интернета мог бы бесплатно "арендовать" наш OpenRouter-ключ
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: JSON_HEADERS });
    }

    // Rate limit по своим же сообщениям за последнюю минуту. Считаем тем же
    // supabaseClient, что и auth.getUser() выше (он аутентифицирован как сам
    // вызывающий пользователь) — RLS support_messages_select_own и так не
    // даст увидеть чужие строки, но .eq("user_id", ...) явный, чтобы не
    // зависеть только от RLS (у админов есть отдельная политика на ЛЮБОЙ
    // тред, и без явного фильтра здесь считался бы чужой трафик тоже).
    // head:true — считаем count() без выкачивания самих строк.
    const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
    const { count: recentCount, error: rateError } = await supabaseClient
      .from("support_messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userData.user.id)
      .eq("from_role", "user")
      .gt("created_at", oneMinuteAgo);
    // OpenRouter тарифицирует каждый запрос, поэтому при сбое самого счётчика
    // безопаснее временно отказать, чем открыть неограниченный платный endpoint.
    if (rateError) {
      console.error("support-chat: rate limit check failed", rateError);
      return new Response(JSON.stringify({ error: "rate_limit_unavailable" }), {
        status: 503,
        headers: JSON_HEADERS,
      });
    }
    if ((recentCount ?? 0) >= RATE_LIMIT_PER_MINUTE) {
      return new Response(JSON.stringify({ error: "rate_limited" }), { status: 429, headers: JSON_HEADERS });
    }

    const { messages } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages required" }), { status: 400, headers: JSON_HEADERS });
    }

    // Ограничиваем историю и длину сообщений — простая защита от злоупотребления
    const trimmed = messages.slice(-12).map((m: { role?: string; content?: unknown }) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content ?? "").slice(0, 2000),
    })).filter((message: { content: string }) => message.content.trim().length > 0);
    if (trimmed.length === 0) {
      return new Response(JSON.stringify({ error: "messages required" }), {
        status: 400,
        headers: JSON_HEADERS,
      });
    }

    const openrouterKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!openrouterKey) {
      return new Response(JSON.stringify({ error: "AI not configured" }), { status: 503, headers: JSON_HEADERS });
    }

    const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: AbortSignal.timeout(OPENROUTER_TIMEOUT_MS),
      headers: {
        "Authorization": `Bearer ${openrouterKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "anthropic/claude-haiku-4.5",
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...trimmed],
        max_tokens: 400,
      }),
    });

    if (!aiRes.ok) {
      console.error("OpenRouter error:", await aiRes.text());
      return new Response(JSON.stringify({ error: "AI request failed" }), { status: 502, headers: JSON_HEADERS });
    }

    const aiData = await aiRes.json();
    const reply = aiData?.choices?.[0]?.message?.content ?? "";
    return new Response(JSON.stringify({ reply }), { headers: JSON_HEADERS });
  } catch (err) {
    console.error("support-chat error:", err);
    const timedOut = err instanceof DOMException && err.name === "TimeoutError";
    return new Response(JSON.stringify({ error: timedOut ? "upstream_timeout" : "internal_error" }), {
      status: timedOut ? 504 : 500,
      headers: JSON_HEADERS,
    });
  }
});
