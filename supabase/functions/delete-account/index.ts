// ─── Edge Function: реальное удаление аккаунта ───────────────────────────────
// До этой функции "Удалить аккаунт" в приложении только гасил локальное
// состояние (localStorage/IndexedDB) — сам auth.users, profiles и всё, что на
// него ссылается (tracks, comments, donations, support_messages, admins,
// subscriptions, follows), оставалось в базе навсегда, хотя UI прямым текстом
// обещает "сотрутся навсегда". Удалить свою же запись auth.users клиент не
// может в принципе — это делает только Admin API service-role ключом, поэтому
// нужна отдельная функция, а не RLS-политика.
//
// Каскад: profiles.id -> auth.users(id) on delete cascade, и дальше все
// остальные таблицы -> profiles(id) on delete cascade — значит достаточно
// удалить только пользователя из auth.users, всё связанное с ним удалится
// автоматически силами Postgres, без ручного перечисления таблиц здесь.

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const JSON_HEADERS = { ...CORS_HEADERS, "Content-Type": "application/json" };

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Проверяем личность запросившего обычным (anon + JWT) клиентом — удалить
    // можно только себя самого, никакой uid из тела запроса не принимаем
    const authedClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userError } = await authedClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: JSON_HEADERS });
    }

    // Admin API — доступен только service-role ключу, обычный клиент удалить
    // себя из auth.users не может вообще никак
    const adminClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { error } = await adminClient.auth.admin.deleteUser(userData.user.id);

    if (error) {
      console.error("delete-account error:", error);
      return new Response(JSON.stringify({ error: "delete failed" }), { status: 500, headers: JSON_HEADERS });
    }

    return new Response(JSON.stringify({ ok: true }), { headers: JSON_HEADERS });
  } catch (err) {
    console.error("delete-account error:", err);
    return new Response(JSON.stringify({ error: "internal error" }), { status: 500, headers: JSON_HEADERS });
  }
});
