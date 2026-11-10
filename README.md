# OFICINA — Gestão de Marcenaria v0.4

Sistema web estático para GitHub Pages, em português brasileiro. **Versão de testes**, com dados apenas no armazenamento local (`localStorage`). Não possui autenticação, banco de dados centralizado, sincronização nem armazenamento seguro de dados sensíveis. **Use dados fictícios para testar.**

## Novidades da versão 0.4

- **Fornecedores:** cadastro, edição, pesquisa e proteção de exclusão quando vinculado a compras.
- **Compras:** itens de matérias-primas, contas a pagar automáticas, recebimento de mercadorias (entrada em estoque uma única vez), custo médio atualizado; cancelamento apenas de compras abertas sem pagamentos.
- **Produção:** quadro de pedidos abertos com prazo previsto, atrasos e próximas entregas, além de ações de reserva/produção/conclusão.
- **Dashboard:** seis indicadores, avisos de materiais e contas vencidas, movimentação de caixa dos últimos seis meses e atalhos.
- **Relatórios:** seleção de períodos, vendas, recebimentos e pagamentos, ranking de produtos, exportação CSV e impressão/PDF.
- **Financeiro:** exportação CSV de lançamentos.
- **Orçamentos:** duplicação, resumo compartilhável por link WhatsApp (`wa.me`), mantendo o PDF como anexo manual.
- **Pedidos e orçamentos:** campo opcional de data prevista de entrega para orientar o planejamento.
- **Backup:** continua exportando todos os dados e agora inclui fornecedores e compras. Backups da versão 0.3 seguem compatíveis. Antes de restaurar backup completo, o sistema gera uma cópia do estado atual.

## Publicar

Envie os arquivos `index.html`, `script.js`, `upgrade.js`, `style.css`, `README.md` à raiz da branch `main`, com Pages em **Settings > Pages > Deploy from a branch > main > /(root)**.

A ordem dos scripts em `index.html` é importante: `upgrade.js` deve vir **antes** de `script.js`, ambos com `defer`. As funções extras são declaradas primeiro e iniciadas pelo arquivo principal.

## Dados e segurança

- O aplicativo continua usando a chave local `oficina-marcenaria-v03` para **preservar registros existentes** sem migração destrutiva. O formato do backup continua com `version: 3`, incluindo propriedades opcionais `suppliers` e `purchases`.
- A cópia dos dados fica armazenada apenas no navegador atual. Limpar o histórico/dados do site pode apagar cadastros. Use **Minha Empresa > Exportar backup completo** com frequência.
- Não cadastre CPFs, dados reais de clientes ou informações financeiras sensíveis no site publicado em um GitHub Pages público nesta versão.
- Os dados não aparecem automaticamente em outro computador ou celular. Para produção, é necessário autenticação, autorização, backend, banco de dados, backup automatizado e política de privacidade.
- `wa.me` abre o WhatsApp com uma mensagem preenchida; **não** envia mensagens automaticamente nem hospeda o PDF.
- Compras geram contas a pagar quando são cadastradas; o estoque entra apenas ao confirmar o recebimento.

## Como testar

1. Cadastre um cliente em **Clientes**.
2. Em **Produtos**, crie uma matéria-prima e um produto acabado com composição.
3. Em **Fornecedores**, cadastre um fornecedor.
4. Em **Compras**, lance uma compra, confira a conta a pagar e clique em **Receber materiais**; confira o estoque.
5. Crie um orçamento, defina a data prevista, converta em pedido e gerencie em **Produção**.
6. Registre recebimentos em **Financeiro** e consulte **Relatórios** e **Dashboard**.
7. Exporte o backup em **Minha Empresa**.
