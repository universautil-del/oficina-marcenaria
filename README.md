# OFICINA — Gestão de Marcenaria v0.3

Site estático para GitHub Pages. **Versão de testes**, com dados mantidos em `localStorage`, sem login e sem banco de dados em nuvem. Não usar dados reais sensíveis antes de implementar autenticação e persistência segura.

## Funcionalidades

- Dashboard com indicadores derivados dos cadastros e pagamentos
- Clientes: cadastro, pesquisa, edição, exclusão com proteção a vínculos
- Produtos: matérias-primas, produtos acabados e composição de materiais
- Estoque: entradas, saídas, ajuste e histórico; reserva por pedido e baixa ao iniciar produção
- Orçamentos: itens, preços, desconto, impressão/PDF pelo navegador e conversão em pedidos
- Pedidos: confirmação, reserva, início da produção, pronto e entregue
- Financeiro: contas a receber geradas no pedido, contas manuais, parcelas, recebimentos parciais
- Documentos: contratos editáveis, pedidos e recibos com impressão/salvar PDF
- Minha Empresa: dados, logotipo e modelo de contrato
- Backup completo JSON, com migração automática dos clientes locais da versão 0.2

## Atualizar GitHub

Faça upload dos **quatro** arquivos deste pacote na raiz da branch `main`, substituindo arquivos existentes: `index.html`, `style.css`, `script.js`, `README.md`. GitHub Pages: Settings > Pages > Deploy from a branch > main > /(root). `index.html` usa parâmetros de versão para evitar cache antigo.

## Atenção

- Os dados não são sincronizados entre computadores ou navegadores.
- Se limpar os dados do navegador, poderá perder o trabalho. Exporte e guarde backups com frequência.
- Repositório público e GitHub Pages não são meios seguros para autenticação ou um banco de dados de clientes por si sós.
- Estoque: pedidos confirmados **reservam** materiais se houver disponibilidade. A baixa física ocorre ao iniciar produção. Pedidos sem disponibilidade ficam pendentes de reserva. Cancelamento após início da produção não está disponível nesta versão.
- Item livre / serviço não consome materiais automaticamente.
- PDFs são obtidos via **Imprimir > Salvar como PDF**. Contratos são modelos editáveis e requerem revisão jurídica.
- A versão 0.3 é um protótipo funcional local para testes, não um ERP pronto para produção com usuários concorrentes.
