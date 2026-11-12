/* OFICINA: despesas recorrentes com mesmo valor mensal e vencimento independente. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync(path.join(__dirname,'../preview-v1/script.js'),'utf8');
const slice=(a,b)=>{const i=src.indexOf(a),j=src.indexOf(b,i+a.length);assert(i>=0&&j>i,'Trecho não encontrado: '+a);return src.slice(i,j)};
const code=slice('function addMonths(','function buildInstallments(')+
 slice('function transactionModal(){','function editTransactionModal(');
new vm.Script(code);
const unrelated={id:'existing',kind:'pagar',descricao:'Pagamento já lançado',dueDate:'2026-11-05',valor:400,payments:[{id:'p1',valor:400,date:'2026-11-05'}]};
const db={transactions:[unrelated]};
let saves=0,failSave=false,serial=0,modal;
const round=n=>Math.round(Number(n)*100)/100;
const context={
 db,Date,Number,String,Math,Object,Array,Error,round,
 iso:()=> '2026-11-12',
 id:()=> 'new-'+(++serial),
 openModal:(heading,fields,submit)=>{modal={heading,fields,submit};return modal},
 save:()=>{saves++;return !failSave}
};
vm.runInNewContext(code,context,{timeout:3000});
context.transactionModal();
assert(modal.fields.includes('Quantidade de parcelas'));
assert(modal.fields.includes('name="parcelas"'));
assert(modal.fields.includes('Valor de cada parcela'));
assert(modal.fields.includes('vencimentos mensais'));
const values={
 kind:'pagar',descricao:'Aluguel da oficina',
 dueDate:'2026-11-30',valor:'1500.00',
 parcelas:'12',paymentMethod:'Pix',observacoes:'Contrato anual'
};
assert.equal(modal.submit(values),true);
assert.equal(saves,1,'Uma única operação de salvamento');
assert.equal(db.transactions.length,13,'Doze parcelas + conta anterior');
const created=db.transactions.slice(1);
assert(created.every(t=>t.kind==='pagar'&&t.valor===1500));
assert(created.every(t=>t.payments.length===0&&t.orderId===''));
assert(created.every(t=>t.paymentMethod==='Pix'));
assert.equal(created.reduce((sum,t)=>sum+t.valor,0),18000);
assert.equal(created[0].dueDate,'2026-11-30');
assert.equal(created[1].dueDate,'2026-12-30');
assert.equal(created[2].dueDate,'2027-01-30');
assert.equal(created[3].dueDate,'2027-02-28','Ajustar fevereiro sem mover permanentemente o dia 30');
assert.equal(created[4].dueDate,'2027-03-30','Retomar o dia 30 no mês seguinte');
assert.equal(created.at(-1).dueDate,'2027-10-30');
assert.equal(created[0].descricao,'Aluguel da oficina · Parcela 1/12');
assert.equal(created.at(-1).descricao,'Aluguel da oficina · Parcela 12/12');
assert(created.every((t,i)=>t.numeroParcela===i+1&&t.totalParcelas===12&&t.periodicidade==='mensal'));
assert.equal(new Set(created.map(t=>t.id)).size,12,'Cada parcela precisa de ID exclusivo');
assert.equal(new Set(created.map(t=>t.recurrenceId)).size,1,'Mesmo grupo de recorrência');
assert.equal(unrelated.payments[0].valor,400,'Pagamento já existente não alterado');
const before=JSON.stringify(db.transactions);
context.transactionModal();
failSave=true;
assert.throws(()=>modal.submit({...values,descricao:'Outra mensalidade'}),/Nenhuma parcela foi criada/);
assert.equal(JSON.stringify(db.transactions),before,'Rollback integral quando salvar falhar');
failSave=false;
for(const bad of ['0','1.5','-1','61','Infinity','abc']){
 context.transactionModal();
 assert.throws(()=>modal.submit({...values,parcelas:bad}),/quantidade|mensal/i,'Quantidade de parcelas inválida: '+bad);
}
context.transactionModal();
assert.throws(()=>modal.submit({...values,dueDate:'2026-02-30'}),/data válida/);
const afterInvalid=JSON.stringify(db.transactions);
assert.equal(afterInvalid,before,'Validação nunca cria parcelas');
context.transactionModal();
assert.equal(modal.submit({...values,parcelas:'1',descricao:'Parcela única'}),true);
const single=db.transactions.at(-1);
assert.equal(single.descricao,'Parcela única');
assert.equal(single.dueDate,'2026-11-30');
assert.equal(single.recurrenceId,undefined);
assert.equal(db.transactions.length,14);
context.transactionModal();
assert.equal(modal.submit({...values,kind:'receber',parcelas:'2',descricao:'Mensalidade cliente'}),true);
assert.equal(db.transactions.slice(-2).filter(t=>t.kind==='receber').length,2,'Parcelas de receita também suportadas');
console.log('OK financeiro: aluguel recorrente 12 meses, valores independentes, vencimentos, pagamento, rollback e validação.');
