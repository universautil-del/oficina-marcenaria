/* node tests/secure-auth-v1.cjs — simulação segura: não usa credenciais reais */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const cloudSrc=read('preview-v1/cloud-preview.js'),authSrc=read('preview-v1/secure-access-v1.js');
const page=read('preview-v1/seguro.html'),index=read('preview-v1/index.html'),script=read('preview-v1/script.js');
const sql=read('supabase/secure-document-v1.sql');
new vm.Script(cloudSrc);new vm.Script(authSrc);
assert(page.includes('window.UNIVERSA_REQUIRE_AUTH=true'));
assert(page.includes('id="uaSecureGate"'));
assert(page.includes('secure-access-v1.js'));
assert(!index.includes('UNIVERSA_REQUIRE_AUTH=true'),'Prévia antiga permanece independente');
assert(script.includes('window.UNIVERSA_REQUIRE_AUTH?blank():load()'));
assert(script.includes('if(window.UNIVERSA_REQUIRE_AUTH)return false'));
assert(cloudSrc.includes('universalartes-secure-session-v1'));
assert(cloudSrc.includes('universalartes-secure-cache-v1'));
assert(cloudSrc.includes('/rpc/ua_iniciar_documento'));
assert(cloudSrc.includes('/rpc/ua_atualizar_documento'));
assert(authSrc.includes("window.addEventListener('ua-secure-change'"));
assert(sql.includes('enable row level security'));
assert(sql.includes('auth.uid()'));
assert(sql.includes('security invoker')&&!sql.includes('security definer'));
assert(sql.includes('p_revisao_esperada'));
assert(sql.includes('group by x.value->>'));
assert(sql.includes('ua_validar_documento'));
assert(!/grant\s+execute\s+on\s+function[^;]+\s+to\s+anon\s*;/i.test(sql));

