# UNIVERSA ART · OFICINA 1.2 — Google Drive corrigido

## O que foi corrigido

- **Modo manual sem configuração:** a primeira opção da tela baixa um arquivo criptografado `.uaenc.json`. Em seguida, o usuário abre o Google Drive e faz upload do arquivo pelo próprio Drive. Não exige Google Cloud.
- **Modo direto opcional:** o campo de Client ID e a conexão OAuth ficam em seção expansível. Ao clicar **Conectar conta Google**, o sistema lê o Client ID digitado (não é obrigatório clicar em Salvar antes), abre o consentimento OAuth e consulta a Drive API para verificar a permissão.
- **Listagem de arquivos:** corrigido o parâmetro `pageSize=30` do Drive API v3 (a versão anterior usava `page_size`, que não é o parâmetro previsto).
- **Envio verificado:** após criar o backup criptografado na Drive API, o sistema baixa novamente os mesmos bytes e só anuncia confirmação se os conteúdos conferirem. Se houver falha de verificação, confira primeiro o Drive antes de tentar novo upload para não duplicar arquivos.
- **Senha:** a senha digitada não é persistida. Mantém-se apenas no campo atual durante a atualização visual da tela.
- **Verificar arquivo:** botão para escolher um `.uaenc.json`, informar a senha e testar sua leitura sem restaurar nenhum registro.
- **Restauração:** uma cópia preventiva do estado anterior também é criptografada. A versão anterior gerava o arquivo `Antes-da-restauracao-UniversaArt.json` sem criptografia; isso foi corrigido para `.uaenc.json`.

## Como fazer um backup **hoje**, sem Google Cloud

1. Abra `https://universautil-del.github.io/oficina-marcenaria/preview-v1/#backupdrive`.
2. Digite e guarde uma senha exclusiva para o backup com ao menos 12 caracteres.
3. Clique **1. Baixar backup criptografado**. Confira a presença do arquivo `UniversaArt_Backup_*.uaenc.json` em Downloads.
4. Clique **2. Abrir Google Drive e enviar o arquivo**. No Drive, use **Novo → Upload de arquivo** e escolha o arquivo que acabou de baixar. Você pode criar uma pasta privada `Universa Art / Backups`.
5. Para provar que consegue recuperar, baixe o arquivo do Drive e selecione-o em **Verificar ou restaurar um backup**. Clique em **Verificar arquivo (não altera dados)**. Confira a quantidade de clientes, pedidos e produtos.
6. Faça qualquer teste de restauração apenas com dados fictícios, de preferência em navegador/perfil separado. A ação de restaurar substitui os dados locais.

**Observação:** a exportação em JSON simples da tela Minha Empresa continua disponível por compatibilidade, mas não é criptografada; não a use com dados pessoais reais.

## Configurar o botão de envio direto

Esta etapa requer ação do proprietário no Google Cloud, porque **não existe um Client ID OAuth da sua empresa no repositório**:

1. Abra [Google Cloud Console — Credenciais](https://console.cloud.google.com/apis/credentials) e crie ou selecione um projeto de sua propriedade.
2. Ative a **Google Drive API** nesse projeto.
3. Configure a tela de consentimento OAuth e o escopo restrito aos arquivos do aplicativo: `https://www.googleapis.com/auth/drive.file`.
4. Crie um **OAuth Client ID** do tipo **Aplicativo Web**.
5. Nas origens JavaScript autorizadas, inclua **exatamente** `https://universautil-del.github.io`. É apenas a origem, sem `/oficina-marcenaria`.
6. Se o projeto OAuth estiver em modo de testes, adicione seu e-mail como usuário de teste.
7. Na tela `#backupdrive`, expanda **Opcional — conectar Google Drive e enviar direto**. Cole o **Client ID público** terminado em `.apps.googleusercontent.com`, autorize seu usuário e clique em **Salvar backup no Drive**.
8. Para conferir, clique em **Listar backups** e baixe uma cópia. Os arquivos ficam em Meu Drive e podem ser localizados procurando `UniversaArt_Backup_`.

**Nunca cole client secret, senha, refresh token ou service_role no GitHub nem no chat.** O Client ID é uma identificação pública e pode ser usado no navegador.

## Status real e limitações

- O código de criptografia, upload, leitura, listagem e recuperação foi **testado com simulação de OAuth e Drive API** nos GitHub Actions.
- **Não foi testado com uma conta Google real** nesta execução porque não há Client ID OAuth autorizado pela empresa nem autorização de usuário disponível.
- Backups diários automáticos continuam **não implementados**; um site estático no GitHub Pages não executa tarefas agendadas sem um serviço adicional.
- O funcionamento manual depende de o usuário conferir que o download foi concluído e enviar o arquivo ao Google Drive.
- A versão 1.2 continua em homologação: autenticação Supabase obrigatória, RLS real, isolamento de dados e transações críticas de estoque/financeiro precisam ser validados antes de uso comercial com dados pessoais reais.

## Fontes oficiais

- [Google — OAuth 2.0 token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model)
- [Google Drive — escopos da API](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
- [Google Drive files.list](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/list)
- [Google Drive — enviar arquivos](https://developers.google.com/workspace/drive/api/guides/manage-uploads)

## Testes automatizados

- `node tests/drive-backup-v1.cjs` — criptografia, senha, cópia pré-restauração e segurança.
- `node tests/drive-google-auth-v1-2.cjs` — OAuth simulado, parâmetro `pageSize`, upload multipart, leitura após upload e verificação sem restauração.
- `.github/workflows/check-v1.yml` — suíte do sistema com cadastros, SketchUp, Excel, segurança e Drive.
