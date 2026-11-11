'use strict';
/* OFICINA 1.0 — menu por jornada da marcenaria.
 * Só altera a navegação. Não toca em clientes, pedidos, estoque nem Supabase.
 */
(function(){
 const previousRender=render;
 const groups=[
  {title:'PAINEL',keys:['dashboard','clientes']},
  {title:'PROJETOS E PEDIDOS',keys:['projetos','assistente','sketchup','orcamentos','pedidos','producao']},
  {title:'MATERIAIS E COMPRAS',keys:['produtos','compras','fornecedores']},
  {title:'FINANCEIRO E DOCUMENTOS',keys:['financeiro','notas','documentos','anexos','relatorios']},
  {title:'SISTEMA E SEGURANÇA',keys:['empresa','backupdrive','seguranca']}
 ];
 const labelOverrides={
  clientes:'Clientes e fornecedores',projetos:'Projetos de móveis',assistente:'Assistente de projetos',sketchup:'Importar SketchUp',
  compras:'Entrada de Materiais',anexos:'Contratos anexados',backupdrive:'Backup e recuperação'
 };
 function availableGroups(){
  const found=new Set();
  const out=groups.map(group=>{
   const rows=group.keys.map(key=>sections.find(x=>x[0]===key)).filter(Boolean);
   rows.forEach(x=>found.add(x[0]));
   return {...group,rows};
  }).filter(g=>g.rows.length);
  const rest=sections.filter(x=>!found.has(x[0]));
  if(rest.length)out.push({title:'OUTRAS FERRAMENTAS',rows:rest});
  return out;
 }
 // Atualiza a lista compartilhada também para atalhos e funções legadas que
 // consultam sections[]; nenhum identificador/hash existente é alterado.
 function reorderSections(){
  const ordered=availableGroups().flatMap(g=>g.rows);
  sections.splice(0,sections.length,...ordered);
 }
 function setActiveSection(section){
  if(!nav)return;
  const wanted=sections.some(s=>s[0]===section)?section:'dashboard';
  const buttons=nav.querySelectorAll('button[data-section]');
  buttons.forEach(button=>{
   const active=button.dataset.section===wanted;
   button.classList.toggle('active',active);
   if(active)button.setAttribute('aria-current','page');
   else button.removeAttribute('aria-current');
  });
 }
 function makeSidebar(section){
  if(!nav)return;
  const groupsNow=availableGroups();
  const active=sections.some(s=>s[0]===section)?section:'dashboard';
  // Somente nomes e ícones internos, sempre escapados.
  nav.innerHTML=groupsNow.map(group=>
   '<div class="ua-menu-group">'+
    '<h2 class="ua-menu-heading">'+esc(group.title)+'</h2>'+
    group.rows.map(([key,icon,label])=>
     '<button type="button" class="nav-btn ua-menu-link '+(key===active?'active':'')+
     '" data-section="'+esc(key)+'"'+(key===active?' aria-current="page"':'')+
     ' title="'+esc(labelOverrides[key]||label)+'">'+
     '<span class="ua-menu-icon" aria-hidden="true">'+esc(icon)+'</span>'+
     '<span class="ua-menu-text">'+esc(labelOverrides[key]||label)+'</span></button>'
    ).join('')+'</div>'
  ).join('');
  nav.querySelectorAll('button[data-section]').forEach(button=>{
   button.addEventListener('click',()=>{
    const next=button.dataset.section;
    if(!sections.some(s=>s[0]===next))return;
    sidebar.classList.remove('open');
    if(location.hash.slice(1)===next){render(next);return}
    location.hash=next; // hashchange faz a renderização e mantém o histórico.
   });
  });
  setActiveSection(active);
 }
 reorderSections();
 render=function(section=location.hash.slice(1)||'dashboard'){
  const result=previousRender(section);
  makeSidebar(section);
  return result;
 };
 window.universaArtSidebar={groups:availableGroups,reorderSections,renderMenu:makeSidebar,setActiveSection};
 if(window.oficinaCloud?.active)makeSidebar(location.hash.slice(1)||'dashboard');
})();