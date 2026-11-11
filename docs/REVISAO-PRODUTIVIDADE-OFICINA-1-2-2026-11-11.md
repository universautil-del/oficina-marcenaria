# OFICINA 1.2 — revisão de produtividade e integridade · 11/11/2026

Escopo: versão `preview-v1`; uma pessoa acessa a mesma conta no computador e no celular. Revisão de código e testes automatizados; **não é uma homologação completa com banco/Google reais nem com aparelhos físicos**.

## Dez verificações de fluxo

| Área | Revisão e melhoria | Situação |
|---|---|---|
| 1. Cliente → orçamento | Cadastro rápido no próprio formulário, novo cliente automaticamente selecionado sem perder itens em preenchimento | Implementado; validar manualmente os dois diálogos |
| 2. Cliente → pedido | Mesmo cadastro rápido; lista de clientes ordenada; seleção explícita evita lançar ao primeiro cliente incorreto | Implementado; validar manualmente |
| 3. Agenda de cadastros → documento | Botões **Orçamento** e **Pedido** para cliente existente com vínculo preenchido | Implementado; teste automatizado |
| 4. Identificador de documento | ORC-ANO-001 e PED-ANO-001 com contador anual separado; números internos existentes preservados; duplicação recebe novo ORC | Implementado; teste automatizado |
| 5. Projeto → orçamento | Projeto, ambiente, cliente e estimativa pré-preenchidos; conferência obrigatória dos valores antes da aprovação | Fluxo existente; teste automatizado |
| 6. Orçamento → pedido | Cliente/itens/pagamento/projeto reaproveitados, financeiro criado uma vez; impedir reconversão | Fluxo existente; teste automatizado |
| 7. Pedido → produção/estoque | Reserva e baixa na etapa correta; impedir dupla baixa e reverter estado quando salvar falha | Fluxo existente; teste automatizado |
| 8. Entrada de materiais → estoque/financeiro | Uma entrada cria conta a pagar, e o estoque só muda no recebimento; bloqueio de material repetido e rollback | Fluxo existente; teste automatizado |
| 9. Pedido → contrato/recibo/WhatsApp | Código de controle exibido em documento, cobrança, confirmação, detalhes e mensagem comercial; recebimentos vinculados ao pedido | Integração melhorada; conferir impressões no navegador |
| 10. PC ↔ celular, backup e tela pequena | Acesso com uma conta, verificação do estado ao voltar à aba, bloqueio em conflito, botões maiores na agenda em celular, import/export criptografado existente | Revisão de código; testes reais de sync/Drive pendentes |

## Achados que ainda impedem a liberação com dados reais

1. **Supabase:** ainda requer Project URL e chave pública, criação da conta única, execução do SQL seguro e teste real da política RLS e das RPCs em dois aparelhos. Não publicar senhas ou tokens privados no GitHub.
2. **Backup automático:** não está implementado. O GitHub público armazena código, **não** deve receber os dados de clientes em JSON simples. Configurar destino privado e criptografado e testar a restauração completa com dados fictícios antes da adoção. Google Drive OAuth real não foi homologado.
3. **Concorrência:** o servidor impede sobrescrever revisões já alteradas, mas não mescla edições simultâneas. Conferir **Sincronizado** antes de alternar PC e celular.
4. **Operação real:** testar criação/edição no Chrome para Windows e no navegador do celular, impressão/PDF, limites de armazenamento, perdas de conexão e anexos. Verificar segurança de sessão ao fechar a aba.
5. **Nomenclatura e documentação:** alguns módulos auxiliares ainda mostram números internos antigos. A conversão central passou a usar códigos ORC/PED, mas a adoção em relatórios legados deve ser concluída sem perder compatibilidade com históricos anteriores.

## Critério para concluir a homologação

- Nenhuma falha na suíte GitHub Actions `Validar Universa Art OFICINA 1.2`.
- Em ambiente de teste, criar cliente no orçamento, salvar, converter em pedido, receber pagamento, registrar entrada de materiais, produzir e emitir documentos **sem redigitar cadastros ou lançar valores em duplicidade**.
- Repetir o fluxo no celular, confirmar leitura sincronizada no PC e testar conflito deliberado sem perda de dados.
- Criar backup criptografado, restaurar em ambiente separado, comparar quantidades e valores. **Nunca testar restauração sobre dados comerciais sem cópia preventiva.**

## Notas técnicas

- Código atualizado em `preview-v1/script.js`, `upgrade.js`, `unified-contacts-v1.js`, `secure-access-v1.js`, `cloud-preview.js` e CSS.
- Casos automatizados acrescentados em `tests/fluxo-integrado-v1-3.cjs` e `tests/unified-contacts-v1.cjs`.
- `preview-v1/public-cloud-config.js` está deliberadamente sem credenciais; aceita **somente** parâmetros públicos após o proprietário fornecer a URL e a chave publicável.
