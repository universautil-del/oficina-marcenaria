-- UNIVERSA ART / OFICINA — GRAVAÇÃO AUTENTICADA TRANSACIONAL
-- Aplica-se SOMENTE ao projeto Supabase escolhido pelo proprietário.
-- Executar manualmente no SQL Editor após backup. Não altera projetos externos.
-- Fornece CAS atômico sobre o documento JSON. NÃO equivale a transações
-- independentes de estoque/financeiro entre múltiplos colaboradores.
begin;
create table if not exists public.universalartes_preview_backups (
 user_id uuid primary key references auth.users(id) on delete cascade,
 data jsonb not null, revision bigint not null default 1 check(revision >= 1),
 updated_at timestamptz not null default now()
);
alter table public.universalartes_preview_backups enable row level security;
revoke all on public.universalartes_preview_backups from public, anon, authenticated;
grant select,insert,update on public.universalartes_preview_backups to authenticated;
drop policy if exists ua_preview_read_own on public.universalartes_preview_backups;
create policy ua_preview_read_own on public.universalartes_preview_backups
 for select to authenticated using ((select auth.uid())=user_id);
drop policy if exists ua_preview_insert_own on public.universalartes_preview_backups;
create policy ua_preview_insert_own on public.universalartes_preview_backups
 for insert to authenticated with check ((select auth.uid())=user_id);
drop policy if exists ua_preview_update_own on public.universalartes_preview_backups;
create policy ua_preview_update_own on public.universalartes_preview_backups
 for update to authenticated using ((select auth.uid())=user_id)
 with check ((select auth.uid())=user_id);
-- impedir DELETE por anon/authenticated
revoke delete on public.universalartes_preview_backups from public,anon,authenticated;

create or replace function public.ua_validar_documento(p_documento jsonb)
returns void language plpgsql security invoker set search_path=''
as $$
declare k text; item jsonb; codigo text;
begin
 if p_documento is null or jsonb_typeof(p_documento)<>'object'
   or p_documento->>'version'<>'3' then
   raise exception 'Backup incompatível: esperado objeto versão 3' using errcode='22023';
 end if;
 if octet_length(p_documento::text)>2000000 then
   raise exception 'Limite de 2 MB para documento excedido' using errcode='22023';
 end if;
 foreach k in array array['clients','products','quotes','orders','transactions','stockMovements'] loop
   if jsonb_typeof(p_documento->k)<>'array' then
     raise exception 'Coleção % inválida',k using errcode='22023';
   end if;
 end loop;
 foreach k in array array['suppliers','purchases','projects','invoices','orderAttachments'] loop
   if p_documento?k and jsonb_typeof(p_documento->k)<>'array' then
     raise exception 'Coleção % inválida',k using errcode='22023';
   end if;
 end loop;
 -- Números duplicados e identificadores duplicados nas coleções principais.
 foreach k in array array['clients','products','quotes','orders','transactions','stockMovements'] loop
   if exists (
     select 1 from jsonb_array_elements(p_documento->k) as e(value)
     group by e.value->>'id' having count(*)>1
   ) then raise exception 'Identificadores duplicados: %',k using errcode='22023'; end if;
 end loop;
 foreach k in array array['quotes','orders'] loop
   if exists(
    select 1 from jsonb_array_elements(p_documento->k) as e(value)
    where e.value ? 'number'
    group by e.value->>'number' having count(*)>1
   ) then raise exception 'Números duplicados: %',k using errcode='22023';end if;
 end loop;
 if exists (
  select 1 from jsonb_array_elements(p_documento->'products') as e(value)
  where e.value->>'tipo'='materia' and
   (case when e.value->>'estoque' ~ '^[0-9]+([.][0-9]+)?
 ) then raise exception 'Material com estoque inválido' using errcode='22023';end if;
 if exists (
  select 1 from jsonb_array_elements(p_documento->'products') as e(value)
  where e.value->>'codigo' ~ '^[0-9]{1,3}$' and (e.value->>'codigo')::integer between 1 and 999
  group by (e.value->>'codigo')::integer having count(*)>1
 ) then raise exception 'Código de material duplicado' using errcode='22023';end if;
 for item in select e.value from jsonb_array_elements(p_documento->'transactions') as e(value) loop
   if not (coalesce(item->>'valor','') ~ '^[0-9]+([.][0-9]+)?$') then
     raise exception 'Valor de conta inválido' using errcode='22023';
   end if;
   if exists (
     select 1 from jsonb_array_elements(coalesce(item->'payments','[]'::jsonb)) as pag(value)
     where coalesce(pag.value->>'valor','') !~ '^[0-9]+([.][0-9]+)?
   ) then raise exception 'Valor de pagamento inválido' using errcode='22023';end if;
   ) then raise exception 'Valor de pagamento inválido' using errcode='22023';end if;
   if (select coalesce(sum((pag.value->>'valor')::numeric),0)
       from jsonb_array_elements(coalesce(item->'payments','[]'::jsonb)) as pag(value))
      > (item->>'valor')::numeric+0.02 then
     raise exception 'Pagamento superior ao saldo da conta' using errcode='22023';
   end if;
 end loop;
end $$;
revoke all on function public.ua_validar_documento(jsonb) from public,anon;
grant execute on function public.ua_validar_documento(jsonb) to authenticated;

