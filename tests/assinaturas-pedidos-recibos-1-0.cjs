/* Regressão dos pedidos de compra e recibos com assinatura da empresa. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const core=read('preview-v1/script.js'),upgrade=read('preview-v1/upgrade.js'),feature=read('preview-v1/features-v05.js');
assert(core.includes('max-width:240px;max-height:90px'),'Assinatura de recibos e pedidos de compra deve ficar maior');
assert(core.includes('mix-blend-mode:multiply;margin:-72px auto 7px'),'Assinatura deve sobrepor a linha com fundo branco');
assert(core.includes('.sign{margin-top:90px;display:flex;gap:40px;break-inside:avoid}'),'Preservar espaço da assinatura ao imprimir');
const snippet=(s,a,b)=>{const i=s.indexOf(a),j=s.indexOf(b,i+a.length);assert(i>=0&&j>i,'Trecho não encontrado: '+a);return s.slice(i,j)};
const purchaseSource=snippet(upgrade,'function printPurchaseOrder(','function viewPurchase(');
const receiptSource=snippet(core,'function receiptPrint(','function backup(');
const paidSource=snippet(feature,'function v5PaidReceipt(','// Acopla os novos módulos');
new vm.Script(purchaseSource+receiptSource+paidSource);
const order={id:'o1',number:3,controlCode:'PED-2026-F3AC37',clientId:'c1',clientNome:'Cliente do Móvel',
 items:[{descricao:'Balcão MDF',quantidade:1,preco:5300}],frete:0,desconto:0};
const db={company:{nome:'UNIVERSA ART DESIGN',cnpj:'55.223.652/0001-87'},
 clients:[{id:'c1',nome:'Cliente do Móvel',doc:'000.000.000-00'}],orders:[order],suppliers:[{id:'s1',nome:'Loja de MDF',doc:'12.345.678/0001-00'}],
 products:[{id:'mdf',nome:'MDF 18 mm',unidade:'chapa'}],
 purchases:[{id:'entry',number:7,supplierId:'s1',supplierNome:'Loja de MDF',date:'2026-11-11',
  dueDate:'2026-11-20',referencia:'NF 123',status:'aberta',items:[{productId:'mdf',quantidade:2,custo:200}]}],
 transactions:[{id:'t1',orderId:'o1',kind:'receber',descricao:'Pedido PED-2026-F3AC37',valor:5300,
  payments:[{id:'p1',date:'2026-11-11',valor:5300,method:'Pix'}]}]};
const original=JSON.stringify(db);
const prints=[],alerts=[];
const ctx={db,window:{universaArtAssinatura:{image:()=>'<img class="ua-receipt-sig-img" src="data:image/webp;base64,QUJD">'}},
 openPrint:(title,body)=>prints.push({title,body}),
 getOrder:id=>db.orders.find(o=>o.id===id),getClient:id=>db.clients.find(c=>c.id===id),
 getSupplier:id=>db.suppliers.find(s=>s.id===id),getProduct:id=>db.products.find(p=>p.id===id),
 money:n=>'R$ '+Number(n).toLocaleString('pt-BR',{minimumFractionDigits:2}),
 dec:v=>String(v),esc:v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;'),date:v=>v,
 purchaseTotal:p=>p.items.reduce((a,i)=>a+i.quantidade*i.custo,0),
 orderTotal:o=>o.items.reduce((a,i)=>a+i.quantidade*i.preco,0),
 orderPaid:o=>db.transactions.filter(t=>t.orderId===o.id).flatMap(t=>t.payments).reduce((a,p)=>a+p.valor,0),
 balance:t=>Math.max(0,t.valor-t.payments.reduce((a,p)=>a+p.valor,0)),
 iso:()=> '2026-11-11',alert:v=>alerts.push(v),Math,Number,Date,String,Error,Array};
vm.runInNewContext(purchaseSource+receiptSource+paidSource,ctx,{timeout:2000});
ctx.printPurchaseOrder('entry');
assert.equal(prints.length,1);
assert(prints[0].title.includes('Pedido de compra'));
assert(prints[0].body.includes('Loja de MDF'));
assert(prints[0].body.includes('MDF 18 mm'));
assert(prints[0].body.includes('R$ 400,00'));
assert(prints[0].body.includes('ua-receipt-sig-img'));
ctx.receiptPrint('t1','p1');
assert.equal(prints.length,2);
assert(prints[1].title.includes('Recibo de pagamento'));
assert(prints[1].body.includes('Cliente do Móvel')&&prints[1].body.includes('ua-receipt-sig-img'));
ctx.v5PaidReceipt('o1');
assert.equal(prints.length,3);
assert(prints[2].title.includes('Recibo de quitação'));
assert(prints[2].body.includes('ua-receipt-sig-img'));
assert.equal(JSON.stringify(db),original,'Emitir PDFs não deve alterar banco nem financeiro');
delete ctx.window.universaArtAssinatura;
ctx.printPurchaseOrder('entry');
assert(!prints.at(-1).body.includes('ua-receipt-sig-img'),'Sem imagem, manter linha para assinatura manual');
console.log('OK PDFs: pedido de compra de fornecedor, recibo parcial/total, nome do cliente, assinatura opcional sem alterar dados.');
