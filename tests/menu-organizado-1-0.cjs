/* OFICINA 1.0 — teste de navegação organizada sem alterar registros. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync(path.join(__dirname,'../preview-v1/menu-organizado-1-0.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../preview-v1/seguro.html'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../preview-v1/menu-organizado-1-0.css'),'utf8');
new vm.Script(src);
assert(html.includes('menu-organizado-1-0.js'));
assert(html.includes('menu-organizado-1-0.css'));
assert(html.indexOf('menu-organizado-1-0.js')>html.indexOf('backup-oficina-v1.js'));
assert(css.includes('overflow-y:auto'));
assert(css.includes('min-height:44px'));
const entries=[
 ['dashboard','⌂','Dashboard'],['clientes','♟','Clientes e Fornecedores'],['projetos','▥','Projetos'],
 ['assistente','✎','Assistente'],['sketchup','▤','SketchUp'],['produtos','▤','Produtos'],
 ['compras','▥','Entrada de Materiais'],['fornecedores','♧','Fornecedores'],['orcamentos','▧','Orçamentos'],
 ['pedidos','▣','Pedidos'],['producao','▣','Produção'],['financeiro','＄','Financeiro'],
 ['notas','▤','Notas fiscais'],['documentos','▤','Documentos'],['anexos','▧','Contratos anexados'],
 ['relatorios','▤','Relatórios'],['empresa','⚙','Minha Empresa'],['seguranca','✓','Segurança'],
 ['backupdrive','☁','Backup e recuperação']
];
const raw=JSON.stringify(entries),sections=JSON.parse(raw),events=[];
const nav={
 html:'',buttons:[],get innerHTML(){return this.html},
 set innerHTML(value){
  this.html=value;
  this.buttons=[...value.matchAll(/data-section="([^"]+)"/g)].map(m=>{
   const handlers={},attributes={};
   return {dataset:{section:m[1]},handlers,attributes,
    classList:{toggle(){}},setAttribute(k,v){attributes[k]=v},
    removeAttribute(k){delete attributes[k]},
    addEventListener(k,cb){handlers[k]=cb}};
  });
 },
 querySelectorAll(selector){assert.equal(selector,'button[data-section]');return this.buttons}
};
const db={products:[],clients:[],orders:[],projects:[]};
const context={sections,nav,db,window:{oficinaCloud:{active:false}},
 render:section=>{events.push(section)},
 location:{hash:'#dashboard'},sidebar:{classList:{remove(v){assert.equal(v,'open')}}},
 esc:x=>String(x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'),
 Set,String};
vm.runInNewContext(src,context,{timeout:2500});
const api=context.window.universaArtSidebar;
assert(api);
assert.equal(sections.length,entries.length);
assert.deepEqual(sections.map(x=>x[0]).sort(),entries.map(x=>x[0]).sort(),'Preservar todas as telas e hashes');
assert.deepEqual(sections.slice(0,7).map(x=>x[0]),[
 'dashboard','clientes','projetos','assistente','sketchup','orcamentos','pedidos'
 ]);
assert.equal(JSON.stringify(api.groups()[0].rows.map(x=>x[0])),JSON.stringify(['dashboard','clientes']),'Clientes e Fornecedores deve aparecer junto ao Dashboard no topo');
const idx=key=>sections.findIndex(x=>x[0]===key);
assert(idx('pedidos')<idx('producao')&&idx('producao')<idx('produtos'));
assert(idx('produtos')+1===idx('compras'));
assert(idx('compras')+1===idx('fornecedores'));
assert(idx('financeiro')<idx('relatorios')&&idx('relatorios')<idx('empresa'));
context.render('compras');
assert(nav.innerHTML.includes('PROJETOS E PEDIDOS'));
assert(nav.innerHTML.includes('MATERIAIS E COMPRAS'));
assert(nav.innerHTML.includes('FINANCEIRO E DOCUMENTOS'));
assert(nav.innerHTML.includes('SISTEMA E SEGURANÇA'));
assert(nav.innerHTML.includes('aria-current="page"'));
assert.equal(nav.buttons.length,entries.length);
assert.equal(new Set(nav.buttons.map(b=>b.dataset.section)).size,entries.length);
const quote=nav.buttons.find(b=>b.dataset.section==='orcamentos');
quote.handlers.click();
assert.equal(context.location.hash,'orcamentos','Navegação usa o mesmo hash, sem apagar formulários');
context.render('orcamentos');
assert(events.includes('orcamentos'));
const active=nav.buttons.find(b=>b.dataset.section==='orcamentos');
assert.equal(active.attributes['aria-current'],'page');
const snapshot=JSON.stringify(db);
context.render('seguranca');
assert.equal(nav.buttons.length,entries.length);
assert.equal(JSON.stringify(db),snapshot,'Alterar menu não toca dados');
console.log('OK: menu agrupado, atalhos existentes, painel/materiais juntos, acessibilidade, sem perda de registros.');
