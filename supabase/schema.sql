-- ============================================================================
-- MYRA — схема базы данных (Supabase / Postgres)
-- ============================================================================
-- Файл идемпотентен: весь целиком, сверху вниз, можно вставлять в Supabase
-- SQL Editor и жать Run сколько угодно раз — на чистом проекте, и повторно
-- после того, как в файл дописали новую секцию. Уже существующие таблицы/
-- политики/индексы/колонки пропускаются, создаётся только то, чего не хватает.
--
-- Архитектурная граница (важно!):
--   Каталог/контент (массив TRACKS в src/app/data.ts — 8 демо-треков с
--   маленькими числовыми id 1-8, ARTISTS, CHARTS, PLAYLISTS и т.д.) остаётся
--   статичными данными фронтенда и НИКОГДА не попадает в базу. Здесь хранятся
--   только по-настоящему пользовательские данные: аккаунты, треки, реально
--   опубликованные через форму релиза, комментарии, донаты, подписки и фоллоу.
-- ============================================================================

-- gen_random_uuid() живёт в pgcrypto (в новых проектах Supabase уже включена
-- через pgcrypto/pg_graphql по умолчанию, но на всякий случай — явно)
create extension if not exists pgcrypto;

-- ============================================================================
-- 1. profiles — профили пользователей: одна строка на аккаунт
-- ============================================================================
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  username   text not null,
  handle     text, -- публичный @хендл; если пусто, фронтенд сам генерирует его из username
  avatar_url text,
  role       text not null default 'listener' check (role in ('artist', 'listener')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Смотреть профиль может кто угодно (нужно для будущего лидерборда и
-- страниц артистов — публичные данные). Почта сюда намеренно не входит —
-- она PII и живёт отдельно, в profile_private (см. ниже)
drop policy if exists "profiles_select_public" on public.profiles;
create policy "profiles_select_public"
  on public.profiles for select
  using (true);

-- Создать свой профиль может только сам пользователь (обычно это делает
-- триггер handle_new_user, но политика оставлена и для прямых вставок с клиента)
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Редактировать можно только свой собственный профиль
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);


-- ============================================================================
-- 1b. profile_private — приватные данные профиля (сейчас — только почта)
-- ============================================================================
-- Почта — персональные данные, её не должен видеть никто, кроме владельца.
-- Вынесена из profiles в отдельную таблицу именно поэтому: profiles публично
-- читаем (using (true)) ради лидерборда/профилей артистов, и если бы email
-- лежал в той же таблице, он утёк бы вместе с публичными полями всем подряд.
create table if not exists public.profile_private (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  email      text,
  updated_at timestamptz not null default now()
);

alter table public.profile_private enable row level security;

-- Видеть и писать свою почту может только сам пользователь — публичного
-- SELECT здесь нет и не должно быть
drop policy if exists "profile_private_select_own" on public.profile_private;
create policy "profile_private_select_own"
  on public.profile_private for select
  using (auth.uid() = user_id);

drop policy if exists "profile_private_insert_own" on public.profile_private;
create policy "profile_private_insert_own"
  on public.profile_private for insert
  with check (auth.uid() = user_id);

drop policy if exists "profile_private_update_own" on public.profile_private;
create policy "profile_private_update_own"
  on public.profile_private for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ============================================================================
-- 2. tracks — треки, реально опубликованные пользователем через форму релиза
-- ============================================================================
-- ВНИМАНИЕ: сюда не попадают демо-треки из статичного каталога (data.ts) —
-- только то, что артист сам загрузил через Студию/форму релиза.
create table if not exists public.tracks (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  title      text not null,
  genre      text,
  lyrics     text,
  cover_url  text,
  audio_url  text not null,
  created_at timestamptz not null default now()
);

-- Ускоряет выборку «все треки артиста» (профиль артиста, Студия)
create index if not exists tracks_owner_id_idx on public.tracks (owner_id);

alter table public.tracks enable row level security;

-- Треки публичны — их может смотреть/слушать кто угодно
drop policy if exists "tracks_select_public" on public.tracks;
create policy "tracks_select_public"
  on public.tracks for select
  using (true);

