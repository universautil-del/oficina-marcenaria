# UNIVERSA ART — OFICINA 1.2

## Situação

**Versão 1.2 pronta para homologação com dados fictícios.** Esta entrega não autoriza uso comercial com dados de clientes até as verificações externas estarem concluídas. O ambiente é público no GitHub Pages e permite funcionamento local sem login.

## Melhorias desta versão

1. Banner e rodapé atualizados para **OFICINA 1.2**. O aviso de homologação continua visível porque autenticação, permissões e backup de produção dependem de configurações externas.
2. **Minha Empresa:** a marca é **UNIVERSA ART**. O campo `Nome fantasia exibido no sistema` foi separado de `Razão social / Nome nos contratos`. Se o histórico ainda tiver “Universalartes”, é exibido um aviso com o comando **Preencher nome UNIVERSA ART**; a alteração só é salva quando o usuário confirma e clica em **Salvar dados**. Nenhuma razão social é substituída automaticamente.
3. A opção **Backup Google Drive** é destacada na seção de backup. O JSON antigo permanece para compatibilidade, agora claramente identificado como **sem criptografia**. O backup recomendado utiliza senha com AES-256-GCM e opção manual/Google OAuth.
4. **Nuvem e login:** no painel de Minha Empresa, a tela passa a explicar que login só funciona após informar URL do projeto Supabase e chave pública publishable/anon. Quando não há configuração, o formulário de autenticação fica oculto, para não confundir um possível preenchimento automático do navegador com login ativo.

## Roteiro de testes para a oficina

### Passo 1 — Identidade (sem conta)

1. Acesse `https://universautil-del.github.io/oficina-marcenaria/preview-v1/#empresa`.
2. Pressione `Ctrl + Shift + R` para atualizar o cache.
3. Verifique o logotipo da marca UNIVERSA ART na lateral e no topo.
4. Confira os campos nome fantasia e razão social.
5. Se a razão social antiga estiver incorreta, clique em **Preencher nome UNIVERSA ART** e depois **Salvar dados**. Confirme antes que esse nome será usado em documentos.

### Passo 2 — Backup (usar apenas dados fictícios)

1. Vá para `#backupdrive`.
2. Crie uma senha de backup com 12+ caracteres **que não seja a senha do seu e-mail ou Supabase**.
3. Clique em **Baixar backup criptografado** e confira o arquivo no computador.
4. Envie o arquivo manualmente ao Google Drive em uma pasta privada.
5. Faça um teste de recuperação **em navegador/perfil separado e descartável**, sem substituir a base principal de testes.

### Passo 3 — Supabase (teste real a configurar pelo proprietário)

1. Entre em `https://supabase.com/dashboard` e selecione ou crie seu projeto.
2. No SQL Editor, execute o `preview-v1/supabase-preview.sql` de um **projeto de testes**.
3. Em `#empresa`, informe **Project URL** e chave **publishable/anon**, disponíveis nas configurações da API do projeto. **Nunca cole `service_role`, `sb_secret`, chave privada, senha ou token de acesso no chat nem no GitHub.**
4. Clique em **Salvar configuração**. A tela deve permitir criar conta e entrar.
5. Crie uma conta de teste, use dados inventados e vá para `#seguranca` para verificar conectividade.
6. Teste com uma segunda conta: os dados da primeira não devem ficar visíveis. Teste também conflito em duas abas/aparelhos. Sem esse teste de permissões, **não** considerar o sistema seguro para produção.

### Passo 4 — SketchUp 2022

1. Acesse `#sketchup` e importe um CSV real do OpenCutList com a linha `Components`.
2. Confira a lista de peças, medidas em mm, material, totais e relatórios.
3. Se o MDF estiver `Not assigned`, escolha o material e os custos antes de usar o orçamento.
4. Revise plano de corte, sentido do veio e folgas separadamente; a estimativa em área não é um plano de corte definitivo.

## Bloqueadores para produção

- Autenticação obrigatória antes de abrir qualquer dado real; o GitHub Pages público não oferece proteção no front-end local.
- Teste real de RLS com duas contas no Supabase.
- Operações atômicas no servidor para pagamentos e baixa de estoque em vários dispositivos.
- Backup/restauração completa validada em ambiente separado, inclusive anexos e contratos.
- Autorização real do Google Drive OAuth e conferência dos arquivos enviados (ainda não verificada).
- Testes manuais de ponta a ponta em celular e computador.

## Arquivos

- `preview-v1/release-v1-2.js` e `preview-v1/release-v1-2.css`
- `preview-v1/cloud-preview.js` (orientações de configuração)
- `tests/release-v1-2.cjs` (regressão da interface)
- `docs/MARCA-OPENCUTLIST-GOOGLE-DRIVE-V1.md` (guia dos recursos anteriores)

**Observação:** o projeto da Universal Art não foi conectado nesta execução a nenhuma conta real do Supabase ou Google; portanto login, OAuth e RLS não receberam aprovação externa.
