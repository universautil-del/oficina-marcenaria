# OFICINA — UNIVERSA ART | Plano da versão 1.1

**Estado:** planejamento e preparação de homologação. **Base:** `main` no commit `30494354abbf677b6a1752c80fb271b11b9fad1b` (12/11/2026).  
**Ramo de trabalho:** `develop/v1.1`. **Produção:** nenhuma alteração autorizada por este plano.

## 1. Objetivo e proteção do que já funciona

Preparar a OFICINA 1.1 mantendo a versão atual de uso diário intacta. A implementação e a homologação serão feitas somente no ramo `develop/v1.1`. Nenhum PR para `main` será mesclado sem aprovação explícita.

**Ambiente local de testes:** `preview-v1/dev-v1.1.html` (somente neste ramo). A página:
- mostra identificação evidente **OFICINA 1.1 — DESENVOLVIMENTO**;
- define `UNIVERSA_DEV_V11=true` antes dos scripts;
- usa a chave local `universa-art-oficina-dev-1-1-dados` (diferente da versão principal);
- **não carrega** configuração pública da nuvem nem módulo de sincronização Supabase;
- aplica CSP com `connect-src 'none'` para bloquear requisições do navegador, inclusive conexões a bancos;
- inicia sem cadastro de clientes ou pedidos reais.

O módulo `cloud-preview.js` também contém uma proteção que impede a inicialização caso o modo 1.1 de testes esteja ativo, mesmo que seja incluído por engano.

**Limites de segurança:** o repositório GitHub é público; código e exemplos no ramo são visíveis. Não colocar chaves privadas, senhas, comprovantes, backups, nomes de clientes reais ou outros dados sensíveis neste ramo ou nos artefatos de CI. O banco Supabase de produção **não será usado** para homologação. A preparação de um projeto Supabase de testes separado será uma etapa futura, sujeita a aprovação e configuração de credenciais próprias. A proteção de branch `main` ainda precisa ser habilitada via regras do repositório (GitHub Settings → Rules → Rulesets), pois a API de controle disponível para esta etapa não configurou regras de branch.

## 2. Execução local — sem publicar nada

1. Obter uma cópia do repositório e selecionar o ramo: `git switch develop/v1.1`.
2. Na pasta principal do repositório, executar `python -m http.server 8080` (ou `python3 -m http.server 8080`).
3. Abrir `http://localhost:8080/preview-v1/dev-v1.1.html` no navegador.
4. Conferir o aviso de ambiente de testes e criar **somente dados fictícios**.
5. Nunca entrar no Supabase de produção, importar backups reais, nem publicar o ambiente de testes no domínio da produção.

A página 1.1 não foi adicionada à branch `main`; portanto, não fica disponível no GitHub Pages existente. O pacote de homologação, quando gerado pelo CI do ramo, deverá continuar disponível apenas como artefato para execução local — não como um site público compartilhando origem com produção.

## 3. Entregas priorizadas

| Ordem | Pacote | Escopo 1.1 | Critérios de aceite |
| --- | --- | --- | --- |
| 0 | Isolamento e baseline | Ramo, página local, dados fictícios, não sincronizar, teste de regressão | Nenhum acesso a Supabase; chaves de dados diferentes; `main` intacta |
| 1 | Dashboard inteligente | Cards de atrasos, contas vencidas, pedidos em aberto, entregas nos próximos 7 dias, estoque mínimo; links para telas existentes | Totais batem com Financeiro, Pedidos e Estoque; não alteram saldos |
| 2 | Agenda de produção | Calendário e lista de eventos de medição, corte, montagem, instalação e entrega; filtro por período e pedido/projeto | Eventos editáveis sem alterar automaticamente status do pedido; validação de data e vínculos |
| 3 | Histórico de alterações | Registrar tipo de ação, data/hora, entidade, ID, campos modificados e responsável quando disponível | Edição, cancelamento, pagamento, estorno e mudança de status documentados; não registrar senhas/tokens; falhas não geram eventos falsos |
| 4 | Duplicar projetos e pedidos | Criar novo registro a partir de existente com novo ID/código, campos úteis e revisão obrigatória | Pedido duplicado nasce **Em aberto**, sem pagamentos, reservas, baixas ou documentos financeiros herdados; projeto conserva somente elementos aprovados |
| 5 | Relatórios gerenciais | Pedidos por status, cumprimento de prazos, produtividade, faturamento e pendências, com período e Excel | Filtros reproduzíveis, totais coerentes e planilhas reais; sem dobrar receitas ou contar pedidos cancelados como vendidos |
| 6 | Homologação e liberação | Testes, correções, documentação, backup verificável e aprovação formal | Sem regressão; aprovação explícita; só então PR da 1.1 para `main` |

### Dashboard: regras de cálculo

