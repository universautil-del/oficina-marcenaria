'use strict';
/* UNIVERSA ART — Kardex por matéria-prima, exclusivamente leitura.
   Movimentos existentes registram data sem horário e não registram saldo anterior.
   Por isso, os saldos exibidos são reconstituídos a partir do estoque atual e dos deltas salvos,
   nunca declarados como comprovantes históricos independentes. */
(function(){
 const PAGE=50,MAX_EXPORT=25000;
 const state={productId:'',direction:'desc',shown:PAGE};
 let busy=false,excelPromise=null;
 const number=value=>{
  if(value===null||value===undefined||String(value).trim()==='')return null;
  const n=Number(value);return Number.isFinite(n)?n:null;
 };
 const qty=n=>Number(n||0).toLocaleString('pt-BR',{maximumFractionDigits:3});
 const three=n=>Math.round(n*1000)/1000;
 const escape=x=>esc(x);
 const text=x=>String(x??'').trim();
 const moneyLabel=n=>n===null?'Não informado':money(n);
 function products(data=db){
  return (Array.isArray(data?.products)?data.products:[])
   .filter(p=>p&&p.tipo==='materia')
   .slice()
   .sort((a,b)=>String(a.nome||'').localeCompare(String(b.nome||''),'pt-BR',{numeric:true,sensitivity:'base'}));
 }
 function kind(m,delta){
  const note=text(m.note).toLowerCase();
  if(/estoque inicial/.test(note))return 'Estoque inicial';
  if(/ajuste|correção|correcao/.test(note))return 'Ajuste';
  if(m.purchaseId)return 'Entrada por compra';
  if(m.orderId)return 'Saída para produção';
  if(delta>0)return 'Entrada';
  if(delta<0)return 'Saída';
  return 'Movimento';
 }
 function origin(m,data){
  if(m.purchaseId){
   const purchase=(data.purchases||[]).find(x=>String(x.id)===String(m.purchaseId));
   return purchase?.number!=null?'Entrada de materiais #'+purchase.number:'Entrada de materiais (registro vinculado)';
  }
  if(m.orderId){
   const order=(data.orders||[]).find(x=>String(x.id)===String(m.orderId));
   return order?.controlCode|| (order?.number!=null?'Pedido #'+order.number:'Pedido (registro vinculado)');
  }
  return 'Movimento manual / cadastro';
 }
 function build(data=db,productId=state.productId,direction=state.direction){
  const chosen=products(data).find(p=>String(p.id)===String(productId));
  if(!chosen)return null;
  const all=Array.isArray(data.stockMovements)?data.stockMovements:[];
  const selected=all.map((m,index)=>({m,index})).filter(x=>x.m&&String(x.m.productId)===String(chosen.id));
  const current=number(chosen.estoque);
  const bad=selected.some(x=>number(x.m.delta)===null);
  const sum=selected.reduce((n,x)=>n+(number(x.m.delta)??0),0);
  const opening=current===null||bad?null:three(current-sum);
  let running=opening;
  const chronological=selected.map(({m,index},position)=>{
   const delta=number(m.delta);
   running=running===null||delta===null?null:three(running+delta);
   return {
    index,indexLabel:position+1,date:text(m.date),type:kind(m,delta),
    reference:origin(m,data),note:text(m.note)||'Sem observações',
    delta,entry:delta!==null&&delta>0?delta:0,
    exit:delta!==null&&delta<0?-delta:0,
    after:running,valid:delta!==null
   };
  });
  const moves=direction==='asc'?chronological:chronological.slice().reverse();
  return {
   product:{id:String(chosen.id),code:text(chosen.codigo),name:text(chosen.nome)||'Sem descrição',
    unit:text(chosen.unidade)||'un',category:text(chosen.categoria)||'Sem categoria',
    current,min:number(chosen.minimo),max:number(chosen.maximo),buy:number(chosen.custo)},
   movements:moves,opening,bad,count:moves.length,
   entry:three(chronological.reduce((s,x)=>s+x.entry,0)),
   exit:three(chronological.reduce((s,x)=>s+x.exit,0)),
   reconstructed:opening!==null&&current!==null&&!bad,
   generated:new Date().toLocaleString('pt-BR')
  };
 }
 function options(items,selected){
  return items.map(([value,label])=>'<option value="'+escape(value)+'"'+(String(value)===String(selected)?' selected':'')+'>'+escape(label)+'</option>').join('');
 }
 function header(report){
  const p=report.product;
  return '<div class="ua-kardex-header">'+
   '<div><span>Descrição do item</span><strong>'+escape(p.name)+'</strong><small>Código '+escape(p.code||'Não informado')+'</small></div>'+
   '<div><span>Unidade</span><strong>'+escape(p.unit)+'</strong></div>'+
   '<div><span>Categoria</span><strong>'+escape(p.category)+'</strong></div>'+
   '<div><span>Estoque atual</span><strong>'+ (p.current===null?'Não informado':qty(p.current))+'</strong></div>'+
   '<div><span>Estoque mínimo</span><strong>'+(p.min===null?'Não informado':qty(p.min))+'</strong></div>'+
   '<div><span>Estoque máximo</span><strong>'+(p.max===null?'Não definido':qty(p.max))+'</strong></div>'+
   '<div><span>Valor de compra</span><strong>'+moneyLabel(p.buy)+'</strong><small>Custo unitário atual</small></div>'+
   '</div>';
 }
 function grid(report,rows=report.movements){
  return table(
   ['Registro','Data','Movimentação','Documento','Histórico / Motivo','Entrada','Saída','Saldo após*'],
   rows.map(m=>td(
    String(m.indexLabel),m.date?escape(date(m.date)):'Não informada',
    escape(m.type),escape(m.reference),escape(m.note),
    m.valid?qty(m.entry):'—',m.valid?qty(m.exit):'—',
    m.after===null?'—':qty(m.after)
   )),
   'Nenhuma movimentação registrada para este produto.'
  );
 }
 function panel(){
  const raw=products(),selected=raw.find(p=>String(p.id)===String(state.productId));
  // Não persistir a escolha: seleção padrão só serve à visualização.
  if(!selected)state.productId=raw[0]?String(raw[0].id):'';
  const report=build(db);
  return '<section class="panel ua-kardex" id="uaKardex">'+
   '<div class="panel-head"><div><h3>Kardex de produtos</h3>'+
    '<p class="muted small">Ficha individual e histórico de entradas, saídas e ajustes registrados no OFICINA.</p></div>'+
    '<div class="actions"><button class="btn" type="button" id="uaKardexPrint"'+(!report?' disabled':'')+'>Imprimir / PDF</button>'+
    '<button class="btn" type="button" id="uaKardexCsv"'+(!report?' disabled':'')+'>Exportar CSV</button>'+
    '<button class="btn primary" type="button" id="uaKardexExcel"'+(!report||busy?' disabled':'')+'>Exportar Excel</button></div></div>'+
   '<div class="ua-kardex-controls">'+
   '<label>Selecionar produto<select id="uaKardexProduct" aria-label="Produto do Kardex">'+
    (raw.length?options(raw.map(p=>[p.id,(p.codigo?p.codigo+' · ':'')+p.nome]),state.productId):'<option value="">Nenhum produto cadastrado</option>')+
    '</select></label>'+
   '<label>Ordem das movimentações<select id="uaKardexOrder">'+
    options([['desc','Mais recentes primeiro'],['asc','Mais antigas primeiro']],state.direction)+'</select></label></div>'+
   (report?header(report)+
    '<div class="ua-kardex-summary"><strong>'+report.count+' movimentação(ões) registrada(s)</strong>'+
    '<span>Total de entradas: '+qty(report.entry)+' '+escape(report.product.unit)+'</span>'+
    '<span>Total de saídas: '+qty(report.exit)+' '+escape(report.product.unit)+'</span></div>'+
    '<div class="ua-kardex-grid">'+grid(report,report.movements.slice(0,state.shown))+'</div>'+
    (report.count>state.shown?'<div class="ua-kardex-more"><button class="btn" type="button" id="uaKardexMore">Mostrar mais 50 movimentos</button><span>Exibindo '+state.shown+' de '+report.count+'</span></div>':'')+
    '<p class="ua-kardex-note">* Saldo após: <strong>reconstituído</strong> a partir do saldo atual e das movimentações disponíveis. '+
      'Registros antigos podem não conter todas as movimentações ou horário. A ordem segue a sequência de gravação, não o horário da operação. '+
      (report.bad?'Há movimentação com quantidade inválida: saldo após não calculado. ':'')+
      (report.reconstructed&&report.opening!==0?'Saldo anterior às movimentações disponíveis (inferido): '+qty(report.opening)+' '+escape(report.product.unit)+'. ':'')+
      'O valor de compra é o custo unitário atual do cadastro, não o preço histórico de cada movimentação. '+
      'Reservas de pedidos não são saídas até a baixa para produção.</p>'
    :'<p class="empty">Cadastre uma matéria-prima em Produtos para consultar o Kardex.</p>')+
   '</section>';
 }
 function csvSafe(s){
  let value=String(s??'');
  if(/^\s*[=+@]/.test(value)||/^\s*-(?!\d)/.test(value))value="'"+value;
  return '"'+value.replace(/"/g,'""')+'"';
 }
 function csv(report){
  const fields=[
   ['Kardex UNIVERSA ART',''],
   ['Produto',report.product.name],['Código',report.product.code],
   ['Unidade',report.product.unit],['Categoria',report.product.category],
   ['Estoque atual',report.product.current??'Não informado'],
   ['Estoque mínimo',report.product.min??'Não informado'],
   ['Estoque máximo',report.product.max??'Não definido'],
   ['Valor de compra (custo unitário atual)',report.product.buy??'Não informado'],
   ['Nota','Saldos reconstituídos; não são saldos históricos auditados.'],
   [],['Registro','Data','Movimentação','Documento','Histórico','Entrada','Saída','Saldo após reconstituído']
  ];
  for(const m of report.movements)fields.push([m.indexLabel,m.date,m.type,m.reference,m.note,
   m.valid?m.entry:'',m.valid?m.exit:'',m.after??'']);
  return '\ufeff'+fields.map(row=>row.map(csvSafe).join(';')).join('\r\n');
 }
 function exportCsv(){
  const report=build(db);
  if(!report)return alert('Selecione um produto.');
  if(report.count>MAX_EXPORT)return alert('Exportação limitada a 25.000 movimentos por segurança.');
  download('oficina-kardex-'+report.product.code+'-'+iso()+'.csv',csv(report),'text/csv;charset=utf-8');
 }
 function ensureExcel(){
  if(window.ExcelJS?.Workbook)return Promise.resolve(window.ExcelJS);
  if(excelPromise)return excelPromise;
  excelPromise=new Promise((resolve,reject)=>{
   const script=document.createElement('script');
   script.src='https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js';
   script.referrerPolicy='no-referrer';script.crossOrigin='anonymous';
   script.onload=()=>window.ExcelJS?.Workbook?resolve(window.ExcelJS):reject(Error('Biblioteca Excel indisponível.'));
   script.onerror=()=>reject(Error('Não foi possível carregar o Excel. Verifique a conexão.'));
   document.head.appendChild(script);
  }).catch(err=>{excelPromise=null;throw err});
  return excelPromise;
 }
 function workbook(ExcelJS,report){
  const wb=new ExcelJS.Workbook();
  wb.creator='UNIVERSA ART';wb.title='Kardex de '+report.product.name;
  const sheet=wb.addWorksheet('Kardex');
  sheet.columns=[
   {header:'Registro',key:'index',width:12},{header:'Data',key:'date',width:18},
   {header:'Movimentação',key:'type',width:22},{header:'Documento',key:'ref',width:30},
   {header:'Histórico / Motivo',key:'note',width:50},
   {header:'Entrada',key:'entry',width:17},{header:'Saída',key:'exit',width:17},
   {header:'Saldo após reconstituído',key:'after',width:26}
  ];
  sheet.views=[{state:'frozen',ySplit:1}];
  sheet.autoFilter={from:'A1',to:'H1'};
  sheet.getRow(1).eachCell(c=>{
   c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF193D30'}};
   c.font={color:{argb:'FFFFFFFF'},bold:true};
  });
  const clean=s=>String(s??'').replace(/^\s*([=+@]|-(?!\d))/,"'$1");
  for(const m of report.movements){
   const row=sheet.addRow({
    index:m.indexLabel,date:m.date,type:clean(m.type),ref:clean(m.reference),note:clean(m.note),
    entry:m.valid?m.entry:null,exit:m.valid?m.exit:null,after:m.after
   });
   for(const col of ['F','G','H'])row.getCell(col).numFmt='#,##0.###';
  }
  const summary=wb.addWorksheet('Ficha do produto');
  summary.columns=[{header:'Campo',key:'field',width:42},{header:'Valor',key:'value',width:55}];
  for(const [field,value] of [
   ['Descrição do item',report.product.name],['Código',report.product.code],
   ['Unidade',report.product.unit],['Categoria',report.product.category],
   ['Estoque atual',report.product.current??'Não informado'],['Estoque mínimo',report.product.min??'Não informado'],
   ['Estoque máximo',report.product.max??'Não definido'],['Valor de compra (custo atual)',report.product.buy??'Não informado'],
   ['Quantidade de movimentos',report.count],
   ['Saldo anterior inferido',report.opening??'Não reconstituível'],
   ['Observação','Saldos reconstituídos com movimentos disponíveis. Datas antigas podem não ter horário.']
  ])summary.addRow({field:clean(field),value:typeof value==='string'?clean(value):value});
  summary.getCell('B9').numFmt='"R$" #,##0.00';
  return wb;
 }
 async function exportExcel(){
  if(busy)return;
  const report=build(db);
  if(!report)return alert('Selecione um produto.');
  if(report.count>MAX_EXPORT)return alert('Exportação limitada a 25.000 movimentos.');
  busy=true;
  const button=content.querySelector('#uaKardexExcel');
  if(button){button.disabled=true;button.textContent='Gerando Excel...'}
  try{
   const ExcelJS=await ensureExcel();
   const bytes=await workbook(ExcelJS,report).xlsx.writeBuffer();
   const blob=new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
   const url=URL.createObjectURL(blob);
   const a=document.createElement('a');a.href=url;a.download='oficina-kardex-'+report.product.code+'-'+iso()+'.xlsx';
   document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
  }catch(err){alert('Falha ao exportar Excel: '+String(err.message||err))}
  finally{busy=false;if(button?.isConnected){button.disabled=false;button.textContent='Exportar Excel'}}
 }
 function printReport(){
  const report=build(db);if(!report)return alert('Selecione um produto.');
  const p=report.product;
  const summary='<p><strong>'+escape(p.name)+'</strong> · '+escape(p.code)+' · '+escape(p.unit)+' · Categoria: '+escape(p.category)+'</p>'+
   '<p>Saldo: '+(p.current===null?'Não informado':qty(p.current))+' · Mínimo: '+(p.min===null?'Não informado':qty(p.min))+
   ' · Estoque máximo: '+(p.max===null?'Não definido':qty(p.max))+' · Valor de compra: '+moneyLabel(p.buy)+'</p>';
  openPrint('Kardex — UNIVERSA ART',summary+grid(report)+
   '<p style="font-size:11px">Saldos reconstituídos com base no estoque atual e movimentos registrados. '+report.count+' movimento(s).</p>');
 }
 function bind(host){
  const root=host.querySelector('#uaKardex');if(!root)return;
  function refresh(){root.outerHTML=panel();bind(host)}
  root.querySelector('#uaKardexProduct')?.addEventListener('change',event=>{
   state.productId=event.target.value;state.shown=PAGE;refresh();
  });
  root.querySelector('#uaKardexOrder')?.addEventListener('change',event=>{
   state.direction=event.target.value;state.shown=PAGE;refresh();
  });
  root.querySelector('#uaKardexMore')?.addEventListener('click',()=>{
   state.shown+=PAGE;refresh();
  });
  root.querySelector('#uaKardexCsv')?.addEventListener('click',exportCsv);
  root.querySelector('#uaKardexPrint')?.addEventListener('click',printReport);
  root.querySelector('#uaKardexExcel')?.addEventListener('click',exportExcel);
 }
 function selectProduct(pid){
  state.productId=String(pid||'');state.shown=PAGE;
  if(location.hash==='#relatorios')render('relatorios');
  else location.hash='relatorios';
 }
 window.universaArtKardex={state,products,build,panel,bind,selectProduct,csv,workbook,exportCsv,exportExcel,printReport,PAGE};
})();