const cfg={url:'https://universalartes-test.supabase.co',key:'sb_publishable_publica_teste'};
const legacyData='{"version":3,"clients":[{"id":"privado-antigo","nome":"NÃO PODE ENTRAR"}]}';
function store(initial={}){const data={...initial};return {data,getItem:k=>data[k]??null,setItem:(k,v)=>{data[k]=String(v)},removeItem:k=>{delete data[k]}}}
const local=store({'universalartes-preview-v1-dados':legacyData});
const session=store();
const calls=[];
let remote=null,simulateConflict=false,events=[];
const fetched=async(url,opts={})=>{
 const u=String(url),method=opts.method||'GET',body=opts.body?JSON.parse(opts.body):null;
 calls.push({url:u,method,body});
 const ok=d=>({ok:true,status:200,text:async()=>JSON.stringify(d)});
 const err=(code,message)=>({ok:false,status:code,text:async()=>JSON.stringify({message})});
 if(u.includes('/auth/v1/token?grant_type=password'))
  return ok({access_token:'token-teste',refresh_token:'refresh-teste',expires_in:3600,user:{id:'usuario-teste',email:'teste@example.com'}});
 if(u.includes('/auth/v1/token?grant_type=refresh_token'))
  return ok({access_token:'token-novo',refresh_token:'refresh-novo',expires_in:3600,user:{id:'usuario-teste',email:'teste@example.com'}});
 if(u.includes('/rest/v1/universalartes_preview_backups?'))
  return ok(remote?[remote]:[]);
 if(u.endsWith('/rest/v1/rpc/ua_iniciar_documento')){
  assert.equal(method,'POST');
  assert.equal(body.p_documento.version,3);
  assert(Array.isArray(body.p_documento.projects));
  if(remote)return err(409,'Conta já possui dados');
  remote={data:body.p_documento,revision:1};
  return ok(1);
 }
 if(u.endsWith('/rest/v1/rpc/ua_atualizar_documento')){
  assert.equal(method,'POST');
  if(simulateConflict||body.p_revisao_esperada!==remote.revision)return err(409,'Conflito de revisão');
  remote={data:body.p_documento,revision:remote.revision+1};
  return ok(remote.revision);
 }
 if(u.includes('/auth/v1/user'))
  return ok({id:'usuario-teste',email:'teste@example.com'});
 return err(404,'Rota não simulada');
};
let rendered=0;
const window={UNIVERSA_REQUIRE_AUTH:true,addEventListener(){},dispatchEvent(ev){events.push(ev.type)}};
const ctx={
 window,localStorage:local,sessionStorage:session,fetch:fetched,
 db:{},DB_KEY:'universalartes-preview-v1-dados',OLD_CLIENTS:'universalartes-preview-v1-clientes-antigos',
 location:{hash:'#dashboard'},navigator:{onLine:true},
 render(){rendered++},download(){},confirm(){return true},alert(){},
 document:{getElementById(){return null},querySelector(){return null},addEventListener(){}},
 blank:()=>({version:3,clients:[],products:[],quotes:[],orders:[],transactions:[],
 stockMovements:[],company:{nome:'Universalartes'},seq:{quote:1,order:1}}),
 setupExtras(){if(!Array.isArray(ctx.db.suppliers))ctx.db.suppliers=[];if(!Array.isArray(ctx.db.purchases))ctx.db.purchases=[]},
 v5InitData(){for(const k of ['projects','invoices','orderAttachments'])if(!Array.isArray(ctx.db[k]))ctx.db[k]=[]},
 save(){return false},setTimeout(){return 1},clearTimeout(){},
 URL,JSON,Date,Error,Number,String,Math,Boolean,Blob,Promise,Set,Map,Array,
 Event:class Event{constructor(type){this.type=type}},
 atob:s=>Buffer.from(s,'base64').toString('utf8')
};
vm.runInNewContext(cloudSrc,ctx,{timeout:2500});
const cloud=window.oficinaCloud;
assert(cloud.secure===true);
assert(cloud.signIn&&cloud.signOut&&cloud.configure&&cloud.commit);
assert.equal(cloud.active,false);
(async()=>{
 cloud.configure(cfg.url,cfg.key);
 await cloud.signIn('teste@example.com','senha-de-teste');
 assert.equal(cloud.active,true);
 assert.equal(cloud.rev,1);
 assert.equal(ctx.db.clients.length,0,'Não carregar dados do navegador antigo');
 assert.equal(local.getItem('universalartes-preview-v1-dados'),legacyData,'Não sobrescrever prévia antiga');
 assert(session.getItem('universalartes-secure-session-v1'),'Usar sessão isolada');
 assert.equal(session.getItem('universalartes-v1-cloud-session'),null);
 assert(events.includes('ua-secure-change'));
 ctx.db.clients.push({id:'novo',nome:'Cliente Fictício'});
 assert.equal(ctx.save(),true);
 await cloud.commit();
 assert.equal(remote.revision,2);
 assert.equal(remote.data.clients[0].id,'novo');
 assert(calls.some(c=>c.url.includes('/rpc/ua_atualizar_documento')));
 assert(!calls.some(c=>c.method==='PATCH'),'Modo autenticado só usa RPC transacional');
 // Simular gravação concorrente em outro aparelho.
 ctx.db.clients.push({id:'novo2',nome:'Segundo teste'});
 assert.equal(ctx.save(),true);
 simulateConflict=true;
 await assert.rejects(()=>cloud.commit(),/Conflito de revisão/);
 assert.equal(cloud.paused,true);
 assert.equal(ctx.save(),false,'Bloquear novas alterações após conflito');
 assert.equal(remote.revision,2,'Conflito não apaga banco');
 assert.equal(remote.data.clients.length,1);
 cloud.signOut();
 assert.equal(ctx.db.clients.length,0,'Logout limpa dados em memória');
 assert.equal(session.getItem('universalartes-secure-session-v1'),null);
 assert.equal(session.getItem('universalartes-secure-cache-v1'),null);
 assert.equal(local.getItem('universalartes-preview-v1-dados'),legacyData);
 console.log('OK: autenticação, banco isolado, RPC com revisão, conflito entre aparelhos, logout e prévia preservada.');
})().catch(error=>{console.error(error);process.exitCode=1});
