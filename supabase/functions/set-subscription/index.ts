// ─── Edge Function: смена статуса подписки (MYRA Pro / MYRA Plus) ────────────
// RLS на subscriptions намеренно запрещает клиенту самому ставить status='active'
// (см. supabase/schema.sql — "subscriptions_update_own") — иначе любой залогиненный
// пользователь мог бы бесплатно включить себе платный статус прямым UPDATE.
// Активация оплаты в приложении пока симулирована (нет процессинга), но сам факт
// "оплата прошла" должен подтверждать доверенный бэкенд, а не сам клиент — эта
// функция и есть та граница: держит service-role ключ, который RLS не касается.

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const JSON_HEADERS = { ...CORS_HEADERS, "Content-Type": "application/json" };

const VALID_STATUSES = ["none", "active", "grace"];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Проверяем личность запросившего обычным (anon + JWT) клиентом
    const authedClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userError } = await authedClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: JSON_HEADERS });
    }

    const { status } = await req.json();
    if (!VALID_STATUSES.includes(status)) {
      return new Response(JSON.stringify({ error: "invalid status" }), { status: 400, headers: JSON_HEADERS });
    }

    // Пишем уже service-role клиентом — он идёт в обход RLS, это единственное
    // место в приложении, где status='active' физически можно проставить
    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { error } = await serviceClient
      .from("subscriptions")
      .upsert({ user_id: userData.user.id, status }, { onConflict: "user_id" });

    if (error) {
      console.error("set-subscription error:", error);
      return new Response(JSON.stringify({ error: "update failed" }), { status: 500, headers: JSON_HEADERS });
    }

    return new Response(JSON.stringify({ ok: true }), { headers: JSON_HEADERS });
  } catch (err) {
    console.error("set-subscription error:", err);
    return new Response(JSON.stringify({ error: "internal error" }), { status: 500, headers: JSON_HEADERS });
  }
});
