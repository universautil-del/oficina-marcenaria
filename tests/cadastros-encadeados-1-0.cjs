/* Teste do encadeamento de cadastros — OFICINA 1.0.
   Sem Supabase e sem criar lançamentos: só abre e preenche formulários. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const purchase=read('preview-v1/upgrade.js'),sales=read('preview-v1/script.js'),
 catalog=read('preview-v1/catalogo-produtos-1-0.js'),projects=read('preview-v1/features-v05.js');
const cut=(s,start,end)=>{const i=s.indexOf(start),j=s.indexOf(end,i+start.length);if(i<0||j<=i)throw Error('Trecho não localizado '+start);return s.slice(i,j)};
const purchaseSource=cut(purchase,'function purchaseModal(','function receivePurchase(');
const salesSource=cut(sales,'function openSales(','function addMonths(');
new vm.Script(purchaseSource);new vm.Script(salesSource);
assert(!purchaseSource.includes("return alert('Cadastre uma matéria-prima"));
assert(purchaseSource.includes("productModal('','materia')"));
assert(purchaseSource.includes('data-quick-material'));
assert(salesSource.includes('data-quick-product'));
assert(catalog.includes('id="uaBomNewMaterial"'));
assert(projects.includes('data-v5-quick-client'));
assert(projects.includes('return openModal(pid?'));
let seq=0,saved=0,modalObjects=[],productDialogs=[],saleRows=[],purchaseRows=[],alerts=[];
const db={products:[],suppliers:[],clients:[{id:'c1',nome:'Cliente'}],projects:[],
 quotes:[],orders:[],purchases:[],transactions:[],stockMovements:[],
 seq:{purchase:1,quote:1,order:1,productCode:1}};
function fakeDialog(){
 const handlers={};
 return {
  isConnected:true,
  addEventListener(type,callback){handlers[type]=callback},
  close(){handlers.close?.()},
  callbacks:handlers
 };
}
const ctx={
 db,Number,String,Math,Date,Map,Set,Error,
 alert:s=>alerts.push(String(s)),
 productModal:(pid,type)=>{const dialog=fakeDialog();productDialogs.push({pid,type,dialog});return dialog},
 setTimeout:fn=>fn(),
 openModal:(title,fields,onSubmit,after)=>{const dialog={title,fields,onSubmit,after};modalObjects.push(dialog);return dialog},
 addPurchaseRow:(dlg,entry)=>{purchaseRows.push(entry)},
 calcPurchase:()=>{},
 getProduct:id=>db.products.find(p=>p.id===id),getClient:id=>db.clients.find(p=>p.id===id),
 getQuote:()=>null,supplierOptions:()=>'<option value="">Sem fornecedor</option>',
 getSupplier:id=>db.suppliers.find(s=>s.id===id),clientOptions:()=>'<option value="c1">Cliente</option>',
 productCost:()=>0,orderTotal:()=>0,
 money:()=> 'R$ 0,00',button:()=>'<button type="button"></button>',
 esc:x=>String(x??''),iso:()=> '2026-11-11',
 id:()=> 'id'+(++seq),round:x=>Number(x),save:()=>{saved++;return true},
 addSaleRow:(dlg,entry)=>saleRows.push(entry||{}),
 calcSale:()=>{}
};
vm.runInNewContext(purchaseSource+'\n'+salesSource,ctx,{timeout:2500});
// Primeira entrada: não pede para navegar e não abre compra vazia.
const first=ctx.purchaseModal();
assert.equal(first,productDialogs[0].dialog);
assert.equal(productDialogs[0].type,'materia');
assert.equal(modalObjects.length,0);
productDialogs[0].dialog.close(); // Cancelou, continua sem comprar.
assert.equal(modalObjects.length,0);
assert.equal(saved,0);
// Salva matéria-prima fictícia: somente agora continua a entrada.
ctx.purchaseModal();
db.products.push({id:'mat1',tipo:'materia',nome:'MDF TX 15 mm',custo:100,preco:130,unidade:'chapa',estoque:0});
productDialogs[1].dialog.close();
assert.equal(modalObjects.length,1,'Após cadastrar matéria-prima, abrir Entrada de Materiais');
const entry=modalObjects[0];
assert(entry.fields.includes('Fornecedor'));
assert(entry.fields.includes('+ Cadastrar matéria-prima'));
assert(entry.fields.includes('Selecione um fornecedor'));
assert.equal(db.purchases.length,0);
assert.equal(db.transactions.length,0);
const btn={onclick:null};const supplierBtn={onclick:null};const addBtn={onclick:null};
const sel={options:[{value:'mat1'}],add(opt){this.options.push(opt)}};
const entryDlg={isConnected:true,
 querySelector:selector=>selector==='[data-quick-material]'?btn:
  selector==='[data-quick-supplier]'?supplierBtn:
  selector==='[data-action="add-purchase-row"]'?addBtn:null,
 querySelectorAll:selector=>selector==='[data-pur-product]'?[sel]:[]};
entry.after(entryDlg);
assert(typeof btn.onclick==='function');
const beforeRowCount=purchaseRows.length;
btn.onclick();
db.products.push({id:'mat2',tipo:'materia',nome:'Dobradiça',custo:8,preco:12,unidade:'un',estoque:0});
productDialogs[2].dialog.close();
assert.equal(purchaseRows.length,beforeRowCount+1);
assert.equal(purchaseRows.at(-1).productId,'mat2');
assert.equal(purchaseRows.at(-1).custo,8);
assert(sel.options.some(option=>option.value==='mat2'));
assert.equal(db.purchases.length,0,'Cadastro dentro da entrada não confirma compra');
assert.equal(db.stockMovements.length,0,'Não movimentar estoque antes da compra recebida');
// Orçamento: produto adicionado durante preenchimento volta como linha no mesmo formulário.
const quoteResult=ctx.openSales('quote');
const sale=modalObjects.at(-1);
assert(sale.fields.includes('data-quick-client'));
assert(sale.fields.includes('data-quick-product'));
const saleBtn={onclick:null},clientBtn={onclick:null};
const saleDlg={isConnected:true,querySelector:q=>q==='[data-quick-product]'?saleBtn:
 q==='[data-quick-client]'?clientBtn:
 q==='[data-action="add-sale-item"]'?addBtn:
 q.startsWith('[name=')?{value:'',oninput:null}:null,
 querySelectorAll:()=>[]};
sale.after(saleDlg);
assert(typeof saleBtn.onclick==='function');
const beforeSales=saleRows.length;
saleBtn.onclick();
db.products.push({id:'prod1',tipo:'acabado',nome:'Armário de cozinha',preco:2500,components:[{materialId:'mat1',quantidade:1}]});
productDialogs[3].dialog.close();
assert.equal(saleRows.length,beforeSales+1);
assert.equal(saleRows.at(-1).productId,'prod1');
assert.equal(saleRows.at(-1).preco,2500);
assert.equal(db.quotes.length,0);
assert.equal(db.orders.length,0);
assert.equal(db.transactions.length,0);
assert.equal(saved,0,'Nenhum formulário foi confirmado durante os atalhos');
assert.equal(alerts.length,0,'Nenhum alerta de bloqueio deve aparecer no fluxo');
console.log('OK atalhos: cadastro obrigatório sem alerta; cancelamento seguro; retorno à entrada; produto no orçamento; nenhum lançamento duplicado.');
