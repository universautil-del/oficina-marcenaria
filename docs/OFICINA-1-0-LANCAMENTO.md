# UNIVERSA ART — OFICINA 1.0
Data: 11 de novembro de 2026

## O que é a OFICINA 1.0
A primeira edição identificada para uso pessoal, baseada **no código funcional da OFICINA 1.2**, sem regressão para a 0.6. A interface autenticada passa a exibir OFICINA 1.0 e não utiliza o rótulo de homologação. Os dados e suas chaves internas **não foram renomeados, migrados ou apagados**.

**Abrir a versão com login:** https://universautil-del.github.io/oficina-marcenaria/oficina.html

O endereço acima redireciona para a página autenticada `preview-v1/seguro.html`, mantendo a mesma origem, sessão e banco Supabase. Não pedir cadastro novamente caso a sessão esteja ativa.

A página `preview-v1/index.html` continua identificada como **ambiente de testes 1.2**, sem autenticação obrigatória, e NÃO deve ser usada para dados reais.

## O que foi testado automaticamente
- Login obrigatório na versão 1.0 e bloqueio visual do painel sem sessão.
- Modelo de autenticação isolado por Supabase e controle de conflitos sem sobrescrever dados.
- Testes de consistência de clientes, materiais, projetos, orçamentos, pedidos, entradas, estoque e financeiro.
- Importação de SketchUp/OpenCutList, Excel e medidas em milímetros.
- Testes automatizados de criptografia e lógica de backup/Drive com dados simulados.
- Validação do SQL e das políticas RLS em PostgreSQL sintético (GitHub Actions).

## Ações necessárias antes de usar dados de clientes reais
1. **Atualizar a função SQL para códigos de materiais 01–9999**, se isso ainda não foi feito no Supabase que já estava configurado: executar o arquivo `supabase/migrate-material-codes-9999.sql` no SQL Editor somente após verificar o projeto e preservar backup.
2. **Testar sincronização PC↔celular real:** entrar com a mesma conta, criar cliente fictício no computador, esperar `Sincronizado`, encontrar no celular, criar orçamento de teste no celular e conferir no computador.
3. **Testar restauração real de backup criptografado**, em sessão/ambiente de testes separado, antes de utilizar dados comerciais. Uma checagem em memória não substitui a recuperação do arquivo.
4. **Configurar Google Drive OAuth se desejar envio automático ou armazenamento remoto**; o fluxo automático de cópia agendada NÃO foi habilitado. Não inserir senhas ou chaves privadas no GitHub.
5. **Restringir novos cadastros** no Supabase (Authentication → Providers → Email) depois de criar sua conta única e validar a recuperação de acesso, para não permitir novos usuários por signup público.

A remoção do texto de homologação é uma mudança de **identificação visual**, não uma certificação técnica do banco em produção. O painel **Segurança e lançamento** mantém os diagnósticos disponíveis e não deve ser escondido.

## Preservação e rollback
- O formato dos dados continua versão 3, e a chave do navegador, a estrutura de IDs e os registros no Supabase permanecem compatíveis.
- A prévia local permanece separada; não importar dados fictícios acidentalmente na conta com login.
- Verificar os logs de GitHub Actions antes de atualizar a aplicação.
- Se o site não exibir a versão certa, pressionar `Ctrl+F5` ou atualizar a página no celular.
