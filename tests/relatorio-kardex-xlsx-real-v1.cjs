/* Verifica XLSX real do Kardex, com movimentos e ficha do produto, sem valores inventados. */
'use strict';
const ExcelJS=require('exceljs');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const code=fs.readFileSync(path.join(__dirname,'../preview-v1/relatorio-kardex-v1.js'),'utf8');
const db={products:[{id:'mat-1',codigo:'10',tipo:'materia',nome:'MDF TX',categoria:'MDF',unidade:'chapa',estoque:8,minimo:2,maximo:20,custo:158.90}],
 purchases:[{id:'ent-1',number:11}],orders:[{id:'ped-1',controlCode:'PED-2026-001'}],
 stockMovements:[
  {id:'a',productId:'mat-1',delta:10,date:'2026-11-10',purchaseId:'ent-1',note:'Entrada de materiais'},
  {id:'b',productId:'mat-1',delta:-2,date:'2026-11-11',orderId:'ped-1',note:'=SUM(1,1)'}
 ]};
const context={db,window:{},Number,Math,Date,String,Array,Set,Map,Intl,Promise};
vm.runInNewContext(code,context,{timeout:2000});
const api=context.window.universaArtKardex;
async function run(){
 const report=api.build(db,'mat-1','asc');
 const book=api.workbook(ExcelJS,report);
 const bytes=await book.xlsx.writeBuffer();
 assert(bytes.byteLength>2500);
 const parsed=new ExcelJS.Workbook();
 await parsed.xlsx.load(bytes);
 assert.deepEqual(parsed.worksheets.map(x=>x.name),['Kardex','Ficha do produto']);
 const sheet=parsed.getWorksheet('Kardex');
 assert.equal(sheet.getCell('A1').value,'Registro');
 assert.equal(sheet.getCell('H1').value,'Saldo após reconstituído');
 assert.equal(sheet.rowCount,3);
 assert.equal(sheet.getCell('F2').value,10);
 assert.equal(sheet.getCell('G2').value,0);
 assert.equal(sheet.getCell('H2').value,10);
 assert.equal(sheet.getCell('F3').value,0);
 assert.equal(sheet.getCell('G3').value,2);
 assert.equal(sheet.getCell('H3').value,8);
 assert.equal(sheet.getCell('E3').value,"'=SUM(1,1)",'Proteger contra fórmula no Excel');
 const form=parsed.getWorksheet('Ficha do produto');
 assert.equal(form.getCell('B2').value,'MDF TX');
 assert.equal(form.getCell('B6').value,8);
 assert.equal(form.getCell('B7').value,2);
 assert.equal(form.getCell('B8').value,20);
 assert.equal(form.getCell('B9').value,158.90);
 console.log('OK XLSX real Kardex: saldos, entradas, saídas, máximo, custo e proteção contra fórmulas.');
}
run().catch(e=>{console.error(e);process.exitCode=1});
