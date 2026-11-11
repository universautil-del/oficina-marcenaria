-- Executar após tests/sql/supabase-stub.sql e supabase/secure-document-v1.sql.
\set ON_ERROR_STOP on
set role authenticated;
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
select public.ua_iniciar_documento('{"version":3,"clients":[],"products":[],"quotes":[],"orders":[],"transactions":[],"stockMovements":[]}'::jsonb) as revision;
do $$
begin
 if (select revision from public.universalartes_preview_backups limit 1) <> 1 then
   raise exception 'Revisão inicial incorreta';
 end if;
end $$;
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
select public.ua_iniciar_documento('{"version":3,"clients":[{"id":"b1"}],"products":[],"quotes":[],"orders":[],"transactions":[],"stockMovements":[]}'::jsonb);
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
do $$
begin
 if (select count(*) from public.universalartes_preview_backups) <> 1 then
  raise exception 'Falha RLS: a conta A enxergou dados da conta B';
 end if;
end $$;
select public.ua_atualizar_documento('{"version":3,"clients":[{"id":"a1"}],"products":[],"quotes":[],"orders":[],"transactions":[],"stockMovements":[]}'::jsonb,1);
do $$
begin
 perform public.ua_atualizar_documento('{"version":3,"clients":[],"products":[],"quotes":[],"orders":[],"transactions":[],"stockMovements":[]}'::jsonb,1);
 raise exception 'Conflito CAS indevidamente aceito';
exception when raise_exception then
 if sqlerrm not like 'Conflito:%' then raise;end if;
end $$;
do $$
begin
 perform public.ua_atualizar_documento('{"version":3,"clients":[],"products":[{"id":"m1","tipo":"materia","estoque":-5}],"quotes":[],"orders":[],"transactions":[],"stockMovements":[]}'::jsonb,2);
 raise exception 'Estoque negativo aceito';
exception when invalid_parameter_value then null;
end $$;
do $$
begin
 perform public.ua_atualizar_documento('{"version":3,"clients":[],"products":[],"quotes":[],"orders":[],"transactions":[{"id":"f1","valor":100,"payments":[{"valor":150}]}],"stockMovements":[]}'::jsonb,2);
 raise exception 'Pagamento acima do valor aceito';
exception when invalid_parameter_value then null;
end $$;
do $$
begin
 if (select revision from public.universalartes_preview_backups limit 1) <> 2 then
  raise exception 'Revisão mudou após rejeitar gravações inválidas';
 end if;
end $$;
-- Novos códigos e duplicação numérica: 0999 equivale a 999.
do $$
begin
 perform public.ua_validar_documento('{"version":3,"clients":[],"products":[{"id":"m1000","tipo":"materia","codigo":"1000","estoque":0},{"id":"m9999","tipo":"materia","codigo":"9999","estoque":0}],"quotes":[],"orders":[],"transactions":[],"stockMovements":[]}'::jsonb);
end $$;
do $$
begin
 perform public.ua_validar_documento('{"version":3,"clients":[],"products":[{"id":"m1","tipo":"materia","codigo":"999","estoque":0},{"id":"m2","tipo":"materia","codigo":"0999","estoque":0}],"quotes":[],"orders":[],"transactions":[],"stockMovements":[]}'::jsonb);
 raise exception 'Código equivalente duplicado foi aceito';
exception when invalid_parameter_value then null;
end $$;
do $$
begin
 perform public.ua_validar_documento('{"version":3,"clients":[],"products":[{"id":"m1","tipo":"materia","codigo":"1000","estoque":0},{"id":"m2","tipo":"materia","codigo":"1000","estoque":0}],"quotes":[],"orders":[],"transactions":[],"stockMovements":[]}'::jsonb);
 raise exception 'Código 1000 duplicado foi aceito';
exception when invalid_parameter_value then null;
end $$;
do $$
begin
 perform public.ua_validar_documento('{"version":3,"clients":[],"products":[{"id":"legado","tipo":"acabado","codigo":"MOV-1"},{"id":"m9999","tipo":"materia","codigo":"9999","estoque":0}],"quotes":[],"orders":[],"transactions":[],"stockMovements":[]}'::jsonb);
end $$;
reset role;
