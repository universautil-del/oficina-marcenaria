/* Testes de interface de estoque: busca, filtro, atalhos e limite 01..9999.
 * Sem acesso ao Supabase real. Execute: node tests/material-ui-9999.cjs
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const script=fs.readFileSync(path.join(__dirname,'../preview-v1/script.js'),'utf8');
const begin=script.indexOf('let lowStockOnly=false;');
const end=script.indexOf('function productCost(',begin);
assert(begin>=0&&end>begin);
const view=script.slice(begin,end);
const db={products:[
 {id:'m1',codigo:'01',nome:'MDF TX 15',categoria:'Chapas',tipo:'materia',unidade:'chapa',custo:100,preco:150,estoque:2,minimo:3},
 {id:'m2',codigo:'1000',nome:'Dobradiça reforçada',categoria:'Ferragens',tipo:'materia',unidade:'un',custo:5,preco:8,estoque:40,minimo:10}
],stockMovements:[]};
const ctx={
 db,search:{produtos:''},content:{innerHTML:''},
 intro:()=>'',inputSearch:()=>'<input>',
 button:(label,action)=>'<button data-action="'+action+'">'+label+'</button>',
 table:(headers,rows)=>'<table>'+rows.join('')+'</table>',
 td:(...cells)=>'<tr>'+cells.map(c=>'<td>'+c+'</td>').join('')+'</tr>',
 pill:()=>'',kindText:{materia:'Matéria-prima'},
 money:x=>'R$ '+x,date:x=>x,dec:x=>String(x),esc:x=>String(x??''),
 getProduct:id=>db.products.find(p=>p.id===id),productCost:p=>p.custo,
 nextMaterialCode:()=> '1001',Number,String
};
vm.runInNewContext(view+'\nfunction toggleLowStockForTest(){lowStockOnly=!lowStockOnly}',ctx,{timeout:2500});
ctx.productsView();
assert(ctx.content.innerHTML.includes('MDF TX 15'));
assert(ctx.content.innerHTML.includes('Dobradiça reforçada'));
assert(ctx.content.innerHTML.includes('Código automático de 01 até 9999'));
assert(ctx.content.innerHTML.includes('data-action="new-purchase"'));
assert(ctx.content.innerHTML.includes('data-action="filter-low-stock"'));
assert(ctx.content.innerHTML.includes('Estoque baixo (1)'));
ctx.toggleLowStockForTest();ctx.productsView();
assert(ctx.content.innerHTML.includes('MDF TX 15'));
assert(!ctx.content.innerHTML.includes('Dobradiça reforçada'));
assert(ctx.content.innerHTML.includes('Exibindo 1 de 2 materiais'));
assert(ctx.content.innerHTML.includes('Mostrar todos'));
ctx.toggleLowStockForTest();
ctx.search.produtos='dobradiça';ctx.productsView();
assert(!ctx.content.innerHTML.includes('MDF TX 15'));
assert(ctx.content.innerHTML.includes('Dobradiça reforçada'));
console.log('OK: filtro de estoque baixo, busca, atalhos e interface 01–9999.');
