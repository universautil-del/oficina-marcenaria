/* OFICINA 1.1 — a homologação deve permanecer local, isolada e sem Supabase. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const html=read('preview-v1/dev-v1.1.html');
const mainHtml=read('preview-v1/index.html');
const script=read('preview-v1/script.js');
const cloud=read('preview-v1/cloud-preview.js');
const intro=script.slice(script.indexOf('const DB_KEY='),script.indexOf('const money=',script.indexOf('const DB_KEY=')));
assert(html.includes('window.UNIVERSA_DEV_V11=true'),'Modo 1.1 deve ser definido antes dos scripts');
assert(html.includes('window.UNIVERSA_REQUIRE_AUTH=false'),'Sandbox offline não requer login de produção');
assert(html.includes("connect-src 'none'"),'CSP deve bloquear requisições de rede');
assert(html.includes('dev-v1.1.html')===false||html.includes('AMBIENTE DE DESENVOLVIMENTO'),'Aviso visual obrigatório');
assert(html.includes('script.js?v='),'Sistema precisa carregar o próprio código');
for(const forbidden of ['src="cloud-preview.js','src="public-cloud-config.js','src="secure-access-v1.js','src="backup-oficina-v1.js'])
 assert(!html.includes(forbidden),'Módulo de produção incluído no sandbox: '+forbidden);
assert(html.includes('Dados fictícios locais'),'Deve sinalizar dados fictícios');
assert(mainHtml.includes('src="cloud-preview.js'),'Prévia existente não deve ser desativada nesta branch');
assert(cloud.includes('if(window.UNIVERSA_DEV_V11)return;'),'Cloud deve ter trava de desenvolvimento');
for(const [dev,want] of [[true,'universa-art-oficina-dev-1-1-dados'],[false,'universalartes-preview-v1-dados']]){
 const ctx={window:{UNIVERSA_DEV_V11:dev}};
 vm.runInNewContext(intro+'this.readKey=()=>DB_KEY;this.readLegacy=()=>OLD_CLIENTS;',ctx);
 assert.equal(ctx.readKey(),want);
 assert.equal(ctx.readLegacy(),dev?'universa-art-oficina-dev-1-1-antigos':'universalartes-preview-v1-clientes-antigos');
}
new vm.Script(script);
new vm.Script(cloud);
console.log('OK v1.1 sandbox: storage exclusivo, CSP sem conexões, nuvem bloqueada, página e código existentes preservados.');
