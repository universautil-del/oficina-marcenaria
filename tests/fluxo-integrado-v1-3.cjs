/* Fluxos integrados OFICINA: node tests/fluxo-integrado-v1-3.cjs
 * Testes locais não substituem transações reais multiusuário no servidor.
 */
'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const src=read('preview-v1/script.js'),extra=read('preview-v1/upgrade.js');
new vm.Script(src);new vm.Script(extra);
const cut=(s,start,end)=>{
 const from=s.indexOf(start),to=s.indexOf(end,from+start.length);
 if(from<0||to<=from)throw Error('Não encontrei funções: '+start+' / '+end);
 return s.slice(from,to);
};
const features=read('preview-v1/features-v05.js'),bridge=read('preview-v1/project-sketchup-bridge.js');
assert(features.includes('ua-project-quote')&&features.includes('Criar orçamento'));
assert(bridge.includes("openSales('quote','',p.id)"));
assert(src.includes('projectId:q.projectId||')&&src.includes('projectNome:q.projectNome||'));
const db={
 seq:{quote:19,order:19,purchase:1,project:2},
 clients:[{id:'c1',nome:'Cliente Demonstrativo'}],
 suppliers:[{id:'s1',nome:'Fornecedor Demonstrativo'}],
 projects:[{id:'proj1',nome:'Cozinha Teste',clientId:'c1',ambiente:'Cozinha',priceA:3200}],
 products:[{id:'m1',tipo:'materia',nome:'MDF TX',codigo:'01',custo:150,preco:300,estoque:12.125,minimo:1}],
 stockMovements:[],quotes:[],orders:[],transactions:[],purchases:[]
};
let serial=0,saveOK=true,saveCalls=0,rendered=0,alerts=[],modals=[],confirmations=0,filledRows=[];
const ctx={
 db,Date,Math,Number,String,Map,Set,Error,
 round:n=>Math.round(Number(n)*100)/100,
 iso:()=> '2026-11-11',
 id:()=> 'id-'+(++serial),
 save:()=>{saveCalls++;return saveOK},
 render:()=>{rendered++},
 alert:s=>alerts.push(String(s)),
 confirm:()=>{confirmations++;return true},
 getQuote:id=>db.quotes.find(q=>q.id===id),
 getOrder:id=>db.orders.find(q=>q.id===id),
 getProduct:id=>db.products.find(p=>p.id===id),
 getClient:id=>db.clients.find(c=>c.id===id),
 money:n=>'R$ '+n,
 date:n=>n,
 dec:n=>String(n),
 esc:s=>String(s??'').replace(/[&<>"]/g,''),
 button:()=>'<button></button>',
 clientOptions:id=>'<option value="'+id+'">Cliente</option>',
 orderTotal:o=>Math.round(((o.items||[]).reduce((sum,i)=>sum+Number(i.quantidade)*Number(i.preco),0)-Number(o.desconto||0)+Number(o.frete||0))*100)/100,
 cashReceived:t=>(t.payments||[]).reduce((v,p)=>v+Number(p.valor),0),
 balance:t=>Math.max(0,Math.round((Number(t.valor)-(t.payments||[]).reduce((v,p)=>v+Number(p.valor),0))*100)/100),
 openModal:(title,fields,onSubmit,afterOpen)=>{const obj={title,fields,onSubmit,afterOpen};modals.push(obj);return obj},
 addSaleRow:(dlg,item)=>{filledRows.push(item)},
 calcSale:()=>{},
 collectSaleItems:()=>[{productId:'m1',descricao:'MDF TX',quantidade:1.125,preco:300}],
 location:{hash:'#projetos'},
 document:{querySelector:()=>null},
 content:{querySelector:()=>null},
 purchaseTotal:p=>Math.round(p.items.reduce((s,i)=>s+i.quantidade*i.custo,0)*100)/100,
 getSupplier:id=>db.suppliers.find(x=>x.id===id),
 reservedQuantity:()=>0
};
const functions=[
 cut(src,'function nextSaleNumber(','function ordersView('),
 cut(src,'function reserveOrder(','function orderDetails('),
 cut(src,'function transactionModal(','function receiptModal('),
 cut(extra,'function purchaseModal(','function receivePurchase(')
];
/* nextSaleNumber..ordersView inclui openSales, addMonths, buildInstallments e createOrder. */
for(const frag of functions)vm.runInNewContext(frag,ctx,{timeout:2000});
ctx.openSales('quote','','proj1');
assert.equal(modals[0].title,'Novo orçamento');
assert(modals[0].fields.includes('Projeto vinculado:'));
assert(modals[0].fields.includes('Cozinha Teste'));
const dlg={querySelector:()=>({value:'',onclick:null,oninput:null})};
modals[0].afterOpen(dlg);
assert.equal(filledRows.length,1);
assert.equal(filledRows[0].descricao,'Projeto Cozinha Teste · Cozinha');
assert.equal(filledRows[0].preco,3200,'Estimativa A pré-preenchida para revisão');
const entry={
 clientId:'c1',date:'2026-11-11',desconto:'0',frete:'0',ambientes:'Cozinha',entrega:'',entregaData:'',
 observacoes:'Projeto para testes',payTipo:'entrada',payForma:'Pix',payEntrada:'100',
 payParcelas:'2',payData:'2026-12-01'
};
saveOK=false;
const before=JSON.stringify(db);
assert.throws(()=>modals[0].onSubmit(entry,dlg),/Não foi possível salvar o orçamento/);
assert.equal(JSON.stringify(db),before,'Orçamento e sequências devem voltar ao estado original');
saveOK=true;
assert.equal(modals[0].onSubmit(entry,dlg),true);
const quote=db.quotes[0];
assert.equal(quote.number,19);
assert.equal(quote.projectId,'proj1');
assert.equal(quote.clientId,'c1');
assert.equal(quote.items.length,1);
const quoteData={
 clientId:quote.clientId,clientNome:quote.clientNome,date:'2026-11-11',items:quote.items.map(i=>({...i})),
 desconto:quote.desconto,frete:quote.frete,ambientes:quote.ambientes,entrega:quote.entrega,
 entregaData:quote.entregaData,observacoes:quote.observacoes,projectId:quote.projectId,
 projectNome:quote.projectNome,payment:{...quote.payment}
};
saveOK=false;
const beforeOrder=JSON.stringify(db);
assert.throws(()=>ctx.createOrder(quoteData,quote.id),/Não foi possível salvar o pedido/);
assert.equal(JSON.stringify(db),beforeOrder,'Falha não deve criar pedido, receita nem converter orçamento');
saveOK=true;
assert.equal(ctx.createOrder(quoteData,quote.id),true);
assert.equal(db.orders.length,1);
assert.equal(db.orders[0].number,quote.number);
assert.equal(db.orders[0].projectId,'proj1');
assert.equal(db.transactions.length,3);
assert.equal(db.transactions.reduce((s,t)=>s+t.valor,0),337.5);
assert.equal(db.transactions.every(t=>t.orderId===db.orders[0].id),true);
assert.equal(quote.status,'convertido');
assert.throws(()=>ctx.createOrder(quoteData,quote.id),/convertido/);
assert.equal(db.transactions.length,3);
assert.equal(db.orders[0].materials[0].quantidade,1.125,'Consumir estoque com 3 decimais');
assert.equal(db.orders[0].stockState,'reservado');
saveOK=false;
ctx.startOrder(db.orders[0].id);
assert.equal(db.orders[0].status,'confirmado');
assert.equal(db.products[0].estoque,12.125);
assert.equal(db.stockMovements.length,0);
saveOK=true;
ctx.startOrder(db.orders[0].id);
assert.equal(db.orders[0].status,'producao');
assert.equal(db.products[0].estoque,11);
assert.equal(db.stockMovements[0].delta,-1.125);
ctx.startOrder(db.orders[0].id);
assert.equal(db.stockMovements.length,1,'Nunca baixar duas vezes ao iniciar produção');
const tx=db.transactions[0];
ctx.paymentModal(tx.id);
const m=modals[1];
saveOK=false;
const previousTx=JSON.stringify(tx);
assert.throws(()=>m.onSubmit({valor:100,date:'2026-11-11',method:'Pix'}),/Não foi possível registrar/);
assert.equal(JSON.stringify(tx),previousTx);
saveOK=true;
assert.equal(m.onSubmit({valor:100,date:'2026-11-11',method:'Pix'}),true);
assert.equal(tx.payments.length,1);
assert.equal(tx.payments[0].valor,100);
assert.throws(()=>m.onSubmit({valor:100,date:'2026-11-11',method:'Pix'}),/saldo/);
ctx.transactionModal();
const manual=modals[2];
saveOK=false;
const count=db.transactions.length;
assert.throws(()=>manual.onSubmit({valor:'35',kind:'pagar',descricao:'Teste',dueDate:'2026-11-12'}),/Não foi possível salvar/);
assert.equal(db.transactions.length,count);
saveOK=true;
assert(manual.onSubmit({valor:'35',kind:'pagar',descricao:'Teste',dueDate:'2026-11-12'}));
const purchaseCode=cut(extra,'function purchaseModal(','function receivePurchase(');
assert(purchaseCode.includes('previousPurchases')&&purchaseCode.includes('previousTransactions'));
assert(purchaseCode.includes('db.seq=previousSeq'));
assert.throws(()=>manual.onSubmit({valor:'Infinity',kind:'pagar',descricao:'Inválido',dueDate:'2026-11-12'}),/inválid/);
const collect=cut(src,'function collectSaleItems(','function calcSale(');
vm.runInNewContext(collect,ctx,{timeout:1000});
const fakeRow={
 querySelector:q=>({value:({
  '[data-item-product]':'m1','[data-item-desc]':'Chapa de MDF',
  '[data-item-qty]':'1','[data-item-price]':'não-número'
 })[q]})
};
const fakeDlg={querySelectorAll:()=>[fakeRow]};
assert.throws(()=>ctx.collectSaleItems(fakeDlg),/valores/,'Preço inválido deve ser bloqueado');
vm.runInNewContext(cut(extra,'function duplicateQuote(','function shareQuote('),ctx,{timeout:1000});
const oldQuoteCount=db.quotes.length;
const nextQ=db.seq.quote;
saveOK=false;
ctx.duplicateQuote(quote.id);
assert.equal(db.quotes.length,oldQuoteCount);
assert.equal(db.seq.quote,nextQ);
saveOK=true;
ctx.duplicateQuote(quote.id);
assert.equal(db.quotes.length,oldQuoteCount+1);
assert.equal(db.quotes.at(-1).status,'aberto');
assert.equal(db.quotes.at(-1).projectId,'proj1');
assert(db.quotes.at(-1).number!==db.orders[0].number);
const oldProjectCount=db.projects.length;
const fsrc=read('preview-v1/features-v05.js');
vm.runInNewContext(cut(fsrc,'function v5DeleteProject(','function v5Checklist('),ctx,{timeout:1000});
ctx.v5DeleteProject('proj1');
assert.equal(db.projects.length,oldProjectCount,'Não excluir projeto vinculado ao orçamento');
assert(alerts.some(v=>v.includes('vinculado')),'Explicar por que exclusão foi bloqueada');
assert(saveCalls>5&&confirmations>0);
console.log('OK: Projeto→Orçamento→Pedido→Parcelas→Produção, mesma numeração, precisão em estoque e rollback financeiro.');
