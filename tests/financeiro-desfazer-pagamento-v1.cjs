/* Regressão de desfazer pagamento — OFICINA 1.0 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync(path.join(__dirname,'../preview-v1/script.js'),'utf8');
const slice=(a,b)=>{const i=src.indexOf(a),j=src.indexOf(b,i+a.length);assert(i>=0&&j>i,'Fonte não encontrada '+a);return src.slice(i,j)};
const sortingSrc=slice('/* A ordenação é apenas visual:','function button(label,action');
const financeSrc=slice('function financeClientName(t){','function transactionModal(){');
const historySrc=slice('function paymentHistoryModal(tid){','const defaultContract=');
new vm.Script(sortingSrc+financeSrc+historySrc);
const receivable={id:'t1',kind:'receber',descricao:'Pedido PED-2026-004 · Parcela 1/1',valor:5300,
 dueDate:'2026-11-11',orderId:'o1',
 payments:[{id:'pay1',valor:2000,date:'2026-11-09',method:'Pix'}, {id:'pay2',valor:3300,date:'2026-11-11',method:'Dinheiro'}]};
const payable={id:'t2',kind:'pagar',descricao:'Fornecedor MDF',valor:500,dueDate:'2026-11-12',
 orderId:'',payments:[{id:'p3',valor:500,date:'2026-11-11',method:'Transferência'}]};
const db={transactions:[receivable,payable],orders:[{id:'o1',number:4,controlCode:'PED-2026-004',clientId:'c1'}],clients:[{id:'c1',nome:'Cliente do Pedido Teste'}],
 products:[{id:'mdf',nome:'MDF 15 mm',estoque:4}]};
const initialOthers=JSON.stringify({orders:db.orders,products:db.products});
const content={innerHTML:''},alerts=[],modal=[],dialogs=[];
let saves=0,saveResult=true,confirmResult=false,renders=0,idCounter=0;
const round=n=>Math.round(Number(n)*100)/100;
const paid=t=>(t.payments||[]).reduce((s,p)=>s+Number(p.valor||0),0);
const balance=t=>Math.max(0,round(t.valor-paid(t)));
const money=n=>'R$ '+Number(n).toLocaleString('pt-BR',{minimumFractionDigits:2});
const ctx={db,content,search:{financeiro:''},Number,Math,Date,Set,Map,String,Error,Array,
 esc:x=>String(x).replace(/[&<>]/g,''),date:d=>String(d).split('-').reverse().join('/'),
 id:()=> 'undo'+(++idCounter),iso:()=> '2026-11-11',money,round,
 cashReceived:paid,balance,getOrder:id=>db.orders.find(o=>o.id===id),getClient:id=>db.clients.find(c=>c.id===id),
 kindText:{receber:'Receita',pagar:'Despesa'},getProduct:()=>null,
 intro:(title)=>title,inputSearch:()=>'<input>',pill:(label)=>label,
 button:(label,action,item)=>'<button data-action="'+action+'" data-id="'+item+'">'+label+'</button>',
 table:(cols,rows)=>'<table>'+rows.join('')+'</table>',
 td:(...items)=>'<tr>'+items.map(v=>'<td>'+v+'</td>').join('')+'</tr>',
 openModal:(title,html,onSubmit,after)=>{const d={dataset:{},title,html};modal.push(d);after?.(d);return d},
 document:{querySelector:()=>({close(){dialogs.push('close')}})},
 confirm:()=>confirmResult,alert:v=>alerts.push(v),render:()=>{renders++},
 save:()=>{saves++;return saveResult}
};
vm.runInNewContext(sortingSrc+financeSrc+historySrc,ctx,{timeout:2500});
ctx.financeView();
assert(content.innerHTML.includes('Desfazer pagamento'));
assert(content.innerHTML.includes('Recibos'));
assert(content.innerHTML.includes('Cliente:')&&content.innerHTML.includes('Cliente do Pedido Teste'),'Financeiro mostra cliente de cada pedido');
ctx.search.financeiro='Cliente do Pedido Teste';ctx.financeView();
assert(content.innerHTML.includes('Pedido PED-2026-004'),'Busca deve encontrar lançamento pelo cliente');
ctx.search.financeiro='';ctx.financeView();
assert(content.innerHTML.includes('R$ 5.300,00')&&content.innerHTML.includes('R$ 500,00'));
ctx.paymentHistoryModal('t1');
assert(modal[0].html.includes('undo-payment'));
assert(modal[0].html.includes('pay1')&&modal[0].html.includes('pay2'));
assert.equal(ctx.undoPayment('t1:pay2'),false,'Cancelar não desfaz');
assert.equal(receivable.payments.length,2);
assert.equal(saves,0);
confirmResult=true;
saveResult=false;
assert.throws(()=>ctx.undoPayment('t1:pay2'),/preservado/);
assert.equal(receivable.payments.length,2,'Rollback em falha');
assert.equal(receivable.paymentReversals,undefined,'Nenhum estorno gravado em falha');
saveResult=true;
assert.equal(ctx.undoPayment('t1:pay2'),true);
assert.equal(receivable.payments.length,1);
assert.equal(balance(receivable),3300);
assert.equal(receivable.paymentReversals.length,1,'Estorno auditável');
assert.equal(receivable.paymentReversals[0].originalPaymentId,'pay2');
assert.equal(receivable.paymentReversals[0].valor,3300);
ctx.financeView();
assert(content.innerHTML.includes('Parcial'),'Pago vira parcial após desfazer uma de duas parcelas');
assert(content.innerHTML.includes('R$ 3.300,00'),'Saldo reaberto');
assert(content.innerHTML.includes('R$ 2.000,00'),'Recebido atualizado para 2.000');
assert(content.innerHTML.includes('R$ 1.500,00'),'Caixa atualizado para 1.500 após descontar despesa de 500');
assert.throws(()=>ctx.undoPayment('t1:pay2'),/já foi desfeito/,'Não permitir estorno repetido');
ctx.paymentHistoryModal('t1');
assert(modal.at(-1).html.includes('Estornos registrados'));
assert(!modal.at(-1).html.includes('data-id="t1:pay2"'),'Recibo já estornado não fica ativo');
assert.equal(ctx.undoPayment('t1:pay1'),true);
assert.equal(balance(receivable),5300);
ctx.financeView();
assert(content.innerHTML.includes('Pendente'),'Todos recebimentos desfeitos');
assert.equal(ctx.undoPayment('t2:p3'),true,'Desfazer pagamento de fornecedor');
assert.equal(balance(payable),500);
assert.equal(payable.paymentReversals.length,1);
assert.equal(JSON.stringify({orders:db.orders,products:db.products}),initialOthers,'Nenhum pedido ou estoque foi alterado');
assert(alerts.every(v=>!v.includes('erro')));
console.log('OK financeiro: pagar/receber, cancelamento, estorno parcial, total, histórico, rollback, sem alterar pedidos/estoque.');
