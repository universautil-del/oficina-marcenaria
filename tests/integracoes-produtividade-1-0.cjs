/* Teste integrado OFICINA 1.0 — produtividade sem gravar duplicado. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const js=fs.readFileSync(path.join(__dirname,'../preview-v1/integracoes-produtividade-1-0.js'),'utf8');
const upgrade=fs.readFileSync(path.join(__dirname,'../preview-v1/upgrade.js'),'utf8');
const sales=fs.readFileSync(path.join(__dirname,'../preview-v1/script.js'),'utf8');
const page=fs.readFileSync(path.join(__dirname,'../preview-v1/seguro.html'),'utf8');
new vm.Script(js,{filename:'integracoes-produtividade-1-0.js'});
assert(page.includes('integracoes-produtividade-1-0.js')&&page.includes('integracoes-produtividade-1-0.css'));
assert(upgrade.includes('function purchaseModal(prefillItems=[])'));
assert(upgrade.includes('validated.forEach(row=>addPurchaseRow(dlg,row))'));
assert(sales.includes('Lista SketchUp:'));
const clients=[{id:'c1',nome:'Cliente Demonstrativo',telefone:'11999998888'},{id:'c2',nome:'Sem telefone'}];
const db={
 clients,projects:[{id:'pr1',nome:'Cozinha',clientId:'c1',cutlist:{parts:[
  {name:'Lateral',material:'MDF Branco TX 15',length:2000,width:1000,thickness:15,qty:2,edge:1.2},
  {name:'Prateleira',material:'Carvalho',length:1000,width:500,thickness:15,qty:1,edge:0.6}
 ]}}],
 products:[
  {id:'p1',nome:'MDF Branco TX 15',tipo:'materia',codigo:'01',estoque:2,minimo:5,custo:60,unidade:'chapa'},
  {id:'p2',nome:'Dobradiça',tipo:'materia',codigo:'02',estoque:5,minimo:5,custo:25,unidade:'un'},
  {id:'p3',nome:'Corrediça',tipo:'materia',codigo:'03',estoque:6,minimo:3,custo:20,unidade:'par'}
 ],
 purchases:[{id:'pur1',status:'aberta',items:[{productId:'p1',quantidade:2},{productId:'p2',quantidade:1}]}],
 orders:[{id:'o1',controlCode:'PED-2026-001',status:'confirmado',clientId:'c1',clientNome:'Cliente Demonstrativo',entregaData:'2026-11-12'},
 {id:'o2',controlCode:'PED-2026-002',status:'confirmado',stockState:'pendente',clientId:'c1',clientNome:'Cliente Demonstrativo',materials:[{productId:'p1',quantidade:6}]}],
 transactions:[{id:'t1',kind:'receber',descricao:'Parcela pendente',dueDate:'2026-11-11',valor:500,payments:[]}],
 quotes:[],stockMovements:[]
};
let saved=0,imported=[],opened=[],dialogs=[],currentDlg,renderCalls=0;
const contentMock={
 isConnected:true,innerHTML:'',
 insertAdjacentHTML(position,html){this.innerHTML+=html},
 querySelector(selector){if(selector==='#uaIntegrationsHub')return this.innerHTML.includes('id="uaIntegrationsHub"')?{}:null;return null},
 querySelectorAll(){return[]}
};
const makeDialog=()=>({
 className:'',innerHTML:'',_listeners:{},removed:false,
 querySelector(selector){
  if(['[data-ua-int-close]','[data-ua-int-buy]','[data-ua-int-products]'].includes(selector)){
    this.buttons??={};return this.buttons[selector]??=( {onclick:null} );
  }
  if(selector==='form'){if(!this.form)this.form={};return this.form}
  const m=/^\[name="qty-(.*?)"\]$/.exec(selector);
  if(m)return {value:m[1]==='p1'?'1':'1'};
  return null;
 },
 querySelectorAll(selector){
  if(selector==='input[name="materials"]:checked')return [{value:'p1'}];
  return [];
 },
 addEventListener(name,fn){this._listeners[name]=fn},
 showModal(){},
 close(){this._listeners.close?.()},
 remove(){this.removed=true}
});
const doc={
 body:{append(el){currentDlg=el;dialogs.push(el)}},
 createElement:()=>makeDialog(),
 addEventListener(){}
};
const mock={
 db,content:contentMock,document:doc,window:{
  UNIVERSA_REQUIRE_AUTH:true,oficinaCloud:{active:true},
  universaArtProjectBridge:{normalizeParts:x=>x},
  open:(url,...args)=>{opened.push({url,args});return {}}
 },
 render:section=>{renderCalls++;contentMock.innerHTML='<div>Visualização '+section+'</div>'},
 openModal:(name,html)=>{imported.push({name,html});return {querySelector:()=>({textContent:''})}},
 purchaseModal:items=>{imported.push({items})},
 openSales:(...args)=>{imported.push({sales:args})},
 iso:()=>'2026-11-11',
 balance:t=>Math.max(0,t.valor-(t.payments||[]).reduce((v,x)=>v+x.valor,0)),
 esc:x=>String(x??'').replace(/[&<>"']/g,''),
 td:(...a)=>a.join('|'),table:(heads,rows)=>rows.join('\n'),
 alert:x=>{throw Error('Alerta inesperado: '+x)},
 money:x=>'R$ '+Number(x).toFixed(2),
 location:{hash:'#dashboard'},Number,String,Math,Date,Map,Set,
};
vm.runInNewContext(js,mock,{timeout:3000});
const api=mock.window.universaArtIntegracoes;
assert(api);
const original=JSON.stringify(db);
const summary=api.analyzeCutlist(db.projects[0]);
assert.equal(summary.count,3);
assert.equal(summary.areaM2,4.5);
assert.equal(summary.edgeM,3.0);
assert.equal(summary.groups[0].productId,'p1');
assert.equal(summary.groups[1].productId,'');
const low=api.proposedPurchase();
assert.equal(low.length,2);
assert.equal(low.find(x=>x.productId==='p1').arriving,2);
assert.equal(low.find(x=>x.productId==='p1').recommended,1,'Compra existente deve ser descontada');
assert.equal(low.find(x=>x.productId==='p2').recommended,0,'Entrada pendente evita duplicação');
assert(!low.find(x=>x.productId==='p3'),'Não incluir produto acima do mínimo');
const due=api.alerts();
assert.equal(due.orders.length,1);
assert.equal(due.orders[0].days,1);
assert.equal(due.financial.length,1);
assert.equal(due.financial[0].days,0);
assert(api.quickActions().includes('Central de integrações'));
const shortfall=api.shortagesForOrder(db.orders[1]);
assert.equal(shortfall.length,1);
assert.equal(shortfall[0].shortage,4,'Descontar saldo 2 de 6');
assert.equal(shortfall[0].arriving,2,'Entrada ainda aberta não gera compra duplicada');
assert.equal(shortfall[0].buy,2,'Só sugerir as 2 unidades realmente descobertas');
const inspected=api.showOrderShortage('o2');
assert.equal(inspected.length,1);
const shortageDialog=dialogs.at(-1);
assert(shortageDialog.innerHTML.includes('PED-2026-002'));
assert(shortageDialog.innerHTML.includes('não reserva materiais'));
shortageDialog.buttons['[data-ua-int-buy]'].onclick();
assert.deepEqual(JSON.parse(JSON.stringify(imported.at(-1).items)),[{productId:'p1',quantidade:2,custo:60}]);
assert.equal(db.purchases.length,1,'Revisão não cria entrada sem confirmar');
mock.render('dashboard');
assert(contentMock.innerHTML.includes('Central de integrações'),'Dashboard precisa exibir integração');
api.modalForProject('pr1');
assert(imported[0].html.includes('4,5 m²'));
assert(imported[0].html.includes('3 m'));
assert(imported[0].html.includes('Conferir vínculo'));
assert(imported[0].html.includes('Preparar orçamento deste projeto'));
assert(imported[0].html.includes('Abrir no assistente'));
assert(js.includes("window.universaArtAssistantProjectId=pid"));
const assistant=fs.readFileSync(path.join(__dirname,'../preview-v1/universalartes-v1.js'),'utf8');
assert(assistant.includes("window.universaArtAssistantProjectId")&&assistant.includes("selector.dispatchEvent(new Event('change'"));
const url=api.whatsAppOrder('o1');
assert.equal(opened.length,1);
assert(url.startsWith('https://wa.me/5511999998888?text='));
assert(decodeURIComponent(url).includes('PED-2026-001'));
assert.equal(saved,0);
api.suggestionsModal();
assert.equal(dialogs.length,1);
assert(dialogs[0].innerHTML.includes('Entradas já abertas'));
dialogs[0].form.onsubmit({preventDefault(){}});
assert.equal(imported.length,3);
assert.equal(imported[2].items[0].productId,'p1');
assert.equal(imported[2].items[0].quantidade,1);
assert.equal(db.purchases.length,1,'Sugestão não deve criar compra no banco');
assert.equal(db.transactions.length,1,'Sugestão não deve criar lançamento financeiro');
assert.equal(db.products[0].estoque,2,'Sugestão não baixa estoque');
assert.equal(JSON.stringify(db),original,'Consultas e rascunhos não devem alterar dados');
console.log('OK: SketchUp→materiais, orçamento, compras sem duplicação, prazos, financeiro e WhatsApp manual.');
