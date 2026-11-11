# UNIVERSA ART — Atualização de marca, OpenCutList e Google Drive

**Escopo:** prévia 1.0 em `/preview-v1/`. Esta atualização não migra nem apaga os dados existentes e não altera o site antigo.

## 1. Identidade da empresa

- Nome apresentado na barra lateral, cabeçalho e módulos: **UNIVERSA ART**, seguindo a logomarca enviada.
- Logomarca oficial recortada da imagem disponibilizada pelo proprietário: `preview-v1/assets/universa-art-logo.webp`.
- No módulo **Minha Empresa** foi acrescentado o comando **Usar esta logomarca nos documentos**. Este botão salva a imagem nos dados da empresa; não modifica automaticamente a razão social existente.
- Novos cadastros locais usam `Universa Art` como nome inicial; cadastros anteriores continuam com os dados que já tinham. É necessário conferir a razão social/cadastro para documentos oficiais.
- Layout do menu e topo mais compacto, responsivo e baseado nas cores verde/floresta/madeira.

## 2. SketchUp 2022 — arquivo OpenCutList da Universalartes

O arquivo fornecido **CSV fornecido pelo proprietário (nome preservado fora do repositório)** não é `.skp`; é uma exportação de componentes do SketchUp/OpenCutList.

**Formato observado no arquivo real:**
- Primeira linha isolada: `Components`
- Cabeçalho na linha seguinte, com `Part#;Quantity;Description;Length(L);Width(W);Thickness(T);...`
- Linhas de peças com dimensões contendo a unidade `mm` (ex.: `500 mm`).
- Seção de totais após os componentes (`Total Component Cubic m` e `Component Materials`).
- `Material = Not assigned` significa que é necessário selecionar o MDF correto antes de calcular custo.

**Como o importador foi corrigido:**
- Detecta `;`, tabulação ou vírgula nas primeiras linhas, mesmo com preâmbulo isolado.
- Localiza o cabeçalho verdadeiro e ignora as seções de resumo.
- Importa `Part#` como código e `Description` como nome/peça, quantity como quantidade, medidas em **milímetros**.
- Mantém importação Excel `.xlsx` e CSV/TXT.
- Calcula automaticamente área total de peças em m² e quantidade de peças; permite revisar as colunas.
- Se o material não estiver atribuído, avisa que orçamento e quantidade de chapas exigem conferência.

**Conferência independente do arquivo recebido:** 14 tipos, **71 peças**, área total das peças **25,60284 m²**. O volume calculado pelas três dimensões é aproximadamente 0,3840426 m³. Esses números não equivalem a 26 chapas nem a um plano de corte, e o documento não contém preço de MDF, fita ou ferragens.

*O usuário não enviou um arquivo nativo .skp; leitura direta da geometria SketchUp requer um plugin Ruby/SDK à parte.*

## 3. Backup no Google Drive

Novo módulo: **Backup Google Drive** (na barra lateral).

### A) Modo manual sem Google Cloud

1. Crie uma senha forte de backup com **12 caracteres ou mais**. Guarde-a fora do sistema.
2. Clique em **Baixar backup criptografado**.
3. Clique em **Abrir Google Drive para enviar manualmente**.
4. No Google Drive, crie a pasta `Universa Art / Backups Oficina` (se desejar) e envie o arquivo `UniversaArt_Backup_...uaenc.json`.
5. Para recuperar, baixe o arquivo do Drive e use **Validar e restaurar backup local** no módulo.

### B) Integração direta com a Google Drive API (opcional)

O código de OAuth e upload direto já foi implementado, mas **exige configuração externa e teste real**:

1. Entre em https://console.cloud.google.com/ e selecione/crie um projeto de sua propriedade.
2. Habilite a **Google Drive API** para o projeto.
3. Configure a tela de consentimento OAuth e adicione o escopo limitado `https://www.googleapis.com/auth/drive.file`.
4. Em Credenciais, crie um **OAuth Client ID, tipo Web Application** e configure **origens JavaScript autorizadas** como `https://universautil-del.github.io` (somente origem, sem `/oficina-marcenaria`).
5. Se a tela de consentimento estiver em testes, adicione seu e-mail como usuário de teste.
6. No OFICINA, entre em **Backup Google Drive** e cole apenas o **Client ID público** terminado em `.apps.googleusercontent.com`, nunca o client secret.
7. Clique **Salvar Client ID**, depois **Conectar conta Google**. Autorize o escopo solicitado.
8. Digite a senha do backup e clique em **Salvar backup no Drive**. Confira a cópia na sua conta.
9. Use **Listar backups** para baixar ou restaurar os arquivos que o próprio aplicativo criou.

**Segurança:** arquivos são criptografados no navegador (AES-256-GCM; chave derivada com PBKDF2/SHA-256, 310.000 iterações, salt e nonce aleatórios). Senha e token OAuth ficam apenas em memória ou no campo momentâneo e não são publicados no GitHub nem salvos no banco. O Client ID é público e pode ficar no navegador. Limite de 5 MB por backup. A senha não pode ser recuperada pelo administrador: guarde-a em local seguro.

**Importante:** a integração direta foi implementada e simulada nos testes de código, mas a autorização Google real e o envio com uma conta do proprietário não foram executados. Não chame de backup automático: Google Pages não dispõe de execução diária em segundo plano. Uma rotina diária requer servidor, gestão de tokens e monitoramento.

### C) Recuperação

A restauração usa uma confirmação explícita, tenta baixar a cópia do estado atual, valida a estrutura do arquivo e bloqueia a operação se houver sincronização ativa com o Supabase. Não conclua uma restauração sem conferir os cadastros e os saldos após carregar os dados.

## 4. Como validar antes do uso comercial

- Abra o importador e carregue o CSV do SketchUp 2022. Confira: 14 tipos, 71 peças e 25,603 m². Material não definido deve gerar alerta.
- Confira como a logomarca aparece no computador e no celular.
- Faça um backup criptografado manual, abra-o em ambiente descartável e verifique recuperação. Teste senha incorreta.
- Configure OAuth Google no projeto de sua propriedade, conecte sua conta e faça primeiro um teste de envio/recuperação com dados fictícios.
- Complete os testes de login, RLS com duas contas, backup de banco, transações de estoque e financeiro antes de cadastrar informações pessoais reais.

## Referências

- [Google Drive — upload multipart](https://developers.google.com/workspace/drive/api/guides/manage-uploads)
- [Google Identity Services — OAuth Token Model](https://developers.google.com/identity/oauth2/web/guides/use-token-model)
- [Escopo Drive.file](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
