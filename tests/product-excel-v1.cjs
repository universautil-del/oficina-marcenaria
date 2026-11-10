/* Validação de cadastro compacto e importação de Excel da Universalartes.
   Executar com Node 22: node tests/product-excel-v1.cjs */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');const read=p=>fs.readFileSync(path.join(root,p),'utf8');
for(const file of ['preview-v1/script.js','preview-v1/sketchup-v1.js','preview-v1/sketchup-excel-v1.js'])new vm.Script(read(file),{filename:file});
const html=read('preview-v1/index.html');
assert(html.includes('product-compact-v1.css'));
assert(html.includes('sketchup-excel-v1.js'));
assert(html.indexOf('sketchup-excel-v1.js')>html.indexOf('sketchup-v1.js'));
const script=read('preview-v1/script.js');
const start=script.indexOf('function productModal(');
const end=script.indexOf('\nfunction adjustStock(',start);
assert(start>0&&end>start);
const code=script.slice(start,end);
const db={products:[],stockMovements:[]};
let modal,saveCount=0;
const environment={
 db,
 openModal:(title,fields,onSubmit)=>{modal={title,fields,onSubmit};return {}},
 esc:s=>String(s??'').replace(/[&<>"']/g,''),
 button:()=>'<button data-action="add-bom"></button>',
 round:n=>Math.round(Number(n)*100)/100,
 reservedQuantity:()=>0,
 getProduct:id=>db.products.find(p=>p.id===id),
 id:(()=>{let n=1;return()=>String(n++)})(),
 iso:()=> '2026-11-10',
 save:()=>{saveCount++;return true},
 alert:()=>{}
};
vm.runInNewContext(code,environment,{timeout:1500});
environment.productModal('','materia');
assert(modal.fields.includes('name="tipo"'));
assert(modal.fields.includes('name="observacoes"'));
assert(modal.fields.includes('name="estoque"'));
assert(modal.fields.includes('ua-product-grid'));
assert(modal.fields.includes('Matéria-prima')&&modal.fields.includes('Produto acabado'));
const values={tipo:'materia',codigo:'MDF-15',nome:'MDF branco TX 15 mm',categoria:'chapas',unidade:'chapa',preco:'240',custo:'180',estoque:'12',minimo:'2',observacoes:'Fibras MDF'};
assert.equal(modal.onSubmit(values,{}),true);
assert.equal(db.products.length,1);
assert.equal(db.products[0].estoque,12);
assert.equal(db.products[0].observacoes,'Fibras MDF');
assert.equal(db.stockMovements.length,1);
environment.productModal('','acabado');
const finished={tipo:'acabado',codigo:'MOV-1',nome:'Armário',categoria:'móveis',unidade:'un',preco:'1300',observacoes:'Obra teste'};
const row={querySelector:q=>q==='[data-material]'?{value:db.products[0].id}:{value:'2'}};
const dlg={querySelectorAll:()=>[row]};
assert.equal(modal.onSubmit(finished,dlg),true);
assert.equal(db.products[1].components[0].quantidade,2);
assert.equal(db.products[1].tipo,'acabado');
assert.equal(saveCount,2);

let callback;
const skpState={};
const w={universalartesSketchUp:{
 state:skpState,
 mapping(){skpState.mapCalled=true},
 view(){skpState.rendered=true}
}};
const document={addEventListener(type,fn,capture){if(type==='change'&&capture)callback=fn}};
vm.runInNewContext(read('preview-v1/sketchup-excel-v1.js'),{window:w,document,Error,Date,Array,Math,Number,String,Promise,setTimeout}, {timeout:1500});
assert.equal(typeof callback,'function');
const excel=w.universalartesSketchUpExcel;
const workbook={worksheets:[
 {name:'Capa',actualRowCount:1,columnCount:3,eachRow(o,fn){fn({getCell:i=>({value:['Título','Planilha','Universalartes'][i-1]})})}},
 {name:'Peças',actualRowCount:4,columnCount:7,eachRow(o,fn){
  const lines=[
   ['Relatório da marcenaria','','','','','',''],
   ['Peça','Comprimento_mm','Largura_mm','Espessura_mm','Quantidade','Material','Fita_m'],
   ['Lateral',2100,550,15,2,'MDF Branco','1,60'],
   ['Prateleira',760,500,15,3,'MDF Branco','0,76']
  ];for(const line of lines)fn({getCell:i=>({value:line[i-1]})});
 }},
 {name:'Outros',actualRowCount:2,columnCount:3,eachRow(o,fn){
  for(const line of [['Peça','Comprimento','Largura'],['Porta',800,400]])fn({getCell:i=>({value:line[i-1]})});
 }}
]};
const sheets=excel.extractSheets(workbook);
assert.equal(sheets.length,2);
assert.equal(sheets[0].rows.length,3);
assert.equal(sheets[0].rows[0][0],'Peça');
skpState.xlsxSheets=sheets;skpState.xlsxFilename='partes.xlsx';
excel.selectSheet(0);
assert.equal(skpState.raw.length,2);
assert.equal(skpState.headers[1],'Comprimento_mm');
assert.equal(skpState.mapCalled,true);
excel.selectSheet(1);
assert.equal(skpState.raw[0][0],'Porta');
assert.equal(excel.textFromCell({value:{richText:[{text:'MDF '},{text:'TX'}]}}),'MDF TX');
assert.equal(excel.textFromCell({value:{formula:'2+2',result:4}}),'4');
assert.throws(()=>excel.textFromCell({value:{formula:'2+2'}}),/Fórmula.*sem resultado/);
assert.throws(()=>excel.extractSheets({worksheets:[{columnCount:81,actualRowCount:4}]}),/limites/);
console.log('OK cadastro de matéria-prima e móvel, estoque e composição.');
console.log('OK Excel: abas, cabeçalho, números, fórmulas e limites de arquivo.');
console.log('Nota: teste do leitor Excel usa um workbook simulado; baixar/abrir XLSX real depende da biblioteca externa.');
