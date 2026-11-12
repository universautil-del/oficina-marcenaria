/* Regressão da NF-e → Entrada de Materiais → Financeiro → Estoque.
 * As mudanças só são persistidas ao salvar a entrada e ao confirmar recebimento.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const upgrade=read('preview-v1/upgrade.js'),features=read('preview-v1/features-v05.js'),base=read('preview-v1/script.js');
const i=upgrade.indexOf('function purchaseModal('),j=upgrade.indexOf('function duplicateQuote(',i);
assert(i>0&&j>i);const src=upgrade.slice(i,j);
new vm.Script(src);
assert(features.includes("case 'v5-invoice-to-purchase'"));
assert(features.includes("case 'v5-invoice-link-purchase'"));
assert(features.includes("getElementsByTagName('det')"));
assert(features.includes("vencimento:"));
assert(base.includes("case 'edit-purchase':return editPurchase(item)"));
let seq=0,dialogs=[],saves=0,saveWorks=true,confirmation=true,alerts=[],renders=0;
const db={products:[
 {id:'m15',nome:'MDF Branco TX 15 mm',tipo:'materia',unidade:'chapa',estoque:5,custo:180},
 {id:'screw',nome:'Parafuso 4 × 40 mm',tipo:'materia',unidade:'un',estoque:100,custo:0.20},
 {id:'finished',nome:'Armário sob medida',tipo:'acabado',estoque:0,custo:500}
],suppliers:[{id:'s1',nome:'Fornecedor Teste'}],purchases:[],transactions:[],stockMovements:[],
 invoices:[
 {id:'nf1',numero:'101',tipo:'entrada',valor:410,emitente:'FORNECEDOR TESTE',data:'2026-11-11',vencimento:'2026-12-10',
  origem:'XML',items:[
   {nome:'MDF BRANCO TX 15 MM',unidade:'CHAPA',quantidade:2,custo:200},
   {nome:'Parafuso 4 × 40 mm',unidade:'UN',quantidade:20,custo:.50}
  ]},
 {id:'nf2',numero:'102',tipo:'entrada',valor:410,emitente:'Fornecedor Teste',data:'2026-11-11',items:[]}
],seq:{purchase:1,invoice:3}};
const money=n=>'R$ '+Number(n).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const round=n=>Math.round(Number(n)*100)/100;
const paid=t=>(t.payments||[]).reduce((sum,p)=>sum+Number(p.valor)||0,0);
const restore=()=>JSON.stringify(db);
function newDialog(title,fields,onSubmit,after){
 const dlg={title,fields,onSubmit,after,rows:[],selectedSupplier:null,
  querySelector(sel){
   if(sel==='[name="supplierId"]')return this.selectedSupplier??=( {value:''} );
   if(sel==='[data-action="add-purchase-row"]'||sel==='[data-quick-material]'||sel==='[data-quick-supplier]')
     return this[sel]??=( {onclick:null} );
   return null;
  },
  querySelectorAll(sel){
   if(sel==='.purchase-row')return this.rows.map(row=>({
    dataset:{nfDescricao:row.nfDescricao||''},
    querySelector(q){
     if(q==='[data-pur-product]')return{value:row.productId||''};
     if(q==='[data-pur-qty]')return{value:String(row.quantidade??1)};
     if(q==='[data-pur-cost]')return{value:String(row.custo??0)};
     return null;
    }
   }));
   return [];
  }
 };
 dialogs.push(dlg);if(after)after(dlg);return dlg;
}
const ctx={db,Set,Map,Math,String,Number,Date,Array,Error,
 getProduct:id=>db.products.find(p=>p.id===id),getSupplier:id=>db.suppliers.find(p=>p.id===id),
 supplierOptions:()=>'<option value="s1">Fornecedor Teste</option>',
 purchaseTotal:p=>round((p.items||[]).reduce((v,i)=>v+Number(i.quantidade)*Number(i.custo),0)),
 productModal:()=>{throw Error('Não deveria abrir Produtos')},
 supplierModal:()=>{throw Error('Não deveria abrir Fornecedores')},
 addPurchaseRow:(dlg,item={})=>dlg.rows.push({...item}),
 calcPurchase:()=>{},openModal:newDialog,
 id:()=> 'new'+(++seq),iso:()=> '2026-11-11',money,round,
 esc:value=>String(value??'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'),
 button:(label,act,item,cl)=>'<button>'+label+'</button>',
 save:()=>{saves++;return saveWorks},
 confirm:()=>confirmation,alert:v=>alerts.push(String(v)),render:()=>{renders++},
 cashReceived:t=>(t.payments||[]).reduce((sum,p)=>sum+Number(p.valor||0),0),
 date:v=>v,dec:v=>String(v),pill:v=>v,
 td:(...v)=>v.join('|'),table:()=>'',setTimeout:fn=>fn(),
 document:{},Option:class Option{constructor(t,v){this.text=t;this.value=v}}
};
vm.runInNewContext(src,ctx,{timeout:2000});
const initialStock=db.products.map(p=>p.estoque),before=restore();
ctx.prepareInvoicePurchase('nf1');
let dlg=dialogs.at(-1);
assert(dlg.title.includes('Conferir entrada da NF 101'));
assert.equal(dlg.selectedSupplier.value,'s1');
assert.equal(dlg.rows.length,2);
assert.equal(dlg.rows[0].productId,'m15');
assert.equal(dlg.rows[1].productId,'screw');
assert.equal(dlg.rows[0].quantidade,2);
assert.equal(dlg.rows[1].custo,.5);
assert(dlg.fields.includes('name="dueDate" value="2026-12-10"'));
assert.equal(restore(),before,'Abrir entrada automática não movimenta caixa ou estoque');
const values={supplierId:'s1',date:'2026-11-11',dueDate:'2026-12-10',referencia:'101'};
saveWorks=false;
assert.throws(()=>dlg.onSubmit(values,dlg),/Nenhum lançamento foi confirmado/);
assert.equal(db.purchases.length,0);
assert.equal(db.transactions.length,0);
assert.equal(db.invoices[0].purchaseId,undefined);
assert.equal(db.seq.purchase,1);
saveWorks=true;
assert.equal(dlg.onSubmit(values,dlg),true);
assert.equal(db.purchases.length,1);
assert.equal(db.transactions.length,1);
assert.equal(db.purchases[0].status,'aberta');
assert.equal(db.transactions[0].kind,'pagar');
assert.equal(db.transactions[0].valor,410);
assert.equal(db.transactions[0].dueDate,'2026-12-10');
assert.equal(db.purchases[0].invoiceId,'nf1');
assert.equal(db.invoices[0].purchaseId,db.purchases[0].id);
assert.deepEqual(db.products.map(p=>p.estoque),initialStock,'Salvar entrada não altera saldo');
assert.equal(db.stockMovements.length,0);
assert.throws(()=>ctx.prepareInvoicePurchase('nf1'),/já está vinculada/,'NF não pode gerar compra duplicada');
const purchase=db.purchases[0];
ctx.editPurchase(purchase.id);
dlg=dialogs.at(-1);
assert(dlg.title.includes('Editar entrada de materiais #1'));
assert.equal(dlg.rows.length,2);
dlg.rows[0].quantidade=3; // alteração antes da confirmação
assert.equal(dlg.onSubmit(values,dlg),true);
assert.equal(db.purchases.length,1);
assert.equal(db.transactions.length,1);
assert.equal(db.transactions[0].valor,610);
assert.equal(db.purchases[0].items[0].quantidade,3);
db.transactions[0].payments=[{id:'pay1',valor:600}];
ctx.editPurchase(purchase.id);dlg=dialogs.at(-1);
dlg.rows[0].quantidade=1;
assert.throws(()=>dlg.onSubmit(values,dlg),/Valor inferior ao já pago/,'Não reduzir conta abaixo do pago');
assert.equal(db.transactions[0].valor,610);
db.transactions[0].payments=[];
ctx.editPurchase(purchase.id);dlg=dialogs.at(-1);
dlg.rows[0].quantidade=4;saveWorks=false;
assert.throws(()=>dlg.onSubmit(values,dlg),/preservados/);
assert.equal(db.transactions[0].valor,610);
assert.equal(db.purchases[0].items[0].quantidade,3);
saveWorks=true;
ctx.receivePurchase(purchase.id);
assert.equal(db.purchases[0].status,'recebida');
assert.equal(db.products[0].estoque,8);
assert.equal(db.products[1].estoque,120);
assert.equal(db.stockMovements.length,2);
ctx.receivePurchase(purchase.id);
assert.equal(db.stockMovements.length,2,'Recebimento não pode ser feito duas vezes');
assert.throws(()=>ctx.editPurchase(purchase.id),/Somente entradas abertas/);
const extra={id:'manual1',number:2,status:'aberta',invoiceId:undefined,
 supplierNome:'Fornecedor Teste',items:[{productId:'m15',quantidade:2,custo:205}],accountId:'account2'};
db.purchases.push(extra);
db.transactions.push({id:'account2',kind:'pagar',purchaseId:extra.id,valor:410,payments:[]});
const beforeLinkTransactions=db.transactions.length;
ctx.linkInvoicePurchase('nf2');
dlg=dialogs.at(-1);
assert(dlg.fields.includes('Entrada existente'));
assert.equal(dlg.onSubmit({purchaseId:'manual1'},dlg),true);
assert.equal(db.invoices[1].purchaseId,'manual1');
assert.equal(extra.invoiceId,'nf2');
assert.equal(db.transactions.length,beforeLinkTransactions,'Vincular NF existente não duplica financeiro');
assert.equal(db.stockMovements.length,2,'Vincular não movimenta estoque');
assert.throws(()=>ctx.linkInvoicePurchase('nf2'),/já está vinculada/);
// Se a unidade da nota não corresponder à unidade do cadastro, não vincular automaticamente.
db.invoices.push({id:'nf3',numero:'103',tipo:'entrada',valor:300,data:'2026-11-11',
 emitente:'Fornecedor Teste',items:[{nome:'MDF Branco TX 15 mm',unidade:'CX',quantidade:1,custo:300}]});
ctx.prepareInvoicePurchase('nf3');
dlg=dialogs.at(-1);
assert.equal(dlg.rows[0].productId,'','Não converter caixa em chapa sem aprovação');
assert.throws(()=>dlg.onSubmit({...values,referencia:'103'},dlg),/Vincule cada item/);
assert.equal(db.transactions.length,beforeLinkTransactions);
assert.equal(db.invoices.at(-1).purchaseId,undefined);
// Cancelar uma entrada vinculada e ainda não recebida libera a NF para nova conferência.
const beforeCancelMovements=db.stockMovements.length;
ctx.cancelPurchase('manual1');
assert.equal(extra.status,'cancelada');
assert.equal(db.invoices[1].purchaseId,undefined,'NF liberada para outro lançamento sem duplicar');
assert.equal(db.transactions.find(t=>t.id==='account2'),undefined,'Conta pendente cancelada sem afetar pagamentos anteriores');
assert.equal(db.stockMovements.length,beforeCancelMovements);
console.log('OK NF-e: importação revisável, compra única, edição, baixa única, rollback, vínculo de entrada existente e despesas sem duplicação.');
