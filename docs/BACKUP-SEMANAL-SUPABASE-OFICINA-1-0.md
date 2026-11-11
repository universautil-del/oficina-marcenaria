# OFICINA 1.0 — backup semanal no Supabase, sem Google Drive

## Arquitetura
- Dados vivos: `public.universalartes_preview_backups`, registro por usuário, JSONB versão 3.
- Cópias semanais: `public.ua_backups_semanais`, **tabela independente dentro do mesmo projeto Supabase**.
- Agendamento: `cron.schedule('oficina-1-0-backup-semanal', '0 6 * * 0', ...)`: domingos, 06:00 UTC / 03:00 São Paulo.
- Cópia inicial na instalação. Em cada semana, uma cópia nova (uma por usuário/semana), identificada por revisão, data e digest.
- Rotação automática: preserva as **quatro últimas semanas com cópia** por conta. A quinta copia antiga só é excluída **depois de salvar e verificar** a nova; falhas revertem a operação sem alterar os backups mais antigos.
- Conta autenticada só lê suas próprias cópias (RLS) e não tem privilégio de inserir, modificar ou excluir snapshots. A função de geração é exclusiva do banco.
- Interface: listar as quatro cópias, verificar se o Cron está ativo, baixar uma cópia do servidor convertendo-a no navegador em arquivo AES-256-GCM com senha do usuário. Restaurar um arquivo só com confirmação e cópia preventiva.
- Google Drive OAuth e a biblioteca externa deixam de ser carregados. A interface ainda oferece **backup manual criptografado para armazenar fora do Supabase**.

## Instalação (uma vez) no Supabase REAL
**Antes:** abra OFICINA 1.0 → Backup e recuperação → baixe e confira um backup manual criptografado e guarde a senha fora do sistema.
1. Acesse Supabase → `oficina-universa-arte` → Editor SQL → Nova consulta.
2. Abra `supabase/INSTALAR-backup-automatico-OFICINA-1-0.sql` → Raw, copie o SQL completo.
3. Execute no SQL Editor; confira `active = true` no resultado para o job `oficina-1-0-backup-semanal`.
4. Na OFICINA 1.0 → Backup e recuperação → **Verificar backups no Supabase**: deve aparecer "Agendamento semanal ativo" e a cópia inicial.
5. Baixe a cópia semanal de teste com uma senha forte, depois use **Verificar arquivo sem alterar dados**.
6. Em Supabase → Integrations → Cron → Jobs → History, confira o histórico após o próximo domingo; a execução não foi testada no Supabase real por esta publicação.

As instruções acima **não são uma instalação executada**. O código e a suíte SQL de simulação estão publicados; somente o proprietário pode habilitar o cron no projeto conectado.

## Segurança e limitações importantes
- Uma cópia na mesma instância NÃO é um backup independente de desastre. Se o projeto for apagado, dados principais e snapshots podem desaparecer juntos. Guarde cópia criptografada externa.
- Backups semanais não substituem cópias diárias gerenciadas pelo Supabase Pro: esses backups no Free **são uma solução personalizada** de snapshots apenas para o documento JSON do OFICINA, não para credenciais, configurações, arquivos de Storage ou projeto inteiro.
- No plano Free, o projeto pode **pausar por pouca atividade**; se estiver pausado, o agendamento não executará. Verifique o cron e a saúde do banco regularmente.
- A cópia servidor está protegida por RLS, mas não é criptografada com a senha pessoal do arquivo exportado; criptografia AES-GCM só é aplicada na exportação manual ou da cópia semanal para arquivo.
- Não faça restauração real em produção sem guardar uma cópia separada e confirmar qual data e revisão serão restauradas.
- O projeto requer limite de 2 MB para o documento principal, com até quatro snapshots por usuário dentro da cota do banco.

## Testes automáticos
- `tests/sql/backup-semanal-check.sql`: uma cópia por semana, digest e revisão exatos, rotação 5→4 após gravar, idempotência, isolamento RLS e bloqueio de exclusão/geração pela conta.
- `tests/backup-supabase-semanal-ui.cjs`: interface sem Google, leitura de status real simulado, lista, download cifrado, decriptação e nenhum efeito sobre a base corrente.
- `tests/drive-backup-v1.cjs`: compatibilidade dos arquivos manuais AES-256-GCM e cópia preventiva antes de restaurar.
- `pg_cron` real é requisito da etapa SQL que apenas o proprietário executa, pois o PostgreSQL sintético de CI não tem o serviço agendador do Supabase.

## Outras integrações a priorizar
1. SketchUp 2022/OpenCutList → Projeto → lista de materiais e custos, preservando a revisão.
2. Projeto aprovado → Orçamento → Pedido → Produção → Financeiro sem recadastramento.
3. Entrada de Materiais → Estoque → custo médio e previsão de compras por estoque mínimo.
4. Alertas de contas a receber e prazos de entrega dentro do dashboard, com opção de abrir WhatsApp manualmente (sem envio automático).
