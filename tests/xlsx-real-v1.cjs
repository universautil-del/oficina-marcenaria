/* Testa um .xlsx real gerado pelo ExcelJS e lido pela rotina da Universalartes.
   Dependência somente de CI: npm install --no-save --ignore-scripts exceljs@4.4.0 */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ExcelJS=require('exceljs');
async function main(){
 const workbook=new ExcelJS.Workbook();
 const sheet=workbook.addWorksheet('Peças SketchUp 2022');
 sheet.addRow(['Peça','Comprimento_mm','Largura_mm','Espessura_mm','Quantidade','Material','Fita_m_por_peca']);
 sheet.addRow(['Lateral',2100,550,15,2,'MDF Branco TX',1.6]);
 sheet.addRow(['Prateleira',760,500,15,3,'MDF Branco TX',0.76]);
 const buffer=await workbook.xlsx.writeBuffer();
 const state={};
 const window={ExcelJS,universalartesSketchUp:{
  state,mapping(){state.mapped=true},view(){state.rendered=true}
 }};
 const document={addEventListener(){}};
 const code=fs.readFileSync(path.join(__dirname,'../preview-v1/sketchup-excel-v1.js'),'utf8');
 vm.runInNewContext(code,{window,document,Date,Array,Number,String,Promise,Math,Error},{timeout:2000});
 const file={name:'teste-opencutlist.xlsx',size:buffer.length,arrayBuffer:async()=>new Uint8Array(buffer)};
 await window.universalartesSketchUpExcel.readExcelFile(file);
 assert.equal(state.headers[0],'Peça');
 assert.equal(state.headers[1],'Comprimento_mm');
 assert.equal(state.raw.length,2);
 assert.equal(state.raw[0][1],'2100');
 assert.equal(state.raw[0][4],'2');
 assert.equal(state.mapped,true);
 assert.equal(state.rendered,true);
 console.log('OK arquivo XLSX real lido: 2 peças, medidas em mm, quantidades corretas.');
}
main().catch(e=>{console.error(e);process.exitCode=1});
