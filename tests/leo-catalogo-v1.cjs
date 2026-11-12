/* OFICINA — catálogo consultivo Léo Madeiras, sem prometer estoque ao vivo. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const source=read('preview-v1/leo-catalogo-v1.js');
new vm.Script(source,{filename:'leo-catalogo-v1.js'});
const listeners={};let latestDialog=null,created=0;
function node(id){
 return {
  id,innerHTML:'',value:'',checked:false,isConnected:true,open:false,
  events:{},options:[],focus(){},dispatchEvent(){},
  addEventListener(type,handler){this.events[type]=handler},
  setAttribute(){},remove(){this.removed=true},
  showModal(){this.open=true},close(){this.open=false;if(this.events.close)this.events.close()},
  querySelector(){return null}
 };
}
const document={
 addEventListener:(name,callback)=>{listeners[name]=callback},
 createElement:tag=>{
  assert.equal(tag,'dialog');created++;
  const d=node('dialog');
  const controls={
   uaLeoClose:node('uaLeoClose'),uaLeoCategory:node('uaLeoCategory'),
   uaLeoQuery:node('uaLeoQuery'),uaLeoResults:node('uaLeoResults'),
   uaLeoCategoryLink:node('uaLeoCategoryLink'),uaLeoFillCost:node('uaLeoFillCost')
  };
  d.querySelector=selector=>controls[selector.slice(1)]||null;
  d.controls=controls;latestDialog=d;return d;
 },
 body:{append(){}}
};
const window={};
const ctx={window,document,Event:class Event{constructor(type){this.type=type}},Intl,Array,Object,Math,Date,Number,String,Error};
vm.runInNewContext(source,ctx,{timeout:3000});
const api=window.universaArtLeoCatalogo;
assert(api&&api.items.length>=12);
assert.equal(api.filter('mdf','15 mm').length,3);
assert.equal(api.filter('parafusos','4 x 40').length,1);
assert.equal(api.filter('buchas','8 mm').length,1);
assert.equal(api.filter('fitas','35 mm').length,1);
assert(api.priceNotice().includes('NÃO são verificados em tempo real'));
assert(!source.includes('fetch('),'Sem coleta não autorizada de dados do varejista');
assert(!source.includes('save('),'Catálogo não pode gravar pedidos ou estoque');
assert(!source.includes('localStorage'),'Não persiste dados comerciais');
assert(api.items.every(i=>i.price>0&&i.unit&&api.categories[i.category]?.url.startsWith('https://checkout.leomadeiras.com.br/')));

const projectInput=node('material');projectInput.name='material';
const db={projects:[{nome:'Projeto real'}],products:[],transactions:[]};
const before=JSON.stringify(db);
const project={
 isConnected:true,
 querySelector:sel=>sel==='[name="material"]'?projectInput:null
};
assert(api.open({closest:()=>project}));
assert(latestDialog.open);
assert(latestDialog.controls.uaLeoResults.innerHTML.includes('Selecionar'));
assert(latestDialog.controls.uaLeoResults.innerHTML.includes('R$'));
latestDialog.events.click({target:{closest:sel=>sel==='[data-ua-leo-use]'?{dataset:{uaLeoUse:'0'}}:null}});
assert.equal(projectInput.value,api.items[0].name,'Selecionar preenche apenas material do projeto');
assert(!latestDialog.open,'Catálogo fecha após seleção');
assert.equal(JSON.stringify(db),before,'Não alterar dados registrados');

const fields={
 '[name="nome"]':node('nome'),'[name="categoria"]':node('categoria'),
 '[name="unidade"]':node('unidade'),'[name="custo"]':node('custo'),
 '[name="espessuraMm"]':node('espessuraMm'),
 '[name="chapaComprimentoMm"]':node('comprimento'),
 '[name="chapaLarguraMm"]':node('largura')
};
fields['[name="nome"]'].name='nome';
fields['[name="custo"]'].value='0';
fields['[name="unidade"]'].options=[{value:'chapa'},{value:'pacote'},{value:'un'}];
const productForm={isConnected:true,querySelector:sel=>fields[sel]||null};
api.open({closest:()=>productForm});
latestDialog.controls.uaLeoCategory.value='mdf';
latestDialog.controls.uaLeoCategory.events.change();
latestDialog.events.click({target:{closest:sel=>sel==='[data-ua-leo-use]'?{dataset:{uaLeoUse:'0'}}:null}});
assert.equal(fields['[name="nome"]'].value,api.items[0].name);
assert.equal(fields['[name="custo"]'].value,'0','Preço não pode preencher o custo sem autorização');
assert.equal(fields['[name="unidade"]'].value,'chapa');
assert.equal(fields['[name="espessuraMm"]'].value,'15');
assert.equal(fields['[name="chapaComprimentoMm"]'].value,'2750');
assert.equal(fields['[name="chapaLarguraMm"]'].value,'1840');
api.open({closest:()=>productForm});
latestDialog.controls.uaLeoCategory.value='parafusos';
latestDialog.controls.uaLeoCategory.events.change();
latestDialog.controls.uaLeoFillCost.checked=true;
latestDialog.events.click({target:{closest:sel=>sel==='[data-ua-leo-use]'?{dataset:{uaLeoUse:'0'}}:null}});
assert.equal(fields['[name="unidade"]'].value,'pacote');
assert.equal(fields['[name="custo"]'].value,'2.49','Preencher preço apenas após escolha explícita');
assert.equal(JSON.stringify(db),before);
assert(created>=3);

for(const file of ['preview-v1/index.html','preview-v1/seguro.html']){
 const html=read(file);
 assert(html.includes('leo-catalogo-v1.js')&&html.includes('leo-catalogo-v1.css'));
 assert(html.includes('leomadeiras-referencias-20261112'));
}
assert(read('preview-v1/features-v05.js').includes('data-ua-leo-open'),'Disponível no projeto');
assert(read('preview-v1/universalartes-v1.js').includes('data-ua-leo-open'),'Disponível no assistente');
assert(read('preview-v1/catalogo-produtos-1-0.js').includes('data-ua-leo-open'),'Disponível em matérias-primas');
console.log('OK: catálogo Léo Madeiras, preços de referência, filtros, formulários e preservação de estoque/financeiro.');
