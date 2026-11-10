/* UNIVERSALARTES — testes do cadastro conjunto. Execute: node tests/unified-contacts-v1.cjs */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const source=file=>fs.readFileSync(path.join(root,file),'utf8');
for(const file of ['preview-v1/compact-entities-v1.js','preview-v1/unified-contacts-v1.js']){
 new vm.Script(source(file),{filename:file});
}
const css=source('preview-v1/unified-contacts-v1.css'),html=source('preview-v1/index.html');
assert(html.includes('unified-contacts-v1.js')&&html.includes('unified-contacts-v1.css'));
assert(html.indexOf('unified-contacts-v1.js')>html.indexOf('compact-entities-v1.js'));
assert(css.includes('.ua-directory-tabs')&&css.includes('@media(max-width:760px)'));
const DB={clients:[],suppliers:[],quotes:[],orders:[],purchases:[]};
let currentModal=null,saved=0,seq=0,originalCalls=0;
const location={hash:''},content={innerHTML:'',querySelectorAll(){return[]}},nav={innerHTML:'',querySelectorAll(){return[]}};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ctx={
 window:{},db:DB,sections:[['dashboard','⌂','Dashboard'],['clientes','C','Clientes'],['produtos','P','Produtos'],['fornecedores','F','Fornecedores']],
 content,nav,location,title:{textContent:''},sidebar:{classList:{remove(){}}},
 search:{clientes:'',fornecedores:'',cadastros:''},esc,
 id:()=> 'key-'+(++seq),save:()=>{saved++;return true},
 openModal:(title,fields,onSubmit,after)=>{currentModal={title,fields,onSubmit,after};return currentModal},
 inputSearch:(k)=>'<input data-search="'+k+'">',
 intro:(h,d,t)=>'<h2>'+esc(h)+'</h2>',
 button:(title,action,item='',style='')=>'<button data-action="'+esc(action)+'" data-id="'+esc(item)+'">'+esc(title)+'</button>',
 table:(hdr,rows,empty)=>rows.length?'<table>'+rows.join('')+'</table>':empty,
 td:(...cols)=>'<tr>'+cols.map(x=>'<td>'+x+'</td>').join('')+'</tr>',
 render:()=>{originalCalls++},
 clientModal:()=>{},supplierModal:()=>{},
 handleAction:(action,uid)=>{
  if(action==='delete-client')DB.clients=DB.clients.filter(x=>x.id!==uid);
  if(action==='delete-supplier')DB.suppliers=DB.suppliers.filter(x=>x.id!==uid);
  return action;
 },
 alert:msg=>{throw Error(msg)}
};
vm.runInNewContext(source('preview-v1/compact-entities-v1.js'),ctx,{timeout:1500});
vm.runInNewContext(source('preview-v1/unified-contacts-v1.js'),ctx,{timeout:1500});
const api=ctx.window.universalartesUnifiedContacts;
assert(api&&typeof api.allEntries==='function');
assert(ctx.sections.some(x=>x[0]==='cadastros'));
assert(!ctx.sections.some(x=>x[0]==='clientes'||x[0]==='fornecedores'));
ctx.render('cadastros');
assert(content.innerHTML.includes('Agenda de contatos'));
assert(content.innerHTML.includes('Clientes'));
assert(content.innerHTML.includes('Fornecedores'));
assert(content.innerHTML.includes('ua-new-entry'));
const fields={nome:'Marcenaria Modelo',tipo:'PJ',doc:'11222333000181',cep:'01310930',uf:'SP',telefone:'11987654321',whatsapp:'11987654321',cidade:'São Paulo',
 categoria:'MDF e chapas',prazoEntrega:'8',condicaoPagamento:'30 dias',site:'https://exemplo.com.br',favorito:'on'};
