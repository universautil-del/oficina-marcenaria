/* OFICINA 1.0 — testes de seleção do MDF em lista OpenCutList sem material */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const src=read('preview-v1/sketchup-v1.js'),page=read('preview-v1/seguro.html');
new vm.Script(src);
assert(page.includes('sketchup-v1.js'));
assert(src.includes('data-ua-skp="assign-material"'));
assert(src.includes('data-ua-skp="new-material"'));
const db={products:[
 {id:'mdf15',tipo:'materia',nome:'MDF Branco TX 15 mm',codigo:'01',unidade:'chapa',custo:220,estoque:10,
  espessuraMm:15,chapaComprimentoMm:2750,chapaLarguraMm:1850},
 {id:'mdf18',tipo:'materia',nome:'MDF Amadeirado 18 mm',codigo:'02',unidade:'chapa',custo:260,estoque:5,espessuraMm:18},
 {id:'screws',tipo:'materia',nome:'Parafuso 4x40 mm',codigo:'03',unidade:'un',custo:.04,estoque:100},
 {id:'cab',tipo:'acabado',nome:'Armário MDF 15 mm',codigo:'04',unidade:'un',preco:1200}
],orders:[{id:'o1'}],purchases:[],stockMovements:[]};
const original=JSON.stringify(db),content={innerHTML:''};
const ctx={db,window:{},document:{addEventListener(){},querySelector:()=>null},
 sections:[['dashboard','⌂','Dashboard']],render(){},title:{textContent:''},nav:{innerHTML:'',querySelectorAll(){return []}},
 sidebar:{classList:{remove(){}}},location:{hash:'#dashboard'},content,
 esc:v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
 Number,Math,Date,Set,Map,Error,String,Intl,console};
vm.runInNewContext(src,ctx,{timeout:2000});
const api=ctx.window.universalartesSketchUp,st=api.state;
assert.equal(api.materialCatalog().length,2,'Somente MDF/chapas, não parafusos ou produto acabado');
const csv=read('tests/fixtures/opencutlist-components-sample.csv');
const {headers,raw}=api.extractPartTable(api.parseCSV(csv,api.detectSep(csv)));
st.file='Peças de cozinha.csv';st.headers=headers;st.raw=raw;api.mapping();st.parts=api.makeParts();
assert.equal(st.parts[0].material,'Material não definido');
const before=api.calculated();
assert(before.bad.some(s=>s.includes('Material não definido')));
api.view();
assert(content.innerHTML.includes('Definir qual MDF é usado neste grupo'));
assert(content.innerHTML.includes('MDF Branco TX 15 mm'));
assert(content.innerHTML.includes('MDF Amadeirado 18 mm'));
assert(content.innerHTML.includes('disabled'),'MDF 18 mm deve estar indisponível para peças de 15 mm');
assert(content.innerHTML.includes('Aplicar material'));
assert(content.innerHTML.includes('+ Cadastrar matéria-prima'));
assert.throws(()=>api.chooseMaterial('Material não definido|15','mdf18'),/Espessura incompatível/);
assert.throws(()=>api.chooseMaterial('Material não definido|15','screws'),/não existe no cadastro de chapas/);
assert.throws(()=>api.chooseMaterial('Material não definido|15','',''),/Escolha uma chapa/);
assert.equal(st.parts[0].material,'Material não definido','Erro não altera material');
const selected=api.chooseMaterial('Material não definido|15','mdf15');
assert.equal(selected.material,'MDF Branco TX 15 mm');
assert.equal(selected.productId,'mdf15');
assert.equal(st.parts.length,2);
assert(st.parts.every(p=>p.material==='MDF Branco TX 15 mm'&&p.materialProductId==='mdf15'));
assert.equal(st.settings['MDF Branco TX 15 mm|15'].boardPrice,220);
assert.equal(st.settings['MDF Branco TX 15 mm|15'].boardWidth,1850);
assert.equal(st.settings['MDF Branco TX 15 mm|15'].boardLength,2750);
assert(!api.calculated().bad.some(s=>s.includes('Material não definido')));
assert(api.calculated().matcost>0,'Custo de chapa preenchido do estoque');
st.parts=api.makeParts();
assert(st.parts.every(p=>p.material==='MDF Branco TX 15 mm'),'Recalcular não volta a Material não definido');
api.view();
assert(content.innerHTML.includes('MDF Branco TX 15 mm'));
assert(!content.innerHTML.includes('⚠ Material não definido no SketchUp'));
const newGroup='MDF Branco TX 15 mm|15';
api.chooseMaterial(newGroup,'','MDF Carvalho Hannover 15 mm');
assert(st.parts.every(p=>p.material==='MDF Carvalho Hannover 15 mm'),'Informar material sem cadastro também deve funcionar');
assert.equal(st.parts[0].materialProductId,'');
st.parts=api.makeParts();
assert.equal(st.parts[0].material,'MDF Carvalho Hannover 15 mm');
assert.equal(JSON.stringify(db),original,'Correção do SketchUp não cria compra, estoque nem pedido');
console.log('OK SketchUp: seleção de MDF 15/18 mm, bloqueio de incompatibilidade, custo, grupo, material manual, persistência ao recalcular.');
