# Universalartes — Cadastro compacto de Clientes e Fornecedores

## Mudanças na prévia 1.0
- Layout **igual ao padrão de Produtos**, com duas colunas no computador e uma no celular.
- Título, botão **X**, formulário com espaços reduzidos e botões de Cancelar e Salvar fixos na base do diálogo.
- Campos mantidos: nome, documento, telefone, email, cidade, endereço, observações.
- Campos adicionais de Clientes: tipo de pessoa, IE, WhatsApp, contato, CEP, UF, bairro, número e complemento.
- Fornecedores: os mesmos campos, com categoria principal, prazo de entrega, condições de pagamento, site e favorito.
- CPF, CNPJ, telefone e CEP recebem máscaras; CPF/CNPJ novos têm validação de dígitos e documentos duplicados são recusados dentro do respectivo cadastro.
- Mudança no nome do cliente continua refletindo em orçamentos/pedidos; no fornecedor, em compras.
- Campos opcionais antigos e identificadores internos são preservados na edição, sem redefinir o banco.

## Limitações e segurança
- As novas informações continuam usando o armazenamento de testes da prévia, não um banco multiusuário seguro.
- O CPF/CNPJ não é consultado em bases governamentais; a checagem é apenas matemática e de formato.
- O CEP é mascarado mas não consulta endereço automaticamente. Cidade/UF e demais informações devem ser conferidas pelo usuário.
- Evite cadastrar dados pessoais reais até o login, RLS e recuperação de backups serem validados com o Supabase.
- Não há alteração nos formulários do site principal (0.6) nesta atualização.

## Testes
Execute `node tests/compact-entities-v1.cjs` para verificar preenchimento, criação, edição, validação e preservação dos vínculos. O workflow também testa SketchUp, Excel, backups e scripts anteriores.

Atualização no endereço da prévia: `https://universautil-del.github.io/oficina-marcenaria/preview-v1/`
