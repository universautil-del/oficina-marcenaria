# Universalartes 1.0 — Clientes e Fornecedores no mesmo módulo

## O que muda

A prévia 1.0 substitui **dois menus separados** (Clientes e Fornecedores) por **Clientes e Fornecedores**, que abre uma única tela com as abas **Todos**, **Clientes** e **Fornecedores**.

O botão **+ Novo cadastro** abre um único formulário compacto. Na parte superior, o marceneiro escolhe:
- **Cliente**: aparece nos orçamentos e pedidos.
- **Fornecedor**: aparece nas compras e recebimento de materiais.
- **Cliente e fornecedor**: o contato recebe dois papéis, compartilhando um identificador interno, sem duplicar a digitação.

Os campos comuns incluem nome, PF/PJ, CPF/CNPJ, telefone, WhatsApp, e-mail e endereço. Se a pessoa também for fornecedora, surgem categoria, prazo, condições de pagamento, site e favorito.

## Como os dados ficam

As coleções `db.clients` e `db.suppliers` permanecem separadas **internamente**, por compatibilidade com o restante do OFICINA. O sistema armazena o mesmo identificador e `cadastroCompartilhado: true` para contatos explicitamente cadastrados nos dois papéis.

- Os contatos antigos continuam aparecendo na lista.
- Dois contatos antigos com CPF/CNPJ igual **não são mesclados automaticamente** para evitar alterar os vínculos com pedidos e compras.
- É possível acrescentar a função de fornecedor a um cliente, ou a função de cliente a um fornecedor, desde que não gere CPF/CNPJ duplicado.
- Alterar um cadastro compartilhado atualiza ambos os papéis e os nomes que aparecem nos pedidos, orçamentos e compras.
- A exclusão de um papel segue as verificações de vínculos existentes da versão anterior.

## Navegação

- Caminho novo: `/preview-v1/#cadastros`
- Links antigos `#clientes` e `#fornecedores` continuam abrindo a tela unificada já filtrada.
- A versão principal 0.6 não é modificada nesta atualização.
- O estilo compacto de Produtos foi preservado nos demais formulários.

## Testes

`node tests/unified-contacts-v1.cjs` verifica menu único, filtros, cadastro duplo, edição, dados legados, vínculos com pedidos/compras, exclusão parcial e navegação.

**Ambiente de testes:** a prévia ainda usa armazenamento local e nuvem opcional não validada com um Supabase real. Evitar informações pessoais de clientes até concluir segurança e recuperação dos dados.
