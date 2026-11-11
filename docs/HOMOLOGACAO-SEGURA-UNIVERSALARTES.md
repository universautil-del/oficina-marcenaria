# Universalartes — Plano de homologação para acesso autenticado

> **Estado:** funcionalidade preparada e testada com simulações. Não usar dados comerciais reais até completar os testes externos assinalados abaixo. O sistema existente em `preview-v1/index.html` não foi substituído e os registros locais antigos não foram apagados.

## 1. Duas entradas separadas

- **Prévia local anterior:** https://universautil-del.github.io/oficina-marcenaria/preview-v1/
- **Nova entrada com login obrigatório:** https://universautil-del.github.io/oficina-marcenaria/preview-v1/seguro.html

O novo acesso lê dados exclusivamente da conta autenticada no Supabase. Ele não lê nem escreve a chave `localStorage` da prévia antiga, e usa identificadores separados para sessão e cache. O código do login não é garantia contra acesso indevido por si só: **as políticas RLS do banco são a verdadeira barreira de autorização**.

## 2. Configurar o Supabase da Universalartes

**Não envie senha, token, certificados A1, chave secreta ou service_role pelo chat ou por um repositório público.**

1. Crie um **projeto Supabase exclusivamente de homologação**. Utilize duas contas de e-mail de testes, distintas e sem dados comerciais.
2. No painel Supabase, abra **SQL Editor**, faça backup do que existir e execute [secure-document-v1.sql](../supabase/secure-document-v1.sql).
3. O SQL cria ou reforça a tabela `public.universalartes_preview_backups`, habilita RLS e restringe SELECT/INSERT/UPDATE à conta proprietária, sem permissão DELETE pelo cliente.
4. Também instala as funções autenticadas `ua_iniciar_documento` e `ua_atualizar_documento` (controle atômico de revisão) e `ua_validar_documento` (formato, IDs, estoque, números e valores).
5. Em **Project Settings → API**, copie apenas o **Project URL** e a **chave pública publishable/anon**.
6. Abra `seguro.html`, informe os dois campos e clique **Salvar conexão**. Depois crie/entre com um usuário do Supabase (a confirmação de e-mail depende do seu projeto).
7. Se já houver dados na conta, o sistema os carrega mediante autenticação. Em conta nova, inicializa um documento vazio validado pelo servidor.
8. Quando há mudança de dados, o sistema envia uma atualização ao servidor usando **revisão esperada**. Se outro dispositivo modificou o banco primeiro, o servidor rejeita a gravação em vez de sobrescrever silenciosamente. O indicador de sincronização mostra conflito ou falha.

**Limitação arquitetural:** os módulos ainda operam sobre um único documento JSON por usuário. O RPC valida e grava esse documento numa transação, mas **não constitui um sistema de movimentações independentes com travas de estoque e financeiro entre vários funcionários**. Para trabalho simultâneo de vários usuários na mesma empresa, será necessário modelo relacional com comandos transacionais no servidor.

## 3. Prova de isolamento com duas contas (obrigatória)

O arquivo [tests/supabase-live-rls.cjs](../tests/supabase-live-rls.cjs) executa o teste contra o seu Supabase real. **Não é rodado automaticamente** e exige `ALLOW_DISPOSABLE_CLOUD_TESTS=SIM`, duas contas descartáveis e seis variáveis de ambiente. O script aborta se qualquer conta já tiver dados, evitando sobrescrever registros reais.

Teste esperado:
- conta A lê A, não lê B;
- conta B lê B, não lê A;
- visitante sem token não consegue ler A;
- A não consegue atualizar o documento de B;
- duas gravações com a mesma revisão não podem sobrescrever uma à outra;
- estoque negativo é recusado pelo servidor;
- snapshot anterior pode ser restaurado na conta de teste, usando revisão atual.

O teste de código automatizado `tests/secure-auth-v1.cjs` simula essas operações e confirma que a prévia antiga permanece intacta. **Somente o teste com duas contas no banco real confirma RLS.**

## 4. Backup criptografado e Google Drive

1. Na prévia antiga, gere primeiro um backup criptografado `.uaenc.json` e mantenha uma cópia em local privado.
2. Com senha forte, o arquivo é criptografado no navegador em AES-256-GCM. Guarde a senha separadamente do arquivo.
3. Na nova entrada `seguro.html`, após autenticar, abra a área **Backup e Google Drive**.
4. Antes de restaurar qualquer arquivo, clique **Verificar arquivo (não altera dados)**.
5. Ao restaurar na conta autenticada, o sistema cria um **backup criptografado pré-restauração**, pede confirmação e tenta gravar o conteúdo no Supabase com RPC; a restauração só retorna sucesso após verificar o estado sincronizado.
6. Faça este teste primeiro numa conta **descartável**, comparando quantidade de clientes, projetos, pedidos, parcelas e registros do estoque, e confira anexos de contratos separadamente.

### Ativar envio direto ao Google Drive

A conexão via Drive **ainda depende da conta Google do proprietário**:
- Abra https://console.cloud.google.com/apis/library/drive.googleapis.com e ative **Google Drive API**.
- Em https://console.cloud.google.com/auth/overview configure a tela de consentimento OAuth e, se o app estiver em teste, adicione o usuário de testes.
- Em https://console.cloud.google.com/auth/clients crie um OAuth Client ID tipo **Aplicativo da Web**.
- Em **Origens JavaScript autorizadas**, informe exatamente `https://universautil-del.github.io` — sem `/oficina-marcenaria` ou outro caminho.
- Cole **somente o Client ID público** na seção Drive da OFICINA e clique **Conectar conta Google**. Confirme a conta, escopo `drive.file` e autorização.
- Salve um **backup criptografado fictício**, confirme que aparece na lista, baixe e verifique o arquivo antes de confiar nele.

Google Drive não fornece OAuth Client ID por código. O ChatGPT não consegue ativar o Google Cloud do proprietário sem uma conexão administrativa autorizada. Se não quiser configurar OAuth agora, continue usando **backup cifrado manual → enviar ao Drive pelo navegador**.

**Limites atuais:** arquivo criptografado até 8 MB, documento Supabase até 2 MB; **backup automático diário, armazenamento privado de anexos em R2 e recuperação de arquivos externos ainda não estão implementados**.

## 5. Checklist de entrega comercial

- [x] Rota de login obrigatório **separada**, sem carregar registros antigos.
- [x] Preparação de SQL RLS, atualização com revisão atômica e bloqueio de overwrite.
- [x] Teste automatizado de login, isolamento de cache, falha de revisão e logout.
- [x] Restaurar backup na rota autenticada, com proteção e verificação de confirmação do servidor (código).
- [ ] SQL aplicado e RLS comprovada no **Supabase real** com duas contas (teste acima).
- [ ] Restaurar um backup criptografado, conferir documentos e anexos com conta real de homologação.
- [ ] Autorizar Google Drive OAuth da empresa e testar upload/download real.
- [ ] Implementar backend transacional relacional, armazenamento privado de anexos e controle por empresa se houver uso por múltiplos funcionários.
- [ ] Validar manualmente todas as telas no celular e no computador, inclusive fluxos de pagamento e estorno.
- [ ] Definir retenção e periodicidade dos backups e política de recuperação.

**Até completar os itens externos, mantenha a identificação de homologação e não cadastre dados sensíveis de clientes reais.**
