// ─── Edge Function: безопасная отмена подписки MYRA Pro ─────────────────────
// Активация и продление подписки выполняются ТОЛЬКО yookassa-webhook после
// независимой проверки платежа у ЮKassa. Клиентский JWT здесь даёт право лишь
// отключить собственную подписку. Это важно: service-role обходит RLS, поэтому
// принимать от клиента status="active" или status="grace" недопустимо.

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const JSON_HEADERS = { ...CORS_HEADERS, "Content-Type": "application/json" };

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...JSON_HEADERS, Allow: "POST, OPTIONS" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authedClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await authedClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: JSON_HEADERS,
      });
    }

    const body = await req.json().catch(() => null);
    if (body?.status !== "none") {
      return new Response(JSON.stringify({
        error: "server_managed_status",
        message: "Подписку активирует только подтверждённый платёж.",
      }), { status: 403, headers: JSON_HEADERS });
    }

    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceRoleKey) {
      console.error("set-subscription: SUPABASE_SERVICE_ROLE_KEY is missing");
      return new Response(JSON.stringify({ error: "server_not_configured" }), {
        status: 503,
        headers: JSON_HEADERS,
      });
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey);
    const { error } = await serviceClient
      .from("subscriptions")
      .upsert({
        user_id: userData.user.id,
        status: "none",
        current_period_end: null,
      }, { onConflict: "user_id" });

    if (error) {
      console.error("set-subscription error:", error);
      return new Response(JSON.stringify({ error: "update_failed" }), {
        status: 500,
        headers: JSON_HEADERS,
      });
    }

    return new Response(JSON.stringify({ ok: true, status: "none" }), {
      headers: JSON_HEADERS,
    });
  } catch (err) {
    console.error("set-subscription error:", err);
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500,
      headers: JSON_HEADERS,
    });
  }
});
