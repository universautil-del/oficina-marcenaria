-- UNIVERSA ART — OFICINA 1.0
-- Diagnóstico SOMENTE LEITURA. Não cria, altera ou apaga registros.
-- Execute no SQL Editor do projeto correto e confira os resultados.
-- ATENÇÃO: estes sinais não substituem um teste real com dois logins nem restauração do backup.
with diagnostico as (
 select 1 as ordem, 'Tabela de sincronização existe' as verificacao,
        to_regclass('public.universalartes_preview_backups') is not null as aprovado
 union all
 select 2, 'RLS habilitada na tabela',
        coalesce((select relrowsecurity from pg_class where oid=to_regclass('public.universalartes_preview_backups')),false)
 union all
 select 3, 'Políticas de leitura, inserção e atualização criadas',
        (select count(distinct cmd) >= 3
         from pg_policies
         where schemaname='public' and tablename='universalartes_preview_backups'
           and cmd in ('SELECT','INSERT','UPDATE'))
 union all
 select 4, 'Função de validação do documento existe',
        to_regprocedure('public.ua_validar_documento(jsonb)') is not null
 union all
 select 5, 'Gravação com revisão e proteção contra conflito existe',
        to_regprocedure('public.ua_atualizar_documento(jsonb,bigint)') is not null
 union all
 select 6, 'Inicialização segura do documento existe',
        to_regprocedure('public.ua_iniciar_documento(jsonb)') is not null
 union all
 select 7, 'Código de materiais até 9999 habilitado na validação',
        coalesce(position('{1,4}' in pg_get_functiondef(to_regprocedure('public.ua_validar_documento(jsonb)'))) > 0,false)
)
select verificacao, case when aprovado then 'OK' else 'CONFERIR' end as resultado
from diagnostico order by ordem;

-- Se o último item sair como CONFERIR, avalie a migração
-- supabase/migrate-material-codes-9999.sql (após backup e revisão).
-- Não copie credenciais, senhas, dados de clientes nem saídas com tokens.
