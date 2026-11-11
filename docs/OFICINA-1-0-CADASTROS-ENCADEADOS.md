# OFICINA 1.0 — Cadastros encadeados e caminhos de trabalho

Atualização: 11/11/2026. O objetivo é **não abandonar o formulário atual para criar um cadastro faltante**, e nunca gerar compras ou baixas de estoque por engano.

## O que mudou

### Entrada de Materiais sem nenhuma matéria-prima
- Antes, aparecia o alerta nativo: "Cadastre uma matéria-prima em Produtos primeiro".
- Agora, o botão **+ Nova entrada de materiais** abre diretamente **Produtos — novo cadastro**, com tipo **Matéria-prima**.
- Ao salvar um material válido, a tela **Nova entrada de materiais** abre sozinha, com o novo material, a quantidade inicial (1) e seu custo cadastrados.
- Ao cancelar o cadastro, nenhuma entrada, despesa ou movimentação é criada. O caminho não é retomado.
- O formulário de entrada também tem o botão **+ Cadastrar matéria-prima**; ao salvar outro material, a nova linha é adicionada sem descartar fornecedor, datas ou outras linhas já preenchidas.
- O campo de matéria-prima de uma linha nova começa em **Selecione a matéria-prima** para evitar a compra acidental de um item diferente.
- O botão **+ Novo fornecedor** dentro da entrada já era reutilizado pelo cadastro unificado, e continua selecionando o fornecedor novo quando salvo.

### Orçamento e Pedido
- Nos itens de orçamento e pedido há **+ Cadastrar produto**.
- A criação usa o formulário único de **Matéria-prima / Produto acabado**.
- Após salvar, o novo produto passa a ser uma linha selecionada do documento atual, com descrição, preço e quantidade; a proposta e os demais campos permanecem como estavam.
- Cancelar o novo produto não altera o orçamento/pedido.
- O botão **+ Novo cliente** existente dentro de orçamento/pedido continua disponível.

### Produtos acabados e Projetos
- Na composição de um produto acabado, **+ Cadastrar matéria-prima** abre o cadastro rápido e inclui o material como componente com quantidade inicial 1, sem perder a composição que já estava aberta.
- No cadastro de **Projetos de móveis**, **+ Novo cliente** permite vincular um cliente sem sair da edição e sem perder medidas em milímetros.
- Ao preparar orçamento de um projeto sem cliente, o sistema abre a edição do projeto para associar ou cadastrar o cliente e só continua o orçamento se a associação for salva.

### Pedido sem estoque para reservar
- Ao tentar reservar um pedido com falta de matérias-primas, o Oficina apresenta **Materiais para o pedido**, com quantidade necessária, saldo disponível descontadas reservas de outros pedidos, faltas, compras abertas e sugestão de reposição.
- O botão **Preparar entrada dos materiais faltantes** abre **Entrada de Materiais** com os itens de custo válido e faltantes ainda não cobertos por compras abertas.
- Também é possível consultar faltas na Dashboard ou em Pedidos e Produção.
- A tela não cria compras automaticamente, não altera o estoque e não inicia produção: confirmações continuam explícitas.

## Segurança e integridade
- Todos os registros continuam no mesmo documento JSON versão 3 sincronizado no Supabase; não foi solicitada migração nova para esses atalhos.
- Formulários não fazem baixa de estoque ao selecionar, criar ou editar. Estoque é atualizado nas etapas antigas de **Confirmar entrada** ou **Iniciar produção**, seguindo as regras existentes.
- No PC e celular, confira **Sincronizado** antes de alternar de aparelho.
- As sugestões de materiais são estimativas; confirme as quantidades para compra com o estoque físico e o projeto.

## Testes de regressão
- `tests/cadastros-encadeados-1-0.cjs` confirma que a nova entrada redireciona ao cadastro da primeira matéria-prima, não prossegue em caso de cancelamento, prossegue com o item preenchido depois de salvar e inclui produtos novos no orçamento.
- `tests/integracoes-produtividade-1-0.cjs` cobre a falta de material do pedido e a exclusão de entradas já abertas da sugestão, além das integrações anteriores.
- A suíte do GitHub cobre os cálculos de matérias-primas, pedidos, produção, estoque, financeiro e o rollback das operações simuladas. Não substitui navegação e sincronização reais.

## Roteiro de homologação manual
1. Com o banco sincronizado, abra **Entrada de Materiais** sem matérias-primas. O sistema deve abrir **Produtos** automaticamente.
2. Cadastre um material fictício; confira que a nova entrada abre com esse material escolhido.
3. Sem salvar a entrada, use **+ Cadastrar matéria-prima** para incluir um segundo material. Confira se fornecedor e datas permaneceram.
4. Crie produto acabado com composição e use **+ Cadastrar matéria-prima** dentro dela. Salve o produto sem movimentar estoque.
5. Em **Orçamento**, use **+ Cadastrar produto**. Confira se volta ao mesmo orçamento com o produto escolhido.
6. Crie um pedido fictício com estoque insuficiente; use **Reservar** e confirme se a lista de faltas aparece e se o botão abre uma entrada **sem gravá-la automaticamente**.
7. Antes de fechar o site, confira **Sincronizado**. Faça backup e teste em outro aparelho.

Não execute o instalador SQL nem crie nova tabela para ativar essas melhorias de interface.
