# OFICINA — Revisão de segurança e organização (12/11/2026)

## Alcance
Esta revisão examina o código público do repositório, os módulos de autenticação, sincronização, backups, navegação e testes automatizados. **Não foi executada uma inspeção da configuração real do Supabase, de suas contas ou de dados da marcenaria.** Testes locais e simulações não comprovam segurança ponta a ponta.

## Proteções identificadas no código
- A versão `preview-v1/seguro.html` habilita um portal autenticado, com dados inicialmente vazios enquanto não há sessão ativa. A prévia `index.html` continua acessível para **dados fictícios de teste**, sem a mesma exigência de login.
- O código de acesso usa chave pública do projeto Supabase. **Nunca inserir chave `service_role`, `sb_secret_`, senhas ou tokens privados nos arquivos do site.**
- O SQL `supabase/secure-document-v1.sql` define políticas RLS por `auth.uid()` e atualizações com controle de revisão, para sinalizar conflito entre aparelhos.
- O módulo `backup-oficina-v1.js` gera cópias manuais criptografadas com AES-GCM e uma senha fornecida pelo usuário, sem salvar a senha no aplicativo.
- A tela Segurança disponibiliza diagnóstico dos dados, consulta autenticada de conexão e status das cópias semanais. A nova validação não considera um backup antigo (mais de 9 dias), um backup sem data válida ou uma agenda inativa como proteção semanal confirmada.

## Organização e produtividade
- A navegação existente é organizada por grupos: Painel, Projetos e Pedidos, Materiais e Compras, Financeiro e Documentos, Sistema e Segurança.
- A **Busca geral** permite localizar clientes, fornecedores, projetos, orçamentos, pedidos, materiais, entradas e lançamentos financeiros. Disponível no cabeçalho e por **Ctrl+K** (ou **⌘+K** no Mac), respeitando o bloqueio de login do portal autenticado.
- Atalhos no buscador reutilizam os formulários existentes de novo projeto, orçamento, pedido, entrada de materiais e lançamento, além de abrir Segurança e Backup. A pesquisa por si só não salva nem movimenta nada.

## Verificações manuais ainda necessárias antes de homologar o uso real
1. **Supabase Auth:** confirme que novas inscrições públicas estão desativadas após a criação do usuário autorizado, que a política de senhas é apropriada e, se disponível, configure MFA.
2. **RLS com duas contas:** teste como usuário A e como usuário B, em ambiente de teste, para confirmar que um não consegue ler, alterar nem sobrescrever o documento do outro. Inclua testes das funções RPC e das tabelas de backup.
3. **Sincronização entre PC e celular:** faça um lançamento fictício no PC, espere `Sincronizado`, confira no celular; em seguida teste o conflito com alterações simultâneas, sem usar dados reais.
4. **Backup e restauração:** confirme a execução do agendamento Cron, a data da cópia mais recente, uma cópia criptografada externa e a restauração em um ambiente de testes isolado.
5. **Permissões de publicação:** confira domínio HTTPS, usuários autorizados do GitHub e Supabase, e evite publicar contratos, documentos e dados de clientes no repositório.
6. **Dispositivos compartilhados:** mantenha Windows, navegador e celular atualizados; faça logout e feche a aba ao terminar. Tokens da sessão permanecem no navegador durante a sessão; não use computadores públicos.
7. **Testes visuais e funcionais:** confira a busca em computador e celular; teste o formulário de projetos, pedidos, financeiro, estoque, documentos, exportação Excel e impressão antes de depender deles na operação.

## Limitações importantes
- Um site estático no GitHub Pages **não é um servidor privado**. A segurança real dos dados no Supabase depende de autenticação e políticas RLS corretamente aplicadas no banco real.
- Backups dentro do **mesmo projeto Supabase** não substituem uma cópia externa e uma restauração testada.
- O sistema atual usa um documento JSON por usuário e revisão para evitar sobrescritas; isso **não equivale a transações individualizadas de estoque/financeiro entre múltiplos operadores simultâneos**.
- Não classifique o sistema como “100% seguro” apenas porque os testes automatizados passaram.

## Prioridades sugeridas para uma próxima etapa
1. Homologação de RLS, backup e recuperação com contas fictícias, antes de ampliar recursos que movimentem estoque ou finanças.
2. Painel de tarefas diárias com filtros diretos para contas vencidas, pedidos aguardando confirmação e materiais em falta (parte dessas informações já existe na Central de Integrações).
3. Recursos opcionais de aprovação de orçamentos e acompanhamento de prazos, sempre com conferência humana e histórico de alterações.
