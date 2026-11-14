'use strict';
/* UNIVERSA ART — relatório de estoque, somente leitura, por custo unitário cadastrado.
   O catálogo de referência, produtos acabados sem saldo e compras a receber não fazem parte do saldo. */
(function(){
 const LIMIT=400,MAX_EXPORT=15000;
 const state={stock:'positivo',category:'',query:'',sort:'descricao',direction:'asc'};
 const orders=[
  ['descricao','Descrição do item'],['codigo','Código'],['categoria','Categoria'],
  ['unidade','Unidade'],['saldo','Saldo em estoque'],
  ['valorUnitario','Valor unitário'],['valorTotal','Valor total']
 ];
 const escape=s=>esc(s);
 const trimSearch=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
 const moneyCell='"R$" #,##0.00;[Red]("R$" #,##0.00)';
 let busy=false,excelPromise=null;
 function num(value){
  if(value==null||String(value).trim()==='')return null;
  const n=Number(value);return Number.isFinite(n)&&n>=0?n:null;
 }
 function records(data){
  return (Array.isArray(data?.products)?data.products:[])
   .filter(p=>p&&p.tipo==='materia')
   .map(p=>{
    const saldo=num(p.estoque);
    const unit=num(p.custo);
    return {id:String(p.id||''),codigo:String(p.codigo||''),descricao:String(p.nome||'Sem descrição'),
     categoria:String(p.categoria||''),unidade:String(p.unidade||'un'),
     saldo:saldo??0,valorUnitario:unit,valorTotal:unit===null?null:Math.round((saldo??0)*unit*100)/100,
     saldoValido:saldo!==null};
   });
 }
 function compute(data,filters=state){
  const all=records(data),term=trimSearch(filters.query);
  const rows=all.filter(x=>{
   if(filters.stock==='positivo'&&x.saldo<=0)return false;
   if(filters.stock==='zerado'&&x.saldo>0)return false;
   if(filters.category&&x.categoria!==filters.category)return false;
   if(term&&!trimSearch([x.descricao,x.codigo,x.categoria,x.unidade].join(' ')).includes(term))return false;
   return true;
  });
  const key=orders.some(([k])=>k===filters.sort)?filters.sort:'descricao';
  const direction=filters.direction==='desc'?-1:1;
  const collator=new Intl.Collator('pt-BR',{numeric:true,sensitivity:'base'});
  const original=rows.map((row,index)=>({row,index}));
  original.sort((a,b)=>{
   const x=a.row[key],y=b.row[key];
   const invalidX=x==null,invalidY=y==null;
   if(invalidX!==invalidY)return invalidX?1:-1; // Custo não informado sempre ao final.
   const comparison=typeof x==='number'&&typeof y==='number'?x-y:collator.compare(String(x||''),String(y||''));
   return comparison*direction||a.index-b.index;
  });
  const ordered=original.map(x=>x.row);
  const total=Math.round(ordered.reduce((s,row)=>s+(row.valorTotal??0),0)*100)/100;
  const missingCost=ordered.filter(row=>row.valorUnitario===null).length;
  const zeroCost=ordered.filter(row=>row.valorUnitario===0&&row.saldo>0).length;
  const missingBalance=ordered.filter(row=>!row.saldoValido).length;
  return {rows:ordered,total,missingCost,zeroCost,missingBalance,items:ordered.length,
   filters:{...filters},date:new Date().toLocaleString('pt-BR')};
 }
 function categoryChoices(data){
  return [...new Set(records(data).map(x=>x.categoria).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
 }
 const fmtQty=n=>Number(n||0).toLocaleString('pt-BR',{maximumFractionDigits:3});
 const moneyOrPending=n=>n===null?'A cotar':money(n);
 function options(rows,value){
  return rows.map(([k,label])=>'<option value="'+escape(k)+'"'+(k===value?' selected':'')+'>'+escape(label)+'</option>').join('');
 }
 function panel(){
  const report=compute(db);
  const cats=categoryChoices(db);
  const rows=report.rows.slice(0,LIMIT).map(item=>td(
   '<strong>'+escape(item.descricao)+'</strong>'+(item.codigo?'<div class="muted small">Código: '+escape(item.codigo)+'</div>':''),
   escape(item.unidade),
   fmtQty(item.saldo),
   moneyOrPending(item.valorUnitario),
   moneyOrPending(item.valorTotal)
  ));
  return '<section class="panel ua-stock-report" id="uaStockReport">'+
   '<div class="panel-head"><div><h3>Relatório de produtos em estoque</h3>'+
   '<p class="muted small">Posição atual das matérias-primas cadastradas, por custo unitário. Não altera o estoque.</p></div>'+
   '<div class="actions"><button type="button" class="btn" id="uaStockPrint">Imprimir / PDF</button>'+
   '<button type="button" class="btn" id="uaStockCsv">Exportar CSV</button>'+
   '<button type="button" class="btn primary" id="uaStockXlsx"'+(busy?' disabled':'')+'>Exportar Excel</button></div></div>'+
   '<div class="ua-stock-filters">'+
    '<label>Pesquisar produto<input id="uaStockSearch" type="search" maxlength="160" value="'+escape(state.query)+'" placeholder="Descrição ou código"></label>'+
    '<label>Saldo<select id="uaStockBalance">'+options([['positivo','Somente com saldo'],['todos','Todos os cadastrados'],['zerado','Saldo zero']],state.stock)+'</select></label>'+
    '<label>Categoria<select id="uaStockCategory">'+options([['','Todas as categorias'],...cats.map(x=>[x,x])],state.category)+'</select></label>'+
    '<label>Ordenar por<select id="uaStockSort">'+options(orders,state.sort)+'</select></label>'+
    '<button type="button" class="btn ua-stock-dir" id="uaStockDirection" title="Inverter ordem de visualização">'+
     (state.direction==='asc'?'↑ Crescente':'↓ Decrescente')+'</button>'+
   '</div>'+
   '<div class="ua-stock-summary">'+
    '<div><span>Produtos relacionados</span><strong>'+report.items+'</strong></div>'+
    '<div><span>Valor total do estoque filtrado</span><strong>'+money(report.total)+'</strong></div>'+
    '<div><span>Sem custo informado</span><strong>'+report.missingCost+'</strong></div></div>'+
   '<div class="ua-stock-table">'+
    table(['Descrição do item','Unidade','Saldo em estoque','Valor unitário','Valor total'],rows,'Nenhuma matéria-prima encontrada para os filtros selecionados.')+
   '</div>'+
   '<p class="ua-stock-note">Atualizado em '+escape(report.date)+'. Os valores usam o <strong>custo unitário</strong> cadastrado, não o preço de venda. '+
    (report.rows.length>LIMIT?'Mostrando '+LIMIT+' de '+report.rows.length+' produtos na tela; exportações incluem todos os filtrados. ':'')+
    (report.missingCost?'Há '+report.missingCost+' material(is) sem custo cadastrado; o total não inclui sua avaliação. ':'')+
    (report.zeroCost?'Há '+report.zeroCost+' material(is) com custo R$ 0,00; confira os cadastros. ':'')+
    (report.missingBalance?'Há '+report.missingBalance+' saldo(s) não informado(s), apresentados como zero. ':'')+
    'Os saldos não são somados entre unidades diferentes. Produtos acabados sem estoque físico não entram neste relatório.</p>'+
   '</section>';
 }
 function csvCell(value){
  let s=String(value??'');
  if(/^\s*[=+@]/.test(s)||/^\s*-(?!\d)/.test(s))s="'"+s;
  return '"'+s.replace(/"/g,'""')+'"';
 }
 function buildCsv(result){
  const head=['Descrição do item','Unidade','Saldo em estoque','Valor unitário (R$)','Valor total (R$)'];
  const lines=[head,...result.rows.map(x=>[x.descricao,x.unidade,fmtQty(x.saldo),
   x.valorUnitario===null?'A cotar':x.valorUnitario.toFixed(2).replace('.',','),
   x.valorTotal===null?'A cotar':x.valorTotal.toFixed(2).replace('.',',')])];
  return '\ufeff'+lines.map(line=>line.map(csvCell).join(';')).join('\r\n');
 }
 function exportCsv(){
  const res=compute(db);
  if(res.items>MAX_EXPORT)return alert('O resultado tem mais de 15.000 linhas. Restrinja os filtros antes de exportar.');
  download('oficina-estoque-'+iso()+'.csv',buildCsv(res),'text/csv;charset=utf-8');
 }
 function ensureExcel(){
  if(window.ExcelJS?.Workbook)return Promise.resolve(window.ExcelJS);
  if(excelPromise)return excelPromise;
  excelPromise=new Promise((resolve,reject)=>{
   const script=document.createElement('script');
   script.src='https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js';
   script.referrerPolicy='no-referrer';script.crossOrigin='anonymous';
   script.onload=()=>window.ExcelJS?.Workbook?resolve(window.ExcelJS):reject(Error('Excel não disponível.'));
   script.onerror=()=>reject(Error('Não foi possível carregar o gerador Excel. Confira sua conexão.'));
   document.head.appendChild(script);
  }).catch(e=>{excelPromise=null;throw e});
  return excelPromise;
 }
 function workbook(ExcelJS,result){
  const wb=new ExcelJS.Workbook();
  wb.creator='UNIVERSA ART — OFICINA';wb.title='Relatório de produtos em estoque';
  const sheet=wb.addWorksheet('Produtos em estoque');
  sheet.columns=[
   {header:'Descrição do item',key:'descricao',width:50},
   {header:'Unidade',key:'unidade',width:15},
   {header:'Saldo em estoque',key:'saldo',width:21},
   {header:'Valor unitário (R$)',key:'unitario',width:22},
   {header:'Valor total (R$)',key:'total',width:22}
  ];
  sheet.getRow(1).height=30;
  sheet.getRow(1).eachCell(cell=>{
   cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF193D30'}};
   cell.font={bold:true,color:{argb:'FFFFFFFF'}};
   cell.alignment={vertical:'middle'};
  });
  sheet.views=[{state:'frozen',ySplit:1}];
  sheet.autoFilter={from:'A1',to:'E1'};
  for(const item of result.rows){
   const row=sheet.addRow({descricao:String(item.descricao).replace(/^\s*([=+@]|-(?!\d))/,"'$1"),
    unidade:item.unidade,saldo:item.saldo,unitario:item.valorUnitario,total:item.valorTotal});
   row.getCell(3).numFmt='#,##0.###';row.getCell(4).numFmt=moneyCell;row.getCell(5).numFmt=moneyCell;
   if(row.number%2===0)row.eachCell(cell=>{cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF5F9F5'}}});
  }
  const totalRow=sheet.addRow({descricao:'TOTAL AVALIADO',total:result.total});
  totalRow.font={bold:true,color:{argb:'FF193D30'}};
  totalRow.getCell(5).numFmt=moneyCell;
  const sum=wb.addWorksheet('Resumo');
  sum.columns=[{width:38},{width:35}];
  for(const [k,v] of [
   ['UNIVERSA ART — RELATÓRIO DE ESTOQUE',''],['Emitido em',result.date],
   ['Filtro de saldo',result.filters.stock==='positivo'?'Somente com saldo':result.filters.stock==='zerado'?'Saldo zero':'Todos'],
   ['Categoria',result.filters.category||'Todas'],['Pesquisa',result.filters.query||'—'],
   ['Ordenado por',orders.find(x=>x[0]===result.filters.sort)?.[1]||'Descrição'],
   ['Sentido',result.filters.direction==='asc'?'Crescente':'Decrescente'],
   ['Produtos relacionados',result.items],['Sem custo informado',result.missingCost],
   ['Com custo zero',result.zeroCost],['Valor total avaliado (R$)',result.total],
   ['Observação','Custos de compra cadastrados. Sem custo, o item não integra o total.']
  ]){const row=sum.addRow([k,v]);if(row.number===1){row.font={bold:true,size:14,color:{argb:'FF193D30'}}}}
  sum.getCell('B11').numFmt=moneyCell;
  sum.getColumn(2).alignment={wrapText:true};
  return wb;
 }
 async function exportExcel(){
  if(busy)return false;
  const report=compute(db);
  if(report.items>MAX_EXPORT)throw Error('Máximo de 15.000 linhas. Use os filtros para reduzir o relatório.');
  busy=true;
  const button=content.querySelector('#uaStockXlsx');if(button){button.disabled=true;button.textContent='Gerando Excel...'}
  try{
   const ExcelJS=await ensureExcel();
   const data=await workbook(ExcelJS,report).xlsx.writeBuffer();
   const blob=new Blob([data],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
   const url=URL.createObjectURL(blob);
   const a=document.createElement('a');a.href=url;a.download='oficina-relatorio-estoque-'+iso()+'.xlsx';
   document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
   return true;
  }finally{busy=false;if(button?.isConnected){button.disabled=false;button.textContent='Exportar Excel'}}
 }
 function print(){
  const r=compute(db);
  const lines=r.rows.map(x=>td(escape(x.descricao),escape(x.unidade),fmtQty(x.saldo),
   moneyOrPending(x.valorUnitario),moneyOrPending(x.valorTotal)));
  openPrint('Produtos em estoque — UNIVERSA ART',
   '<p>Emissão: '+escape(r.date)+' · '+r.items+' produto(s) · Total avaliado: '+money(r.total)+'</p>'+
   table(['Descrição do item','Unidade','Saldo em estoque','Valor unitário','Valor total'],lines,'Nenhum produto.')+
   '<p style="font-size:11px">Avaliação pelo custo cadastrado. '+r.missingCost+' material(is) sem custo não entram no total.</p>');
 }
 function bind(container){
  const root=container.querySelector('#uaStockReport');if(!root)return;
  function refresh(focus=false){
   root.outerHTML=panel();bind(container);
   if(focus){const box=container.querySelector('#uaStockSearch');box?.focus();const n=box?.value?.length||0;box?.setSelectionRange(n,n)}
  }
  const search=root.querySelector('#uaStockSearch');
  search?.addEventListener('input',()=>{state.query=search.value;refresh(true)});
  for(const [id,k] of [['uaStockBalance','stock'],['uaStockCategory','category'],['uaStockSort','sort']]){
   root.querySelector('#'+id)?.addEventListener('change',e=>{state[k]=e.target.value;refresh()});
  }
  root.querySelector('#uaStockDirection')?.addEventListener('click',()=>{
   state.direction=state.direction==='asc'?'desc':'asc';refresh();
  });
  root.querySelector('#uaStockCsv')?.addEventListener('click',exportCsv);
  root.querySelector('#uaStockPrint')?.addEventListener('click',print);
  root.querySelector('#uaStockXlsx')?.addEventListener('click',()=>exportExcel().catch(e=>alert(e.message||'Não foi possível exportar Excel.')));
 }
 window.universaArtRelatorioEstoque={state,compute,records,panel,bind,buildCsv,workbook,exportCsv,exportExcel,print};
})();