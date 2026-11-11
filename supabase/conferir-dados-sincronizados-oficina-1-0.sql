-- OFICINA 1.0: verificar que os registros feitos no site chegaram ao Supabase.
-- SOMENTE LEITURA: não insere, altera, envia ou exclui nenhum dado.
-- Execute no SQL Editor do projeto oficina-universa-arte.
-- Retorna apenas contagens (não mostra nomes, CPF, endereços nem senhas).
select
 count(*)::int as contas_com_dados,
 coalesce(sum(jsonb_array_length(coalesce(data->'clients','[]'::jsonb))),0)::int as clientes,
 coalesce(sum(jsonb_array_length(coalesce(data->'suppliers','[]'::jsonb))),0)::int as fornecedores,
 coalesce(sum(jsonb_array_length(coalesce(data->'projects','[]'::jsonb))),0)::int as projetos,
 coalesce(sum(jsonb_array_length(coalesce(data->'quotes','[]'::jsonb))),0)::int as orcamentos,
 coalesce(sum(jsonb_array_length(coalesce(data->'orders','[]'::jsonb))),0)::int as pedidos,
 coalesce(sum(jsonb_array_length(coalesce(data->'products','[]'::jsonb))),0)::int as materiais,
 coalesce(max(revision),0)::bigint as ultima_revisao,
 max(updated_at) as ultima_atualizacao
from public.universalartes_preview_backups;
-- Se você cadastrou um cliente fictício e o sistema mostrou Sincronizado,
-- a coluna clientes deve refletir a contagem. Se não, NÃO reenvie cadastros:
-- consulte o estado da nuvem antes de qualquer nova alteração.
