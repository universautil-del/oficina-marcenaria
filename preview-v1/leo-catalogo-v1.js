'use strict';
/* Catálogo referencial da Léo Madeiras.
   Sem fotos, sem consulta a estoque, sem gravações automáticas.
   Os dados são carregados somente quando esta janela é aberta. */
(function(){
 const checkedOn='12/11/2026';
 const PAGE_SIZE=20;
 const SOURCE='leo-dados-v2.js?v=referencias-verificadas-20261112';
 const categories={
  mdf:{label:'MDF / chapas',url:'https://checkout.leomadeiras.com.br/mdf'},
  parafusos:{label:'Parafusos',url:'https://checkout.leomadeiras.com.br/ferragens/ferragens-tecnicas/parafusos'},
  buchas:{label:'Buchas',url:'https://checkout.leomadeiras.com.br/ferragens/ferragens-tecnicas/buchas'},
  fitas:{label:'Fitas de borda',url:'https://checkout.leomadeiras.com.br/fitas-e-tapa-furos'}
 };
 let pending=null,dialog=null,target=null,visible=[],shown=PAGE_SIZE,opening=false,quoteItem=null;
 const items=()=>Array.isArray(window.universaArtLeoDados)?window.universaArtLeoDados:[];
 const currency=n=>Number(n).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
 const escape=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;',"'":'&#39;'}[ch]));
 const normalized=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLocaleLowerCase('pt-BR').replace(/(\d)\s*[×x]\s*(\d)/g,'$1x$2')
  .replace(/\s+/g,' ').trim();
 const checkUrl=url=>typeof url==='string'&&/^https:\/\/checkout\.leomadeiras\.com\.br\/[a-z0-9\-\/]+\/p$/.test(url);
 function ensureData(){
  if(items().length)return Promise.resolve(items());
  if(pending)return pending;
  pending=new Promise((resolve,reject)=>{
   const script=document.createElement('script');
   script.src=SOURCE;
   script.async=true;
   script.onload=()=>items().length?resolve(items()):reject(Error('O arquivo do catálogo está vazio.'));
   script.onerror=()=>reject(Error('Não foi possível carregar o catálogo. Verifique sua conexão.'));
   document.head.appendChild(script);
  }).catch(error=>{pending=null;throw error});
  return pending;
 }
 function filter(category='',query='',extra={}){
  const term=normalized(query),brand=extra.brand||'',size=extra.size||'',color=extra.color||'';
  return items().filter(item=>{
   if(category&&item.category!==category)return false;
   if(brand&&item.brand!==brand)return false;
   if(size&&item.size!==size)return false;
   if(color&&item.color!==color)return false;
   if(!term)return true;
   return normalized([item.name,item.brand,item.size,item.color,item.category].join(' ')).includes(term);
  });
 }
 function priceNotice(){
  return 'Este catálogo mostra referências independentemente do estoque da sua marcenaria e da disponibilidade na loja. Preços consultados em '+checkedOn+' são históricos, não cotação atual. Confirme valor, frete e disponibilidade com a Léo Madeiras antes de comprar.';
 }
 function close(){
  if(!dialog)return;
  const current=dialog;dialog=null;target=null;visible=[];shown=PAGE_SIZE;quoteItem=null;
  if(current.open)current.close();
  current.remove();
 }
 let filterNotice='';
 function chosen(){
  return {
   category:dialog?.querySelector('#uaLeoCategory')?.value||'',
   brand:dialog?.querySelector('#uaLeoBrand')?.value||'',
   size:dialog?.querySelector('#uaLeoSize')?.value||'',
   color:dialog?.querySelector('#uaLeoColor')?.value||''
  };
 }
 function compatible(selection){
  return items().some(item=>
   (!selection.category||item.category===selection.category)&&
   (!selection.brand||item.brand===selection.brand)&&
   (!selection.size||item.size===selection.size)&&
   (!selection.color||item.color===selection.color));
 }
 function resolveSelection(changed){
  const values=chosen();
  const dropped=[];
  if(changed==='category'){
   for(const key of ['brand','size','color']){
    if(values[key])dropped.push(key);
    values[key]='';
   }
  }else if(!compatible(values)){
   const priorities={
    brand:['color','size'],
    size:['color','brand'],
    color:['size','brand']
   };
   for(const key of priorities[changed]||['color','size','brand']){
    if(compatible(values))break;
    if(values[key]){dropped.push(key);values[key]=''}
   }
  }
  const labels={brand:'marca',size:'medida / espessura',color:'cor / padrão'};
  filterNotice=dropped.length&&changed!=='category'?
   'Filtro de '+dropped.map(k=>labels[k]).join(' e ')+' ajustado: a combinação anterior não existe nas '+items().length+' referências cadastradas. Confira as opções disponíveis abaixo.':'';
  for(const key of ['brand','size','color']){
   const el=dialog?.querySelector('#uaLeo'+key[0].toUpperCase()+key.slice(1));
   if(el)el.value=values[key];
  }
  return values;
 }
 function selectOptions(id,key,caption,values){
  const el=dialog?.querySelector('#'+id);
  if(!el)return;
  const previous=el.value;
  // Cada filtro mostra apenas opções compatíveis com os outros já selecionados.
  // Não contamos produtos a partir de buscas de texto que possam estar incompletas.
  const remaining=items().filter(item=>
   (!values.category||item.category===values.category)&&
   (key==='brand'||!values.brand||item.brand===values.brand)&&
   (key==='size'||!values.size||item.size===values.size)&&
   (key==='color'||!values.color||item.color===values.color)
  );
  const counts=new Map();
  for(const item of remaining){
   const value=item[key];
   if(value)counts.set(value,(counts.get(value)||0)+1);
  }
  const choices=[...counts.keys()].sort((a,b)=>key==='size'?
   (parseFloat(a.replace(',','.'))||0)-(parseFloat(b.replace(',','.'))||0)||a.localeCompare(b,'pt-BR'):
   a.localeCompare(b,'pt-BR'));
  el.innerHTML='<option value="">'+escape(caption)+'</option>'+
   choices.map(value=>'<option value="'+escape(value)+'">'+escape(value)+' ('+counts.get(value)+')</option>').join('');
  el.value=choices.includes(previous)?previous:'';
 }
 function rebuildFilters(changed='category'){
  if(!dialog)return;
  const values=resolveSelection(changed);
  selectOptions('uaLeoBrand','brand','Todas as marcas',values);
  selectOptions('uaLeoSize','size',values.category==='mdf'?'Todas as espessuras':values.category==='parafusos'?'Todas as medidas':'Todos os tamanhos',values);
  selectOptions('uaLeoColor','color','Todas as cores / padrões',values);
  const colorEl=dialog.querySelector('#uaLeoColor');
  if(colorEl)colorEl.closest('label').hidden=values.category!==''&&values.category!=='mdf';
  shown=PAGE_SIZE;
  renderList();
 }
 function clearFilters(){
  if(!dialog)return;
  for(const id of ['uaLeoCategory','uaLeoQuery','uaLeoBrand','uaLeoSize','uaLeoColor']){
   const el=dialog.querySelector('#'+id);
   if(el)el.value='';
  }
  filterNotice='';
  rebuildFilters('category');
 }
 function simulate(item){
  if(!dialog)return;
  quoteItem=item;
  const panel=dialog.querySelector('#uaLeoSimulator');
  const title=dialog.querySelector('#uaLeoQuoteName');
  const quantity=dialog.querySelector('#uaLeoQuoteQuantity');
  const price=dialog.querySelector('#uaLeoQuotePrice');
  if(!panel||!title||!quantity||!price)return;
  panel.hidden=false;
  title.textContent=item.name+' · por '+item.unit;
  quantity.value='1';
  price.value=Number.isFinite(item.price)?item.price.toFixed(2):'';
  const mode=dialog.querySelector('#uaLeoQuoteMode');
  if(mode)mode.textContent=Number.isFinite(item.price)?
   'Preço histórico do catálogo; pode ter mudado. Não representa oferta atual.':
   'Sem preço registrado: digite um valor informado pela loja apenas para esta simulação.';
  updateSimulation();
  panel.scrollIntoView?.({behavior:'smooth',block:'nearest'});
 }
 function estimate(item,quantity,unitPrice){
  const qty=Number(quantity),price=Number(unitPrice);
  if(!item||!Number.isInteger(qty)||qty<1||qty>9999||
   !Number.isFinite(price)||price<=0||price>1000000)return null;
  // Inteiros em centavos evitam imprecisões monetárias repetidas.
  return Math.round(price*100)*qty/100;
 }
 function updateSimulation(){
  if(!dialog||!quoteItem)return;
  const quantity=dialog.querySelector('#uaLeoQuoteQuantity')?.value||'';
  const price=dialog.querySelector('#uaLeoQuotePrice')?.value||'';
  const total=estimate(quoteItem,quantity,price);
  const output=dialog.querySelector('#uaLeoQuoteTotal');
  const hint=dialog.querySelector('#uaLeoQuoteHint');
  if(output)output.textContent=total===null?'Informe quantidade e preço válidos.':currency(total);
  if(hint)hint.textContent=total===null?'Nenhum valor calculado.':
   'Simulação de compra, não é preço garantido. Frete, descontos, impostos e disponibilidade não incluídos.';
  return total;
 }
 function simulationText(){
  if(!quoteItem||!dialog)return '';
  const quantity=dialog.querySelector('#uaLeoQuoteQuantity')?.value||'';
  const price=dialog.querySelector('#uaLeoQuotePrice')?.value||'';
  const total=estimate(quoteItem,quantity,price);
  if(total===null)return '';
  const source=Number.isFinite(quoteItem.price)&&Number(price)===quoteItem.price?'preço histórico de referência':'preço informado manualmente';
  return 'Simulação de compra de material — Léo Madeiras\nProduto: '+quoteItem.name+
   '\nQuantidade: '+quantity+' '+quoteItem.unit+'(s)'+
   '\nPreço por '+quoteItem.unit+': '+currency(Number(price))+
   '\nTotal estimado: '+currency(total)+
   '\nBase: '+source+'. Não confirma estoque, preço atual, frete nem disponibilidade.';
 }
 async function copySimulation(){
  const message=simulationText();
  if(!message){alert('Informe um preço e uma quantidade válidos para simular.');return false}
  if(!navigator?.clipboard?.writeText){
   alert('A cópia automática não está disponível neste navegador. Consulte os valores na tela.');
   return false;
  }
  try{
   await navigator.clipboard.writeText(message);
   const status=dialog?.querySelector('#uaLeoQuoteCopyStatus');
   if(status)status.textContent='Estimativa copiada para compartilhar com o cliente.';
   return true;
  }catch(error){
   alert('O navegador não permitiu copiar. Consulte os valores na tela.');
   return false;
  }
 }
 function renderList(){
  if(!dialog)return;
  const category=dialog.querySelector('#uaLeoCategory')?.value||'';
  const query=dialog.querySelector('#uaLeoQuery')?.value||'';
  const extra={
   brand:dialog.querySelector('#uaLeoBrand')?.value||'',
   size:dialog.querySelector('#uaLeoSize')?.value||'',
   color:dialog.querySelector('#uaLeoColor')?.value||''
  };
  visible=filter(category,query,extra);
  const table=dialog.querySelector('#uaLeoResults');
  const link=dialog.querySelector('#uaLeoCategoryLink');
  const count=dialog.querySelector('#uaLeoCount');
  const note=dialog.querySelector('#uaLeoFilterNotice');
  const more=dialog.querySelector('#uaLeoMore');
  if(note){note.textContent=filterNotice;note.hidden=!filterNotice;}
  if(count)count.textContent=visible.length+' referência(s) para consultar, mesmo sem estoque próprio ou disponibilidade confirmada · '+items().length+' na base.';
  if(link)link.href=categories[category]?.url||'https://checkout.leomadeiras.com.br/mdf';
  if(table)table.innerHTML=visible.length?visible.slice(0,shown).map((item,index)=>{
   const href=checkUrl(item.url)?item.url:categories[item.category].url;
   const exact=checkUrl(item.url);
   const amount=Number.isFinite(item.price)?currency(item.price):'Preço não cadastrado';
   const note=Number.isFinite(item.price)?'Preço histórico, não oferta atual':'Sem preço; simule com valor informado';
   return '<div class="ua-leo-item">'+
     '<div><strong>'+escape(item.name)+'</strong>'+
     '<small>'+escape(item.brand||'')+' · '+escape(item.size||'')+' · '+escape(item.unit)+'</small></div>'+
     '<div class="ua-leo-price"><b>'+escape(amount)+'</b><small>'+escape(note)+'</small></div>'+
     '<div class="ua-leo-item-actions"><button type="button" class="btn small" data-ua-leo-use="'+index+'">Selecionar</button>'+
     '<button type="button" class="btn small ua-leo-simulate-trigger" data-ua-leo-simulate="'+index+'">Simular compra</button>'+
     '<a href="'+escape(href)+'" target="_blank" rel="noopener noreferrer" class="btn small">'+(exact?'Ver produto na Léo':'Pesquisar na Léo')+'</a></div>'+
    '</div>';
  }).join(''):'<p class="ua-leo-empty">Nenhuma referência com esses filtros nesta lista parcial. Experimente Limpar filtros ou consulte a categoria oficial da Léo.</p>';
  if(more)more.hidden=visible.length<=shown;
 }
 function apply(item){
  if(!target||!target.isConnected)return close();
  const input=target.querySelector('[name="material"]')||target.querySelector('[name="nome"]');
  if(!input)return close();
  input.value=item.name;
  input.dispatchEvent(new Event('input',{bubbles:true}));
  input.dispatchEvent(new Event('change',{bubbles:true}));
  if(input.name==='nome'){
   const cat=target.querySelector('[name="categoria"]');
   if(cat)cat.value=categories[item.category].label;
   const unit=target.querySelector('[name="unidade"]');
   if(unit&&[...unit.options].some(o=>o.value===item.unit))unit.value=item.unit;
   const thickness=target.querySelector('[name="espessuraMm"]');
   if(thickness&&item.thickness)thickness.value=String(item.thickness);
   const length=target.querySelector('[name="chapaComprimentoMm"]');
   const width=target.querySelector('[name="chapaLarguraMm"]');
   if(length&&item.dimensions)length.value=String(item.dimensions[0]);
   if(width&&item.dimensions)width.value=String(item.dimensions[1]);
   const priceField=target.querySelector('[name="custo"]');
   const wantCost=dialog?.querySelector('#uaLeoFillCost')?.checked;
   if(priceField&&wantCost&&Number.isFinite(item.price))priceField.value=String(item.price.toFixed(2));
  }
  close();input.focus();
 }
 async function open(button){
  const form=button?.closest('form');
  if(!form)return false;
  const input=form.querySelector('[name="material"]')||form.querySelector('[name="nome"]');
  if(!input)return false;
  if(opening)return false;
  opening=true;
  try{
   await ensureData();
   if(!form.isConnected)return false;
   close();target=form;
   const el=document.createElement('dialog');
   el.className='ua-leo-dialog';
   el.setAttribute('aria-label','Consultar materiais da Léo Madeiras');
   const editingProduct=input.name==='nome';
   el.innerHTML='<div class="ua-leo-header"><div><h2>Materiais da Léo Madeiras</h2>'+
    '<p>Referências de MDF, parafusos, buchas e fitas, inclusive materiais fora do seu estoque.</p></div>'+
    '<button class="btn small" type="button" id="uaLeoClose">Fechar</button></div>'+
    '<p class="ua-leo-warning" role="status">'+escape(priceNotice())+'</p>'+
    '<div class="ua-leo-filters">'+
    '<label>Categoria<select id="uaLeoCategory"><option value="">Todas as categorias</option>'+
    Object.entries(categories).map(([key,c])=>'<option value="'+escape(key)+'">'+escape(c.label)+'</option>').join('')+'</select></label>'+
    '<label>Pesquisar<input id="uaLeoQuery" type="search" placeholder="Ex.: Amêndola 15 mm, 4x40, bucha 8mm"></label>'+
    '<label>Marca<select id="uaLeoBrand"></select></label>'+
    '<label>Medida / Espessura (mm)<select id="uaLeoSize"></select></label>'+
    '<label>Cor / Padrão<select id="uaLeoColor"></select></label></div>'+
    '<div class="ua-leo-filter-tools"><p class="ua-leo-count" id="uaLeoCount" role="status"></p><button type="button" id="uaLeoClear" class="btn small">Limpar filtros</button></div>'+
    '<p class="ua-leo-filter-notice" id="uaLeoFilterNotice" role="status" hidden></p>'+
    '<div id="uaLeoResults" class="ua-leo-results"></div>'+
    '<div class="ua-leo-paging"><button type="button" id="uaLeoMore" class="btn" hidden>Mostrar mais referências</button></div>'+
    '<section class="ua-leo-simulator" id="uaLeoSimulator" hidden>'+
    '<h3>Simular custo para o cliente</h3><p class="ua-leo-sim-product" id="uaLeoQuoteName"></p>'+
    '<p class="ua-leo-sim-mode" id="uaLeoQuoteMode"></p>'+
    '<div class="ua-leo-sim-grid">'+
    '<label>Quantidade (embalagens / chapas)<input id="uaLeoQuoteQuantity" type="number" min="1" max="9999" step="1" value="1"></label>'+
    '<label>Preço por embalagem / chapa (R$)<input id="uaLeoQuotePrice" type="number" min="0.01" max="1000000" step="0.01" placeholder="Informar preço"></label></div>'+
    '<p class="ua-leo-sim-total">Total estimado: <strong id="uaLeoQuoteTotal"></strong></p>'+
    '<p class="ua-leo-sim-hint" id="uaLeoQuoteHint"></p>'+
    '<button type="button" id="uaLeoQuoteCopy" class="btn small">Copiar estimativa</button>'+
    '<span id="uaLeoQuoteCopyStatus" class="ua-leo-sim-copy" aria-live="polite"></span>'+
    '</section>'+
    (editingProduct?'<label class="ua-leo-opt"><input id="uaLeoFillCost" type="checkbox"> Preencher custo com preço histórico quando disponível (confira antes de salvar)</label>':'')+
    '<p class="ua-leo-foot"><a class="btn" id="uaLeoCategoryLink" target="_blank" rel="noopener noreferrer" href="https://checkout.leomadeiras.com.br/mdf">Abrir categoria oficial</a> Nosso catálogo é parcial. A seleção não cadastra, compra, reserva nem movimenta estoque automaticamente.</p>';
   document.body.append(el);dialog=el;
   el.querySelector('#uaLeoClose').addEventListener('click',close);
   el.querySelector('#uaLeoCategory').addEventListener('change',()=>rebuildFilters('category'));
   for(const key of ['Brand','Size','Color'])el.querySelector('#uaLeo'+key).addEventListener('change',()=>rebuildFilters(key.toLowerCase()));
   el.querySelector('#uaLeoQuery').addEventListener('input',()=>{filterNotice='';shown=PAGE_SIZE;renderList()});
   el.querySelector('#uaLeoClear').addEventListener('click',clearFilters);
   el.querySelector('#uaLeoMore').addEventListener('click',()=>{shown+=PAGE_SIZE;renderList()});
   el.querySelector('#uaLeoQuoteQuantity').addEventListener('input',updateSimulation);
   el.querySelector('#uaLeoQuotePrice').addEventListener('input',updateSimulation);
   el.querySelector('#uaLeoQuoteCopy').addEventListener('click',copySimulation);
   el.addEventListener('click',event=>{
    const pick=event.target.closest('[data-ua-leo-use]');
    if(pick){const item=visible[Number(pick.dataset.uaLeoUse)];if(item)apply(item)}
    const calc=event.target.closest('[data-ua-leo-simulate]');
    if(calc){const item=visible[Number(calc.dataset.uaLeoSimulate)];if(item)simulate(item)}
   });
   el.addEventListener('close',()=>{if(dialog===el)close()},{once:true});
   el.showModal();filterNotice='';rebuildFilters();el.querySelector('#uaLeoQuery').focus();
   return true;
  }catch(error){
   alert('O catálogo de referências não pôde ser carregado: '+(error.message||error));
   return false;
  }finally{opening=false}
 }
 document.addEventListener('click',event=>{
  const button=event.target.closest('[data-ua-leo-open]');
  if(!button)return;
  event.preventDefault();
  open(button);
 });
 window.universaArtLeoCatalogo={
  get items(){return items()},categories,filter,priceNotice,open,close,ensureData,PAGE_SIZE,checkUrl,estimate,simulationText
 };
})();