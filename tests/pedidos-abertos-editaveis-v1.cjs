/* Testes: pedidos em aberto, edição e consistência entre pedido, estoque e financeiro. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const src=read('preview-v1/script.js');
const from=src.indexOf('function nextSaleNumber(){'),to=src.indexOf('function ordersView(){',from);
assert(from>=0&&to>from);
const code=src.slice(from,to);
new vm.Script(code);
const css=read('preview-v1/order-editor.css');
const html=read('preview-v1/seguro.html');
assert(html.includes('order-editor.css')&&html.includes('src="script.js?v='),'Editor de pedidos e script carregados');
assert(html.includes('list-sort-v1.css'),'Ordenação carregada junto ao editor de pedidos');
assert(css.includes('position:sticky')&&css.includes('.dialog-actions'));
assert(src.includes("case 'edit-order':return openSales('order',item)"));
assert(src.includes("case 'confirm-order':return confirmOpenOrder(item)"));
let seq=0,saveOk=true,saves=0,rendered=0;
const db={
 seq:{quote:10,order:10},quotes:[],orders:[],transactions:[],
 clients:[{id:'c1',nome:'Cliente A'},{id:'c2',nome:'Cliente B'}],
 products:[{id:'mdf',tipo:'materia',nome:'MDF 15mm',estoque:100}]
};
const modals=[],alerts=[];
const orderTotal=o=>Math.round(((o.items||[]).reduce((n,i)=>n+Number(i.quantidade)*Number(i.preco),0)-Number(o.desconto||0)+Number(o.frete||0))*100)/100;
const cashReceived=t=>(t.payments||[]).reduce((n,p)=>n+Number(p.valor),0);
const ctx={
 db,Date,String,Number,Math,JSON,Object,Map,Set,Error,
 id:()=> 'generated-'+(++seq),
 iso:()=> '2026-11-12',
 esc:s=>String(s??''),
 money:n=>'R$ '+n,
 dec:n=>String(n),
 round:n=>Math.round(Number(n)*100)/100,
 nextControlCode:()=> 'PED-2026-010',
 orderTotal,cashReceived,
 getQuote:id=>db.quotes.find(x=>x.id===id),
 getOrder:id=>db.orders.find(x=>x.id===id),
 getClient:id=>db.clients.find(x=>x.id===id),
 getProduct:id=>db.products.find(x=>x.id===id),
 save:()=>{saves++;return saveOk},
 render:()=>{rendered++},
 confirm:()=>true,
 alert:x=>alerts.push(String(x)),
 openModal:(head,fields,submit,after)=>{modals.push({head,fields,submit,after});return {}},
 collectSaleItems:()=>[],
 button:()=>'<button data-action="add-sale-item"></button>',
 clientOptions:()=>'<option value="c1">Cliente A</option>',
 clientModal:()=>{},
 productModal:()=>{},
 addSaleRow:()=>{},
 calcSale:()=>{}
};
vm.runInNewContext(code,ctx,{timeout:2500});
const data={clientId:'c1',clientNome:'Cliente A',date:'2026-11-12',
 items:[{productId:'mdf',descricao:'MDF TX',quantidade:2,preco:100}],
 desconto:0,frete:0,ambientes:'Quarto',entrega:'30 dias',
 entregaData:'2026-12-12',observacoes:'Medidas preliminares',
 payment:{tipo:'parcelado',forma:'Pix',parcelas:2,entrada:0,primeiroVencimento:'2026-12-01'}
};
assert.equal(ctx.createOrder(data),true);
assert.equal(db.orders.length,1);
const first=db.orders[0],oid=first.id;
assert.equal(first.status,'aberto');
assert.equal(first.stockState,'pendente');
assert.equal(db.products[0].estoque,100,'Não há baixa antes da produção');
assert.equal(db.transactions.length,2,'Parcelas criadas com o pedido');
assert.equal(db.transactions.reduce((a,t)=>a+t.valor,0),200);
assert.equal(first.materials[0].quantidade,2);
ctx.openSales('order',oid);
const modal=modals.at(-1);
assert(modal.head.includes('Editar pedido'));
assert(modal.fields.includes('value="2026-12-12"'));
assert(modal.fields.includes('name="payForma"'));
const changed={...data,items:[{...data.items[0],quantidade:3}],payment:{...data.payment,forma:'Boleto',parcelas:3},observacoes:'Após visita'};
assert.equal(ctx.updateOpenOrder(oid,changed),true);
assert.equal(db.orders[0].id,oid,'Manter identidade do pedido');
assert.equal(db.orders[0].status,'aberto');
assert.equal(db.orders[0].observacoes,'Após visita');
assert.equal(db.transactions.length,3);
assert(db.transactions.every(t=>t.valor===100&&t.paymentMethod==='Boleto'));
assert.equal(db.products[0].estoque,100);
const before=JSON.stringify(db);
saveOk=false;
assert.throws(()=>ctx.updateOpenOrder(oid,{...changed,entrega:'Nova entrega',items:[{...changed.items[0],quantidade:4}]}),/Não foi possível salvar/);
assert.equal(JSON.stringify(db),before,'Rollback no pedido e financeiro');
saveOk=true;
db.transactions[0].payments.push({id:'p1',valor:30,date:'2026-11-12',method:'Pix'});
const withPayment={...changed,items:[{...changed.items[0],quantidade:4}]};
assert.throws(()=>ctx.updateOpenOrder(oid,withPayment),/pagamentos registrados/);
assert.equal(orderTotal(db.orders[0]),300);
assert.equal(ctx.updateOpenOrder(oid,{...changed,entrega:'20 dias',observacoes:'Prazo revisado'}),true,
 'Alterações sem efeito no valor são permitidas mesmo com pagamento');
assert.equal(db.orders[0].entrega,'20 dias');
assert.equal(db.transactions[0].payments.length,1);
saveOk=false;
assert.equal(ctx.confirmOpenOrder(oid),false);
assert.equal(db.orders[0].status,'aberto','Falha na confirmação deve voltar a aberto');
assert.equal(db.orders[0].stockState,'pendente');
saveOk=true;
assert.equal(ctx.confirmOpenOrder(oid),true);
assert.equal(db.orders[0].status,'confirmado');
assert.equal(db.orders[0].stockState,'reservado');
assert.equal(db.products[0].estoque,100,'Confirmação reserva, mas não baixa o estoque');
const modalCount=modals.length;
ctx.openSales('order',oid);
assert.equal(modals.length,modalCount,'Pedido confirmado não deve permitir edição');
assert(alerts.some(x=>x.includes('Somente pedidos em aberto')));
console.log('OK: pedido criado aberto, editável, salvar com rollback, parcelas recalculadas, pagamento protegido e confirmação de produção.');
