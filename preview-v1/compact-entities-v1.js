'use strict';
/*
 * UNIVERSALARTES — formulários compactos de clientes e fornecedores.
 * Mantém os campos antigos no mesmo objeto; adiciona os opcionais sem migração destrutiva.
 * Não envia dados para serviços externos nem altera regras de orçamento/compra.
 */
(function(){
  const digits=v=>String(v??'').replace(/\D/g,'');
  const val=v=>String(v??'').trim();
  const safe=v=>esc(v??'');
  const states=['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
  const maskDocument=v=>{
    const n=digits(v).slice(0,14);
    if(n.length<=11)return n.replace(/^(\d{3})(\d)/,'$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/,'$1.$2.$3').replace(/\.(\d{3})(\d{1,2})$/,'.$1-$2');
    return n.slice(0,2)+(n.length>2?'.'+n.slice(2,5):'')+(n.length>5?'.'+n.slice(5,8):'')+(n.length>8?'/'+n.slice(8,12):'')+(n.length>12?'-'+n.slice(12):'');
  };
  const maskPhone=v=>{
    const n=digits(v);
    if(n.length>11)return val(v).slice(0,25); // preserva contatos internacionais já existentes
    if(n.length<=2)return n;
    if(n.length<=6)return '('+n.slice(0,2)+') '+n.slice(2);
    if(n.length<=10)return '('+n.slice(0,2)+') '+n.slice(2,-4)+'-'+n.slice(-4);
    return '('+n.slice(0,2)+') '+n.slice(2,7)+'-'+n.slice(7);
  };
  const maskCep=v=>{
    const n=digits(v).slice(0,8);
    return n.length>5?n.slice(0,5)+'-'+n.slice(5):n;
  };
  function isCpf(n){
    if(n.length!==11||/^(\d)\1+$/.test(n))return false;
    for(let k=9;k<=10;k++){
      let sum=0;
      for(let i=0;i<k;i++)sum+=(Number(n[i])*(k+1-i));
      let check=(sum*10)%11;
      if(check===10)check=0;
      if(check!==Number(n[k]))return false;
    }
    return true;
  }
  function isCnpj(n){
    if(n.length!==14||/^(\d)\1+$/.test(n))return false;
    for(let k=12;k<=13;k++){
      const weights=k===12?[5,4,3,2,9,8,7,6,5,4,3,2]:[6,5,4,3,2,9,8,7,6,5,4,3,2];
      const sum=weights.reduce((s,w,i)=>s+w*Number(n[i]),0);
      const check=sum%11<2?0:11-sum%11;
      if(check!==Number(n[k]))return false;
    }
    return true;
  }
  function validateEntry(v,old,list,kind){
    const data={...v};
    data.nome=val(v.nome);
    data.tipo=v.tipo==='PJ'?'PJ':'PF';
    if(!data.nome)throw Error('Informe o nome ou a razão social.');
    data.doc=maskDocument(v.doc);
    const doc=digits(data.doc), oldDoc=digits(old.doc);
    if(doc){
      if(data.tipo==='PF'&&doc.length!==11||data.tipo==='PJ'&&doc.length!==14){
        throw Error('Informe um '+(data.tipo==='PJ'?'CNPJ com 14 dígitos.':'CPF com 11 dígitos.'));
      }
      if(doc!==oldDoc && !(data.tipo==='PJ'?isCnpj(doc):isCpf(doc))){
        throw Error((data.tipo==='PJ'?'CNPJ':'CPF')+' inválido. Confira os dígitos.');
      }
      if(list.some(x=>x.id!==old.id&&digits(x.doc)===doc))throw Error('Este CPF/CNPJ já está cadastrado em '+(kind==='cliente'?'Clientes.':'Fornecedores.'));
    }
    data.telefone=maskPhone(v.telefone);
    data.whatsapp=maskPhone(v.whatsapp);
    data.cep=maskCep(v.cep);
    if(data.cep && digits(data.cep).length!==8)throw Error('O CEP deve conter 8 dígitos.');
    data.uf=val(v.uf).toUpperCase();
    if(data.uf&&!states.includes(data.uf))throw Error('Selecione uma UF válida.');
    if(val(v.prazoEntrega)){
      const prazo=Number(v.prazoEntrega);
      if(!Number.isSafeInteger(prazo)||prazo<0||prazo>365)throw Error('Prazo médio de entrega: informe de 0 a 365 dias.');
      data.prazoEntrega=String(prazo);
    }
    for(const key of ['email','contato','inscricaoEstadual','endereco','numero','bairro','complemento','cidade','observacoes','categoria','condicaoPagamento','site']){
      if(key in data)data[key]=val(data[key]);
    }
    data.favorito=(v.favorito==='on');
    return data;
  }
  function field(label,name,value='',options={}){
    const attr=Object.entries(options).map(([k,v])=>v===true?' '+k:v===false||v===null?'':' '+k+'="'+safe(v)+'"').join('');
    return '<label'+(options.wide?' class="ua-entity-wide"':'')+'>'+label+'<input name="'+name+'" value="'+safe(value)+'"'+attr.replace(' wide','')+'></label>';
  }
  function buildFields(old,kind){
    const isSupplier=kind==='fornecedor';
    const t=old.tipo==='PJ'||(!old.tipo&&digits(old.doc).length===14)?'PJ':'PF';
    const doc=old.doc||'';
    const common=[
      '<div class="ua-entity-grid">',
      field('Nome / Razão social *','nome',old.nome,{required:true,maxlength:160,placeholder:isSupplier?'Ex.: Madeireira Central':'Ex.: Nome do cliente'}),
      '<label>Tipo *<select name="tipo" required><option value="PF" '+(t==='PF'?'selected':'')+'>Pessoa física</option><option value="PJ" '+(t==='PJ'?'selected':'')+'>Pessoa jurídica</option></select></label>',
      field('CPF / CNPJ','doc',doc,{inputmode:'numeric',maxlength:18,'data-ua-mask':'doc',placeholder:'Opcional'}),
      field('Inscrição estadual','inscricaoEstadual',old.inscricaoEstadual,{maxlength:30}),
      field('Telefone','telefone',old.telefone,{type:'tel',maxlength:25,'data-ua-mask':'phone',placeholder:'(11) 3333-3333'}),
      field('WhatsApp','whatsapp',old.whatsapp,{type:'tel',maxlength:25,'data-ua-mask':'phone',placeholder:'(11) 99999-9999'}),
      field('E-mail','email',old.email,{type:'email',maxlength:180,placeholder:'contato@exemplo.com.br'}),
      field(isSupplier?'Contato / vendedor':'Contato responsável','contato',old.contato,{maxlength:120}),
      '<div class="ua-entity-section ua-entity-wide">Endereço e localização</div>',
      field('CEP','cep',old.cep,{inputmode:'numeric',maxlength:9,'data-ua-mask':'cep',placeholder:'00000-000'}),
      '<label>UF<select name="uf"><option value="">Selecione</option>'+states.map(uf=>'<option value="'+uf+'" '+(uf===old.uf?'selected':'')+'>'+uf+'</option>').join('')+'</select></label>',
      field('Cidade','cidade',old.cidade,{maxlength:120}),
      field('Bairro','bairro',old.bairro,{maxlength:120}),
      field('Endereço / Rua','endereco',old.endereco,{maxlength:200}),
      field('Número','numero',old.numero,{maxlength:20}),
      field('Complemento','complemento',old.complemento,{maxlength:120}),
    ];
    if(isSupplier){
      common.push(
        '<div class="ua-entity-section ua-entity-wide">Condições do fornecedor</div>',
        '<label>Categoria principal<select name="categoria"><option value="">Selecionar</option>'+
        (['MDF e chapas','Ferragens','Fitas de borda','Vidros','Alumínio','Pintura e acabamento','Terceirização','Outros'].includes(old.categoria)||!old.categoria?['MDF e chapas','Ferragens','Fitas de borda','Vidros','Alumínio','Pintura e acabamento','Terceirização','Outros']:[old.categoria,'MDF e chapas','Ferragens','Fitas de borda','Vidros','Alumínio','Pintura e acabamento','Terceirização','Outros'])
         .map(s=>'<option value="'+safe(s)+'" '+(s===old.categoria?'selected':'')+'>'+safe(s)+'</option>').join('')+'</select></label>',
        field('Prazo médio de entrega (dias)','prazoEntrega',old.prazoEntrega,{type:'number',min:0,max:365,step:1}),
        field('Condição de pagamento','condicaoPagamento',old.condicaoPagamento,{maxlength:120,placeholder:'Ex.: 30 dias ou à vista'}),
        field('Site','site',old.site,{type:'url',maxlength:200,placeholder:'https://...'}),
        '<label class="ua-entity-wide ua-favorite"><input type="checkbox" name="favorito" '+(old.favorito?'checked':'')+'> Marcar como fornecedor favorito</label>'
      );
    }
    common.push(
      '<label class="ua-entity-wide">Observações<textarea name="observacoes" rows="2" maxlength="3000" placeholder="'+(isSupplier?'Materiais fornecidos, vendedor, horário de atendimento...':'Preferências, informações da obra e detalhes do atendimento...')+'">'+safe(old.observacoes)+'</textarea></label>',
      '</div>'
    );
    return common.join('');
  }
  function enhanceModal(dialog,kind,isEdit){
    dialog.classList.add('ua-entity-dialog');
    const heading=dialog.querySelector('h2');
    if(heading)heading.insertAdjacentHTML('afterbegin','<small class="ua-entity-eyebrow">'+(kind==='cliente'?'CADASTRO DE CLIENTE':'CADASTRO DE FORNECEDOR')+'</small>');
    const submit=dialog.querySelector('.dialog-actions [type="submit"]');
    if(submit)submit.textContent=isEdit?'Salvar alterações':'Salvar '+kind;
    const close=document.createElement('button');close.type='button';close.className='ua-entity-close';close.setAttribute('aria-label','Fechar cadastro');close.textContent='×';close.addEventListener('click',()=>dialog.close());dialog.insertBefore(close,dialog.firstChild);
    const form=dialog.querySelector('form');
    form?.addEventListener('input',e=>{
      const input=e.target;
      if(!(input instanceof HTMLInputElement))return;
      const mask=input.dataset.uaMask;
      if(mask==='doc')input.value=maskDocument(input.value);
      else if(mask==='cep')input.value=maskCep(input.value);
      else if(mask==='phone')input.value=maskPhone(input.value);
    });
    form?.querySelector('[name="nome"]')?.focus();
  }
  clientModal=function(clientId=''){
    const old=(db.clients||[]).find(c=>c.id===clientId)||{};
    if(clientId&&!old.id)return alert('Cliente não encontrado.');
    return openModal(clientId?'Editar cliente':'Novo cliente',buildFields(old,'cliente'),values=>{
      const data=validateEntry(values,old,db.clients,'cliente');
      const client={...old,...data,id:old.id||id()};
      if(old.id){
        db.clients=db.clients.map(x=>x.id===old.id?client:x);
        db.quotes.forEach(q=>{if(q.clientId===old.id)q.clientNome=client.nome});
        db.orders.forEach(o=>{if(o.clientId===old.id)o.clientNome=client.nome});
      }else db.clients.push(client);
      return save();
    },dialog=>enhanceModal(dialog,'cliente',!!clientId));
  };
  supplierModal=function(supplierId=''){
    const old=(db.suppliers||[]).find(s=>s.id===supplierId)||{};
    if(supplierId&&!old.id)return alert('Fornecedor não encontrado.');
    return openModal(supplierId?'Editar fornecedor':'Novo fornecedor',buildFields(old,'fornecedor'),values=>{
      const data=validateEntry(values,old,db.suppliers,'fornecedor');
      const supplier={...old,...data,id:old.id||id()};
      if(old.id){
        db.suppliers=db.suppliers.map(x=>x.id===old.id?supplier:x);
        db.purchases.forEach(p=>{if(p.supplierId===old.id)p.supplierNome=supplier.nome});
      }else db.suppliers.push(supplier);
      return save();
    },dialog=>enhanceModal(dialog,'fornecedor',!!supplierId));
  };
  window.universalartesEntityForms={buildFields,validateEntry,maskDocument,maskPhone,maskCep,isCpf,isCnpj};
})();
