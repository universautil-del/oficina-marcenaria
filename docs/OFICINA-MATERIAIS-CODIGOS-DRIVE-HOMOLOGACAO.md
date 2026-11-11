# Universalartes — correções de Produtos, Entrada de Materiais e Google Drive

## Alterações implementadas

### Cadastro de Produtos

- Somente **matérias-primas** podem ser cadastradas. O botão `Produto acabado` e a seleção de tipo foram retirados do formulário.
- O campo **Código automático** é somente leitura e usa sequência progressiva **01, 02, ... 99, 100, ... 999**. O sistema impede duplicações e não consome o próximo código quando um salvamento falha.
- A sequência `db.seq.productCode` é persistida com os dados do navegador e preservada no backup. Códigos numéricos legados são respeitados; códigos antigos alfanuméricos **não são renumerados**.
- Ao chegar ao código 999, a criação é bloqueada com mensagem de limite (não volta para 01 automaticamente).
- Produtos acabados antigos não são excluídos do banco: permanecem para integridade de pedidos, orçamentos e backups. A tela não permite criar nem editar esse tipo.
- Cadastro compacto com código, unidade, descrição, estoque mínimo, custo, preço, saldo, categoria e observações.
- Produtos ligados a pedidos, compras, composições ou movimentos de estoque não podem ser excluídos, preservando auditoria.

### Entradas de materiais e estoque

- Confirmação de entrada de materiais exige que o lançamento ainda esteja `aberta`, com matéria-prima válida e quantidades positivas.
- Uma entrada confirmada não pode gerar nova movimentação de estoque.
- Quantidades de entrada preservam **três casas decimais**; custo médio é ponderado pelas quantidades.
- Se o `save()` local falha, saldo, custo, movimentos, status e contas financeiras são revertidos no navegador.
- Cancelamentos de entrada falhos também preservam status e contas a pagar.

### Google Drive

- O **modo manual** de backup criptografado continua funcionando sem Google Cloud: baixar `.uaenc.json`, enviar pelo site do Drive e usar o botão Verificar arquivo para conferir a senha sem restaurar.
- A tela de envio direto agora mostra **diagnóstico** (Client ID ausente, biblioteca Google não carregada, ID configurado aguardando autorização ou conectado).
- O campo explica que o exemplo não é uma credencial real.
- Botão **Copiar origem** facilita cadastrar `https://universautil-del.github.io` no Google Cloud.
- Erros de autorização indicam quando o usuário precisa verificar a origem OAuth, usuários de teste e a Drive API.
- O Drive continua usando o escopo limitado `https://www.googleapis.com/auth/drive.file`.

## Testes automatizados realizados

- `tests/product-excel-v1.cjs`: códigos de 01 a 999, formulário somente de matéria-prima, dados legados intactos, edição sem renumeração, limite de códigos, rollback no erro.
- `tests/entradas-seguras-v1-3.cjs`: entrada única, custo médio, quantidades fracionadas, reversão ao falhar salvamento de estoque/financeiro e cancelamento.
- `tests/drive-google-auth-v1-2.cjs`: fluxo OAuth simulado, verificação da origem OAuth, diagnóstico, listagem, envio criptografado e leitura após upload.
- A suíte anterior continua validando importação SketchUp/Excel, vínculo com projetos, backups, clientes, segurança de anexos, atualização financeira e consistência da versão 1.2.

**Limitação dos testes:** são automatizados e incluem serviços simulados. Não comprovam autorização de uma conta Google real, restauração do banco de produção, regras RLS aplicadas em Supabase real ou uso simultâneo de dois aparelhos.

## Como conferir a atualização

1. [Produtos](https://universautil-del.github.io/oficina-marcenaria/preview-v1/#produtos): clique **+ Nova matéria-prima**. Confira o código **01** no cadastro vazio (se não houver itens anteriores), salve o primeiro material de teste, e confira o próximo código **02**. O sistema não deve mostrar opção Produto acabado.
2. Crie dois materiais fictícios, depois entre em [Entrada de Materiais](https://universautil-del.github.io/oficina-marcenaria/preview-v1/#compras) e registre uma entrada com quantidades fracionadas. Confirme uma vez e verifique saldo/custo médio e conta a pagar.
3. Entre em [Backup Google Drive](https://universautil-del.github.io/oficina-marcenaria/preview-v1/#backupdrive). Faça backup criptografado e baixe o arquivo. Suba manualmente no Google Drive, baixe-o novamente e use **Verificar arquivo**, que não modifica os dados.
4. Se quiser **envio direto**, configure seu próprio OAuth Client ID. Abra o painel, use **Copiar origem**, crie as credenciais em [Google Cloud — Clientes OAuth](https://console.cloud.google.com/auth/clients), ative Drive API e conceda autorização. Sem isso, não há conexão direta válida.
5. Acesse **Segurança e confiabilidade** para verificar erros locais e conectividade opcional. Refaça os testes com uma segunda conta Supabase em um ambiente descartável.

## Bloqueadores da homologação comercial

**Este código não pode ser declarado 100% homologado para dados reais enquanto não forem concluídos os pontos abaixo:**

- Login obrigatório e proteção dos dados em todos os acessos. O GitHub Pages é estático e a versão atual ainda opera localmente sem autenticação obrigatória.
- Testes reais das regras **RLS** do Supabase com duas contas independentes e backup completo do banco.
- Transações atômicas no servidor para evitar colisões de números, saldos e parcelas em operações simultâneas. Hoje o navegador mantém um documento JSON local, com sincronização Supabase opcional.
- Testes reais de upload/download no Google Drive com **OAuth Client ID** pertencente à empresa e autorização de usuário.
- Recuperação completa dos dados, anexos e contratos a partir do backup em ambiente isolado.
- Conferência manual dos fluxos de cliente, orçamento, pedido, financeiro, estoque, documentos, importação SketchUp e telas responsivas.

Não expor `service_role`, `client_secret`, certificado A1, senhas nem tokens no repositório. Não alterar o banco da versão anterior do usuário nem apagar seus dados.

**Próximo marco:** configurar Supabase com login e RLS verificáveis, proteger operações de estoque e financeiro em servidor e executar os testes de aceite com os dados fictícios. Só então alterar o status do sistema para Produção.
