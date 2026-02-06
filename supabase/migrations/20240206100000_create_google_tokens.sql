-- Create table if it doesn't exist (Simple version without triggers)
create table if not exists public.google_tokens (
    user_id uuid references auth.users not null primary key,
    refresh_token text not null,
    access_token text,
    expires_at bigint,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.google_tokens enable row level security;

-- Policies
drop policy if exists "Users can view their own google tokens" on public.google_tokens;
create policy "Users can view their own google tokens" 
on public.google_tokens for select 
using (auth.uid() = user_id);

drop policy if exists "Users can insert/update their own google tokens" on public.google_tokens;
create policy "Users can insert/update their own google tokens" 
on public.google_tokens for All
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
