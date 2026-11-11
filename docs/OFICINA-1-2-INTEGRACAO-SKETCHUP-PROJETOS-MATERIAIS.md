# Universalartes / Universa Art · OFICINA 1.2 — Integração SketchUp e Entrada de Materiais

Atualização da **prévia separada em `preview-v1/`**. O site raiz e os registros existentes não são apagados.

## O que está implementado nesta atualização

### 1. Projetos de móveis ↔ Importar lista SketchUp

- Em **Projetos de móveis** há o botão **Importar SketchUp** (global e em cada cartão/lista/etapa).
- Ao iniciar por um projeto, o importador já seleciona esse projeto.
- Envie um CSV ou XLSX exportado pelo OpenCutList, confira o mapeamento das colunas, comprimentos, larguras, espessuras, quantidade e material em **mm**.
- Após a leitura, use **Integrar com Projetos de móveis**:
  - **Salvar lista no projeto** para um projeto existente;
  - **Criar projeto e salvar peças** para criar um novo projeto com cliente opcional.
- A integração grava **tipos de peça, quantidades, dimensões em mm, material, fita informada, nome do arquivo e data de importação** dentro do cadastro do projeto.
- As áreas e quantidades ficam disponíveis nas visualizações **cartões, lista, etapas**, e são incluídas no CSV de projetos.
- **Ver peças** abre o resumo por material, permite consultar até 100 tipos de peças e exportar **toda a lista CSV**, protegida contra interpretação de fórmulas na exportação.
- A lista pode ser substituída somente com confirmação; as últimas **duas** versões anteriores ficam no histórico de dados.
- A mesma lista não é duplicada se a composição das peças for idêntica.
- Medidas externas do móvel **não são inferidas** da lista de componentes: projeto novo começa com largura, altura e profundidade zeradas, a confirmar.
- O vínculo **não** cria pedido, baixa estoque, dispara produção ou gera receita; a lista precisa ser revisada e aprovada antes de fabricar.

**Limites atuais:** até 1.200 tipos de peças e 450 KB por lista vinculada. O sistema estático ainda usa armazenamento local e, opcionalmente, sincronização do documento JSON da conta no Supabase. Isso não substitui um banco transacional para equipes ou grandes volumes.

### 2. Compras → Entrada de Materiais

- Menu: **Entrada de Materiais** (mantém internamente a rota `#compras` para não quebrar links).
- Formulário: **Nova entrada de materiais**.
- Lista: entradas pendentes, confirmadas, total de valores pendentes; botão **Confirmar entrada**.
- **Regra preservada:** salvar registra a aquisição e a conta a pagar; **somente confirmar o recebimento** acrescenta quantidade ao saldo de cada matéria-prima.
- A confirmação de recebimento é de uso único e permanece vinculada ao histórico da operação. Dados antigos continuam em `db.purchases`, inclusive contas a pagar e histórico.

### 3. Testes da atualização

O GitHub Actions executa `node tests/sketchup-project-bridge-v1.cjs` e os testes existentes. O novo teste verifica:
- criar projeto a partir de lista CSV, relacionar cliente e preservar medidas externas não informadas;
- vincular a um projeto existente, confirmar substituição e manter histórico;
- bloquear reimportação duplicada;
- exportar CSV da lista sem alterar as peças;
- não alterar estoque, financeiro nem pedidos;
- reverter os dados quando `save()` falha;
- manter os campos `compras`, `purchaseId` e `receive-purchase` internamente para compatibilidade.

O teste automatizado não substitui uma verificação visual completa com um navegador e dados fictícios.

## Como fazer um teste rápido

1. Abra [Projetos de móveis](https://universautil-del.github.io/oficina-marcenaria/preview-v1/#projetos).
2. Clique em **Importar SketchUp**, escolha o CSV do OpenCutList e confira a quantidade de peças e as medidas.
3. Na área de integração, escolha um projeto existente ou crie um com nome e cliente.
4. Volte a **Projetos de móveis** e clique em **Ver peças**. Confira material e espessura, exporte CSV e compare com a lista original.
5. Vá a [Entrada de Materiais](https://universautil-del.github.io/oficina-marcenaria/preview-v1/#compras). Registre uma aquisição fictícia e confirme o recebimento; confira que o estoque mudou **uma vez** e que a conta a pagar foi registrada.
6. Baixe um backup criptografado e verifique o arquivo em ambiente descartável antes de restaurar.

## Acesso ao sistema de referência e migração

O endereço público do sistema anterior (Cloudflare Workers / D1 / R2) foi fornecido, mas **não dá acesso ao banco D1, arquivos R2, autenticação ou código-fonte**. Portanto, não foi feita migração ou cópia dos dados existentes do outro site.

Para migração segura de produção, será necessário obter:
- exportação completa dos dados do banco anterior e seus anexos;
- mapeamento entre clientes, fornecedores, projetos, orçamentos, pedidos, contas e movimentos;
- importação para um **ambiente separado**, teste de integridade e conferência de valores/saldos;
- confirmação antes de qualquer mudança na versão usada pela marcenaria.

## O que ainda impede uso real de produção

**Não retirar o aviso de homologação apenas mudando o texto.** Ainda há limites de segurança e arquitetura:

1. A prévia GitHub Pages permite acesso local sem exigir login. Para dados reais, autenticação e isolamento devem ser obrigatórios.
2. Os registros ficam em `localStorage` e, se o usuário configurar, podem ser sincronizados como um **documento JSON por usuário** no Supabase. Isso não oferece transações atômicas para concorrência de estoque/financeiro em vários dispositivos.
3. Supabase real e RLS com duas contas ainda não foram testados com acesso externo autorizado.
4. Backup e **restauração completa** em ambiente separado devem ser testados antes de uso real. Google Drive automático não está habilitado sem OAuth do proprietário.
5. Notas fiscais: o cadastro de XML é local; a importação direta da **SEFAZ com certificado A1** não está implementada. Não publique o certificado A1, sua senha ou chaves privadas.
6. PWA com autenticação segura, armazenamento privado de anexos e migração do sistema de referência ainda são atividades separadas.

**Próxima etapa recomendada:** configurar um banco de dados de produção com autenticação obrigatória, tabelas relacionais por empresa, RLS e funções transacionais no servidor para movimentação de estoque, recebimentos e estornos. Testar restauração de backups e migração. Só então remover a marcação de homologação.