-- Публиковать трек можно только от своего имени (owner_id = сам пользователь)
drop policy if exists "tracks_insert_own" on public.tracks;
create policy "tracks_insert_own"
  on public.tracks for insert
  with check (auth.uid() = owner_id);

-- Редактировать можно только свои треки
drop policy if exists "tracks_update_own" on public.tracks;
create policy "tracks_update_own"
  on public.tracks for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- Удалять можно только свои треки
drop policy if exists "tracks_delete_own" on public.tracks;
create policy "tracks_delete_own"
  on public.tracks for delete
  using (auth.uid() = owner_id);


-- ============================================================================
-- 3. comments — комментарии, привязанные к позиции на волне трека (pct)
-- ============================================================================
-- track_id — намеренно text, а не жёсткий внешний ключ: сюда пишется либо
-- реальный tracks.id (uuid), приведённый к тексту, для опубликованных треков,
-- либо строка вида "catalog:3" — числовой id статичного демо-трека из
-- каталога, которого в таблице tracks нет и никогда не будет. Жёсткий FK
-- здесь физически невозможен из-за смешанной природы источника.
create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  track_id   text not null,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  pct        numeric not null default 0, -- позиция на волне, 0-100 (см. Comment.pct на фронтенде)
  text       text not null,
  created_at timestamptz not null default now()
);

-- Обычный btree-индекс для быстрой выборки «все комментарии этого трека»
create index if not exists comments_track_id_idx on public.comments (track_id);

alter table public.comments enable row level security;

-- Комментарии публичны — их видит кто угодно
drop policy if exists "comments_select_public" on public.comments;
create policy "comments_select_public"
  on public.comments for select
  using (true);

-- Писать комментарий можно только от своего имени
-- (UPDATE/DELETE-политик намеренно нет — комментарии неизменяемы/append-only,
-- как и на текущем фронтенде: добавить можно, отредактировать/удалить нельзя)
drop policy if exists "comments_insert_own" on public.comments;
create policy "comments_insert_own"
  on public.comments for insert
  with check (auth.uid() = user_id);


-- ============================================================================
-- 4. donations — донаты артистам (по имени артиста, не по id)
-- ============================================================================
-- to_artist — обычный текст с именем артиста (например "Luna Wave"), т.к.
-- артисты каталога пока не являются реальными аккаунтами. Это зеркалит
-- существующий флоу доната из ArtistSheet на фронтенде, который тоже
-- работает по имени артиста, а не по id.
create table if not exists public.donations (
  id         uuid primary key default gen_random_uuid(),
  from_user  uuid not null references public.profiles(id) on delete cascade,
  to_artist  text not null,
  amount     numeric not null check (amount > 0),
  created_at timestamptz not null default now()
);

alter table public.donations enable row level security;

-- Видеть свои донаты может только сам отправитель
drop policy if exists "donations_select_own" on public.donations;
create policy "donations_select_own"
  on public.donations for select
  using (auth.uid() = from_user);

-- Создавать донат можно только от своего имени
drop policy if exists "donations_insert_own" on public.donations;
create policy "donations_insert_own"
  on public.donations for insert
  with check (auth.uid() = from_user);


-- ============================================================================
-- 5. subscriptions — статус подписки MYRA Pro (в коде иногда встречается
--    старое название "Creator+" — это одно и то же)
-- ============================================================================
create table if not exists public.subscriptions (
  user_id             uuid primary key references public.profiles(id) on delete cascade,
  status              text not null default 'none' check (status in ('none', 'active', 'grace')),
  current_period_end  timestamptz,
  created_at          timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

-- Видеть свой статус подписки может только сам пользователь
drop policy if exists "subscriptions_select_own" on public.subscriptions;
create policy "subscriptions_select_own"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- Клиент НЕ может сам выдать себе активную подписку — иначе любой
-- авторизованный пользователь мог бы бесплатно включить себе MYRA Pro
-- прямым UPDATE (реальная оплата ещё не подключена, а даже когда будет —
-- статус 'active' должен ставить только доверенный бэкенд/вебхук оплаты
-- сервисным ключом, который не связан RLS). Клиенту разрешена только
-- самостоятельная отмена — переход НЕ в 'active' (например, в 'grace' или 'none')
drop policy if exists "subscriptions_update_own" on public.subscriptions;
create policy "subscriptions_update_own"
  on public.subscriptions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and status <> 'active');


