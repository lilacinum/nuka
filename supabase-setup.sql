-- Nuka / Bloxspace Supabase schema
-- Run this whole file in the Supabase SQL editor.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (username ~ '^[A-Za-z0-9_]{1,20}$'),
  display_name text not null check (char_length(display_name) between 1 and 24),
  bio text not null default '' check (char_length(bio) <= 160),
  avatar_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

create table if not exists public.experiences (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  creator_id uuid references public.profiles(id) on delete set null,
  description text not null default '',
  category text not null default 'Other',
  thumbnail_url text,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  experience_id uuid not null references public.experiences(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, experience_id)
);

create table if not exists public.recent_plays (
  user_id uuid not null references public.profiles(id) on delete cascade,
  experience_id uuid not null references public.experiences(id) on delete cascade,
  played_at timestamptz not null default now(),
  primary key (user_id, experience_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now(),
  check (sender_id <> recipient_id)
);

create index if not exists messages_sender_recipient_created_idx
on public.messages (sender_id, recipient_id, created_at);

create index if not exists friendships_requester_idx on public.friendships (requester_id);
create index if not exists friendships_addressee_idx on public.friendships (addressee_id);
create index if not exists notifications_user_created_idx on public.notifications (user_id, created_at desc);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  base_username text;
  candidate text;
  attempt integer := 0;
begin
  base_username := regexp_replace(
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1), 'player'),
    '[^A-Za-z0-9_]',
    '',
    'g'
  );

  if char_length(base_username) = 0 then
    base_username := 'player';
  end if;

  base_username := left(base_username, 16);
  candidate := base_username;

  while exists(select 1 from public.profiles where username = candidate) loop
    attempt := attempt + 1;
    candidate := left(base_username, 15) || attempt::text;
  end loop;

  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    candidate,
    left(coalesce(new.raw_user_meta_data->>'display_name', candidate), 24)
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.experiences enable row level security;
alter table public.favorites enable row level security;
alter table public.recent_plays enable row level security;
alter table public.notifications enable row level security;
alter table public.messages enable row level security;

drop policy if exists "profiles are viewable by everyone" on public.profiles;
create policy "profiles are viewable by everyone"
on public.profiles for select using (true);

drop policy if exists "users can insert own profile" on public.profiles;
create policy "users can insert own profile"
on public.profiles for insert with check (auth.uid() = id);

drop policy if exists "users can update own profile" on public.profiles;
create policy "users can update own profile"
on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "friendships visible to participants" on public.friendships;
create policy "friendships visible to participants"
on public.friendships for select
using (auth.uid() = requester_id or auth.uid() = addressee_id);

drop policy if exists "users can send friend requests" on public.friendships;
create policy "users can send friend requests"
on public.friendships for insert
with check (auth.uid() = requester_id);

drop policy if exists "participants can update friendships" on public.friendships;
create policy "participants can update friendships"
on public.friendships for update
using (auth.uid() = requester_id or auth.uid() = addressee_id)
with check (auth.uid() = requester_id or auth.uid() = addressee_id);

drop policy if exists "participants can delete friendships" on public.friendships;
create policy "participants can delete friendships"
on public.friendships for delete
using (auth.uid() = requester_id or auth.uid() = addressee_id);

drop policy if exists "published experiences are public" on public.experiences;
create policy "published experiences are public"
on public.experiences for select
using (published = true or creator_id = auth.uid());

drop policy if exists "creators manage own experiences" on public.experiences;
create policy "creators manage own experiences"
on public.experiences for all
using (creator_id = auth.uid())
with check (creator_id = auth.uid());

drop policy if exists "users manage own favorites" on public.favorites;
create policy "users manage own favorites"
on public.favorites for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "users manage own recent plays" on public.recent_plays;
create policy "users manage own recent plays"
on public.recent_plays for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "users read own notifications" on public.notifications;
create policy "users read own notifications"
on public.notifications for select
using (auth.uid() = user_id);

drop policy if exists "users update own notifications" on public.notifications;
create policy "users update own notifications"
on public.notifications for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "participants read messages" on public.messages;
create policy "participants read messages"
on public.messages for select
using (auth.uid() = sender_id or auth.uid() = recipient_id);

drop policy if exists "users send messages" on public.messages;
create policy "users send messages"
on public.messages for insert
with check (auth.uid() = sender_id);

drop policy if exists "senders delete own messages" on public.messages;
create policy "senders delete own messages"
on public.messages for delete
using (auth.uid() = sender_id);

do $$
begin
  alter publication supabase_realtime add table public.messages;
exception
  when duplicate_object then null;
end $$;