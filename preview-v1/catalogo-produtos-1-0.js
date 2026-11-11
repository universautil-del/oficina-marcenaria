'use strict';
/* OFICINA 1.0 — catálogo unificado: matéria-prima + produto acabado.
 * Compatível com JSON versão 3 e produtos acabados legados (código MOV-...).
 * Nenhuma baixa de matéria-prima ocorre no cadastro ou na consulta de composição.
 */
(function(){
 const existingView=productsView,existingModal=productModal;
 let catalogTypeFilter='todos';
 function safe(s){return esc(String(s??''))}
 function getRawMaterials(){return (db.products||[]).filter(p=>p.tipo==='materia')}
 function getFinishedMaterials(){return (db.products||[]).filter(p=>p.tipo==='acabado')}
 function componentOptions(selected=''){
  return getRawMaterials().map(p=>'<option value="'+safe(p.id)+'"'+(String(selected)===String(p.id)?' selected':'')+'>'+safe(p.codigo||'')+' · '+safe(p.nome)+' ('+safe(p.unidade||'un')+')</option>').join('');
 }
 function componentRows(dialog){
  return [...dialog.querySelectorAll('.ua-product-component')].map(row=>({
   materialId:row.querySelector('[data-component-material]')?.value||'',
   quantidade:Number(row.querySelector('[data-component-qty]')?.value)
  }));
 }
 function validateComponents(rows){
  if(!Array.isArray(rows)||!rows.length)throw Error('Adicione ao menos uma matéria-prima à composição do produto acabado.');
  if(rows.length>120)throw Error('A composição pode ter no máximo 120 matérias-primas.');
  const used=new Set();
  return rows.map(row=>{
   const material=getRawMaterials().find(p=>String(p.id)===String(row.materialId));
   const qty=Number(row.quantidade);
   if(!material)throw Error('Selecione uma matéria-prima válida para todos os componentes.');
   if(!Number.isFinite(qty)||qty<=0||qty>100000)throw Error('A quantidade de cada matéria-prima precisa ser positiva e válida.');
   if(used.has(String(material.id)))throw Error('Matéria-prima repetida. Reúna as quantidades em uma única linha.');
   used.add(String(material.id));
   return {materialId:material.id,quantidade:Math.round(qty*1000)/1000};
  });
 }
 function addComponentRow(dialog,item={}){
  const wrap=dialog.querySelector('#uaBomRows');
  if(!wrap)return;
  const row=document.createElement('div');
  row.className='bom-row ua-product-component';
  row.innerHTML='<label>Matéria-prima<select data-component-material required><option value="">Selecione</option>'+componentOptions(item.materialId)+'</select></label>'+
   '<label>Quantidade por unidade<input data-component-qty required type="number" inputmode="decimal" min="0.001" max="100000" step="0.001" value="'+safe(item.quantidade||1)+'"></label>'+
   '<button type="button" class="btn small" data-remove-component>Remover</button>';
  wrap.append(row);
  const pick=row.querySelector('[data-component-material]');
  if(pick&&item.materialId)pick.value=String(item.materialId);
  row.querySelector('[data-remove-component]').onclick=()=>{row.remove();updateComponentCost(dialog)};
  row.querySelector('[data-component-qty]').addEventListener('input',()=>updateComponentCost(dialog));
  pick?.addEventListener('change',()=>updateComponentCost(dialog));
  updateComponentCost(dialog);
 }
 function updateComponentCost(dialog){
  const target=dialog.querySelector('#uaBomCost');
  if(!target)return;
  const rows=componentRows(dialog);
  let cost=0,valid=true;
  for(const row of rows){
   const material=getRawMaterials().find(p=>p.id===row.materialId);
   if(!material||!Number.isFinite(row.quantidade)||row.quantidade<=0){valid=false;continue}
   cost+=Number(material.custo||0)*row.quantidade;
  }
  target.textContent=valid&&rows.length?'Custo estimado dos componentes: '+money(Math.round(cost*100)/100):
   'Selecione materiais e quantidades para calcular o custo da composição.';
 }
 function refreshType(dialog){
  const type=dialog.querySelector('[name="tipo"]')?.value||'materia';
  const finished=type==='acabado';
  dialog.querySelectorAll('[data-ua-raw]').forEach(el=>{
   el.hidden=finished;
   el.querySelectorAll('input,select,textarea').forEach(field=>{field.disabled=finished});
  });
  dialog.querySelectorAll('[data-ua-finished]').forEach(el=>{
   el.hidden=!finished;
   el.querySelectorAll('input,select,textarea').forEach(field=>{field.disabled=!finished});
  });
  const nameLabel=dialog.querySelector('[data-product-name-label]');
  if(nameLabel)nameLabel.textContent=finished?'Descrição do produto acabado *':'Descrição da matéria-prima *';
  const hint=dialog.querySelector('#uaProductTypeHelp');
  if(hint)hint.textContent=finished?'Produto acabado: defina os materiais utilizados em uma unidade. A baixa será feita somente quando iniciar a produção de um pedido.':
   'Matéria-prima: configure custo, estoque e mínimo. As entradas de materiais atualizam o saldo ao confirmar o recebimento.';
  const title=dialog.querySelector('.ua-product-eyebrow');
  if(title)title.textContent=finished?'CADASTRO DE PRODUTO ACABADO':'CADASTRO DE MATÉRIA-PRIMA';
  updateComponentCost(dialog);
 }
 productsView=function(){
  const all=(db.products||[]).filter(p=>p.tipo==='materia'||p.tipo==='acabado');
  const raw=getRawMaterials(),finished=getFinishedMaterials(),q=String(search.produtos||'').toLowerCase();
  const low=raw.filter(p=>Number(p.estoque)<=Number(p.minimo));
  const rows=all.filter(p=>{
   const match=[p.nome,p.codigo,p.categoria,p.unidade,kindText[p.tipo]].some(x=>String(x||'').toLowerCase().includes(q));
   return match&&(catalogTypeFilter==='todos'||p.tipo===catalogTypeFilter)&&(!lowStockOnly||p.tipo==='materia'&&Number(p.estoque)<=Number(p.minimo));
  });
  content.innerHTML=
   intro('Produtos e Estoque','Cadastro de matérias-primas e produtos acabados com composição.',all.length+' produto(s)')+
   '<section class="panel"><div class="toolbar ua-materials-toolbar">'+inputSearch('produtos')+
   '<div class="actions">'+button('Registrar entrada','new-purchase','','small')+
   button(lowStockOnly?'Mostrar todos':'Estoque baixo ('+low.length+')','filter-low-stock','',lowStockOnly?'small accent':'small')+
   button('Produtos','new-raw','','primary')+'</div></div>'+
   '<label class="ua-product-filter">Exibir: <select id="uaProductTypeFilter" aria-label="Filtrar por tipo de produto">'+
   '<option value="todos"'+(catalogTypeFilter==='todos'?' selected':'')+'>Todos</option>'+
   '<option value="materia"'+(catalogTypeFilter==='materia'?' selected':'')+'>Matéria-prima</option>'+
   '<option value="acabado"'+(catalogTypeFilter==='acabado'?' selected':'')+'>Produto acabado</option></select></label>'+
   '<p class="ua-code-helper">Código automático de 01 até 9999. Próximo: <strong>'+safe(nextMaterialCode()||'Limite atingido')+'</strong></p>'+
   '<p class="ua-code-tip">Exibindo '+rows.length+' de '+all.length+' produtos ('+raw.length+' matérias-primas e '+finished.length+' acabados). Compras movimentam somente matérias-primas; produtos acabados usam uma composição de materiais sem baixa ao cadastrar.</p>'+
   table(['Código / Produto','Tipo','Custo / Venda','Estoque / Composição','Ações'],rows.map(p=>td(
    '<strong>'+safe(p.codigo||'Legado')+'</strong><div class="small muted">'+safe(p.nome)+' · '+safe(p.categoria||'Sem categoria')+'</div>',
    pill(kindText[p.tipo]||p.tipo),
    money(productCost(p))+'<br><span class="muted small">Venda: '+money(p.preco)+'</span>',
    p.tipo==='materia'?(dec(p.estoque)+' '+safe(p.unidade)+(Number(p.estoque)<=Number(p.minimo)?pill('Mínimo','warn'):'')):
      ((p.components||[]).length+' componente(s) · fabricação por pedido'),
    '<div class="row-actions">'+button('Editar','edit-product',p.id,'small')+
     (p.tipo==='materia'?button('Movimentar','adjust-stock',p.id,'small'):'')+
     button('Excluir','delete-product',p.id,'small danger')+'</div>'
   )))+'</section>'+
   '<section class="panel gap-top"><div class="panel-head"><h3>Movimentações recentes</h3>'+
   '<span class="muted small">'+raw.length+' matérias-primas</span></div>'+
   table(['Data','Material','Movimentação','Motivo'],(db.stockMovements||[]).slice(-15).reverse().map(m=>td(
     date(m.date),safe(getProduct(m.productId)?.nome||m.nome||'Produto excluído'),
     (m.delta>0?'+':'')+dec(m.delta),safe(m.note))))+'</section>';
  const filter=content.querySelector('#uaProductTypeFilter');
  if(filter)filter.onchange=()=>{catalogTypeFilter=filter.value;productsView()};
 };
 productModal=function(pid='',initialType='materia'){
  const existing=pid?(db.products||[]).find(p=>p.id===pid):null;
  if(pid&&!existing)return alert('Produto não encontrado.');
  const old=existing||{tipo:'materia',unidade:'un',estoque:0,minimo:0,preco:0,custo:0,components:[],observacoes:''};
  const code=String(old.codigo||nextMaterialCode());
  if(!code)return alert('Limite de 9999 códigos atingido. Revise os cadastros.');
  const units=['un','chapa','m','m²','m³','par','jogo','kg','pacote'];
  if(old.unidade&&!units.includes(old.unidade))units.push(old.unidade);
  const unitOptions=units.map(v=>'<option value="'+safe(v)+'"'+(old.unidade===v?' selected':'')+'>'+safe(v)+'</option>').join('');
  const type=existing?.tipo||(['materia','acabado'].includes(initialType)?initialType:'materia');
  const disable=existing?' disabled title="O tipo não pode ser alterado após o cadastro para preservar os pedidos"':'';
  const fields='<div class="ua-product-grid">'+
   '<label>Tipo de produto *<select name="tipo" required'+disable+'>'+
    '<option value="materia"'+(type==='materia'?' selected':'')+'>Matéria-prima</option>'+
    '<option value="acabado"'+(type==='acabado'?' selected':'')+'>Produto acabado</option></select></label>'+
   '<label>Código automático<input name="codigoDisplay" readonly aria-readonly="true" value="'+safe(code)+'" title="Código gerado automaticamente"></label>'+
   '<p class="ua-product-wide muted small" id="uaProductTypeHelp"></p>'+
   '<label>Unidade *<select name="unidade" required>'+unitOptions+'</select></label>'+
   '<label class="ua-product-wide"><span data-product-name-label>Descrição do produto *</span><input name="nome" required maxlength="180" placeholder="Ex.: Armário aéreo de MDF ou MDF branco TX 15 mm" value="'+safe(old.nome||'')+'"></label>'+
   '<label data-ua-raw>Estoque mínimo<input name="minimo" type="number" min="0" step="0.001" value="'+Number(old.minimo||0)+'"></label>'+
   '<label data-ua-raw>Custo unitário (R$)<input name="custo" type="number" min="0" step="0.01" value="'+Number(old.custo||0)+'"></label>'+
   '<label>Preço de venda (R$)<input name="preco" type="number" min="0" step="0.01" value="'+Number(old.preco||0)+'"></label>'+
   '<label class="ua-product-wide" data-ua-raw>'+(pid?'Saldo em estoque':'Saldo inicial de estoque')+
    '<input name="estoque" type="number" min="0" step="0.001" value="'+Number(old.estoque||0)+'"></label>'+
   '<label class="ua-product-wide">Categoria (opcional)<input name="categoria" maxlength="120" value="'+safe(old.categoria||'')+'" placeholder="Ex.: Chapas, ferragens, painéis"></label>'+
   '<label class="ua-product-wide">Observações<textarea name="observacoes" maxlength="2500" rows="2">'+safe(old.observacoes||'')+'</textarea></label>'+
   '</div>'+
   '<section class="ua-product-finished" data-ua-finished hidden>'+
   '<h3>Composição do produto acabado</h3>'+
   '<p class="muted small">Informe as matérias-primas utilizadas para fabricar uma unidade. Cada linha será considerada na reserva e na baixa do pedido.</p>'+
   '<div id="uaBomRows"></div>'+
   '<button class="btn small" type="button" id="uaAddBomRow">+ Adicionar matéria-prima</button>'+
   '<button class="btn small" type="button" id="uaBomNewMaterial" style="margin-left:8px">+ Cadastrar matéria-prima</button>'+
   '<p id="uaBomCost" class="muted small" role="status" aria-live="polite"></p></section>';
  return openModal(pid?'Editar produto':'Produtos — novo cadastro',fields,(v,dialog)=>{
   const kind=existing?.tipo||String(v.tipo||dialog?.querySelector('[name="tipo"]')?.value||type);
   if(!['materia','acabado'].includes(kind))throw Error('Selecione um tipo válido.');
   if(existing&&v.tipo&&v.tipo!==existing.tipo)throw Error('Não altere o tipo de um produto já cadastrado.');
   const data={...old,id:pid||id(),tipo:kind,codigo:code,nome:String(v.nome||'').trim(),
    categoria:String(v.categoria||'').trim(),unidade:String(v.unidade||'un').trim()||'un',
    preco:round(v.preco),observacoes:String(v.observacoes||'').trim()};
   if(!data.nome)throw Error('Informe a descrição do produto.');
   if(!Number.isFinite(data.preco)||data.preco<0)throw Error('Preço de venda inválido.');
   if(!pid&&code!==nextMaterialCode())throw Error('A sequência mudou. Reabra o cadastro para obter o próximo código.');
   const isDuplicate=(db.products||[]).some(p=>p.id!==pid&&String(p.codigo||'')&&
    (/^\d{1,4}$/.test(p.codigo)&&/^\d{1,4}$/.test(code)?
      Number(p.codigo)===Number(code):String(p.codigo)===code));
   if(isDuplicate)throw Error('Este código já pertence a outro produto.');
   if(kind==='materia'){
    const custo=Number(v.custo),estoque=Number(v.estoque),minimo=Number(v.minimo);
    if(![custo,estoque,minimo].every(n=>Number.isFinite(n)&&n>=0))throw Error('Custo, saldo e mínimo devem ser números não negativos.');
    data.custo=round(custo);data.estoque=estoque;data.minimo=minimo;data.components=[];
    if(data.estoque+0.000001<reservedQuantity(data.id))throw Error('O estoque não pode ficar abaixo da quantidade reservada.');
   }else{
    const rows=componentRows(dialog);
    data.components=validateComponents(rows);
    data.custo=0;data.estoque=0;data.minimo=0;
   }
   const beforeProducts=db.products,beforeMoves=db.stockMovements,beforeSeq={...db.seq};
   if(pid)db.products=db.products.map(p=>p.id===pid?data:p);else db.products=[...db.products,data];
   if(kind==='materia'&&Number(old.estoque||0)!==Number(data.estoque)){
    db.stockMovements=[...db.stockMovements,{id:id(),date:iso(),productId:data.id,nome:data.nome,
      delta:round(data.estoque-Number(old.estoque||0)),note:pid?'Ajuste no cadastro':'Estoque inicial'}];
   }
   if(!pid||!old.codigo)db.seq.productCode=Math.max(Number(db.seq.productCode||1),Number(code)+1||1);
   try{
    if(save()===false)throw Error('Falha ao salvar: nenhum dado foi confirmado.');
   }catch(error){db.products=beforeProducts;db.stockMovements=beforeMoves;db.seq=beforeSeq;throw error}
   return true;
  },dialog=>{
   dialog.classList.add('ua-product-dialog');
   const heading=dialog.querySelector('h2');
   heading?.insertAdjacentHTML('afterbegin','<small class="ua-product-eyebrow"></small>');
   const footer=dialog.querySelector('.dialog-actions');
   const submit=footer?.querySelector('[type=submit]');
   if(submit)submit.textContent=pid?'Salvar alterações':'Salvar produto';
   const close=document.createElement('button');
   close.type='button';close.className='ua-product-close';close.textContent='×';
   close.setAttribute('aria-label','Fechar cadastro');
   close.onclick=()=>dialog.close();
   dialog.insertBefore(close,dialog.firstChild);
   const typeEl=dialog.querySelector('[name="tipo"]');
   typeEl?.addEventListener('change',()=>refreshType(dialog));
   const add=dialog.querySelector('#uaAddBomRow');
   if(add)add.onclick=()=>addComponentRow(dialog);
   const quick=dialog.querySelector('#uaBomNewMaterial');
   if(quick)quick.onclick=()=>{
    const before=new Set((db.products||[]).map(p=>String(p.id)));
    const materialDlg=productModal('','materia');
    materialDlg?.addEventListener('close',()=>{
     const added=(db.products||[]).find(p=>p.tipo==='materia'&&!before.has(String(p.id)));
     if(!added||!dialog.isConnected)return;
     dialog.querySelectorAll('[data-component-material]').forEach(select=>{
      if(![...select.options].some(opt=>opt.value===String(added.id)))
       select.add(new Option(added.nome,added.id));
     });
     addComponentRow(dialog,{materialId:added.id,quantidade:1});
     updateComponentCost(dialog);
    },{once:true});
   };
   (Array.isArray(old.components)?old.components:[]).forEach(item=>addComponentRow(dialog,item));
   refreshType(dialog);
   dialog.querySelector('[name="nome"]')?.focus();
  });
 };
 window.universaArtCatalog={validateComponents,componentRows,componentOptions,refreshType,addComponentRow,productsView,productModal,
  getTypeFilter:()=>catalogTypeFilter,setTypeFilter:value=>{catalogTypeFilter=value}};
})();