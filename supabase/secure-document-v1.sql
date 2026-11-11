-- UNIVERSA ART — atualização segura do documento JSON por usuário.
-- Execute no SQL Editor do SEU projeto Supabase, após backup.
-- NÃO instala transações multiusuário para itens individuais de estoque.
begin;
create table if not exists public.universalartes_preview_backups (
 user_id uuid primary key references auth.users(id) on delete cascade,
 data jsonb not null,
 revision bigint not null default 1 check (revision >= 1),
 updated_at timestamptz not null default now()
);
alter table public.universalartes_preview_backups enable row level security;
revoke all on public.universalartes_preview_backups from public,anon,authenticated;
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

-- Verifica as invariantes antes de cada mutação de documento.
create or replace function public.ua_validar_documento(p_documento jsonb)
returns void language plpgsql security invoker set search_path=''
as $fn$
declare
 k text;
 item jsonb;
begin
 if p_documento is null or jsonb_typeof(p_documento)<>'object'
    or p_documento->>'version'<>'3' then
   raise exception 'Documento deve ser objeto na versão 3' using errcode='22023';
 end if;
 if octet_length(p_documento::text)>2000000 then
   raise exception 'Limite de 2 MB excedido' using errcode='22023';
 end if;
 foreach k in array array['clients','products','quotes','orders','transactions','stockMovements'] loop
   if jsonb_typeof(p_documento->k)<>'array' then
     raise exception 'Coleção % inválida',k using errcode='22023';
   end if;
   if exists (
      select 1 from jsonb_array_elements(p_documento->k) as x(value)
      where x.value->>'id' is null or btrim(x.value->>'id')=''
   ) then raise exception 'Coleção % tem registro sem ID',k using errcode='22023';end if;
   if exists (
      select 1 from jsonb_array_elements(p_documento->k) as x(value)
      group by x.value->>'id' having count(*)>1
   ) then raise exception 'IDs duplicados em %',k using errcode='22023';end if;
 end loop;
 foreach k in array array['suppliers','purchases','projects','invoices','orderAttachments'] loop
   if p_documento ? k and jsonb_typeof(p_documento->k)<>'array' then
     raise exception 'Coleção % inválida',k using errcode='22023';
   end if;
 end loop;
 foreach k in array array['quotes','orders'] loop
   if exists(
      select 1 from jsonb_array_elements(p_documento->k) as x(value)
      where x.value ? 'number'
      group by x.value->>'number' having count(*)>1
   ) then raise exception 'Números duplicados em %',k using errcode='22023';end if;
 end loop;
 if exists (
   select 1 from jsonb_array_elements(p_documento->'products') as x(value)
   where x.value->>'tipo'='materia'
   and (case when coalesce(x.value->>'estoque','') ~ '^[0-9]+([.][0-9]+)?$'
      then (x.value->>'estoque')::numeric < 0 else true end)
 ) then raise exception 'Estoque de matéria-prima inválido' using errcode='22023';end if;
 if exists (
   select 1 from jsonb_array_elements(p_documento->'products') as x(value)
   where x.value->>'codigo' ~ '^[0-9]{1,3}$'
   group by (x.value->>'codigo')::integer having count(*)>1
 ) then raise exception 'Código de material duplicado' using errcode='22023';end if;
 for item in select x.value from jsonb_array_elements(p_documento->'transactions') as x(value) loop
   if coalesce(item->>'valor','') !~ '^[0-9]+([.][0-9]+)?$' then
     raise exception 'Valor financeiro inválido' using errcode='22023';
   end if;
   if exists(
     select 1 from jsonb_array_elements(coalesce(item->'payments','[]'::jsonb)) as pay(value)
     where coalesce(pay.value->>'valor','') !~ '^[0-9]+([.][0-9]+)?$'
   ) then raise exception 'Pagamento inválido' using errcode='22023';end if;
   if (select coalesce(sum((pay.value->>'valor')::numeric),0)
       from jsonb_array_elements(coalesce(item->'payments','[]'::jsonb)) as pay(value))
     > (item->>'valor')::numeric + 0.02 then
     raise exception 'Pagamentos ultrapassam valor da conta' using errcode='22023';
   end if;
 end loop;
end $fn$;
revoke all on function public.ua_validar_documento(jsonb) from public,anon;
grant execute on function public.ua_validar_documento(jsonb) to authenticated;

-- A revisão impede sobrescrever o trabalho salvo em outro aparelho.
create or replace function public.ua_atualizar_documento(
 p_documento jsonb,p_revisao_esperada bigint
) returns bigint language plpgsql security invoker set search_path=''
as $fn$
declare v_nova_revisao bigint;
begin
 if (select auth.uid()) is null then
   raise exception 'Login obrigatório' using errcode='28000';
 end if;
 perform public.ua_validar_documento(p_documento);
 update public.universalartes_preview_backups
 set data=p_documento,revision=revision+1,updated_at=now()
 where user_id=(select auth.uid()) and revision=p_revisao_esperada
 returning revision into v_nova_revisao;
 if v_nova_revisao is null then
   raise exception 'Conflito: houve atualização em outro aparelho' using errcode='P0001';
 end if;
 return v_nova_revisao;
end $fn$;
revoke all on function public.ua_atualizar_documento(jsonb,bigint) from public,anon;
grant execute on function public.ua_atualizar_documento(jsonb,bigint) to authenticated;

-- Criação inicial: INSERT atômico não sobrescreve backup existente.
create or replace function public.ua_iniciar_documento(p_documento jsonb)
returns bigint language plpgsql security invoker set search_path=''
as $fn$
begin
 if (select auth.uid()) is null then
   raise exception 'Login obrigatório' using errcode='28000';
 end if;
 perform public.ua_validar_documento(p_documento);
 insert into public.universalartes_preview_backups(user_id,data,revision)
 values ((select auth.uid()),p_documento,1);
 return 1;
exception when unique_violation then
 raise exception 'Essa conta já possui dados e não será sobrescrita' using errcode='P0001';
end $fn$;
revoke all on function public.ua_iniciar_documento(jsonb) from public,anon;
grant execute on function public.ua_iniciar_documento(jsonb) to authenticated;
commit;
