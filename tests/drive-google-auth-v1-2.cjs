/* Teste de integração Drive simulado sem credenciais reais.
 * node tests/drive-google-auth-v1-2.cjs
 */
'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const assert=require('node:assert/strict'),{webcrypto}=require('node:crypto');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'preview-v1/drive-backup-v1.js'),'utf8');
const html=fs.readFileSync(path.join(root,'preview-v1/index.html'),'utf8');
new vm.Script(source,{filename:'drive-backup-v1.js'});
assert(html.includes('drive-fix-1-2.css'));
assert(html.includes('drive-backup-v1.js?v='),'A prévia deve carregar o módulo Drive/backup manual');
const events={},stored={},calls=[];
let config,requestCalled=0,download,uploaded='',apiListCount=0,dbSaves=0;
const pass={value:'senha-forte-para-testes-universa-art'};
const clientId={value:'123456789-abcd.apps.googleusercontent.com'};
const message={textContent:''},fileInput={files:[]};
const snapshot={
 version:3,clients:[{id:'cliente1',nome:'Teste Fictício'}],suppliers:[],products:[],quotes:[],
 orders:[],transactions:[],stockMovements:[],purchases:[],projects:[],
 company:{nome:'Universa Art'},seq:{quote:1,order:1}
};
const FakeURL=URL;
FakeURL.createObjectURL=function(blob){this.last=blob;return 'blob:local'};
FakeURL.revokeObjectURL=()=>{};
const window={
 oficinaCloud:{active:false},
 google:{accounts:{oauth2:{
   initTokenClient(c){config=c;return {requestAccessToken(){requestCalled++}}},
   hasGrantedAllScopes(r,s){return r.scope===s}
 }}},
 open(url){calls.push({kind:'open',url})}
};
const doc={
 body:{appendChild(){}},
 addEventListener(event,fn){events[event]=fn},
 querySelector(q){
  if(q==='#uaDrivePass')return pass;
  if(q==='#uaDriveClientId')return clientId;
  if(q==='#uaDriveStatus')return message;
  if(q==='#uaDriveImport')return fileInput;
  return null;
 },
 createElement(tag){return{download:'',href:'',click(){download=this.download},remove(){}}}
};
const localStorage={getItem(k){return stored[k]||''},setItem(k,v){stored[k]=v}};
const fetch=async (url,options={})=>{
 const u=String(url);calls.push({kind:'fetch',url:u,method:options.method||'GET'});
 assert.equal(options.headers.Authorization,'Bearer teste-token-de-curta-duracao');
 if(u.includes('uploadType=multipart')){
  assert.equal(options.method,'POST');
  assert(String(options.headers['Content-Type']).startsWith('multipart/related'));
  const multipart=await options.body.text();
  uploaded=multipart.split('\r\nContent-Type: application/json\r\n\r\n')[1].split('\r\n--')[0];
  assert(JSON.parse(uploaded).format==='universa-art-encrypted-backup-v1');
  return {ok:true,json:async()=>({id:'abcdef1234567890',name:'UniversaArt_Backup_demo.uaenc.json'})};
 }
 if(u.includes('alt=media'))return {ok:true,text:async()=>uploaded};
 if(u.includes('drive/v3/files?')){
  const query=new URL(u).searchParams;
  assert.equal(query.get('pageSize'),'30');
  assert.equal(query.get('page_size'),null);
  apiListCount++;
  return {ok:true,json:async()=>({files:[]})};
 }
 throw Error('Rota inesperada no Drive simulado: '+u);
};
const ctx={
 window,document:doc,localStorage,fetch,db:JSON.parse(JSON.stringify(snapshot)),
 sections:[['dashboard','⌂','Dashboard']],render(){},
 title:{textContent:''},nav:{innerHTML:'',querySelectorAll(){return[]}},
 sidebar:{classList:{remove(){}}},content:{innerHTML:''},location:{hash:'#backupdrive'},
 crypto:webcrypto,Blob,TextEncoder,TextDecoder,URLSearchParams,URL:FakeURL,
 atob:str=>Buffer.from(str,'base64').toString('binary'),
 btoa:str=>Buffer.from(str,'binary').toString('base64'),
 esc:v=>String(v??'').replace(/[&<>"']/g,''),
 validateBackup:o=>({kind:o?.version===3?3:0,data:o.data}),
 setupExtras(){},save(){dbSaves++;return true},
 confirm(){return true},setTimeout(){},
 String,Number,Math,Date,Set,JSON,Error,Promise,Uint8Array,encodeURIComponent
};
vm.runInNewContext(source,ctx,{timeout:3000});
const api=window.universaArtDriveBackup;
assert(api.validClientId('123456789-abcd.apps.googleusercontent.com'));
assert(!api.validClientId('123456789-xxxx.apps.googleusercontent'));
assert(!api.validClientId('sb_secret_abc'));
assert.equal(api.diagnostics().origin,'https://universautil-del.github.io');
assert(ctx.content.innerHTML.includes('Diagnóstico:'));
assert(ctx.content.innerHTML.includes('Aguardando Client ID real'));
assert(ctx.content.innerHTML.includes('Copiar origem'));
assert(ctx.content.innerHTML.includes('Fazer backup agora — sem configuração'));
assert(ctx.content.innerHTML.includes('Verificar arquivo (não altera dados)'));
assert(ctx.content.innerHTML.includes('Opcional — conectar Google Drive'));
async function press(action){
 const button={dataset:{driveAction:action},disabled:false};
 await events.click({target:{closest:()=>button}});
}
(async()=>{
 await press('connect');assert.equal(requestCalled,1,'OAuth deve iniciar sem clicar Salvar Client ID antes');
 assert.equal(stored['universa-art-drive-client-id-v1'],clientId.value);
 assert.equal(config.scope,'https://www.googleapis.com/auth/drive.file');
 await config.callback({access_token:'teste-token-de-curta-duracao',expires_in:3600,scope:config.scope});
 assert.equal(apiListCount,1,'Validar Drive API após autorização');
 assert(message.textContent.includes('API verificada')||ctx.content.innerHTML.includes('API verificada'));
 await press('upload');
 assert(uploaded.includes('ciphertext'),'Enviar JSON criptografado');
 assert(calls.some(x=>x.kind==='fetch'&&x.url.includes('alt=media')),'Checar backup no Drive após upload');
 assert(message.textContent.includes('verificado por leitura'));
 fileInput.files=[{size:Buffer.byteLength(uploaded),text:async()=>uploaded}];
 const unchanged=JSON.stringify(ctx.db);
 await press('verify');
 assert.equal(JSON.stringify(ctx.db),unchanged,'Verificar nunca restaura dados');
 assert(message.textContent.includes('Nenhum dado foi alterado.'));
 ctx.db.clients.push({id:'ficticio2',nome:'Outro teste'});
 await press('import');
 assert.equal(ctx.db.clients.length,1,'Restauração deve ler o backup correto');
 assert.equal(dbSaves,1);
 assert(download.endsWith('.uaenc.json'),'Cópia de segurança deve ser criptografada');
 const safety=JSON.parse(await ctx.URL.last.text());
 assert.equal(safety.format,'universa-art-encrypted-backup-v1');
 assert(!JSON.stringify(safety).includes('Outro teste'),'Não gerar cópia preventiva em JSON aberto');
 window.oficinaCloud.active=true;
 await assert.rejects(api.restoreData(JSON.parse(uploaded),pass.value),/Desative a sincronização/);
 console.log('OK Drive: OAuth, Drive API list pageSize, upload e leitura de verificação, recuperação criptografada e teste sem restauração.');
})().catch(error=>{console.error(error);process.exitCode=1});
