# UNIVERSALARTES — OFICINA 1.0

**Status:** escopo aprovado como proposta técnica, em desenvolvimento na branch `universalartes-v1`; **não é produção pronta**.

**Empresa:** Universalartes. **Produto:** Oficina — Gestão de Marcenaria.
**Foco:** marcenaria de móveis sob medida; uso real pelo marceneiro no computador, tablet e celular.
**Identidade:** verde floresta, branco quente, tons amadeirados; linguagem simples, medidas em milímetros, BRL e DD/MM/AAAA.

## 1. Problema a resolver
O marceneiro tem informações espalhadas entre WhatsApp, fotos, cadernos e planilhas. O sistema deve acompanhar uma obra completa, do primeiro contato ao recebimento final, evitando digitação repetida, atrasos, desperdícios, baixas duplicadas e esquecimento de parcelas.

### Jornada central
**Cliente → Visita/medição → Projeto por ambiente → Orçamento → Aprovação/contrato → Pedido → Ordem de produção → Corte/fita/furação/montagem → Instalação → Entrega → Recebimento.**

Um **ID da obra** liga documentos, ambientes, medidas, arquivos, pedidos e contas. O pedido convertido pode conservar o número do orçamento; cada documento deve ter identificador próprio e vincular a mesma obra.

## 2. Funcionalidades por prioridade

### P0 — base obrigatória para uso real
- Supabase Auth + banco relacional PostgreSQL **separado por empresa** com políticas RLS, não um JSON único por usuário.
- Usuários com papéis: proprietário/administrador, atendimento/comercial, projetista, produção, financeiro. Restrições validadas no backend e RLS; não apenas ocultar botões.
- Modelos principais: empresas, usuários/perfis, clientes, obras, ambientes, medições, anexos, projetos, orçamentos/itens, pedidos/itens, ordens_producao/etapas, produtos, materiais, composições, movimentos_estoque, reservas, fornecedores, compras, parcelas, pagamentos, despesas, documentos, auditoria.
- IDs estáveis, timestamps, integridade referencial, histórico de mudanças e migrações.
- Transações/idempotência: aprovar orçamento/pedido, gerar parcelas, consumir ou estornar materiais, receber compras, registrar pagamento. Executar no banco, não apenas no navegador.
- Backup com restauração testada + importação do JSON histórico sem apagar originais; migração com prévia, validação, log e confirmação.
- Armazenamento de fotos e PDFs em bucket privado, com URLs temporárias/autorização.

### P1 — fluxo do marceneiro
- **Painel de hoje:** medições agendadas, entregas em 7 dias, pedidos atrasados, materiais faltantes, contas vencidas e próximos passos por obra.
- **Ficha da obra:** cliente, ambientes, endereço de instalação, fotos, desenhos, medidas, revisões, orçamento, contrato, materiais, cronograma, custos e recebimentos; atalhos sem redigitação.
- **Medição:** largura/altura/profundidade em mm, pontos elétricos/hidráulicos, interferências, esquadro, rodapés, observações, fotos e checklist.
- **Projetos:** ambientes, desenhos/fotos por versão, material/acabamento, estado de aprovação, revisão do cliente, exportação de lista de peças.
- **Orçamento por ambiente:** custo de MDF, fitas, ferragens, pintura, terceirização, mão de obra, transporte e instalação; margem, desconto, frete, tributos configuráveis e lucro previsto; PDF/WhatsApp.
- **Produção:** ordem imprimível por pedido com peças, materiais, dimensões, quantidade, fita de borda, checklist, responsável, prazo e etapas medição/projeto/corte/fita/furação/montagem/acabamento/instalação.
- **Estoque:** matérias-primas por unidade (chapa, m², metro, un), quantidade por composição, reserva, consumo, retalhos reaproveitáveis, compra sugerida e histórico; prevenir saldo negativo/dedução em duplicidade.
- **Financeiro:** entrada + parcelas, vencimento, forma de pagamento, recebimento parcial, contas a pagar/receber, custo e margem por obra, fluxo de caixa; recibo para pagamento parcial e quitação final apenas com saldo zero.
- **Documentos:** proposta, contrato editável sujeito a revisão, ordem de produção, comprovantes, termos de entrega e recibos. Logo e assinatura da Universalartes.

