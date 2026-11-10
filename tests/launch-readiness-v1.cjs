/* Regressão de lançamento, backup e segurança de sincronização.
   Executar com Node 22: node tests/launch-readiness-v1.cjs */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const script=read('preview-v1/launch-readiness-v1.js');
const cloudSource=read('preview-v1/cloud-preview.js');
new vm.Script(script);new vm.Script(cloudSource);
const html=read('preview-v1/index.html');
assert(html.includes('launch-readiness-v1.js'));
assert(html.includes('launch-readiness-v1.css'));
assert(html.indexOf('launch-readiness-v1.js')>html.indexOf('unified-contacts-v1.js'));
const db={version:3,clients:[{id:'c1',nome:'Teste'}],suppliers:[],products:[
  {id:'p1',tipo:'materia',nome:'MDF',estoque:6},
  {id:'p2',tipo:'acabado',components:[{materialId:'p1',quantidade:2}]}
],quotes:[],orders:[{id:'o1',clientId:'c1'}],transactions:[
  {id:'t1',kind:'receber',valor:200,payments:[{id:'p1',valor:100}]}
],stockMovements:[],company:{nome:'Universalartes'},seq:{quote:1,order:1}};
let saved=0,rendered=0,clickHandlers=0;
const ctx={
 db,sections:[['dashboard','⌂','Dashboard'],['empresa','⚙','Minha Empresa']],
 render:()=>{rendered++},save:()=>{saved++;return true},
 window:{oficinaCloud:{active:false,session:null,paused:false}},
 title:{textContent:''},nav:{innerHTML:'',querySelectorAll:()=>[]},sidebar:{classList:{remove(){}}},
 location:{hash:'#dashboard'},content:{innerHTML:'',querySelectorAll:()=>[]},
 document:{addEventListener(event){if(event==='click')clickHandlers++}},
 esc:s=>String(s??'').replace(/[&<>"']/g,''),
 alert(){},backup(){},Blob,Date,Number,Math,JSON,Set,Map,
 validateBackup:o=>({kind:3,data:o.data}),navigator:{onLine:true}
};
vm.runInNewContext(script,ctx,{timeout:1800});
const api=ctx.window.universalartesLaunch;
assert(api&&typeof api.inspect==='function');
assert(ctx.sections.some(x=>x[0]==='seguranca'),'Menu Segurança e lançamento deve aparecer');
const baseline=JSON.stringify(db);
const clean=api.inspect(db);
assert.equal(clean.errors,0);
assert.equal(clean.warnings,0);
assert.equal(clean.passed,true);
ctx.render('seguranca');
assert(ctx.content.innerHTML.includes('Segurança e confiabilidade'));
assert(ctx.content.innerHTML.includes('não libera automaticamente o uso comercial'));
assert(ctx.content.innerHTML.includes('Verificar conexão Supabase'));
assert.equal(JSON.stringify(db),baseline,'Diagnóstico nunca altera dados');
api.checkBackup();
assert.equal(JSON.stringify(db),baseline);
assert(ctx.content.innerHTML.includes('Estrutura JSON validada'));
const clone=JSON.parse(baseline);
clone.products[0].estoque=-2;
assert(api.inspect(clone).messages.some(x=>x.message.includes('estoque negativo')));
clone.products[0].estoque=6;
clone.transactions[0].payments[0].valor=300;
assert(api.inspect(clone).messages.some(x=>x.message.includes('financeiro')));
clone.transactions[0].payments[0].valor=100;
clone.clients.push({id:'c1',nome:'duplicado'});
assert(api.inspect(clone).messages.some(x=>x.message.includes('duplicados')));
clone.clients.pop();
clone.orders[0].clientId='inexistente';
assert(api.inspect(clone).warnings>0);
assert.equal(ctx.save(),true);
ctx.render('seguranca');
assert(ctx.content.innerHTML.includes('Teste a estrutura do backup'));
assert.equal(saved,1);

// Executar o módulo real de nuvem com requests simulados para verificar bloqueios.
function store(initial={}){
 const data={...initial};
 return {getItem:k=>data[k]??null,setItem:(k,v)=>{data[k]=String(v)},removeItem:k=>{delete data[k]},data};
}
const config={url:'https://universalartes-test.supabase.co',key:'sb_publishable_teste_publica'};
const ls=store({'universalartes-v1-cloud-config':JSON.stringify(config)}),ss=store();
let calls=[],confirms=0,timers=0;
let remote={data:JSON.parse(baseline),revision:4};
let failPatch=false;
const fetch=async(url,init)=>{
 const u=String(url),method=init?.method||'GET';
 calls.push({u,method});
 if(u.includes('/rest/v1/universalartes_preview_backups')){
  if(method==='GET')return {ok:true,text:async()=>JSON.stringify(remote?[remote]:[])};
  if(method==='PATCH'&&failPatch)throw Error('Simulação de rede indisponível');
  if(method==='POST')throw Error('POST inesperado');
  return {ok:true,text:async()=>JSON.stringify([remote])};
 }
 if(u.includes('/auth/v1/user'))return {ok:true,text:async()=>JSON.stringify({id:'user-1',email:'teste@example.com'})};
 return {ok:false,status:404,text:async()=>JSON.stringify({message:'endpoint desconhecido'})};
};
let cloudCode=cloudSource.replace(' window.oficinaCloud=state;',' window.__cloudTest={sendLocal,flush,refresh,activate,inspectConnection,getDb:()=>db};window.oficinaCloud=state;');
assert.notEqual(cloudCode,cloudSource,'Precisa expor somente no teste os métodos privados');
const cloudCtx={
 document:{addEventListener(){},getElementById:()=>null,querySelector:()=>null},
 window:{addEventListener(){}},
 localStorage:ls,sessionStorage:ss,location:{hash:'#dashboard'},
 db:JSON.parse(baseline),blank:()=>JSON.parse(baseline),load:()=>JSON.parse(baseline),
 DB_KEY:'test-db',OLD_CLIENTS:'test-old',
 render(){},save(){return true},download(){},esc:x=>String(x??''),alert(){},
 confirm(){confirms++;return true},Blob,fetch,navigator:{onLine:true},
 clearTimeout(){},setTimeout(){timers++;return 1},
 Date,JSON,Math,Number,URL,atob:s=>Buffer.from(s,'base64').toString('binary'),encodeURIComponent
};
vm.runInNewContext(cloudCode,cloudCtx,{timeout:1800});
const cloud=cloudCtx.window.__cloudTest;
cloudCtx.window.oficinaCloud.session={at:'valid-token',rt:'refresh',exp:Date.now()+1200000,id:'user-1'};
cloudCtx.window.oficinaCloud.userId='user-1';
(async()=>{
  await assert.rejects(cloud.sendLocal(),/NÃO sobrescreve registros existentes/);
  assert.equal(calls.filter(x=>x.method==='POST').length,0,'Não pode sobrescrever dados existentes');
  assert.equal(confirms,0,'Não deve solicitar confirmação de sobrescrita');
  const status=await cloud.inspectConnection();
  assert.equal(status.auth,true);
  assert.equal(status.table,true);
  assert.equal(status.hasRecord,true);
  cloud.activate(remote.data,4);
  cloud.getDb().clients.push({id:'c2',nome:'Contato sem envio'});
  failPatch=true;
  await assert.rejects(cloud.flush(),/rede indisponível/);
  assert.equal(cloudCtx.window.oficinaCloud.paused,true,'Pausar após erro');
  assert.equal(timers,0,'Não reagendar infinitamente após falha de rede');
  failPatch=false;
  await cloud.refresh();
  assert.equal(cloudCtx.window.oficinaCloud.paused,false,'A verificação remota pode liberar nova tentativa');
  assert.equal(timers,1,'Reagendar somente depois de verificar versão remota');
  console.log('OK: diagnóstico local, dados não alterados, backup em memória e bloqueio de sobrescrita da nuvem.');
  console.log('OK: verificação autenticada do Supabase simulado, pausa após erro e retomada controlada.');
  console.log('Aviso: não houve teste de banco Supabase real nem restauração de backup em servidor.');
})().catch(e=>{console.error(e);process.exitCode=1});
