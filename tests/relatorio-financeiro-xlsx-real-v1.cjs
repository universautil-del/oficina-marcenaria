/* Verifica planilha .xlsx verdadeira com ExcelJS, datas e valores numéricos. */
'use strict';
const ExcelJS=require('exceljs');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../preview-v1/relatorio-financeiro-v1.js'),'utf8');
const db={
 orders:[{id:'o1',number:1,controlCode:'PED-2026-001',clientId:'c1',clientNome:'Cliente 1'}],
 clients:[{id:'c1',nome:'Cliente 1'}],
 purchases:[],
 transactions:[
  {id:'t1',kind:'receber',orderId:'o1',dueDate:'2026-11-15',valor:2000,
   descricao:'Projeto Cozinha',payments:[{id:'x1',date:'2026-11-16',valor:500,method:'Pix'}]},
  {id:'t2',kind:'pagar',dueDate:'2026-11-20',valor:750,
   descricao:'=SUM(1,1)',payments:[{id:'x2',date:'2026-11-22',valor:750,method:'Dinheiro'}]}
 ]
};
const context={window:{},db,iso:()=> '2026-11-12',Number,Math,Date,Array,String,Map,Object,Error,Intl};
vm.runInNewContext(source,context);
const report=context.window.universaArtRelatorioFinanceiro;
async function run(){
 for(const basis of ['vencimento','caixa']){
  const data=report.compute(db,{from:'2026-11-01',to:'2026-11-30',type:'todos',status:'todos',basis});
  const workbook=report.buildWorkbook(ExcelJS,data);
  const bytes=await workbook.xlsx.writeBuffer();
  assert(bytes.length>3000,'Gerou XLSX real, não CSV renomeado');
  const parsed=new ExcelJS.Workbook();
  await parsed.xlsx.load(bytes);
  const expected=basis==='vencimento'?'Lançamentos':'Pagamentos';
  assert.deepEqual(parsed.worksheets.map(x=>x.name),['Resumo',expected,'Evolução mensal']);
  const sheet=parsed.getWorksheet(expected);
  assert.equal(sheet.rowCount,3);
  assert(sheet.getCell('A2').value instanceof Date);
  assert.equal(sheet.getCell('F2').value,basis==='vencimento'?2000:500);
  assert.equal(sheet.getCell('F3').value,750);
  assert.equal(sheet.getCell('H2').value,basis==='vencimento'?1500:null);
  assert.equal(sheet.getCell('C3').value,"'=SUM(1,1)",'Protege texto contra fórmula');
  assert.equal(parsed.getWorksheet('Evolução mensal').getCell('D2').value,basis==='vencimento'?1250:-250);
  console.log('DEBUG RESUMO:', parsed.getWorksheet('Resumo').getRows(1,8).map(r=>[r.number,r.values]));
  assert.equal(parsed.getWorksheet('Resumo').getCell('B2').value,'01/11/2026');
  assert.equal(sheet.getColumn(6).numFmt||sheet.getCell('F2').numFmt,'"R$" #,##0.00;[Red]("R$" #,##0.00)');
 }
 console.log('OK XLSX financeiro real: 3 abas, moeda e datas Excel, fórmulas protegidas e critérios vencimento/caixa.');
}
run().catch(e=>{console.error(e);process.exitCode=1});
