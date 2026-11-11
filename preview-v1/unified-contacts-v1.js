'use strict';
/* UNIVERSA ART — cadastro único de Clientes e Fornecedores.
   Mantém db.clients e db.suppliers para compatibilidade com orçamentos e compras.
   Uma pessoa pode ter os dois papéis, vinculados pelo mesmo ID explícito. */
(function(){
  const forms=window.universalartesEntityForms;
  if(!forms)throw Error('Carregue compact-entities-v1.js antes do cadastro unificado.');
  let activeTab='todos';
  const oldHandleAction=handleAction;
  const originalRender=render;

  const oldIndex=sections.findIndex(s=>s[0]==='clientes');
  for(let i=sections.length-1;i>=0;i--){
    if(sections[i][0]==='clientes'||sections[i][0]==='fornecedores')sections.splice(i,1);
  }
  sections.splice(oldIndex>=0?oldIndex:1,0,['cadastros','♙','Clientes e Fornecedores']);

  function rolePair(id){
    const client=(db.clients||[]).find(x=>String(x.id)===String(id));
    const supplier=(db.suppliers||[]).find(x=>String(x.id)===String(id));
    const linked=!!(client&&supplier&&client.cadastroCompartilhado===true&&supplier.cadastroCompartilhado===true);
    return {client,supplier,linked};
  }
  function allEntries(){
    const list=[],pairedIds=new Set();
    (db.clients||[]).forEach(c=>{
      const pair=rolePair(c.id);
      if(pair.linked){
        pairedIds.add(String(c.id));
        list.push({id:String(c.id),role:'ambos',client:c,supplier:pair.supplier});
      }else list.push({id:String(c.id),role:'cliente',client:c,supplier:null});
    });
    (db.suppliers||[]).forEach(s=>{
      if(pairedIds.has(String(s.id)))return;
      list.push({id:String(s.id),role:'fornecedor',client:null,supplier:s});
    });
    return list.sort((a,b)=>String(a.client?.nome||a.supplier?.nome||'').localeCompare(String(b.client?.nome||b.supplier?.nome||''),'pt-BR'));
  }
  function describeRole(role){
    return role==='ambos'?'Cliente e fornecedor':role==='cliente'?'Cliente':'Fornecedor';
  }
  function showDirectory(){
    const all=allEntries(),clients=(db.clients||[]).length,suppliers=(db.suppliers||[]).length;
    const q=String(search.cadastros||'').trim().toLocaleLowerCase('pt-BR');
    const rows=all.filter(item=>{
      if(activeTab==='clientes'&&!item.client)return false;
      if(activeTab==='fornecedores'&&!item.supplier)return false;
      const c=item.client||item.supplier;
      const s=item.supplier||item.client;
      return !q||[c.nome,c.doc,c.telefone,c.whatsapp,c.email,c.cidade,s.nome,s.doc,s.telefone,s.whatsapp,s.email,s.cidade]
       .some(value=>String(value||'').toLocaleLowerCase('pt-BR').includes(q));
    });
    const tabs=[
      ['todos','Todos',all.length],
      ['clientes','Clientes',clients],
      ['fornecedores','Fornecedores',suppliers]
    ].map(([key,label,count])=>'<button type="button" role="tab" aria-selected="'+(activeTab===key?'true':'false')+'" class="ua-tab'+(activeTab===key?' active':'')+'" data-ua-directory-tab="'+key+'">'+label+' <span>'+count+'</span></button>').join('');
    const data=rows.map(item=>{
      const c=item.client||item.supplier;
      const role=item.role;
      const action='ua-edit-entry';
      const roleBadge='<span class="ua-person-role ua-person-'+role+'">'+esc(describeRole(role))+'</span>';
      const buttons=button('Editar',action,role+':'+item.id,'small')+
        (role==='ambos'?(activeTab==='clientes'?button('Excluir cliente','delete-client',item.id,'small danger'):activeTab==='fornecedores'?button('Excluir fornecedor','delete-supplier',item.id,'small danger'):''):
         button('Excluir',role==='cliente'?'delete-client':'delete-supplier',item.id,'small danger'));
      return td('<strong>'+esc(c.nome||'—')+'</strong><div class="muted small">'+esc(c.email||'')+'</div>',roleBadge,
        esc(c.doc||'—'),esc(c.whatsapp||c.telefone||'—'),esc(c.cidade||'—'),'<div class="row-actions">'+buttons+'</div>');
    });
    content.innerHTML=intro('Clientes e Fornecedores','Um só lugar para consultar e cadastrar contatos da Universalartes.',all.length+' cadastro(s)')+
      '<section class="panel ua-directory"><div class="ua-directory-head">'+
      '<div><h3>Agenda de contatos</h3><p class="muted">Clientes e fornecedores continuam vinculados aos seus pedidos e compras.</p></div>'+
      '<div class="actions">'+button('+ Novo cadastro','ua-new-entry',activeTab==='fornecedores'?'fornecedor':'cliente','primary')+'</div>'+
      '</div><div class="ua-directory-bar"><div class="ua-directory-tabs" role="tablist" aria-label="Filtrar cadastro">'+tabs+'</div>'+
      '<div class="ua-directory-search">'+inputSearch('cadastros')+'</div></div>'+
      table(['Nome / Razão social','Cadastro','CPF/CNPJ','Telefone / WhatsApp','Cidade','Ações'],
        data,'Nenhum contato encontrado para este filtro.')+
      '<p class="ua-directory-note">Uma pessoa pode ser cliente, fornecedor ou os dois. Cadastros antigos não são unidos automaticamente.</p></section>';
    content.querySelectorAll('[data-ua-directory-tab]').forEach(b=>b.addEventListener('click',()=>{
      activeTab=b.dataset.uaDirectoryTab;
      if(location.hash.slice(1)!=='cadastros')location.hash='cadastros';
      else render('cadastros');
    }));
  }
  function resolveEntry(role,uid){
    const pair=rolePair(uid);
    if(role==='ambos'){
      if(!pair.linked)throw Error('Cadastro compartilhado não localizado.');
      return {client:pair.client,supplier:pair.supplier,role:'ambos'};
    }
    if(role==='cliente'){
      if(!pair.client)throw Error('Cliente não encontrado.');
      return {client:pair.client,supplier:pair.linked?pair.supplier:null,role:pair.linked?'ambos':'cliente'};
    }
    if(role==='fornecedor'){
      if(!pair.supplier)throw Error('Fornecedor não encontrado.');
      return {client:pair.linked?pair.client:null,supplier:pair.supplier,role:pair.linked?'ambos':'fornecedor'};
    }
    throw Error('Tipo de cadastro não reconhecido.');
  }
  function openUnified(role='cliente',uid=''){
    const isEdit=!!uid;
    const found=isEdit?resolveEntry(role,uid):{client:null,supplier:null,role};
    const {client,supplier}=found;
    const base={...supplier,...client};
    if(supplier){
      for(const field of ['categoria','prazoEntrega','condicaoPagamento','site','favorito'])base[field]=supplier[field];
    }
    const initialRole=isEdit?found.role:role;
    const options=(
      isEdit?
       (found.role==='ambos'?['ambos']:found.role==='cliente'?['cliente','ambos']:['fornecedor','ambos']):
       ['cliente','fornecedor','ambos']
    );
    const selection='<div class="ua-role-picker"><label>Tipo de cadastro *<select name="papelCadastro" required>'+
      options.map(r=>'<option value="'+r+'" '+(initialRole===r?'selected':'')+'>'+esc(describeRole(r))+'</option>').join('')+
      '</select></label><p class="muted small">É possível cadastrar a mesma pessoa como cliente e fornecedor, sem apagar seus vínculos anteriores.</p></div>';
    const details=forms.buildFields(base,'fornecedor');
    return openModal(isEdit?'Editar cadastro':'Novo cadastro',selection+details,(values)=>{
      const chosen=values.papelCadastro;
      const asClient=chosen==='cliente'||chosen==='ambos';
      const asSupplier=chosen==='fornecedor'||chosen==='ambos';
      if(!['cliente','fornecedor','ambos'].includes(chosen))throw Error('Escolha o tipo do cadastro.');
      if(isEdit&&((client&&!asClient)||(supplier&&!asSupplier)))throw Error('Não é permitido remover um papel existente por esta edição.');
      const currentId=uid||id();
      // Não combinar por coincidência de nomes/documentos. Somente uma vinculação explícita.
      if(asClient&&!client&&(db.clients||[]).some(x=>String(x.id)===String(currentId)))throw Error('Identificador de cliente já utilizado.');
      if(asSupplier&&!supplier&&(db.suppliers||[]).some(x=>String(x.id)===String(currentId)))throw Error('Identificador de fornecedor já utilizado.');
      const {papelCadastro,...fields}=values;
      const cData=asClient?forms.validateEntry(fields,client||{},db.clients,'cliente'):null;
      const sData=asSupplier?forms.validateEntry(fields,supplier||{},db.suppliers,'fornecedor'):null;
      const linked=asClient&&asSupplier;
      // Cópia das coleções para reverter edição quando o navegador recusar a gravação.
      const before={clients:db.clients,suppliers:db.suppliers,quotes:db.quotes,orders:db.orders,purchases:db.purchases};
      try{
        if(asClient){
          const next={...client,...cData,id:currentId,cadastroCompartilhado:linked};
          db.clients=client?db.clients.map(x=>String(x.id)===String(currentId)?next:x):[...db.clients,next];
          if(client){
            db.quotes=db.quotes.map(q=>q.clientId===currentId?{...q,clientNome:next.nome}:q);
            db.orders=db.orders.map(o=>o.clientId===currentId?{...o,clientNome:next.nome}:o);
          }
        }
        if(asSupplier){
          const next={...supplier,...sData,id:currentId,cadastroCompartilhado:linked};
          db.suppliers=supplier?db.suppliers.map(x=>String(x.id)===String(currentId)?next:x):[...db.suppliers,next];
          if(supplier)db.purchases=db.purchases.map(p=>p.supplierId===currentId?{...p,supplierNome:next.nome}:p);
        }
        if(save()===false){Object.assign(db,before);return false}
        return true;
      }catch(err){Object.assign(db,before);throw err}
    },dialog=>{
      dialog.classList.add('ua-entity-dialog','ua-unified-dialog');
      const heading=dialog.querySelector('h2');
      heading?.insertAdjacentHTML('afterbegin','<small class="ua-entity-eyebrow">CADASTRO UNIFICADO · UNIVERSA ART</small>');
      const submit=dialog.querySelector('.dialog-actions [type="submit"]');
      if(submit)submit.textContent=isEdit?'Salvar alterações':'Salvar cadastro';
      const close=document.createElement('button');
      close.type='button';close.className='ua-entity-close';
      close.setAttribute('aria-label','Fechar cadastro');close.textContent='×';
      close.onclick=()=>dialog.close();
      dialog.insertBefore(close,dialog.firstChild);
      const form=dialog.querySelector('form');
      form?.addEventListener('input',e=>{
        const el=e.target;if(!(el instanceof HTMLInputElement))return;
        if(el.dataset.uaMask==='doc')el.value=forms.maskDocument(el.value);
        if(el.dataset.uaMask==='cep')el.value=forms.maskCep(el.value);
        if(el.dataset.uaMask==='phone')el.value=forms.maskPhone(el.value);
      });
      const supplierFields=['categoria','prazoEntrega','condicaoPagamento','site','favorito'];
      const supplierRows=supplierFields.map(name=>form.querySelector('[name="'+name+'"]')?.closest('label')).filter(Boolean);
      const supplierHeading=[...dialog.querySelectorAll('.ua-entity-section')].find(h=>h.textContent.includes('Condições do fornecedor'));
      const toggle=()=>{
        const choice=form.elements.namedItem('papelCadastro').value;
        const show=choice==='fornecedor'||choice==='ambos';
        [...supplierRows,supplierHeading].filter(Boolean).forEach(el=>{el.hidden=!show;el.querySelectorAll('input,select').forEach(input=>input.disabled=!show)});
      };
      form.elements.namedItem('papelCadastro').addEventListener('change',toggle);
      toggle();
      form.querySelector('[name="nome"]')?.focus();
    });
  }
  const originalClientModal=clientModal,originalSupplierModal=supplierModal;
  clientModal=function(clientId=''){return openUnified('cliente',clientId)};
  supplierModal=function(supplierId=''){return openUnified('fornecedor',supplierId)};
  handleAction=function(action,uid){
    if(action==='ua-new-entry')return openUnified(uid||'cliente');
    if(action==='ua-edit-entry'){
      const pos=uid.indexOf(':');if(pos<0)return alert('Cadastro não encontrado.');
      try{return openUnified(uid.slice(0,pos),uid.slice(pos+1))}
      catch(err){return alert(err.message||'Erro ao abrir cadastro.')}
    }
    if(action==='delete-client'||action==='delete-supplier'){
      const pair=rolePair(uid),wasLinked=pair.linked;
      const result=oldHandleAction(action,uid);
      if(wasLinked){
        const after=rolePair(uid);
        if(action==='delete-client'&&!after.client&&after.supplier){
          db.suppliers=db.suppliers.map(s=>String(s.id)===String(uid)?{...s,cadastroCompartilhado:false}:s);save();
        }
        if(action==='delete-supplier'&&!after.supplier&&after.client){
          db.clients=db.clients.map(c=>String(c.id)===String(uid)?{...c,cadastroCompartilhado:false}:c);save();
        }
      }
      return result;
    }
    return oldHandleAction(action,uid);
  };
  render=function unifiedRender(section=location.hash.slice(1)||'dashboard'){
    if(section==='clientes')activeTab='clientes';
    if(section==='fornecedores')activeTab='fornecedores';
    if(['cadastros','clientes','fornecedores'].includes(section)){
      title.textContent='Clientes e Fornecedores';
      nav.innerHTML=sections.map(([key,icon,label])=>'<button class="nav-btn '+(key==='cadastros'?'active':'')+'" data-section="'+esc(key)+'"><span aria-hidden="true">'+esc(icon)+'</span>'+esc(label)+'</button>').join('');
      nav.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{
        const next=b.dataset.section;
        location.hash=next;
        sidebar.classList.remove('open');
        if(location.hash.slice(1)===section)render(next);
      }));
      showDirectory();return;
    }
    return originalRender(section);
  };
  window.universalartesUnifiedContacts={allEntries,openUnified,showDirectory,rolePair,describeRole};
  // Atualiza imediatamente a navegação, inclusive quando a página abre no Dashboard.
  render(location.hash.slice(1)||'dashboard');
})();