-- ============================================================================
-- 6. follows — подписки пользователя на артистов (по имени артиста)
-- ============================================================================
create table if not exists public.follows (
  id          uuid primary key default gen_random_uuid(),
  follower_id uuid not null references public.profiles(id) on delete cascade,
  artist_name text not null,
  created_at  timestamptz not null default now(),
  unique (follower_id, artist_name)
);

alter table public.follows enable row level security;

-- Список фоллоу публичен (нужно для счётчиков подписчиков артиста и т.п.)
drop policy if exists "follows_select_public" on public.follows;
create policy "follows_select_public"
  on public.follows for select
  using (true);

-- Подписаться можно только от своего имени
drop policy if exists "follows_insert_own" on public.follows;
create policy "follows_insert_own"
  on public.follows for insert
  with check (auth.uid() = follower_id);

-- Отписаться можно только от своего имени
drop policy if exists "follows_delete_own" on public.follows;
create policy "follows_delete_own"
  on public.follows for delete
  using (auth.uid() = follower_id);


-- ============================================================================
-- Триггер: автосоздание профиля (и подписки) при регистрации нового
-- пользователя в auth.users — стандартный паттерн Supabase.
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Профиль: username/role берутся из raw_user_meta_data, если переданы
  -- при регистрации (supabase.auth.signUp({ options: { data: {...} } })),
  -- иначе — разумные значения по умолчанию.
  insert into public.profiles (id, username, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'role', 'listener')
  );

  -- Почта — отдельно, в приватную таблицу (см. profile_private выше)
  insert into public.profile_private (user_id, email)
  values (new.id, new.email);

  -- У каждого профиля с первого дня есть строка в subscriptions (статус
  -- 'none'), чтобы на клиенте не приходилось обрабатывать null/отсутствие строки.
  insert into public.subscriptions (user_id, status)
  values (new.id, 'none');

  return new;
end;
$$;

-- SECURITY DEFINER выше позволяет функции обойти RLS таблиц profiles/subscriptions
-- (она выполняется от имени владельца функции, а не от анонимного/нового пользователя)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ============================================================================
-- GRANT — обязательный шаг помимо RLS-политик выше!
-- ============================================================================
-- RLS-политики контролируют доступ к СТРОКАМ, но сама роль (anon/authenticated)
-- должна ещё получить право на операцию с ТАБЛИЦЕЙ вообще — иначе Postgres
-- откажет с "permission denied for table ...", даже не дойдя до проверки RLS.
-- При создании таблиц через Table Editor в Supabase это делается автоматически;
-- при создании через SQL Editor (как здесь) — нужно явно. GRANT сам по себе
-- идемпотентен — повторный запуск той же выдачи прав никогда не ошибается.
grant usage on schema public to anon, authenticated;

grant select on public.profiles to anon, authenticated;
grant insert, update on public.profiles to authenticated;

grant select, insert, update on public.profile_private to authenticated;

grant select on public.tracks to anon, authenticated;
grant insert, update, delete on public.tracks to authenticated;

grant select on public.comments to anon, authenticated;
grant insert on public.comments to authenticated;

grant select, insert on public.donations to authenticated;

grant select, update on public.subscriptions to authenticated;

grant select on public.follows to anon, authenticated;
grant insert, delete on public.follows to authenticated;


-- ============================================================================
-- 7. Storage bucket "tracks" — аудиофайлы опубликованных треков
-- ============================================================================
-- tracks.audio_url — not null, а хранить сам бинарник аудио в text-колонке
-- Postgres нельзя (раздует таблицу и WAL) — поэтому файл лежит в Supabase
-- Storage, а в audio_url — только его публичная ссылка (getPublicUrl).
--
-- Путь объекта в бакете организован как "{uid}/{trackId}.{ext}" — первый
-- сегмент пути обязан быть auth.uid() владельца, чтобы политики insert/
-- update/delete ниже могли это проверить через storage.foldername(name)
-- (первый элемент результата — как раз папка верхнего уровня).
insert into storage.buckets (id, name, public)
values ('tracks', 'tracks', true)
on conflict (id) do nothing;

