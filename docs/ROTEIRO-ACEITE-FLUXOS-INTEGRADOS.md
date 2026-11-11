# UNIVERSA ART / UNIVERSALARTES — Revisão dos fluxos integrados

## Entrega desta atualização

Esta revisão foi feita no repositório `universautil-del/oficina-marcenaria`, dentro de `preview-v1/`. Não altera o banco do sistema de referência em Cloudflare/D1/R2, não apaga cadastros existentes e não importa dados do site anterior.

### Integração 1 — Projeto de móveis → Orçamento → Pedido → Financeiro

1. Em **Projetos de móveis**, selecione um projeto que tenha um cliente cadastrado.
2. Clique **Criar orçamento** (disponível em cartões, lista e etapas).
3. O formulário de orçamento recebe o cliente, o ambiente, a descrição do projeto e a estimativa da **Opção A**, quando houver. **Confira e ajuste todos os valores**. Se o preço estiver em branco ou zero, o orçamento exige o preenchimento de um valor válido.
4. O orçamento recebe `projectId` e `projectNome`, mantém o projeto visível na lista e na impressão do orçamento.
5. Ao clicar **Virar pedido**, o pedido utiliza o **mesmo número do orçamento**, preserva o projeto vinculado e gera as parcelas de recebimento uma única vez.
6. Em Pedidos, o projeto vinculado aparece na lista e nos detalhes. Em Projetos, os cartões mostram quantos orçamentos e pedidos estão associados.
7. A associação do projeto **não gera baixa automática do estoque a partir do CSV do SketchUp**. Para consumir materiais, o pedido deve utilizar itens de matéria-prima cadastrados ou, em dados históricos, composições de itens acabados. Peças importadas continuam exigindo conferência de matéria-prima, sentido do veio, espessura e plano de corte.

### Integração 2 — Entrada de Materiais → Estoque → Financeiro

- Ao salvar uma entrada, é criada **uma conta a pagar** vinculada ao fornecedor e ao número da entrada, sem modificar o estoque.
- Ao **Confirmar entrada**, os materiais são acrescidos uma única vez, com precisão física de três casas decimais e custo médio ponderado.
- Entradas canceladas ou confirmadas não podem ser recebidas novamente.
- Falhas no salvamento local agora revertem lançamento, saldo, custo e numeração.

### Integração 3 — Pedido → Produção → Estoque

- A reserva apenas marca os materiais alocados; ela não baixa estoque.
- Ao iniciar a produção, a matéria-prima é baixada uma única vez e o pedido muda para Em produção.
- A precisão de quantidade física foi ajustada para três casas decimais.
- Se o armazenamento falhar, os saldos e movimentações voltam ao estado anterior.

### Integridade e correções adicionais

- Ao duplicar um orçamento, usa-se a sequência compartilhada com pedidos para evitar números repetidos.
- Projetos relacionados a orçamentos/pedidos não podem ser excluídos indevidamente.
- A edição de projetos e orçamentos não muta o cadastro original antes de salvar.
- Recebimentos, pagamentos, receitas e pedidos são revertidos em memória quando o salvamento local falha.
- Valores não numéricos, `NaN`, valores infinitos e quantidades inválidas são rejeitados.
- O diagnóstico **Segurança e confiabilidade** inclui verificação de: códigos numéricos duplicados, números duplicados de pedidos/orçamentos, vínculo perdido com projeto e divergência entre total de pedido e parcelas de recebimento.

## Testes automatizados

A suíte do GitHub Actions executa `tests/fluxo-integrado-v1-3.cjs` em conjunto com os testes existentes de clientes, fornecedores, SketchUp, Excel, lista de peças, estoque, financeiro, recibos, backup, Drive simulado e diagnóstico local.

O teste integrado cobre:
- preenchimento da proposta a partir do projeto;
- tentativa de falha no salvamento de orçamento;
- conversão no mesmo número, mantendo o projeto;
- parcelas financeiras sem duplicação;
- falha simulada ao iniciar produção sem baixa de estoque;
- baixa física única de 1,125 unidade;
- falha e sucesso no registro de recebimento;
- proteção do número sequencial ao duplicar orçamento;
- bloqueio de exclusão de projeto vinculado;
- rejeição de valores inválidos.

**Limite dos testes:** o navegador, a conta Google e o banco Supabase reais não foram controlados pelo teste automatizado. As provas validam o comportamento das funções com dados fictícios e simulações, não asseguram integração pronta para produção multiusuário.

## Roteiro de aceite em navegador

1. Abra `https://universautil-del.github.io/oficina-marcenaria/preview-v1/#projetos`.
2. Crie um cliente fictício, um projeto fictício e vincule o cliente.
3. Em Projetos, clique **Criar orçamento**. Confira descrição, valor e cliente. Salve e observe o projeto associado na lista de orçamentos.
4. Converta o orçamento em pedido. Confirme que **o número não mudou** e que a receita total corresponde à soma das parcelas.
5. Registre uma matéria-prima de teste, uma entrada de materiais do fornecedor e confirme o recebimento **uma vez**.
6. Monte um pedido fictício com essa matéria-prima e acompanhe reserva e baixa no início da produção; a quantidade de estoque deve mudar somente uma vez.
7. No financeiro, registre recebimento parcial e depois o saldo; confira os recibos e a quitação.
8. Vá a **Segurança e confiabilidade**; execute o diagnóstico local.
9. Crie um backup criptografado, coloque-o em pasta privada no Google Drive, baixe-o novamente e use **Verificar arquivo**. A verificação não altera registros.

## Bloqueios para retirar a homologação

1. **Login obrigatório** e isolamento de dados em todos os dispositivos. O GitHub Pages público não protege o modo local sem autenticação.
2. **Banco de dados transacional** para numeração, baixa de estoque, parcelas e estornos em uso simultâneo. O modo atual é `localStorage` e, opcionalmente, um documento JSON por conta no Supabase.
3. Testar **RLS real com duas contas** no Supabase.
4. Testar recuperação completa dos backups, inclusive documentos/anexos, em ambiente separado.
5. Configurar e testar com o proprietário o **OAuth Client ID** do Google Drive para envio direto (o backup manual criptografado já está disponível).

Não retirar o aviso de homologação nem introduzir dados comerciais reais antes da validação desses pontos. **A atualização é funcional para homologação e demonstração, não uma certificação de produção.**
