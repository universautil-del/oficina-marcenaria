-- UNIVERSALARTES 1.0 — Banco ISOLADO para testar login e sincronização da prévia.
-- Execute somente no SQL Editor do seu projeto Supabase.
-- Não use dados reais até validar autenticação, RLS, backup e recuperação.
-- Criar esta tabela não altera a tabela antiga oficina_backups.
begin;
create table if not exists public.universalartes_preview_backups (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  revision bigint not null default 1 check (revision >= 1),
  updated_at timestamptz not null default now()
);
alter table public.universalartes_preview_backups enable row level security;
revoke all on public.universalartes_preview_backups from public, anon, authenticated;
grant select,insert,update on public.universalartes_preview_backups to authenticated;

drop policy if exists ua_preview_read_own on public.universalartes_preview_backups;
create policy ua_preview_read_own on public.universalartes_preview_backups
for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists ua_preview_insert_own on public.universalartes_preview_backups;
create policy ua_preview_insert_own on public.universalartes_preview_backups
for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists ua_preview_update_own on public.universalartes_preview_backups;
create policy ua_preview_update_own on public.universalartes_preview_backups
for update to authenticated using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

-- Mesmo com acesso RLS por usuário, o uso em múltiplos aparelhos deve ser
-- sequencial: documento JSON por usuário e detecção de conflitos, sem merge.
-- Não há exclusão por API nem compartilhamento de equipe nesta prévia.
commit;
