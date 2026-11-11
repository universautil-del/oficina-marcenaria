-- Oficina 1.2: migrar somente validação de material para códigos 01..9999.
-- Executar UMA VEZ no SQL Editor do Supabase, somente depois de conferir o projeto.
-- Não apaga cadastros nem recria registros. Mantém RLS e funções de atualização.
begin;
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
   where x.value->>'codigo' ~ '^[0-9]{1,4}$'
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
commit;
