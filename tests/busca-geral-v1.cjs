/* Busca geral do OFICINA: segurança, navegação e ausência de escrita. */
'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const src=read('preview-v1/busca-geral-v1.js');
new vm.Script(src);
const db={
 clients:[{id:'c1',nome:'Ana <img src=x onerror=alert(1)>',cidade:'Santos'}],
 suppliers:[{id:'s1',nome:'Leo Fornecedor'}],
 projects:[{id:'pro1',nome:'Guarda Roupas',ambiente:'Quarto'}],
 quotes:[{id:'q1',controlCode:'ORC-2026-005',clientNome:'Ana'}],
 orders:[{id:'o1',controlCode:'PED-2026-010',clientNome:'Ana'}],
 products:[{id:'m1',nome:'MDF Branco TX 15mm',codigo:'0001'}],
 purchases:[{id:'p1',number:3,supplierNome:'Leo Fornecedor'}],
 transactions:[{id:'t1',kind:'pagar',descricao:'Aluguel da oficina',dueDate:'2026-11-15'}]
};
const original=JSON.stringify(db),windowHandlers={},documentHandlers={};
let headerButton,dialog,opened=0,actions=[],rendered=[],projectInput;
const header={
 querySelector:selector=>selector==='#uaOpenQuickSearch'?headerButton:null,
 insertBefore:node=>{headerButton=node}
};
const mockNode=()=>{
 const listeners={};
 return {
  listeners,value:'',dataset:{},open:false,removed:false,disabled:false,
  addEventListener:(type,fn)=>{listeners[type]=fn},
  remove(){this.removed=true},
  setAttribute(name,value){this[name]=value},
  focus(){},
  dispatchEvent(){},
  showModal(){opened++;this.open=true},
  close(){this.open=false;if(this.listeners.close)this.listeners.close()},
  querySelector(selector){
   if(selector==='#uaQuickClose')return this.closeNode;
   if(selector==='#uaQuickInput')return this.inputNode;
   if(selector==='#uaQuickMatches')return this.resultsNode;
   return null
  },
  get innerHTML(){return this.markup||''},
  set innerHTML(s){this.markup=s}
 }
};
const document={
 querySelector:selector=>selector==='header.top'?header:null,
 createElement:type=>{
  const node=mockNode();node.tagName=type;
  if(type==='dialog'){
   node.closeNode=mockNode();
   node.inputNode=mockNode();
   node.resultsNode=mockNode();
   dialog=node;
  }
  return node;
 },
 body:{append:()=>{}},
 addEventListener:(name,handler)=>{documentHandlers[name]=handler}
};
const window={
 UNIVERSA_REQUIRE_AUTH:true,oficinaCloud:{active:false},
 addEventListener:(name,handler)=>{windowHandlers[name]=handler}
};
const ctx={
 db,window,document,location:{hash:'#dashboard'},search:{cadastros:'',orcamentos:'',pedidos:'',produtos:'',compras:'',financeiro:''},
 sections:['dashboard','cadastros','projetos','orcamentos','pedidos','produtos','compras','financeiro'].map(x=>[x,x,x]),
 content:{querySelector:selector=>selector==='#v5ProjectSearch'?projectInput:null},
 render:section=>rendered.push(section),handleAction:(name)=>actions.push(name),
 esc:s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
 Event:class Event{constructor(type){this.type=type}},String,Array,Map,Set,Math,Number,Error
};
vm.runInNewContext(src,ctx,{timeout:3000});
const api=window.universaArtBuscaGeral;
assert(api&&typeof api.searchAll==='function');
assert(headerButton,'Botão da busca não foi inserido no cabeçalho');
assert.equal(api.openSearch(),false,'Portal bloqueado impede abertura de dados');
assert.equal(opened,0);
window.oficinaCloud.active=true;
assert.equal(api.searchAll('ped-2026-010')[0].section,'pedidos');
assert.equal(api.searchAll('orc-2026-005')[0].section,'orcamentos');
assert.equal(api.searchAll('mdf branco')[0].section,'produtos');
assert.equal(api.searchAll('aluguel')[0].section,'financeiro');
assert.equal(api.searchAll('guarda')[0].section,'projetos');
assert.equal(api.searchAll('LEO')[0].section,'cadastros','Pesquisa deve desconsiderar maiúsculas');
assert.equal(api.searchAll('anA')[0].section,'cadastros');
assert.equal(JSON.stringify(db),original,'Busca não pode modificar cadastros');
api.openSearch();
assert.equal(opened,1);
assert(dialog.innerHTML.includes('Busca geral'));
dialog.inputNode.value='Ana';
dialog.inputNode.listeners.input();
assert(dialog.resultsNode.innerHTML.includes('&lt;img'));
assert(!dialog.resultsNode.innerHTML.includes('<img'),'Não inserir HTML digitado pelo cliente');
dialog.inputNode.value='PED-2026-010';
dialog.inputNode.listeners.input();
assert(dialog.resultsNode.innerHTML.includes('PED-2026-010'));
dialog.listeners.click({target:{closest:selector=>selector==='[data-ua-quick-index]'?{dataset:{uaQuickIndex:'0'}}:null}});
assert.equal(ctx.location.hash,'pedidos');
assert.equal(ctx.search.pedidos,'PED-2026-010');
assert(rendered.includes('pedidos'));
api.openSearch();
dialog.listeners.click({target:{closest:selector=>selector==='[data-ua-quick-task]'?{dataset:{uaQuickTask:'financeiro'}}:null}});
assert(actions.includes('new-transaction'),'Atalho deve aproveitar cadastro financeiro já existente');
api.openSearch();
window.oficinaCloud.active=false;
windowHandlers['ua-secure-change']();
assert(!dialog.open&&dialog.removed,'Busca fecha e limpa ao sair da conta');
assert.equal(api.openSearch(),false);
let prevented=false;
window.oficinaCloud.active=true;
documentHandlers.keydown({ctrlKey:true,metaKey:false,key:'k',preventDefault(){prevented=true}});
assert(prevented&&opened>=4,'Ctrl+K abre busca integrada');
api.removeDialog();
assert.equal(JSON.stringify(db),original,'Atalhos sem gravação');
const secure=read('preview-v1/seguro.html'),preview=read('preview-v1/index.html');
for(const html of [secure,preview]){
 assert(html.includes('busca-geral-v1.js')&&html.includes('busca-geral-v1.css'));
}
assert(read('preview-v1/busca-geral-v1.css').includes('ua-quick-dialog'));
console.log('OK busca geral: login exigido, pesquisa unificada, atalho, XSS escapado, navegação e dados preservados.');
