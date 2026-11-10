# Universalartes 1.0 — Preparação para uso diário

Atualizado em 10/11/2026.

## O que a atualização já protege

- **Envio inicial para Supabase:** não permite sobrescrever uma cópia existente por engano. Se a nuvem já tiver dados, o usuário deve optar por carregá-los e conferir backups.
- **Conflitos e falhas:** envio automático usa revisão condicional; após falha de rede/autorização, novas tentativas são suspensas. A função **Verificar atualizações** compara a revisão antes de retomar.
- **Aviso ao fechar aba:** se há alterações locais que ainda não chegaram ao servidor, o navegador pode mostrar um aviso ao tentar fechar (depende da política do navegador).
- **Segurança e lançamento:** nova tela no menu com verificação de estruturas dos cadastros, produtos, estoque e pagamentos, verificação autenticada de leitura no Supabase, validação em memória da estrutura de backup e opção de download.
- Nenhum dado de negócio é modificado pelas verificações. Os resultados de verificação **não substituem** testes de segurança do banco real.

## Configurar e verificar na sua conta Supabase

1. Crie um projeto Supabase próprio em https://supabase.com/dashboard.
2. Execute o arquivo `preview-v1/supabase-preview.sql` no SQL Editor do projeto de **testes**. Ele cria tabela com RLS restritiva por `auth.uid()`.
3. Em Minha Empresa, informe somente a URL do projeto e a chave pública publishable/anon. **Nunca exponha a chave secreta, service_role ou a senha de sua conta.**
4. Crie uma conta de teste (e-mail validado se o Supabase solicitar). Entre, envie dados **fictícios** e abra **Segurança e lançamento → Verificar conexão Supabase**.
5. Com uma segunda conta de teste, confirme que não consegue visualizar nem alterar os registros da primeira. Só um teste autenticado de leitura na própria conta **não prova** que a RLS de acesso cruzado funciona.
6. Faça um backup JSON. Restaure uma cópia em **ambiente separado** e confira as quantidades, pedidos e pagamentos. O teste de estrutura no site não equivale à recuperação real.
7. Em dois dispositivos, confirme que mudanças sequenciais chegam à nuvem. Em seguida, crie um conflito proposital com dados fictícios e confirme o bloqueio, sem substituir informações da outra máquina.
8. Verifique o caso de queda de internet enquanto há alterações pendentes e teste o aviso de saída.

## Pendências para produção comercial

- Migrar movimentações de **estoque, pagamentos e pedidos** para transações atômicas no servidor e controlar permissões por empresa. O atual banco JSON por usuário não é adequado para vários funcionários editando ao mesmo tempo.
- Adotar armazenamento privado de anexos e uma política de backup/restauração testada.
- Validar regras de acesso (RLS) com contas diferentes no Supabase real; os testes CI não o fazem.
- Implantar a versão definitiva em origem separada da prévia, com autenticação obrigatória e revisão de segurança de scripts.
- Testar os fluxos completos em celular e computador antes de retirar o aviso **Ambiente de testes**.

## Atalhos

- Prévia: https://universautil-del.github.io/oficina-marcenaria/preview-v1/#seguranca
- SQL de testes: https://github.com/universautil-del/oficina-marcenaria/blob/main/preview-v1/supabase-preview.sql
- Manual de segurança anterior: [Auditoria](AUDITORIA-SEGURANCA-2026-11-10.md)
- Documentação Supabase: https://supabase.com/docs/guides/database/postgres/row-level-security

**Importante:** não introduza dados pessoais reais de clientes enquanto essas pendências estiverem abertas. O aviso de testes não será escondido apenas por escolha estética.
