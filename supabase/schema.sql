-- Skinstinct content engine: memory layer (notes, drafts, voice skill).
-- Rejected notes and drafts are kept, never deleted — they show what needs improving.

create extension if not exists pgcrypto;

create table if not exists notes (
  id                  uuid primary key default gen_random_uuid(),
  chat_id             bigint not null,
  telegram_message_id bigint not null,
  source              text not null default 'text',          -- text | voice
  content             text not null,
  score               int,
  score_reason        text,
  status              text not null default 'received'       -- received | rejected | drafted | error
                      check (status in ('received','rejected','drafted','error')),
  error               text,
  created_at          timestamptz not null default now(),
  unique (chat_id, telegram_message_id)                       -- Telegram retries must not double-process
);

create table if not exists drafts (
  id                   uuid primary key default gen_random_uuid(),
  note_id              uuid not null references notes(id),
  chat_id              bigint not null,
  content              text not null,
  model                text not null,
  used_news            boolean not null default false,
  news_headline        text,
  news_source          text,
  news_date            text,
  news_url             text,
  status               text not null default 'pending'
                       check (status in ('pending','approved','rejected')),
  telegram_message_ids bigint[] not null default '{}',
  created_at           timestamptz not null default now(),
  decided_at           timestamptz
);

create table if not exists voice_skill (
  id         uuid primary key default gen_random_uuid(),
  content    text not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists drafts_chat_status_idx on drafts (chat_id, status, created_at desc);
create index if not exists drafts_msg_ids_idx on drafts using gin (telegram_message_ids);

-- Only the server (service_role key) touches these tables; no public access.
alter table notes       enable row level security;
alter table drafts      enable row level security;
alter table voice_skill enable row level security;