-- Бакет публичный на чтение — трек слушает кто угодно, без авторизации
-- (как и сама таблица tracks, см. tracks_select_public выше)
drop policy if exists "tracks_storage_select_public" on storage.objects;
create policy "tracks_storage_select_public"
  on storage.objects for select
  using (bucket_id = 'tracks');

-- Заливать файл можно только в свою же папку {auth.uid()}/...
drop policy if exists "tracks_storage_insert_own" on storage.objects;
create policy "tracks_storage_insert_own"
  on storage.objects for insert
  with check (bucket_id = 'tracks' and auth.uid()::text = (storage.foldername(name))[1]);

-- Перезаливать (upsert) можно только свои же файлы
drop policy if exists "tracks_storage_update_own" on storage.objects;
create policy "tracks_storage_update_own"
  on storage.objects for update
  using (bucket_id = 'tracks' and auth.uid()::text = (storage.foldername(name))[1]);

-- Удалять можно только свои файлы
drop policy if exists "tracks_storage_delete_own" on storage.objects;
create policy "tracks_storage_delete_own"
  on storage.objects for delete
  using (bucket_id = 'tracks' and auth.uid()::text = (storage.foldername(name))[1]);


-- ============================================================================
-- 8. admins — плоский список создателей MYRA (для админ-инбокса поддержки)
-- ============================================================================
-- Сознательно нет insert/update/delete-политик для anon/authenticated: строки
-- сюда добавляют вручную сами создатели через Table Editor в Supabase Dashboard.
-- Это защита от самовыдачи админки — если бы insert был разрешён с клиента,
-- любой авторизованный пользователь мог бы вписать себя в эту таблицу и
-- получить доступ к чужой переписке в support_messages ниже.
create table if not exists public.admins (
  user_id uuid primary key references public.profiles(id) on delete cascade
);

alter table public.admins enable row level security;

-- Каждый может проверить только СВОЮ строку ("я админ?") — этого достаточно
-- клиенту для гейта UI. Видеть весь список админов никому не нужно.
drop policy if exists "admins_select_own" on public.admins;
create policy "admins_select_own"
  on public.admins for select
  using (auth.uid() = user_id);


-- ============================================================================
-- 9. support_messages — переписка с поддержкой (пользователь ⇄ ИИ ⇄ админ)
-- ============================================================================
-- user_id — это автор ТРЕДА (обычный пользователь, чей это тикет), а не автор
-- конкретной строки: когда админ отвечает в чужом тикете, его ответ тоже
-- пишется с этим же user_id (id треда), только с from_role='support'.
create table if not exists public.support_messages (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  from_role  text not null check (from_role in ('user', 'support', 'ai')),
  text       text not null,
  created_at timestamptz not null default now(),
  read_at    timestamptz
);

-- Ускоряет выборку «весь тред этого пользователя» (свой чат и админ-инбокс)
create index if not exists support_messages_user_id_idx on public.support_messages (user_id);

alter table public.support_messages enable row level security;

-- Свой тред видит сам пользователь...
drop policy if exists "support_messages_select_own" on public.support_messages;
create policy "support_messages_select_own"
  on public.support_messages for select
  using (auth.uid() = user_id);

-- ...а админ — вообще любой тред (несколько permissive-политик для одной
-- операции объединяются через OR, отдельный security definer не нужен —
-- admins сама читаема хотя бы для своей строки, exists() внутри чужой
-- RLS-политики это использует обычным select)
drop policy if exists "support_messages_select_admin" on public.support_messages;
create policy "support_messages_select_admin"
  on public.support_messages for select
  using (exists (select 1 from public.admins where user_id = auth.uid()));

-- Пользователь пишет в свой же тред, но НЕ может подделать from_role='support' —
-- иначе можно было бы нарисовать себе фальшивый "официальный" ответ поддержки.
-- from_role='ai' здесь тоже разрешён: автоответ ИИ в чате сохраняется тем же
-- клиентским запросом от имени самого пользователя, отдельного сервисного
-- вызова под это не заводим.
drop policy if exists "support_messages_insert_own" on public.support_messages;
create policy "support_messages_insert_own"
  on public.support_messages for insert
  with check (auth.uid() = user_id and from_role in ('user', 'ai'));

