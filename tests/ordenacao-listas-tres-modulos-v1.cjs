/* Regressão: ordenação visual de Financeiro, Orçamentos e Pedidos. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const src=read('preview-v1/script.js');
new vm.Script(src,{filename:'script.js'});
const from=src.indexOf('/* A ordenação é apenas visual:');
const to=src.indexOf('function button(label,action',from);
assert(from>=0&&to>from,'Controles de ordenação não encontrados');
const helper=src.slice(from,to);
const codeQuotes=src.slice(src.indexOf('function quotesView(){'),src.indexOf('function addSaleRow(',src.indexOf('function quotesView(){')));
const codeOrders=src.slice(src.indexOf('function ordersView(){'),src.indexOf('function reserveOrder(',src.indexOf('function ordersView(){')));
const codeFinance=src.slice(src.indexOf('function financeClientName(t){'),src.indexOf('function transactionModal(){',src.indexOf('function financeClientName(t){')));
const db={
 quotes:[
  {id:'q1',number:5,controlCode:'ORC-2026-005',date:'2026-11-10',clientNome:'Zilda',status:'convertido',items:[{preco:200,quantidade:1}]},
  {id:'q2',number:4,controlCode:'ORC-2026-004',date:'2026-10-30',clientNome:'Ana',status:'aberto',items:[{preco:100,quantidade:1}]}
 ],
 orders:[
  {id:'o1',number:10,controlCode:'PED-2026-010',date:'2026-11-12',status:'confirmado',stockState:'pendente',clientId:'c1',clientNome:'Zilda',items:[{preco:500,quantidade:1}]},
  {id:'o2',number:2,controlCode:'PED-2026-002',date:'2026-10-10',status:'aberto',stockState:'pendente',clientId:'c2',clientNome:'Ana',items:[{preco:200,quantidade:1}]}
 ],
 clients:[{id:'c1',nome:'Zilda'},{id:'c2',nome:'Ana'}],
 transactions:[
  {id:'t1',kind:'receber',orderId:'o1',dueDate:'2026-12-01',descricao:'Pedido 10',valor:500,payments:[]},
  {id:'t2',kind:'receber',orderId:'o2',dueDate:'2026-11-15',descricao:'Pedido 2',valor:200,payments:[{valor:50}]},
  {id:'t3',kind:'pagar',dueDate:'2026-10-05',descricao:'Fornecedor',valor:100,payments:[{valor:100}]}
 ]
};
const initial=JSON.stringify(db);
const content={innerHTML:''},search={financeiro:'',orcamentos:'',pedidos:''},rendered=[];
const round=n=>Math.round(n*100)/100;
const paid=t=>(t.payments||[]).reduce((n,p)=>n+Number(p.valor),0);
const ctx={
 db,search,content,
 esc:x=>String(x??''),intro:()=>'',inputSearch:()=>'<input>',pill:s=>String(s),
 money:n=>'R$ '+Number(n),date:s=>String(s),
 button:(label,action,id)=>'<button data-action="'+action+'" data-id="'+id+'">'+label+'</button>',
 td:(...cells)=>'<tr>'+cells.map(x=>'<td>'+x+'</td>').join('')+'</tr>',
 table:(_heads,rows)=>'<table>'+rows.join('')+'</table>',
 orderTotal:o=>round((o.items||[]).reduce((sum,i)=>sum+i.preco*i.quantidade,0)),
 orderPaid:o=>db.transactions.filter(t=>t.orderId===o.id).reduce((s,t)=>s+paid(t),0),
 cashReceived:paid,balance:t=>Math.max(0,round(t.valor-paid(t))),
 getOrder:id=>db.orders.find(o=>o.id===id),
 getClient:id=>db.clients.find(c=>c.id===id),
 kindText:{receber:'Receita',pagar:'Despesa'},statusText:{aberto:'Aberto',confirmado:'Confirmado',producao:'Em produção'},
 render:section=>rendered.push(section)
};
vm.runInNewContext(helper+codeQuotes+codeOrders+codeFinance,ctx,{timeout:3000});
const ids=(section,field,direction)=>{ctx.uaListingSort[section].field=field;ctx.uaListingSort[section].direction=direction;const rows=section==='financeiro'?db.transactions:section==='pedidos'?db.orders:db.quotes;return ctx.uaSortListing(section,rows).map(x=>x.id).join(',')};
assert.equal(ids('financeiro','vencimento','asc'),'t3,t2,t1','Financeiro: vencimento crescente');
assert.equal(ids('financeiro','vencimento','desc'),'t1,t2,t3','Financeiro: vencimento decrescente');
assert.equal(ids('financeiro','pedido','asc'),'t2,t1,t3','Financeiro: pedido 2 antes de pedido 10, despesa avulsa ao final');
assert.equal(ids('financeiro','pedido','desc'),'t1,t2,t3','Financeiro: pedido 10 antes de pedido 2, despesa avulsa ao final');
assert.equal(ids('financeiro','situacao','asc'),'t1,t2,t3','Financeiro: pendente, parcial e pago');
assert.equal(ids('financeiro','valor','desc'),'t1,t2,t3','Financeiro: valores altos primeiro');
assert.equal(ids('financeiro','cliente','asc'),'t2,t1,t3','Financeiro: cliente A-Z com sem cliente ao final');
assert.equal(ids('orcamentos','cadastro','desc'),'q2,q1','Orçamentos: mais novo por inclusão');
assert.equal(ids('orcamentos','numero','asc'),'q2,q1','Orçamentos: código crescente');
assert.equal(ids('orcamentos','data','desc'),'q1,q2','Orçamentos: data mais recente');
assert.equal(ids('orcamentos','situacao','asc'),'q2,q1','Orçamentos: aberto antes de convertido');
assert.equal(ids('orcamentos','valor','desc'),'q1,q2','Orçamentos: maior valor');
assert.equal(ids('pedidos','cadastro','desc'),'o2,o1','Pedidos: mais novo por inclusão');
assert.equal(ids('pedidos','numero','asc'),'o2,o1','Pedidos: número 2 antes de 10');
assert.equal(ids('pedidos','data','desc'),'o1,o2','Pedidos: data decrescente');
assert.equal(ids('pedidos','situacao','asc'),'o2,o1','Pedidos: aberto antes de confirmado');
assert.equal(ids('pedidos','cliente','asc'),'o2,o1','Pedidos: cliente em ordem alfabética');
assert.equal(ids('pedidos','recebido','desc'),'o2,o1','Pedidos: valor recebido');
assert.equal(JSON.stringify(db),initial,'A ordenação nunca altera registros');
assert.equal(ctx.uaSetListingSort('financeiro','pedido'),true);
assert.equal(rendered.at(-1),'financeiro','Troca na seleção renderiza somente Financeiro');
assert.equal(ctx.uaFlipListingSort('financeiro'),true);
assert.equal(ctx.uaListingSort.financeiro.direction,'asc');
assert.equal(ctx.uaSetListingSort('financeiro','campo-invalido'),false);
assert(ctx.uaListingSortControl('financeiro').includes('data-ua-list-sort="financeiro"'));
assert(ctx.uaListingSortControl('orcamentos').includes('Número do orçamento'));
assert(ctx.uaListingSortControl('pedidos').includes('Data da entrega'));
ctx.uaListingSortChanged({target:{dataset:{uaListSort:'pedidos'},value:'cliente'}});
assert.equal(ctx.uaListingSort.pedidos.field,'cliente');
assert.equal(rendered.at(-1),'pedidos');

ctx.uaListingSort.financeiro={field:'vencimento',direction:'asc'};
ctx.financeView();
assert(content.innerHTML.indexOf('Fornecedor')<content.innerHTML.indexOf('Pedido 2'));
assert(content.innerHTML.includes('data-ua-list-sort="financeiro"'));
ctx.uaListingSort.orcamentos={field:'numero',direction:'asc'};
ctx.quotesView();
assert(content.innerHTML.indexOf('ORC-2026-004')<content.innerHTML.indexOf('ORC-2026-005'));
assert(content.innerHTML.includes('data-ua-list-sort="orcamentos"'));
ctx.uaListingSort.pedidos={field:'numero',direction:'asc'};
ctx.ordersView();
assert(content.innerHTML.indexOf('PED-2026-002')<content.innerHTML.indexOf('PED-2026-010'));
assert(content.innerHTML.includes('data-ua-list-sort="pedidos"'));
search.pedidos='Zilda';
ctx.ordersView();
assert(content.innerHTML.includes('PED-2026-010')&&!content.innerHTML.includes('PED-2026-002'),'Busca continua funcionando');
assert(src.includes("content.addEventListener('change',uaListingSortChanged)"),'Evento da lista ausente');
assert(src.includes("case 'ua-list-sort-direction':return uaFlipListingSort(item)"),'Botão de direção ausente');
for(const page of ['preview-v1/index.html','preview-v1/seguro.html']){
 const html=read(page);
 assert(html.includes('list-sort-v1.css')&&html.includes('ordenacao-tres-modulos-20261112'),'CSS e atualização de cache em '+page);
}
assert(read('preview-v1/list-sort-v1.css').includes('.ua-list-sort-dir'));
console.log('OK: ordenação por pedido, data, situação, cliente e valor nos três módulos; busca e dados preservados.');
