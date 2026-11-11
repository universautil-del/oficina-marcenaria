'use strict';
/* OFICINA v0.3 — versão local, sem servidor, autenticação ou sincronização. */
const sections=[['dashboard','▦','Dashboard'],['clientes','♙','Clientes'],['produtos','▤','Produtos'],['fornecedores','♧','Fornecedores'],['compras','▥','Entrada de Materiais'],['orcamentos','▧','Orçamentos'],['pedidos','▣','Pedidos'],['producao','▣','Produção'],['financeiro','＄','Financeiro'],['relatorios','▤','Relatórios'],['documentos','▤','Documentos'],['empresa','⚙','Minha Empresa']];
const nav=document.querySelector('#nav'),content=document.querySelector('#content'),title=document.querySelector('#pageTitle'),sidebar=document.querySelector('.sidebar');
const DB_KEY='universalartes-preview-v1-dados',OLD_CLIENTS='universalartes-preview-v1-clientes-antigos';
const money=n=>Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const dec=n=>Number(n||0).toLocaleString('pt-BR',{maximumFractionDigits:2});
const round=n=>Math.round((Number(n)||0)*100)/100;
const num=n=>{const s=String(n??'').trim();return Number(s.replace(/\./g,'').replace(',','.'))||0};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const id=()=>typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(36).slice(2)}`;
const iso=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`};
const date=s=>s?String(s).slice(0,10).split('-').reverse().join('/'):'—';
const todayMonth=()=>iso().slice(0,7);
const blank=()=>({version:3,clients:[],products:[],quotes:[],orders:[],transactions:[],stockMovements:[],company:{nome:'Universa Art',cnpj:'',telefone:'',email:'',endereco:'',pix:'',contrato:''},seq:{quote:1,order:1}});
function load(){try{const item=localStorage.getItem(DB_KEY);if(item){const parsed=JSON.parse(item);if(parsed.version===3&&Array.isArray(parsed.clients)&&Array.isArray(parsed.products)&&Array.isArray(parsed.orders))return parsed}}catch(e){console.error('Falha ao ler dados',e)}
 const init=blank();try{const old=JSON.parse(localStorage.getItem(OLD_CLIENTS)||'[]');if(Array.isArray(old))init.clients=old.map(c=>({id:c.id||id(),nome:c.nome||'',tipo:c.tipo||'PF',doc:c.doc||'',telefone:c.telefone||'',email:c.email||'',cep:c.cep||'',cidade:c.cidade||'',endereco:c.endereco||'',observacoes:c.observacoes||''}))}catch{}
 return init;}
// O acesso autenticado usa dados exclusivos da sessão Supabase.
let db=window.UNIVERSA_REQUIRE_AUTH?blank():load();
function save(){
 if(window.UNIVERSA_REQUIRE_AUTH)return false; // Substituído pelo módulo de nuvem após autenticação.
 try{localStorage.setItem(DB_KEY,JSON.stringify(db));return true}
 catch(e){alert('Não foi possível salvar neste navegador. Exporte um backup e libere espaço.');return false}
}
if(!window.UNIVERSA_REQUIRE_AUTH&&!localStorage.getItem(DB_KEY))save();
const getClient=x=>db.clients.find(c=>c.id===x);
const getProduct=x=>db.products.find(p=>p.id===x);
const getQuote=x=>db.quotes.find(q=>q.id===x);
const getOrder=x=>db.orders.find(o=>o.id===x);
const cashReceived=tx=>(tx.payments||[]).reduce((s,p)=>s+Number(p.valor||0),0);
const balance=tx=>Math.max(0,round(tx.valor-cashReceived(tx)));
const orderTotal=o=>round((o.items||[]).reduce((s,i)=>s+Number(i.quantidade)*Number(i.preco),0)-Number(o.desconto||0)+Number(o.frete||0));
const orderPaid=o=>round(db.transactions.filter(t=>t.orderId===o.id&&t.kind==='receber').reduce((s,t)=>s+cashReceived(t),0));
const statusText={confirmado:'Confirmado',producao:'Em produção',pronto:'Pronto',entregue:'Entregue',cancelado:'Cancelado',aberto:'Aberto',convertido:'Convertido'};
const kindText={materia:'Matéria-prima',acabado:'Produto acabado',receber:'Receita',pagar:'Despesa'};
const search={clientes:'',produtos:'',fornecedores:'',compras:'',orcamentos:'',pedidos:'',producao:'',financeiro:''};
function button(label,action,item='',cls=''){return `<button type="button" class="btn ${cls}" data-action="${esc(action)}" data-id="${esc(item)}">${label}</button>`}
function intro(head,sub,tag=''){return `<div class="intro"><div><h2>${esc(head)}</h2><p class="muted">${esc(sub)}</p></div>${tag?`<span class="tag">${esc(tag)}</span>`:''}</div>`}
function notice(){return window.oficinaCloud?.active?'<div class="alert-bar">Nuvem ativada: alterações são enviadas ao banco quando houver conexão. Confirme o indicador de sincronização antes de trocar de aparelho. Faça backup regularmente.</div>':'<div class="alert-bar">Modo local de testes: os dados ficam somente neste navegador. Configure a nuvem em Minha Empresa para sincronizar. Não use dados sensíveis sem autenticação.</div>'}
function table(headers,rows,empty='Nenhum registro encontrado.'){return rows.length?`<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`:`<div class="empty compact">${esc(empty)}</div>`}
function td(...cells){return `<tr>${cells.map(c=>`<td>${c}</td>`).join('')}</tr>`}
function pill(label,type=''){return `<span class="pill ${type}">${esc(label)}</span>`}
function render(section=location.hash.slice(1)||'dashboard'){
 ensureControlCodes();
 const selected=sections.find(s=>s[0]===section)||sections[0];section=selected[0];title.textContent=section==='dashboard'?'Visão geral':selected[2];
 nav.innerHTML=sections.map(([key,icon,label])=>`<button class="nav-btn ${key===section?'active':''}" data-section="${key}"><span aria-hidden="true">${icon}</span>${label}</button>`).join('');
 nav.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{location.hash=b.dataset.section;sidebar.classList.remove('open');if((location.hash.slice(1)||'dashboard')===section)render(section)}));
 const view={dashboard:dashboardUpgrade,clientes:clientsView,produtos:productsView,fornecedores:suppliersView,compras:purchasesView,orcamentos:quotesView,pedidos:ordersView,producao:productionView,financeiro:financeView,relatorios:reportsView,documentos:documentsView,empresa:companyView};
 view[section]();
}
function inputSearch(section){return `<input class="search" data-search="${section}" placeholder="Pesquisar..." aria-label="Pesquisar" value="${esc(search[section]||'')}">`}
function setSearch(e){const section=e.target.dataset.search;if(!section)return;const caret=e.target.selectionStart;search[section]=e.target.value;render(section);const el=content.querySelector('[data-search]');if(el){el.focus();el.setSelectionRange(caret,caret)}}
function openModal(head,fields,onSubmit,after){const dlg=document.createElement('dialog');dlg.className='large';dlg.innerHTML=`<form><h2>${esc(head)}</h2>${fields}<div class="dialog-actions"><button type="button" class="btn" id="closeDialog">Cancelar</button><button type="submit" class="btn primary">Salvar</button></div></form>`;document.body.append(dlg);dlg.querySelector('#closeDialog').onclick=()=>dlg.close();dlg.addEventListener('close',()=>dlg.remove());dlg.querySelector('form').onsubmit=e=>{e.preventDefault();try{const values=Object.fromEntries(new FormData(e.currentTarget));if(onSubmit(values,dlg)!==false){dlg.close();render()}}catch(err){alert(err.message||'Não foi possível salvar.')}};dlg.showModal();if(after)after(dlg);return dlg}
function download(name,text,type='application/json'){const url=URL.createObjectURL(new Blob([text],{type}));const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),2500)}
function dashboard(){
 const active=db.orders.filter(o=>!['entregue','cancelado'].includes(o.status));
 const month= db.orders.filter(o=>o.status!=='cancelado'&&o.date.slice(0,7)===todayMonth());
 const recv=db.transactions.filter(t=>t.kind==='receber'),pay=db.transactions.filter(t=>t.kind==='pagar');
 const due=recv.reduce((s,t)=>s+balance(t),0),owed=pay.reduce((s,t)=>s+balance(t),0);
 const received=recv.reduce((s,t)=>s+cashReceived(t),0),paid=pay.reduce((s,t)=>s+cashReceived(t),0);
 const low=db.products.filter(p=>p.tipo==='materia'&&p.estoque<=p.minimo);
 const revenue=round(month.reduce((s,o)=>s+orderTotal(o),0));
 content.innerHTML=`${intro('Bem-vindo ao Oficina','Panorama da sua marcenaria','Versão 0.3')}${notice()}<div class="cards">
 ${[['Vendas do mês',money(revenue),'Pedidos não cancelados'],['Pedidos em andamento',active.length,'Acompanhe a produção'],['Contas a receber',money(due),'Saldo ainda não recebido'],['Saldo de caixa',money(received-paid),'Recebimentos menos pagamentos']].map(([a,b,c])=>`<div class="card"><div class="label">${a}</div><div class="value">${b}</div><div class="note">${c}</div></div>`).join('')}</div>
 <div class="grid"><section class="panel"><h3>Financeiro</h3><div class="summary-list gap-top"><div class="summary-row"><span>Recebido</span><strong>${money(received)}</strong></div><div class="summary-row"><span>Despesas pagas</span><strong>${money(paid)}</strong></div><div class="summary-row"><span>A pagar</span><strong>${money(owed)}</strong></div><div class="summary-row"><span>Clientes</span><strong>${db.clients.length}</strong></div></div></section><section class="panel"><h3>Pedidos recentes</h3>${db.orders.length?db.orders.slice().reverse().slice(0,5).map(o=>`<div class="summary-row gap-top"><span>#${o.number} · ${esc(o.clientNome)}</span><strong>${pill(statusText[o.status]||o.status)}</strong></div>`).join(''):'<div class="empty">Nenhum pedido cadastrado.</div>'}<div class="kpi-mini"><span><strong>${db.quotes.filter(q=>q.status==='aberto').length}</strong> orçamentos abertos</span><span><strong>${low.length}</strong> matérias-primas no mínimo</span></div></section></div>`;
}
function clientsView(){const q=search.clientes.toLowerCase();const list=db.clients.filter(c=>[c.nome,c.doc,c.telefone,c.email,c.cidade].some(v=>String(v||'').toLowerCase().includes(q)));
 content.innerHTML=`${intro('Clientes','Cadastre, pesquise e consulte seus clientes.',`${db.clients.length} cadastrado(s)`)}<section class="panel"><div class="toolbar">${inputSearch('clientes')}<div class="actions">${button('Exportar backup','backup')}${button('Importar backup','import')}${button('+ Novo cliente','new-client','','primary')}</div></div>${table(['Nome','Documento','Telefone','Cidade','Ações'],list.map(c=>td(`<strong>${esc(c.nome)}</strong>`,esc(c.doc),esc(c.telefone),esc(c.cidade),`<div class="row-actions">${button('Editar','edit-client',c.id,'small')}${button('Excluir','delete-client',c.id,'small danger')}</div>`)),'Nenhum cliente. Clique em Novo cliente.')}</section>`;
}
function clientModal(clientId=''){
 const old=db.clients.find(c=>c.id===clientId)||{};
 openModal(clientId?'Editar cliente':'Novo cliente',`<div class="form-grid"><label class="full">Nome / Razão social *<input name="nome" required maxlength="160" value="${esc(old.nome)}"></label>
 <label>Tipo<select name="tipo"><option value="PF" ${old.tipo==='PJ'?'':'selected'}>Pessoa física</option><option value="PJ" ${old.tipo==='PJ'?'selected':''}>Pessoa jurídica</option></select></label>
 <label>CPF/CNPJ<input name="doc" value="${esc(old.doc)}" maxlength="20"></label>
 <label>Telefone / WhatsApp<input name="telefone" value="${esc(old.telefone)}" maxlength="25"></label><label>E-mail<input type="email" name="email" value="${esc(old.email)}"></label>
 <label>CEP<input name="cep" value="${esc(old.cep)}"></label><label>Cidade<input name="cidade" value="${esc(old.cidade)}"></label>
 <label class="full">Endereço<input name="endereco" value="${esc(old.endereco)}"></label>
 <label class="full">Observações<textarea name="observacoes" rows="3">${esc(old.observacoes)}</textarea></label></div>`,values=>{
 const c={...old,...values,nome:values.nome.trim(),id:old.id||id()};if(!c.nome)throw Error('Informe o nome.');
 if(old.id)db.clients=db.clients.map(x=>x.id===old.id?c:x);else db.clients.push(c);
 if(old.id){db.quotes.forEach(q=>{if(q.clientId===old.id)q.clientNome=c.nome});db.orders.forEach(o=>{if(o.clientId===old.id)o.clientNome=c.nome})}
 return save();});
}
function removeClient(cid){if(db.quotes.some(q=>q.clientId===cid)||db.orders.some(o=>o.clientId===cid))return alert('Cliente vinculado a orçamentos ou pedidos: exclusão bloqueada.');if(confirm('Excluir este cliente?')){db.clients=db.clients.filter(c=>c.id!==cid);save();render()}}

