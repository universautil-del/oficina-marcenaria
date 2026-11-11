'use strict';
/* OFICINA 1.0 | Central de integrações.
 * Leitura e rascunhos; NÃO cria pedido, reserva, baixa ou lançamento ao visualizar.
 * A entrada de materiais só é gravada com Salvar e recebida com confirmação separada.
 */
(function(){
 const safe=value=>esc(String(value??''));
 const list=key=>Array.isArray(db[key])?db[key]:[];
 const finite=value=>Number.isFinite(Number(value))?Number(value):0;
 const fmtQty=n=>Number((Math.max(0,finite(n))).toFixed(3)).toLocaleString('pt-BR',{maximumFractionDigits:3});
 const normalize=name=>String(name??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toLowerCase();
 const today=()=>iso();

 function analyzeCutlist(project){
  const parts=project?.cutlist?.parts;
  if(!Array.isArray(parts)||!parts.length)throw Error('Este projeto ainda não tem uma lista SketchUp/OpenCutList importada.');
  const checked=window.universaArtProjectBridge?.normalizeParts?.(parts);
  if(!Array.isArray(checked)||!checked.length)throw Error('Não foi possível validar a lista de peças em milímetros.');
  const groups=new Map();
  let pieceCount=0,area=0,edge=0;
  for(const p of checked){
   const key=normalize(p.material)+'|'+p.thickness;
   const row=groups.get(key)||{material:p.material,thickness:p.thickness,pieces:0,areaM2:0,edgeM:0,productId:''};
   const m2=p.length*p.width*p.qty/1e6;
   row.areaM2+=m2;
   row.edgeM+=p.edge*p.qty; // campo do arquivo é fita de borda em metros POR peça
   row.pieces+=p.qty;pieceCount+=p.qty;area+=m2;edge+=p.edge*p.qty;
   groups.set(key,row);
  }
  const products=list('products').filter(p=>p.tipo==='materia');
  for(const row of groups.values()){
   const matches=products.filter(p=>normalize(p.nome)===normalize(row.material));
   if(matches.length===1)row.productId=matches[0].id;
  }
  return {
   projectId:project.id,
   count:pieceCount,types:checked.length,
   areaM2:Number(area.toFixed(3)),edgeM:Number(edge.toFixed(3)),
   groups:[...groups.values()].map(g=>({...g,areaM2:Number(g.areaM2.toFixed(3)),edgeM:Number(g.edgeM.toFixed(3))})),
   missing:checked.filter(p=>p.thickness<=0||normalize(p.material)==='material nao definido').length,
   importedAt:project.cutlist.importedAt||''
  };
 }
 function proposedPurchase(){
  const pending=new Map();
  for(const pur of list('purchases').filter(p=>p.status==='aberta')){
   for(const item of (pur.items||[])){
    if(!item.productId)continue;
    pending.set(item.productId,(pending.get(item.productId)||0)+Math.max(0,finite(item.quantidade)));
   }
  }
  return list('products').filter(p=>p.tipo==='materia'&&finite(p.minimo)>0).map(p=>{
   const stock=Math.max(0,finite(p.estoque)),minimum=Math.max(0,finite(p.minimo));
   const arriving=pending.get(p.id)||0;
   const shortage=stock<=minimum?Math.max(0,minimum-stock-arriving):0;
   const recommended=Number((shortage>0?shortage:(stock<=minimum&&arriving===0?1:0)).toFixed(3));
   return {productId:p.id,codigo:p.codigo||'',name:p.nome||'',unit:p.unidade||'un',
    stock,minimum,arriving,recommended,cost:Math.max(0,finite(p.custo))};
  }).filter(p=>p.stock<=p.minimum);
 }
 function daysUntil(date){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(date||'')))return null;
  const ms=Date.parse(date+'T12:00:00Z'),now=Date.parse(today()+'T12:00:00Z');
  if(!Number.isFinite(ms)||!Number.isFinite(now))return null;
  return Math.round((ms-now)/86400000);
 }
 function alerts(){
  const orders=list('orders').filter(o=>!['entregue','cancelado'].includes(o.status))
   .map(o=>({...o,days:daysUntil(o.entregaData)}))
   .filter(o=>o.days!==null&&o.days<=7).sort((a,b)=>a.days-b.days).slice(0,8);
  const financial=list('transactions').filter(t=>t.kind==='pagar'||t.kind==='receber')
   .map(t=>({...t,days:daysUntil(t.dueDate),remaining:typeof balance==='function'?balance(t):Math.max(0,finite(t.valor))}))
   .filter(t=>t.days!==null&&t.days<=7&&t.remaining>0.005)
   .sort((a,b)=>a.days-b.days).slice(0,8);
  return {orders,financial};
 }
 function shortDate(date){return /^\d{4}-\d{2}-\d{2}$/.test(String(date||''))?date.slice(8,10)+'/'+date.slice(5,7):'Sem data'}
 function dueLabel(days){return days<0?'Atrasado '+Math.abs(days)+' dia(s)':days===0?'Hoje':'Em '+days+' dia(s)'}
 function control(o){return String(o.controlCode||'#'+o.number)}
 function goto(section){location.hash=section;render(section)}
 function modalForProject(pid){
  const project=list('projects').find(p=>p.id===pid);
  if(!project)throw Error('Projeto não encontrado.');
  const report=analyzeCutlist(project);
  const rows=report.groups.slice(0,25).map(g=>td(
   safe(g.material),safe(g.thickness)+' mm',String(g.pieces),
   fmtQty(g.areaM2)+' m²',fmtQty(g.edgeM)+' m',
   g.productId?'<span class="ua-int-connected">Cadastrado</span>':'<span class="ua-int-pending">Conferir vínculo</span>'
  ));
  const html='<p class="ua-int-note"><strong>'+safe(project.nome)+'</strong> · '+report.count+' peças · '+fmtQty(report.areaM2)+' m² de área bruta · '+fmtQty(report.edgeM)+' m de fita informada na lista.</p>'+
   (report.missing?'<p class="ua-int-warning">'+report.missing+' tipo(s) de peça sem material ou espessura definida.</p>':'')+
   table(['Material da lista','Esp.','Peças','Área bruta','Fita informada','Cadastro'],rows,'Sem peças')+
   '<p class="muted small">Área calculada a partir das medidas das peças, sem perdas nem otimização de chapas. Não é possível determinar quantas chapas ou ferragens comprar sem dimensões das chapas, plano de corte e especificações das ferragens. Revise materiais, bordas, folgas e medidas na obra antes de aprovar.</p>'+
   '<p class="muted small">Materiais só são vinculados automaticamente ao cadastro quando os nomes coincidem exatamente e não há ambiguidade. Nenhum estoque ou valor foi movimentado.</p>'+
   '<div class="actions gap-top"><button type="button" class="btn primary" data-ua-int-action="quote" data-project-id="'+safe(pid)+'">Preparar orçamento deste projeto</button>'+
   '<button type="button" class="btn" data-ua-int-action="sketchup" data-project-id="'+safe(pid)+'">Revisar lista SketchUp</button></div>';
  openModal('Materiais do SketchUp — conferência',html,()=>false);
  return report;
 }
 function newQuote(pid){
  const project=list('projects').find(p=>p.id===pid);
  if(!project)throw Error('Projeto não encontrado.');
  if(!project.clientId||!list('clients').some(c=>c.id===project.clientId)){
   throw Error('Associe um cliente ao projeto antes de preparar o orçamento.');
  }
  openSales('quote','',project.id);
 }
 function suggestionsModal(){
  const low=proposedPurchase();
  const suggestions=low.filter(p=>p.recommended>0&&p.cost>0);
  if(!low.length)return alert('Nenhum material está abaixo do estoque mínimo configurado.');
  const pending=low.filter(p=>p.recommended<=0);
  const lackingCost=low.filter(p=>p.recommended>0&&p.cost<=0);
  const rows=suggestions.map(p=>
   '<label class="ua-int-buy-row"><input type="checkbox" name="materials" value="'+safe(p.productId)+'" checked>'+
   '<span><strong>'+safe(p.codigo)+' · '+safe(p.name)+'</strong><small>Saldo '+fmtQty(p.stock)+' '+safe(p.unit)+' · mínimo '+fmtQty(p.minimum)+' · entradas em aberto '+fmtQty(p.arriving)+'</small></span>'+
   '<span class="ua-int-buy-amount">Sugestão <input type="number" name="qty-'+safe(p.productId)+'" min="0.001" step="0.001" max="100000" value="'+p.recommended+'" aria-label="Quantidade sugerida de '+safe(p.name)+'"> '+safe(p.unit)+'</span></label>'
  ).join('');
  const dlg=document.createElement('dialog');
  dlg.className='large ua-int-dialog';
  dlg.innerHTML='<form><h2>Sugestões de compra — estoque mínimo</h2>'+
   '<p class="muted">Somente um rascunho. Entradas já abertas são consideradas para evitar novas compras duplicadas. Confira as quantidades e o fornecedor.</p>'+
   (rows||'<p>Não há materiais com custo definido disponíveis para sugestão.</p>')+
   (pending.length?'<p class="muted small">'+pending.length+' material(is) já estão cobertos por entradas pendentes.</p>':'')+
   (lackingCost.length?'<p class="ua-int-warning">'+lackingCost.length+' material(is) precisam de custo unitário no cadastro antes de gerar a entrada.</p>':'')+
   '<div class="dialog-actions"><button type="button" class="btn" data-ua-int-close>Cancelar</button>'+
   '<button type="submit" class="btn primary" '+(suggestions.length?'':'disabled')+'>Revisar entrada de materiais</button></div></form>';
  document.body.append(dlg);
  dlg.querySelector('[data-ua-int-close]').onclick=()=>dlg.close();
  dlg.addEventListener('close',()=>dlg.remove(),{once:true});
  dlg.querySelector('form').onsubmit=e=>{
   e.preventDefault();
   try{
    const inputs=[...dlg.querySelectorAll('input[name="materials"]:checked')];
    if(!inputs.length)throw Error('Selecione ao menos um material.');
    const prefill=inputs.map(input=>{
     const p=suggestions.find(x=>x.productId===input.value);
     const qty=Number(dlg.querySelector('[name="qty-'+input.value+'"]').value);
     if(!p||!Number.isFinite(qty)||qty<=0||qty>100000)throw Error('Confira as quantidades sugeridas.');
     return {productId:p.productId,quantidade:Number(qty.toFixed(3)),custo:p.cost};
    });
    dlg.close();purchaseModal(prefill);
   }catch(err){alert(err.message||'Não foi possível preparar a entrada.')}
  };
  dlg.showModal();
  return low;
 }
 function whatsAppOrder(oid){
  const order=list('orders').find(o=>o.id===oid);
  if(!order)throw Error('Pedido não encontrado.');
  const client=list('clients').find(c=>c.id===order.clientId);
  if(!client)throw Error('Cliente do pedido não encontrado.');
  let phone=String(client.telefone||'').replace(/\D/g,'');
  if(phone.length===10||phone.length===11)phone='55'+phone;
  if(!/^55\d{10,11}$/.test(phone))throw Error('O cliente não possui telefone/WhatsApp brasileiro válido. Atualize o cadastro.');
  const msg='Olá! Aqui é da UNIVERSA ART. Estou entrando em contato sobre o pedido '+control(order)+
   (order.entregaData?' (entrega prevista: '+shortDate(order.entregaData)+')':'')+
   '. Podemos confirmar o andamento?';
  const url='https://wa.me/'+phone+'?text='+encodeURIComponent(msg);
  window.open(url,'_blank','noopener,noreferrer'); // apenas abre, não envia
  return url;
 }
 function quickActions(){
  const low=proposedPurchase(),due=alerts();
  const recent=list('projects').filter(p=>p.cutlist?.parts?.length).slice(-5).reverse();
  const projects=recent.map(p=>'<option value="'+safe(p.id)+'">'+safe(p.nome)+'</option>').join('');
  return '<section class="panel gap-top ua-integrations" id="uaIntegrationsHub">'+
   '<div class="panel-head"><h3>Central de integrações</h3><span class="muted small">Reaproveite dados. Nada é lançado sem confirmação.</span></div>'+
   '<div class="ua-int-cards">'+
    '<div><strong>SketchUp → Projeto → Orçamento</strong><p>Confira área de MDF, fita de borda e materiais importados antes de precificar.</p>'+
      (projects?'<label>Projeto com peças<select id="uaIntProject">'+projects+'</select></label><button class="btn" type="button" data-ua-int-action="materials-selected">Ver materiais</button>':
      '<p class="muted small">Importe uma lista no menu SketchUp e vincule a um projeto.</p>')+'</div>'+
    '<div><strong>Estoque → Entrada de Materiais</strong><p>'+low.filter(p=>p.recommended>0).length+' matéria(s)-prima(s) com sugestão de reposição; entradas abertas são descontadas.</p>'+
      '<button class="btn" type="button" data-ua-int-action="purchase-suggest">Preparar compra sem duplicar</button></div>'+
    '<div><strong>Pedidos → Agenda e financeiro</strong><p>'+due.orders.length+' entrega(s) e '+due.financial.length+' conta(s) com prazo em até 7 dias ou vencido.</p>'+
      '<button class="btn" type="button" data-ua-int-action="orders">Abrir pedidos</button> '+
      '<button class="btn" type="button" data-ua-int-action="finance">Abrir financeiro</button></div>'+
   '</div>'+
   (due.orders.length?'<h4>Próximas entregas e atrasos</h4><div class="ua-int-reminders">'+due.orders.map(o=>
    '<div class="ua-int-reminder"><span><strong>'+safe(control(o))+'</strong> · '+safe(o.clientNome)+' <small>'+safe(shortDate(o.entregaData))+' · '+safe(dueLabel(o.days))+'</small></span>'+
    '<div class="actions"><button class="btn small" data-ua-int-action="order" data-id="'+safe(o.id)+'">Pedidos</button>'+
    '<button class="btn small" data-ua-int-action="whatsapp" data-id="'+safe(o.id)+'">WhatsApp</button></div></div>'
   ).join('')+'</div>':'')+
   (due.financial.length?'<h4>Contas a vencer ou vencidas</h4><div class="ua-int-reminders">'+due.financial.map(t=>
    '<div class="ua-int-reminder"><span><strong>'+safe(t.kind==='receber'?'A receber':'A pagar')+'</strong> · '+safe(t.descricao||'Lançamento')+
    '<small>'+safe(shortDate(t.dueDate))+' · '+safe(dueLabel(t.days))+' · '+safe(money(t.remaining))+'</small></span>'+
    '<button class="btn small" type="button" data-ua-int-action="finance">Financeiro</button></div>'
   ).join('')+'</div>':'')+
   '<p class="muted small">Os alertas aparecem ao abrir o painel. O WhatsApp abre uma mensagem para revisão, sem envio automático. Lembretes fora do site não estão ativados.</p>'+
   '</section>';
 }
 function enhance(section){
  if(!content||!content.isConnected)return;
  if(section==='dashboard'&&!content.querySelector('#uaIntegrationsHub'))content.insertAdjacentHTML('beforeend',quickActions());
  if(section==='produtos'||section==='compras'){
   const actions=content.querySelector('.toolbar .actions');
   if(actions&&!actions.querySelector('[data-ua-int-action="purchase-suggest"]')){
    const btn=document.createElement('button');btn.type='button';btn.className='btn small';btn.dataset.uaIntAction='purchase-suggest';
    btn.textContent='Sugestão de compra';actions.append(btn);
   }
  }
  if(section==='projetos'){
   content.querySelectorAll('[data-action="ua-project-quote"]').forEach(quote=>{
    if(quote.parentElement?.querySelector('[data-ua-int-action="materials"]'))return;
    const btn=document.createElement('button');btn.type='button';btn.className='btn small';
    btn.dataset.uaIntAction='materials';btn.dataset.projectId=quote.dataset.id;
    btn.textContent='Conferir materiais';quote.after(btn);
   });
  }
 }
 const oldRender=render;
 render=function(section=location.hash.slice(1)||'dashboard'){
  oldRender(section);
  enhance(location.hash.slice(1)||section);
 };
 document.addEventListener('click',event=>{
  const button=event.target?.closest?.('[data-ua-int-action]');
  if(!button)return;
  try{
   const action=button.dataset.uaIntAction;
   if(action==='materials-selected'){
    const id=content.querySelector('#uaIntProject')?.value;
    if(id)modalForProject(id);
   }else if(action==='materials')modalForProject(button.dataset.projectId);
   else if(action==='quote'){
    button.closest('dialog')?.close();newQuote(button.dataset.projectId);
   }else if(action==='sketchup'){
    button.closest('dialog')?.close();window.universaArtProjectBridge?.openForProject(button.dataset.projectId);
   }else if(action==='purchase-suggest')suggestionsModal();
   else if(action==='orders'||action==='order')goto('pedidos');
   else if(action==='finance')goto('financeiro');
   else if(action==='whatsapp')whatsAppOrder(button.dataset.id);
  }catch(error){alert(error.message||'Integração indisponível. Confira os dados antes de continuar.')}
 });
 window.universaArtIntegracoes={analyzeCutlist,proposedPurchase,alerts,modalForProject,suggestionsModal,whatsAppOrder,quickActions,enhance};
 if(window.oficinaCloud?.active)enhance(location.hash.slice(1)||'dashboard');
})();