ctx.handleAction('ua-new-entry','cliente');
assert.equal(currentModal.title,'Novo cadastro');
assert(currentModal.fields.includes('name="papelCadastro"'));
assert(currentModal.fields.includes('value="ambos"'));
assert(currentModal.onSubmit({...fields,papelCadastro:'ambos'}));
assert.equal(DB.clients.length,1);
assert.equal(DB.suppliers.length,1);
assert.equal(DB.clients[0].id,DB.suppliers[0].id);
assert.equal(DB.clients[0].cadastroCompartilhado,true);
assert.equal(DB.suppliers[0].categoria,'MDF e chapas');
assert.equal(api.allEntries().length,1);
assert.equal(api.allEntries()[0].role,'ambos');
const sharedId=DB.clients[0].id;
DB.orders.push({clientId:sharedId,clientNome:'Marcenaria Modelo'});
DB.quotes.push({clientId:sharedId,clientNome:'Marcenaria Modelo'});
DB.purchases.push({supplierId:sharedId,supplierNome:'Marcenaria Modelo'});
ctx.handleAction('ua-edit-entry','ambos:'+sharedId);
assert.equal(currentModal.title,'Editar cadastro');
assert(currentModal.onSubmit({...fields,nome:'Marcenaria Modelo LTDA',papelCadastro:'ambos',prazoEntrega:'12'}));
assert.equal(DB.clients[0].nome,'Marcenaria Modelo LTDA');
assert.equal(DB.suppliers[0].nome,'Marcenaria Modelo LTDA');
assert.equal(DB.orders[0].clientNome,'Marcenaria Modelo LTDA');
assert.equal(DB.quotes[0].clientNome,'Marcenaria Modelo LTDA');
assert.equal(DB.purchases[0].supplierNome,'Marcenaria Modelo LTDA');
assert.equal(DB.suppliers[0].prazoEntrega,'12');
assert.throws(()=>currentModal.onSubmit({...fields,nome:'',papelCadastro:'ambos'}),/nome|razão social/i);
assert.equal(DB.clients[0].nome,'Marcenaria Modelo LTDA');

// Dois registros antigos com nomes iguais mas IDs distintos não devem ser unidos.
DB.clients.push({id:'legacy-c',nome:'Mesmo Nome',tipo:'PF',doc:'52998224725'});
DB.suppliers.push({id:'legacy-s',nome:'Mesmo Nome',tipo:'PF',doc:'52998224725'});
assert.equal(api.allEntries().length,3);
const lc=api.allEntries().find(x=>x.id==='legacy-c');
const ls=api.allEntries().find(x=>x.id==='legacy-s');
assert.equal(lc.role,'cliente');
assert.equal(ls.role,'fornecedor');

// Ampliar um cliente antigo para fornecedor sem trocar seu ID nem duplicar cliente.
ctx.handleAction('ua-edit-entry','cliente:legacy-c');
assert(currentModal.fields.includes('value="ambos"'));
assert.throws(()=>currentModal.onSubmit({nome:'Mesmo Nome',tipo:'PF',doc:'52998224725',cep:'',uf:'',papelCadastro:'ambos',categoria:'Ferragens'}),/já está cadastrado em Fornecedores/);
// O usuário deve resolver o registro duplicado antes de criar um segundo vínculo.
DB.suppliers.find(x=>x.id==='legacy-s').doc='';
assert(currentModal.onSubmit({nome:'Mesmo Nome',tipo:'PF',doc:'52998224725',cep:'',uf:'',papelCadastro:'ambos',categoria:'Ferragens'}));
assert.equal(DB.clients.filter(x=>x.id==='legacy-c').length,1);
assert.equal(DB.suppliers.filter(x=>x.id==='legacy-c').length,1);
assert.equal(api.allEntries().length,3);
assert.equal(api.allEntries().find(x=>x.id==='legacy-c').role,'ambos');
assert.equal(DB.suppliers.find(x=>x.id==='legacy-s').nome,'Mesmo Nome');

// Excluir só uma função deixa a outra sem o vínculo compartilhado.
ctx.handleAction('delete-client','legacy-c');
assert(!DB.clients.some(x=>x.id==='legacy-c'));
assert.equal(DB.suppliers.find(x=>x.id==='legacy-c').cadastroCompartilhado,false);
assert(api.allEntries().some(x=>x.id==='legacy-c'&&x.role==='fornecedor'));
ctx.render('clientes');assert(content.innerHTML.includes('ua-directory'));
ctx.render('fornecedores');assert(content.innerHTML.includes('ua-directory'));
ctx.render('dashboard');assert.equal(originalCalls,1);
assert(saved>=4);
console.log('OK: Menu único, filtros, cadastro com 1 ou 2 papéis, links de pedidos/compras, dados antigos e exclusão parcial.');
