'use strict';
/* UNIVERSALARTES — Leitor XLSX da lista de peças SketchUp 2022/OpenCutList.
   O arquivo Excel é processado na aba. ExcelJS 4.4.0 é carregado de CDN apenas quando solicitado.
   Sem leitura direta de .skp, sem gerar ordens ou alterar estoques automaticamente. */
(function(){
 let loader=null;
 const MAX_FILE=3*1024*1024,MAX_ROWS=5000,MAX_COLS=80;
 const api=()=>window.universalartesSketchUp;
 function ensureExcelJS(){
  if(window.ExcelJS?.Workbook)return Promise.resolve(window.ExcelJS);
  if(!loader)loader=new Promise((resolve,reject)=>{
   const script=document.createElement('script');
   script.src='https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js';
   script.crossOrigin='anonymous';
   script.referrerPolicy='no-referrer';
   script.onload=()=>window.ExcelJS?.Workbook?resolve(window.ExcelJS):reject(Error('Leitor Excel não carregou corretamente.'));
   script.onerror=()=>reject(Error('Não foi possível carregar o leitor Excel. Confira a internet ou exporte CSV.'));
   document.head.appendChild(script);
  }).catch(e=>{loader=null;throw e});
  return loader;
 }
 function textFromCell(cell){
  const v=cell?.value;
  if(v===null||v===undefined)return '';
  if(v instanceof Date)return v.toISOString().slice(0,10);
  if(typeof v==='object'){
   if(Array.isArray(v.richText))return v.richText.map(x=>x.text||'').join('');
   if('result' in v){
    if(v.result===null||v.result===undefined)throw Error('Fórmula do Excel sem resultado calculado. Abra a planilha, recalcule e salve.');
    return String(v.result);
   }
   if(typeof v.text==='string')return v.text;
   if(v.hyperlink)throw Error('Célula com hiperlink usada como valor: informe texto ou número.');
   return '';
  }
  return String(v);
 }
 function findHeader(rows){
  const normalize=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const key=/^(peca|nome|designacao|designation|part|description|descricao|comprimento|length|largura|width|espessura|thickness|quantidade|quantity|material)/;
  let best=0,score=-1;
  rows.slice(0,12).forEach((r,i)=>{
   const count=r.reduce((n,c)=>n+(key.test(normalize(c).trim())?1:0),0);
   if(count>score){score=count;best=i}
  });
  return score>=2?best:0;
 }
 function extractSheets(workbook){
  if(!workbook||!Array.isArray(workbook.worksheets)||workbook.worksheets.length>15)throw Error('Excel com número excessivo de abas.');
  const out=[];
  for(const ws of workbook.worksheets){
   if(ws.actualRowCount>MAX_ROWS+12||ws.columnCount>MAX_COLS)throw Error('Arquivo Excel excede os limites: 5.000 linhas e 80 colunas.');
   const cols=Math.max(1,ws.columnCount||1);
   const rows=[];
   ws.eachRow({includeEmpty:false},row=>{
    const cells=Array.from({length:cols},(_,i)=>textFromCell(row.getCell(i+1)));
    if(cells.some(x=>x.trim()))rows.push(cells);
    if(rows.length>MAX_ROWS+12)throw Error('Planilha muito grande. Separe por projeto.');
   });
   if(rows.length<2||cols<3)continue;
   const header=findHeader(rows);
   if(rows.length-header<2)continue;
   out.push({name:ws.name||'Planilha '+(out.length+1),rows:rows.slice(header)});
  }
  if(!out.length)throw Error('Não encontrei uma aba com cabeçalho e lista de peças.');
  return out;
 }
 function selectSheet(index){
  const tool=api(),state=tool?.state;
  if(!state)throw Error('Importador SketchUp indisponível.');
  const s=state.xlsxSheets?.[index];if(!s)throw Error('Aba do Excel não encontrada.');
  state.headers=s.rows[0].map((c,i)=>String(c).trim()||'Coluna '+(i+1));
  state.raw=s.rows.slice(1);state.file=(state.xlsxFilename||'Excel')+' · '+s.name;
  state.parts=[];state.settings={};state.error='';state.selectedExcelSheet=index;
  tool.mapping();tool.view();
 }
 async function readExcelFile(file){
  if(file.size>MAX_FILE)throw Error('Planilha maior que 3 MB. Exporte uma obra por vez.');
  const ExcelJS=await ensureExcelJS();
  const wb=new ExcelJS.Workbook();
  try{await wb.xlsx.load(new Uint8Array(await file.arrayBuffer()))}
  catch(e){throw Error('Não foi possível abrir o XLSX. Confirme que é um Excel válido, não protegido por senha.')}
  const sheets=extractSheets(wb);
  const state=api().state;
  state.xlsxSheets=sheets;state.xlsxFilename=file.name;
  selectSheet(0);
 }
 function enhance(){
  const file=document.getElementById('uaSkuFile'),state=api()?.state;
  if(!file||!state)return;
  file.accept='.xlsx,.csv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/plain';
  document.getElementById('uaExcelSheetWrap')?.remove();
  if(state.xlsxSheets?.length>1){
   const wrap=document.createElement('label');
   wrap.id='uaExcelSheetWrap';wrap.className='ua-skp-upload';
   wrap.textContent='Aba do arquivo Excel';
   const select=document.createElement('select');select.id='uaExcelSheetSelector';
   state.xlsxSheets.forEach((sheet,i)=>{
    const opt=document.createElement('option');opt.value=String(i);opt.textContent=sheet.name;
    if(i===state.selectedExcelSheet)opt.selected=true;
    select.appendChild(opt);
   });
   wrap.appendChild(select);file.parentElement.after(wrap);
  }
 }
 document.addEventListener('change',async e=>{
  const t=e.target;
  if(t?.id==='uaSkuFile'){
   const f=t.files?.[0];if(!f)return;
   if(!/\.xlsx$/i.test(f.name)){
    const state=api()?.state;
    if(state){state.xlsxSheets=[];state.xlsxFilename='';state.selectedExcelSheet=0}
    return; // CSV permanece a cargo do importador existente.
   }
   // Interceptar XLSX antes do leitor CSV (que rejeita extensões diferentes).
   e.stopImmediatePropagation();
   e.preventDefault();
   try{await readExcelFile(f)}
   catch(err){
    const tool=api();
    if(tool){tool.state.error=err?.message||'Falha ao ler Excel.';tool.state.file='';tool.state.headers=[];tool.state.raw=[];tool.state.parts=[];tool.state.xlsxSheets=[];tool.view()}
   }
  }else if(t?.id==='uaExcelSheetSelector'){
   e.stopImmediatePropagation();
   try{selectSheet(Number(t.value))}
   catch(err){const tool=api();if(tool){tool.state.error=err.message;tool.view()}}
  }
 },true);
 window.universalartesSketchUpExcel={enhance,extractSheets,textFromCell,selectSheet,readExcelFile};
})();