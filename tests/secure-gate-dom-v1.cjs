/* node tests/secure-gate-dom-v1.cjs */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../preview-v1/secure-access-v1.js'),'utf8');
new vm.Script(source);
const htmlClass=new Set(),events={},gateEvents={};
const gate={innerHTML:'',addEventListener(type,fn){gateEvents[type]=fn}};
let configured=false,signins=0;
const cloud={
 cfg:null,session:null,active:false,paused:false,status:'Aguardando autenticação',
 configure(url,key){
  assert.equal(url,'https://oficina-test.supabase.co');
  assert.equal(key,'sb_publishable_teste');
  this.cfg={url,key};configured=true;
 },
 async signIn(email,password){assert.equal(email,'teste@example.com');assert.equal(password,'senha-mais-forte');this.active=true;this.session={email};signins++},
 async signUp(){throw Error('Não deveria criar conta')}
};
const forms={config:{url:'https://oficina-test.supabase.co',key:'sb_publishable_teste'},
 login:{email:'teste@example.com',password:'senha-mais-forte'}};
class FormData{constructor(form){this.fields=form.id==='uaSecureConfig'?forms.config:forms.login}get(k){return this.fields[k]}}
const doc={documentElement:{classList:{add:s=>htmlClass.add(s),remove:s=>htmlClass.delete(s)}},querySelector(q){return q==='#uaSecureGate'?gate:null}};
const win={UNIVERSA_REQUIRE_AUTH:true,oficinaCloud:cloud,addEventListener(type,fn){events[type]=fn}};
vm.runInNewContext(source,{window:win,document:doc,FormData,Error,String,Promise},{timeout:1000});
assert(htmlClass.has('ua-auth-required'));
assert(gate.innerHTML.includes('Entrar na OFICINA'));
assert(gate.innerHTML.includes('disabled'),'Login bloqueado sem configuração');
assert(gate.innerHTML.includes('SQL autenticado'));
(async()=>{
 await gateEvents.submit({target:{id:'uaSecureConfig'},preventDefault(){},submitter:null});
 assert(configured);
 assert(!gate.innerHTML.includes('value="login" disabled'),'Login habilitado com configuração pública');
 await gateEvents.submit({target:{id:'uaSecureLogin'},preventDefault(){},submitter:{value:'login'}});
 assert.equal(signins,1);
 assert(!htmlClass.has('ua-auth-required'),'Painel liberado só após login/ativação');
 cloud.session=null;cloud.active=false;
 events['ua-secure-change']();
 assert(htmlClass.has('ua-auth-required'),'Ao sair bloquear novamente');
 console.log('OK: portal seguro bloqueia painel, configura banco, entra e bloqueia após logout.');
})().catch(e=>{console.error(e);process.exitCode=1});
