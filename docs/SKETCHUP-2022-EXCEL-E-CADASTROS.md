# Universalartes — SketchUp 2022 e Excel

O módulo **Calcular SketchUp** da prévia Universalartes 1.0 agora aceita **.xlsx**, **.csv** e **.txt**.

## Para exportar do SketchUp 2022
1. Abra o projeto no SketchUp 2022.
2. No **OpenCutList** (extensão gratuita), gere a lista de peças do projeto.
3. Escolha **Exportar** e salve como **Excel (.xlsx)** ou **CSV**. Se sua versão do OpenCutList não mostrar XLSX, atualize a extensão ou utilize CSV.
4. Confira se as peças estão agrupadas corretamente, em **milímetros**, e contêm nome, comprimento, largura, espessura, quantidade e material.
5. No sistema Universalartes, abra **Calcular SketchUp**, selecione o arquivo e, se houver várias abas no Excel, escolha a aba de peças.
6. Confira a correspondência das colunas e clique em **Ler peças e calcular**. Digite o preço real das chapas, fita, ferragens e mão de obra antes de usar o preço indicativo.

## Sobre o arquivo nativo .skp

O sistema **não interpreta o arquivo .skp diretamente**. A exportação de componentes para XLSX/CSV é uma integração de dados geométricos organizados; ela não equivale à leitura de toda a geometria 3D. Leitura direta do .skp exigiria um plugin no SketchUp, integração Ruby/SDK ou servidor especializado.

## Segurança e limitações

- O arquivo é lido no navegador, sem upload pelo módulo.
- Ao escolher um arquivo Excel, o navegador carrega **ExcelJS 4.4.0** por HTTPS do cdnjs.cloudflare.com. Se o leitor não carregar, use CSV.
- Aceita XLSX de até 3 MB e até 5.000 linhas por aba; a primeira aba com peças será sugerida. Formatos antigos .xls e planilhas protegidas não estão disponíveis.
- O importador não executa fórmulas e rejeita fórmulas sem resultado salvo; não converta o arquivo recebido em dados comerciais sem conferir.
- A quantidade de chapas é **estimativa por área**, não plano de corte otimizado (não considera orientação do veio, perda geométrica ou espessura da serra).
- Sem baixa automática de estoque ou criação automática de pedidos.
- Faça testes com arquivos fictícios até concluir a validação de login e banco de dados.

## Alteração de cadastro de produtos

O formulário passou a usar duas colunas no computador, campos em uma coluna no celular, cabeçalho/rodapé compacto, tipo de produto selecionável na criação, unidades e campo de observações. Produtos já existentes mantêm seus dados e **não podem ter seu tipo alterado** pela edição comum.

## Fontes

- OpenCutList: https://docs.opencutlist.org/features/parts/export-to-csv
- OpenCutList versão 7: https://docs.opencutlist.org/whats-new/in-version-7.0
- SketchUp — geração de relatórios: https://help.sketchup.com/en/sketchup/generating-attribute-report
