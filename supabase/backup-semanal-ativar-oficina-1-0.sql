-- UNIVERSA ART - OFICINA 1.0 | ATIVAR AGENDAMENTO SEMANAL
-- PREREQUISITO: executar antes backup-semanal-estrutura-oficina-1-0.sql
-- Execute no SQL Editor do projeto oficina-universa-arte, como proprietario.
-- Esta acao NAO apaga pedidos, clientes ou documento principal.
-- Habilita Supabase Cron (pg_cron), quando disponivel no projeto.
CREATE EXTENSION IF NOT EXISTS pg_cron;

BEGIN;
-- Cria copia inicial antes de agendar; se der erro, nao removera backups anteriores.
SELECT public.ua_backup_semanal_gerar() AS copias_iniciais_criadas;
-- Todo domingo as 06:00 UTC = 03:00 no horario de Sao Paulo (UTC-3).
-- Cron substitui o agendamento se o mesmo nome for executado novamente.
SELECT cron.schedule(
 'oficina-1-0-backup-semanal',
 '0 6 * * 0',
 $$ SELECT public.ua_backup_semanal_gerar(); $$
) AS identificador_da_agenda;
COMMIT;

-- Verifique active=true e o nome do job na resposta. A execucao real deve
-- ser acompanhada em Integrations > Cron > Jobs > History no Supabase.
SELECT jobid, jobname, schedule, active
FROM cron.job WHERE jobname='oficina-1-0-backup-semanal';

SELECT semana_utc, criado_em, revisao_origem
FROM public.ua_backups_semanais ORDER BY criado_em DESC LIMIT 4;

-- O usuario do aplicativo somente pode LER seus proprios backups.
-- O job roda dentro do Postgres: site fechado ou celular desligado nao impedem o backup.
-- Copias ficam NO MESMO PROJETO. Nao sao backup de desastre independente.
