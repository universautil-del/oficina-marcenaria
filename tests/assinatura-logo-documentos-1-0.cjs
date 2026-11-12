/* OFICINA 1.0 — assinatura privada, logo novo e presença em pedidos, contratos e recibos. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const page=read('preview-v1/seguro.html'),sig=read('preview-v1/assinatura-privada-1-0.js');
const sale=read('preview-v1/documentos-padrao-1-0.js');
const contract=read('preview-v1/contrato-universa-art-design-1-0.js');
const core=read('preview-v1/script.js'),extra=read('preview-v1/features-v05.js');
const purchases=read('preview-v1/upgrade.js');
new vm.Script(sig);
const asset=fs.readFileSync(path.join(root,'preview-v1/assets/universa-art-logo-novo.webp'));
assert.equal(asset.toString('ascii',0,4),'RIFF');
assert.equal(asset.toString('ascii',8,12),'WEBP');
assert(asset.length>1500);
assert(page.includes('assinatura-privada-1-0.js')&&page.includes('assinatura-privada-1-0.css'));
assert(page.includes('assets/universa-art-logo-novo.webp'));
assert(page.indexOf('assinatura-privada-1-0.js')>page.indexOf('contrato-universa-art-design-1-0.js'));
assert(!read('preview-v1/index.html').includes('assinatura-privada-1-0.js'),'Prévia pública não pode salvar assinatura');
for(const [name,file] of [['Pedido',sale],['Contrato',contract],['Recibo individual',core],
 ['Recibo de quitação',extra],['Pedido de compra',purchases]]){
 assert(file.includes('universaArtAssinatura?.image?.'),'Imagem condicional faltante: '+name);
}
let saves=0,success=true,listener={};
const db={company:{nome:'UNIVERSA ART DESIGN'},clients:[],orders:[],purchases:[]};
const mockImage={naturalWidth:300,naturalHeight:120,set src(v){queueMicrotask(()=>this.onload?.())}};
const doc={
 addEventListener(n,fn){listener[n]=fn},
 querySelectorAll(){return []},
 createElement(tag){
  if(tag!=='canvas')return {innerHTML:'',querySelector:()=>null,append(){},textContent:''};
  const canvas={width:1,height:1};
  canvas.getContext=()=>({
   drawImage(){},fillRect(){},
   getImageData(){
    const data=new Uint8ClampedArray(canvas.width*canvas.height*4);
    data.fill(255);
    const x=Math.min(20,canvas.width-1),y=Math.min(20,canvas.height-1),i=(y*canvas.width+x)*4;
    data[i]=30;data[i+1]=30;data[i+2]=170;
    return {data};
   }
  });
  canvas.toDataURL=()=> 'data:image/webp;base64,QUJD';
  return canvas;
 }
};
const win={UNIVERSA_REQUIRE_AUTH:true,oficinaCloud:{active:true}};
const ctx={window:win,db,document:doc,content:{querySelector(){return null}},
 companyView:()=>true,processCompanyLogo:async()=>true,render:()=>true,
 URL:{createObjectURL:()=> 'blob:img',revokeObjectURL(){}},
 Image:class{naturalWidth=300;naturalHeight=120;set src(v){queueMicrotask(()=>this.onload?.())}},
 save:()=>{saves++;return success},Blob,Uint8ClampedArray,
 Number,Math,Date,String,Error,Promise,console,location:{hash:'#empresa'},alert:()=>{},
 confirm:()=>true};
vm.runInNewContext(sig,ctx,{timeout:1500});
const api=win.universaArtAssinatura;
assert(api&&typeof api.processSignature==='function');
assert.equal(api.source(),'');
assert.equal(api.image(),'');
db.company.assinaturaImagem='data:image/svg+xml;base64,PHN2Zz4=';
assert.equal(api.image(),'','SVG nunca deve aparecer nos documentos');
delete db.company.assinaturaImagem;
assert(api.logoSource===undefined,'Não expor operações administrativas');
assert(api.image('alert" onclick="bad').startsWith(''));
// Upload no perfil autenticado — sem arquivos públicos.
(async()=>{
 const uploaded={name:'assinatura.png',type:'image/png',size:3000};
 const value=await api.processSignature(uploaded);
 assert.equal(value,'data:image/webp;base64,QUJD');
 assert.equal(api.source(),value);
 assert(api.image('ua-receipt-sig-img').includes('ua-receipt-sig-img'));
 assert.equal(saves,1);
 success=false;
 await assert.rejects(api.processSignature(uploaded),/não foi salva/);
 assert.equal(db.company.assinaturaImagem,value,'Falha de salvar não remove assinatura antiga');
 win.oficinaCloud.active=false;
 await assert.rejects(api.processSignature(uploaded),/autenticada/);
 assert.equal(db.company.assinaturaImagem,value);
 assert(!JSON.stringify(db).includes('private-user-images'),'Nenhuma URL pública');
 console.log('OK assinatura: arquivo privado no Supabase autenticado, formato validado, prévia, rollback e logo institucional público.');
})().catch(e=>{console.error(e);process.exitCode=1});
