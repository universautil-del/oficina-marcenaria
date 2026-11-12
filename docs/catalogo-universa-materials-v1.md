# Catálogo de Materiais UNIVERSA ART — integração com OFICINA

Atualizado em 12/11/2026.

## Planilha de origem

`UNIVERSA_ART_Catalogo_Materiais_Expandido_MDF_2026.xlsx` (arquivo enviado pelo usuário).

- Aba **Catálogo**: **122** itens, códigos `MAT-001` a `MAT-122`.
- Aba **Padrões MDF 2026**: **96** referências, códigos `MDF-P001` a `MDF-P096`.
- Total no site: **218** referências de materiais.
- Os **128 registros MDF** incluem **32 combinações iniciais** e **96 referências da aba de padrões**. Dessas 96, **89 padrões Guararapes ainda não têm espessura e dimensões confirmadas**; os outros sete têm dados técnicos Arauco preenchidos na planilha.
- Categorias: MDF (128), outras chapas (11), parafusos (16), buchas (7), fitas (16), ferragens (40).

## Fonte e arquivos do sistema

`preview-v1/catalogo-universa-dados-v1.js` contém os dados do Excel, em arrays compactos, e só é carregado na primeira abertura do catálogo. O formulário, filtros e simulador estão em `preview-v1/catalogo-universa-v1.js`, com estilo `preview-v1/catalogo-universa-v1.css`.

O catálogo antigo da Léo Madeiras não é carregado pelas páginas `preview-v1/index.html` e `preview-v1/seguro.html`. Os botões em Projetos de móveis, Assistente de projetos e Produtos foram substituídos pelo **Catálogo UNIVERSA ART**.

## Cuidados importantes

- Referência comercial **independente do estoque**. Consultar ou escolher um material **não** reserva ou cria saldo.
- Nenhum dos 218 registros tem preço preenchido na planilha; todos permanecem **A cotar**. O simulador permite digitar preço manual, mas **não atualiza o custo nem o estoque**.
- A escolha de um padrão sem espessura confirmada **não** preenche dimensões automaticamente.
- Apenas referências que trazem fonte oficial na planilha exibem link **Fonte do fabricante** (Guararapes/Arauco). Não há links individuais da Léo.
- Este arquivo JS é um **retrato da planilha** no momento da integração. Edições futuras do Excel **não** alteram o site até que os dados sejam importados e publicados novamente.
- O código gerado não contém clientes, pagamentos nem valores de estoque; contém apenas referências genéricas de material da planilha.

## Desempenho e verificação

Lista compacta, carregada sob demanda, com visualização de 20 itens inicialmente e filtros locais. O teste `tests/catalogo-universa-v1.cjs` confere as 218 referências, categorias, links, custos ausentes, seleção nos formulários e isolamento dos dados do OFICINA.
