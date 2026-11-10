# OFICINA — Gestão de Marcenaria v0.5

Sistema web para GitHub Pages. Esta versão busca aproximar o aplicativo da referência **Oficina Ademir Projetos**, conservando os módulos existentes e os cadastros locais da versão 0.3/0.4.

## Funcionalidades incluídas

- Dashboard com indicadores de orçamento, compras, pedidos, contas a pagar e receber, vencimentos, avisos e atalhos.
- Clientes com cadastro, edição e pesquisa.
- Orçamentos com itens, **ambientes, frete**, desconto, condições de pagamento e forma de pagamento. Impressão pelo navegador (Salvar como PDF) e compartilhamento de **resumo** por WhatsApp (o PDF deve ser anexado manualmente).
- Pedidos a partir do orçamento conservando **o mesmo número comercial** para novas operações; status de produção e entrega; contas a receber geradas ao confirmar, evitando geração em duplicidade.
- Financeiro com registro de pagamentos parciais, vencimentos, parcelas e exportação CSV.
- Produtos acabados e matérias-primas, composição, compras, estoque, reserva e baixa de insumos; a reversão de consumo após início de produção ainda exige processo próprio.
- Projetos de móveis com ambiente, dimensões em milímetros, materiais, acabamentos, fotografia compactada, etapas, checklist, alternativas A/B e exportação CSV. Visualizações em cartões, lista e quadro por etapas.
- Conversor de polegadas para milímetros, inclusive frações (`3/8`, `1 1/2`) e conversão inversa (aproximação em frações de 1/16).
- Notas fiscais: cadastro **manual** e leitura de dados essenciais de arquivo XML local de NF-e. **Não** transmite, emite, autoriza, valida na SEFAZ, recebe de SEFAZ ou verifica autenticidade fiscal.
- Documentos: orçamento, pedido e contrato-modelo editável para impressão/Salvar PDF; recibos de pagamentos registrados e **recibo de quitação integral** somente após pagamento completo do pedido. Anexos locais de PDF pequeno por pedido (limite de 150 KB).
- Minha empresa, modelo de contrato, logotipo e exportação/importação de backup JSON.
- Nova paleta verde, branco e tons de madeira, com layout responsivo.

## Limitações relevantes

**Esta ainda é uma demonstração local. Não utilize dados reais ou sensíveis de clientes, notas fiscais, contratos, documentos ou pagamentos.**

- A aplicação é hospedada gratuitamente em GitHub Pages e **não tem autenticação, servidor, banco de dados online, nem sincronização entre aparelhos**. Esses requisitos da referência exigem implementação e infraestrutura adicionais; não foram considerados concluídos.
- Todos os dados ficam em `localStorage` no navegador. Perda/limpeza do armazenamento pode apagar os registros; exporte backups periodicamente.
- Os anexos PDF e imagens são armazenados apenas no navegador, sem criptografia por usuário e sem backup em servidor. Para produção, migre anexos para armazenamento privado com controle de acesso, e o restante para banco de dados com políticas de segurança.
- **Contratos automáticos jurídicos** não foram implementados. O modelo atual é editável e preenche informações do pedido, mas deve ser revisado juridicamente; o recurso de anexo associa PDF já existente ao pedido.
- Recibos/contratos em PDF usam **Imprimir > Salvar como PDF**, não geram PDF pelo servidor.
- Integração com SEFAZ (importação de documentos autorizados, emissão e consulta) depende de credenciais, certificados e requisitos específicos externos.
- O fluxo de baixa de estoque de materiais ao iniciar produção é mantido; estorno de materiais já consumidos requer controle adicional, ainda não disponível.

## Publicação

Arquivos no diretório raiz de `main`:

- `index.html`
- `style.css` e `style-v04.css` (mantidos)
- `theme-v05.css` (novo)
- `upgrade.js` (mantido)
- `script.js` (atualizado)
- `features-v05.js` (novo)
- `README.md`

GitHub Pages: **Settings > Pages > Deploy from a branch > main > /(root)**.

O `index.html` tem parâmetros de versão para atualizar o cache e a ordem `upgrade.js` → `script.js` → `features-v05.js` deve ser preservada.

## Dados existentes

A aplicação mantém a chave `oficina-marcenaria-v03` e `data.version: 3`, adicionando apenas campos opcionais (`projects`, `invoices`, `orderAttachments`, `seq.project`, `seq.invoice`). Isto permite continuar utilizando os cadastros anteriores neste mesmo navegador sem apagar dados. O backup JSON também inclui as novas informações.

Antes de atualizar: abra **Minha Empresa > Exportar backup completo**, salve em um lugar seguro e teste a nova versão com dados fictícios. O branch `backup-v0.4-2026-11-10` conserva o estado anterior do código.

## Plano para acesso seguro em mais de um aparelho

Será necessário acrescentar um backend e banco de dados, por exemplo Supabase/PostgreSQL com autenticação e Row Level Security ou Cloudflare Workers/D1/R2. Para migração, definir usuários, organização/empresa, autorização por empresa, relacionamentos, trilhas de auditoria, anexos privados, backups automatizados, importação única dos dados locais e testes de segurança. **Nenhum login fictício foi criado.**