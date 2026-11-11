-- Testes de backup semanal sobre Postgres sintético do GitHub Actions.
-- Pre-requisito: stub Supabase, SQL de autenticação, documentos, estrutura backup.
\set ON_ERROR_STOP on

-- Incluir 4 copias antigas na conta 1 para testar a rotacao apos nova copia.
INSERT INTO public.ua_backups_semanais(user_id,semana_utc,revisao_origem,dados,assinatura_md5)
SELECT t.user_id,
  (date_trunc('week',timezone('UTC',now()))::date - (7*n) )::date,
  t.revision, t.data, md5(t.data::text)
FROM public.universalartes_preview_backups t
CROSS JOIN generate_series(1,4) AS n
WHERE t.user_id='00000000-0000-0000-0000-000000000001';

DO $$
BEGIN
 IF (SELECT count(*) FROM public.ua_backups_semanais WHERE user_id='00000000-0000-0000-0000-000000000001')<>4 THEN
  RAISE EXCEPTION 'Falha ao preparar 4 backups antigos';
 END IF;
END $$;

SELECT public.ua_backup_semanal_gerar() AS novas_copias_criadas;

DO $$
DECLARE
 conta_1 uuid := '00000000-0000-0000-0000-000000000001';
 conta_2 uuid := '00000000-0000-0000-0000-000000000002';
BEGIN
 IF (SELECT count(*) FROM public.ua_backups_semanais WHERE user_id=conta_1)<>4 THEN
  RAISE EXCEPTION 'A rotacao deveria manter 4 copias do usuario 1.';
 END IF;
 IF (SELECT count(*) FROM public.ua_backups_semanais WHERE user_id=conta_2)<>1 THEN
  RAISE EXCEPTION 'Nao foi criada a primeira copia do usuario 2.';
 END IF;
 IF NOT EXISTS (
    SELECT 1 FROM public.ua_backups_semanais b
    JOIN public.universalartes_preview_backups d ON d.user_id=b.user_id
    WHERE b.user_id=conta_1
      AND b.semana_utc=date_trunc('week',timezone('UTC',now()))::date
      AND b.dados=d.data AND b.revisao_origem=d.revision AND b.assinatura_md5=md5(d.data::text)
 ) THEN RAISE EXCEPTION 'Backup recente nao confere com documento original.'; END IF;
 IF EXISTS (
   SELECT 1 FROM public.ua_backups_semanais WHERE user_id=conta_1
   AND semana_utc=date_trunc('week',timezone('UTC',now()))::date -28
 ) THEN RAISE EXCEPTION 'Quinta copia nao foi removida apos salvar a nova.'; END IF;
END $$;

DO $$
DECLARE result integer;
BEGIN
 SELECT public.ua_backup_semanal_gerar() INTO result;
 IF result<>0 THEN RAISE EXCEPTION 'Backups duplicados na mesma semana: %',result; END IF;
END $$;

-- So pode ler os seus backups. Nenhuma conta autenticada pode inserir ou excluir.
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
DO $$
BEGIN
 IF (SELECT count(*) FROM public.ua_backups_semanais)<>4 THEN
  RAISE EXCEPTION 'RLS deixou usuario 1 visualizar backups de outra conta.';
 END IF;
END $$;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $$
BEGIN
 IF (SELECT count(*) FROM public.ua_backups_semanais)<>1 THEN
  RAISE EXCEPTION 'RLS deixou usuario 2 visualizar backups de outra conta.';
 END IF;
END $$;
DO $$
BEGIN
  DELETE FROM public.ua_backups_semanais;
  RAISE EXCEPTION 'Usuario conseguiu excluir backups automaticos';
EXCEPTION WHEN insufficient_privilege THEN
  NULL;
END $$;
DO $$
BEGIN
  PERFORM public.ua_backup_semanal_gerar();
  RAISE EXCEPTION 'Usuario autenticado conseguiu invocar funcao interna';
EXCEPTION WHEN insufficient_privilege THEN
  NULL;
END $$;
RESET ROLE;
SELECT 'OK backups semanais: 4 ultimos, copia verificada, RLS, sem delete e sem duplicatas' AS status;
