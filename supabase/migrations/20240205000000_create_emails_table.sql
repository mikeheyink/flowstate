-- Create emails table for caching Gmail messages
create table if not exists public.emails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  gmail_id text unique not null,
  thread_id text not null,
  history_id text,
  internal_date bigint,
  subject text,
  snippet text,
  sender_name text,
  sender_email text,
  payload jsonb,
  status text check (status in ('inbox', 'to_read', 'to_reply', 'done', 'trash')) default 'inbox',
  is_read boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create index for faster lookups
create index if not exists emails_user_id_idx on public.emails(user_id);
create index if not exists emails_thread_id_idx on public.emails(thread_id);
create index if not exists emails_status_idx on public.emails(status);

-- Enable Row Level Security
alter table public.emails enable row level security;

-- RLS Policy: Users can only see their own emails
create policy "Users can view own emails"
  on public.emails for select
  using (auth.uid() = user_id);

-- RLS Policy: Users can insert their own emails
create policy "Users can insert own emails"
  on public.emails for insert
  with check (auth.uid() = user_id);

-- RLS Policy: Users can update their own emails
create policy "Users can update own emails"
  on public.emails for update
  using (auth.uid() = user_id);

-- RLS Policy: Users can delete their own emails
create policy "Users can delete own emails"
  on public.emails for delete
  using (auth.uid() = user_id);
