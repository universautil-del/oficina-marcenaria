/* node tests/diagnostico-oficina-1-0.cjs
 * Verificação do diagnóstico 1.0 com nuvem simulada. Nunca acessa dados reais.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../preview-v1/launch-readiness-v1.js'),'utf8');
new vm.Script(source);
const db={version:3,clients:[],suppliers:[],products:[],quotes:[],orders:[],transactions:[],stockMovements:[],purchases:[],projects:[],seq:{quote:1,order:1}};
const handlers={};let previousRenders=0;
const context={
 db,sections:[['dashboard','⌂','Início'],['empresa','⚙','Minha Empresa']],
 render(){previousRenders++},save(){return true},window:{UNIVERSA_REQUIRE_AUTH:true,oficinaCloud:{active:true,session:{id:'user-test'},paused:false,status:'Sincronizado',inspectConnection:async()=>({auth:true,table:true,synchronized:true})}},
 content:{innerHTML:''},title:{textContent:''},nav:{innerHTML:'',querySelectorAll(){return[]}},sidebar:{classList:{remove(){}}},
 location:{hash:'#seguranca'},document:{addEventListener(type,fn){handlers[type]=fn}},
 esc:s=>String(s??'').replace(/[&<>"]/g,''),validateBackup:o=>({kind:3,data:o.data}),
 Blob,Date,Number,JSON,String,Math,Set,Map,Promise
};
vm.runInNewContext(source,context,{timeout:1600});
assert(context.content.innerHTML.includes('OFICINA 1.0'));
assert(context.content.innerHTML.includes('2 de 4 etapas conferidas'));
assert(context.content.innerHTML.includes('Fazer backup criptografado'));
assert(!context.content.innerHTML.includes('Exportar backup JSON'));
assert(context.content.innerHTML.includes('Como concluir os testes da OFICINA 1.0'));
assert(!context.content.innerHTML.includes('Abrir OFICINA com login (homologação)'));
assert(context.content.innerHTML.includes('Sincronizado'));
assert(!context.content.innerHTML.includes('O que ainda impede sair da versão de testes'));
const api=context.window.universalartesLaunch;
api.checkBackup();assert(context.content.innerHTML.includes('3 de 4 etapas conferidas'));
assert(context.content.innerHTML.includes('não é um backup salvo'));
(async()=>{
 const handle=handlers.click;
 let disabled=false;
 await handle({target:{closest(){return {dataset:{launchAction:'check-cloud'},set disabled(v){disabled=v},get disabled(){return disabled}}}}});
 assert(context.content.innerHTML.includes('4 de 4 etapas conferidas'));
 assert(context.content.innerHTML.includes('verificados às'));
 assert(context.content.innerHTML.includes('não uma certificação'));
 await handle({target:{closest(){return {dataset:{launchAction:'open-encrypted-backup'},disabled:false}}}});
 assert.equal(context.location.hash,'backupdrive');
 assert(previousRenders>=1,'Abre o módulo de backup existente sem exportar JSON aberto');
 const copy=JSON.stringify(db);
 context.save();context.render('seguranca');
 assert(context.content.innerHTML.includes('3 de 4 etapas conferidas'),'Nova edição invalida o diagnóstico de estrutura');
 assert.equal(JSON.stringify(db),copy,'Diagnóstico não altera dados');
 console.log('OK diagnóstico 1.0: verificações separadas, backup criptografado, edição invalida teste, sem alterar dados.');
})().catch(e=>{console.error(e);process.exitCode=1});
