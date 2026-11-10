# UNIVERSALARTES 1.0 — Roteiro de conclusão

**Estado em 10/11/2026:** a interface de testes está publicada em `/preview-v1/`. O banco online ainda **não foi configurado ou validado** com um projeto Supabase real. Por isso o produto permanece em testes e NÃO deve armazenar dados de clientes reais.

## 1. O que já existe
- Dashboard Universalartes, clientes, projetos, materiais, pedidos, financeiro, relatórios e documentos herdados da v0.6.
- Assistente de briefing em mm com cópia para o ChatGPT (sem API integrada).
- SketchUp 2022: importação CSV/OpenCutList, mapeamento de colunas, cálculos preliminares e exportação (não abre diretamente `.skp`).
- Ordem de produção para impressão e checklists.
- Login e sincronização **opcionais**, com sessões de teste isoladas em `preview-v1/cloud-preview.js`.
- SQL com RLS específico para testes em `preview-v1/supabase-preview.sql`.
- Smoke tests automáticos em `tests/v1-smoke.cjs`, executados pela ação `Validar Universalartes 1.0`.

## 2. Ativar o login (ação do proprietário da Universalartes)
1. Criar uma conta e um projeto gratuito `universalartes-oficina` em https://supabase.com/dashboard.
2. Abrir **SQL Editor** no projeto Supabase.
3. Copiar e executar o conteúdo de [supabase-preview.sql](../preview-v1/supabase-preview.sql).
4. Confirmar que a tabela `public.universalartes_preview_backups` existe e RLS está ativa.
5. Em **Project Settings → Data API / API Keys** (o nome pode variar), copiar SOMENTE a **Project URL** (`https://...supabase.co`) e a chave **publishable (`sb_publishable_`)** ou a antiga `anon` pública. **Nunca compartilhar com terceiros a senha de acesso, tokens, chave `service_role`, `sb_secret_` ou secrets do projeto.**
6. Abrir a [prévia do sistema](https://universautil-del.github.io/oficina-marcenaria/preview-v1/#empresa).
7. Em **Login da Universalartes**, colar Project URL e chave pública; salvar a configuração.
8. Criar um usuário de teste (ou criá-lo em Supabase → Authentication → Users), confirmar e-mail se solicitado; entrar com e-mail e senha.
9. Cadastrar **apenas dados fictícios**, exportar backup antes de enviar dados à nuvem; escolher **Enviar dados deste aparelho**.
10. Abrir a mesma prévia em outro navegador ou aparelho, configurar o mesmo projeto, entrar com a MESMA conta e escolher **Usar dados da nuvem**. Conferir se os dados são iguais.

## 3. Testes de aceite indispensáveis antes do uso real
- **Login**: conta correta entra, senha incorreta falha, logout apaga informações de sessão.
- **RLS**: usuário A não consegue ler nem alterar registros do usuário B (requer duas contas de teste).
- **Persistência**: salvar cliente de teste, fechar/reabrir, entrar e conferir.
- **Dois aparelhos**: sincronizar após mudança no primeiro e conferir no segundo. Não editar simultaneamente, pois nesta versão o banco armazena um JSON por usuário e pode acusar conflito.
- **Backup**: exportar, importar e recuperar, sem apagar registros originais.
- **Operações**: orçamentos→pedidos→parcelas (sem duplicação), reserva/consumo/estorno de estoque, compras→entrada de estoque, recibos e PDFs.
- **SketchUp 2022**: comparar resultado de uma peça conhecida em mm com a lista de corte real; conferir quantidades, material, espessuras, fita e aproveitamento de chapas.
- **Segurança**: não colocar senhas ou tokens no GitHub, validar tabelas, logs de erro e acesso aos anexos.

## 4. Limites honestos desta entrega
- Não há API de IA embutida; o assistente gera briefing copiável para o ChatGPT.
- A importação do SketchUp é por CSV, não faz leitura de `.skp` diretamente.
- O cálculo de chapas é estimativa; não é otimização de corte validada.
- Nuvem está pronta para configuração, mas não foi testada contra projeto Supabase real nesta conversa.
- Banco por usuário usa documento JSON, não tabelas normalizadas e operações transacionais compartilhadas; uso simultâneo por funcionários exige arquitetura diferente.
- Documentos impressos pelo navegador e anexos locais pequenos não equivalem a serviço seguro de documentos.
- Supabase gratuito tem limitações, incluindo possível pausa por inatividade e backups não automáticos. Manter backups JSON locais em mídia segura.
- Não considerar uma função pronta apenas por estar listada neste roteiro.

## 5. Critério para tirar o rótulo de testes
Somente após conexão real, testes de acesso e sincronização, restauração de backup, conferência de produção/financeiro e revisão de segurança. Se o uso for apenas de um marceneiro, liberar inicialmente para **uma conta e uso sequencial em aparelhos**, sem colaboração simultânea.

### Documentação de base
- [Visão e escopo da Universalartes 1.0](../docs/UNIVERSALARTES-V1-PLANO.md) (branch de desenvolvimento)
- [Documentação Supabase de Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