### P2 — expansão
- Plano de corte com otimização de chapas e aproveitamento de retalhos (algoritmo validado por medidas, espessura, sentido do veio, sangria da serra).
- Portal do cliente com aprovação de revisões e acompanhamento, mediante autenticação/links de acesso limitados.
- Integração de NF-e com serviço fiscal autorizado: XML local pode ser lido mas **não** implica validação/autorização na SEFAZ.
- PWA/offline com sincronização granular e resolução de conflitos por registro, evitando perda de dados.

## 3. Como deve ser a interface
Menu por processo: **Hoje**, **Clientes e visitas**, **Obras e projetos**, **Orçamentos**, **Pedidos**, **Produção**, **Materiais/Estoque**, **Compras/Fornecedores**, **Financeiro**, **Documentos**, **Relatórios**, **Minha Empresa**.
Conversor de medidas como ferramenta rápida; Notas fiscais em Documentos/Financeiro.
Cada obra terá timeline e cinco abas: Visão geral, Ambientes/medidas, Materiais, Financeiro, Arquivos.
Em celular, botões grandes: Registrar medição, Fotografar, Atualizar etapa, Material em falta e Receber pagamento.

## 4. Avaliação do legado 0.6
- Código estático HTML/CSS/JS com muitos recursos funcionais de teste.
- `localStorage` conserva registros; camada opcional Supabase sincroniza **um único JSON por usuário**, sem equipes ou transações em banco; não é suficiente para edição concorrente multiusuário.
- PDFs por impressão do navegador; anexos pequenos no armazenamento local; XML é importação local sem SEFAZ.
- Mudanças de estoque e financeiro são operações JavaScript locais.
- Preservar site atual em `main` até nova infraestrutura, migração e testes estarem prontos; manter backups.

## 5. Critérios de aceite da versão 1.0
1. Dois usuários autorizados da Universalartes acessam as mesmas obras sem visualizar dados de outras empresas.
2. Cliente → medição → projeto → orçamento → pedido → ordem de produção sem reentrar dados desnecessariamente.
3. Uma confirmação gera parcelas **uma vez** mesmo após reenvio, falha ou clique repetido.
4. Reserva/consumo/estorno deixam estoque consistente em cenários concorrentes; compra recebida não duplica entrada.
5. PDFs exibem logo da empresa, cliente, ambiente, medidas, itens, valores e condições corretos.
6. Alertas mostram os verdadeiros atrasos, vencimentos e materiais faltantes.
7. Importação de JSON v0.3–v0.6 realiza prévia, validação e rollback, e nenhum dado é apagado automaticamente.
8. Login, RLS, anexos privados, backups e recuperação testados em ambiente real, com testes de acesso indevido.
9. Layout funciona em desktop e celular.
10. Não usar dados de clientes reais antes dos testes de segurança.

## 6. Execução
- **Marco A (identidade e descoberta):** marca Universalartes, painel diário, mapa de navegação e modelo do fluxo, em branch isolada.
- **Marco B (infraestrutura):** esquema SQL normalizado, autenticação multiusuário, RLS, storage privado e scripts de migração testados.
- **Marco C (operações):** fichas de obra, medições, orçamentos, pedidos, produção e estoque integrado.
- **Marco D (fechamento):** financeiro, documentos, relatórios, auditoria e aceite em ambiente de teste.
- **Publicar em `main` apenas após validação.**

## 7. Dependências
Um projeto Supabase real e configurado pelo proprietário é necessário para validar integração e segurança; URL e chave pública podem ficar na configuração do app, mas credenciais secretas nunca entram no GitHub. Consultar custos e quotas dos provedores na contratação.

---
*Documento de planejamento; nenhuma cláusula, função fiscal ou acesso autenticado é considerado implementado apenas por constar aqui.*
