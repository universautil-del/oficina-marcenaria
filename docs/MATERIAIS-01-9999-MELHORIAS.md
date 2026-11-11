# Oficina 1.2 — Código automático de materiais de 01 até 9999

## O que mudou
- Apenas **matérias-primas**: numeração sequencial de **01, 02 ... 99, 100 ... 999, 1000 ... 9999**.
- A numeração antiga é preservada; excluir um cadastro não reaproveita códigos que já tiveram sua sequência gravada.
- São rejeitados códigos equivalentes como 0999 e 999 para materiais diferentes.
- Produtos acabados antigos continuam preservados em histórico, sem disponibilizar um novo cadastro de acabados.
- Em **Produtos e Estoque**, novos atalhos: **Registrar entrada**, **Estoque baixo** e botão **Mostrar todos**.
- **Entrada de Materiais** permite abrir **+ Novo fornecedor** sem perder o formulário; a seleção do fornecedor é explícita.
- No celular, os botões de materiais foram ampliados e organizados em duas colunas.
- Estoque e financeiro continuam vinculados à confirmação do recebimento; não lançar a mesma compra também como movimentação avulsa.

## Testes automatizados
- `tests/product-excel-v1.cjs`: limite 01..9999, código 1000, preservação de legado, sequência após excluir e reversão ao falhar gravação.
- `tests/material-ui-9999.cjs`: busca, filtro de estoque baixo, contagem, atalhos de compra.
- `tests/fluxo-integrado-v1-3.cjs`: fornecedores rápidos no formulário, orçamento, pedido, financeiro, produção, rollback.
- `tests/sql/secure-document-check.sql`: permite códigos 1000/9999, bloqueia duplicados 0999/999, e preserva código legado não numérico.
- A suíte CI do GitHub valida o código, mas **não** substitui testes de navegação real em PC/celular, nem testes de sincronização num Supabase real.

## Ação única necessária no Supabase já criado
Como o banco da marcenaria já tinha recebido o SQL anterior, é preciso atualizar **apenas a função de validação** do banco:

1. Faça um backup e confira que está no projeto **oficina-universa-arte**.
2. No Supabase abra **Editor SQL → Nova consulta**.
3. Abra `supabase/migrate-material-codes-9999.sql` no GitHub e clique em **Raw**.
4. Copie o conteúdo inteiro e execute no Editor SQL; verifique a mensagem de sucesso.
5. Só depois use os códigos com quatro dígitos no Oficina autenticado. O SQL da migração não apaga os registros existentes.

**Não** cole senha do banco, chave secreta, chave `service_role` nem tokens em conversas ou no GitHub. O arquivo da migração não requer essas credenciais.

## Verificação manual após atualização
- Atualizar o navegador (Ctrl+F5), acessar **Produtos e Estoque**, procurar o aviso `01 até 9999`.
- Abrir a tela de nova matéria-prima e conferir o próximo código automático sem alterá-lo manualmente.
- Testar **Estoque baixo** e **Mostrar todos**; testar **Registrar entrada** e **+ Novo fornecedor** com dados fictícios.
- Após salvar uma entrada, confirmar recebimento uma única vez e conferir saldo do estoque e conta a pagar.
- Se usar no PC e no celular, aguardar o indicador **Sincronizado** antes de alternar de aparelho.
