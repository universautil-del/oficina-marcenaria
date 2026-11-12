/* Regressão: relatório financeiro sem alteração de dados. */
'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const src=read('preview-v1/relatorio-financeiro-v1.js');
new vm.Script(src,{filename:'relatorio-financeiro-v1.js'});
const db={
 orders:[{id:'o1',number:10,controlCode:'PED-2026-010',clientId:'c1',clientNome:'Empresa A'}],
 purchases:[{id:'p1',number:5,supplierNome:'Fornecedor MDF'}],
 clients:[{id:'c1',nome:'Empresa A'}],
 transactions:[
  {id:'t1',kind:'receber',orderId:'o1',valor:1000,dueDate:'2026-11-15',
   descricao:'Pedido mensal',payments:[{id:'x1',date:'2026-11-20',valor:600,method:'Pix'},{id:'x2',date:'2026-12-01',valor:400,method:'Boleto'}]},
  {id:'t2',kind:'pagar',purchaseId:'p1',valor:1500,dueDate:'2026-11-30',
   descricao:'Aluguel da oficina',payments:[{id:'y1',date:'2026-11-10',valor:300,method:'Transferência'}]},
  {id:'t3',kind:'pagar',valor:250,dueDate:'2026-10-12',
   descricao:'Conta antiga',payments:[{id:'z1',date:'2026-10-18',valor:250,method:'Pix'}]},
  {id:'t4',kind:'receber',valor:200,dueDate:'2026-11-05',descricao:'Serviço avulso',payments:[]},
  {id:'t5',kind:'receber',valor:100,dueDate:'2027-02-01',descricao:'Parcela futura',payments:[]}
 ]
};
const base=JSON.stringify(db),ctx={
 db,window:{},iso:()=> '2026-11-12',
 esc:t=>String(t??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'),
 money:t=>'R$ '+Number(t).toFixed(2),pill:(label)=>'<span>'+label+'</span>',
 td:(...cells)=>'<tr>'+cells.map(c=>'<td>'+c+'</td>').join('')+'</tr>',
 alert:()=>{},render:()=>{},
 Number,Math,Date,Intl,Array,Object,String,Map,Set,Error
};
vm.runInNewContext(src,ctx,{timeout:3500});
const api=ctx.window.universaArtRelatorioFinanceiro;
assert(api&&typeof api.compute==='function'&&typeof api.buildWorkbook==='function');
const criteria={from:'2026-11-01',to:'2026-11-30',type:'todos',status:'todos',basis:'vencimento'};
let result=api.compute(db,criteria);
assert.equal(result.rows.length,3);
assert.equal(result.summary.expectedIncome,1200);
assert.equal(result.summary.expectedExpense,1500);
assert.equal(result.summary.received,1000,'Pagamentos quitados até agora, mesmo fora do período');
assert.equal(result.summary.paid,300);
assert.equal(result.summary.openIncome,200);
assert.equal(result.summary.openExpense,1200);
assert.equal(result.months.length,1);
assert.equal(result.months[0].resultado,-300);
assert.equal(result.rows.find(r=>r.id==='t2').person,'Fornecedor MDF');
assert.equal(result.rows.find(r=>r.id==='t1').reference,'PED-2026-010');
result=api.compute(db,{...criteria,type:'pagar'});
assert.equal(result.rows.length,1,'Somente despesas');
assert.equal(result.rows[0].description,'Aluguel da oficina');
result=api.compute(db,{...criteria,status:'pago'});
assert.equal(result.rows.length,1,'Somente pagamentos quitados');
result=api.compute(db,{...criteria,status:'vencido'});
assert.equal(result.rows.length,1,'Atrasos já vencidos');
assert.equal(result.rows[0].id,'t4');
result=api.compute(db,{...criteria,basis:'caixa',status:'vencido'});
assert.equal(result.rows.length,2,'Visão de caixa considera pagamentos, não situação');
assert.equal(result.summary.received,600);
assert.equal(result.summary.paid,300);
assert.equal(result.summary.openIncome,0);
assert.equal(result.rows.find(r=>r.id==='t1').method,'Pix');
assert.equal(result.rows.find(r=>r.id==='t2').date,'2026-11-10');
result=api.compute(db,{...criteria,basis:'caixa',type:'pagar'});
assert.equal(result.rows.length,1,'Caixa filtra somente despesas');
assert.equal(result.summary.paid,300);
for(const bad of [{from:'2026-12-01',to:'2026-11-01'},{from:'2026-02-30'},{type:'inexistente'},{basis:'outro'}])
 assert.throws(()=>api.compute(db,{...criteria,...bad}));
assert.equal(api.presetRange('seis','2026-11-12').from,'2026-06-01');
assert.equal(api.presetRange('mes','2026-11-12').from,'2026-11-01');
api.state.from=criteria.from;
api.state.to=criteria.to;
api.state.type='todos';
api.state.status='todos';
api.state.basis='vencimento';
const markup=api.panel();
assert(markup.includes('Relatório financeiro analítico'));
assert(markup.includes('Exportar Excel (.xlsx)'));
assert(markup.includes('Últimos 6 meses'));
assert(markup.includes('data-ua-fin-filter="from"'));
assert(markup.includes('data-ua-fin-filter="basis"'));
assert(markup.includes('Pedido mensal')&&markup.includes('Aluguel da oficina'));
assert(markup.includes('Evolução')===false||markup.includes('Resumo por mês'));
assert.equal(JSON.stringify(db),base,'Relatório nunca modifica lançamentos');
const upgrade=read('preview-v1/upgrade.js');
assert(upgrade.includes("window.universaArtRelatorioFinanceiro?.panel?.()"),'Relatório deve aparecer no menu Relatórios');
assert(upgrade.includes("window.universaArtRelatorioFinanceiro?.bind?.(content)"),'Filtros precisam de eventos');
assert(read('preview-v1/script.js').includes("button('Relatório financeiro','go-reports'"),'Atalho deve aparecer no Financeiro');
for(const page of ['preview-v1/index.html','preview-v1/seguro.html']){
 const html=read(page);
 assert(html.includes('relatorio-financeiro-v1.js')&&html.includes('relatorio-financeiro-v1.css'),'Assets do relatório no '+page);
}
console.log('OK relatório financeiro: períodos, vencimento/caixa, receitas/despesas, situação, totais, acesso e preservação dos dados.');