function nextMaterialCode(){
 const max=(db.products||[]).reduce((m,p)=>{
  const code=String(p.codigo||'').trim();
  if(!/^\d{1,4}$/.test(code))return m;
  const number=Number(code);
  return number>=1&&number<=9999?Math.max(m,number):m;
 },0);
 const sequence=Number(db.seq?.productCode||1);
 const next=Math.max(max+1,Number.isSafeInteger(sequence)&&sequence>=1?sequence:1);
 return next<=9999?String(next).padStart(2,'0'):'';
}

let lowStockOnly=false;
function productsView(){const q=search.produtos.toLowerCase();const raw=db.products.filter(p=>p.tipo==='materia');const legacy=db.products.filter(p=>p.tipo==='acabado');
 const lowCount=raw.filter(p=>Number(p.estoque)<=Number(p.minimo)).length;
 const list=raw.filter(p=>[p.nome,p.codigo,p.categoria,p.unidade].some(v=>String(v||'').toLowerCase().includes(q))&&(!lowStockOnly||Number(p.estoque)<=Number(p.minimo)));
 content.innerHTML=`${intro('Produtos e Estoque','Cadastro de matérias-primas com estoque e movimentações.',`${raw.length} material(is)`)}<section class="panel"><div class="toolbar ua-materials-toolbar">${inputSearch('produtos')}<div class="actions">${button('Registrar entrada','new-purchase','','small')}${button(lowStockOnly?'Mostrar todos':'Estoque baixo ('+lowCount+')','filter-low-stock','',lowStockOnly?'small accent':'small')}${button('+ Nova matéria-prima','new-raw','','primary')}</div></div><p class="ua-code-helper">Código automático de 01 até 9999. Próximo: <strong>${nextMaterialCode()||'Limite atingido'}</strong></p><p class="ua-code-tip">Exibindo ${list.length} de ${raw.length} materiais. Registre compras em <strong>Entrada de Materiais</strong>; o estoque será atualizado ao confirmar o recebimento, sem precisar lançar a mesma entrada em Movimentar.</p>${table(['Código / Matéria-prima','Tipo','Custo / Venda','Estoque','Ações'],list.map(p=>td(`<strong>${esc(p.codigo||'Legado')}</strong><div class="small muted">${esc(p.nome)} · ${esc(p.categoria||'Sem categoria')}</div>`,pill(kindText[p.tipo]),`${money(productCost(p))}<br><span class="muted small">Venda: ${money(p.preco)}</span>`,p.tipo==='materia'?`${dec(p.estoque)} ${esc(p.unidade)} ${p.estoque<=p.minimo?pill('Mínimo','warn'):''}`:`${p.components?.length||0} componente(s)`,`<div class="row-actions">${button('Editar','edit-product',p.id,'small')}${p.tipo==='materia'?button('Movimentar','adjust-stock',p.id,'small'):''}${button('Excluir','delete-product',p.id,'small danger')}</div>`)))}
 ${legacy.length?'<p class="ua-legacy-hint">'+legacy.length+' produto(s) acabado(s) de versões antigas preservado(s) para pedidos e backups.</p>':''}</section>
 <section class="panel gap-top"><div class="panel-head"><h3>Movimentações recentes</h3><span class="muted small">${raw.length} matérias-primas</span></div>${table(['Data','Material','Movimentação','Motivo'],db.stockMovements.slice(-15).reverse().map(m=>td(date(m.date),esc(getProduct(m.productId)?.nome||m.nome||'Produto excluído'),`${m.delta>0?'+':''}${dec(m.delta)}`,esc(m.note))))}</section>`;
}
function productCost(p){if(p.tipo!=='acabado')return Number(p.custo||0);return round((p.components||[]).reduce((s,c)=>s+(getProduct(c.materialId)?.custo||0)*c.quantidade,0))}
function productModal(pid='',type='materia'){
 if(!pid&&type==='acabado')return alert('Produto acabado não está disponível. Cadastre matérias-primas ou utilize Projetos de móveis.');
 const existing=pid?db.products.find(p=>p.id===pid):null;
 if(pid&&!existing)return alert('Produto não encontrado.');
 if(existing?.tipo==='acabado')return alert('Produto acabado legado preservado para pedidos e backups, sem edição nesta tela.');
 const old=existing||{tipo:'materia',estoque:0,minimo:0,unidade:'un',components:[],observacoes:''};
 const codePreview=String(old.codigo||nextMaterialCode());
 if(!codePreview)return alert('Códigos de 01 a 9999 esgotados. Revise o cadastro antes de adicionar materiais.');
 const allUnits=['un','chapa','m','m²','m³','par','jogo','kg','pacote'];
 if(old.unidade&&!allUnits.includes(old.unidade))allUnits.push(old.unidade);
 const units=allUnits.map(unit=>`<option value="${esc(unit)}" ${old.unidade===unit?'selected':''}>${esc(unit)}</option>`).join('');

 const fields=`<div class="ua-product-grid">
  <label>Código automático<input name="codigoDisplay" readonly aria-readonly="true" value="${esc(codePreview)}" title="Código gerado automaticamente"></label>
  <label>Unidade *<select name="unidade" required>${units}</select></label>
  <label class="ua-product-wide">Descrição da matéria-prima *<input name="nome" required maxlength="180" placeholder="Ex.: MDF branco TX 15 mm" value="${esc(old.nome||'')}"></label>
  <label data-ua-raw>Estoque mínimo<input name="minimo" type="number" min="0" step="0.001" value="${Number(old.minimo||0)}"></label>
  <label data-ua-raw>Custo unitário (R$)<input name="custo" type="number" min="0" step="0.01" value="${Number(old.custo||0)}"></label>
  <label>Preço de venda (R$)<input name="preco" type="number" min="0" step="0.01" value="${Number(old.preco||0)}"></label>
  <label class="ua-product-wide" data-ua-raw>${pid?'Saldo em estoque':'Saldo inicial de estoque'}<input name="estoque" type="number" min="0" step="0.001" value="${Number(old.estoque||0)}"></label>
  <label class="ua-product-wide">Categoria (opcional)<input name="categoria" maxlength="120" value="${esc(old.categoria||'')}" placeholder="Ex.: Chapas, ferragens ou painéis"></label>
  <label class="ua-product-wide">Observações<textarea name="observacoes" maxlength="2500" rows="2" placeholder="Medidas, cor, fornecedor ou detalhes importantes">${esc(old.observacoes||'')}</textarea></label>
 </div>
`;
 const dlg=openModal(pid?'Editar matéria-prima':'Nova matéria-prima',fields,(v,dialog)=>{
  const kind='materia';
  const data={
   ...old,id:pid||id(),tipo:kind,codigo:codePreview,
   nome:String(v.nome||'').trim(),categoria:String(v.categoria||'').trim(),
   unidade:String(v.unidade||'un').trim()||'un',preco:round(v.preco),
   observacoes:String(v.observacoes||'').trim()
  };
  if(!data.nome)throw Error('Informe a descrição do produto.');
  if(!Number.isFinite(data.preco)||data.preco<0)throw Error('Preço de venda inválido.');
  if(!pid&&nextMaterialCode()!==codePreview)throw Error('A sequência mudou. Abra o cadastro novamente para obter o novo código.');
  if(db.products.some(x=>x.id!==pid&&data.codigo&&(/^[0-9]{1,4}$/.test(x.codigo||'')&&/^[0-9]{1,4}$/.test(data.codigo)?Number(x.codigo)===Number(data.codigo):x.codigo===data.codigo)))throw Error('Já existe um produto com esse código.');
  const custo=Number(v.custo),estoque=Number(v.estoque),minimo=Number(v.minimo);
  if(![custo,estoque,minimo].every(n=>Number.isFinite(n)&&n>=0))
   throw Error('Custo, saldo e estoque mínimo precisam ser números não negativos.');
  data.custo=round(custo);data.estoque=estoque;data.minimo=minimo;data.components=[];
  if(data.estoque+0.000001<reservedQuantity(data.id))
   throw Error('O estoque não pode ficar abaixo da quantidade reservada para pedidos.');
  const oldProducts=db.products,oldMoves=db.stockMovements,oldSeq={...db.seq};
  if(pid)db.products=db.products.map(x=>x.id===pid?data:x);else db.products=[...db.products,data];
  if(kind==='materia'&&Number(old.estoque||0)!==Number(data.estoque)){
   db.stockMovements=[...db.stockMovements,{id:id(),date:iso(),productId:data.id,nome:data.nome,delta:round(data.estoque-Number(old.estoque||0)),note:pid?'Ajuste no cadastro':'Estoque inicial'}];
  }
  if(!pid||!old.codigo)db.seq.productCode=Math.max(Number(db.seq.productCode||1),Number(data.codigo)+1||1);
  if(save()===false){db.products=oldProducts;db.stockMovements=oldMoves;db.seq=oldSeq;throw Error('Falha ao salvar: nenhum dado foi alterado.');}
  return true;
 },dialog=>{
  dialog.classList.add('ua-product-dialog');
  dialog.querySelector('[name="nome"]')?.focus();
  const heading=dialog.querySelector('h2');
  heading?.insertAdjacentHTML('afterbegin','<small class="ua-product-eyebrow">CADASTRO DE MATÉRIA-PRIMA</small>');
  const footer=dialog.querySelector('.dialog-actions');
  const submit=footer?.querySelector('[type=submit]');
  if(submit)submit.textContent=pid?'Salvar alterações':'Salvar material';
  const close=document.createElement('button');close.type='button';close.className='ua-product-close';
  close.setAttribute('aria-label','Fechar cadastro');close.textContent='×';
  close.onclick=()=>dialog.close();dialog.insertBefore(close,dialog.firstChild);
 });
 return dlg;
}
function adjustStock(pid){const p=getProduct(pid);if(!p||p.tipo!=='materia')return;openModal('Movimentar estoque — '+p.nome,`<div class="form-grid"><label>Operação<select name="operation"><option value="entrada">Entrada</option><option value="saida">Saída</option></select></label><label>Quantidade *<input name="quantidade" type="number" step="0.001" min="0.001" required></label><label class="full">Motivo<input name="motivo" placeholder="Compra, uso avulso, correção..." required></label></div><p class="muted small">Estoque atual: ${dec(p.estoque)} ${esc(p.unidade)}. Reservas existentes são consideradas na saída.</p>`,v=>{
 const delta=(v.operation==='saida'?-1:1)*Number(v.quantidade);if(!Number.isFinite(delta)||delta===0)throw Error('Quantidade inválida.');if(delta<0&&p.estoque+delta<reservedQuantity(pid))throw Error('Estoque insuficiente, considerando pedidos reservados.');const beforeStock=p.estoque,beforeMoves=db.stockMovements;
 p.estoque=Math.round((Number(p.estoque)+delta)*1000)/1000;
 db.stockMovements=[...beforeMoves,{id:id(),productId:pid,nome:p.nome,delta:Math.round(delta*1000)/1000,date:iso(),note:v.motivo}];
 if(save()===false){p.estoque=beforeStock;db.stockMovements=beforeMoves;throw Error('Falha ao salvar movimento. O saldo anterior foi restaurado.');}
 return true;});}
