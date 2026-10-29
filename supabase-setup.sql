-- Nuka / Bloxspace Supabase schema
-- Run in the Supabase SQL editor after creating a project.

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

alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.experiences enable row level security;
alter table public.favorites enable row level security;
alter table public.recent_plays enable row level security;
alter table public.notifications enable row level security;

create policy "profiles are viewable by everyone"
on public.profiles for select using (true);

create policy "users can update own profile"
on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "friendships visible to participants"
on public.friendships for select
using (auth.uid() = requester_id or auth.uid() = addressee_id);

create policy "users can send friend requests"
on public.friendships for insert
with check (auth.uid() = requester_id);

create policy "participants can update friendships"
on public.friendships for update
using (auth.uid() = requester_id or auth.uid() = addressee_id);

create policy "published experiences are public"
on public.experiences for select
using (published = true or creator_id = auth.uid());

create policy "creators manage own experiences"
on public.experiences for all
using (creator_id = auth.uid())
with check (creator_id = auth.uid());

create policy "users manage own favorites"
on public.favorites for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "users manage own recent plays"
on public.recent_plays for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "users read own notifications"
on public.notifications for select
using (auth.uid() = user_id);

create policy "users update own notifications"
on public.notifications for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);