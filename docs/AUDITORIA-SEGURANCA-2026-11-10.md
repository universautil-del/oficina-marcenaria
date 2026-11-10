# Auditoria de segurança — Universalartes OFICINA
Data: 10/11/2026

Escopo: GitHub Pages (site principal e /preview-v1/), JavaScript, backup e restauração, anexos locais, CSV SketchUp, configuração Supabase e políticas SQL.

## Resultado
NÃO aprovar para dados reais sensíveis nesta etapa. As correções pontuais abaixo foram aplicadas e testadas automaticamente, mas o banco Supabase real, as regras de acesso entre duas contas, backups e operações concorrentes não foram validados.

## Correções verificadas
1. Anexos PDF de backups: a função de download aceitava endereço arbitrário vindo de um backup JSON. Agora recusa javascript:, data:text/html e outros endereços não PDF; aceita só data URL application/pdf;base64 com tamanho limitado e cabeçalho %PDF-, cria um blob local e saneia o nome do arquivo.
2. Chave Supabase: o formulário antigo rejeitava as strings service_role e sb_secret_, mas não reconhecia o papel escondido num JWT service_role. Agora só aceita sb_publishable_ e JWT cujo campo role seja anon. A autenticidade de cada chave segue sendo validada pelo Supabase.
3. Backup antigo: coleções de módulos opcionais ausentes podiam quebrar o Dashboard. O importador agora normaliza projects, invoices, suppliers, purchases, orderAttachments e sequências sem sobrescrever entradas presentes, e rejeita tipos inválidos.
4. Cache e avisos: atualização dos sufixos de scripts JS e texto da prévia sobre os limites do isolamento pelo navegador.
5. Testes: nova suíte tests/security-audit.cjs, executada junto de tests/v1-smoke.cjs pelo GitHub Actions.

## Pendências de maior risco
- Banco sincroniza um JSON por usuário, não operações atômicas por pedido. Baixas, reservas e parcelas executadas no navegador podem se tornar inconsistentes sob edições simultâneas ou interrupções de rede. Usar PostgreSQL transacional e chaves idempotentes.
- O login é opcional. Dados de visitante ficam em localStorage sem autenticação obrigatória e podem ser vistos por quem acessa o mesmo navegador.
- RLS ainda não testada no Supabase real com duas contas (usuário A não pode acessar usuário B). O SQL proposto é restritivo em leitura e gravação por auth.uid(), mas precisa de testes reais.
- Prévia e produção compartilham a mesma origem GitHub Pages. Usar nomes diferentes de localStorage não isola dados contra um script indevido na mesma origem; separar domínios ou evitar persistir informações sensíveis em browser.
- Tokens em sessionStorage podem ser expostos se ocorrer XSS. É preciso reduzir HTML construído por string, refatorar scripts inline e adotar CSP compatível.
- Arquivos e fotos base64 em JSON dependem da quota local do navegador; implantar storage privado com políticas de acesso.
- XML de NF-e importado localmente não confirma autenticidade SEFAZ nem emite documento.
- Cálculo de chapas SketchUp é estimativa por área, sem plano de corte validado (sentido do veio, espessura, peças, serra).
- Backups locais não substituem restauração verificada de banco.

## Testes realizados
- Sintaxe dos arquivos JS principais.
- CSV SketchUp e cálculos mm/m².
- Backups de formatos antigos e campos opcionais inválidos.
- Bloqueio de URL javascript: e data:text/html em anexos; PDF válido permitido.
- Chaves Supabase anon/publishable permitidas, secret/service_role recusadas.
- Presença das políticas RLS no SQL.

Estes testes NÃO substituem pentest, verificação de segurança do servidor ou validação de execução no Supabase real.

## Para retirar a indicação de testes
1. Criar e conectar projeto Supabase real, confirmar RLS com duas contas fictícias.
2. Migrar operações críticas para banco transacional com acesso por empresa.
3. Migrar anexos privados e verificar acesso.
4. Realizar testes de backup/restauração, pedidos, estoque, financeiro e navegador/celular.
5. Manter dados fictícios até que as verificações estejam concluídas.

Referências oficiais: https://supabase.com/docs/guides/database/postgres/row-level-security e https://supabase.com/docs/guides/getting-started/api-keys
