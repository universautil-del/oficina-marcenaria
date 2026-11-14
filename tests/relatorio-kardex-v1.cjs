/* Kardex UNIVERSA ART: histórico completo, saldos reconstituídos, cabeçalho e isolamento. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const src=read('preview-v1/relatorio-kardex-v1.js');
new vm.Script(src);
assert(src.length<18000,'Kardex leve, sem incluir bibliotecas extras no HTML');
assert(!src.includes('fetch('),'Consulta não pesquisa na internet');
let exported=null,printed=null;
const db={
 products:[
  {id:'p1',codigo:'01',tipo:'materia',nome:'MDF Amêndola',categoria:'Chapas MDF',unidade:'chapa',estoque:15,minimo:3,maximo:30,custo:145,preco:299},
  {id:'p2',codigo:'02',tipo:'materia',nome:'Parafuso',categoria:'Fixação',unidade:'pacote',estoque:0,minimo:10,custo:50},
  {id:'p3',codigo:'03',tipo:'acabado',nome:'Guarda Roupa',estoque:1,custo:900}
 ],
 stockMovements:[
  {id:'m1',productId:'p1',delta:10,date:'2026-11-10',note:'Estoque inicial'},
  {id:'m2',productId:'p2',delta:4,date:'2026-11-10',note:'Outro produto'},
  {id:'m3',productId:'p1',delta:8,date:'2026-11-11',purchaseId:'e1',note:'Entrada de materiais #7'},
  {id:'m4',productId:'p1',delta:-3,date:'2026-11-11',orderId:'o1',note:'Consumo pedido #3'}
 ],
 purchases:[{id:'e1',number:7}],orders:[{id:'o1',number:3,controlCode:'PED-2026-003'}],transactions:[{id:'finance',valor:1}]
};
const before=JSON.stringify(db);
const context={
 window:{},db,
 esc:value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
 date:value=>String(value).split('-').reverse().join('/'),
 iso:()=>'2026-11-14',
 money:n=>'R$ '+Number(n||0).toFixed(2).replace('.',','),
 download:(name,data,mime)=>{exported={name,data,mime}},
 openPrint:(name,html)=>{printed={name,html}},
 td:(...cells)=>'<tr>'+cells.map(c=>'<td>'+c+'</td>').join('')+'</tr>',
 table:(headers,rows,empty='')=>'<table><thead>'+headers.join('|')+'</thead><tbody>'+(rows.length?rows.join(''):'<tr>'+empty+'</tr>')+'</tbody></table>',
 alert:m=>{throw Error('Alerta inesperado: '+m)},
 content:{querySelector:()=>null},
 location:{hash:'#dashboard'},render:()=>{},
 Intl,Number,Array,Math,Date,String,Map,Set,Promise,Error
};
vm.runInNewContext(src,context,{timeout:3000});
const api=context.window.universaArtKardex;
assert(api&&api.build&&api.panel&&api.workbook&&api.selectProduct);
assert.equal(api.products(db).length,2,'Apenas produtos de matéria-prima');
const oldest=api.build(db,'p1','asc');
assert.equal(oldest.count,3,'Todos os movimentos do item, e nenhum de outro produto');
assert.equal(oldest.opening,0);
assert.equal(oldest.product.max,30);
assert.equal(oldest.product.min,3);
assert.equal(oldest.product.buy,145);
assert.equal(oldest.product.current,15);
assert.equal(oldest.movements[0].after,10);
assert.equal(oldest.movements[1].after,18);
assert.equal(oldest.movements[2].after,15);
assert.equal(oldest.movements[1].type,'Entrada por compra');
assert.equal(oldest.movements[1].reference,'Entrada de materiais #7');
assert.equal(oldest.movements[2].type,'Saída para produção');
assert.equal(oldest.movements[2].reference,'PED-2026-003');
assert.equal(oldest.movements[0].indexLabel,1);
assert.equal(oldest.movements[2].indexLabel,3);
assert.equal(oldest.entry,18);
assert.equal(oldest.exit,3);
const recent=api.build(db,'p1','desc');
assert.equal(recent.movements[0].after,15);
assert.equal(recent.movements[0].indexLabel,3);
assert.equal(recent.movements[2].after,10);
assert.equal(api.build(db,'p2').product.max,null,'Máximo não definido fica vazio, não zero');
assert.equal(api.build(db,'p3'),null,'Acabado não tem kardex de matéria-prima');
api.state.productId='p1';
const panel=api.panel();
for(const name of [
 'Kardex de produtos','Descrição do item','Unidade','Categoria','Estoque atual','Estoque mínimo',
 'Estoque máximo','Valor de compra','MDF Amêndola','R$ 145,00','Entrada por compra',
 'Entrada','Saída','Saldo após*','PED-2026-003','Mais recentes primeiro','Imprimir / PDF',
 'Exportar CSV','Exportar Excel','reconstituído'
 ])assert(panel.includes(name),'Elemento de interface ausente: '+name);
api.exportCsv();
assert(exported&&exported.name.startsWith('oficina-kardex-01'));
assert(exported.data.startsWith('\ufeff'));
assert(exported.data.includes('Entrada por compra'));
assert(exported.data.includes('PED-2026-003'));
assert(!exported.data.includes('Outro produto'));
assert(exported.data.includes('Saldos reconstituídos'));
api.printReport();
assert(printed.html.includes('Estoque máximo'));
assert(printed.html.includes('Consumo pedido #3'));
assert(printed.html.includes('reconstituídos'));
const injection={
 products:[{id:'i1',tipo:'materia',nome:'=SUM(1,1)',categoria:'teste',estoque:5,custo:5}],
 stockMovements:[{productId:'i1',delta:5,date:'2026-11-10',note:'=HYPERLINK("bad","link")'}]
};
const safeCsv=api.csv(api.build(injection,'i1'));
assert(safeCsv.includes("'=SUM"),'Descrição CSV não pode executar fórmula');
assert(safeCsv.includes("'=HYPERLINK"),'Histórico CSV não pode executar fórmula');
const broken=structuredClone(db);
broken.stockMovements[0].delta='abc';
assert.equal(api.build(broken,'p1').reconstructed,false);
assert.equal(api.build(broken,'p1').movements[0].after,null,'Não inventar saldo se evento inválido');
const partial=structuredClone(db);
partial.stockMovements.shift();
const infer=api.build(partial,'p1','asc');
assert.equal(infer.opening,10,'Saldo inicial inferido com movimentações incompletas');
const nonzero=api.build(db,'p2');
assert.equal(nonzero.count,1);assert.equal(nonzero.opening,-4,'Divergência visível, não escondida');
// Muitas movimentações: grid inicial com 50, exportação sempre inclui todas.
const long=structuredClone(db);
long.stockMovements=Array.from({length:135},(_,i)=>({
 id:'long'+i,productId:'p1',delta:1,date:'2026-11-11',note:'Entrada teste '+i
}));
long.products[0].estoque=135;
assert.equal(api.build(long,'p1').movements.length,135);
api.state.productId='p1';api.state.shown=50;
const originalDb=context.db;
context.db=long;
const html=api.panel();
assert.equal((html.match(/Entrada teste /g)||[]).length,50,'Página inicial limita renderização sem omitir histórico dos dados');
assert(html.includes('Mostrar mais 50 movimentos'));
assert.equal(api.csv(api.build(long,'p1')).match(/Entrada teste /g).length,135,'Exportar todos, inclusive não renderizados');
context.db=originalDb;
assert.equal(JSON.stringify(db),before,'Kardex não movimenta estoque ou financeiro');
for(const file of ['preview-v1/index.html','preview-v1/seguro.html']){
 const html=read(file);
 assert(html.includes('relatorio-kardex-v1.js')&&html.includes('relatorio-kardex-v1.css'));
 assert(html.indexOf('relatorio-kardex-v1.js')>html.indexOf('script.js'));
}
const upgrade=read('preview-v1/upgrade.js');
assert(upgrade.includes('window.universaArtKardex?.panel?.()'));
assert(upgrade.includes('window.universaArtKardex?.bind?.(content)'));
const app=read('preview-v1/catalogo-produtos-1-0.js');
assert(app.includes('name="maximo"'));
assert(app.includes("button('Kardex','show-kardex'"));
assert(app.includes("button('Kardex','go-kardex'"));
console.log('OK Kardex: 3 movimentos, entrada/saída, saldo reconstruído, cabeçalho, máximo, CSV, impressão e 135 itens paginados.');
