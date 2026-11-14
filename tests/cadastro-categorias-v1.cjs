/* Categorias: preservar dados antigos, criar/editar, negar duplicatas e excluir apenas sem vínculo. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const source=read('preview-v1/cadastro-categorias-v1.js');
new vm.Script(source);
const entries=[['dashboard','▦','Dashboard'],['produtos','▤','Produtos']];
let modal,saveCount=0,failSave=false,alerts=[],confirmed=true;
const db={products:[
 {id:'m1',nome:'MDF',tipo:'materia',categoria:'Chapas MDF',estoque:4,custo:120},
 {id:'m2',nome:'Parafuso',tipo:'materia',categoria:'Parafusos',estoque:90,custo:0.40},
 {id:'m3',nome:'Antigo',tipo:'materia',categoria:'Categoria antiga',estoque:1,custo:5}
],stockMovements:[{id:'e1',delta:1}],orders:[{id:'p1'}]};
const beforeStock=JSON.stringify(db.stockMovements);
const context={
 db,sections:entries,window:{},content:{innerHTML:''},
 id:(()=>{let i=0;return()=>'cat-id-'+(++i)})(),
 esc:s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
 openModal:(title,fields,onSubmit)=>{modal={title,fields,onSubmit};return modal},
 save:()=>{saveCount++;return !failSave},
 render:()=>{},alert:s=>alerts.push(s),confirm:()=>confirmed,
 intro:(...xs)=>xs.join(' · '),
 button:(label,action,id)=>'<button data-action="'+action+'" data-id="'+id+'">'+label+'</button>',
 td:(...cells)=>'<tr>'+cells.map(s=>'<td>'+s+'</td>').join('')+'</tr>',
 table:(heads,rows)=>'<table>'+rows.join('')+'</table>',
 document:{createElement:()=>({})},
 Event:class Event{constructor(name){this.type=name}},
 Array,String,Number,Set,Map,Math,Date,Error
};
vm.runInNewContext(source,context,{timeout:2000});
const api=context.window.universaArtCategorias;
assert(api&&api.edit&&api.view&&api.options);
assert.equal(entries.filter(x=>x[0]==='categorias').length,1);
let initial=api.list();
assert(initial.some(x=>x.nome==='Chapas MDF'));
assert(initial.some(x=>x.nome==='Categoria antiga'),'Produtos antigos preservados');
assert(!db.categories,'Ler categorias não deve gravar dados');
assert(api.options('Chapas MDF').includes('selected'));
api.view();
assert(context.content.innerHTML.includes('Cadastro de categorias'));
assert(context.content.innerHTML.includes('Nova categoria'));
api.edit();
assert(modal.fields.includes('name="nome"'));
assert.equal(modal.onSubmit({nome:'Tintas',descricao:'Pintura'}),true);
assert(db.categories.some(x=>x.nome==='Tintas'));
assert.equal(saveCount,1);
const categoryId=db.categories.find(x=>x.nome==='Tintas').id;
api.edit();
assert.throws(()=>modal.onSubmit({nome:'  tintas  '}),/Já existe/,'Bloquear duplicatas ignorando caixa');
api.edit(categoryId);
assert.equal(modal.onSubmit({nome:'Tintas e vernizes',descricao:'Acabamento'}),true);
assert(api.list().some(x=>x.nome==='Tintas e vernizes'));
const used=api.list().find(x=>x.nome==='Chapas MDF');
const oldCount=db.products.length;
api.edit(used.id);
assert.equal(modal.onSubmit({nome:'Painéis MDF',descricao:'Chapas e padrões'}),true);
assert.equal(db.products[0].categoria,'Painéis MDF');
assert.equal(db.products.length,oldCount);
const stored=api.list().find(x=>x.nome==='Painéis MDF');
api.remove(stored.id);
assert(alerts.at(-1).includes('utilizada'),'Não excluir categoria ligada a produtos');
assert(db.categories.some(x=>x.nome==='Painéis MDF'));
api.remove(categoryId);
assert(api.list().some(x=>x.nome==='Tintas e vernizes'),'ID anterior não pode excluir categoria renomeada incorretamente');
const unused=api.list().find(x=>x.nome==='Tintas e vernizes');
api.remove(unused.id);
assert(!api.list().some(x=>x.nome==='Tintas e vernizes'),'Exclusão real de categoria sem produtos');
assert.equal(JSON.stringify(db.stockMovements),beforeStock);
assert.equal(db.orders.length,1);
api.edit();failSave=true;
const beforeCategories=JSON.stringify(db.categories),beforeProducts=JSON.stringify(db.products);
assert.throws(()=>modal.onSubmit({nome:'Teste falha'}),/Não foi possível salvar/);
assert.equal(JSON.stringify(db.categories),beforeCategories,'Rollback categorias');
assert.equal(JSON.stringify(db.products),beforeProducts,'Rollback produtos');
console.log('OK categorias: menu, opções, criação, duplicatas, renomeação vinculada, exclusão protegida e rollback.');
