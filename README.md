# UNIVERSALARTES — OFICINA 1.0 (prévia de desenvolvimento)

Esta branch `universalartes-v1` é o início da reconstrução do sistema para a rotina real de uma marcenaria de móveis sob medida. O sistema publicado continua na branch `main` com a versão 0.6. **Não publicar esta prévia como sistema comercial pronto.**

## Primeira entrega da branch
- Marca **Universalartes** (empresa) + **Oficina** (nome do sistema).
- Novo **Painel do Marceneiro**, somente leitura, alimentado pelos registros existentes: vendas do mês, pedidos ativos, próximas entregas, atrasos, estoque, contas e projetos.
- **Ordem de produção para impressão:** botão em Pedidos, com itens, materiais previstos, responsável, prazo e checklist de corte, fita, furação, montagem e instalação. Não altera estoque nem status.
- Fallback de nome Universalartes em dados de empresa/documentos, sem apagar nome que já tenha sido cadastrado.
- Estrutura de planejamento de migração para dados por empresa e fluxo completo de obra: [Plano técnico de v1](docs/UNIVERSALARTES-V1-PLANO.md).
- Preserva chaves antigas de armazenamento e dados existentes nesta etapa.

**Ainda não implementado na v1:** banco multiusuário por empresa, transações de estoque/financeiro no backend, ordens de produção detalhadas, importação segura ou acesso a anexos privados. Todos requerem desenvolvimento e testes antes da publicação.

---

## Documentação da versão anterior (0.6)

# OFICINA — Gestão de Marcenaria v0.6

Versão estática hospedada no GitHub Pages, com clientes, produtos e composição, estoque, compras, fornecedores, orçamentos, pedidos, projetos, conversor, financeiro, documentos, XML de NF-e e relatórios da v0.5. Mantém o tema verde/branco/madeira.

## Novo: login e sincronização opcionais

Agora há um painel **Minha Empresa > Login e banco de dados online**. O sistema continua no modo local até o administrador configurar o próprio projeto Supabase.

**Como habilitar:**
1. Crie um projeto em https://supabase.com e escolha uma senha forte para a conta administrativa do Supabase.
2. No painel do Supabase, abra **SQL Editor** e execute `supabase/schema.sql` na íntegra. Este script cria `public.oficina_backups`, com RLS (Row Level Security), permitindo que cada usuário autenticado leia e escreva apenas seu próprio registro.
3. Em **Project Settings > API**, copie a **Project URL** e a chave **publishable/anon (pública)**. **Nunca use chave `service_role`, `sb_secret_` ou outros segredos no navegador ou no GitHub.**
4. Abra o site OFICINA > **Minha Empresa**, preencha Project URL e chave pública, clique **Salvar configuração**.
5. Crie uma conta com e-mail/senha ou entre com uma conta previamente cadastrada no **Authentication > Users** do Supabase. Se o Supabase solicitar confirmação por e-mail, confirme antes de tentar entrar. É possível configurar o cadastro público de usuários no painel Supabase.
6. **Exporte seu backup local antes da migração.** O painel de nuvem oferece **Enviar dados deste aparelho** ou **Usar dados da nuvem**. Ao selecionar uma versão, o sistema inicia outro download de backup antes da troca.
7. No segundo aparelho, use **o mesmo projeto Supabase, a mesma chave pública e o mesmo e-mail/senha**; então escolha **Usar dados da nuvem**. Confira o indicador **Sincronizado** antes de alternar aparelhos.

**ATENÇÃO:** não configure dois logins diferentes se deseja os mesmos dados. Nesta versão, cada usuário tem seu próprio conjunto de dados; não há permissões de equipe ou compartilhamento por empresa.

## Proteções e limites

- Os dados no Supabase ficam isolados por `auth.uid()`/RLS e só são enviados após login e vínculo explícito do aparelho.
- A atualização usa versão numérica condicional: alterações de dois aparelhos são sinalizadas como **conflito**. O app **não mescla automaticamente** cadastros de dois aparelhos. Exporte backup e escolha qual conjunto preservar.
- No modo nuvem, os dados alterados ficam na memória/`sessionStorage` até sincronizarem. **Não feche a aba se o status for Offline, Não sincronizado ou Conflito.** Exporte um backup se necessário.
- O logout limpa a sessão e os dados de nuvem desta aba; o modo local é zerado após um backup antes de ativar a nuvem.
- Tokens de sessão ficam no `sessionStorage` do navegador, não no GitHub. A chave pública do Supabase fica nas configurações locais do navegador.
- O limite de envio automático é de **2 MB por backup JSON**. Projetos com muitas imagens/anexos exigirão migração dos arquivos para Supabase Storage privado.
- Este sistema ainda sincroniza um **documento JSON por conta**: não implementa edição colaborativa em tempo real, trilhas de auditoria, separação por empresa ou permissões de funcionários.
- Senhas e e-mails são gerenciados pelo Supabase Auth; **não** se deve guardar senhas no código ou no banco de dados do Oficina.
- A integração não foi testada com um projeto Supabase real nesta entrega; o fluxo foi testado em navegador com respostas simuladas. **Faça testes com dados fictícios e revise as políticas RLS antes de confiar informações comerciais sensíveis.**
- A nota fiscal XML local não autentica dados com SEFAZ. Não há emissão fiscal automática, nem estorno de matéria-prima já consumida.

## Publicação

Os arquivos da raiz permanecem: `index.html`, `style.css`, `style-v04.css`, `theme-v05.css`, `upgrade.js`, `script.js`, `features-v05.js`.

Novos: `cloud-v06.js`, `cloud-v06.css` e `supabase/schema.sql`. O `index.html` referencia primeiro `upgrade.js`, depois `script.js`, `features-v05.js` e por último `cloud-v06.js`.

Em GitHub Pages, use `main` e `/(root)`. A versão 0.5 fica preservada em uma branch de backup.

## Compatibilidade dos dados

O modo local continua usando `oficina-marcenaria-v03` e o formato `version:3`, para preservar os registros criados nas versões anteriores. A migração para a nuvem é **manual e confirmada**: há download do backup antes de limpar a cópia local desprotegida. Se você já utiliza clientes reais na versão local, remova qualquer cópia remanescente de dispositivos compartilhados.

## Padrão brasileiro de medidas

O conversor usa apenas **mm, cm e m**. Nos projetos e documentos técnicos da Universalartes, **todas as medidas de fabricação devem ser lançadas em milímetros (mm)**. As demais unidades servem para consulta, sem conversão implícita dos registros existentes.
