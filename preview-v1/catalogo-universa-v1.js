'use strict';
/* Catálogo de materiais UNIVERSA ART — integrado à planilha, separado do estoque.
   Leitura local de referências estáticas. Não movimenta produto, pedido nem financeiro.
   Informações comerciais e medidas não confirmadas nunca são inventadas. */
(function(){
 const PAGE_SIZE=20;
 const DATA_SCRIPT='catalogo-universa-dados-v1.js?v=218-itens-20261112';
 const groups={
  mdf:'MDF / padrões',chapas:'Outras chapas',parafusos:'Parafusos',
  buchas:'Buchas',fitas:'Fitas de borda',ferragens:'Ferragens e acessórios'
 };
 let loading=null,dialog=null,targetForm=null,visible=[],limit=PAGE_SIZE,quoteItem=null,opening=false,notice='';
 const items=()=>Array.isArray(window.universaCatalogoDados)?window.universaCatalogoDados:[];
 const escape=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 const normalized=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').replace(/(\d)\s*[×x]\s*(\d)/g,'$1x$2').replace(/\s+/g,' ').trim();
 const money=value=>Number(value).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
 const externalUrl=value=>typeof value==='string'&&/^https:\/\/(?:www\.guararapes\.com\.br|lojaonline\.arauco\.com)\/[^\s"'<>]+$/.test(value)?value:'';
 function ensureData(){
  if(items().length)return Promise.resolve(items());
  if(loading)return loading;
  loading=new Promise((resolve,reject)=>{
   const script=document.createElement('script');
   script.src=DATA_SCRIPT;script.async=true;
   script.onload=()=>items().length?resolve(items()):reject(Error('Catálogo vazio ou incompleto.'));
   script.onerror=()=>reject(Error('Não foi possível carregar os materiais. Verifique a conexão.'));
   document.head.appendChild(script);
  }).catch(error=>{loading=null;throw error});
  return loading;
 }
 function filter(category='',query='',extra={}){
  const words=normalized(query).split(' ').filter(Boolean);
  return items().filter(item=>
   (!category||item.category===category)&&
   (!extra.brand||item.brand===extra.brand)&&
   (!extra.size||item.size===extra.size)&&
   (!extra.color||item.color===extra.color)&&
   words.every(word=>normalized([item.id,item.type,item.name,item.brand,item.line,item.color,item.size,item.unit].join(' ')).includes(word))
  );
 }
 function priceNotice(){
  return 'Catálogo próprio da UNIVERSA ART, importado da planilha de materiais. É independente do estoque e não confirma disponibilidade em fornecedores. Os preços não foram preenchidos: consulte uma cotação real antes de apresentar um custo definitivo ao cliente.';
 }
 function resetDialog(){
  if(!dialog)return;
  const current=dialog;dialog=null;targetForm=null;visible=[];quoteItem=null;limit=PAGE_SIZE;notice='';
  if(current.open)current.close();
  current.remove();
 }
 function pickState(){
  return {
   category:dialog?.querySelector('#uaMatCategory')?.value||'',
   brand:dialog?.querySelector('#uaMatBrand')?.value||'',
   size:dialog?.querySelector('#uaMatSize')?.value||'',
   color:dialog?.querySelector('#uaMatColor')?.value||''
  };
 }
 function canMatch(chosen){
  return items().some(it=>(!chosen.category||it.category===chosen.category)&&(!chosen.brand||it.brand===chosen.brand)&&(!chosen.size||it.size===chosen.size)&&(!chosen.color||it.color===chosen.color));
 }
 function adaptFilters(changed){
  const chosen=pickState(),removed=[];
  if(changed==='category'){
   for(const k of ['brand','size','color']){if(chosen[k])removed.push(k);chosen[k]=''}
  }else if(!canMatch(chosen)){
   const priorities={brand:['color','size'],size:['color','brand'],color:['size','brand']};
   for(const key of priorities[changed]||['color','size','brand']){
    if(canMatch(chosen))break;
    if(chosen[key]){removed.push(key);chosen[key]=''}
   }
  }
  const labels={brand:'fabricante',size:'medida / espessura',color:'cor / padrão'};
  notice=removed.length&&changed!=='category'?'Filtro de '+removed.map(k=>labels[k]).join(' e ')+' redefinido porque não há essa combinação na lista.':'';
  for(const k of ['brand','size','color']){
   const el=dialog?.querySelector('#uaMat'+k[0].toUpperCase()+k.slice(1));
   if(el)el.value=chosen[k];
  }
  return chosen;
 }
 function updateOptions(id,field,caption,chosen){
  const el=dialog?.querySelector('#'+id);if(!el)return;
  const previous=el.value,counts=new Map();
  for(const it of items()){
   if(chosen.category&&it.category!==chosen.category)continue;
   if(field!=='brand'&&chosen.brand&&it.brand!==chosen.brand)continue;
   if(field!=='size'&&chosen.size&&it.size!==chosen.size)continue;
   if(field!=='color'&&chosen.color&&it.color!==chosen.color)continue;
   if(it[field])counts.set(it[field],(counts.get(it[field])||0)+1);
  }
  const keys=[...counts.keys()].sort((a,b)=>field==='size'?(parseFloat(a.replace(',','.'))||0)-(parseFloat(b.replace(',','.'))||0)||a.localeCompare(b,'pt-BR'):a.localeCompare(b,'pt-BR'));
  el.innerHTML='<option value="">'+escape(caption)+'</option>'+keys.map(v=>'<option value="'+escape(v)+'">'+escape(v)+' ('+counts.get(v)+')</option>').join('');
  el.value=keys.includes(previous)?previous:'';
 }
 function refreshFilters(changed='category'){
  if(!dialog)return;
  const state=adaptFilters(changed);
  updateOptions('uaMatBrand','brand','Todos os fabricantes',state);
  updateOptions('uaMatSize','size',state.category==='mdf'?'Todas as espessuras / a confirmar':'Todas as medidas',state);
  updateOptions('uaMatColor','color','Todas as cores / padrões',state);
  const color=dialog.querySelector('#uaMatColor');
  if(color)color.closest('label').hidden=!!state.category&&state.category!=='mdf'&&state.category!=='chapas';
  limit=PAGE_SIZE;renderItems();
 }
 function clearFilters(){
  if(!dialog)return;
  for(const key of ['Category','Query','Brand','Size','Color']){const x=dialog.querySelector('#uaMat'+key);if(x)x.value=''}
  notice='';refreshFilters('category');
 }
 function renderItems(){
  if(!dialog)return;
  const state=pickState(),query=dialog.querySelector('#uaMatQuery')?.value||'';
  visible=filter(state.category,query,state);
  const results=dialog.querySelector('#uaMatResults'),more=dialog.querySelector('#uaMatMore');
  const count=dialog.querySelector('#uaMatCount'),msg=dialog.querySelector('#uaMatNotice');
  if(count)count.textContent=visible.length+' referência(s) encontradas · '+items().length+' na lista (sem vínculo com o estoque).';
  if(msg){msg.textContent=notice;msg.hidden=!notice}
  if(more)more.hidden=visible.length<=limit;
  if(!results)return;
  results.innerHTML=visible.length?visible.slice(0,limit).map((it,index)=>{
   const technical=it.category==='mdf'&&it.thickness===null?'Espessura a confirmar':it.size;
   const dimensions=it.dimensionsConfirmed&&it.width&&it.length?' · '+it.width+' × '+it.length+' mm':'';
   const description=[it.brand,it.line,it.color].filter(Boolean).join(' · ');
   const price=Number.isFinite(it.price)?money(it.price):'A cotar';
   const link=externalUrl(it.url);
   return '<div class="ua-mat-item">'+
    '<div class="ua-mat-info"><strong>'+escape(it.name)+'</strong>'+
    '<small>'+escape(it.id)+' · '+escape(groups[it.category]||it.type)+' · '+escape(it.unit)+(it.packQty?' · pacote '+it.packQty:'')+'</small>'+
    (description?'<small>'+escape(description)+'</small>':'')+
    (technical?'<small>'+escape(technical)+escape(dimensions)+'</small>':'')+
    '</div><div class="ua-mat-price"><b>'+escape(price)+'</b><small>'+escape(it.origin)+'</small></div>'+
    '<div class="ua-mat-actions"><button type="button" class="btn small" data-ua-mat-select="'+index+'">Selecionar</button>'+
    '<button type="button" class="btn small ua-mat-simulate-trigger" data-ua-mat-quote="'+index+'">Simular custo</button>'+
    (link?'<a class="btn small" href="'+escape(link)+'" target="_blank" rel="noopener noreferrer">Fonte do fabricante</a>':'')+
    '</div></div>';
  }).join(''):'<p class="ua-mat-empty">Nenhum material corresponde aos filtros. Use Limpar filtros para ver outras opções. Esta lista não representa estoque disponível.</p>';
 }
 function apply(it){
  const form=targetForm;
  if(!form?.isConnected)return resetDialog();
  const input=form.querySelector('[name="material"]')||form.querySelector('[name="nome"]');
  if(!input)return resetDialog();
  input.value=it.name;
  input.dispatchEvent(new Event('input',{bubbles:true}));
  input.dispatchEvent(new Event('change',{bubbles:true}));
  if(input.name==='nome'){
   const category=form.querySelector('[name="categoria"]');
   if(category){const name=it.type||groups[it.category]||'';window.universaArtCategorias?.ensureOption(category,name);category.value=name;}
   const unit=form.querySelector('[name="unidade"]');
   if(unit&&[...unit.options].some(o=>o.value===it.unit))unit.value=it.unit;
   const thick=form.querySelector('[name="espessuraMm"]');
   if(thick)thick.value=it.thickness!==null?String(it.thickness):'';
   const width=form.querySelector('[name="chapaLarguraMm"]');
   const length=form.querySelector('[name="chapaComprimentoMm"]');
   if(width)width.value=it.dimensionsConfirmed&&it.width?String(it.width):'';
   if(length)length.value=it.dimensionsConfirmed&&it.length?String(it.length):'';
   const cost=form.querySelector('[name="custo"]');
   if(cost)cost.value=Number.isFinite(it.price)?it.price.toFixed(2):'';
  }
  resetDialog();input.focus();
 }
 function estimate(it,quantity,unitPrice){
  const qty=Number(quantity),cost=Number(unitPrice);
  if(!it||String(unitPrice).trim()===''||!Number.isInteger(qty)||qty<1||qty>9999||!Number.isFinite(cost)||cost<=0||cost>1000000)return null;
  return Math.round(cost*100)*qty/100;
 }
 function updateQuote(){
  if(!dialog||!quoteItem)return null;
  const quantity=dialog.querySelector('#uaMatQuantity')?.value||'';
  const cost=dialog.querySelector('#uaMatUnitPrice')?.value||'';
  const total=estimate(quoteItem,quantity,cost);
  const result=dialog.querySelector('#uaMatTotal');
  if(result)result.textContent=total===null?'Informe quantidade e valor válidos.':money(total);
  return total;
 }
 function simulate(it){
  if(!dialog)return;
  quoteItem=it;
  const section=dialog.querySelector('#uaMatSimulator');
  section.hidden=false;
  dialog.querySelector('#uaMatQuoteName').textContent=it.name+' · '+it.unit;
  dialog.querySelector('#uaMatQuantity').value='1';
  dialog.querySelector('#uaMatUnitPrice').value=Number.isFinite(it.price)?it.price.toFixed(2):'';
  const note=dialog.querySelector('#uaMatQuoteHint');
  if(note)note.textContent='Informe o preço cotado de cada '+it.unit+'. Simulação sem frete, impostos ou garantia de disponibilidade.';
  updateQuote();section.scrollIntoView?.({behavior:'smooth',block:'nearest'});
 }
 function quoteText(){
  if(!dialog||!quoteItem)return '';
  const quantity=dialog.querySelector('#uaMatQuantity')?.value||'';
  const price=dialog.querySelector('#uaMatUnitPrice')?.value||'';
  const total=estimate(quoteItem,quantity,price);
  if(total===null)return '';
  return 'UNIVERSA ART — Simulação de material\nMaterial: '+quoteItem.name+
   '\nCódigo: '+quoteItem.id+'\nQuantidade: '+quantity+' '+quoteItem.unit+
   '\nValor informado por '+quoteItem.unit+': '+money(Number(price))+
   '\nTotal estimado: '+money(total)+
   '\nValor informado manualmente, sem confirmar estoque, prazo, frete ou cotação do fornecedor.';
 }
 async function copyQuote(){
  const txt=quoteText();
  if(!txt){alert('Informe quantidade e preço válidos.');return}
  if(!navigator?.clipboard?.writeText){alert('Cópia indisponível neste navegador.');return}
  try{await navigator.clipboard.writeText(txt);
   const el=dialog?.querySelector('#uaMatCopyStatus');if(el)el.textContent='Estimativa copiada.';
  }catch(error){alert('Não foi possível copiar a estimativa.')}
 }
 async function open(button){
  const form=button?.closest('form');if(!form)return false;
  if(!form.querySelector('[name="material"]')&&!form.querySelector('[name="nome"]'))return false;
  if(opening)return false;opening=true;
  try{
   await ensureData();
   if(!form.isConnected)return false;
   resetDialog();targetForm=form;
   const el=document.createElement('dialog');
   el.className='ua-mat-dialog';
   el.setAttribute('aria-label','Catálogo de materiais UNIVERSA ART');
   el.innerHTML='<div class="ua-mat-header"><div><h2>Catálogo de Materiais — UNIVERSA ART</h2>'+
    '<p>218 referências da planilha própria, incluindo 128 referências MDF. Sem ligação com o estoque.</p></div>'+
    '<button type="button" class="btn small" id="uaMatClose">Fechar</button></div>'+
    '<p class="ua-mat-warning" role="status">'+escape(priceNotice())+'</p>'+
    '<div class="ua-mat-filters">'+
    '<label>Categoria<select id="uaMatCategory"><option value="">Todos os materiais</option>'+
    Object.entries(groups).map(([k,v])=>'<option value="'+escape(k)+'">'+escape(v)+'</option>').join('')+'</select></label>'+
    '<label>Pesquisar por nome ou código<input id="uaMatQuery" type="search" placeholder="Ex.: MAT-014, Amêndola, bucha 8 mm"></label>'+
    '<label>Fabricante<select id="uaMatBrand"></select></label>'+
    '<label>Espessura / Medida (mm)<select id="uaMatSize"></select></label>'+
    '<label>Cor / Padrão<select id="uaMatColor"></select></label></div>'+
    '<div class="ua-mat-filter-tools"><p id="uaMatCount" role="status"></p><button type="button" class="btn small" id="uaMatClear">Limpar filtros</button></div>'+
    '<p class="ua-mat-filter-notice" id="uaMatNotice" role="status" hidden></p>'+
    '<div id="uaMatResults" class="ua-mat-results"></div>'+
    '<div class="ua-mat-paging"><button type="button" class="btn" id="uaMatMore" hidden>Mostrar mais materiais</button></div>'+
    '<section class="ua-mat-simulator" id="uaMatSimulator" hidden>'+
    '<h3>Simular custo para o cliente</h3><p id="uaMatQuoteName"></p>'+
    '<div class="ua-mat-sim-grid"><label>Quantidade<input id="uaMatQuantity" type="number" step="1" min="1" max="9999" value="1"></label>'+
    '<label>Preço cotado por unidade (R$)<input id="uaMatUnitPrice" type="number" min="0.01" max="1000000" step="0.01" placeholder="Informe o valor cotado"></label></div>'+
    '<p class="ua-mat-sim-total">Total estimado: <strong id="uaMatTotal">A calcular</strong></p>'+
    '<p id="uaMatQuoteHint" class="ua-mat-sim-hint"></p>'+
    '<button type="button" class="btn small" id="uaMatCopy">Copiar estimativa</button><span id="uaMatCopyStatus" aria-live="polite"></span></section>'+
    '<p class="ua-mat-foot">Padrões MDF sem espessura confirmada exigem conferência técnica. O catálogo é uma referência para projetos e cotações, não representa compras ou saldo físico. Alterações futuras no Excel não sincronizam automaticamente.</p>';
   document.body.append(el);dialog=el;
   el.querySelector('#uaMatClose').addEventListener('click',resetDialog);
   el.querySelector('#uaMatCategory').addEventListener('change',()=>refreshFilters('category'));
   for(const key of ['Brand','Size','Color'])el.querySelector('#uaMat'+key).addEventListener('change',()=>refreshFilters(key.toLowerCase()));
   el.querySelector('#uaMatQuery').addEventListener('input',()=>{notice='';limit=PAGE_SIZE;renderItems()});
   el.querySelector('#uaMatClear').addEventListener('click',clearFilters);
   el.querySelector('#uaMatMore').addEventListener('click',()=>{limit+=PAGE_SIZE;renderItems()});
   el.querySelector('#uaMatQuantity').addEventListener('input',updateQuote);
   el.querySelector('#uaMatUnitPrice').addEventListener('input',updateQuote);
   el.querySelector('#uaMatCopy').addEventListener('click',copyQuote);
   el.addEventListener('click',event=>{
    const select=event.target.closest('[data-ua-mat-select]');
    if(select){const item=visible[Number(select.dataset.uaMatSelect)];if(item)apply(item)}
    const sim=event.target.closest('[data-ua-mat-quote]');
    if(sim){const item=visible[Number(sim.dataset.uaMatQuote)];if(item)simulate(item)}
   });
   el.addEventListener('close',()=>{if(dialog===el)resetDialog()},{once:true});
   el.showModal();refreshFilters();el.querySelector('#uaMatQuery').focus();
   return true;
  }catch(error){
   alert('Não foi possível abrir o catálogo UNIVERSA ART: '+String(error?.message||error));
   return false;
  }finally{opening=false}
 }
 document.addEventListener('click',event=>{
  const button=event.target.closest('[data-ua-material-open]');
  if(button){event.preventDefault();open(button)}
 });
 window.universaArtCatalogoProprio={
  get items(){return items()},ensureData,filter,open,close:resetDialog,
  priceNotice,estimate,quoteText,PAGE_SIZE,groups
 };
})();