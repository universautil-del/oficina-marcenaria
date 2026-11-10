/* Security regression tests. Run with Node 22: node tests/security-audit.cjs */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const file=p=>fs.readFileSync(path.join(root,p),'utf8');
const pick=(src,start,end)=>{
 const a=src.indexOf(start),b=src.indexOf(end,a+start.length);
 if(a<0||b<=a)throw Error('Não encontrei a função '+start);
 return src.slice(a,b);
};
const outcomes=[];
for(const prefix of ['', 'preview-v1/']){
 const label=prefix||'site principal/';
 const src=file(prefix+'script.js');
 const validate=vm.runInNewContext(pick(src,'function validateBackup(obj){','function importData(')+'\nvalidateBackup',{}, {timeout:1200});
 const old={
  app:'oficina',version:3,data:{version:3,
   clients:[],products:[],quotes:[{number:7}],orders:[{number:8}],
   transactions:[],stockMovements:[],company:{nome:'Universalartes'},seq:{quote:1,order:1}}
 };
 const loaded=validate(old);
 assert.equal(loaded.kind,3);
 for(const k of ['suppliers','purchases','projects','invoices','orderAttachments'])assert(Array.isArray(loaded.data[k]),label+k);
 assert(loaded.data.seq.quote>=8,label+'sequência de orçamento');
 assert(loaded.data.seq.order>=9,label+'sequência de pedido');
 assert(Array.isArray(old.data.projects)===false,'Arquivo original não deve ser alterado');
 const broken=JSON.parse(JSON.stringify(old));broken.data.projects={};
 assert.throws(()=>validate(broken),/projects.*inválido/);
 const legacy=validate({app:'oficina',version:2,clientes:[{nome:'Teste',id:'a'}]});
 assert.equal(legacy.kind,2);
 assert.throws(()=>validate({app:'outro',version:3,data:old.data}),/não é um backup/);

 const features=file(prefix+'features-v05.js');
 const downloadFn=pick(features,'function v5AttachmentDownload(attachmentId){','function v5AttachmentDelete(');
 const pdf=Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF').toString('base64');
 let hits=[],alerts=[];
 const db={orderAttachments:[{id:'a1',name:'contrato.pdf',data:'javascript:alert(1)'}]};
 const ctx={
  db,alerts,alert:t=>alerts.push(t), Blob,Uint8Array,atob:s=>Buffer.from(s,'base64').toString('binary'),
  document:{createElement(tag){assert.equal(tag,'a');return {href:'',download:'',click(){hits.push({href:this.href,name:this.download})}}}},
  URL:{createObjectURL(){return 'blob:test'},revokeObjectURL(){}},
  setTimeout:fn=>fn()
 };
 const download=vm.runInNewContext(downloadFn+'\nv5AttachmentDownload',ctx,{timeout:1200});
 download('a1');
 assert.equal(hits.length,0,'Não abrir javascript: de backup');
 assert.equal(alerts.length,1,'Deve alertar sobre anexo suspeito');
 db.orderAttachments[0].data='data:text/html;base64,'+Buffer.from('<script>alert(1)</script>').toString('base64');
 download('a1');assert.equal(hits.length,0,'Não abrir data:text/html');
 db.orderAttachments[0].data='data:application/pdf;base64,'+pdf;
 db.orderAttachments[0].name='../../contrato?.pdf';
 download('a1');
 assert.equal(hits.length,1,'PDF legítimo deve ser baixado');
 assert.equal(hits[0].href,'blob:test');
 assert(!hits[0].name.includes('/'),'Nome de arquivo não pode conter diretório');
 outcomes.push(label+' backups antigos, anexos e arquivos inválidos OK');
}
for(const p of ['cloud-v06.js','preview-v1/cloud-preview.js']){
 const src=file(p),fn=pick(src,'function isPublicKey(key){','function apiKey(){');
 const isPublicKey=vm.runInNewContext(fn+'\nisPublicKey',{atob:s=>Buffer.from(s,'base64').toString('binary')},{timeout:1200});
 assert(isPublicKey('sb_publishable_123abcABCDEF_1234'),p+' publishable');
 assert(!isPublicKey('sb_secret_foo'),p+' secret');
 const jwt=role=>['head',Buffer.from(JSON.stringify({role})).toString('base64url'),'signature'].join('.');
 assert(isPublicKey(jwt('anon')),p+' anon');
 assert(!isPublicKey(jwt('service_role')),p+' service_role');
 assert(!isPublicKey('eyJhbGciOiJIUzI1NiJ9.fake.bad'),p+' token inválido');
 outcomes.push(p+' chave pública/secret OK');
}
const sql=file('preview-v1/supabase-preview.sql');
assert(sql.includes('enable row level security'));
assert(sql.includes('auth.uid()'));
assert(/grant select,insert,update on public\.universalartes_preview_backups to authenticated/.test(sql));
assert(!/grant .* to anon;/.test(sql.replace(/revoke [^\n]+/g,'')));
for(const item of outcomes)console.log('OK',item);
console.log('Aviso: testes de código NÃO substituem teste real de RLS, login ou banco Supabase.');
