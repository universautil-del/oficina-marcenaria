/* Teste de regressão — Adicionar logotipo OFICINA 1.0. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../preview-v1/script.js'),'utf8');
const a=source.indexOf('function uploadLogo(){'),b=source.indexOf('function documentsView(){',a);
assert(a>=0&&b>a,'Funções de upload existentes');
const code=source.slice(a,b);new vm.Script(code,{filename:'logo-functions.js'});
assert(source.includes('id="uaCompanyLogoInput"'),'O seletor deve existir dentro da página');
assert(source.includes('id="uaCompanyLogoPreview"'));
assert(source.includes('id="uaCompanyLogoStatus"'));
const handlers={},status={textContent:''},preview={innerHTML:''},trigger={disabled:false};
let clicks=0,saves=0,fail=false,revoked=0;
const input={files:[],value:'',click(){clicks++}};
const content={
 querySelector(q){
  return ({
   '#uaCompanyLogoInput':input,
   '#uaCompanyLogoStatus':status,
   '#uaCompanyLogoPreview':preview,
   '[data-action="upload-logo"]':trigger
  })[q]??null;
 }
};
class FakeImage{
 naturalWidth=1200;naturalHeight=600;
 set src(value){this._src=value;queueMicrotask(()=>{if(value==='blob:invalid')this.onerror?.();else this.onload?.()})}
 get src(){return this._src}
}
const fakeUrl={
 createObjectURL(blob){return blob.name==='invalid'?'blob:invalid':'blob:valid'},
 revokeObjectURL(){revoked++}
};
const browser={
 getContext(){return {drawImage(){}}},
 toDataURL(){return 'data:image/webp;base64,'+'A'.repeat(2000)}
};
const doc={
 addEventListener(name,fn){handlers[name]=fn},
 createElement(tag){assert.equal(tag,'canvas');return {width:0,height:0,...browser}}
};
const db={version:3,company:{nome:'Universa Art',logo:'data:image/png;base64,ANTIGA'},clients:[],products:[],quotes:[],orders:[],transactions:[],stockMovements:[]};
const context={db,content,document:doc,
 save(){saves++;return !fail},
 alert(e){throw Error('Alerta inesperado: '+e)},
 URL:fakeUrl,Image:FakeImage,Blob,Math,JSON,String,Number,Promise,Error,
 window:{UNIVERSA_REQUIRE_AUTH:true},
 esc:x=>String(x).replace(/"/g,'&quot;')
};
vm.runInNewContext(code,context,{timeout:2000});
assert.equal(typeof context.uploadLogo,'function');
context.uploadLogo();assert.equal(clicks,1,'Botão deve abrir campo de arquivo existente no DOM');
(async()=>{
 const original=db.company.logo;
 input.files=[{name:'teste.webp',type:'image/webp',size:13000}];
 await handlers.change({target:{id:'uaCompanyLogoInput',files:input.files}});
 assert.equal(saves,1);
 assert(db.company.logo.startsWith('data:image/webp;base64,'));
 assert(preview.innerHTML.includes('Logotipo atual da empresa'));
 assert(status.textContent.includes('Sincronizado'),'Mensagem deve distinguir salvar local de sincronizar');
 assert.equal(revoked,1,'URL de imagem deve ser liberada');
 assert.equal(trigger.disabled,false);
 assert.equal(input.value,'');
 const committed=db.company.logo;
 input.files=[{name:'mau.svg',type:'image/svg+xml',size:500}];
 await handlers.change({target:{id:'uaCompanyLogoInput',files:input.files}});
 assert.equal(db.company.logo,committed,'SVG rejeitado sem alterar a imagem');
 assert.equal(saves,1);
 assert(status.textContent.includes('PNG, JPG ou WebP'));
 input.files=[{name:'grande.jpg',type:'image/jpeg',size:5000000}];
 await handlers.change({target:{id:'uaCompanyLogoInput',files:input.files}});
 assert.equal(saves,1,'Não salvar imagem >4 MB');
 fail=true;
 input.files=[{name:'nova.png',type:'image/png',size:123000}];
 await handlers.change({target:{id:'uaCompanyLogoInput',files:input.files}});
 assert.equal(db.company.logo,committed,'Falha de persistência preserva logo anterior');
 assert(status.textContent.includes('Não foi possível salvar'));
 assert.equal(revoked,2);
 assert.equal(trigger.disabled,false);
 assert.notEqual(original,committed);
 console.log('OK botão de logotipo: seletor DOM, imagem compactada, aviso sincronização, formatos, falha com rollback.');
})().catch(e=>{console.error(e);process.exitCode=1});
