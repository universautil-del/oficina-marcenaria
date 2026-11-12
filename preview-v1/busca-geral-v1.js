'use strict';
/* UNIVERSA ART — Busca integrada e criação rápida.
   Apenas leitura. Respeita o portal autenticado e não altera banco de dados.
   Atalhos para criação reaproveitam os mesmos formulários já validados. */
(function(){
 const LIMIT=18;
 let activeDialog=null,searchField=null,resultsPanel=null,visible=[];
 const safe=value=>esc(String(value??''));
 const clean=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .replace(/\s+/g,' ').trim().toLocaleLowerCase('pt-BR');
 const rows=kind=>Array.isArray(db?.[kind])?db[kind]:[];
 const allowed=()=>!window.UNIVERSA_REQUIRE_AUTH||!!window.oficinaCloud?.active;
 const candidates=()=>{
  const out=[];
  const push=(section,kind,name,secondary='',term='')=>{
   if(!String(name||'').trim())return;
   out.push({section,kind,name:String(name),secondary:String(secondary||''),term:String(term||name)});
  };
  for(const c of rows('clients'))push('cadastros','Cliente',c.nome,c.cidade||'');
  for(const f of rows('suppliers'))push('cadastros','Fornecedor',f.nome,f.cidade||'');
  for(const p of rows('projects'))push('projetos','Projeto',p.nome,p.ambiente||'');
  for(const o of rows('quotes'))push('orcamentos','Orçamento',o.controlCode||'#'+o.number,o.clientNome||'',o.controlCode||String(o.number||''));
  for(const o of rows('orders'))push('pedidos','Pedido',o.controlCode||'#'+o.number,o.clientNome||'',o.controlCode||String(o.number||''));
  for(const p of rows('products'))push('produtos','Material',p.nome,p.codigo?'Cód. '+p.codigo:'');
  for(const p of rows('purchases'))push('compras','Entrada de materiais','#'+(p.number||''),p.supplierNome||'',String(p.number||''));
  for(const t of rows('transactions'))push('financeiro',t.kind==='pagar'?'Despesa':'Receita',t.descricao,
   (t.dueDate?String(t.dueDate).slice(8,10)+'/'+String(t.dueDate).slice(5,7)+'/'+String(t.dueDate).slice(0,4):''));
  return out;
 };
 function searchAll(query){
  const tokens=clean(query).split(' ').filter(Boolean);
  if(!tokens.length)return [];
  const results=[];
  for(const item of candidates()){
   const blob=clean([item.name,item.secondary,item.term,item.kind].join(' '));
   if(!tokens.every(token=>blob.includes(token)))continue;
   const matchesName=clean(item.name).startsWith(tokens[0]);
   results.push({...item,rank:matchesName?0:1});
  }
  return results.sort((a,b)=>a.rank-b.rank||a.name.localeCompare(b.name,'pt-BR')).slice(0,LIMIT);
 }
 function removeDialog(){
  if(activeDialog?.open)activeDialog.close();
  activeDialog?.remove();
  activeDialog=null;searchField=null;resultsPanel=null;visible=[];
 }
 function renderMatches(text){
  if(!resultsPanel)return;
  visible=searchAll(text);
  if(!String(text||'').trim()){
   resultsPanel.innerHTML='<p class="ua-quick-hint">Digite o nome, descrição, número do pedido ou código do material. Os resultados aparecem sem modificar seus registros.</p>';
   return;
  }
  resultsPanel.innerHTML=visible.length?visible.map((item,index)=>
   '<button type="button" class="ua-quick-result" data-ua-quick-index="'+index+'">'+
   '<span class="ua-quick-result-type">'+safe(item.kind)+'</span>'+
   '<span class="ua-quick-result-info"><strong>'+safe(item.name)+'</strong>'+
   (item.secondary?'<small>'+safe(item.secondary)+'</small>':'')+'</span>'+
   '<span aria-hidden="true">›</span></button>'
  ).join(''):'<p class="ua-quick-hint">Nenhum registro encontrado. Confira o termo ou abra o módulo correspondente.</p>';
 }
 function openSearch(){
  if(!allowed())return false;
  if(activeDialog?.open){searchField?.focus();return true}
  const dlg=document.createElement('dialog');
  dlg.className='ua-quick-dialog';
  dlg.setAttribute('aria-label','Busca geral da OFICINA');
  dlg.innerHTML='<div class="ua-quick-head"><h2>Busca geral</h2><button type="button" class="btn small" id="uaQuickClose" aria-label="Fechar a busca geral">Fechar</button></div>'+
   '<label for="uaQuickInput" class="ua-quick-label">Localize clientes, projetos, orçamentos, pedidos, materiais e contas</label>'+
   '<input id="uaQuickInput" class="ua-quick-input" type="search" maxlength="120" autocomplete="off" placeholder="Ex.: PED-2026-005, MDF branco, aluguel...">'+
   '<div id="uaQuickMatches" class="ua-quick-matches" aria-live="polite"></div>'+
   '<div class="ua-quick-tasks"><strong>Atalhos de trabalho</strong><div class="ua-quick-task-buttons">'+
   '<button type="button" class="btn" data-ua-quick-task="projeto">Novo projeto</button>'+
   '<button type="button" class="btn" data-ua-quick-task="orcamento">Novo orçamento</button>'+
   '<button type="button" class="btn" data-ua-quick-task="pedido">Novo pedido</button>'+
   '<button type="button" class="btn" data-ua-quick-task="entrada">Entrada de materiais</button>'+
   '<button type="button" class="btn" data-ua-quick-task="financeiro">Novo lançamento</button>'+
   '<button type="button" class="btn" data-ua-quick-task="seguranca">Segurança</button>'+
   '<button type="button" class="btn" data-ua-quick-task="backup">Backup</button>'+
   '</div></div>'+
   '<p class="ua-quick-footer">Atalho: Ctrl + K (ou ⌘ + K no Mac). Busca apenas nos registros que já estão carregados nesta sessão.</p>';
  document.body.append(dlg);
  activeDialog=dlg;
  searchField=dlg.querySelector('#uaQuickInput');
  resultsPanel=dlg.querySelector('#uaQuickMatches');
  dlg.querySelector('#uaQuickClose').addEventListener('click',removeDialog);
  dlg.addEventListener('close',()=>{
   if(activeDialog===dlg)removeDialog();
  },{once:true});
  searchField.addEventListener('input',()=>renderMatches(searchField.value));
  dlg.addEventListener('click',event=>{
   const target=event.target.closest('[data-ua-quick-index]');
   if(target){
    const item=visible[Number(target.dataset.uaQuickIndex)];
    if(item)gotoItem(item);
   }
   const task=event.target.closest('[data-ua-quick-task]');
   if(task)runTask(task.dataset.uaQuickTask);
  });
  renderMatches('');
  dlg.showModal();
  searchField.focus();
  return true;
 }
 function gotoItem(item){
  if(!allowed())return;
  removeDialog();
  const section=item.section;
  if(!sections.some(s=>s[0]===section))return alert('Módulo indisponível no momento.');
  // O termo permanece no filtro existente, sem abrir edição ou alterar dados.
  if(section==='cadastros')search.cadastros=item.name;
  else if(section==='orcamentos')search.orcamentos=item.term;
  else if(section==='pedidos')search.pedidos=item.term;
  else if(section==='produtos')search.produtos=item.name;
  else if(section==='compras')search.compras=item.term;
  else if(section==='financeiro')search.financeiro=item.name;
  location.hash=section;
  render(section);
  if(section==='projetos'){
   const input=content.querySelector('#v5ProjectSearch');
   if(input){input.value=item.name;input.dispatchEvent(new Event('input',{bubbles:true}))}
  }
 }
 function runTask(key){
  if(!allowed())return;
  removeDialog();
  if(key==='projeto'){location.hash='projetos';render('projetos');if(typeof v5ProjectModal==='function')v5ProjectModal('');return}
  if(key==='seguranca'||key==='backup'){const section=key==='seguranca'?'seguranca':'backupdrive';location.hash=section;render(section);return}
  if(key==='orcamento')return handleAction('new-quote','');
  if(key==='pedido')return handleAction('new-order','');
  if(key==='entrada')return handleAction('new-purchase','');
  if(key==='financeiro')return handleAction('new-transaction','');
 }
 function mountButton(){
  const header=document.querySelector('header.top');
  if(!header||header.querySelector('#uaOpenQuickSearch'))return;
  const button=document.createElement('button');
  button.type='button';button.id='uaOpenQuickSearch';
  button.className='btn ua-quick-trigger';
  button.setAttribute('aria-keyshortcuts','Control+K Meta+K');
  button.setAttribute('aria-label','Abrir busca geral e atalhos');
  button.textContent='⌕ Buscar em tudo';
  button.addEventListener('click',openSearch);
  header.insertBefore(button,header.querySelector('.ua-header-logo')||null);
 }
 document.addEventListener('keydown',event=>{
  if((event.ctrlKey||event.metaKey)&&String(event.key||'').toLowerCase()==='k'){
   if(!allowed())return;
   event.preventDefault();
   openSearch();
  }
 });
 window.addEventListener('ua-secure-change',()=>{
  if(!allowed())removeDialog();
 });
 window.addEventListener('pagehide',removeDialog);
 mountButton();
 window.universaArtBuscaGeral={searchAll,candidates,openSearch,removeDialog,allowed};
})();