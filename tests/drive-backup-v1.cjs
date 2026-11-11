'use strict';
/* node tests/drive-backup-v1.cjs */
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const {webcrypto}=require('node:crypto');
const source=fs.readFileSync(path.join(__dirname,'../preview-v1/drive-backup-v1.js'),'utf8');
new vm.Script(source,{filename:'drive-backup-v1.js'});
const index=fs.readFileSync(path.join(__dirname,'../preview-v1/index.html'),'utf8');
const logo=fs.readFileSync(path.join(__dirname,'../preview-v1/assets/universa-art-logo.webp'));
assert.equal(logo.subarray(0,4).toString(),'RIFF','A logomarca precisa ser imagem WEBP real');
assert.equal(logo.subarray(8,12).toString(),'WEBP');
assert(index.includes('UNIVERSA ART')&&index.includes('assets/universa-art-logo.webp'),'Nome e logotipo visíveis na interface');
assert(index.includes('drive-backup-v1.js')&&index.includes('accounts.google.com/gsi/client'),'Tela de backup e biblioteca Google autorizadas');

let count=0,saved=0,confirmations=0,downloaded=0;
const snapshot={
 version:3,clients:[{id:'c1',nome:'Cliente teste'}],products:[],quotes:[],orders:[],
 transactions:[],stockMovements:[],suppliers:[],purchases:[],projects:[],
 company:{nome:'Universa Art'},seq:{quote:1,order:1}
};
const window={oficinaCloud:{active:false}};
const ctx={
 window,db:JSON.parse(JSON.stringify(snapshot)),sections:[['dashboard','⌂','Dashboard']],
 render(){count++},title:{textContent:''},nav:{innerHTML:'',querySelectorAll(){return[]}},
 sidebar:{classList:{remove(){}}},location:{hash:'#dashboard'},content:{innerHTML:''},
 document:{addEventListener(){},querySelector(){return null},createElement(){return {click(){downloaded++}}}},
 localStorage:{getItem(){return''},setItem(){}},
 esc:v=>String(v??''),validateBackup:o=>({kind:o?.version===3?3:0,data:o.data}),
 save(){saved++;return true},setupExtras(){},
 crypto:webcrypto,TextEncoder,TextDecoder,Blob,URL:{createObjectURL(){return'blob:teste'},revokeObjectURL(){}},
 btoa:s=>Buffer.from(s,'binary').toString('base64'),
 atob:s=>Buffer.from(s,'base64').toString('binary'),
 confirm(){confirmations++;return true},setTimeout(){},Number,Math,Date,Set,Map,JSON,Promise,
 Uint8Array,Error,String,encodeURIComponent
};
vm.runInNewContext(source,ctx,{timeout:2000});
const api=window.universaArtDriveBackup;
assert(api&&typeof api.encryptBackup==='function');
const pass='senha-de-backup-UNIVERSA-ART-2026';
const original={app:'oficina',version:3,exportedAt:'2026-11-10T00:00:00Z',data:snapshot};
(async()=>{
 const encrypted=await api.encryptBackup(original,pass);
 assert.equal(encrypted.format,'universa-art-encrypted-backup-v1');
 assert.equal(encrypted.algorithm,'AES-256-GCM');
 assert.equal(encrypted.iterations,310000);
 assert(!JSON.stringify(encrypted).includes('Cliente teste'),'Backup não deve revelar dados em claro');
 assert.equal((await api.decryptBackup(encrypted,pass)).clients[0].nome,'Cliente teste');
 await assert.rejects(api.decryptBackup(encrypted,'senha-errada-longa'),/Senha incorreta/);
 await assert.rejects(api.encryptBackup(original,'curta'),/pelo menos 12/);
 await assert.rejects(api.decryptBackup({...encrypted,iterations:100},pass),/parâmetros/);
 window.oficinaCloud.active=true;
 await assert.rejects(api.restoreData(encrypted,pass),/Desative a sincronização/);
 window.oficinaCloud.active=false;
 ctx.db.clients=[];
 assert.equal(await api.restoreData(encrypted,pass),true);
 assert.equal(ctx.db.clients.length,1);
 assert.equal(saved,1,'Dados devem ser salvos uma vez');
 assert.equal(confirmations,1);
 assert.equal(downloaded,1,'Antes de substituir, solicitar download do backup de segurança');
 assert(api.filename().startsWith('UniversaArt_Backup_'));
 assert.equal(count,1,'Módulo não deve forçar o usuário para outra página');
 console.log('OK: AES-256-GCM, senha não persistida, restauração bloqueada em nuvem ativa e backup preventivo.');
})().catch(error=>{console.error(error);process.exitCode=1});
