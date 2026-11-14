/* Relatório de estoque: saldo físico, ordenação, totais e exportação sem alterações comerciais. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const source=read('preview-v1/relatorio-estoque-v1.js');
new vm.Script(source);
const products=[
 {id:'p1',tipo:'materia',codigo:'001',nome:'MDF branco 15 mm',categoria:'Chapas MDF',unidade:'chapa',estoque:4,custo:120.25,preco:350},
 {id:'p2',tipo:'materia',codigo:'002',nome:'Parafuso 4x40',categoria:'Parafusos',unidade:'un',estoque:200,custo:0.35,preco:2.5},
 {id:'p3',tipo:'materia',codigo:'003',nome:'Bucha 8 mm',categoria:'Buchas',unidade:'un',estoque:0,custo:0.20,preco:1.5},
 {id:'p4',tipo:'materia',codigo:'004',nome:'Fita borda',categoria:'Fitas',unidade:'m',estoque:7,custo:null},
 {id:'p5',tipo:'acabado',codigo:'005',nome:'Guarda roupa',categoria:'Móveis',unidade:'un',estoque:12,custo:9999},
 {id:'p6',tipo:'materia',codigo:'006',nome:'Material sem custo',categoria:'Outros',unidade:'un',estoque:3,custo:0}
];
const db={products:structuredClone(products),stockMovements:[{id:'m',delta:10}],transactions:[{id:'t',valor:550}],orders:[{id:'o1'}]};
const snapshot=JSON.stringify(db);
const created={};
let outputCSV=null;
const context={
 db,window:{},
 esc:s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;',"'":'&#39;'}[c])),
 money:x=>Number(x||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}),
 td:(...columns)=>'<tr>'+columns.map(c=>'<td>'+c+'</td>').join('')+'</tr>',
 table:(heads,rows,empty='')=>'<table><thead>'+heads.join('|')+'</thead><tbody>'+(
  rows?.length?rows.join(''):'<tr>'+empty+'</tr>')+'</tbody></table>',
 iso:()=>'2026-11-13',
 download:(name,data,type)=>{outputCSV={name,data,type}},
 openPrint:(name,html)=>{created.print={name,html}},
 alert:msg=>{created.error=msg},
 Intl,Number,Array,Math,Date,Map,Set,String,Error,Promise,Blob,
 document:{querySelector:()=>null},
 content:{querySelector:()=>null}
};
vm.runInNewContext(source,context,{timeout:3000});
const api=context.window.universaArtRelatorioEstoque;
assert(api&&api.compute&&api.panel&&api.exportCsv&&api.workbook);
let r=api.compute(db);
assert.equal(r.items,4,'Por padrão somente matérias-primas com saldo positivo');
assert.equal(r.total,551,'4 * 120.25 + 200 * 0.35 = 551.00');
assert.equal(r.missingCost,1,'Valor nulo continua sem custo');
assert.equal(r.zeroCost,1,'Custo zero sinalizado');
assert(!r.rows.some(x=>x.descricao==='Guarda roupa'),'Produto acabado sem saldo próprio excluído');
assert(!r.rows.some(x=>x.descricao==='Bucha 8 mm'),'Sem estoque zero no padrão');
assert(r.rows.some(x=>x.descricao==='Fita borda'&&x.valorUnitario===null&&x.valorTotal===null),'Custo ausente não vira zero');
r=api.compute(db,{...api.state,sort:'saldo',direction:'desc'});
assert.equal(r.rows[0].descricao,'Parafuso 4x40');
r=api.compute(db,{...api.state,sort:'valorTotal',direction:'desc'});
assert.equal(r.rows[0].descricao,'MDF branco 15 mm');
assert.equal(r.rows.at(-1).descricao,'Fita borda','Custos faltantes ao final');
r=api.compute(db,{...api.state,category:'Parafusos'});
assert.equal(r.items,1);
assert.equal(r.total,70);
r=api.compute(db,{...api.state,stock:'todos'});
assert.equal(r.items,5,'Incluir material zerado em seleção Todos');
r=api.compute(db,{...api.state,stock:'zerado'});
assert.equal(r.items,1);assert.equal(r.rows[0].descricao,'Bucha 8 mm');
r=api.compute(db,{...api.state,query:'mdf'});
assert.equal(r.items,1);
assert.equal(r.rows[0].valorUnitario,120.25);
const html=api.panel();
for(const txt of ['Relatório de produtos em estoque','Descrição do item','Unidade','Saldo em estoque',
 'Valor unitário','Valor total','Ordenar por','Crescente','Exportar Excel','Exportar CSV','Imprimir / PDF','R$'])
 assert(html.includes(txt),'Campo ausente: '+txt);
assert(html.includes('custo unitário')&&html.includes('não o preço de venda'));
api.exportCsv();
assert(outputCSV&&outputCSV.name.endsWith('.csv'));
assert(outputCSV.data.startsWith('\ufeff'));
assert(outputCSV.data.includes('"MDF branco 15 mm"'));
assert(outputCSV.data.includes('"120,25"'));
assert(!outputCSV.data.includes('Guarda roupa'));
const inject={products:[{tipo:'materia',id:'hack',nome:'=HYPERLINK("x","y")',estoque:1,custo:5,unidade:'un'}]};
const safeCsv=api.buildCsv(api.compute(inject));
assert(safeCsv.includes("'=HYPERLINK"),'Neutralizar fórmula maliciosa em CSV');
class Row{
 constructor(n,values){this.number=n;this.values=values;this.cells={};this.font=null;}
 eachCell(fn){for(let i=1;i<=5;i++)fn(this.getCell(i));}
 getCell(n){return this.cells[n]||(this.cells[n]={numFmt:'',fill:{}})}
}
class Worksheet{
 constructor(name){this.name=name;this.rows=[];this.columns=[];this.views=[];}
 getRow(n){return this.rows[n-1]||(this.rows[n-1]=new Row(n,{}))}
 getCell(a){return {numFmt:''}}
 addRow(values){const row=new Row(this.rows.length+1,values);this.rows.push(row);return row}
 getColumn(){return {alignment:{}}}
}
class Book{
 constructor(){this.sheets=[]}
 addWorksheet(name){const sheet=new Worksheet(name);this.sheets.push(sheet);return sheet}
}
const wb=api.workbook({Workbook:Book},api.compute(db));
assert.equal(wb.sheets.length,2);
assert.equal(wb.sheets[0].name,'Produtos em estoque');
assert.equal(wb.sheets[0].rows.length,6,'4 matérias-primas + total + cabeçalho de Excel');
assert.equal(wb.sheets[0].rows[1].values.saldo,4);
assert.equal(wb.sheets[0].rows[1].values.unitario,120.25);
assert.equal(wb.sheets[0].rows[1].values.total,481);
assert.equal(wb.sheets[0].rows[3].values.unitario,null,'Sem custo não pode virar zero no Excel');
assert.equal(wb.sheets[0].rows[3].values.total,null);
assert.equal(wb.sheets[0].rows.at(-1).values.total,551);
assert.equal(JSON.stringify(db),snapshot,'Relatório não altera estoque, pedidos nem financeiro');
for(const page of ['preview-v1/index.html','preview-v1/seguro.html']){
 const html=read(page);
 assert(html.includes('relatorio-estoque-v1.js')&&html.includes('relatorio-estoque-v1.css'));
 assert(html.includes('cadastro-categorias-v1.js'));
}
const upgrade=read('preview-v1/upgrade.js'),catalog=read('preview-v1/catalogo-produtos-1-0.js');
assert(upgrade.includes('window.universaArtRelatorioEstoque?.panel?.()'));
assert(upgrade.includes('window.universaArtRelatorioEstoque?.bind?.(content)'));
assert(catalog.includes("button('Relatório de estoque'")&&catalog.includes("button('Categorias'"));
assert(catalog.includes('<select name="categoria"'));
assert(catalog.includes('data-ua-category-new'));
console.log('OK relatório de estoque: custo x saldo, filtros e ordenação, Excel/CSV, relatório em tela e preservação de dados.');
