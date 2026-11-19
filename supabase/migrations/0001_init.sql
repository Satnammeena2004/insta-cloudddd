-- InstaCloud schema (guide §4.2). Applied by `npm run db:migrate`
-- (or paste into Supabase Dashboard -> SQL Editor).
-- Passwords live in Supabase Auth (auth.users, bcrypt) and are never stored here.

create table public.users (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  username        text not null unique,
  email           text not null unique,
  bio             text not null default '',
  profile_pic_url text,
  created_at      timestamptz not null default now()
);

create table public.posts (
  post_id         uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users(user_id) on delete cascade,
  image_url       text not null,
  image_public_id text not null,
  caption         text not null default '',
  hashtags        text[] not null default '{}',
  likes_count     integer not null default 0 constraint likes_count_nonneg check (likes_count >= 0),
  created_at      timestamptz not null default now()
);

create table public.follows (
  follower_id  uuid not null references public.users(user_id) on delete cascade,
  following_id uuid not null references public.users(user_id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint prevent_self_follow check (follower_id <> following_id)
);

create table public.likes (
  user_id    uuid not null references public.users(user_id) on delete cascade,
  post_id    uuid not null references public.posts(post_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table public.comments (
  comment_id   uuid primary key default gen_random_uuid(),
  post_id      uuid not null references public.posts(post_id) on delete cascade,
  user_id      uuid not null references public.users(user_id) on delete cascade,
  comment_text varchar(500) not null,
  created_at   timestamptz not null default now()
);

-- Indexes: B-Tree for lookups, GIN for hashtag array search
create index idx_posts_user_created    on public.posts (user_id, created_at desc);
create index idx_posts_created         on public.posts (created_at desc);
create index idx_follows_following_id  on public.follows (following_id);
create index idx_comments_post_created on public.comments (post_id, created_at);
create index idx_posts_hashtags_gin    on public.posts using gin (hashtags);

-- Keep posts.likes_count in sync
create function public.sync_likes_count() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set likes_count = likes_count + 1 where post_id = new.post_id;
  else
    update public.posts set likes_count = greatest(likes_count - 1, 0) where post_id = old.post_id;
  end if;
  return null;
end $$;

create trigger trg_likes_count after insert or delete on public.likes
  for each row execute function public.sync_likes_count();

-- Create the public profile row when someone signs up in Supabase Auth
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  base text := coalesce(nullif(new.raw_user_meta_data->>'username', ''), split_part(new.email, '@', 1));
begin
  begin
    insert into public.users (user_id, username, email) values (new.id, base, new.email);
  exception when unique_violation then
    insert into public.users (user_id, username, email)
    values (new.id, base || '_' || substr(new.id::text, 1, 4), new.email);
  end;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Lock the tables from Supabase's auto-generated REST API (anon/authenticated roles).
-- Only the Node API (direct Postgres connection) reads and writes data.
alter table public.users    enable row level security;
alter table public.posts    enable row level security;
alter table public.follows  enable row level security;
alter table public.likes    enable row level security;
alter table public.comments enable row level security;
