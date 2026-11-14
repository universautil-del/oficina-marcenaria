'use strict';
/* UNIVERSA ART — Cadastro de Categorias de produtos.
   Categorias ficam no mesmo documento do OFICINA, sem banco separado.
   Respeita dados legados; renomear atualiza produtos vinculados e exclui somente categorias sem produtos. */
(function(){
 const defaults=['Chapas MDF','Outras chapas','Parafusos','Buchas','Fitas de borda','Dobradiças','Corrediças','Puxadores','Colas e adesivos','Ferragens','Outros insumos'];
 const normalize=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toLocaleLowerCase('pt-BR');
 const text=s=>String(s??'').trim().replace(/\s+/g,' ').slice(0,120);
 const safe=s=>esc(s);
 const key=name=>'cat-'+normalize(name).replace(/[^a-z0-9]+/g,'-');
 function list(data=db){
  const byName=new Map();
  const supplied=Array.isArray(data.categories)?
   data.categories:defaults.map(nome=>({id:key(nome),nome,descricao:''}));
  for(const item of supplied){
   const nome=text(item?.nome);
   if(!nome||byName.has(normalize(nome)))continue;
   byName.set(normalize(nome),{id:String(item.id||key(nome)),nome,descricao:String(item.descricao||'').slice(0,500)});
  }
  // Categorias dos produtos antigos devem continuar disponíveis, sem apagar ou alterar esses produtos.
  for(const p of Array.isArray(data.products)?data.products:[]){
   const nome=text(p.categoria);
   if(nome&&!byName.has(normalize(nome)))byName.set(normalize(nome),{id:key(nome),nome,descricao:''});
  }
  return [...byName.values()].sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR',{sensitivity:'base'}));
 }
 function options(current='',data=db){
  const value=text(current);
  const all=list(data);
  if(value&&!all.some(x=>normalize(x.nome)===normalize(value)))
   all.push({nome:value,id:key(value)});
  return '<option value="">Selecione uma categoria</option>'+
   all.map(c=>'<option value="'+safe(c.nome)+'"'+(normalize(c.nome)===normalize(value)?' selected':'')+'>'+safe(c.nome)+'</option>').join('');
 }
 function ensureOption(select,name){
  if(!select)return;
  const label=text(name);
  if(!label)return;
  const existing=[...select.options].some(o=>normalize(o.value)===normalize(label));
  if(!existing){
   const option=document.createElement('option');
   option.value=label;option.textContent=label;select.append(option);
  }
  select.value=label;
  select.dispatchEvent(new Event('change',{bubbles:true}));
 }
 function quantity(name,data=db){
  return (data.products||[]).filter(p=>normalize(p.categoria)===normalize(name)).length;
 }
 function persist(nextProducts,nextCategories){
  const priorCategories=db.categories,priorProducts=db.products;
  db.categories=nextCategories;
  db.products=nextProducts;
  try{
   if(save()===false)throw Error('Não foi possível salvar a alteração. Confira a sincronização.');
  }catch(error){db.categories=priorCategories;db.products=priorProducts;throw error;}
  return true;
 }
 function edit(categoryId='',returnTo=null){
  const all=list();
  const current=categoryId?all.find(x=>x.id===categoryId):null;
  if(categoryId&&!current)return alert('Categoria não encontrada. Atualize a página.');
  const fields='<div class="ua-category-fields form-grid">'+
   '<label class="full">Nome da categoria *<input name="nome" maxlength="120" required value="'+safe(current?.nome||'')+'" placeholder="Ex.: Chapas MDF, Parafusos"></label>'+
   '<label class="full">Descrição (opcional)<textarea name="descricao" maxlength="500" rows="3" placeholder="Uso e observações">'+safe(current?.descricao||'')+'</textarea></label>'+
   '</div><p class="muted small">As categorias organizam os produtos, mas não movimentam o estoque ou alteram valores.</p>';
  return openModal(current?'Editar categoria':'Cadastro de categorias',fields,(values)=>{
   const nome=text(values.nome),descricao=String(values.descricao||'').trim().slice(0,500);
   if(!nome||nome.length>120)throw Error('Informe uma categoria válida com até 120 caracteres.');
   const before=list();
   if(before.some(c=>normalize(c.nome)===normalize(nome)&&c.id!==current?.id))
    throw Error('Já existe uma categoria com este nome.');
   let next=before.map(x=>({...x}));
   const nextProducts=(db.products||[]).map(p=>({...p}));
   if(current){
    const i=next.findIndex(c=>c.id===current.id);
    if(i<0)throw Error('Categoria não encontrada.');
    if(normalize(nome)!==normalize(current.nome)&&quantity(current.nome)>0){
     if(!confirm('Esta categoria está vinculada a '+quantity(current.nome)+' produto(s). Atualizar a categoria desses produtos para "'+nome+'"?'))return false;
     nextProducts.forEach(p=>{if(normalize(p.categoria)===normalize(current.nome))p.categoria=nome});
    }
    next[i]={...next[i],nome,descricao};
   }else{
    next.push({id:id(),nome,descricao});
   }
   if(!persist(nextProducts,next))return false;
   if(returnTo?.isConnected){
    returnTo.innerHTML=options(nome);
    ensureOption(returnTo,nome);
   }
   return true;
  });
 }
 function remove(categoryId){
  const current=list().find(x=>x.id===categoryId);
  if(!current)return alert('Categoria não encontrada.');
  const count=quantity(current.nome);
  if(count)return alert('Esta categoria é utilizada por '+count+' produto(s). Altere a categoria dos produtos antes de excluir.');
  if(!confirm('Excluir a categoria "'+current.nome+'"?'))return;
  try{persist(db.products,list().filter(c=>c.id!==current.id));render('categorias')}
  catch(error){alert(error.message||'Não foi possível excluir.')}
 }
 function view(){
  const categories=list();
  const rows=categories.map(c=>td(
   '<strong>'+safe(c.nome)+'</strong>'+(c.descricao?'<div class="small muted">'+safe(c.descricao)+'</div>':''),
   quantity(c.nome)+' produto(s)',
   '<div class="row-actions">'+
     button('Editar','edit-category',c.id,'small')+
     button('Excluir','delete-category',c.id,'small danger')+'</div>'
  ));
  content.innerHTML=intro('Cadastro de categorias','Organize os materiais e selecione suas categorias no cadastro de produtos.',categories.length+' categoria(s)')+
   '<section class="panel ua-categories-view">'+
   '<div class="toolbar"><p class="muted small">Categorias utilizadas por produtos antigos também aparecem aqui.</p>'+
   '<div class="actions">'+button('+ Nova categoria','new-category','','primary')+
   button('Ver produtos','goto-products','','small')+'</div></div>'+
   table(['Categoria / Descrição','Produtos vinculados','Ações'],rows,'Nenhuma categoria cadastrada.')+
   '<p class="footer-note">A exclusão é bloqueada quando a categoria está em uso. Renomear uma categoria atualiza os produtos vinculados e preserva o estoque.</p></section>';
 }
 const entry=['categorias','▤','Cadastro de categorias'];
 if(!sections.some(row=>row[0]==='categorias'))sections.push(entry);
 window.universaArtCategorias={list,options,ensureOption,quantity,edit,remove,view,normalize,defaults};
})();