'use strict';
/* UNIVERSA ART — Relatório financeiro analítico e exportação XLSX.
   Apenas lê dados; nenhum lançamento ou pagamento é modificado. */
(function(){
 const MAX_EXPORT=20000;
 const state={preset:'seis',from:'',to:'',type:'todos',status:'todos',basis:'vencimento'};
 let excelPromise=null,busy=false;
 const currencies=val=>Math.round((Number(val)||0)*100)/100;
 const moneyCell='"R$" #,##0.00;[Red]("R$" #,##0.00)';
 const sanitize=value=>{
  const result=String(value??'').slice(0,30000);
  return /^\s*[=+@]/.test(result)||/^\s*-(?!\d)/.test(result)?"'"+result:result;
 };
 function isDate(value){
  if(!/^\d{4}-\d\d-\d\d$/.test(String(value||'')))return false;
  const d=new Date(value+'T12:00:00Z');
  return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value;
 }
 function firstMonth(today,monthsBack){
  const [year,month]=today.slice(0,7).split('-').map(Number);
  const date=new Date(Date.UTC(year,month-1-monthsBack,1));
  return date.toISOString().slice(0,10);
 }
 function presetRange(preset,today){
  const base=isDate(today)?today:'2026-11-12';
  const year=base.slice(0,4);
  if(preset==='mes')return {from:base.slice(0,7)+'-01',to:base};
  if(preset==='tres')return {from:firstMonth(base,2),to:base};
  if(preset==='ano')return {from:year+'-01-01',to:base};
  if(preset==='todos')return {from:'1900-01-01',to:'9999-12-31'};
  return {from:firstMonth(base,5),to:base};
 }
 Object.assign(state,presetRange(state.preset,iso()));
 function formatDate(value){return isDate(value)?value.slice(8,10)+'/'+value.slice(5,7)+'/'+value.slice(0,4):'—'}
 function settlement(t){
  const total=currencies(t.valor);
  const paid=currencies((Array.isArray(t.payments)?t.payments:[]).reduce((sum,p)=>sum+(Number(p.valor)||0),0));
  const open=currencies(Math.max(0,total-paid));
  return {total,paid,open,status:open<=0.004?'pago':paid>0?'parcial':'pendente'};
 }
 function reference(t,data){
  if(t.orderId){
   const o=(data.orders||[]).find(o=>o.id===t.orderId);
   return o?.controlCode||('Pedido '+(o?.number||''));
  }
  if(t.purchaseId){
   const p=(data.purchases||[]).find(p=>p.id===t.purchaseId);
   return p?'Entrada #'+p.number:'Entrada de materiais';
  }
  return '';
 }
 function party(t,data){
  if(t.orderId){
   const o=(data.orders||[]).find(o=>o.id===t.orderId);
   const c=(data.clients||[]).find(c=>c.id===(t.clientId||o?.clientId));
   return c?.nome||o?.clientNome||t.clientNome||'';
  }
  if(t.purchaseId){
   const p=(data.purchases||[]).find(p=>p.id===t.purchaseId);
   return p?.supplierNome||t.supplierNome||'';
  }
  const c=(data.clients||[]).find(c=>c.id===t.clientId);
  return c?.nome||t.clientNome||t.supplierNome||'';
 }
 function statusLabel(status){return {pago:'Pago',parcial:'Parcial',pendente:'Pendente',vencido:'Vencido'}[status]||status}
 function kindLabel(kind){return kind==='receber'?'Receita':'Despesa'}
 function validFilter(filters){
  if(!isDate(filters.from)||!isDate(filters.to)||filters.from>filters.to)throw Error('Informe um período inicial e final válido.');
  if(!['todos','receber','pagar'].includes(filters.type))throw Error('Tipo de lançamento inválido.');
  if(!['todos','pago','parcial','pendente','vencido'].includes(filters.status))throw Error('Situação inválida.');
  if(!['vencimento','caixa'].includes(filters.basis))throw Error('Critério de análise inválido.');
 }
 function compute(data,filters){
  validFilter(filters);
  const rows=[];
  const now=iso();
  for(const t of data.transactions||[]){
   if(!t||!['receber','pagar'].includes(t.kind)||filters.type!=='todos'&&filters.type!==t.kind)continue;
   const settled=settlement(t);
   const late=isDate(t.dueDate)&&t.dueDate<now&&settled.open>0;
   const status=late&&settled.status==='pendente'?'vencido':settled.status;
   const filterStatus=filters.status;
   if(filters.basis==='vencimento'){
    if(!isDate(t.dueDate)||t.dueDate<filters.from||t.dueDate>filters.to)continue;
    if(filterStatus!=='todos'&&
      !(filterStatus==='vencido'?late:(filterStatus==='pendente'?settled.status==='pendente':settled.status===filterStatus)))continue;
    rows.push({
     id:t.id,date:t.dueDate,kind:t.kind,description:String(t.descricao||''),
     person:party(t,data),reference:reference(t,data),
     amount:settled.total,paid:settled.paid,open:settled.open,
     status,method:String(t.paymentMethod||''),paymentId:''
    });
   }else{
    for(const p of (Array.isArray(t.payments)?t.payments:[])){
     if(!isDate(p.date)||p.date<filters.from||p.date>filters.to||!Number.isFinite(Number(p.valor))||Number(p.valor)<=0)continue;
     rows.push({
      id:t.id,date:p.date,kind:t.kind,description:String(t.descricao||''),
      person:party(t,data),reference:reference(t,data),
      amount:currencies(p.valor),paid:currencies(p.valor),open:0,
      status:'pago',method:String(p.method||t.paymentMethod||''),paymentId:String(p.id||'')
     });
    }
   }
  }
  rows.sort((a,b)=>a.date.localeCompare(b.date)||a.description.localeCompare(b.description,'pt-BR'));
  const summary={expectedIncome:0,expectedExpense:0,received:0,paid:0,openIncome:0,openExpense:0,records:rows.length};
  const months=new Map();
  for(const row of rows){
   const key=row.date.slice(0,7);
   if(!months.has(key))months.set(key,{month:key,receitas:0,despesas:0,recebido:0,pago:0,abertoReceber:0,abertoPagar:0});
   const monthly=months.get(key),isIncome=row.kind==='receber';
   if(isIncome){
    summary.expectedIncome+=row.amount;summary.received+=row.paid;summary.openIncome+=row.open;
    monthly.receitas+=row.amount;monthly.recebido+=row.paid;monthly.abertoReceber+=row.open;
   }else{
    summary.expectedExpense+=row.amount;summary.paid+=row.paid;summary.openExpense+=row.open;
    monthly.despesas+=row.amount;monthly.pago+=row.paid;monthly.abertoPagar+=row.open;
   }
  }
  Object.keys(summary).forEach(k=>{if(k!=='records')summary[k]=currencies(summary[k])});
  return {
   filters:{...filters},
   rows,summary,
   months:[...months.values()].sort((a,b)=>a.month.localeCompare(b.month)).map(m=>({
    ...m,receitas:currencies(m.receitas),despesas:currencies(m.despesas),
    recebido:currencies(m.recebido),pago:currencies(m.pago),
    abertoReceber:currencies(m.abertoReceber),abertoPagar:currencies(m.abertoPagar),
    resultado:currencies(m.receitas-m.despesas)
   }))
  };
 }
 const options=(choices,selected)=>choices.map(([value,label])=>'<option value="'+esc(value)+'"'+(selected===value?' selected':'')+'>'+esc(label)+'</option>').join('');
 function panel(){
  const r=compute(db,state);
  const isCash=state.basis==='caixa';
  const a=r.summary;
  const helper=isCash?'Valores efetivamente recebidos ou pagos entre as datas selecionadas. Apenas pagamentos registrados são considerados.':'Valores com vencimento no período. O campo Liquidado considera pagamentos registrados até agora, inclusive quando realizados fora do período.';
  const cards=isCash?[
   ['Recebimentos',a.received,'Entradas efetivas'],['Pagamentos',a.paid,'Saídas efetivas'],
   ['Resultado de caixa',currencies(a.received-a.paid),'Recebido menos pago'],['Movimentações',a.records,'Pagamentos no período']
  ]:[
   ['Receitas previstas',a.expectedIncome,'A receber no período'],['Despesas previstas',a.expectedExpense,'A pagar no período'],
   ['Já liquidado',currencies(a.received+a.paid),'Pagamentos até o momento'],
   ['Saldo em aberto',currencies(a.openIncome+a.openExpense),'Valores ainda pendentes']
  ];
  const rowsHtml=r.rows.slice(0,300).map(row=>td(
   formatDate(row.date),esc(kindLabel(row.kind)),
   '<strong>'+esc(row.description)+'</strong>'+(row.person?'<div class="small muted">'+esc(row.person)+'</div>':''),
   esc(row.reference||'—'),
   money(row.amount),
   isCash?esc(row.method||'—'):money(row.paid),
   isCash?pill('Pago','success'):money(row.open),
   ...(!isCash?[pill(statusLabel(row.status),row.status==='pago'?'success':row.status==='vencido'?'danger':row.status==='parcial'?'warn':'')]:[])
  )).join('');
  const heads=isCash?['Pagamento','Tipo','Lançamento / Cliente','Pedido / Entrada','Valor','Forma','Situação']:['Vencimento','Tipo','Lançamento / Cliente','Pedido / Entrada','Valor','Liquidado','Saldo','Situação'];
  const noRows='<div class="empty compact">Nenhum lançamento encontrado para os filtros selecionados.</div>';
  const monthly=r.months.slice(-18).map(m=>td(esc(m.month),money(m.receitas),money(m.despesas),money(m.resultado))).join('');
  return '<section class="panel ua-fin-report" id="uaFinancialReport">'+
   '<div class="panel-head"><div><h3>Relatório financeiro analítico</h3><p class="muted small">Filtre por datas, tipo de lançamento, situação e critério de análise.</p></div>'+
   '<button type="button" class="btn primary" id="uaFinanceXlsx" '+(busy?'disabled':'')+'>Exportar Excel (.xlsx)</button></div>'+
   '<div class="ua-fin-filters">'+
    '<label>Período<select data-ua-fin-filter="preset">'+options([['mes','Este mês'],['tres','Últimos 3 meses'],['seis','Últimos 6 meses'],['ano','Este ano'],['todos','Todo o histórico'],['custom','Personalizado']],state.preset)+'</select></label>'+
    '<label>Data inicial<input type="date" data-ua-fin-filter="from" value="'+esc(state.from)+'"></label>'+
    '<label>Data final<input type="date" data-ua-fin-filter="to" value="'+esc(state.to)+'"></label>'+
    '<label>Tipo<select data-ua-fin-filter="type">'+options([['todos','Receitas e despesas'],['receber','Somente receitas'],['pagar','Somente despesas']],state.type)+'</select></label>'+
    '<label>Critério<select data-ua-fin-filter="basis">'+options([['vencimento','Por vencimento'],['caixa','Por data do pagamento']],state.basis)+'</select></label>'+
    '<label>Situação<select data-ua-fin-filter="status" '+(isCash?'disabled':'')+'>'+options([['todos','Todas'],['pendente','Pendente'],['parcial','Parcial'],['pago','Pago'],['vencido','Vencido']],state.status)+'</select></label>'+
   '</div>'+
   '<p class="ua-fin-description">'+esc(helper)+'</p>'+
   '<div class="ua-fin-metrics">'+cards.map(([name,value,note])=>
    '<div class="ua-fin-metric"><span>'+esc(name)+'</span><strong>'+(!Number.isInteger(value)||name!=='Movimentações'?money(value):value)+'</strong><small>'+esc(note)+'</small></div>'
   ).join('')+'</div>'+
   '<div class="panel-head ua-fin-section-title"><h3>Detalhamento dos lançamentos</h3><span class="muted small">'+r.rows.length+' registro(s)'+(r.rows.length>300?' · exibindo 300; Excel contém todos':'')+'</span></div>'+
   (r.rows.length?'<div class="table-wrap"><table><thead><tr>'+heads.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+rowsHtml+'</tbody></table></div>':noRows)+
   '<div class="panel-head ua-fin-section-title"><h3>Resumo por mês</h3><span class="muted small">'+(isCash?'Movimentação efetiva':'Vencimentos do período')+'</span></div>'+
   (r.months.length?'<div class="table-wrap"><table><thead><tr><th>Mês</th><th>Receitas</th><th>Despesas</th><th>Resultado</th></tr></thead><tbody>'+monthly+'</tbody></table></div>':noRows)+
   '<p class="footer-note">Os valores são calculados somente a partir dos registros da OFICINA. O Excel possui abas Resumo, Lançamentos/Pagamentos e Evolução mensal. O relatório não altera o Financeiro.</p>'+
  '</section>';
 }
 function bind(container){
  const root=container.querySelector('#uaFinancialReport');
  if(!root)return;
  root.querySelectorAll('[data-ua-fin-filter]').forEach(el=>el.addEventListener('change',e=>{
   const key=e.target.dataset.uaFinFilter,chosen=e.target.value;
   const next={...state};
   if(key==='preset'&&chosen!=='custom'){
    Object.assign(next,presetRange(chosen,iso()));next.preset=chosen;
   }else{
    next[key]=chosen;
    if(key==='from'||key==='to')next.preset='custom';
   }
   try{validFilter(next)}catch(error){alert(error.message);return}
   Object.assign(state,next);
   render('relatorios');
  }));
  const button=root.querySelector('#uaFinanceXlsx');
  if(button)button.addEventListener('click',async()=>{
   if(busy)return;
   busy=true;button.disabled=true;button.textContent='Gerando Excel...';
   try{await exportXlsx()}
   catch(error){alert('Não foi possível exportar o Excel: '+String(error?.message||error))}
   finally{busy=false;button.disabled=false;button.textContent='Exportar Excel (.xlsx)'}
  });
 }
 function excelDate(value){return isDate(value)?new Date(value+'T12:00:00Z'):null}
 function styleSheet(ws,columns,currencyColumns=[],dateColumns=[]){
  if(!ws.columns||!ws.columns.length)ws.columns=columns.map(([header,key,width])=>({header,key,width}));
  ws.views=[{state:'frozen',ySplit:1}];
  ws.autoFilter={from:{row:1,column:1},to:{row:1,column:columns.length}};
  ws.getRow(1).height=26;
  ws.getRow(1).eachCell(cell=>{
   cell.font={bold:true,color:{argb:'FFFFFFFF'}};
   cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF205740'}};
   cell.alignment={vertical:'middle',wrapText:true};
  });
  for(let i=2;i<=ws.rowCount;i++){
   const row=ws.getRow(i);
   for(const key of currencyColumns){row.getCell(key).numFmt=moneyCell;}
   for(const key of dateColumns){row.getCell(key).numFmt='dd/mm/yyyy';}
   if(i%2===0)row.eachCell({includeEmpty:false},cell=>{
    cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF3F8F4'}};
   });
  }
 }
 function buildWorkbook(ExcelJS,result){
  const wb=new ExcelJS.Workbook();
  wb.creator='OFICINA — UNIVERSA ART';
  wb.title='Relatório financeiro analítico';
  wb.created=new Date();
  const r=result,filters=r.filters,s=r.summary;
  const summary=wb.addWorksheet('Resumo');
  summary.columns=[{key:'campo',width:29},{key:'valor',width:27},{key:'extra',width:27}];
  summary.addRow({campo:'UNIVERSA ART — RELATÓRIO FINANCEIRO'});
  summary.mergeCells('A1:C1');
  summary.getCell('A1').font={bold:true,size:17,color:{argb:'FF1D503A'}};
  summary.addRow({campo:'Período inicial',valor:formatDate(filters.from)});
  summary.addRow({campo:'Período final',valor:formatDate(filters.to)});
  summary.addRow({campo:'Critério',valor:filters.basis==='caixa'?'Por data do pagamento':'Por vencimento'});
  summary.addRow({campo:'Tipo',valor:filters.type==='todos'?'Receitas e despesas':kindLabel(filters.type)});
  summary.addRow({campo:'Situação',valor:filters.basis==='caixa'?'Não aplicável':filters.status==='todos'?'Todas':statusLabel(filters.status)});
  summary.addRow({});
  const metrics=filters.basis==='caixa'?[
   ['Recebido no período',s.received],
   ['Pago no período',s.paid],
   ['Resultado de caixa',currencies(s.received-s.paid)],
   ['Movimentações',s.records]
  ]:[
   ['Receitas previstas',s.expectedIncome],
   ['Despesas previstas',s.expectedExpense],
   ['Recebido',s.received],
   ['Pago',s.paid],
   ['Em aberto a receber',s.openIncome],
   ['Em aberto a pagar',s.openExpense],
   ['Resultado',r.filters.basis==='caixa'?currencies(s.received-s.paid):currencies(s.expectedIncome-s.expectedExpense)],
   ['Registros',s.records]
  ];
  for(const [name,val] of metrics){
   const row=summary.addRow({campo:name,valor:val});
   if(name!=='Registros'&&name!=='Movimentações')row.getCell(2).numFmt=moneyCell;
   if(name==='Resultado'||name==='Resultado de caixa')row.font={bold:true,color:{argb:'FF1D503A'}};
  }
  summary.addRow({});
  summary.addRow({campo:'Observação',valor:filters.basis==='caixa'?'Pagamentos efetivos do período.':'Por vencimento; liquidado considera pagamentos registrados até agora.'});
  summary.getColumn(2).alignment={wrapText:true};
  summary.getColumn(3).alignment={wrapText:true};
  const detail=wb.addWorksheet(filters.basis==='caixa'?'Pagamentos':'Lançamentos');
  const cols=[
   ['Data','data',16],['Tipo','tipo',13],['Descrição','descricao',48],
   ['Cliente ou fornecedor','pessoa',28],['Pedido / Entrada','referencia',22],
   ['Valor (R$)','valor',18],
   [filters.basis==='caixa'?'Recebido/pago (R$)':'Liquidado (R$)','liquidado',20],
   ['Saldo (R$)','saldo',18],['Situação','situacao',15],['Forma','forma',22]
  ];
  styleSheet(detail,cols,[],[]);
  for(const x of r.rows){
   detail.addRow({
    data:excelDate(x.date),tipo:kindLabel(x.kind),
    descricao:sanitize(x.description),pessoa:sanitize(x.person),
    referencia:sanitize(x.reference),
    valor:x.amount,liquidado:x.paid,saldo:filters.basis==='caixa'?null:x.open,
    situacao:statusLabel(x.status),forma:sanitize(x.method)
   });
  }
  styleSheet(detail,cols,[6,7,8],[1]);
  const monthly=wb.addWorksheet('Evolução mensal');
  const monthColumns=[
   ['Mês','mes',15],['Receitas previstas (R$)','receitas',23],
   ['Despesas previstas (R$)','despesas',23],['Resultado (R$)','resultado',20],
   ['Recebido (R$)','recebido',20],['Pago (R$)','pago',20],
   ['Em aberto a receber (R$)','abertoReceber',25],
   ['Em aberto a pagar (R$)','abertoPagar',25]
  ];
  styleSheet(monthly,monthColumns,[],[]);
  r.months.forEach(m=>monthly.addRow({mes:m.month,receitas:m.receitas,despesas:m.despesas,
   resultado:m.resultado,recebido:m.recebido,pago:m.pago,
   abertoReceber:m.abertoReceber,abertoPagar:m.abertoPagar}));
  styleSheet(monthly,monthColumns,[2,3,4,5,6,7,8],[]);
  return wb;
 }
 function ensureExcel(){
  if(window.ExcelJS?.Workbook)return Promise.resolve(window.ExcelJS);
  if(!excelPromise)excelPromise=new Promise((resolve,reject)=>{
   const script=document.createElement('script');
   script.src='https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js';
   script.crossOrigin='anonymous';script.referrerPolicy='no-referrer';
   script.onload=()=>window.ExcelJS?.Workbook?resolve(window.ExcelJS):reject(Error('A biblioteca Excel não foi carregada.'));
   script.onerror=()=>reject(Error('Não foi possível carregar a biblioteca Excel. Confira sua conexão com a internet.'));
   document.head.appendChild(script);
  }).catch(error=>{excelPromise=null;throw error});
  return excelPromise;
 }
 async function exportXlsx(){
  const result=compute(db,state);
  if(result.rows.length>MAX_EXPORT)throw Error('O resultado ultrapassou 20.000 linhas. Selecione um período menor.');
  const ExcelJS=await ensureExcel();
  const workbook=buildWorkbook(ExcelJS,result);
  const buffer=await workbook.xlsx.writeBuffer();
  const blob=new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const url=URL.createObjectURL(blob);
  const link=document.createElement('a');
  link.href=url;link.download='oficina-relatorio-financeiro-'+state.from+'-a-'+state.to+'.xlsx';
  document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),5000);
  return true;
 }
 window.universaArtRelatorioFinanceiro={state,compute,panel,bind,presetRange,buildWorkbook,exportXlsx};
})();