function removeProduct(pid){
 const linked=db.products.some(p=>p.components?.some(c=>c.materialId===pid))||
  db.quotes.some(q=>(q.items||[]).some(i=>i.productId===pid))||
  db.orders.some(o=>(o.items||[]).some(i=>i.productId===pid))||
  (db.purchases||[]).some(p=>(p.items||[]).some(i=>i.productId===pid))||
  (db.stockMovements||[]).some(m=>m.productId===pid);
 if(linked)return alert('Material já usado em pedidos, entradas ou movimentos de estoque. Exclusão bloqueada para preservar o histórico.');
 if(!confirm('Excluir este material sem histórico de movimentos?'))return;
 const previous=db.products;
 db.products=db.products.filter(p=>p.id!==pid);
 if(save()===false){db.products=previous;return alert('Falha ao salvar. O material foi preservado.');}
 render();
}
// Códigos de controle legíveis, separados dos números internos legados.
function nextControlCode(kind,dateString){
 const isQuote=kind==='quote',prefix=isQuote?'ORC':'PED';
 const year=/^\d{4}$/.test(String(dateString||'').slice(0,4))?String(dateString).slice(0,4):iso().slice(0,4);
 const rows=isQuote?db.quotes:db.orders;
 const codePattern=new RegExp('^'+prefix+'-'+year+'-(\\d{3})$');
 const max=rows.reduce((n,row)=>{
  const match=codePattern.exec(String(row.controlCode||''));
  return match?Math.max(n,Number(match[1])):n;
 },0);
 const key=(isQuote?'quoteControl':'orderControl')+year;
 const saved=Number(db.seq?.[key]||1);
 const next=Math.max(max+1,Number.isSafeInteger(saved)&&saved>=1?saved:1);
 if(next>999)throw Error('A sequência '+prefix+'-'+year+' chegou ao limite de 999.');
 db.seq[key]=next+1;
 return prefix+'-'+year+'-'+String(next).padStart(3,'0');
}
function ensureControlCodes(){
 if(window.UNIVERSA_REQUIRE_AUTH&&!window.oficinaCloud?.active)return;
 if(!db.seq||!Array.isArray(db.quotes)||!Array.isArray(db.orders))return;
 const beforeSeq={...db.seq},assigned=[];
 try{
  for(const [kind,rows] of [['quote',db.quotes],['order',db.orders]]){
   const pending=rows.filter(x=>!x.controlCode).sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''))||Number(a.number||0)-Number(b.number||0));
   for(const row of pending){row.controlCode=nextControlCode(kind,row.date);assigned.push(row)}
  }
  if(assigned.length&&save()===false)throw Error('Não foi possível salvar os códigos de controle.');
 }catch(error){
  for(const row of assigned)delete row.controlCode;
  db.seq=beforeSeq;
  console.warn('Código de controle:',error.message);
 }
}
function clientOptions(chosen=''){return db.clients.slice().sort((a,b)=>String(a.nome||'').localeCompare(String(b.nome||''),'pt-BR')).map(c=>`<option value="${esc(c.id)}" ${c.id===chosen?'selected':''}>${esc(c.nome)}</option>`).join('')}
function quoteStatus(q){return q.status==='convertido'?pill('Convertido','success'):pill('Aberto','warn')}
function quotesView(){const q=search.orcamentos.toLowerCase();const list=db.quotes.slice().reverse().filter(o=>[o.number,o.controlCode,o.clientNome,o.status,o.projectNome].some(v=>String(v||'').toLowerCase().includes(q)));
 content.innerHTML=`${intro('Orçamentos','Propostas comerciais e conversão em pedidos.',`${db.quotes.length} orçamento(s)`)}<section class="panel"><div class="toolbar">${inputSearch('orcamentos')}<div class="actions">${button('+ Novo orçamento','new-quote','','primary')}</div></div>${table(['Número','Cliente','Data','Total','Situação','Ações'],list.map(o=>td(esc(o.controlCode||'#'+o.number),esc(o.clientNome)+(o.projectId?'<div class="muted small">Projeto: '+esc(o.projectNome||'Vinculado')+'</div>':''),date(o.date),money(orderTotal(o)),quoteStatus(o),`<div class="row-actions">${button('Imprimir/PDF','print-quote',o.id,'small')}${button('Duplicar','duplicate-quote',o.id,'small')}${button('WhatsApp','share-quote',o.id,'small')}${o.status==='aberto'?button('Editar','edit-quote',o.id,'small'):''}${o.status==='aberto'?button('Virar pedido','convert-quote',o.id,'small accent'):''}${o.status==='aberto'?button('Excluir','delete-quote',o.id,'small danger'):''}</div>`)))}</section>`;
}
function addSaleRow(dlg,item={}){const area=dlg.querySelector('#saleRows');const opt=db.products.map(p=>`<option value="${esc(p.id)}">${esc(p.nome)}</option>`).join('');const line=document.createElement('div');line.className='item-row';line.innerHTML=`<label>Produto<select data-item-product><option value="">Item livre / serviço</option>${opt}</select></label><label>Descrição<input data-item-desc required maxlength="250" value="${esc(item.descricao||'')}"></label><label>Qtd.<input data-item-qty required type="number" min="0.001" step="0.001" value="${Number(item.quantidade||1)}"></label><label>Valor unit. (R$)<input data-item-price required type="number" min="0" step="0.01" value="${Number(item.preco||0)}"></label><button type="button" class="btn danger" data-del-item>✕</button>`;area.append(line);const select=line.querySelector('select');if(item.productId&&getProduct(item.productId))select.value=item.productId;select.onchange=()=>{const p=getProduct(select.value);if(p){line.querySelector('[data-item-desc]').value=p.nome;line.querySelector('[data-item-price]').value=p.preco}calcSale(dlg)};line.querySelector('[data-del-item]').onclick=()=>{line.remove();calcSale(dlg)};line.querySelectorAll('input').forEach(x=>x.addEventListener('input',()=>calcSale(dlg)))}
function collectSaleItems(dlg){const arr=[...dlg.querySelectorAll('.item-row')].map(row=>({productId:row.querySelector('[data-item-product]').value,descricao:row.querySelector('[data-item-desc]').value.trim(),quantidade:Number(row.querySelector('[data-item-qty]').value),preco:round(row.querySelector('[data-item-price]').value)}));if(!arr.length)throw Error('Adicione ao menos um item.');if(arr.some(x=>!x.descricao||x.quantidade<=0||!Number.isFinite(x.preco)||x.preco<0||!Number.isFinite(x.quantidade)))throw Error('Revise descrições, quantidades e valores.');return arr}
function calcSale(dlg){const rows=[...dlg.querySelectorAll('.item-row')];const sub=rows.reduce((s,r)=>s+(Number(r.querySelector('[data-item-qty]').value)||0)*(Number(r.querySelector('[data-item-price]').value)||0),0);const disc=Number(dlg.querySelector('[name="desconto"]')?.value)||0;const freight=Number(dlg.querySelector('[name="frete"]')?.value)||0;const target=dlg.querySelector('#saleTotal');if(target)target.textContent=money(Math.max(0,round(sub-disc+freight)))}
function nextSaleNumber(){const used=[...db.quotes,...db.orders].map(x=>Number(x.number)||0);const n=Math.max(1,Number(db.seq.quote)||1,Number(db.seq.order)||1,...used.map(x=>x+1));db.seq.quote=n+1;db.seq.order=n+1;return n}
function openSales(mode='quote',quoteId='',projectId='',clientId=''){
 const project=projectId?(db.projects||[]).find(p=>p.id===projectId):null;
 if(projectId&&!project)return alert('Projeto não encontrado. Atualize a lista de projetos.');
 if(clientId&&!getClient(clientId))return alert('Cliente não encontrado. Atualize o cadastro de clientes.');
 const q=mode==='quote'&&quoteId?getQuote(quoteId):null;if(q&&q.status!=='aberto')return alert('Orçamento convertido não pode ser editado.');
 const projectDescription=project?('Projeto '+project.nome+(project.ambiente?' · '+project.ambiente:'')):'';
 const projectNotes=project?('Projeto vinculado: '+project.nome+'. Conferir medidas, ferragens, materiais e custos antes de aprovar.'):'';
 const old=q||{clientId:clientId||project?.clientId||'',date:iso(),items:project?[{productId:'',descricao:projectDescription,quantidade:1,preco:Number(project.priceA)||0}]:[],desconto:0,entrega:'',ambientes:project?.ambiente||'',observacoes:projectNotes,projectId:project?.id||'',projectNome:project?.nome||'',payment:{tipo:'avista',entrada:0,parcelas:1,primeiroVencimento:iso()}};
 const fields=`${old.projectId?'<div class="ua-project-sales-note"><strong>Projeto vinculado:</strong> '+esc(old.projectNome||project?.nome||'')+' · Valores e materiais precisam de conferência antes da aprovação. <strong>Esta associação não gera baixa de estoque.</strong></div>':''}<div class="form-grid"><label class="full">Cliente *<select name="clientId" required><option value="">Selecione um cliente</option>${clientOptions(old.clientId)}</select><button type="button" class="btn" data-quick-client style="margin-top:8px">+ Novo cliente</button></label><label>Data<input type="date" name="date" value="${esc(old.date)}" required></label><label>Prazo / observação<input name="entrega" placeholder="Ex.: 30 dias úteis" value="${esc(old.entrega||'')}"></label><label>Data prevista de entrega<input type="date" name="entregaData" value="${esc(old.entregaData||'')}"></label></div><h3 class="form-section">Itens do ${mode==='quote'?'orçamento':'pedido'}</h3><div id="saleRows"></div><p>${button('+ Adicionar item','add-sale-item','','small')}</p><div class="form-grid"><label>Desconto (R$)<input type="number" min="0" step="0.01" name="desconto" value="${Number(old.desconto||0)}"></label><label>Frete / entrega (R$)<input type="number" min="0" step="0.01" name="frete" value="${Number(old.frete||0)}"></label><label>Ambientes<input name="ambientes" maxlength="250" placeholder="Cozinha, quarto, sala..." value="${esc(old.ambientes||'')}"></label><div class="card"><span class="label">Total do pedido</span><div class="value" id="saleTotal">${money(orderTotal(old))}</div></div><label>Condição de pagamento<select name="payTipo"><option value="avista">À vista</option><option value="parcelado">Parcelado</option><option value="entrada">Entrada + parcelas</option></select></label><label>Parcelas (saldo)<input name="payParcelas" type="number" min="1" max="36" value="${Number(old.payment?.parcelas||1)}"></label><label>Entrada (R$)<input name="payEntrada" type="number" min="0" step="0.01" value="${Number(old.payment?.entrada||0)}"></label><label>Primeiro vencimento<input type="date" name="payData" value="${esc(old.payment?.primeiroVencimento||iso())}"></label><label>Forma de pagamento<input name="payForma" maxlength="100" placeholder="Pix, cartão, boleto, dinheiro..." value="${esc(old.payment?.forma||'')}"></label><label class="full">Observações<textarea name="observacoes" rows="3">${esc(old.observacoes||'')}</textarea></label></div><p class="inline-note">Item livre ou serviço não tem baixa automática de matérias-primas. Produtos acabados usam sua composição cadastrada.</p>`;
 openModal(mode==='quote'?(q?'Editar orçamento '+(q.controlCode||'#'+q.number):'Novo orçamento'):'Novo pedido',fields,(v,dlg)=>{
 const items=collectSaleItems(dlg),desconto=round(v.desconto),subtotal=round(items.reduce((s,i)=>s+i.quantidade*i.preco,0));if(!Number.isFinite(subtotal)||!Number.isFinite(desconto)||desconto<0||desconto>subtotal)throw Error('Desconto ou itens com valor inválido.');const frete=round(v.frete);if(!Number.isFinite(frete)||frete<0)throw Error('Frete inválido.');const total=round(subtotal-desconto+frete);if(!Number.isFinite(total)||total<=0)throw Error('O total precisa ser maior que zero e ter valores numéricos válidos.');
 const payment={tipo:v.payTipo,forma:(v.payForma||'').trim(),entrada:round(v.payEntrada),parcelas:Math.max(1,Math.min(36,Math.floor(Number(v.payParcelas)||1))),primeiroVencimento:v.payData||v.date};if(payment.tipo==='entrada'&&!(payment.entrada>0&&payment.entrada<total))throw Error('A entrada deve ser maior que zero e menor que o valor do pedido.');
 const client=getClient(v.clientId);if(!client)throw Error('Selecione um cliente cadastrado.');const data={clientId:client.id,clientNome:client.nome,date:v.date,items,desconto,frete,ambientes:(v.ambientes||'').trim(),entrega:v.entrega,entregaData:v.entregaData||"",observacoes:v.observacoes,payment,projectId:old.projectId||'',projectNome:old.projectNome||''};
 if(mode==='quote'){
  const beforeQuotes=db.quotes,beforeSeq={...db.seq};
  if(q)db.quotes=db.quotes.map(row=>row.id===q.id?{...row,...data}:row);
  else db.quotes=[...db.quotes,{...data,id:id(),number:nextSaleNumber(),controlCode:nextControlCode('quote',v.date),status:'aberto'}];
  if(save()===false){
   db.quotes=beforeQuotes;db.seq=beforeSeq;
   throw Error('Não foi possível salvar o orçamento; os dados anteriores foram preservados.');
  }
  return true;
 }
 return createOrder(data);
 },dlg=>{dlg.querySelector('[data-action="add-sale-item"]').onclick=()=>addSaleRow(dlg);(old.items||[]).forEach(item=>addSaleRow(dlg,item));if(!old.items?.length)addSaleRow(dlg);dlg.querySelector('[name="desconto"]').oninput=()=>calcSale(dlg);dlg.querySelector('[name="frete"]').oninput=()=>calcSale(dlg);dlg.querySelector('[name="payTipo"]').value=old.payment?.tipo||'avista';
 dlg.querySelector('[data-quick-client]').onclick=()=>{
  const existing=new Set(db.clients.map(c=>String(c.id)));
  const customerDlg=clientModal();
  customerDlg?.addEventListener('close',()=>{
   const added=db.clients.find(c=>!existing.has(String(c.id)));
   if(!added)return;
   const select=dlg.querySelector('[name="clientId"]');
   if(!select)return;
   if(![...select.options].some(opt=>opt.value===added.id))select.add(new Option(added.nome,added.id));
   select.value=added.id;
  },{once:true});
 };calcSale(dlg)});
}
function addMonths(dateString,n){const d=new Date(dateString+'T12:00:00Z');const day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+n);const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,last));return d.toISOString().slice(0,10)}
function buildInstallments(total,payment,order){const pay=payment||{tipo:'avista',parcelas:1,entrada:0,primeiroVencimento:order.date};const first=pay.primeiroVencimento||order.date;const out=[];let balanceValue=total;
 if(pay.tipo==='entrada'){const amount=round(pay.entrada);out.push({label:'Entrada',valor:amount,date:order.date});balanceValue=round(total-amount)}
 const n=pay.tipo==='avista'?1:Math.max(1,Number(pay.parcelas)||1);let amountSoFar=0;for(let i=0;i<n;i++){const amount=i===n-1?round(balanceValue-amountSoFar):round(balanceValue/n);amountSoFar=round(amountSoFar+amount);out.push({label:pay.tipo==='avista'?'Pagamento à vista':`Parcela ${i+1}/${n}`,valor:amount,date:addMonths(first,i)})}return out}
