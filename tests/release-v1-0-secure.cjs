/* OFICINA 1.0 — verificar apresentação do acesso autenticado
 * sem confundir com a prévia pública 1.2 nem remover controles reais.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const secure=read('preview-v1/seguro.html');
const demo=read('preview-v1/index.html');
const access=read('preview-v1/secure-access-v1.js');
const release=read('preview-v1/release-v1-2.js');
const cloud=read('preview-v1/cloud-preview.js');
const app=read('preview-v1/script.js');
for (const [name,src] of [['secure-access',access],['release',release],['cloud',cloud],['script',app]])new vm.Script(src,{filename:name});
assert(secure.includes('window.UNIVERSA_REQUIRE_AUTH=true'),'Versão 1.0 exige login');
assert(secure.includes('OFICINA 1.0'),'Marca 1.0 no acesso protegido');
assert(secure.includes('PC e celular · acesso pessoal'));
assert(!secure.includes('Homologação · dados de teste'));
assert(!secure.includes('Versão de homologação'));
assert(secure.includes('id="uaSecureGate"'),'Bloqueio visual antes do login');
assert(secure.includes('secure-access-v1.js'),'Login autenticado carregado');
assert(secure.includes('Verificar segurança'),'Verificação acessível');
assert(secure.includes('backup'),'Aviso de recuperação honesto');
assert(access.includes('Versão 1.0 · acesso pessoal'),'Login usa a versão 1.0');
assert(release.includes("window.UNIVERSA_REQUIRE_AUTH?'1.0':'1.2'"),'Configurações distinguem ambientes');
assert(cloud.includes("SECURE?'Nuvem e login · Universa Art 1.0'"),'Painel de nuvem 1.0');
assert(cloud.includes('Conflito')||cloud.includes('conflito'),'Proteção da sincronização em conflito');
assert(demo.includes('Homologação · dados de teste'),'Prévia 1.2 continua explicitamente de testes');
assert(!demo.includes('window.UNIVERSA_REQUIRE_AUTH=true'),'Prévia não confundida com acesso autenticado');
assert(app.includes("window.UNIVERSA_REQUIRE_AUTH?blank():load()"),'Sem carregar base local antiga ao entrar na versão 1.0');
assert(!secure.includes('sb_secret_')&&!secure.includes('service_role'),'Nenhuma chave secreta injetada na página');
console.log('OK OFICINA 1.0: apresentação, login obrigatório, mesma base, prevenção contra confusão com prévia de testes.');