-- A transação do PostgreSQL compara a versão esperada e grava integralmente,
-- sem sobrescrever alterações feitas por outro aparelho.
create or replace function public.ua_atualizar_documento(
 p_documento jsonb,p_revisao_esperada bigint
) returns bigint language plpgsql security invoker set search_path=''
as $$
declare v_revisao bigint;
begin
 if (select auth.uid()) is null then
  raise exception 'Sessão inválida' using errcode='28000';
 end if;
 perform public.ua_validar_documento(p_documento);
 update public.universalartes_preview_backups
 set data=p_documento,revision=revision+1,updated_at=now()
 where user_id=(select auth.uid()) and revision=p_revisao_esperada
 returning revision into v_revisao;
 if v_revisao is null then
  raise exception 'Conflito de revisão: outro aparelho alterou os dados' using errcode='P0001';
 end if;
 return v_revisao;
end $$;
revoke all on function public.ua_atualizar_documento(jsonb,bigint) from public,anon;
grant execute on function public.ua_atualizar_documento(jsonb,bigint) to authenticated;

-- Para o primeiro uso da conta; INSERT único pela chave de usuário.
create or replace function public.ua_iniciar_documento(p_documento jsonb)
returns bigint language plpgsql security invoker set search_path=''
as $$
begin
 if (select auth.uid()) is null then
  raise exception 'Sessão inválida' using errcode='28000';
 end if;
 perform public.ua_validar_documento(p_documento);
 insert into public.universalartes_preview_backups(user_id,data,revision)
 values ((select auth.uid()),p_documento,1);
 return 1;
exception when unique_violation then
 raise exception 'Conta já possui dados; não será sobrescrita' using errcode='P0001';
end $$;
revoke all on function public.ua_iniciar_documento(jsonb) from public,anon;
grant execute on function public.ua_iniciar_documento(jsonb) to authenticated;
commit;

     then (e.value->>'estoque')::numeric < 0 else true end)
 ) then raise exception 'Material com estoque inválido' using errcode='22023';end if;
 if exists (
  select 1 from jsonb_array_elements(p_documento->'products') as e(value)
  where e.value->>'codigo' ~ '^[0-9]{1,3}$' and (e.value->>'codigo')::integer between 1 and 999
  group by (e.value->>'codigo')::integer having count(*)>1
 ) then raise exception 'Código de material duplicado' using errcode='22023';end if;
 for item in select e.value from jsonb_array_elements(p_documento->'transactions') as e(value) loop
   if not (coalesce(item->>'valor','') ~ '^[0-9]+([.][0-9]+)?$') then
     raise exception 'Valor de conta inválido' using errcode='22023';
   end if;
   if exists (
     select 1 from jsonb_array_elements(coalesce(item->'payments','[]'::jsonb)) as pag(value)
     where coalesce(pag.value->>'valor','') !~ '^[0-9]+([.][0-9]+)?$'
   ) then raise exception 'Valor de pagamento inválido' using errcode='22023';end if;
   if (select coalesce(sum((pag.value->>'valor')::numeric),0)
       from jsonb_array_elements(coalesce(item->'payments','[]'::jsonb)) as pag(value))
      > (item->>'valor')::numeric+0.02 then
     raise exception 'Pagamento superior ao saldo da conta' using errcode='22023';
   end if;
 end loop;
end $$;
revoke all on function public.ua_validar_documento(jsonb) from public,anon;
grant execute on function public.ua_validar_documento(jsonb) to authenticated;

-- A transação do PostgreSQL compara a versão esperada e grava integralmente,
-- sem sobrescrever alterações feitas por outro aparelho.
create or replace function public.ua_atualizar_documento(
 p_documento jsonb,p_revisao_esperada bigint
) returns bigint language plpgsql security invoker set search_path=''
as $$
declare v_revisao bigint;
begin
 if (select auth.uid()) is null then
  raise exception 'Sessão inválida' using errcode='28000';
 end if;
 perform public.ua_validar_documento(p_documento);
 update public.universalartes_preview_backups
 set data=p_documento,revision=revision+1,updated_at=now()
 where user_id=(select auth.uid()) and revision=p_revisao_esperada
 returning revision into v_revisao;
 if v_revisao is null then
  raise exception 'Conflito de revisão: outro aparelho alterou os dados' using errcode='P0001';
 end if;
 return v_revisao;
end $$;
revoke all on function public.ua_atualizar_documento(jsonb,bigint) from public,anon;
grant execute on function public.ua_atualizar_documento(jsonb,bigint) to authenticated;

-- Para o primeiro uso da conta; INSERT único pela chave de usuário.
create or replace function public.ua_iniciar_documento(p_documento jsonb)
returns bigint language plpgsql security invoker set search_path=''
as $$
begin
 if (select auth.uid()) is null then
  raise exception 'Sessão inválida' using errcode='28000';
 end if;
 perform public.ua_validar_documento(p_documento);
 insert into public.universalartes_preview_backups(user_id,data,revision)
 values ((select auth.uid()),p_documento,1);
 return 1;
exception when unique_violation then
 raise exception 'Conta já possui dados; não será sobrescrita' using errcode='P0001';
end $$;
revoke all on function public.ua_iniciar_documento(jsonb) from public,anon;
grant execute on function public.ua_iniciar_documento(jsonb) to authenticated;
commit;