- Contas vencidas: lançamentos cujo `dueDate` é anterior à data corrente e `balance(t)>0`.
- Pedidos em aberto: status `aberto`, separados dos estados `confirmado`, `producao`, `pronto` e `entregue`.
- Próximas entregas: pedidos não cancelados/não entregues, com `entregaData` nos próximos 7 dias.
- Estoque mínimo: materiais com estoque igual ou inferior ao mínimo, sem alterar movimentos.
- Não duplicar os valores de parcelas de pedidos nem usar uma compra como recebimento de caixa.

### Agenda: modelo inicial proposto

`agendaEvents[]` em documento versionado: `id`, `tipo`, `titulo`, `inicio`, `fim`, `orderId?`, `projectId?`, `responsavel?`, `status`, `observacoes`, `createdAt`, `updatedAt`. Usar fuso de São Paulo no formulário e serialização de data consistente. Nunca alterar pedidos automaticamente a partir de um evento sem confirmação explícita.

### Histórico: modelo inicial proposto

`auditEvents[]`: `id`, `timestamp`, `actorId?`, `entidade`, `entidadeId`, `acao`, `antes`, `depois`, `origem`. Apenas campos relevantes e seguros, sem CPF completo, credenciais, chaves, anexos ou dados privados desnecessários. Atualizar a entidade e o evento na **mesma operação de salvamento**. Garantir compatibilidade com backups `version:3` e com históricos financeiros existentes. Em armazenamento local, o histórico é operacional e **não é prova antifraude**; auditoria à prova de alterações exige suporte e políticas no servidor.

### Duplicação: proteções obrigatórias

- Novos IDs/códigos sem reutilizar a origem.
- Pedido duplicado com status `aberto` e `stockState:'pendente'`.
- Não copiar `transactions`, `payments`, `stockMovements`, `orderAttachments`, recibos, assinaturas ou vínculo de NF-e.
- Verificar cliente, condições, preço, medidas e prazo antes de salvar.
- Projeto duplicado deve manter medidas como preliminares até aprovação técnica.

## 4. Estratégia de testes e homologação

**Em cada pacote:** teste unitário, teste de integração, teste com dados fictícios e revisão visual em desktop e celular. Reutilizar a suíte do repositório (pedido → financeiro → estoque, SketchUp, NF-e, XML, backups, autenticação simulada, XLSX).

**Cenários obrigatórios:**
- criação, edição e exclusão de evento na agenda;
- pedido duplicado sem recebimento e sem baixa de estoque;
- alteração de parcela gerando um único registro de histórico;
- recálculo de cards após recebimento parcial, estorno e cancelamento;
- relatórios Excel com campos numéricos, datas e filtros corretos;
- falha de gravação com rollback; sem duplicações de dados;
- restauração de backup **de teste**, nunca de dados de clientes;
- abertura de página DEV sem sessão, token ou URL de Supabase;
- confirmação de que o site atual permanece idêntico.

**Portões de aprovação:**
1. Desenvolvimento: suíte de CI verde, nenhum segredo, dados fictícios.
2. Homologação: checklist de 5 módulos, pelo menos um cenário completo por módulo e revisão visual.
3. Backup: exportação/restauração controlada no ambiente próprio, integridade do documento validada.
4. Implantação: revisão do diff e aprovação explícita para mesclar na principal.
5. Pós-publicação: smoke test do login e das operações críticas; procedimento de rollback documentado.

## 5. Política de publicação e versionamento

- `main`: versão atual, sem mudanças durante a preparação da 1.1.
- `develop/v1.1`: evolução e testes.
- `feature/v1.1-<funcionalidade>`: opcionais para cada entrega; integrar primeiro na `develop/v1.1`.
- `v1.1.0-rc1`: candidato de homologação depois dos módulos prontos.
- `v1.1.0`: versão liberada somente após aprovação.
- `v1.1.1`, `v1.1.2`: correções pequenas após a primeira liberação, com testes.

**Não atualizar automaticamente o GitHub Pages da produção nem copiar dados reais para a homologação.** A existência do ramo de desenvolvimento não constitui publicação ou proteção de acesso por login. Para um endereço de testes online protegido será necessário hospedar uma implantação separada com autenticação, HTTPS, domínio/origem própria e banco isolado; isso não está ativado nesta etapa.

## 6. Decisões pendentes para liberar a implementação

- Validar a prioridade e a ordem dos cinco módulos.
- Ativar proteção de `main` no GitHub: PR obrigatório, testes aprovados e evitar pushes diretos.
- Escolher, quando necessário, hospedagem exclusiva da homologação e projeto Supabase exclusivo de testes.
- Aprovar o esquema dos eventos e do histórico, garantindo compatibilidade com backups antigos.
- Definir o protocolo formal de aprovação antes de qualquer mesclagem em produção.

**Situação ao concluir esta fase:** código da 1.1 preparado apenas em `develop/v1.1`; ambiente local isolado; **nenhuma funcionalidade 1.1 implantada na produção**.
