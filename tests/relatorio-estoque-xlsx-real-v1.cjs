/* Confere arquivo Excel verdadeiro do relatório de estoque, numerais e segurança. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const ExcelJS=require('exceljs');
const src=fs.readFileSync(path.join(__dirname,'../preview-v1/relatorio-estoque-v1.js'),'utf8');
const db={products:[
 {id:'m1',tipo:'materia',codigo:'01',nome:'MDF Branco',unidade:'chapa',estoque:3,custo:150},
 {id:'m2',tipo:'materia',codigo:'02',nome:'Parafuso',unidade:'un',estoque:200,custo:0.25},
 {id:'m3',tipo:'materia',codigo:'03',nome:'=SUM(1,1)',unidade:'un',estoque:1,custo:null},
 {id:'m4',tipo:'acabado',nome:'Móvel',unidade:'un',estoque:1,custo:5000}
]};
const context={window:{},db,iso:()=>'2026-11-13',Intl,Array,Math,Number,String,Date,Error,Map,Set};
vm.runInNewContext(src,context,{timeout:2000});
const report=context.window.universaArtRelatorioEstoque;
async function run(){
 const result=report.compute(db);
 assert.equal(result.items,3);
 const book=report.workbook(ExcelJS,result);
 const buffer=await book.xlsx.writeBuffer();
 assert(buffer.byteLength>2500,'Arquivo Excel real deve conter estrutura XLSX');
 const loaded=new ExcelJS.Workbook();
 await loaded.xlsx.load(buffer);
 assert.deepEqual(loaded.worksheets.map(s=>s.name),['Produtos em estoque','Resumo']);
 const sheet=loaded.getWorksheet('Produtos em estoque');
 assert.equal(sheet.getCell('A1').value,'Descrição do item');
 assert.equal(sheet.getCell('E1').value,'Valor total (R$)');
 assert.equal(sheet.getCell('A2').value,"'=SUM(1,1)",'Texto em forma de fórmula neutralizado');
 assert.equal(sheet.getCell('E2').value,null,'Item sem preço não ganha valor total fictício');
 const mdf=sheet.getRows(2,3).find(r=>r.getCell('A').value==='MDF Branco');
 assert(mdf,'MDF precisa ser exportado');
 assert.equal(mdf.getCell('C').value,3);
 assert.equal(mdf.getCell('D').value,150);
 assert.equal(mdf.getCell('E').value,450);
 const total=sheet.getRow(sheet.rowCount);
 assert.equal(total.getCell('E').value,500);
 const debugResumo=loaded.getWorksheet('Resumo');
 console.log('Resumo Excel:',JSON.stringify(debugResumo.getRows(1,debugResumo.rowCount).map(r=>[r.getCell('A').value,r.getCell('B').value])));
 assert.equal(loaded.getWorksheet('Resumo').getCell('B9').value,1);
 assert.equal(loaded.getWorksheet('Resumo').getCell('B11').value,500);
 console.log('OK Excel real relatório de estoque: 2 abas, saldos, valor total, sem custo inventado e proteção de fórmula.');
}
run().catch(err=>{console.error(err);process.exitCode=1});
