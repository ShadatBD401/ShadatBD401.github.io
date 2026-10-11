-- Run in Supabase SQL Editor. Create the admin user in Authentication first.
create extension if not exists pgcrypto;
create table if not exists public.admin_users(user_id uuid primary key references auth.users(id) on delete cascade, created_at timestamptz default now());
create table if not exists public.support_tickets(id uuid primary key default gen_random_uuid(), ticket_no bigint generated always as identity unique, name text not null check(char_length(name) between 1 and 100), email text not null check(char_length(email) between 3 and 254), description text not null check(char_length(description) between 10 and 5000), status text not null default 'open' check(status in ('open','in_progress','resolved','closed')), created_at timestamptz not null default now());
create table if not exists public.learning_notes(id uuid primary key default gen_random_uuid(), title text not null, category text not null check(category in ('network','systems','security','general')), visibility text not null check(visibility in ('private','public')), body text not null, created_at timestamptz not null default now());
create table if not exists public.learning_paths(id uuid primary key default gen_random_uuid(), title text not null, category text not null check(category in ('network','systems','security')), progress integer not null default 0 check(progress between 0 and 100), description text not null, published boolean not null default true, created_at timestamptz not null default now());
alter table public.admin_users enable row level security; alter table public.support_tickets enable row level security; alter table public.learning_notes enable row level security; alter table public.learning_paths enable row level security;
grant insert on public.support_tickets to anon, authenticated; grant select,update,delete on public.support_tickets to authenticated;
create policy "Public can submit tickets" on public.support_tickets for insert to anon,authenticated with check(true);
create policy "Allow-listed admins read tickets" on public.support_tickets for select to authenticated using(exists(select 1 from public.admin_users a where a.user_id=auth.uid()));
create policy "Allow-listed admins update tickets" on public.support_tickets for update to authenticated using(exists(select 1 from public.admin_users a where a.user_id=auth.uid())) with check(exists(select 1 from public.admin_users a where a.user_id=auth.uid()));
create policy "Allow-listed admins delete tickets" on public.support_tickets for delete to authenticated using(exists(select 1 from public.admin_users a where a.user_id=auth.uid()));
grant select on public.admin_users to authenticated;
create policy "Admin reads own allowlist entry" on public.admin_users for select to authenticated using(user_id=auth.uid());
grant select,insert,update,delete on public.learning_notes to authenticated;
create policy "Admins manage notes" on public.learning_notes for all to authenticated using(exists(select 1 from public.admin_users a where a.user_id=auth.uid())) with check(exists(select 1 from public.admin_users a where a.user_id=auth.uid()));
grant select on public.learning_notes to anon;
create policy "Public reads published notes" on public.learning_notes for select to anon using(visibility='public');
grant select,insert,update,delete on public.learning_paths to authenticated;
create policy "Admins manage learning paths" on public.learning_paths for all to authenticated using(exists(select 1 from public.admin_users a where a.user_id=auth.uid())) with check(exists(select 1 from public.admin_users a where a.user_id=auth.uid()));
grant select on public.learning_paths to anon;
create policy "Public reads published paths" on public.learning_paths for select to anon using(published=true);
-- After creating the admin in Supabase Auth, run:
-- insert into public.admin_users(user_id) values('PASTE-AUTH-USER-UUID-HERE');
