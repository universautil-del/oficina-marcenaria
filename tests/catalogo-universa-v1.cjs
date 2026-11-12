/* Regressão: catálogo UNIVERSA ART importado do Excel e sem estoque. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {performance}=require('node:perf_hooks');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const source=read('preview-v1/catalogo-universa-v1.js');
const dataSource=read('preview-v1/catalogo-universa-dados-v1.js');
const css=read('preview-v1/catalogo-universa-v1.css');
new vm.Script(source);
new vm.Script(dataSource);
assert(source.length<22000&&css.length<8000,'Janela compacta');
assert(dataSource.length<85000,'Dados devem carregar somente sob demanda');
assert(!source.includes('leomadeiras.com.br')&&!source.includes('data-ua-leo')&&!source.includes('Ver na Léo'));
assert(!source.includes('fetch('),'Filtros não fazem pesquisas na internet');
assert(!source.includes('save('),'Não grava no estoque automaticamente');
let countScript=0,dlg=null;
const alerts=[],writes=[];
function node(id){
 return {
  id,value:'',textContent:'',innerHTML:'',checked:false,open:false,isConnected:true,hidden:false,
  events:{},options:[],focus(){},scrollIntoView(){},dispatchEvent(){},remove(){this.removed=true},
  addEventListener(n,fn){this.events[n]=fn;},
  setAttribute(){},showModal(){this.open=true},close(){this.open=false;if(this.events.close)this.events.close()},
  closest(sel){return sel==='label'?this.parentLabel:null}
 };
}
let context,docListeners={};
const document={
 addEventListener:(name,fn)=>{docListeners[name]=fn},
 createElement(tag){
  const o=node(tag);
  if(tag==='script')return o;
  assert.equal(tag,'dialog');
  const keys=['Close','Category','Query','Brand','Size','Color','Results','Count','Notice','Clear','More','Simulator','QuoteName','Quantity','UnitPrice','Total','QuoteHint','Copy','CopyStatus'];
  const controls=Object.fromEntries(keys.map(k=>['uaMat'+k,node('uaMat'+k)]));
  controls.uaMatBrand.parentLabel={hidden:false};controls.uaMatSize.parentLabel={hidden:false};controls.uaMatColor.parentLabel={hidden:false};
  controls.uaMatSimulator.hidden=true;
  o.querySelector=s=>controls[s.slice(1)]||null;
  o.controls=controls;dlg=o;return o
 },
 head:{appendChild(script){
  countScript++;
  assert(script.src.includes('catalogo-universa-dados-v1.js'));
  vm.runInNewContext(dataSource,context,{timeout:1500});
  script.onload();
 }},
 body:{append(){}}
};
const window={};const db={orders:[{id:'p1'}],products:[{id:'m1',estoque:10}],transactions:[{id:'t1'}]};const before=JSON.stringify(db);
context={window,document,alert:message=>alerts.push(message),navigator:{clipboard:{writeText:async txt=>writes.push(txt)}},Event:class Event{constructor(type){this.type=type}},Math,Number,String,Date,Array,Promise,Set,Map,Intl,Error};
vm.runInNewContext(source,context,{timeout:2000});
const api=window.universaArtCatalogoProprio;
assert(api&&api.items.length===0,'Não carregar Excel ao abrir o site');
assert(countScript===0);
const formField=node('material');formField.name='material';
const form={isConnected:true,querySelector:k=>k==='[name="material"]'?formField:null};
async function test(){
 assert.equal(await api.open({closest:()=>form}),true);
 assert.equal(countScript,1);
 assert.equal(api.items.length,218,'122 materiais + 96 referências MDF');
 const groups=Object.fromEntries(Object.keys(api.groups).map(g=>[g,api.filter(g).length]));
 assert.deepEqual(groups,{mdf:128,chapas:11,parafusos:16,buchas:7,fitas:16,ferragens:40});
 assert.equal(api.items.filter(i=>i.id.startsWith('MAT-')).length,122);
 assert.equal(api.items.filter(i=>i.id.startsWith('MDF-P')).length,96);
 assert.equal(api.items.filter(i=>i.category==='mdf'&&i.thickness===null).length,89);
 assert(api.items.every(i=>i.price===null),'Valores do Excel em branco');
 assert.equal(api.filter('mdf','MDF-P091')[0].thickness,15);
 assert.equal(api.filter('mdf','Doce de Leite')[0].thickness,null);
 assert(api.priceNotice().includes('independente do estoque'));
 assert(dlg.innerHTML.includes('Catálogo de Materiais — UNIVERSA ART'));
 assert(!dlg.innerHTML.includes('Léo Madeiras'));
 assert(!dlg.innerHTML.includes('Ver na Léo'));
 assert(dlg.controls.uaMatCount.textContent.includes('218'));
 assert(dlg.controls.uaMatResults.innerHTML.includes('A cotar'));
 assert.equal((dlg.controls.uaMatResults.innerHTML.match(/class="ua-mat-item"/g)||[]).length,20,'Mostrar apenas 20 para manter leve');
 dlg.controls.uaMatMore.events.click();
 assert.equal((dlg.controls.uaMatResults.innerHTML.match(/class="ua-mat-item"/g)||[]).length,40);
 dlg.controls.uaMatCategory.value='mdf';dlg.controls.uaMatCategory.events.change();
 assert(dlg.controls.uaMatSize.innerHTML.includes('A confirmar'),'Padrões sem medida permanecem sem medida');
 dlg.controls.uaMatQuery.value='MDF-P091';
 dlg.controls.uaMatQuery.events.input();
 assert(dlg.controls.uaMatResults.innerHTML.includes('MDF-P091'));
 assert(dlg.controls.uaMatResults.innerHTML.includes('15 mm'));
 dlg.controls.uaMatQuery.value='Doce de Leite';
 dlg.controls.uaMatQuery.events.input();
 assert(dlg.controls.uaMatResults.innerHTML.includes('Espessura a confirmar'));
 dlg.controls.uaMatClear.events.click();
 assert.equal(dlg.controls.uaMatCategory.value,'');
 assert(dlg.controls.uaMatResults.innerHTML.includes('MAT-001'));
 const first=api.items[0];
 dlg.events.click({target:{closest:sel=>sel==='[data-ua-mat-quote]'?{dataset:{uaMatQuote:'0'}}:null}});
 assert.equal(dlg.controls.uaMatSimulator.hidden,false);
 assert.equal(dlg.controls.uaMatUnitPrice.value,'','Sem preço na planilha não preencher automaticamente');
 assert.equal(api.estimate(first,3,''),null);
 assert.equal(api.estimate(first,3,120),360);
 dlg.controls.uaMatQuantity.value='3';dlg.controls.uaMatUnitPrice.value='120';
 dlg.controls.uaMatUnitPrice.events.input();
 assert(dlg.controls.uaMatTotal.textContent.includes('360,00'));
 await dlg.controls.uaMatCopy.events.click();
 assert.equal(writes.length,1);
 assert(writes[0].includes('Valor informado manualmente'));
 const selected=api.items[0];
 dlg.events.click({target:{closest:sel=>sel==='[data-ua-mat-select]'?{dataset:{uaMatSelect:'0'}}:null}});
 assert.equal(formField.value,selected.name);
 assert.equal(dlg.open,false);
 assert.equal(JSON.stringify(db),before);
 const fields={
  '[name="nome"]':node('nome'),'[name="categoria"]':node('categoria'),
  '[name="unidade"]':node('unidade'),'[name="custo"]':node('custo'),
  '[name="espessuraMm"]':node('thickness'),'[name="chapaLarguraMm"]':node('width'),
  '[name="chapaComprimentoMm"]':node('length')
 };
 fields['[name="nome"]'].name='nome';fields['[name="unidade"]'].options=[{value:'chapa'},{value:'un'},{value:'m'},{value:'par'}];
 fields['[name="custo"]'].value='999';fields['[name="espessuraMm"]'].value='25';fields['[name="chapaLarguraMm"]'].value='999';
 const productForm={isConnected:true,querySelector:k=>fields[k]||null};
 assert(await api.open({closest:()=>productForm}));
 assert.equal(countScript,1,'A planilha é carregada só uma vez');
 dlg.controls.uaMatCategory.value='mdf';dlg.controls.uaMatCategory.events.change();
 dlg.controls.uaMatQuery.value='MDF-P001';dlg.controls.uaMatQuery.events.input();
 dlg.events.click({target:{closest:sel=>sel==='[data-ua-mat-select]'?{dataset:{uaMatSelect:'0'}}:null}});
 assert(fields['[name="nome"]'].value.includes('Doce de Leite'));
 assert.equal(fields['[name="espessuraMm"]'].value,'','Não inventar espessura de padrão');
 assert.equal(fields['[name="chapaLarguraMm"]'].value,'','Não inventar largura');
 assert.equal(fields['[name="custo"]'].value,'','Não inventar custo e limpar custo antigo de outro material');
 assert.equal(JSON.stringify(db),before);
 assert(await api.open({closest:()=>productForm}));
 dlg.controls.uaMatCategory.value='mdf';dlg.controls.uaMatCategory.events.change();
 dlg.controls.uaMatQuery.value='MDF-P091';dlg.controls.uaMatQuery.events.input();
 dlg.events.click({target:{closest:sel=>sel==='[data-ua-mat-select]'?{dataset:{uaMatSelect:'0'}}:null}});
 assert.equal(fields['[name="espessuraMm"]'].value,'15');
 assert.equal(fields['[name="chapaLarguraMm"]'].value,'1850');
 assert.equal(fields['[name="chapaComprimentoMm"]'].value,'2750');
 assert.equal(fields['[name="custo"]'].value,'');
 assert.equal(JSON.stringify(db),before);

 const t=performance.now();
 for(let i=0;i<3000;i++)api.filter(i%2?'mdf':'parafusos',i%2?'Amendola':'4x40');
 const elapsed=Math.round(performance.now()-t);
 console.log('Desempenho: 3000 filtros em '+elapsed+' ms, JS '+source.length+' B, dados lazy '+dataSource.length+' B.');
 assert(elapsed<4000,'Filtro local leve');
 for(const file of ['preview-v1/index.html','preview-v1/seguro.html']){
  const html=read(file);
  assert(html.includes('catalogo-universa-v1.js')&&html.includes('catalogo-universa-v1.css'));
  assert(!html.includes('src="leo-catalogo-v1.js'),'Não carregar catálogo Léo antigo');
  assert(!html.includes('src="catalogo-universa-dados-v1.js'),'Dados carregados sob demanda');
 }
 for(const file of ['preview-v1/features-v05.js','preview-v1/universalartes-v1.js','preview-v1/catalogo-produtos-1-0.js']){
  const js=read(file);
  assert(js.includes('data-ua-material-open'),'Botão novo em '+file);
  assert(!js.includes('data-ua-leo-open'),'Remover botão antigo '+file);
  assert(!js.includes('na Léo Madeiras')&&!js.includes('Consultar produtos Léo'),'Sem marca antiga no botão');
 }
 assert.equal(alerts.length,0);
 console.log('OK: 218 materiais do Excel, 128 MDF, filtros, preço a cotar, formulários sem escrita e interface sem Léo.');
}
test().catch(e=>{console.error(e);process.exitCode=1});
