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
 let pending=null,dialog=null,target=null,visible=[],shown=PAGE_SIZE,opening=false;
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
  return 'Referências verificadas no catálogo público em '+checkedOn+'. Preços, quando mostrados, são históricos e não uma cotação atual. O estoque da filial e os valores finais devem ser confirmados na Léo Madeiras.';
 }
 function close(){
  if(!dialog)return;
  const current=dialog;dialog=null;target=null;visible=[];shown=PAGE_SIZE;
  if(current.open)current.close();
  current.remove();
 }
 function selectOptions(id,values,caption){
  const el=dialog?.querySelector('#'+id);
  if(!el)return;
  const previous=el.value;
  el.innerHTML='<option value="">'+escape(caption)+'</option>'+
   values.map(value=>'<option value="'+escape(value)+'">'+escape(value)+'</option>').join('');
  el.value=values.includes(previous)?previous:'';
 }
 function rebuildFilters(){
  const category=dialog?.querySelector('#uaLeoCategory')?.value||'';
  const group=items().filter(p=>!category||p.category===category);
  const brands=[...new Set(group.map(p=>p.brand).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  const sizes=[...new Set(group.map(p=>p.size).filter(Boolean))]
   .sort((a,b)=>(parseFloat(a.replace(',','.'))||0)-(parseFloat(b.replace(',','.'))||0)||a.localeCompare(b,'pt-BR'));
  const colors=[...new Set(group.map(p=>p.color).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  selectOptions('uaLeoBrand',brands,'Todas as marcas');
  selectOptions('uaLeoSize',sizes,category==='mdf'?'Todas as espessuras':category==='parafusos'?'Todas as medidas':'Todos os tamanhos');
  selectOptions('uaLeoColor',colors,'Todas as cores / padrões');
  const colorEl=dialog?.querySelector('#uaLeoColor');
  if(colorEl)colorEl.closest('label').hidden=category!==''&&category!=='mdf';
  shown=PAGE_SIZE;
  renderList();
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
  const more=dialog.querySelector('#uaLeoMore');
  if(count)count.textContent=visible.length+' referência(s) encontrada(s), de '+items().length+' cadastradas nesta consulta.';
  if(link)link.href=categories[category]?.url||'https://checkout.leomadeiras.com.br/mdf';
  if(table)table.innerHTML=visible.length?visible.slice(0,shown).map((item,index)=>{
   const href=checkUrl(item.url)?item.url:categories[item.category].url;
   const exact=checkUrl(item.url);
   const amount=Number.isFinite(item.price)?currency(item.price):'Preço não cadastrado';
   const note=Number.isFinite(item.price)?'Referência antiga; confirme na loja':'Informe o custo manualmente, se necessário';
   return '<div class="ua-leo-item">'+
     '<div><strong>'+escape(item.name)+'</strong>'+
     '<small>'+escape(item.brand||'')+' · '+escape(item.size||'')+' · '+escape(item.unit)+'</small></div>'+
     '<div class="ua-leo-price"><b>'+escape(amount)+'</b><small>'+escape(note)+'</small></div>'+
     '<div class="ua-leo-item-actions"><button type="button" class="btn small" data-ua-leo-use="'+index+'">Selecionar</button>'+
     '<a href="'+escape(href)+'" target="_blank" rel="noopener noreferrer" class="btn small">'+(exact?'Ver produto na Léo':'Pesquisar na Léo')+'</a></div>'+
    '</div>';
  }).join(''):'<p class="ua-leo-empty">Nenhuma referência nesta combinação. Consulte a categoria oficial para encontrar outras opções.</p>';
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
    '<p>Referências de MDF, parafusos, buchas e fitas. Sem fotos, nem consulta de estoque em tempo real.</p></div>'+
    '<button class="btn small" type="button" id="uaLeoClose">Fechar</button></div>'+
    '<p class="ua-leo-warning" role="status">'+escape(priceNotice())+'</p>'+
    '<div class="ua-leo-filters">'+
    '<label>Categoria<select id="uaLeoCategory"><option value="">Todas as categorias</option>'+
    Object.entries(categories).map(([key,c])=>'<option value="'+escape(key)+'">'+escape(c.label)+'</option>').join('')+'</select></label>'+
    '<label>Pesquisar<input id="uaLeoQuery" type="search" placeholder="Ex.: Amêndola 15 mm, 4x40, bucha 8mm"></label>'+
    '<label>Marca<select id="uaLeoBrand"></select></label>'+
    '<label>Medida / Espessura (mm)<select id="uaLeoSize"></select></label>'+
    '<label>Cor / Padrão<select id="uaLeoColor"></select></label></div>'+
    '<p class="ua-leo-count" id="uaLeoCount" role="status"></p>'+
    '<div id="uaLeoResults" class="ua-leo-results"></div>'+
    '<div class="ua-leo-paging"><button type="button" id="uaLeoMore" class="btn" hidden>Mostrar mais referências</button></div>'+
    (editingProduct?'<label class="ua-leo-opt"><input id="uaLeoFillCost" type="checkbox"> Preencher custo com preço histórico quando disponível (confira antes de salvar)</label>':'')+
    '<p class="ua-leo-foot"><a class="btn" id="uaLeoCategoryLink" target="_blank" rel="noopener noreferrer" href="https://checkout.leomadeiras.com.br/mdf">Abrir categoria oficial</a> Nosso catálogo é parcial. A seleção não cadastra, compra, reserva nem movimenta estoque automaticamente.</p>';
   document.body.append(el);dialog=el;
   el.querySelector('#uaLeoClose').addEventListener('click',close);
   el.querySelector('#uaLeoCategory').addEventListener('change',rebuildFilters);
   for(const sel of ['#uaLeoBrand','#uaLeoSize','#uaLeoColor'])el.querySelector(sel).addEventListener('change',()=>{shown=PAGE_SIZE;renderList()});
   el.querySelector('#uaLeoQuery').addEventListener('input',()=>{shown=PAGE_SIZE;renderList()});
   el.querySelector('#uaLeoMore').addEventListener('click',()=>{shown+=PAGE_SIZE;renderList()});
   el.addEventListener('click',event=>{
    const pick=event.target.closest('[data-ua-leo-use]');
    if(pick){const item=visible[Number(pick.dataset.uaLeoUse)];if(item)apply(item)}
   });
   el.addEventListener('close',()=>{if(dialog===el)close()},{once:true});
   el.showModal();rebuildFilters();el.querySelector('#uaLeoQuery').focus();
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
  get items(){return items()},categories,filter,priceNotice,open,close,ensureData,PAGE_SIZE,checkUrl
 };
})();