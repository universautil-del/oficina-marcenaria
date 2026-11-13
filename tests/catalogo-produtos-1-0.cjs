/* OFICINA 1.0 — regressão de Produtos com matéria-prima e produto acabado. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const app=read('preview-v1/script.js'),src=read('preview-v1/catalogo-produtos-1-0.js'),html=read('preview-v1/seguro.html');
new vm.Script(src,{filename:'catalogo-produtos-1-0.js'});
assert(html.includes('catalogo-produtos-1-0.js')&&html.includes('catalogo-produtos-1-0.css'));
assert(html.indexOf('catalogo-produtos-1-0.js')>html.indexOf('script.js'));
let modal,saves=0,failSave=false,alerts=[];
const db={products:[],stockMovements:[],seq:{quote:1,order:1,productCode:1},quotes:[],orders:[]};
const contentMock={innerHTML:'',querySelector(sel){return sel==='#uaProductTypeFilter'?{onchange:null}:null}};
const ctx={
 window:{},db,content:contentMock,search:{produtos:''},lowStockOnly:false,
 productsView:()=>{},productModal:()=>{},
 openModal:(title,fields,onSubmit,after)=>{modal={title,fields,onSubmit,after};return{}},
 esc:v=>String(v??'').replace(/[&<>"]/g,''),
 id:(()=>{let i=1;return()=>'id'+i++})(),
 iso:()=>'2026-11-11',
 save:()=>{saves++;return !failSave},
 alert:m=>{alerts.push(m)},
 reservedQuantity:()=>0,
 intro:(...parts)=>parts.join(' | '),
 inputSearch:()=>'<input>',
 button:(label,action)=>'<button data-action="'+action+'">'+label+'</button>',
 table:(heads,rows)=>'<table>'+rows.join('')+'</table>',
 td:(...rows)=>'<tr>'+rows.map(x=>'<td>'+x+'</td>').join('')+'</tr>',
 pill:x=>'['+x+']',
 kindText:{materia:'Matéria-prima',acabado:'Produto acabado'},
 money:x=>'R$ '+Number(x).toFixed(2),
 date:x=>x,dec:x=>String(x),
 round:x=>Math.round(Number(x)*100)/100,
 getProduct:id=>db.products.find(p=>p.id===id),
 Number,String,Math,Array,Map,Set,Error,Date
};
const nextCode=app.slice(app.indexOf('function nextMaterialCode(){'),app.indexOf('let lowStockOnly=false;'));
const prodCost=app.slice(app.indexOf('function productCost('),app.indexOf('function productModal('));
const required=app.slice(app.indexOf('function qty3('),app.indexOf('function reservedQuantity('));
vm.runInNewContext(nextCode+prodCost+required+'\n'+src,ctx,{timeout:3000});
const api=ctx.window.universaArtCatalog;
assert(api&&typeof api.validateComponents==='function');
assert.equal(ctx.nextMaterialCode(),'01');
const dialog=(rows=[])=>({querySelectorAll:sel=>sel==='.ua-product-component'?rows.map(r=>({
 querySelector:field=>field==='[data-component-material]'?{value:r.materialId}:{value:String(r.quantidade)}
})):[],querySelector:sel=>sel==='[name="tipo"]'?{value:'acabado'}:null});
const values={tipo:'materia',nome:'MDF branco TX 15 mm',unidade:'chapa',categoria:'Chapas',estoque:'10',minimo:'2',custo:'120',preco:'165',observacoes:'Teste'};
api.productsView();
assert(contentMock.innerHTML.includes('data-action="new-raw">Produtos</button>'));
assert(contentMock.innerHTML.includes('Matéria-prima')&&contentMock.innerHTML.includes('Produto acabado'));
assert(contentMock.innerHTML.includes('0 produto(s)')||contentMock.innerHTML.includes('0 produtos'));
api.productModal();
assert(modal.fields.includes('name="tipo" required'),'Campo de tipo obrigatório');
assert(modal.fields.includes('value="acabado"'),'Opção de produto acabado');
assert(modal.fields.includes('Composição do produto acabado'));
assert(modal.fields.includes('name="codigoDisplay" readonly'));
assert.equal(modal.onSubmit(values,dialog()),true);
assert.equal(db.products.length,1);
const raw=db.products[0];
assert.equal(raw.tipo,'materia');assert.equal(raw.codigo,'01');assert.equal(raw.estoque,10);
assert.equal(db.stockMovements.length,1,'Entrada inicial de matéria-prima gera movimento');
assert.equal(ctx.nextMaterialCode(),'02');
api.productModal();
const bom=[{materialId:raw.id,quantidade:2.5}];
assert.equal(modal.onSubmit({...values,tipo:'acabado',nome:'Armário superior branco',unidade:'un',estoque:'9999'},dialog(bom)),true);
const finished=db.products[1];
assert.equal(finished.tipo,'acabado');
assert.equal(finished.codigo,'02');
assert.equal(finished.components.length,1);
assert.equal(finished.components[0].materialId,raw.id);
assert.equal(finished.components[0].quantidade,2.5);
assert.equal(ctx.productCost(finished),300);
assert.equal(db.stockMovements.length,1,'Cadastrar acabado não movimenta matéria-prima');
assert.equal(raw.estoque,10,'Cadastrar acabado não baixa o estoque');
const needed=ctx.requiredMaterials([{productId:finished.id,quantidade:3}]);
assert.equal(needed.length,1);
assert.equal(needed[0].productId,raw.id);
assert.equal(needed[0].quantidade,7.5,'Pedido de acabado usa lista de matéria-prima');
api.productsView();
assert(contentMock.innerHTML.includes('Armário superior branco'));
assert(contentMock.innerHTML.includes('2 produto(s)'));
api.setTypeFilter('acabado');api.productsView();
assert(contentMock.innerHTML.includes('Armário superior branco'));
assert(!contentMock.innerHTML.includes('<strong>01</strong>'),'Filtro acabados não mostra raw');
api.setTypeFilter('todos');
api.productModal(finished.id);
assert(modal.fields.includes('name="tipo" required disabled'),'Tipo bloqueado na edição');
assert(modal.fields.includes('value="02"'),'Mantém código');
assert.throws(()=>modal.onSubmit({...values,tipo:'materia',nome:'Alterar tipo'},dialog(bom)),/Não altere o tipo/);
assert.throws(()=>api.validateComponents([{materialId:raw.id,quantidade:1},{materialId:raw.id,quantidade:1}]),/repetida/);
const count=db.products.length,oldSeq=db.seq.productCode,oldMoves=db.stockMovements.length;
api.productModal();
failSave=true;
assert.throws(()=>modal.onSubmit({...values,tipo:'acabado',nome:'Teste rollback'},dialog(bom)),/Falha ao salvar/);
assert.equal(db.products.length,count,'Rollback não cria produtos');
assert.equal(db.stockMovements.length,oldMoves,'Rollback não cria movimentações');
assert.equal(db.seq.productCode,oldSeq,'Rollback não gasta código');
failSave=false;
db.products.push({id:'legado',tipo:'acabado',codigo:'MOV-1',nome:'Legado',components:[{materialId:raw.id,quantidade:1}]});
api.productModal('legado');
assert(modal.fields.includes('value="MOV-1"'),'Preserva código legado não numérico');
assert.equal(modal.onSubmit({...values,tipo:'acabado',nome:'Legado editado'},dialog([{materialId:raw.id,quantidade:1}])),true);
assert.equal(db.products.find(p=>p.id==='legado').codigo,'MOV-1');
// Ao cadastrar via Entrada, não deve haver escolha por Produto acabado,
// nem saldo inicial antecipado (a entrada real será confirmada depois).
const beforeEntryCount=db.products.length, beforeEntryMovement=db.stockMovements.length;
api.productModal('', 'materia-entrada');
assert.equal(modal.title,'Cadastrar matéria-prima');
assert(modal.fields.includes('value="Matéria-prima" readonly'),'Tipo de entrada fica fixo e somente leitura');
assert(modal.fields.includes('type="hidden" name="tipo" value="materia"'));
assert(!modal.fields.includes('<option value="acabado"'),'Tipo acabado não pode ser escolhido na Entrada');
assert(modal.fields.includes('MDF 18 mm')&&modal.fields.includes('MDF 25 mm'));
assert(modal.fields.includes('Parafusos')&&modal.fields.includes('Dobradiças'));
assert(modal.fields.includes('name="espessuraMm"'));
assert(modal.fields.includes('name="chapaComprimentoMm"'));
assert(modal.fields.includes('name="chapaLarguraMm"'));
assert(modal.fields.includes('Comprimento (mm), opcional'),'Campo de comprimento sem a palavra chapa');
assert(modal.fields.includes('Largura (mm), opcional'),'Campo de largura sem a palavra chapa');
assert(!modal.fields.includes('Comprimento da chapa (mm), opcional')&&!modal.fields.includes('Largura da chapa (mm), opcional'),'Rótulos antigos não devem ser exibidos');
assert(modal.fields.includes('Saldo inicial: 0'),'Não permite contagem dupla do recebimento');
assert(modal.fields.includes('<input type="hidden" name="preco" value="0">'),'Entrada de material não exige preço de venda');
const newMdf={...values,tipo:'materia',nome:'MDF 25 mm',categoria:'Chapas MDF',unidade:'chapa',
 estoque:'150',espessuraMm:'25',chapaComprimentoMm:'2750',chapaLarguraMm:'1850'};
assert.throws(()=>modal.onSubmit({...newMdf,tipo:'acabado'},dialog()),/somente matérias-primas/);
assert.equal(db.products.length,beforeEntryCount,'Impedir gravação de acabado dentro de Entrada');
assert.equal(modal.onSubmit(newMdf,dialog()),true);
const mdf=db.products.at(-1);
assert.equal(mdf.tipo,'materia');
assert.equal(mdf.estoque,0,'Sem baixa ou crédito antes do recebimento');
assert.equal(mdf.espessuraMm,25);
assert.equal(mdf.chapaComprimentoMm,2750);
assert.equal(mdf.chapaLarguraMm,1850);
assert.equal(db.stockMovements.length,beforeEntryMovement,'Não lança estoque antecipado');
api.productModal('', 'materia-entrada');
assert.throws(()=>modal.onSubmit({...newMdf,nome:'Chapa inválida',espessuraMm:'-5'},dialog()),/medidas/);
assert.equal(db.products.length,beforeEntryCount+1);
assert(!alerts.length);
console.log('OK OFICINA 1.0: botão Produtos, tipo selecionável, composição, código 01..9999, estoque e pedido sem duplicar, rollback.');