-- Админ отвечает в ЧУЖОМ треде (user_id = id треда, а не его собственный uid) —
-- это в принципе не покрывается "auth.uid() = user_id", поэтому нужна отдельная
-- insert-политика именно для админов, тоже через exists() в admins
drop policy if exists "support_messages_insert_admin" on public.support_messages;
create policy "support_messages_insert_admin"
  on public.support_messages for insert
  with check (from_role = 'support' and exists (select 1 from public.admins where user_id = auth.uid()));

-- UPDATE нужен админам — пометить сообщения пользователя прочитанными
-- (read_at) при открытии треда в инбоксе. Обычным пользователям UPDATE не
-- нужен: переписка, как и комментарии выше, append-only с их стороны.
drop policy if exists "support_messages_update_admin" on public.support_messages;
create policy "support_messages_update_admin"
  on public.support_messages for update
  using (exists (select 1 from public.admins where user_id = auth.uid()));


-- ============================================================================
-- GRANT для таблиц из секций 8-9 выше (см. пояснение про grant в начале файла)
-- ============================================================================
grant select on public.admins to authenticated;

grant select, insert, update on public.support_messages to authenticated;


-- ============================================================================
-- 10. donations — донаты настоящим артистам (to_user_id)
-- ============================================================================
-- Раньше donations.to_artist был просто текстовым именем — донатить можно
-- было только демо-артистам каталога, у которых нет реального аккаунта.
-- Теперь, когда Студия реально публикует треки (см. секцию 2, tracks), у
-- артистов появились настоящие профили — добавляем nullable-ссылку на
-- получателя, не трогая существующую колонку to_artist (она остаётся
-- денормализованным именем на момент доната, полезным для истории/показа).
-- on delete set null — если артист позже удалит аккаунт, история доната у
-- отправителя не должна пропадать, просто перестаёт указывать на профиль.
alter table public.donations
  add column if not exists to_user_id uuid references public.profiles(id) on delete set null;

create index if not exists donations_to_user_id_idx on public.donations (to_user_id);

-- До этой секции донат мог видеть только отправитель (donations_select_own) —
-- получателю банально нечего было видеть, все получатели были демо-каталогом.
-- Теперь настоящему артисту нужно видеть, что ему реально задонатили.
drop policy if exists "donations_select_received" on public.donations;
create policy "donations_select_received"
  on public.donations for select
  using (auth.uid() = to_user_id);


-- ============================================================================
-- 11. user_follows — реальные подписки между аккаунтами (соцслой в духе
--    "Сигнала": лента активности настоящих людей, а не демо-каталога)
-- ============================================================================
-- Не путать с follows (секция 6 выше): там artist_name — text с именем
-- демо-артиста статичного каталога (ARTISTS в data.ts), реального аккаунта
-- за этой строкой принципиально нет. Подписка человека на человека — другая
-- по смыслу сущность с другим ключом (followee_id uuid -> profiles.id),
-- поэтому это отдельная новая таблица, а не столбец в старой и не изменение
-- уже существующей секции 6.
create table if not exists public.user_follows (
  id          uuid primary key default gen_random_uuid(),
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followee_id uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (follower_id, followee_id),
  check (follower_id <> followee_id)
);

-- Ускоряет и "на кого я подписан" (лента друзей на клиенте), и возможный
-- будущий публичный счётчик подписчиков
create index if not exists user_follows_follower_id_idx on public.user_follows (follower_id);
create index if not exists user_follows_followee_id_idx on public.user_follows (followee_id);

alter table public.user_follows enable row level security;

-- В отличие от follows_select_public (секция 6) — здесь select только СВОИХ
-- подписок: в этом MVP список того, на кого подписан конкретный живой
-- человек, не показывается публично (нет ни счётчика подписчиков, ни списка
-- "кто подписан на меня" в интерфейсе). Ужесточать/открывать можно позже,
-- если понадобится публичный счётчик на профиле артиста.
drop policy if exists "user_follows_select_own" on public.user_follows;
create policy "user_follows_select_own"
  on public.user_follows for select
  using (auth.uid() = follower_id);

