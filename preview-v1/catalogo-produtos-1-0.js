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
   dialog.querySelector('.ua-stock-from-purchase')?
   'Matéria-prima da marcenaria: MDF de 18 mm ou 25 mm, parafusos, fitas, dobradiças, corrediças e outros insumos. O saldo será atualizado quando confirmar a entrada.':
   'Matéria-prima: cadastre chapas de MDF, parafusos, fitas, ferragens e demais insumos. Configure custo, estoque mínimo e unidade.';
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
  // Chamadas a partir de Entrada de Materiais são SEMPRE matéria-prima.
  // O formulário geral de Produtos continua permitindo escolher os dois tipos.
  const entryMaterial=initialType==='materia-entrada'&&!pid;
  const existing=pid?(db.products||[]).find(p=>p.id===pid):null;
  if(pid&&!existing)return alert('Produto não encontrado.');
  const old=existing||{tipo:'materia',unidade:'un',estoque:0,minimo:0,preco:0,custo:0,components:[],observacoes:''};
  const code=String(old.codigo||nextMaterialCode());
  if(!code)return alert('Limite de 9999 códigos atingido. Revise os cadastros.');
  const units=['un','chapa','m','m²','m³','par','jogo','kg','pacote'];
  if(old.unidade&&!units.includes(old.unidade))units.push(old.unidade);
  const unitOptions=units.map(v=>'<option value="'+safe(v)+'"'+(old.unidade===v?' selected':'')+'>'+safe(v)+'</option>').join('');
  const type=entryMaterial?'materia':existing?.tipo||(['materia','acabado'].includes(initialType)?initialType:'materia');
  const disable=existing?' disabled title="O tipo não pode ser alterado após o cadastro para preservar os pedidos"':'';
  const typeField=entryMaterial?
   '<label>Tipo de produto *<input value="Matéria-prima" readonly aria-readonly="true" aria-label="Tipo de produto: matéria-prima"></label>'+
    '<input type="hidden" name="tipo" value="materia">':
   '<label>Tipo de produto *<select name="tipo" required'+disable+'>'+
    '<option value="materia"'+(type==='materia'?' selected':'')+'>Matéria-prima</option>'+
    '<option value="acabado"'+(type==='acabado'?' selected':'')+'>Produto acabado</option></select></label>';
  const fields='<div class="ua-product-grid">'+typeField+
   '<label>Código automático<input name="codigoDisplay" readonly aria-readonly="true" value="'+safe(code)+'" title="Código gerado automaticamente"></label>'+
   '<p class="ua-product-wide muted small" id="uaProductTypeHelp"></p>'+
   '<label>Unidade *<select name="unidade" required>'+unitOptions+'</select></label>'+
   (!pid?'<label class="ua-product-wide" data-ua-raw>Escolha um exemplo para preencher mais rápido (opcional)<select id="uaMaterialPreset" aria-label="Exemplo de material">'+
    '<option value="">Selecione um exemplo ou cadastre livremente</option>'+
    '<optgroup label="Madeiras / MDF (espessura)">'+
    '<option value="mdf15">MDF 15 mm</option><option value="mdf18">MDF 18 mm</option>'+
    '<option value="mdf25">MDF 25 mm</option><option value="mdf06">MDF 06 mm</option></optgroup>'+
    '<optgroup label="Parafusos (diâmetro × comprimento, mm)">'+
    '<option value="par3_5x16">3,5 × 16</option><option value="par4x20">4 × 20</option>'+
    '<option value="par4x25">4 × 25</option><option value="par4x30">4 × 30</option>'+
    '<option value="par4x35">4 × 35</option><option value="par4x40">4 × 40</option>'+
    '<option value="par4x45">4 × 45</option><option value="par4x50">4 × 50</option>'+
    '<option value="par4x60">4 × 60</option><option value="par5x70">5 × 70</option></optgroup>'+
    '<optgroup label="Buchas (diâmetro)">'+
    '<option value="bucha06">Bucha 6 mm</option><option value="bucha08">Bucha 8 mm</option>'+
    '<option value="bucha10">Bucha 10 mm</option><option value="bucha12">Bucha 12 mm</option></optgroup>'+
    '<optgroup label="Fitas de borda (largura)">'+
    '<option value="fita22">Fita de borda 22 mm</option><option value="fita35">Fita de borda 35 mm</option>'+
    '<option value="fita45">Fita de borda 45 mm</option><option value="fita64">Fita de borda 64 mm</option></optgroup>'+
    '<optgroup label="Outras ferragens e insumos">'+
    '<option value="dobradica">Dobradiças</option><option value="corredica">Corrediças</option>'+
    '<option value="cola">Cola para madeira</option></optgroup>'+
    '</select></label>':'')+
   '<label class="ua-product-wide"><span data-product-name-label>Descrição do produto *</span><input name="nome" required maxlength="180" autocomplete="off" placeholder="Ex.: MDF branco TX 18 mm, MDF 25 mm, parafuso 4 × 40 mm" value="'+safe(old.nome||'')+'"></label>'+
   '<div class="ua-product-wide ua-mat-launch" data-ua-raw><button type="button" class="btn small" data-ua-material-open>Consultar Catálogo UNIVERSA ART</button><small>Selecione um material da planilha. Custos não informados ficam para cotação; o estoque não é alterado.</small></div>'+
   '<label data-ua-raw>Espessura (mm), quando aplicável<input name="espessuraMm" type="number" inputmode="decimal" min="0" max="1000" step="0.1" placeholder="Ex.: 18 ou 25" value="'+safe(old.espessuraMm??'')+'"></label>'+
   '<label data-ua-raw>Comprimento (mm), opcional<input name="chapaComprimentoMm" type="number" inputmode="numeric" min="0" max="10000" step="1" placeholder="Medida real da chapa" value="'+safe(old.chapaComprimentoMm??'')+'"></label>'+
   '<label data-ua-raw>Largura (mm), opcional<input name="chapaLarguraMm" type="number" inputmode="numeric" min="0" max="10000" step="1" placeholder="Medida real da chapa" value="'+safe(old.chapaLarguraMm??'')+'"></label>'+
   '<label data-ua-raw>Estoque mínimo<input name="minimo" type="number" min="0" step="0.001" value="'+Number(old.minimo||0)+'"></label>'+
   '<label data-ua-raw>Custo unitário (R$)<input name="custo" type="number" min="0" step="0.01" value="'+Number(old.custo||0)+'"></label>'+
   (entryMaterial?'<input type="hidden" name="preco" value="0">':
   '<label>Preço de venda (R$)<input name="preco" type="number" min="0" step="0.01" value="'+Number(old.preco||0)+'"></label>')+
   (entryMaterial?
    '<div class="ua-product-wide ua-stock-from-purchase" data-ua-raw><strong>Saldo inicial: 0</strong><p class="muted small">O estoque será atualizado quando você confirmar o recebimento em Entrada de Materiais. Não lance a quantidade duas vezes.</p><input type="hidden" name="estoque" value="0"></div>':
    '<label class="ua-product-wide" data-ua-raw>'+(pid?'Saldo em estoque':'Saldo inicial de estoque')+
    '<input name="estoque" type="number" min="0" step="0.001" value="'+Number(old.estoque||0)+'"></label>')+
   '<label class="ua-product-wide">Categoria<select name="categoria" aria-label="Categoria do produto">'+
    (window.universaArtCategorias?.options(old.categoria)||'<option value="">Selecione uma categoria</option><option value="'+safe(old.categoria||'')+'" selected>'+safe(old.categoria||'')+'</option>')+
    '</select></label>'+
   '<div class="ua-product-wide ua-category-quick-create"><button type="button" class="btn small" data-ua-category-new>+ Cadastrar categoria</button><span class="muted small">Crie uma nova categoria sem perder o preenchimento do produto.</span></div>'+
   '<label class="ua-product-wide">Observações<textarea name="observacoes" maxlength="2500" rows="2">'+safe(old.observacoes||'')+'</textarea></label>'+
   '</div>'+
   '<section class="ua-product-finished" data-ua-finished hidden>'+
   '<h3>Composição do produto acabado</h3>'+
   '<p class="muted small">Informe as matérias-primas utilizadas para fabricar uma unidade. Cada linha será considerada na reserva e na baixa do pedido.</p>'+
   '<div id="uaBomRows"></div>'+
   '<button class="btn small" type="button" id="uaAddBomRow">+ Adicionar matéria-prima</button>'+
   '<button class="btn small" type="button" id="uaBomNewMaterial" style="margin-left:8px">+ Cadastrar matéria-prima</button>'+
   '<p id="uaBomCost" class="muted small" role="status" aria-live="polite"></p></section>';
  return openModal(pid?'Editar produto':entryMaterial?'Cadastrar matéria-prima':'Produtos — novo cadastro',fields,(v,dialog)=>{
   if(entryMaterial&&v.tipo&&v.tipo!=='materia')throw Error('Entrada de Materiais aceita somente matérias-primas.');
   const kind=entryMaterial?'materia':existing?.tipo||String(v.tipo||dialog?.querySelector('[name="tipo"]')?.value||type);
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
    const custo=Number(v.custo),estoque=entryMaterial?0:Number(v.estoque),minimo=Number(v.minimo);
    if(![custo,estoque,minimo].every(n=>Number.isFinite(n)&&n>=0))throw Error('Custo, saldo e mínimo devem ser números não negativos.');
    const dimensions=['espessuraMm','chapaComprimentoMm','chapaLarguraMm'];
    for(const dimension of dimensions){
     const value=v[dimension];
     if(value==null||String(value).trim()===''){data[dimension]=null;continue}
     const num=Number(value);
     if(!Number.isFinite(num)||num<=0||num>10000||
        (dimension==='espessuraMm'&&num>1000))throw Error('Confira as medidas da matéria-prima em milímetros.');
     data[dimension]=num;
    }
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
   if(entryMaterial&&typeEl)typeEl.value='materia';
   typeEl?.addEventListener('change',()=>refreshType(dialog));
   const sample=dialog.querySelector('#uaMaterialPreset');
   if(sample)sample.onchange=()=>{
    const options={
     mdf15:{nome:'MDF 15 mm',categoria:'Chapas MDF',unidade:'chapa',espessuraMm:15},
     mdf18:{nome:'MDF 18 mm',categoria:'Chapas MDF',unidade:'chapa',espessuraMm:18},
     mdf25:{nome:'MDF 25 mm',categoria:'Chapas MDF',unidade:'chapa',espessuraMm:25},
     mdf06:{nome:'MDF 06 mm',categoria:'Chapas MDF',unidade:'chapa',espessuraMm:6},
     dobradica:{nome:'Dobradiça',categoria:'Dobradiças',unidade:'un'},
     corredica:{nome:'Corrediça',categoria:'Corrediças',unidade:'par'},
     cola:{nome:'Cola para madeira',categoria:'Colas e adesivos',unidade:'un'}
    };
    for(const size of ['3,5x16','4x20','4x25','4x30','4x35','4x40','4x45','4x50','4x60','5x70'])
     options['par'+size.replace(',','.').replace('x','x').replace('.','_')]={nome:'Parafuso '+size.replace('x',' × ')+' mm',categoria:'Parafusos',unidade:'un'};
    for(const size of ['06','08','10','12'])
     options['bucha'+size]={nome:'Bucha '+size+' mm',categoria:'Buchas',unidade:'un'};
    for(const size of ['22','35','45','64'])
     options['fita'+size]={nome:'Fita de borda '+size+' mm',categoria:'Fitas de borda',unidade:'m'};
    const chosen=options[sample.value];
    if(!chosen)return;
    for(const key of ['nome','categoria','unidade','espessuraMm']){
     const input=dialog.querySelector('[name="'+key+'"]');
     if(input){if(key==='categoria')window.universaArtCategorias?.ensureOption(input,chosen[key]);else input.value=chosen[key]??'';}
    }
    dialog.querySelector('[name="nome"]')?.focus();
   };
   const add=dialog.querySelector('#uaAddBomRow');
   if(add)add.onclick=()=>addComponentRow(dialog);
   const quick=dialog.querySelector('#uaBomNewMaterial');
   if(quick)quick.onclick=()=>{
    const before=new Set((db.products||[]).map(p=>String(p.id)));
    const materialDlg=productModal('','materia-entrada');
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