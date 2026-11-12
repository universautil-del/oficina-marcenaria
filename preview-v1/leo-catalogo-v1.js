'use strict';
/* Consulta de referência ao catálogo público da Léo Madeiras.
   Não consulta estoque de filial, não afirma preços ao vivo e NÃO movimenta dados.
   Confirme disponibilidade, CEP, preço, embalagem e condições com a loja. */
(function(){
 const checkedOn='12/11/2026';
 const categories={
  mdf:{label:'MDF / chapas',url:'https://checkout.leomadeiras.com.br/mdf'},
  parafusos:{label:'Parafusos',url:'https://checkout.leomadeiras.com.br/ferragens/ferragens-tecnicas/parafusos'},
  buchas:{label:'Buchas',url:'https://checkout.leomadeiras.com.br/ferragens/ferragens-tecnicas/buchas'},
  fitas:{label:'Fitas de borda',url:'https://checkout.leomadeiras.com.br/fitas-e-tapa-furos'}
 };
 const items=[
  {category:'mdf',name:'MDF Branco Ártico Texturizado Duratex 15 mm · 2750 x 1840 mm · 2 faces',price:410.90,unit:'chapa',thickness:15,dimensions:[2750,1840]},
  {category:'mdf',name:'MDF Amêndola Rústica Duratex 15 mm · 2750 x 1850 mm · 2 faces',price:419.90,unit:'chapa',thickness:15,dimensions:[2750,1850]},
  {category:'mdf',name:'MDF Cru Duratex 15 mm · 2750 x 1850 mm',price:286.90,unit:'chapa',thickness:15,dimensions:[2750,1850]},
  {category:'mdf',name:'MDF Cru Duratex 18 mm · 2750 x 1850 mm',price:344.90,unit:'chapa',thickness:18,dimensions:[2750,1850]},
  {category:'mdf',name:'MDF Branco Ártico Texturizado Duratex 6 mm · 2750 x 1840 mm · 2 faces',price:280.90,unit:'chapa',thickness:6,dimensions:[2750,1840]},
  {category:'parafusos',name:'Parafuso ChipBoard Philips Leo 3,5 x 25 mm · pacote 100 un',price:2.49,unit:'pacote'},
  {category:'parafusos',name:'Parafuso ChipBoard Philips Leo 3,5 x 30 mm · pacote 100 un',price:2.69,unit:'pacote'},
  {category:'parafusos',name:'Parafuso ChipBoard Philips Leo 4 x 20 mm · pacote 100 un',price:2.69,unit:'pacote'},
  {category:'parafusos',name:'Parafuso ChipBoard Philips Leo 4 x 40 mm · pacote 100 un',price:2.99,unit:'pacote'},
  {category:'parafusos',name:'Parafuso ChipBoard Philips Leo 4 x 50 mm · pacote 100 un',price:3.49,unit:'pacote'},
  {category:'buchas',name:'Bucha de nylon Leo 8 mm · pacote 100 un',price:16.90,unit:'pacote'},
  {category:'buchas',name:'Bucha de nylon Fischer 10 mm · pacote 50 un',price:15.90,unit:'pacote'},
  {category:'buchas',name:'Bucha de nylon Leo 12 mm · pacote 50 un',price:8.90,unit:'pacote'},
  {category:'fitas',name:'Fita de borda branca texturizada Rehau 22 mm · rolo 20 m',price:14.90,unit:'pacote'},
  {category:'fitas',name:'Fita de borda branca texturizada Tegus 35 mm · rolo 20 m',price:19.90,unit:'pacote'}
 ];
 let dialog=null,target=null,visible=[];
 const format=n=>Number(n).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
 const escape=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;',"'":'&#39;'}[ch]));
 const normalized=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
 function filter(category='',query=''){
  const term=normalized(query).trim();
  return items.filter(p=>(!category||category===p.category)&&(!term||normalized(p.name).includes(term)));
 }
 function priceNotice(){
  return 'Valores anunciados no catálogo público em '+checkedOn+', somente para referência. Preço e estoque NÃO são verificados em tempo real. Verifique o CEP, a disponibilidade e o valor final com a loja antes de comprar.';
 }
 function close(){
  if(!dialog)return;
  const current=dialog;dialog=null;target=null;visible=[];
  if(current.open)current.close();
  current.remove();
 }
 function renderList(){
  if(!dialog)return;
  const category=dialog.querySelector('#uaLeoCategory')?.value||'';
  const query=dialog.querySelector('#uaLeoQuery')?.value||'';
  visible=filter(category,query);
  const table=dialog.querySelector('#uaLeoResults');
  const link=dialog.querySelector('#uaLeoCategoryLink');
  if(link)link.href=categories[category]?.url||'https://www.leomadeiras.com.br/categorias';
  if(table)table.innerHTML=visible.length?visible.map((item,index)=>
   '<div class="ua-leo-item">'+
    '<div><strong>'+escape(item.name)+'</strong>'+
    '<small>'+escape(categories[item.category].label)+' · '+escape(item.unit)+'</small></div>'+
    '<div class="ua-leo-price"><b>'+format(item.price)+'</b><small>Referência, não cotação</small></div>'+
    '<div class="ua-leo-item-actions"><button type="button" class="btn small" data-ua-leo-use="'+index+'">Selecionar</button>'+
    '<a href="'+categories[item.category].url+'" target="_blank" rel="noopener noreferrer" class="btn small">Ver na Léo</a></div>'+
   '</div>').join(''):'<p class="ua-leo-empty">Nenhum exemplo nessa busca. Abra o catálogo da Léo para procurar outras opções.</p>';
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
   if(priceField&&wantCost)priceField.value=String(item.price.toFixed(2));
  }
  close();
  input.focus();
 }
 function open(button){
  const form=button.closest('form');
  if(!form)return false;
  const input=form.querySelector('[name="material"]')||form.querySelector('[name="nome"]');
  if(!input)return false;
  close();
  target=form;
  const el=document.createElement('dialog');
  el.className='ua-leo-dialog';
  el.setAttribute('aria-label','Consultar materiais da Léo Madeiras');
  const editingProduct=input.name==='nome';
  el.innerHTML='<div class="ua-leo-header"><div><h2>Materiais da Léo Madeiras</h2>'+
   '<p>Veja exemplos de MDF, parafusos, buchas e fitas para escolher no projeto.</p></div>'+
   '<button class="btn small" type="button" id="uaLeoClose">Fechar</button></div>'+
   '<p class="ua-leo-warning" role="status">'+escape(priceNotice())+'</p>'+
   '<div class="ua-leo-filters"><label>Categoria<select id="uaLeoCategory">'+
   '<option value="">Todas as categorias</option>'+
   Object.entries(categories).map(([key,c])=>'<option value="'+escape(key)+'">'+escape(c.label)+'</option>').join('')+
   '</select></label><label>Pesquisar produto<input id="uaLeoQuery" type="search" placeholder="Ex.: MDF 15 mm, parafuso 4 x 40"></label></div>'+
   '<div id="uaLeoResults" class="ua-leo-results"></div>'+
   (editingProduct?'<label class="ua-leo-opt"><input id="uaLeoFillCost" type="checkbox"> Preencher o custo com o preço de referência (confirme antes de salvar)</label>':'')+
   '<p class="ua-leo-foot"><a class="btn" id="uaLeoCategoryLink" target="_blank" rel="noopener noreferrer" href="https://www.leomadeiras.com.br/categorias">Abrir catálogo oficial da Léo Madeiras</a> A seleção apenas preenche o campo; não cadastra, compra, reserva ou altera estoque automaticamente.</p>';
  document.body.append(el);
  dialog=el;
  el.querySelector('#uaLeoClose').addEventListener('click',close);
  el.querySelector('#uaLeoCategory').addEventListener('change',renderList);
  el.querySelector('#uaLeoQuery').addEventListener('input',renderList);
  el.addEventListener('click',event=>{
   const pick=event.target.closest('[data-ua-leo-use]');
   if(pick){
    const item=visible[Number(pick.dataset.uaLeoUse)];
    if(item)apply(item);
   }
  });
  el.addEventListener('close',()=>{
   if(dialog===el)close();
  },{once:true});
  el.showModal();
  renderList();
  el.querySelector('#uaLeoQuery').focus();
  return true;
 }
 document.addEventListener('click',event=>{
  const button=event.target.closest('[data-ua-leo-open]');
  if(!button)return;
  event.preventDefault();
  open(button);
 });
 window.universaArtLeoCatalogo={items,categories,filter,priceNotice,open,close};
})();