-- Подписаться можно только от своего имени
drop policy if exists "user_follows_insert_own" on public.user_follows;
create policy "user_follows_insert_own"
  on public.user_follows for insert
  with check (auth.uid() = follower_id);

-- Отписаться можно только от своего имени
drop policy if exists "user_follows_delete_own" on public.user_follows;
create policy "user_follows_delete_own"
  on public.user_follows for delete
  using (auth.uid() = follower_id);


-- ============================================================================
-- GRANT для таблицы из секции 11 выше (см. пояснение про grant в начале файла)
-- ============================================================================
-- Только authenticated, без anon — как и у donations (секция 4): это не
-- публичные данные, а собственный список подписок живого человека.
grant select, insert, delete on public.user_follows to authenticated;


-- ============================================================================
-- 12. reports — жалобы пользователей на треки и комментарии (модерация)
-- ============================================================================
-- До этой секции в MYRA не было вообще никакого способа пожаловаться на
-- трек/комментарий или снять его с публикации — только сам автор мог удалить
-- свой же трек. Перед публичным запуском это реальный юридический риск
-- (нарушение авторских прав, оскорбительный контент), а не просто недостающая
-- фича — эта секция и следующая (13, tracks.hidden) закрывают этот пробел
-- базовой MVP-очередью модерации.
--
-- target_id — намеренно text, а не uuid, той же природы, что и
-- comments.track_id (см. секцию 3 выше): жалоба может быть и на настоящую
-- строку в базе (uuid tracks.id или comments.id), и на комментарий/трек
-- демо-каталога вида "catalog:N", у которого никакой строки в базе нет и не
-- будет. Жёсткий FK здесь так же невозможен, как и там.
create table if not exists public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('track', 'comment')),
  target_id   text not null,
  reason      text not null,
  details     text,
  status      text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);

-- Ускоряет очередь модерации — она почти всегда фильтрует по status = 'open'
create index if not exists reports_status_idx on public.reports (status);

alter table public.reports enable row level security;

-- Пожаловаться можно только от своего имени
drop policy if exists "reports_insert_own" on public.reports;
create policy "reports_insert_own"
  on public.reports for insert
  with check (auth.uid() = reporter_id);

-- Автор жалобы видит свои же жалобы (например, чтобы на фронтенде не дать
-- пожаловаться на одно и то же дважды — сама проверка на клиенте не входит в
-- этот MVP, но SELECT для неё уже не помешает добавить позже)
drop policy if exists "reports_select_own" on public.reports;
create policy "reports_select_own"
  on public.reports for select
  using (auth.uid() = reporter_id);

-- Админы (та же таблица admins, что и в support_messages, см. секции 8-9) —
-- видят и обновляют ЛЮБЫЕ жалобы. Это и есть очередь модерации: несколько
-- permissive-политик для одной операции объединяются через OR, отдельный
-- security definer не нужен (admins сама читаема хотя бы для своей строки)
drop policy if exists "reports_select_admin" on public.reports;
create policy "reports_select_admin"
  on public.reports for select
  using (exists (select 1 from public.admins where user_id = auth.uid()));

-- UPDATE нужен админам — пометить жалобу resolved/dismissed. Обычным
-- пользователям UPDATE не нужен: подавать жалобу можно, а редактировать/
-- отзывать её с клиента в этом MVP нельзя (как и комментарии, append-only)
drop policy if exists "reports_update_admin" on public.reports;
create policy "reports_update_admin"
  on public.reports for update
  using (exists (select 1 from public.admins where user_id = auth.uid()));


-- ============================================================================
-- 13. tracks.hidden — скрытие трека модератором без удаления (продолжение
--     секции 2, tracks, по мотивам секции 10 — там donations так же донабрали
--     колонку в уже существующую таблицу отдельной пронумерованной секцией)
-- ============================================================================
-- Раньше единственный рычаг снять трек с публикации был у самого автора —
-- tracks_delete_own (секция 2). У модерации не было вообще никакого способа
-- вмешаться. hidden — мягкое скрытие: строка остаётся на месте (жалобы,
-- история, донаты по ней продолжают на неё ссылаться), просто трек
-- перестаёт быть публично виден в ленте/поиске.
alter table public.tracks
  add column if not exists hidden boolean not null default false;

