-- OFICINA 0.6: execute UMA VEZ no SQL Editor de seu próprio projeto Supabase.
-- Dados sincronizados individualmente por usuário (não há acesso compartilhado por equipe).
create table if not exists public.oficina_backups (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  revision bigint not null default 1 check (revision >= 1),
  updated_at timestamptz not null default now()
);

alter table public.oficina_backups enable row level security;
revoke all on public.oficina_backups from public, anon, authenticated;
grant select, insert, update on public.oficina_backups to authenticated;

drop policy if exists oficina_select_own on public.oficina_backups;
create policy oficina_select_own on public.oficina_backups
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists oficina_insert_own on public.oficina_backups;
create policy oficina_insert_own on public.oficina_backups
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists oficina_update_own on public.oficina_backups;
create policy oficina_update_own on public.oficina_backups
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Usuários não têm permissão para excluir a linha pela API; exclusões administrativas
-- devem ser realizadas diretamente no painel do Supabase com seus controles de segurança.