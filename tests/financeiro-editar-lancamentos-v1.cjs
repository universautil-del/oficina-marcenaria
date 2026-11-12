/* Regressão do editor financeiro — UNIVERSA ART OFICINA */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync(path.join(__dirname,'../preview-v1/script.js'),'utf8');
const from=src.indexOf('function financeClientName(t){'),to=src.indexOf('function receiptModal(tid){',from);
assert(from>=0&&to>from,'Editor financeiro ausente');
const code=src.slice(from,to);
const sortingSrc=src.slice(src.indexOf('/* A ordenação é apenas visual:'),src.indexOf('function button(label,action'));
new vm.Script(sortingSrc+code);
assert(src.includes("case 'edit-transaction':return editTransactionModal(item)"),'Ação do lançamento ausente');
assert(src.includes("case 'edit-payment':return editRecordedPaymentModal(item)"),'Ação do pagamento ausente');

const order={id:'o1',number:4,controlCode:'PED-2026-004',clientId:'c1',payment:{forma:'Pix'},items:[{preco:2500,quantidade:1}]};
const linked={id:'t1',kind:'receber',orderId:'o1',descricao:'Pedido PED-2026-004 · Parcela 1/1',valor:2500,dueDate:'2026-10-30',payments:[]};
const manual={id:'t2',kind:'pagar',orderId:'',descricao:'Despesa manual',valor:1000,dueDate:'2026-11-12',payments:[]};
const paid={id:'t3',kind:'receber',orderId:'',descricao:'Serviço avulso',valor:1000,dueDate:'2026-11-20',payments:[{id:'pay1',valor:600,date:'2026-11-11',method:'Pix'}]};
const purchase={id:'t4',kind:'pagar',purchaseId:'pur1',descricao:'Entrada de Materiais',valor:500,dueDate:'2026-11-18',payments:[]};
const db={transactions:[linked,manual,paid,purchase],orders:[order],clients:[{id:'c1',nome:'Cliente exemplo'}],purchases:[{id:'pur1',dueDate:'2026-11-18'}]};
const originalOrder=JSON.stringify(order),alerts=[],calls=[];
let saved=0,saveOK=true,seq=0;
const paidAmount=t=>(t.payments||[]).reduce((s,p)=>s+Number(p.valor),0);
const round=n=>Math.round(Number(n)*100)/100;
const money=n=>Number(n).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const ctx={
 db,Number,Date,Math,String,Array,Map,Set,Object,Error,
 search:{financeiro:''},content:{innerHTML:''},getClient:id=>db.clients.find(c=>c.id===id),
 getOrder:id=>db.orders.find(o=>o.id===id),cashReceived:paidAmount,balance:t=>Math.max(0,round(t.valor-paidAmount(t))),
 round,money,id:()=>'test'+(++seq),iso:()=>'2026-11-12',date:s=>String(s||'').split('-').reverse().join('/'),
 esc:s=>String(s??'').replace(/[&<>"]/g,''),kindText:{receber:'Receita',pagar:'Despesa'},
 intro:()=>'',inputSearch:()=>'',pill:label=>label,
 button:(label,act,item)=>'<button data-action="'+act+'" data-id="'+item+'">'+label+'</button>',
 td:(...values)=>'<tr>'+values.map(v=>'<td>'+v+'</td>').join('')+'</tr>',
 table:(_heads,rows)=>'<table>'+rows.join('')+'</table>',
 openModal:(head,fields,submit,after)=>{const modal={head,fields,submit,after};calls.push(modal);return modal},
 save:()=>{saved++;return saveOK},alert:message=>alerts.push(message),
 document:{querySelector:()=>({close:()=>{}})}
};
vm.runInNewContext(sortingSrc+code,ctx,{timeout:2500});
ctx.financeView();
assert(ctx.content.innerHTML.includes('data-action="edit-transaction"'), 'Botão Editar ausente');
assert(ctx.content.innerHTML.includes('Forma prevista: Pix'), 'Forma do pedido não exibida');
assert(ctx.financeValidDate('2026-12-15'));
assert(!ctx.financeValidDate('2026-02-30'),'Data inválida aceita');

ctx.editTransactionModal('t1');
let modal=calls.at(-1);
assert(modal.fields.includes('readonly')&&modal.fields.includes('Forma de pagamento prevista'));
assert(modal.submit({dueDate:'2026-12-15',kind:'pagar',descricao:'Valor adulterado',valor:'1',paymentMethod:'Boleto',observacoes:'Reprogramado'}));
let updated=db.transactions.find(t=>t.id==='t1');
assert.equal(updated.dueDate,'2026-12-15');
assert.equal(updated.kind,'receber','Tipo do pedido não pode mudar');
assert.equal(updated.valor,2500,'Valor do pedido não pode mudar');
assert.equal(updated.descricao,linked.descricao,'Descrição do pedido não pode mudar');
assert.equal(updated.paymentMethod,'Boleto');
assert.equal(updated.financeEditHistory.length,1);
assert.equal(JSON.stringify(order),originalOrder,'Pedido não deve ser alterado');

ctx.editTransactionModal('t1');
modal=calls.at(-1);const before=JSON.stringify(db);
saveOK=false;
assert.throws(()=>modal.submit({dueDate:'2026-12-20',paymentMethod:'Pix',observacoes:''}),/Não foi possível salvar/);
assert.equal(JSON.stringify(db),before,'Edição falha deve fazer rollback');
saveOK=true;

ctx.editTransactionModal('t2');
modal=calls.at(-1);
assert(modal.submit({kind:'receber',descricao:'Receita avulsa',valor:'1200',dueDate:'2026-12-01',paymentMethod:'Transferência',observacoes:'Confirmar'}));
assert.equal(db.transactions.find(t=>t.id==='t2').kind,'receber');
assert.equal(db.transactions.find(t=>t.id==='t2').valor,1200);

ctx.editTransactionModal('t3');
modal=calls.at(-1);
assert.throws(()=>modal.submit({kind:'pagar',descricao:'Alterado',valor:'100',dueDate:'2026-11-20',paymentMethod:'',observacoes:''}),/abaixo do total já pago/);
assert.equal(db.transactions.find(t=>t.id==='t3').valor,1000);
assert(modal.fields.includes('disabled'),'Tipo com pagamento já registrado deve ser bloqueado');

ctx.editTransactionModal('t4');
modal=calls.at(-1);
assert(modal.submit({dueDate:'2026-12-10',paymentMethod:'Boleto',observacoes:''}));
assert.equal(db.purchases[0].dueDate,'2026-12-10','Vencimento da entrada deve ser atualizado');

ctx.paymentHistoryModal('t3');
modal=calls.at(-1);
assert(modal.fields.includes('edit-payment'),'Histórico sem botão de edição');
ctx.editRecordedPaymentModal('t3:pay1');
modal=calls.at(-1);
assert(modal.fields.includes('readonly'),'Valor recebido deve ficar protegido');
assert(modal.submit({date:'2026-11-10',method:'Dinheiro'}));
let newPay=db.transactions.find(t=>t.id==='t3');
assert.equal(newPay.payments[0].valor,600);
assert.equal(newPay.payments[0].date,'2026-11-10');
assert.equal(newPay.payments[0].method,'Dinheiro');
assert.equal(newPay.paymentCorrections.length,1);
assert.equal(newPay.paymentCorrections[0].before.method,'Pix');
ctx.editRecordedPaymentModal('t3:pay1');
modal=calls.at(-1);const oldPay=JSON.stringify(newPay);
saveOK=false;
assert.throws(()=>modal.submit({date:'2026-11-09',method:'Cartão'}),/Falha ao salvar/);
assert.equal(JSON.stringify(newPay),oldPay,'Correção do pagamento deve retornar ao estado anterior');
saveOK=true;

ctx.paymentModal('t1');
assert(calls.at(-1).fields.includes('value="Boleto"'),'Registrar pagamento deve sugerir forma definida');
assert.deepEqual(alerts,[]);
console.log('OK editor financeiro: datas, formas, parcelas, valores protegidos, histórico e rollback.');