-- Публичная выборка теперь исключает скрытые треки — КРОМЕ треков самого
-- владельца (иначе автор скрытого трека потерял бы доступ даже к своей же
-- Студии/медиатеке, а это уже не модерация, а поломанный продукт)
drop policy if exists "tracks_select_public" on public.tracks;
create policy "tracks_select_public"
  on public.tracks for select
  using (not hidden or owner_id = auth.uid());

-- Админы видят вообще все треки, включая чужие скрытые — нужно для очереди
-- модерации (проверить решение до и после, у кого угодно)
drop policy if exists "tracks_select_admin" on public.tracks;
create policy "tracks_select_admin"
  on public.tracks for select
  using (exists (select 1 from public.admins where user_id = auth.uid()));

-- Скрыть/вернуть ЧУЖОЙ трек может только админ — tracks_update_own (секция 2)
-- уже разрешает владельцу редактировать свои же поля (в т.ч. свой hidden),
-- но модерация обязана уметь скрыть трек, которым не владеет
drop policy if exists "tracks_update_admin" on public.tracks;
create policy "tracks_update_admin"
  on public.tracks for update
  using (exists (select 1 from public.admins where user_id = auth.uid()));


-- ============================================================================
-- 14. payments — платежи через ЮKassa (донаты и подписки с реальным
--    процессингом, когда он настроен — см. supabase/functions/create-payment)
-- ============================================================================
-- id — НЕ uuid, который генерируем мы: это id платежа в формате самой ЮKassa
-- (строка вида "2d3febe6-000f-5000-9000-1a1c07dcd47c"), чтобы сверять запись
-- с их API один в один, без ещё одного своего идентификатора рядом.
--
-- Строки сюда пишет ТОЛЬКО доверенный бэкенд (service-role, в обход RLS):
-- create-payment создаёт запись 'pending' сразу после ответа ЮKassa, а
-- yookassa-webhook переводит её в 'succeeded'/'canceled' ПОСЛЕ того, как сам
-- независимо перепроверил статус GET-ом к самой ЮKassa — телу вебхука
-- доверять нельзя (см. подробный комментарий в yookassa-webhook/index.ts).
-- Клиенту разрешён только select своих же платежей — как история операций,
-- ничего больше.
create table if not exists public.payments (
  id          text primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  kind        text not null check (kind in ('donation', 'subscription')),
  status      text not null default 'pending' check (status in ('pending', 'succeeded', 'canceled')),
  amount      numeric not null check (amount > 0),
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists payments_user_id_idx on public.payments (user_id);

alter table public.payments enable row level security;

-- Пользователь видит СВОИ платежи (история), но ничего не пишет напрямую —
-- строки создаёт/обновляет только доверенный бэкенд (create-payment создаёт
-- 'pending', yookassa-webhook подтверждает 'succeeded' после независимой
-- проверки статуса у самого ЮKassa)
drop policy if exists "payments_select_own" on public.payments;
create policy "payments_select_own"
  on public.payments for select
  using (auth.uid() = user_id);


-- ============================================================================
-- GRANT для секции 12 выше (см. пояснение про grant в начале файла)
-- ============================================================================
-- Табличных грантов для tracks.hidden (секция 13) не требуется — insert/
-- update/select на public.tracks для authenticated/anon уже выданы в секции 2,
-- RLS-политики выше сами ограничивают, какие строки реально видны/редактируемы.
grant select, insert, update on public.reports to authenticated;


-- ============================================================================
-- GRANT для секции 14 выше (см. пояснение про grant в начале файла)
-- ============================================================================
-- Только select — insert/update делает исключительно service-role ключ из
-- edge-функций (create-payment, yookassa-webhook), который и так работает в
-- обход и GRANT, и RLS, поэтому authenticated/anon insert/update вообще не получают
grant select on public.payments to authenticated;
