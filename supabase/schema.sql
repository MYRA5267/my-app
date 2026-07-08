-- ============================================================================
-- MYRA — схема базы данных (Supabase / Postgres)
-- ============================================================================
-- Файл идемпотентно не является (таблицы создаются один раз), но рассчитан на
-- то, что его целиком, сверху вниз, вставляют в Supabase SQL Editor на чистом
-- проекте.
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
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  username   text not null,
  avatar_url text,
  role       text not null default 'listener' check (role in ('artist', 'listener')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Смотреть профиль может кто угодно (нужно для будущего лидерборда и
-- страниц артистов — публичные данные). Почта сюда намеренно не входит —
-- она PII и живёт отдельно, в profile_private (см. ниже)
create policy "profiles_select_public"
  on public.profiles for select
  using (true);

-- Создать свой профиль может только сам пользователь (обычно это делает
-- триггер handle_new_user, но политика оставлена и для прямых вставок с клиента)
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Редактировать можно только свой собственный профиль
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
create table public.profile_private (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  email      text,
  updated_at timestamptz not null default now()
);

alter table public.profile_private enable row level security;

-- Видеть и писать свою почту может только сам пользователь — публичного
-- SELECT здесь нет и не должно быть
create policy "profile_private_select_own"
  on public.profile_private for select
  using (auth.uid() = user_id);

create policy "profile_private_insert_own"
  on public.profile_private for insert
  with check (auth.uid() = user_id);

create policy "profile_private_update_own"
  on public.profile_private for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ============================================================================
-- 2. tracks — треки, реально опубликованные пользователем через форму релиза
-- ============================================================================
-- ВНИМАНИЕ: сюда не попадают демо-треки из статичного каталога (data.ts) —
-- только то, что артист сам загрузил через Студию/форму релиза.
create table public.tracks (
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
create index tracks_owner_id_idx on public.tracks (owner_id);

alter table public.tracks enable row level security;

-- Треки публичны — их может смотреть/слушать кто угодно
create policy "tracks_select_public"
  on public.tracks for select
  using (true);

-- Публиковать трек можно только от своего имени (owner_id = сам пользователь)
create policy "tracks_insert_own"
  on public.tracks for insert
  with check (auth.uid() = owner_id);

-- Редактировать можно только свои треки
create policy "tracks_update_own"
  on public.tracks for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- Удалять можно только свои треки
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
create table public.comments (
  id         uuid primary key default gen_random_uuid(),
  track_id   text not null,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  pct        numeric not null default 0, -- позиция на волне, 0-100 (см. Comment.pct на фронтенде)
  text       text not null,
  created_at timestamptz not null default now()
);

-- Обычный btree-индекс для быстрой выборки «все комментарии этого трека»
create index comments_track_id_idx on public.comments (track_id);

alter table public.comments enable row level security;

-- Комментарии публичны — их видит кто угодно
create policy "comments_select_public"
  on public.comments for select
  using (true);

-- Писать комментарий можно только от своего имени
-- (UPDATE/DELETE-политик намеренно нет — комментарии неизменяемы/append-only,
-- как и на текущем фронтенде: добавить можно, отредактировать/удалить нельзя)
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
create table public.donations (
  id         uuid primary key default gen_random_uuid(),
  from_user  uuid not null references public.profiles(id) on delete cascade,
  to_artist  text not null,
  amount     numeric not null check (amount > 0),
  created_at timestamptz not null default now()
);

alter table public.donations enable row level security;

-- Видеть свои донаты может только сам отправитель
create policy "donations_select_own"
  on public.donations for select
  using (auth.uid() = from_user);

-- Создавать донат можно только от своего имени
create policy "donations_insert_own"
  on public.donations for insert
  with check (auth.uid() = from_user);


-- ============================================================================
-- 5. subscriptions — статус подписки MYRA Pro (в коде иногда встречается
--    старое название "Creator+" — это одно и то же)
-- ============================================================================
create table public.subscriptions (
  user_id             uuid primary key references public.profiles(id) on delete cascade,
  status              text not null default 'none' check (status in ('none', 'active', 'grace')),
  current_period_end  timestamptz,
  created_at          timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

-- Видеть свой статус подписки может только сам пользователь
create policy "subscriptions_select_own"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- Клиент НЕ может сам выдать себе активную подписку — иначе любой
-- авторизованный пользователь мог бы бесплатно включить себе MYRA Pro
-- прямым UPDATE (реальная оплата ещё не подключена, а даже когда будет —
-- статус 'active' должен ставить только доверенный бэкенд/вебхук оплаты
-- сервисным ключом, который не связан RLS). Клиенту разрешена только
-- самостоятельная отмена — переход НЕ в 'active' (например, в 'grace' или 'none')
create policy "subscriptions_update_own"
  on public.subscriptions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and status <> 'active');


-- ============================================================================
-- 6. follows — подписки пользователя на артистов (по имени артиста)
-- ============================================================================
create table public.follows (
  id          uuid primary key default gen_random_uuid(),
  follower_id uuid not null references public.profiles(id) on delete cascade,
  artist_name text not null,
  created_at  timestamptz not null default now(),
  unique (follower_id, artist_name)
);

alter table public.follows enable row level security;

-- Список фоллоу публичен (нужно для счётчиков подписчиков артиста и т.п.)
create policy "follows_select_public"
  on public.follows for select
  using (true);

-- Подписаться можно только от своего имени
create policy "follows_insert_own"
  on public.follows for insert
  with check (auth.uid() = follower_id);

-- Отписаться можно только от своего имени
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
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
