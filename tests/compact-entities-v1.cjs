/* UNIVERSALARTES — regressão dos formulários compactos de Clientes e Fornecedores.
   node tests/compact-entities-v1.cjs */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const base=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(base,'preview-v1/compact-entities-v1.js'),'utf8');
new vm.Script(source,{filename:'compact-entities-v1.js'});
const css=fs.readFileSync(path.join(base,'preview-v1/compact-entities-v1.css'),'utf8');
const html=fs.readFileSync(path.join(base,'preview-v1/index.html'),'utf8');
assert(html.includes('compact-entities-v1.css'));
assert(html.includes('compact-entities-v1.js'));
assert(/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/.test(css),'Desktop precisa de duas colunas');
assert(/@media\(max-width:650px\)/.test(css),'Layout deve adaptar a celular');

let saved=0,n=0,modal=null;
const db={
 clients:[],suppliers:[],quotes:[],orders:[],purchases:[]
};
const ctx={
 db,window:{},
 clientModal(){},supplierModal(){},
 id(){return 'id-'+(++n)},
 save(){saved++;return true},
 alert(s){throw Error(s)},
 esc:v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
 openModal(title,html,onSubmit,after){modal={title,html,onSubmit,after};return modal},
};
vm.runInNewContext(source,ctx,{timeout:2000});
const util=ctx.window.universalartesEntityForms;
assert(util&&typeof util.buildFields==='function');
assert.equal(util.isCpf('52998224725'),true);
assert.equal(util.isCpf('11111111111'),false);
assert.equal(util.isCnpj('11222333000181'),true);
assert.equal(util.isCnpj('00000000000000'),false);
assert.equal(util.maskCep('01310930'),'01310-930');
assert.equal(util.maskPhone('11987654321'),'(11) 98765-4321');
assert.equal(util.maskDocument('52998224725'),'529.982.247-25');
assert.equal(util.maskDocument('11222333000181'),'11.222.333/0001-81');

// Cliente — cadastro preserva campos legados e usa nome existente nos pedidos e orçamentos.
ctx.clientModal();
assert(modal.title==='Novo cliente');
assert(modal.html.includes('ua-entity-grid'));
for(const key of ['nome','tipo','doc','inscricaoEstadual','telefone','whatsapp','email','contato','cep','uf','cidade','bairro','endereco','numero','complemento','observacoes']){
 assert(modal.html.includes('name="'+key+'"'),'Campo de cliente ausente '+key);
}
assert(modal.onSubmit({nome:'Maria Souza',tipo:'PF',doc:'52998224725',telefone:'11987654321',whatsapp:'11987654321',cep:'01310930',cidade:'São Paulo',uf:'SP',observacoes:'cliente teste'}));
assert.equal(db.clients.length,1);
const cid=db.clients[0].id;
assert.equal(db.clients[0].doc,'529.982.247-25');
assert.equal(db.clients[0].telefone,'(11) 98765-4321');
assert.equal(db.clients[0].cep,'01310-930');
db.clients[0].externo='preservar';
db.quotes.push({clientId:cid,clientNome:'Maria Souza'});
db.orders.push({clientId:cid,clientNome:'Maria Souza'});
ctx.clientModal(cid);
assert(modal.title==='Editar cliente');
assert(modal.onSubmit({nome:'Maria S. Almeida',tipo:'PF',doc:'529.982.247-25',telefone:'11987654321',cep:'01310930',cidade:'São Paulo',uf:'SP'}));
assert.equal(db.clients.length,1);
assert.equal(db.clients[0].externo,'preservar');
assert.equal(db.orders[0].clientNome,'Maria S. Almeida');
assert.equal(db.quotes[0].clientNome,'Maria S. Almeida');
assert.throws(()=>util.validateEntry({nome:'Cliente',tipo:'PF',doc:'12345678901',cep:'',uf:''},{},db.clients,'cliente'),/CPF inválido/);
assert.throws(()=>util.validateEntry({nome:'Duplicado',tipo:'PF',doc:'52998224725',cep:'',uf:''},{},db.clients,'cliente'),/já está cadastrado/);
assert.throws(()=>util.validateEntry({nome:'Teste',tipo:'PF',doc:'',cep:'12',uf:''},{},db.clients,'cliente'),/CEP deve conter 8/);
assert.throws(()=>util.validateEntry({nome:'Teste',tipo:'PF',doc:'',cep:'',uf:'XX'},{},db.clients,'cliente'),/UF válida/);
assert(!modal.html.includes('<script>alert(1)</script>'));

// Fornecedor — categoria, prazo, contato, condição de pagamento e vínculo da compra.
ctx.supplierModal();
assert(modal.title==='Novo fornecedor');
for(const key of ['nome','tipo','doc','telefone','whatsapp','contato','categoria','prazoEntrega','condicaoPagamento','favorito','cidade','observacoes']){
 assert(modal.html.includes('name="'+key+'"'),'Campo de fornecedor ausente '+key);
}
assert(modal.onSubmit({nome:'MDF Central',tipo:'PJ',doc:'11222333000181',telefone:'1133332222',whatsapp:'11988887777',categoria:'MDF e chapas',prazoEntrega:'7',condicaoPagamento:'30 dias',favorito:'on',cidade:'Campinas',uf:'SP'}));
assert.equal(db.suppliers.length,1);
const sid=db.suppliers[0].id;
assert.equal(db.suppliers[0].doc,'11.222.333/0001-81');
assert.equal(db.suppliers[0].prazoEntrega,'7');
assert.equal(db.suppliers[0].favorito,true);
db.purchases.push({supplierId:sid,supplierNome:'MDF Central'});
ctx.supplierModal(sid);
assert(modal.onSubmit({nome:'MDF Central Ltda',tipo:'PJ',doc:'11.222.333/0001-81',categoria:'MDF e chapas',prazoEntrega:'12',condicaoPagamento:'à vista',cidade:'Campinas',uf:'SP'}));
assert.equal(db.suppliers.length,1);
assert.equal(db.purchases[0].supplierNome,'MDF Central Ltda');
assert.equal(db.suppliers[0].favorito,false);
assert.throws(()=>util.validateEntry({nome:'Supplier',tipo:'PJ',doc:'',prazoEntrega:'999',cep:'',uf:''},{},db.suppliers,'fornecedor'),/0 a 365/);
// Fornecedor antigo sem tipo, mas com CNPJ, deve aparecer como PJ.
const legacy=util.buildFields({nome:'Fornecedor antigo',doc:'11.222.333/0001-81',categoria:'Fitas especiais'},'fornecedor');
assert(legacy.includes('value="PJ" selected'));
assert(legacy.includes('Fitas especiais'));
assert.equal(saved,4);
console.log('OK: Clientes e Fornecedores compactos, máscaras, CPF/CNPJ, validação, edição e vínculos preservados.');
