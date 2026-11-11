/* Interface de backups automáticos Supabase: sem dados reais, sem serviço externo. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{webcrypto}=require('node:crypto');
const source=fs.readFileSync(path.join(__dirname,'../preview-v1/backup-oficina-v1.js'),'utf8');
new vm.Script(source);
const listeners={},files=[];
const data={version:3,clients:[{id:'cli1',nome:'Nome Teste Privado'}],products:[],quotes:[],orders:[],transactions:[],stockMovements:[],suppliers:[],projects:[],purchases:[]};
const list=[{id:22,semana_utc:'2026-11-09',criado_em:'2026-11-11T15:00:00Z',revisao_origem:7},{id:19,semana_utc:'2026-11-02',criado_em:'2026-11-04T15:00:00Z',revisao_origem:5}];
let scans=0,gets=0,downloaded=0;
const pass={value:'senha-forte-secreta-backup-2026'};
const status={textContent:''};
const document={
 body:{appendChild(){}},
 addEventListener(name,fn){listeners[name]=fn},
 querySelector(selector){if(selector==='#uaBackupPass')return pass;if(selector==='#uaBackupNotice')return status;return null},
 createElement(){return{href:'',download:'',click(){downloaded++},remove(){}}}
};
const URL={last:null,createObjectURL(blob){this.last=blob;return'blob:teste'},revokeObjectURL(){}};
const ctx={db:data,window:{UNIVERSA_REQUIRE_AUTH:true,oficinaCloud:{active:true,paused:false,async weeklyBackupStatus(){return {agendamento_ativo:true,quantidade:2,retencao:4}},async listWeeklyBackups(){scans++;return list},async getWeeklyBackup(id){gets++;assert.equal(id,22);return {id,dados:data,revisao_origem:7}}}},
 sections:[['dashboard','▦','Dashboard']],content:{innerHTML:''},nav:{innerHTML:'',querySelectorAll(){return[]}},
 title:{textContent:''},sidebar:{classList:{remove(){}}},location:{hash:'#dashboard'},
 render(){},document,crypto:webcrypto,TextEncoder,TextDecoder,Blob,URL,
 btoa:x=>Buffer.from(x,'binary').toString('base64'),atob:x=>Buffer.from(x,'base64').toString('binary'),
 esc:v=>String(v??''),validateBackup:o=>({kind:o.version===3?3:0,data:o.data}),save:()=>true,
 confirm:()=>true,setTimeout(){},Date,Math,JSON,String,Number,Map,Set,Uint8Array,Error,Promise};
vm.runInNewContext(source,ctx,{timeout:2000});
const api=ctx.window.universaArtBackup;
assert(api);
ctx.location.hash='#backupdrive';ctx.render('backupdrive');
assert(ctx.content.innerHTML.includes('Backup automático semanal'));
assert(ctx.content.innerHTML.includes('Copias semanais'));
assert(!ctx.content.innerHTML.includes('Google Drive'));
assert(!ctx.content.innerHTML.includes('OAuth Client ID'));
(async()=>{
 await api.scanWeekly();
 assert(scans>=1);
 assert(ctx.content.innerHTML.includes('2 de 4 cópias'));
 assert(ctx.content.innerHTML.includes('Agendamento semanal ativo'));
 assert(ctx.content.innerHTML.includes('data-backup-id="22"'));
 const unchanged=JSON.stringify(ctx.db);
 await listeners.click({target:{closest(){return {dataset:{uaBackupAction:'download-weekly',backupId:'22'},disabled:false}}}});
 assert.equal(gets,1);
 assert.equal(downloaded,1);
 const encrypted=JSON.parse(await URL.last.text());
 assert.equal(encrypted.format,'universa-art-encrypted-backup-v1');
 assert(!JSON.stringify(encrypted).includes('Nome Teste Privado'),'Download semanal deve ser criptografado');
 assert.equal((await api.decryptBackup(encrypted,pass.value)).clients[0].nome,'Nome Teste Privado');
 assert.equal(JSON.stringify(ctx.db),unchanged,'Download nao deve alterar documento principal');
 console.log('OK UI: sem Google, lista snapshots, download cifrado, recuperacao e documento imutavel.');
})().catch(e=>{console.error(e);process.exitCode=1});