function qty3(n){return Math.round(Number(n)*1000)/1000}
function requiredMaterials(items){const map=new Map();for(const item of items){const p=getProduct(item.productId);if(!p)continue;if(p.tipo==='materia'){map.set(p.id,qty3((map.get(p.id)||0)+Number(item.quantidade)))}else{for(const component of p.components||[])map.set(component.materialId,qty3((map.get(component.materialId)||0)+component.quantidade*item.quantidade))}}return [...map].map(([productId,quantidade])=>({productId,quantidade}))}
function reservedQuantity(pid,exclude=''){return qty3(db.orders.filter(o=>o.id!==exclude&&o.stockState==='reservado'&&o.status==='confirmado').reduce((sum,o)=>sum+(o.materials||[]).filter(m=>m.productId===pid).reduce((s,m)=>s+Number(m.quantidade),0),0))}
function tryReserve(order){const shortage=(order.materials||[]).filter(m=>{const p=getProduct(m.productId);return !p||p.estoque-reservedQuantity(m.productId,order.id)+0.000001<m.quantidade});if(shortage.length){order.stockState='pendente';return false}order.stockState='reservado';return true}
function createOrder(data,quoteId=''){
 const linked=quoteId?getQuote(quoteId):null;
 if(quoteId&&(!linked||linked.status==='convertido'||db.orders.some(o=>o.quoteId===quoteId)))
  throw Error('Este orçamento já foi convertido ou não existe.');
 const before={orders:db.orders,transactions:db.transactions,seq:{...db.seq},quoteStatus:linked?.status,quoteOrderId:linked?.orderId};
 try{
  const orderNumber=linked?linked.number:nextSaleNumber();
  if(linked&&db.orders.some(o=>String(o.number)===String(orderNumber)))
   throw Error('Já existe pedido com esse número. Verifique o histórico antes de converter.');
  db.seq.order=Math.max(Number(db.seq.order)||1,Number(orderNumber)+1);
  const order={...data,id:id(),number:orderNumber,controlCode:nextControlCode('order',data.date),status:'confirmado',quoteId,stockState:'pendente',createdAt:iso(),materials:requiredMaterials(data.items)};
  tryReserve(order);
  const amounts=buildInstallments(orderTotal(order),order.payment,order);
  if(!amounts.length||amounts.some(p=>!Number.isFinite(p.valor)||p.valor<0))throw Error('Parcelas inválidas.');
  db.orders=[...db.orders,order];
  db.transactions=[...db.transactions,...amounts.map(v=>({
   id:id(),kind:'receber',orderId:order.id,clientId:order.clientId,
   descricao:'Pedido '+order.controlCode+' · '+v.label,valor:v.valor,dueDate:v.date,payments:[]
  }))];
  if(linked){linked.status='convertido';linked.orderId=order.id}
  if(save()===false)throw Error('Não foi possível salvar o pedido. Nenhum lançamento foi confirmado.');
  return true;
 }catch(error){
  db.orders=before.orders;db.transactions=before.transactions;db.seq=before.seq;
  if(linked){linked.status=before.quoteStatus;linked.orderId=before.quoteOrderId}
  throw error;
 }
}
function convertQuote(qid){const q=getQuote(qid);if(!q||q.status==='convertido')return alert('Orçamento já convertido.');if(!confirm(`Converter orçamento ${q.controlCode||'#'+q.number} em pedido? O financeiro será gerado automaticamente.`))return;try{if(createOrder({clientId:q.clientId,clientNome:q.clientNome,date:iso(),items:q.items.map(i=>({...i})),desconto:q.desconto,frete:q.frete||0,ambientes:q.ambientes||'',entrega:q.entrega,entregaData:q.entregaData||"",observacoes:q.observacoes,projectId:q.projectId||'',projectNome:q.projectNome||'',payment:{...q.payment}},qid)){location.hash='pedidos';render('pedidos')}}catch(e){alert(e.message)}}
function removeQuote(qid){const q=getQuote(qid);if(!q||q.status!=='aberto')return;if(confirm('Excluir este orçamento?')){const before=db.quotes;db.quotes=db.quotes.filter(q=>q.id!==qid);if(save()===false){db.quotes=before;return alert('Não foi possível excluir o orçamento.');}render()}}
function ordersView(){const q=search.pedidos.toLowerCase();const list=db.orders.slice().reverse().filter(o=>[o.number,o.controlCode,o.clientNome,o.projectNome,statusText[o.status]].some(v=>String(v||'').toLowerCase().includes(q)));
 content.innerHTML=`${intro('Pedidos','Controle de produção, estoque e cobrança.',`${db.orders.length} pedido(s)`)}<section class="panel"><div class="toolbar">${inputSearch('pedidos')}<div class="actions">${button('+ Novo pedido','new-order','','primary')}</div></div>${table(['Pedido / Cliente','Valor e recebimento','Entrega','Produção / Materiais','Ações'],list.map(o=>{
 const state=o.stockState==='reservado'?pill('Materiais reservados','success'):o.stockState==='baixado'?pill('Estoque baixado','success'):pill('Reserva pendente','warn');
 return td(`<strong>${esc(o.controlCode||'#'+o.number)} · ${esc(o.clientNome)}</strong>${o.projectId?'<div class="small muted">Projeto: '+esc(o.projectNome||'Vinculado')+'</div>':''}<div class="small muted">${date(o.date)}</div>`,`<strong>${money(orderTotal(o))}</strong><div class="small muted">Recebido: ${money(orderPaid(o))}</div>`,esc(o.entrega||'A combinar'),`${pill(statusText[o.status]||o.status,o.status==='cancelado'?'danger':o.status==='entregue'?'success':'')}<div style="margin-top:6px">${o.status==='cancelado'?'':state}</div>`,`<div class="row-actions">${button('Detalhes','view-order',o.id,'small')}${o.status==='confirmado'&&o.stockState==='pendente'?button('Reservar','reserve-order',o.id,'small accent'):''}${o.status==='confirmado'?button('Produção','start-order',o.id,'small'):''}${o.status==='producao'?button('Pronto','ready-order',o.id,'small'):''}${o.status==='pronto'?button('Entregar','deliver-order',o.id,'small'):''}${o.status==='confirmado'?button('Cancelar','cancel-order',o.id,'small danger'):''}</div>`)}))}</section>`;
}
function reserveOrder(oid){
 const o=getOrder(oid);if(!o||o.status!=='confirmado')return;
 const oldState=o.stockState;
 const ok=tryReserve(o);
 if(save()===false){o.stockState=oldState;return alert('Não foi possível salvar a reserva. Tente novamente.');}
 render();alert(ok?'Materiais reservados.':'Estoque insuficiente para reservar todos os materiais. Confira Produtos e Estoque.');
}
function startOrder(oid){
 const o=getOrder(oid);if(!o||o.status!=='confirmado')return;
 if(o.stockState!=='reservado')return alert('Reserve os materiais antes de iniciar a produção.');
 const needed=o.materials||[];
 for(const m of needed){
  const p=getProduct(m.productId);
  if(!p||!Number.isFinite(Number(m.quantidade))||m.quantidade<=0||p.estoque+0.000001<m.quantidade)
   return alert('Estoque insuficiente ou quantidade inválida para iniciar a produção.');
 }
 if(!confirm('Iniciar produção do pedido #'+o.number+' e baixar materiais do estoque?'))return;
 const oldStocks=needed.map(m=>({id:m.productId,stock:getProduct(m.productId).estoque}));
 const oldMoves=db.stockMovements,oldStatus=o.status,oldState=o.stockState;
 try{
  const moves=[];
  for(const m of needed){
   const p=getProduct(m.productId);
   p.estoque=qty3(Number(p.estoque)-Number(m.quantidade));
   moves.push({id:id(),productId:p.id,nome:p.nome,delta:qty3(-Number(m.quantidade)),date:iso(),orderId:o.id,note:'Consumo pedido #'+o.number});
  }
  db.stockMovements=[...oldMoves,...moves];
  o.stockState='baixado';o.status='producao';
  if(save()===false)throw Error('Não foi possível salvar a produção.');
  render();
 }catch(error){
  for(const row of oldStocks){const p=getProduct(row.id);if(p)p.estoque=row.stock}
  db.stockMovements=oldMoves;o.stockState=oldState;o.status=oldStatus;
  alert(error.message+' Nenhum material foi baixado.');
 }
}
function advanceOrder(oid,newStatus){
 const o=getOrder(oid);if(!o)return;
 const allowed={producao:'pronto',pronto:'entregue'};
 if(allowed[o.status]!==newStatus)return alert('Transição de status inválida.');
 const previous=o.status;o.status=newStatus;
 if(save()===false){o.status=previous;return alert('Falha ao salvar. Situação anterior preservada.');}
 render();
}
function cancelOrder(oid){
 const o=getOrder(oid);if(!o||o.status!=='confirmado')return alert('Somente pedidos confirmados podem ser cancelados nesta versão.');
 if(orderPaid(o)>0)return alert('Há pagamento recebido. Regularize financeiramente antes de cancelar.');
 if(!confirm('Cancelar pedido #'+o.number+'? Reservas e contas ainda não pagas serão liberadas.'))return;
 const before={status:o.status,stockState:o.stockState,transactions:db.transactions};
 o.status='cancelado';o.stockState='liberado';
 db.transactions=db.transactions.filter(t=>t.orderId!==oid);
 if(save()===false){o.status=before.status;o.stockState=before.stockState;db.transactions=before.transactions;return alert('Falha ao cancelar. Lançamentos preservados.');}
 render();
}
function orderDetails(oid){const o=getOrder(oid);if(!o)return;const mats=o.materials||[];openModal(`Pedido ${o.controlCode||'#'+o.number}`,`<div class="summary-list"><div class="summary-row"><span>Cliente</span><strong>${esc(o.clientNome)}</strong></div>${o.projectId?'<div class="summary-row"><span>Projeto</span><strong>'+esc(o.projectNome||'Vinculado')+'</strong></div>':''}<div class="summary-row"><span>Status</span><strong>${esc(statusText[o.status]||o.status)}</strong></div><div class="summary-row"><span>Entrega</span><strong>${esc(o.entrega||'A combinar')}${o.entregaData?' · '+date(o.entregaData):''}</strong></div><div class="summary-row"><span>Valor total</span><strong>${money(orderTotal(o))}</strong></div><div class="summary-row"><span>Recebido</span><strong>${money(orderPaid(o))}</strong></div></div><h3 class="form-section">Itens</h3>${table(['Descrição','Qtd','Valor unit.','Total'],o.items.map(i=>td(esc(i.descricao),dec(i.quantidade),money(i.preco),money(i.preco*i.quantidade))))}<h3 class="form-section">Materiais para produção</h3>${table(['Material','Quantidade necessária'],mats.map(m=>td(esc(getProduct(m.productId)?.nome||'Material não encontrado'),dec(m.quantidade))))}<p class="inline-note">Estoque: ${esc(o.stockState)}</p>${button('Imprimir pedido','print-order',o.id)} ${button('Gerar contrato','print-contract',o.id)} ${button('Anexos de contratos','v5-go-attachments',o.id)} ${orderPaid(o)+.005>=orderTotal(o)?button('Recibo de quitação','v5-paid-receipt',o.id):''}`,(v,d)=>true);
}
function financeView(){const q=search.financeiro.toLowerCase();const list=db.transactions.slice().sort((a,b)=>a.dueDate.localeCompare(b.dueDate)).filter(t=>[t.descricao,t.kind,t.dueDate].some(v=>String(v||'').toLowerCase().includes(q)));
 const due=db.transactions.filter(t=>t.kind==='receber').reduce((s,t)=>s+balance(t),0),owing=db.transactions.filter(t=>t.kind==='pagar').reduce((s,t)=>s+balance(t),0);
 const earned=db.transactions.filter(t=>t.kind==='receber').reduce((s,t)=>s+cashReceived(t),0),spent=db.transactions.filter(t=>t.kind==='pagar').reduce((s,t)=>s+cashReceived(t),0);
 content.innerHTML=`${intro('Financeiro','Receitas, despesas, parcelas e pagamentos parciais.')}<div class="cards"><div class="card"><div class="label">A receber</div><div class="value">${money(due)}</div></div><div class="card"><div class="label">A pagar</div><div class="value">${money(owing)}</div></div><div class="card"><div class="label">Recebido</div><div class="value">${money(earned)}</div></div><div class="card"><div class="label">Saldo de caixa</div><div class="value">${money(earned-spent)}</div></div></div>
 <section class="panel gap-top"><div class="toolbar">${inputSearch('financeiro')}<div class="actions">${button('Exportar CSV','export-finance')}${button('+ Receita / Despesa','new-transaction','','primary')}</div></div>${table(['Lançamento','Vencimento','Valor','Saldo','Situação','Ações'],list.map(t=>{const paid=cashReceived(t);return td(`<strong>${esc(t.descricao)}</strong><div class="small muted">${esc(kindText[t.kind])}${t.orderId?' · Pedido #'+getOrder(t.orderId)?.number:''}</div>`,date(t.dueDate),money(t.valor),money(balance(t)),pill(balance(t)<0.005?'Pago':paid>0?'Parcial':'Pendente',balance(t)<0.005?'success':paid>0?'warn':''),`<div class="row-actions">${balance(t)>0?button('Registrar pagamento','pay-transaction',t.id,'small'):''}${t.kind==='receber'&&paid>0?button('Recibos','show-receipts',t.id,'small'):''}${!t.orderId&&paid===0?button('Excluir','delete-transaction',t.id,'small danger'):''}</div>`)}))}</section>`;
}
function transactionModal(){openModal('Nova receita ou despesa',`<div class="form-grid"><label>Tipo<select name="kind"><option value="receber">Receita</option><option value="pagar">Despesa</option></select></label><label>Vencimento<input type="date" name="dueDate" value="${iso()}" required></label><label class="full">Descrição *<input name="descricao" required></label><label>Valor (R$) *<input name="valor" type="number" step="0.01" min="0.01" required></label></div>`,v=>{if(!Number.isFinite(Number(v.valor))||Number(v.valor)<=0||!['receber','pagar'].includes(v.kind)||!String(v.descricao||'').trim())throw Error('Valor, tipo ou descrição inválidos.');const before=db.transactions;db.transactions=[...db.transactions,{id:id(),kind:v.kind,descricao:v.descricao.trim(),dueDate:v.dueDate,valor:round(v.valor),payments:[],orderId:''}];if(save()===false){db.transactions=before;throw Error('Não foi possível salvar o lançamento.');}return true})}
function paymentModal(tid){const t=db.transactions.find(x=>x.id===tid);if(!t)return;const left=balance(t);if(left<=0)return alert('Lançamento quitado.');openModal('Registrar '+(t.kind==='receber'?'recebimento':'pagamento'),`<p class="form-note">${esc(t.descricao)}<br>Saldo em aberto: <strong>${money(left)}</strong></p><div class="form-grid"><label>Valor ${t.kind==='receber'?'recebido':'pago'} *<input type="number" name="valor" required min="0.01" step="0.01" max="${left}" value="${left}"></label><label>Data<input type="date" name="date" required value="${iso()}"></label><label class="full">Forma de pagamento<input name="method" placeholder="Pix, dinheiro, transferência, cartão..."></label></div>`,v=>{const val=round(v.valor);if(!(val>0)||val>balance(t)+.001)throw Error('Valor deve ser maior que zero e não ultrapassar o saldo.');const oldPayments=t.payments||[];t.payments=[...oldPayments,{id:id(),valor:val,date:v.date,method:v.method||''}];if(save()===false){t.payments=oldPayments;throw Error('Não foi possível registrar o pagamento; o saldo foi preservado.');}return true})}
function receiptModal(tid){const t=db.transactions.find(x=>x.id===tid);if(!t||t.kind!=='receber')return;const rows=(t.payments||[]).slice().reverse().map(p=>td(date(p.date),money(p.valor),esc(p.method||'—'),button('Imprimir recibo','print-receipt',`${t.id}:${p.id}`,'small')));openModal('Recibos — '+t.descricao,table(['Data','Valor','Forma','Ação'],rows,'Nenhum recebimento.'),()=>true)}
const defaultContract=`CONTRATO DE FORNECIMENTO DE MÓVEIS / SERVIÇOS\n\nCONTRATADA: {{empresa}}\nCONTRATANTE: {{cliente}}\nPEDIDO Nº {{pedido}} — DATA: {{data}}\n\nOBJETO DO CONTRATO:\n{{itens}}\n\nVALOR TOTAL: {{total}}\nCONDIÇÃO DE PAGAMENTO: {{pagamento}}\nPRAZO OU PREVISÃO DE ENTREGA: {{entrega}}\n\nOUTRAS CONDIÇÕES / OBSERVAÇÕES:\n{{observacoes}}\n\nAs condições de instalação, garantia, alterações de projeto e responsabilidades devem ser definidas e revisadas pelas partes antes da assinatura.\n\n{{assinaturas}}`;
function companyView(){const c=db.company||{};
 content.innerHTML=`${intro('Minha Empresa','Dados para documentos e backup completo.')}<div class="settings-grid"><section class="panel"><h3>Dados da marcenaria</h3><div class="form-grid gap-top"><label class="full">Nome / Razão social<input id="coNome" value="${esc(c.nome||'Universa Art')}"></label><label>CPF / CNPJ<input id="coCnpj" value="${esc(c.cnpj)}"></label><label>Telefone<input id="coTel" value="${esc(c.telefone)}"></label><label class="full">E-mail<input id="coEmail" type="email" value="${esc(c.email)}"></label><label class="full">Endereço<input id="coEndereco" value="${esc(c.endereco)}"></label><label class="full">Pix / Dados bancários<input id="coPix" value="${esc(c.pix)}"></label></div><div class="actions gap-top">${button('Salvar dados','save-company','','primary')}${button('Adicionar logotipo','upload-logo')}</div>${c.logo?`<div class="gap-top"><img src="${esc(c.logo)}" alt="Logotipo" style="max-height:85px;max-width:220px;object-fit:contain"></div>`:''}</section><section class="panel"><h3>Modelo de contrato</h3><p class="muted">Personalize o texto. Use os campos entre chaves para preenchimento automático.</p><textarea id="contractTemplate" rows="20" style="width:100%;margin-top:15px;padding:13px;border:1px solid #cdd6d0;border-radius:9px;font:inherit">${esc(c.contrato||defaultContract)}</textarea><div class="actions gap-top">${button('Salvar modelo','save-contract','','primary')}</div></section></div><section class="panel gap-top"><div class="panel-head"><h3>Backup e restauração</h3></div><p class="muted">Exporta clientes, produtos, pedidos, movimentações, financeiro, empresa e contratos para um arquivo JSON. Guarde o backup em local seguro.</p><div class="actions gap-top">${button('Exportar backup completo','backup','','primary')}${button('Importar backup','import')}</div><div class="notice">Este site no GitHub Pages é público e não tem login. Os dados ficam apenas no navegador deste aparelho. Não use informações comerciais sensíveis até configurar banco de dados e autenticação seguros.</div></section>`;
}
function companySave(){const c=db.company;c.nome=content.querySelector('#coNome').value.trim();c.cnpj=content.querySelector('#coCnpj').value.trim();c.telefone=content.querySelector('#coTel').value.trim();c.email=content.querySelector('#coEmail').value.trim();c.endereco=content.querySelector('#coEndereco').value.trim();c.pix=content.querySelector('#coPix').value.trim();if(save())alert('Dados da empresa salvos.')}
function uploadLogo(){const file=document.createElement('input');file.type='file';file.accept='image/*';file.onchange=()=>{const f=file.files?.[0];if(!f)return;if(f.size>4e6)return alert('Imagem muito grande (máximo 4 MB).');const img=new Image();img.onload=()=>{const width=Math.min(img.width,350),height=Math.round(img.height*width/img.width);const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;canvas.getContext('2d').drawImage(img,0,0,width,height);db.company.logo=canvas.toDataURL('image/png');if(save())render('empresa');URL.revokeObjectURL(img.src)};img.onerror=()=>alert('Imagem inválida.');img.src=URL.createObjectURL(f)};file.click()}
function documentsView(){const printable=db.orders.filter(o=>o.status!=='cancelado').slice().reverse();const payments=db.transactions.filter(t=>t.kind==='receber'&&(t.payments||[]).length).flatMap(t=>t.payments.map(p=>({t,p}))).reverse();
 content.innerHTML=`${intro('Documentos','Orçamentos, pedidos, contratos e recibos para imprimir ou salvar em PDF.')}${notice()}<section class="panel"><h3>Contratos e pedidos</h3><p class="muted small">Contratos utilizam o modelo configurável em Minha Empresa.</p>${table(['Pedido','Cliente','Total','Documentos'],printable.map(o=>td(esc(o.controlCode||'#'+o.number),esc(o.clientNome),money(orderTotal(o)),`<div class="row-actions">${button('Pedido/PDF','print-order',o.id,'small')}${button('Contrato/PDF','print-contract',o.id,'small')}</div>`)))}</section><section class="panel gap-top"><h3>Recibos de pagamentos</h3>${table(['Pedido / Lançamento','Recebido em','Valor','Ação'],payments.map(({t,p})=>td(esc(t.descricao),date(p.date),money(p.valor),button('Recibo/PDF','print-receipt',`${t.id}:${p.id}`,'small'))))}</section><p class="footer-note">PDF: na janela de impressão do navegador, escolha “Salvar como PDF”.</p>`;
}
function openPrint(head,body){const w=window.open('','_blank');if(!w)return alert('Permita pop-ups para imprimir documentos.');const co=db.company||{};const logo=co.logo?`<img style="max-height:65px;max-width:170px" alt="Logo" src="${esc(co.logo)}">`:'';
 w.document.open();w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(head)}</title><style>body{max-width:840px;margin:35px auto;padding:20px;color:#222;font:15px/1.5 Arial,sans-serif}header{border-bottom:3px solid #d89c28;padding-bottom:16px;display:flex;justify-content:space-between;gap:20px}h1{font-size:24px}h2{font-size:18px}table{width:100%;border-collapse:collapse;margin:18px 0}th,td{padding:9px;border-bottom:1px solid #ddd;text-align:left}th{background:#f4f4f4}.pre{white-space:pre-wrap;line-height:1.7}.actions{margin:16px 0}.sign{margin-top:70px;display:flex;gap:40px}.sign>div{border-top:1px solid #222;flex:1;text-align:center;padding-top:8px}@media print{.actions{display:none}body{margin:0;padding:0}}</style></head><body><div class="actions"><button onclick="window.print()">Imprimir / Salvar PDF</button></div><header><div><strong>${esc(co.nome||'Universalartes')}</strong><div>${esc(co.cnpj||'')}</div><div>${esc(co.telefone||'')}</div><div>${esc(co.endereco||'')}</div></div>${logo}</header><h1>${esc(head)}</h1>${body}</body></html>`);w.document.close();w.focus()}
function salesPrint(o,type){const rows=o.items.map(i=>`<tr><td>${esc(i.descricao)}</td><td>${dec(i.quantidade)}</td><td>${money(i.preco)}</td><td>${money(i.quantidade*i.preco)}</td></tr>`).join('');const info=`<p><strong>Código de controle:</strong> ${esc(o.controlCode||'#'+o.number)}<br><strong>Cliente:</strong> ${esc(o.clientNome)}${o.projectId?'<br><strong>Projeto:</strong> '+esc(o.projectNome||'Vinculado'):''}<br><strong>Data:</strong> ${date(o.date)}<br><strong>Entrega:</strong> ${esc(o.entrega||'A combinar')}${o.entregaData?' · '+date(o.entregaData):''}</p><table><thead><tr><th>Item</th><th>Qtd.</th><th>Valor unit.</th><th>Subtotal</th></tr></thead><tbody>${rows}</tbody></table><p><strong>Ambientes:</strong> ${esc(o.ambientes||'Não informado')}<br>Desconto: ${money(o.desconto||0)}<br>Frete: ${money(o.frete||0)}</p><h2>Total: ${money(orderTotal(o))}</h2><p><strong>Pagamento:</strong> ${esc(paymentText(o.payment))}</p><p>${esc(o.observacoes||'')}</p>`;openPrint(`${type} ${o.controlCode||'#'+o.number}`,info)}
function paymentText(p={}){const terms=p.tipo==='entrada'?`Entrada de ${money(p.entrada)} + ${p.parcelas} parcela(s)`:p.tipo==='parcelado'?`${p.parcelas} parcela(s)`:'À vista';return terms+(p.forma?' · '+p.forma:'')}
function contractPrint(o){const c=db.company||{};const client=getClient(o.clientId);const tokens={empresa:[c.nome,c.cnpj,c.endereco].filter(Boolean).join(' — ')||'Universalartes',cliente:[client?.nome||o.clientNome,client?.doc,client?.endereco].filter(Boolean).join(' — '),pedido:String(o.controlCode||o.number),data:date(o.date),itens:o.items.map(i=>`${i.descricao} — ${dec(i.quantidade)} × ${money(i.preco)}`).join('\n'),total:money(orderTotal(o)),pagamento:paymentText(o.payment),entrega:o.entrega||'A combinar',observacoes:o.observacoes||'A combinar',assinaturas:'________________________________      ________________________________\n         CONTRATADA                                         CONTRATANTE'};
 const template=c.contrato||defaultContract;const text=template.replace(/{{(empresa|cliente|pedido|data|itens|total|pagamento|entrega|observacoes|assinaturas)}}/g,(_,key)=>tokens[key]);openPrint(`Contrato — ${o.controlCode||'Pedido nº '+o.number}`,`<div class="pre">${esc(text)}</div><p style="margin-top:30px;font-size:12px">Modelo editável. Revise as cláusulas e a adequação jurídica antes da assinatura.</p>`)}
function receiptPrint(tid,pid){const t=db.transactions.find(x=>x.id===tid);const payment=t?.payments?.find(p=>p.id===pid);if(!payment||t.kind!=='receber')return alert('Recebimento não encontrado.');const order=t.orderId?getOrder(t.orderId):null;const client=order?getClient(order.clientId):null;const c=db.company||{};
 const remains=balance(t),isFull=remains<.005;
 openPrint(`Recibo de ${isFull?'pagamento':'pagamento parcial'}`,`<p>Recebemos de <strong>${esc(client?.nome||order?.clientNome||'Pagador não identificado')}</strong>${client?.doc?' (CPF/CNPJ: '+esc(client.doc)+')':''} a importância de <strong>${money(payment.valor)}</strong>, em ${date(payment.date)}, referente a ${esc(t.descricao)}.</p><p><strong>Forma:</strong> ${esc(payment.method||'Não informada')}<br><strong>${isFull?'Situação da parcela: quitada':'Saldo pendente da parcela:'}</strong> ${isFull?'Quitada':money(remains)}.</p><p><strong>Emitente:</strong> ${esc(c.nome||'Universalartes')}</p><div class="sign"><div>Assinatura / Responsável</div></div>`)}
function backup(){const exportData={app:'oficina',version:3,exportedAt:new Date().toISOString(),data:db};download(`oficina-backup-${iso()}.json`,JSON.stringify(exportData,null,2))}
function validateBackup(obj){
 if(obj?.app!=='oficina')throw Error('O arquivo não é um backup do Oficina.');
 if(obj.version===2&&Array.isArray(obj.clientes)){
  if(obj.clientes.length>100000||obj.clientes.some(x=>!x||typeof x!=='object'||Array.isArray(x)))throw Error('Clientes do backup antigo inválidos.');
  return {kind:2,clients:obj.clientes};
 }
 if(obj.version!==3||!obj.data||obj.data.version!==3)throw Error('Versão ou estrutura do backup não reconhecida.');
 const data=obj.data;
 for(const prop of ['clients','products','quotes','orders','transactions','stockMovements'])if(!Array.isArray(data[prop]))throw Error('Campo '+prop+' inválido.');
 if(!data.company||typeof data.company!=='object'||Array.isArray(data.company)||!data.seq||typeof data.seq!=='object'||Array.isArray(data.seq))throw Error('Backup incompleto.');
 // Backups legítimos das versões anteriores podem não conter os módulos adicionados depois.
 const normalized={...data,seq:{...data.seq}};
 for(const field of ['suppliers','purchases','projects','invoices','orderAttachments']){
  if(data[field]!==undefined&&!Array.isArray(data[field]))throw Error('Campo '+field+' inválido no backup.');
  normalized[field]=data[field]||[];
 }
 for(const field of ['quote','order','purchase','project','invoice']){
  const collection={quote:'quotes',order:'orders',purchase:'purchases',project:'projects',invoice:'invoices'}[field];
  const next=normalized[collection].reduce((n,item)=>Math.max(n,(Number.isSafeInteger(Number(item?.number))&&Number(item.number)>=0)?Number(item.number)+1:1),1);
  const seq=Number(normalized.seq[field]);
  normalized.seq[field]=Number.isSafeInteger(seq)&&seq>=next?seq:next;
 }
 return {kind:3,data:normalized};
}
function importData(){const file=document.createElement('input');file.type='file';file.accept='.json,application/json';file.onchange=async()=>{const f=file.files?.[0];if(!f)return;if(f.size>15e6)return alert('Arquivo maior que 15 MB.');try{const raw=JSON.parse(await f.text());const result=validateBackup(raw);if(result.kind===2){if(!confirm(`Importar ${result.clients.length} clientes do backup antigo? Clientes atuais serão substituídos; os demais módulos serão preservados.`))return;db.clients=result.clients;}
 else{if(!confirm('ATENÇÃO: restaurar este arquivo vai SUBSTITUIR TODOS os dados atuais neste navegador. Você já exportou um backup do estado atual?'))return;backup();db=result.data;db.suppliers||=[];db.purchases||=[];db.seq.purchase||=1;}
 if(save()){search.clientes='';render();alert('Backup importado com sucesso.')}}catch(e){alert('Não foi possível importar o backup: '+e.message)}};file.click()}
function deleteTransaction(tid){const t=db.transactions.find(x=>x.id===tid);if(!t||t.orderId||cashReceived(t))return alert('Não é possível excluir lançamento vinculado a pedido ou com pagamento.');if(confirm('Excluir lançamento financeiro?')){db.transactions=db.transactions.filter(x=>x.id!==tid);save();render()}}
function handleAction(action,item){switch(action){
 case 'new-client':return clientModal();case 'edit-client':return clientModal(item);case 'delete-client':return removeClient(item);
 case 'new-supplier':return supplierModal();case 'edit-supplier':return supplierModal(item);case 'delete-supplier':return deleteSupplier(item);
 case 'new-purchase':return purchaseModal();case 'view-purchase':return viewPurchase(item);case 'go-purchases':location.hash='compras';return;case 'go-reports':location.hash='relatorios';return;case 'receive-purchase':return receivePurchase(item);case 'cancel-purchase':return cancelPurchase(item);
 case 'duplicate-quote':return duplicateQuote(item);case 'share-quote':return shareQuote(item);
 case 'export-finance':return exportFinanceCsv();case 'export-report':return exportReportCsv();case 'print-report':return printReport();
 case 'goto-products':location.hash='produtos';return;case 'goto-orders':location.hash='pedidos';return;case 'goto-finance':location.hash='financeiro';return;
 case 'filter-low-stock':lowStockOnly=!lowStockOnly;return render('produtos');
 case 'new-raw':return productModal('','materia');case 'edit-product':return productModal(item);case 'adjust-stock':return adjustStock(item);case 'delete-product':return removeProduct(item);
 case 'new-quote':return openSales('quote');case 'edit-quote':return openSales('quote',item);case 'convert-quote':return convertQuote(item);case 'delete-quote':return removeQuote(item);
 case 'print-quote':{const o=getQuote(item);if(o)salesPrint(o,'Orçamento');return}
 case 'new-order':return openSales('order');case 'view-order':return orderDetails(item);case 'reserve-order':return reserveOrder(item);case 'start-order':return startOrder(item);
 case 'ready-order':return advanceOrder(item,'pronto');case 'deliver-order':return advanceOrder(item,'entregue');case 'cancel-order':return cancelOrder(item);
 case 'new-transaction':return transactionModal();case 'pay-transaction':return paymentModal(item);case 'show-receipts':return receiptModal(item);case 'delete-transaction':return deleteTransaction(item);
 case 'print-order':{const o=getOrder(item);if(o)salesPrint(o,'Pedido');return}case 'print-contract':{const o=getOrder(item);if(o)contractPrint(o);return}
 case 'print-receipt':{const [tid,pid]=item.split(':');return receiptPrint(tid,pid)}
 case 'save-company':return companySave();case 'upload-logo':return uploadLogo();case 'save-contract':db.company.contrato=content.querySelector('#contractTemplate').value;return save()&&alert('Modelo de contrato salvo.');
 case 'backup':return backup();case 'import':return importData();
 }}
document.addEventListener('click',e=>{const btn=e.target.closest('[data-action]');if(btn&&!btn.closest('.sidebar')){const a=btn.dataset.action;if(['add-bom','add-sale-item'].includes(a))return;handleAction(a,btn.dataset.id||'')}});
content.addEventListener('input',setSearch);
document.querySelector('#menuToggle').addEventListener('click',()=>sidebar.classList.toggle('open'));
window.addEventListener('hashchange',()=>render());
setupExtras();
render();