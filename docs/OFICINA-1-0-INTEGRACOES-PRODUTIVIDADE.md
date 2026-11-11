# OFICINA 1.0 — Integrações de produtividade — 11/11/2026

## Objetivo
Reduzir repetição de cadastros, erros de digitação e lançamentos duplicados. Usar cliente, projeto, lista SketchUp, orçamento, pedido, entrada de materiais, estoque e financeiro já cadastrados na mesma conta Supabase.

## 1. SketchUp 2022/OpenCutList → Projeto → Materiais → Orçamento
1. Em **Importar SketchUp**, selecione o CSV/XLSX do OpenCutList e vincule-o ao projeto de móveis. A lista fica vinculada ao projeto (sem baixar estoque).
2. Em **Projetos de móveis**, use **Conferir materiais**. A tela consolida por material + espessura em mm:
   - quantidade de peças;
   - área bruta em m², calculada por comprimento × largura × quantidade;
   - total de fita em metros com base no campo explicitamente exportado de fita por peça;
   - quais materiais têm nome idêntico a um produto no cadastro e quais exigem conferência.
3. Use **Abrir no assistente** para reutilizar o mesmo projeto, cliente e suas medidas. O Assistente pode preparar instruções e script Ruby SketchUp 2022, mas não exporta `.skp` nativo.
4. **Preparar orçamento deste projeto** abre orçamento com cliente, projeto, descrição, resumo da lista e estimativa A, se cadastrada. O usuário revisa preços, condições, quantidade de chapas e perdas antes de salvar.
5. O orçamento aprovado converte-se em pedido pelo fluxo já existente, preservando vínculo e controle financeiro. O cadastro não é repetido.

**Limite técnico:** a lista de peças isolada não informa o tamanho das chapas em estoque, o plano de corte, perdas, direção do veio ou quantidade das ferragens. O Oficina NÃO afirma que a área bruta é uma quantidade definitiva de chapas, nem gera baixa de estoque ao visualizar uma lista de peças. Ferragens devem ser especificadas e conferidas.

## 2. Estoque mínimo → sugestão de compra → Entrada de Materiais
1. Em **Produtos** ou **Entrada de Materiais**, clique **Sugestão de compra**.
2. A tela identifica matérias-primas com estoque igual ou inferior ao mínimo; desconta quantidades de entradas **abertas** que já estão aguardando recebimento; materiais já cobertos não são sugeridos novamente.
3. Confirme itens e quantidades. O botão **Revisar entrada de materiais** abre o cadastro existente de entrada, com as linhas pré-preenchidas e fornecedor para escolher.
4. Uma conta a pagar só é criada quando o usuário confirma a nova entrada em Salvar. O estoque só aumenta na ação **Confirmar entrada**, uma única vez.
5. Itens sem custo positivo precisam ter seu cadastro corrigido antes de gerar sugestão. Não há compras automáticas a fornecedores.

## 3. Pedidos → avisos e financeiro
- A **Central de integrações** na Dashboard lista pedidos com entrega nos próximos 7 dias ou atrasados e contas a pagar/receber vencidas ou vencendo em 7 dias. Cada uma usa os dados reais de Pedidos e Financeiro sem copiar registros.
- **WhatsApp** abre uma mensagem rascunho sobre o pedido ao número cadastrado do cliente, para conferir e enviar manualmente. Não há envio automático, envio em massa ou mensagem agendada.
- Os alertas são exibidos ao abrir o site; não são notificações fora do navegador.

## 4. Segurança, testes e preservação
- O addon é somente leitura até que o usuário use os formulários existentes de projeto, orçamento e entrada de materiais.
- A lista de peças e as sugestões não afetam diretamente estoque, saldos ou movimentações. Os testes automatizados verificam que os dados permanecem inalterados após consultar sugestões e abrir rascunhos.
- Nenhuma tabela SQL nova, credencial privada ou alteração automática no banco de produção foi necessária.
- Suíte GitHub Actions: `tests/integracoes-produtividade-1-0.cjs`, além da regressão do fluxo de projeto/orçamento/pedido, entradas, estoque e financeiro.
- Na homologação manual, primeiro teste com dados fictícios, depois confirme a sincronização no PC e celular, e mantenha os backups semanais e criptografados.

## Melhorias futuras possíveis
- Fichas de material com formato e dimensão exatos da chapa (mm), custo por chapa e perdas configuráveis, permitindo uma estimativa de chapas a **validar por plano de corte**.
- Ferragens da composição por módulo/gaveta/porta, com conferência do projetista antes de gerar necessidades.
- Alertas e tarefas opcionais externos ao navegador (exigirão autorização/serviço próprio).
