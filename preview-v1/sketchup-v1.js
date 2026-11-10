'use strict';
/* UNIVERSALARTES 1.0 — Importador SketchUp / OpenCutList, cálculo preliminar no navegador.
   CSV de peças, não interpreta .skp. Não grava em estoque, financeiro ou pedidos. */
(function(){
 const state={file:'',headers:[],raw:[],map:{},parts:[],settings:{},efficiency:80,edgePrice:0,hardware:0,labor:0,install:0,delivery:0,margin:25,error:'',note:'',separator:';'};
 const fields=[
  ['name','Peça / Designação',true],
  ['code','Código da peça',false],
  ['length','Comprimento (mm)',true],
  ['width','Largura (mm)',true],
  ['thickness','Espessura (mm)',false],
  ['qty','Quantidade',false],
  ['material','Material',false],
  ['edge','Fita de borda por peça (m)',false]
 ];
 const aliases={
  name:['peca','nome','designacao','designation','partname','piece','descricao','description','label'],
  code:['part','part#','part number','partno','codigo','codigopeca','code'],
  length:['comprimento','length','longueur','cuttinglength','final length','lengthmm'],
  width:['largura','width','largeur','cuttingwidth','final width','widthmm'],
  thickness:['espessura','thickness','epaisseur','thick','thicknessmm'],
  qty:['quantidade','quantity','qty','qtd','count','number','nb','parts count'],
  material:['material','materiau','materialname','wood'],
  edge:['fitam','fita de borda m','edgem','edgelen','edge length m','edgebandinglengthm']
 };
 const clean=s=>String(s??'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\(mm\)|\[mm\]|_mm\b/g,' mm').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
 const compact=s=>clean(s).replace(/\s+/g,'');
 const safe=s=>typeof esc==='function'?esc(s):String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
 const format=(n,d=2)=>Number(n).toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d});
 const cash=n=>Number(n).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
 const fmtMm=n=>format(n,Number.isInteger(n)?0:2)+' mm';
 const positive=(v,label,allowZero=false)=>{
  let s=String(v??'').trim().replace(/\s/g,'');
  if(!s && allowZero)return 0;
  s=s.replace(/mm$/i,'');
  if(!s||/[^\d,.\-]/.test(s))throw Error(label+': informe número em milímetros, sem polegadas ou unidades diferentes.');
  if(s.includes(',')&&s.includes('.'))s=s.replace(/\./g,'').replace(',','.');
  else if(s.includes(','))s=s.replace(',','.');
  else if(/^\d{1,3}(?:\.\d{3})+$/.test(s))s=s.replace(/\./g,'');
  const n=Number(s);
  if(!Number.isFinite(n)||n<0||(!allowZero&&n===0)||n>10000000)throw Error(label+': valor inválido.');
  return n;
 };
 function firstLine(text){
  let quote=false,line='';
  for(let i=0;i<text.length;i++){
   const c=text[i];
   if(c==='"'){
    if(quote&&text[i+1]==='"'){line+='""';i++;continue}
    quote=!quote;
   }
   if(!quote&&(c==='\n'||c==='\r'))break;
   line+=c;
  }
  return line;
 }
 function detectSep(text){
  // OpenCutList pode iniciar com "Components" antes do cabeçalho real.
  const lines=String(text).replace(/^\ufeff/,'').split(/\r?\n/).filter(l=>l.trim()).slice(0,15);
  const candidates=[';','\t',','];
  const count=(line,sep)=>{
   let quoted=false,n=0;
   for(let i=0;i<line.length;i++){
    const c=line[i];
    if(c==='"'&&quoted&&line[i+1]==='"'){i++;continue}
    if(c==='"'){quoted=!quoted;continue}
    if(!quoted&&c===sep)n++;
   }
   return n;
  };
  const best=candidates.map(sep=>({sep,n:Math.max(0,...lines.map(l=>count(l,sep)))}))
   .sort((a,b)=>b.n-a.n)[0];
  if(!best||best.n<2)throw Error('Não encontrei colunas separadas. O arquivo OpenCutList deve ser CSV com ;, tabulação ou vírgula.');
  return best.sep;
 }
 function parseCSV(text,sep){
  const rows=[];let row=[],item='',quoted=false;
  const add=()=>{row.push(item);item='';if(row.some(c=>c.trim()))rows.push(row);row=[];if(rows.length>5001)throw Error('Planilha grande demais (máximo 5.000 peças/linhas).')};
  for(let i=0;i<text.length;i++){
   const c=text[i];
   if(quoted){
    if(c==='"'){if(text[i+1]==='"'){item+='"';i++}else quoted=false}
    else item+=c;
   }else if(c==='"'){quoted=true}
   else if(c===sep){row.push(item);item=''}
   else if(c==='\r'||c==='\n'){if(c==='\r'&&text[i+1]==='\n')i++;add()}
   else item+=c;
  }
  if(quoted)throw Error('CSV inválido: aspas sem fechamento.');
  if(row.length||item)add();
  return rows;
 }
 function guess(headers,field){
  const options=aliases[field];
  let match=headers.findIndex(h=>options.includes(compact(h)));
  if(match<0)match=headers.findIndex(h=>options.some(a=>compact(h).startsWith(compact(a))));
  return match;
 }
 function mapping(){
  state.map={};
  for(const [field] of fields)state.map[field]=guess(state.headers,field);
 }
 function get(row,field){const i=state.map[field];return i>=0?String(row[i]??'').trim():''}
 function makeParts(){
  for(const [field,label,required] of fields)if(required&&state.map[field]<0)throw Error('Selecione a coluna '+label+' antes de calcular.');
  const list=[];
  for(let i=0;i<state.raw.length;i++){
   const row=state.raw[i];if(!row.some(v=>String(v??'').trim()))continue;
   const name=get(row,'name')||'Peça '+(i+1);
   const length=positive(get(row,'length'),'Linha '+(i+2)+': comprimento');
   const width=positive(get(row,'width'),'Linha '+(i+2)+': largura');
   const t=get(row,'thickness');
   const thickness=t?positive(t,'Linha '+(i+2)+': espessura'):0;
   const q=get(row,'qty');const qty=q?positive(q,'Linha '+(i+2)+': quantidade'):1;
   if(!Number.isInteger(qty)||qty>100000)throw Error('Quantidade inteira inválida na linha '+(i+2));
   const ed=get(row,'edge');const edge=ed?positive(ed,'Linha '+(i+2)+': fita por peça (m)',true):0;
   if(edge>1000)throw Error('Fita por peça muito alta na linha '+(i+2)+'. Confira se está em metros.');
   const material=get(row,'material'),unspecified=!material||/^(not assigned|unassigned|nao atribuido|sem material)$/i.test(material);
   list.push({code:get(row,'code'),name,length,width,thickness,qty,edge,material:unspecified?'Material não definido':material});
  }
  if(!list.length)throw Error('Nenhuma peça válida foi encontrada no CSV.');
  return list;
 }
 function groups(){
  const map=new Map();
  state.parts.forEach(p=>{
   const key=p.material+'|'+p.thickness;
   if(!map.has(key))map.set(key,{key,material:p.material,thickness:p.thickness,area:0,parts:0,rows:[],edge:0});
   const g=map.get(key);
   g.area+=p.length*p.width*p.qty/1e6;g.parts+=p.qty;g.edge+=p.edge*p.qty;g.rows.push(p);
  });
  return [...map.values()];
 }
 function groupCfg(key){
  if(!state.settings[key])state.settings[key]={boardLength:2750,boardWidth:1850,boardPrice:0};
  return state.settings[key];
 }
 function calculated(){
  const gs=groups(),eff=state.efficiency/100;
  let sheets=0,matcost=0,area=0,band=0,bad=[];
  const result=gs.map(g=>{
   const cfg=groupCfg(g.key);
   const sheetArea=cfg.boardLength*cfg.boardWidth/1e6;
   const oversize=g.rows.filter(p=>!((p.length<=cfg.boardLength&&p.width<=cfg.boardWidth)||(p.width<=cfg.boardLength&&p.length<=cfg.boardWidth)));
   const count=Math.ceil(g.area/(sheetArea*eff)-1e-9);
   const cost=count*cfg.boardPrice;
   if(oversize.length)bad.push(g.material+': '+oversize.length+' peça(s) não cabem na chapa informada.');
   if(g.thickness<=0)bad.push(g.material+': espessura não informada.');
   if(g.material==='Material não definido'||g.material==='Material não identificado')bad.push('Material não definido no SketchUp: selecione o MDF correto antes de usar orçamento/compra.');
   if(cfg.boardPrice===0)bad.push(g.material+': preço da chapa não informado.');
   sheets+=count;matcost+=cost;area+=g.area;band+=g.edge;
   return {...g,sheetArea,count,cost,oversize:oversize.length,cfg};
  });
  const edgeCost=band*state.edgePrice;
  const cost=matcost+edgeCost+state.hardware+state.labor+state.install+state.delivery;
  const price=cost/(1-state.margin/100);
  return {result,sheets,area,band,matcost,edgeCost,cost,price,profit:price-cost,bad};
 }
 function mappingHTML(){
  if(!state.raw.length)return '';
  const options=(field)=>'<option value="-1">Não informado / escolher</option>'+state.headers.map((h,i)=>'<option value="'+i+'" '+(state.map[field]===i?'selected':'')+'>'+safe(h||'Coluna '+(i+1))+'</option>').join('');
  return '<section class="ua-section gap-top"><h3>2. Conferir as colunas</h3><p class="muted">Confira as colunas do Excel ou CSV. Todas as medidas das peças devem estar em milímetros.</p><div class="ua-mapping">'+fields.map(([key,label,required])=>'<label>'+safe(label)+(required?' *':'')+'<select data-ua-map="'+key+'">'+options(key)+'</select></label>').join('')+'</div>'+
    '<div class="actions gap-top"><button class="btn primary" type="button" data-ua-skp="calculate">Ler peças e calcular</button><button class="btn" type="button" data-ua-skp="reset">Limpar importação</button></div></section>';
 }
 function summaryHTML(){
  if(!state.parts.length)return '';
  const gs=groups();const res=calculated();
  const groupHtml=gs.map(g=>{
   const cfg=groupCfg(g.key);
   const calculate=res.result.find(x=>x.key===g.key);
   return '<div class="ua-skp-material"><h4>'+safe(g.material)+' <span>· '+safe(g.thickness?fmtMm(g.thickness):'Espessura pendente')+'</span></h4>'+
    '<p class="muted">'+g.parts+' peça(s) · '+format(g.area,3)+' m² · '+format(g.edge,2)+' m de fita informados</p>'+
    '<div class="ua-skp-settings">'+
    '<label>Chapa: comprimento (mm)<input type="number" min="1" step="1" data-ua-group="'+safe(g.key)+'" data-ua-param="boardLength" value="'+cfg.boardLength+'"></label>'+
    '<label>Chapa: largura (mm)<input type="number" min="1" step="1" data-ua-group="'+safe(g.key)+'" data-ua-param="boardWidth" value="'+cfg.boardWidth+'"></label>'+
    '<label>Preço por chapa (R$)<input type="number" min="0" step="0.01" data-ua-group="'+safe(g.key)+'" data-ua-param="boardPrice" value="'+cfg.boardPrice+'"></label>'+
    '</div><div class="ua-skp-note">Estimativa por área: <strong>'+calculate.count+' chapa(s)</strong> · '+cash(calculate.cost)+'. '+(calculate.oversize?'<strong class="ua-skp-alert">Há peças maiores que a chapa informada.</strong>':'')+'</div></div>';
  }).join('');
  const partRows=state.parts.slice(0,80).map(p=>'<tr><td>'+safe(p.name)+'</td><td>'+safe(p.material)+'</td><td>'+fmtMm(p.length)+' × '+fmtMm(p.width)+' × '+(p.thickness?fmtMm(p.thickness):'—')+'</td><td>'+p.qty+'</td></tr>').join('');
  return '<section class="ua-section gap-top"><h3>3. Estimativa por material</h3><p class="muted">Os valores iniciais de chapa são apenas exemplos editáveis. Configure as dimensões e o preço de cada MDF antes de usar os custos.</p>'+
   '<label class="ua-skp-general-label">Aproveitamento estimado da chapa (%) <input id="uaSkuYield" type="number" min="1" max="100" value="'+state.efficiency+'"></label>'+
   groupHtml+
   '<div class="ua-skp-settings ua-skp-extras">'+
   [['edgePrice','Fita de borda (R$/m)'],['hardware','Ferragens e acessórios (R$)'],['labor','Mão de obra (R$)'],['install','Instalação (R$)'],['delivery','Entrega / frete (R$)'],['margin','Margem desejada sobre a venda (%)']].map(([field,label])=>'<label>'+label+'<input type="number" min="0" '+(field==='margin'?'max="95" ':'')+'step="0.01" data-ua-extra="'+field+'" value="'+state[field]+'"></label>').join('')+'</div>'+
   '<div class="actions gap-top"><button class="btn primary" type="button" data-ua-skp="recalculate">Atualizar orçamento</button><button class="btn" type="button" data-ua-skp="export">Baixar lista de peças CSV</button><button class="btn" type="button" data-ua-skp="brief">Gerar resumo para ChatGPT</button></div>'+
   '<div id="uaSkuTotal"></div></section>'+
   '<section class="ua-section gap-top"><h3>4. Peças extraídas</h3><div class="ua-table-wrap"><table class="ua-table"><thead><tr><th>Peça</th><th>Material</th><th>Dimensões (mm)</th><th>Qtde</th></tr></thead><tbody>'+partRows+'</tbody></table></div><p class="muted">'+(state.parts.length>80?'Exibindo as primeiras 80 peças; o cálculo considera todas.':'')+'</p></section>'+
   '<section class="ua-section gap-top"><h3>5. Resumo para o assistente</h3><textarea class="ua-generated" id="uaSkuBrief" readonly placeholder="Clique em Gerar resumo para ChatGPT."></textarea><div class="actions gap-top"><button class="btn" type="button" data-ua-skp="copy">Copiar resumo</button><a class="btn primary" href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer">Abrir ChatGPT ↗</a></div></section>';
 }
 function recalcInputs(){
  const yieldInput=document.querySelector('#uaSkuYield');
  if(yieldInput){
   const v=positive(yieldInput.value,'Aproveitamento');
   if(v<1||v>100)throw Error('Aproveitamento deve estar entre 1% e 100%.');state.efficiency=v;
  }
  document.querySelectorAll('[data-ua-group]').forEach(i=>{
   const key=i.getAttribute('data-ua-group'),field=i.getAttribute('data-ua-param');
   const n=positive(i.value,field,field==='boardPrice');
   if(!['boardLength','boardWidth','boardPrice'].includes(field))throw Error('Configuração desconhecida.');
   groupCfg(key)[field]=n;
  });
  document.querySelectorAll('[data-ua-extra]').forEach(i=>{
   const field=i.getAttribute('data-ua-extra');
   if(!['edgePrice','hardware','labor','install','delivery','margin'].includes(field))throw Error('Campo desconhecido.');
   state[field]=positive(i.value,field,true);
  });
  if(state.margin>95)throw Error('Margem precisa estar entre 0 e 95%.');
 }
 function renderTotals(){
  const root=document.querySelector('#uaSkuTotal');
  if(!root||!state.parts.length)return;
  const r=calculated();
  root.innerHTML='<div class="ua-skp-totals">'+
   [['Peças',state.parts.reduce((s,p)=>s+p.qty,0)],['Área de peças',format(r.area,3)+' m²'],['Chapas estimadas',r.sheets],['Fita informada',format(r.band,2)+' m'],['Materiais (chapas)',cash(r.matcost)],['Fita de borda',cash(r.edgeCost)],['Custo total previsto',cash(r.cost)],['Preço preliminar (não final)',cash(r.price)]]
   .map(([k,v])=>'<div><span>'+safe(k)+'</span><strong>'+safe(v)+'</strong></div>').join('')+'</div>'+
   '<p class="ua-skp-footnote">A contagem de chapas é uma <strong>aproximação por área e aproveitamento informado</strong>, não um plano de corte otimizado. Não considera automaticamente sentido do veio, espessura do corte da serra, fita, usinagem, falhas e sobra. O custo utiliza os preços fornecidos. A margem refere-se ao preço de venda, não a impostos.</p>'+
   (r.bad.length?'<div class="ua-skp-warnings">'+r.bad.map(x=>'<p>⚠ '+safe(x)+'</p>').join('')+'</div>':'')+
   (state.map.edge<0?'<div class="ua-skp-warnings">⚠ O CSV não possui coluna de metros de fita. O custo da fita está em zero até informar a metragem em uma exportação revisada.</div>':'')+
   (!r.matcost?'<div class="ua-skp-warnings">⚠ Nenhum preço de chapa informado. O valor sugerido não deve ser usado como orçamento final.</div>':'');
 }
 function view(){
  title.textContent='Importar lista SketchUp';
  content.innerHTML='<div class="ua-welcome"><div><div class="ua-eyebrow">UNIVERSALARTES · SKETCHUP</div>'+
    '<h2>Lista de peças do SketchUp 2022</h2><p>Importe uma lista de peças exportada do SketchUp e confira materiais, quantitativos e uma estimativa preliminar.</p></div></div>'+
    '<section class="ua-section"><h3>1. Importar lista OpenCutList (.csv ou .xlsx)</h3>'+
    '<p>No SketchUp 2022, exporte a lista de peças do <strong>OpenCutList</strong> como <strong>Excel (.xlsx)</strong> ou CSV. Configure as dimensões em <strong>mm</strong> e confira material, espessura, quantidade e fita.</p>'+
    '<label class="ua-skp-upload">Importar Excel (.xlsx), CSV ou TXT<input type="file" id="uaSkuFile" accept=".xlsx,.csv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/plain"></label>'+
    '<p class="muted">A planilha é lida no seu navegador. O leitor Excel é carregado por HTTPS quando necessário. O arquivo .skp contém o modelo 3D; esta tela importa a lista de peças exportada.</p>'+
    '<div class="actions gap-top"><button class="btn" type="button" data-ua-skp="template">Baixar modelo de CSV</button><a class="btn" href="https://extensions.sketchup.com/extension/00f0bf69-7a42-4295-9e1c-226080814e3e/opencutlist" target="_blank" rel="noopener noreferrer">Conhecer OpenCutList ↗</a></div>'+
    (state.file?'<p class="ua-skp-file">Arquivo carregado: '+safe(state.file)+' · '+state.raw.length+' linhas</p>':'')+
    (state.note?'<p class="ua-skp-note ua-skp-detected">'+safe(state.note)+'</p>':'')+
    (state.error?'<div class="ua-skp-warnings" role="alert">'+safe(state.error)+'</div>':'')+'</section>'+
    mappingHTML()+summaryHTML();
  renderTotals();
  window.universalartesSketchUpExcel?.enhance?.();
 }
 function extractPartTable(rows){
  // Ignorar a primeira linha "Components" e seções-resumo após as peças.
  let headerIndex=-1,headers=[];
  for(let i=0;i<Math.min(rows.length,30);i++){
   const candidate=rows[i].map(x=>String(x??'').trim());
   if(guess(candidate,'length')>=0&&guess(candidate,'width')>=0&&
     (guess(candidate,'name')>=0||candidate.some(x=>compact(x)==='part'))){
    headerIndex=i;headers=candidate;break;
   }
  }
  if(headerIndex<0)throw Error('Não encontrei o cabeçalho das peças (Length(L), Width(W), Description). Exporte a lista "Components" do OpenCutList.');
  const raw=[];
  for(let i=headerIndex+1;i<rows.length;i++){
   const row=rows[i].map(v=>String(v??'').trim());
   const first=String(row[0]||'').toLowerCase();
   if(/^(total component|component materials|material|total geral|grand total)/i.test(first))break;
   if(row.length<2||row.every(x=>!x))continue;
   if(guess(headers,'name')>=0&&guess(headers,'length')>=0&&guess(headers,'width')>=0){
    const n=row[guess(headers,'name')],length=row[guess(headers,'length')],width=row[guess(headers,'width')];
    if(!n||!length||!width)break; // evita interpretar seções-resumo como peças
   }
   raw.push(row);
  }
  if(!raw.length)throw Error('A tabela de componentes está vazia. Verifique a exportação no SketchUp 2022.');
  return {headers,raw,skipped:headerIndex};
 }
 function readFile(file){
  if(!file)return;
  if(!/\.(csv|txt)$/i.test(file.name))throw Error('Use CSV/TXT do OpenCutList ou Excel (.xlsx). Arquivos .skp são modelos 3D e precisam de uma extensão para extração das peças.');
  if(file.size>2*1024*1024)throw Error('Arquivo acima de 2 MB. Exporte um projeto por vez.');
  return file.arrayBuffer().then(bytes=>{
   const arr=new Uint8Array(bytes);
   const encoding=arr[0]===255&&arr[1]===254?'utf-16le':arr[0]===254&&arr[1]===255?'utf-16be':'utf-8';
   const text=new TextDecoder(encoding,{fatal:true}).decode(bytes).replace(/^\uFEFF/,'');
   const sep=detectSep(text),rows=parseCSV(text,sep);
   if(rows.length<2)throw Error('CSV precisa ter cabeçalho e pelo menos uma peça.');
   const {headers,raw,skipped}=extractPartTable(rows);
   if(headers.length<3)throw Error('CSV precisa ter colunas de peça, comprimento e largura.');
   state.file=file.name;state.headers=headers;state.raw=raw;state.parts=[];state.settings={};state.separator=sep;state.error='';state.note=skipped?'Cabeçalho encontrado após '+skipped+' linha(s) introdutória(s) do OpenCutList.':'';
   mapping();view();
  });
 }
 function exportText(name,text){
  const blob=new Blob([text],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=name;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),5000);
 }
 function csvEscape(v){
  let s=String(v??'');
  if(/^\s*[=+\-@\t\r]/.test(s))s="'"+s;
  return '"'+s.replace(/"/g,'""')+'"';
 }
 function exportParts(){
  const hdr=['Codigo','Peca','Comprimento_mm','Largura_mm','Espessura_mm','Quantidade','Material','Fita_m_por_peca'];
  const rows=state.parts.map(p=>[p.code||'',p.name,p.length,p.width,p.thickness,p.qty,p.material,p.edge]);
  exportText('universalartes-pecas-sketchup.csv','\uFEFF'+[hdr,...rows].map(row=>row.map(csvEscape).join(';')).join('\r\n'));
 }
 function brief(){
  const r=calculated();const lines=[
   'UNIVERSALARTES — Projeto SketchUp / Lista de peças',
   'Arquivo: '+state.file,
   'Todas as dimensões de peças estão em milímetros (mm).',
   'Total de peças: '+state.parts.reduce((s,p)=>s+p.qty,0),
   'Área de peças: '+format(r.area,3)+' m²',
   'Fita informada no CSV: '+format(r.band,2)+' m',
   '',
   'MATERIAIS E CHAPAS ESTIMADAS'
  ];
  r.result.forEach(g=>lines.push(g.material+' '+g.thickness+' mm: '+g.parts+' peças, '+format(g.area,3)+' m², '+g.count+' chapas por área ('+g.cfg.boardLength+' × '+g.cfg.boardWidth+' mm), R$ '+format(g.cost)));
  lines.push('Aproveitamento suposto: '+state.efficiency+'%', 'Custo total estimado: '+cash(r.cost),'Preço indicativo: '+cash(r.price),
    'Lista das peças e dimensões:',...state.parts.slice(0,120).map(p=>'- '+p.qty+' × '+p.name+': '+p.length+' × '+p.width+' × '+(p.thickness||'espessura?')+' mm, '+p.material),
    'Verifique dimensões, sentido do veio, sobra, perdas, folgas, fita de borda, tipo e quantidade de ferragens e custos não informados. NÃO trate a estimativa por área como plano de corte nem como projeto técnico final.');
  if(state.parts.length>120)lines.push('(Resumo limitado às primeiras 120 linhas; use o arquivo CSV para lista completa.)');
  if(r.bad.length)lines.push('ALERTAS:',...r.bad);
  document.querySelector('#uaSkuBrief').value=lines.join('\n');
 }
 const prevRender=render;
 if(!sections.some(s=>s[0]==='sketchup')){
  const pos=sections.findIndex(s=>s[0]==='assistente');
  sections.splice(pos<0?sections.length:pos+1,0,['sketchup','▥','Importar SketchUp']);
 }
 render=function(section=location.hash.slice(1)||'dashboard'){
  if(section!=='sketchup')return prevRender(section);
  title.textContent='Importar SketchUp';
  nav.innerHTML=sections.map(([key,icon,label])=>'<button class="nav-btn '+(key==='sketchup'?'active':'')+'" data-section="'+key+'"><span aria-hidden="true">'+safe(icon)+'</span>'+safe(label)+'</button>').join('');
  nav.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{location.hash=b.dataset.section;sidebar.classList.remove('open');if(location.hash.slice(1)===section)render(section)}));
  view();
 };
 document.addEventListener('change',async e=>{
  if(e.target?.id==='uaSkuFile'){
   try{await readFile(e.target.files?.[0])}catch(error){state.error=error.message||'Não foi possível ler arquivo.';state.file='';state.parts=[];state.raw=[];view();}
  }else if(e.target?.matches?.('[data-ua-map]')){
   const field=e.target.getAttribute('data-ua-map');state.map[field]=Number(e.target.value);
  }
 });
 document.addEventListener('click',async e=>{
  const btn=e.target?.closest?.('[data-ua-skp]');if(!btn)return;
  try{
   const action=btn.getAttribute('data-ua-skp');
   if(action==='template'){
    exportText('modelo-universalartes-sketchup.csv','\uFEFFPeca;Comprimento_mm;Largura_mm;Espessura_mm;Quantidade;Material;Fita_m_por_peca\r\nLateral;2100;550;15;2;MDF Branco TX;1,6\r\nPrateleira;760;500;15;3;MDF Branco TX;0,76\r\nPorta;1950;400;18;2;MDF Amadeirado;4,7');return;
   }
   if(action==='reset'){state.file='';state.raw=[];state.headers=[];state.parts=[];state.map={};state.settings={};state.error='';state.note='';view();return;}
   if(action==='calculate'){
    state.parts=makeParts();state.error='';view();return;
   }
   if(action==='recalculate'){recalcInputs();view();return}
   if(action==='export'){exportParts();return}
   if(action==='brief'){recalcInputs();view();brief();return}
   if(action==='copy'){
    const txt=document.querySelector('#uaSkuBrief')?.value;
    if(!txt)throw Error('Gere primeiro o resumo para o ChatGPT.');
    try{await navigator.clipboard.writeText(txt);alert('Resumo copiado! Abra o ChatGPT e cole o conteúdo.');}
    catch{const node=document.querySelector('#uaSkuBrief');node.focus();node.select();alert('Selecione o texto e copie com Ctrl+C.');}
   }
  }catch(error){alert(error.message||'Não foi possível concluir o cálculo.')}
 });
 window.universalartesSketchUp={parseCSV,detectSep,extractPartTable,makeParts,calculated,state,mapping,view};
})();
