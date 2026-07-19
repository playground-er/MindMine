-- MindMine — initial schema
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New query).
--
-- Design notes:
--   * No roles or permissions. Every member is equal. A single RLS policy
--     ("are you a member?") guards every table. See docs/PRD.md section 2.
--   * Cards are soft-deleted (deleted_at). That is what makes "no permissions"
--     safe — mistakes are recoverable.
--   * card.content is jsonb (plain values, used for search and list view).
--     card.ydoc is the Yjs binary state for collaborative text.
--     The duplication is deliberate; searching inside CRDT binary is expensive.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type card_type as enum ('note', 'todo', 'image', 'link', 'board');

-- ---------------------------------------------------------------------------
-- member
-- ---------------------------------------------------------------------------
-- id matches auth.users.id. A person exists in auth after their first magic
-- link login, but is not a member until inserted here. That insert is the
-- only "invite" mechanism — done manually via SQL Editor. See README.

create table member (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null unique,
  name       text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- board
-- ---------------------------------------------------------------------------
-- parent_card_id points back to the board-type card that opens this board.
-- Null for the root board. Storing the back-reference lets us build
-- breadcrumbs without a recursive upward query.

create table board (
  id             uuid primary key default gen_random_uuid(),
  parent_card_id uuid,
  title          text not null default 'Untitled',
  created_by     uuid not null references member (id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- card
-- ---------------------------------------------------------------------------

create table card (
  id         uuid primary key default gen_random_uuid(),
  board_id   uuid not null references board (id) on delete cascade,
  type       card_type not null,

  x          integer not null default 0,
  y          integer not null default 0,
  w          integer not null default 280,
  h          integer,                        -- null = auto height
  z          integer not null default 0,

  content    jsonb not null default '{}'::jsonb,
  ydoc       bytea,                          -- Yjs state, null for non-text types
  accent     text,                           -- null = derive from type

  created_by uuid not null references member (id),
  updated_by uuid not null references member (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz                     -- soft delete, purged after 30d
);

-- Deferred FK: board.parent_card_id -> card.id
-- Declared after card exists because the two tables reference each other.
--
-- ON DELETE SET NULL, not CASCADE. board.parent_card_id -> card.id and
-- card.board_id -> board.id form a cycle; if both cascaded, deleting one
-- board could walk the whole nesting tree in either direction. Orphaning
-- the child board instead is recoverable — it just floats to the root and
-- can be re-linked. Losing a subtree is not.
alter table board
  add constraint board_parent_card_fkey
  foreign key (parent_card_id) references card (id) on delete set null;

-- ---------------------------------------------------------------------------
-- comment
-- ---------------------------------------------------------------------------

create table comment (
  id          uuid primary key default gen_random_uuid(),
  card_id     uuid not null references card (id) on delete cascade,
  author_id   uuid not null references member (id),
  body        text not null,
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

-- The hot path: fetch all live cards for one board.
create index card_board_live_idx
  on card (board_id)
  where deleted_at is null;

-- Restore-deleted lookup and the 30-day purge job.
create index card_deleted_idx
  on card (deleted_at)
  where deleted_at is not null;

-- Full-text search across card content (⌘K). GIN over the jsonb.
create index card_content_gin_idx
  on card using gin (content jsonb_path_ops);

-- Breadcrumb / nesting traversal.
create index board_parent_idx on board (parent_card_id);

-- Comment panel: unresolved comments for a card.
create index comment_card_idx
  on comment (card_id)
  where resolved_at is null;

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------

create or replace function touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger card_touch_updated_at
  before update on card
  for each row execute function touch_updated_at();

create trigger board_touch_updated_at
  before update on board
  for each row execute function touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- One rule, applied identically to every table: you must be a member.
-- There is deliberately no per-role differentiation. See docs/PRD.md section 2.

create or replace function is_member()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from member where id = auth.uid());
$$;

alter table member  enable row level security;
alter table board   enable row level security;
alter table card    enable row level security;
alter table comment enable row level security;

create policy member_all on member
  for all using (is_member()) with check (is_member());

create policy board_all on board
  for all using (is_member()) with check (is_member());

create policy card_all on card
  for all using (is_member()) with check (is_member());

create policy comment_all on comment
  for all using (is_member()) with check (is_member());

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
-- Cards and comments broadcast changes. Presence does NOT live here — it goes
-- over a broadcast channel and never touches the database.

alter publication supabase_realtime add table card;
alter publication supabase_realtime add table comment;
alter publication supabase_realtime add table board;

-- Realtime needs the full old row to compute deltas on update.
alter table card    replica identity full;
alter table comment replica identity full;
alter table board   replica identity full;

-- ---------------------------------------------------------------------------
-- Storage bucket for image cards
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('card-images', 'card-images', false)
on conflict (id) do nothing;

create policy "members read card images"
  on storage.objects for select
  using (bucket_id = 'card-images' and is_member());

create policy "members upload card images"
  on storage.objects for insert
  with check (bucket_id = 'card-images' and is_member());

create policy "members delete card images"
  on storage.objects for delete
  using (bucket_id = 'card-images' and is_member());

-- ---------------------------------------------------------------------------
-- Root board
-- ---------------------------------------------------------------------------
-- Created lazily by the app on first load if no board with a null parent
-- exists. Not seeded here, because it needs a created_by that does not yet
-- exist at migration time.
