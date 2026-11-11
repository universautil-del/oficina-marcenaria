'use strict';
/* UNIVERSA ART — Integração OpenCutList → Projetos de móveis.
 * Snapshot do CSV/XLSX fica no próprio registro do projeto (backup existente).
 * Importação nunca cria pedidos, movimentações de estoque ou receitas.
 * Não é plano de corte definitivo: exige revisão e aprovação das medidas.
 */
(function(){
 const MAX_PARTS=1200;
 const MAX_BYTES=450000;
 const api=()=>window.universalartesSketchUp;
 let chosenProjectId='';
 const safe=x=>esc(String(x??''));
 const parseName=x=>String(x??'').trim().slice(0,140);
 const mm=x=>Number(x);
 const cleanText=(x,len=160)=>String(x??'').trim().slice(0,len);
 const getProject=pid=>(db.projects||[]).find(p=>p.id===pid);
 const totalParts=parts=>parts.reduce((n,p)=>n+p.qty,0);
 const totalArea=parts=>Math.round(parts.reduce((n,p)=>n+p.length*p.width*p.qty/1000000,0)*100000)/100000;
 const round3=n=>Math.round(n*100000)/100000;
 function normalizeParts(parts){
  if(!Array.isArray(parts)||parts.length===0)throw Error('Importe uma lista de peças antes de vinculá-la a um projeto.');
  if(parts.length>MAX_PARTS)throw Error('A lista contém mais de 1.200 tipos de peça. Divida a obra em ambientes antes de salvar.');
  return parts.map((p,i)=>{
   const length=mm(p.length),width=mm(p.width),thickness=mm(p.thickness||0),qty=mm(p.qty),edge=mm(p.edge||0);
   if(!Number.isFinite(length)||!Number.isFinite(width)||length<=0||width<=0||length>10000000||width>10000000)
    throw Error('Confira comprimento e largura da peça '+(i+1)+' (mm).');
   if(!Number.isInteger(qty)||qty<=0||qty>100000)throw Error('Quantidade inválida na peça '+(i+1)+'.');
   if(!Number.isFinite(thickness)||thickness<0||thickness>100000)
    throw Error('Espessura inválida na peça '+(i+1)+'.');
   if(!Number.isFinite(edge)||edge<0||edge>1000)
    throw Error('Fita de borda inválida na peça '+(i+1)+'.');
   return {code:cleanText(p.code,70),name:cleanText(p.name)||'Peça '+(i+1),
    length,width,thickness,qty,material:cleanText(p.material,120)||'Material não definido',edge};
  });
 }
 function summarize(parts){
  const byMaterial=new Map();
  const issues=[];
  for(const p of parts){
   const key=p.material+'|'+p.thickness;
   const m=byMaterial.get(key)||{material:p.material,thickness:p.thickness,quantidade:0,areaM2:0};
   m.quantidade+=p.qty;
   m.areaM2+=p.length*p.width*p.qty/1000000;
   byMaterial.set(key,m);
   if(p.material==='Material não definido'&&!issues.includes('Há peças sem MDF atribuído.'))issues.push('Há peças sem MDF atribuído.');
   if(p.thickness===0&&!issues.includes('Há peças sem espessura definida.'))issues.push('Há peças sem espessura definida.');
  }
  return {
   tipos:parts.length,pecas:totalParts(parts),areaM2:totalArea(parts),
   porMaterial:[...byMaterial.values()].map(m=>({...m,areaM2:round3(m.areaM2)})),
   issues
  };
 }
 function cutlistFromImporter(){
  const tool=api(),state=tool?.state;
  if(!state?.file)throw Error('Selecione um arquivo OpenCutList CSV/XLSX primeiro.');
  // Sempre recalcular a partir do mapeamento visível; não confiar em um cache desatualizado.
  const parts=normalizeParts(tool.makeParts());
  const summary=summarize(parts);
  const snapshot={
   origin:'SketchUp/OpenCutList',filename:cleanText(state.file.replace(/^.*[/\\]/,''),150),
   importedAt:new Date().toISOString(),parts,summary,
   reviewStatus:'pendente',sourceUnits:'mm'
  };
  const bytes=new TextEncoder().encode(JSON.stringify(snapshot)).length;
  if(bytes>MAX_BYTES)throw Error('Esta lista ocupa mais de 450 KB. Separe o projeto em ambientes antes de salvar.');
  return snapshot;
 }
 function sameParts(a,b){
  if(!a||!b)return false;
  // Duplicação avaliada pelas peças, e não pela data da importação.
  return JSON.stringify(a.parts)===JSON.stringify(b.parts);
 }
 function saveLinked(projectId,snapshot){
  if(!snapshot||!Array.isArray(snapshot.parts))throw Error('Nenhuma lista válida para vincular.');
  const project=getProject(projectId);
  if(!project)throw Error('Escolha um Projeto de móveis válido.');
  if(sameParts(project.cutlist,snapshot))throw Error('Esta lista de peças já está vinculada ao projeto. Nenhuma duplicação foi criada.');
  if(project.cutlist&&!confirm('O projeto já tem uma lista SketchUp. Substituir a versão atual e guardar a versão anterior no histórico?'))return false;
  const prevProjects=db.projects;
  const previous=project.cutlist?[project.cutlist,...(project.cutlistHistory||[])].slice(0,2):(project.cutlistHistory||[]);
  const next={...project,cutlist:snapshot,cutlistHistory:previous};
  db.projects=prevProjects.map(p=>p.id===projectId?next:p);
  if(save()===false){db.projects=prevProjects;throw Error('Falha ao salvar. Nenhuma lista anterior foi descartada; confira o armazenamento.')}
  chosenProjectId=projectId;
  return true;
 }
 function newProjectFromCutlist(name,clientId,snapshot){
  const trimmed=parseName(name);
  if(trimmed.length<3)throw Error('Dê ao novo projeto um nome com pelo menos 3 caracteres.');
  const client=clientId?(db.clients||[]).find(c=>c.id===clientId):null;
  if(clientId&&!client)throw Error('O cliente selecionado não foi encontrado.');
  if(!db.seq||!Number.isSafeInteger(db.seq.project)||db.seq.project<1)throw Error('Numeração de projetos não disponível. Reabra a área Projetos de móveis.');
  const before=db.projects,oldSeq=db.seq.project;
  const project={
   id:id(),number:oldSeq,nome:trimmed,clientId:client?.id||'',clientNome:client?.nome||'',
   ambiente:'',largura:0,altura:0,profundidade:0,material:'',
   acabamento:'',status:'desenho',prazo:'',observacoes:'Lista OpenCutList anexada. Conferir medidas externas do móvel, materiais, corte e ferragens antes de fabricar.',
   optionA:'',optionB:'',priceA:0,priceB:0,
   checklist:[
    {label:'Briefing e medidas da obra',done:false},
    {label:'Revisar lista SketchUp e materiais',done:false},
    {label:'Aprovar projeto e valores',done:false},
    {label:'Plano de corte e produção',done:false},
    {label:'Montagem e instalação',done:false}
   ],
   cutlist:snapshot,cutlistHistory:[]
  };
  db.projects=[...before,project];
  db.seq.project=oldSeq+1;
  if(save()===false){
   db.projects=before;db.seq.project=oldSeq;
   throw Error('Falha ao salvar o novo projeto. Nenhum número foi consumido.');
  }
  chosenProjectId=project.id;
  return project;
 }
 function projectCutlistStats(project){
  const s=project.cutlist?.summary;
  if(!s)return '<span class="ua-cut-pending">Sem lista SketchUp vinculada</span>';
  return '<div class="ua-cut-stats"><span>'+safe(s.pecas)+' peças</span><span>'+safe(s.tipos)+' tipos</span><span>'+safe(Number(s.areaM2).toLocaleString('pt-BR',{minimumFractionDigits:3,maximumFractionDigits:5}))+' m²</span><span>Revisão pendente</span></div>';
 }
 function panel(){
  const host=content.querySelector('#uaProjectBridgePanel');
  host?.remove();
  const tool=api(),state=tool?.state;
  if(!state)return;
  const projects=db.projects||[];
  if(chosenProjectId&&!getProject(chosenProjectId))chosenProjectId='';
  const p=getProject(chosenProjectId);
  const existing=projects.map(x=>
   '<option value="'+safe(x.id)+'" '+(chosenProjectId===x.id?'selected':'')+'>'+
   safe(x.nome)+' — '+safe(x.clientNome||'sem cliente')+'</option>').join('');
  const clients=(db.clients||[]).map(c=>'<option value="'+safe(c.id)+'">'+safe(c.nome)+'</option>').join('');
  const total=state.parts?.reduce((n,x)=>n+Number(x.qty||0),0)||0;
  const copy='<section id="uaProjectBridgePanel" class="ua-section gap-top ua-project-bridge">'+
    '<h3>6. Integrar com Projetos de móveis</h3>'+
    '<p class="muted">Salve as peças importadas dentro de um projeto. A lista ficará no cadastro e no backup do sistema. Não gera estoque, pedido ou cobrança automaticamente.</p>'+
    '<div class="ua-cut-metrics"><span>'+safe(state.file||'Nenhum arquivo carregado')+'</span><span>'+safe(state.parts?.length||0)+' tipos</span><span>'+safe(total)+' peças</span></div>'+
    '<div class="ua-cut-columns"><div class="ua-cut-choice"><h4>Projeto existente</h4>'+
    '<label>Selecionar projeto<select id="uaCutProjectSelect"><option value="">Escolha um projeto</option>'+existing+'</select></label>'+
    '<button type="button" class="btn primary" data-ua-cut-action="attach" '+(!state.parts?.length||!projects.length?'disabled':'')+'>Salvar lista no projeto</button>'+
    (p?.cutlist?'<p class="ua-cut-note">Este projeto já possui lista. A substituição será confirmada e manterá histórico.</p>':'')+
    '</div><div class="ua-cut-choice"><h4>Criar projeto com esta lista</h4>'+
    '<label>Nome do novo projeto<input id="uaCutProjectName" maxlength="140" placeholder="Ex.: Cozinha da cliente / Armário do quarto"></label>'+
    '<label>Cliente (opcional)<select id="uaCutClientSelect"><option value="">Sem cliente</option>'+clients+'</select></label>'+
    '<button type="button" class="btn" data-ua-cut-action="create" '+(!state.parts?.length?'disabled':'')+'>Criar projeto e salvar peças</button>'+
    '</div></div><p class="ua-cut-warning">Cotas sempre em milímetros (mm). Confira espessura, quantidade, sentido do veio e medidas da obra. A estimativa de chapas por área não é plano de corte.</p></section>';
  content.insertAdjacentHTML('beforeend',copy);
  if(chosenProjectId)content.querySelector('#uaCutProjectSelect').value=chosenProjectId;
 }
 function projectListModal(projectId){
  const p=getProject(projectId);
  if(!p)return alert('Projeto não localizado.');
  const c=p.cutlist;
  if(!c)return alert('Este projeto ainda não tem lista SketchUp. Clique em Importar lista.');
  const parts=normalizeParts(c.parts);
  const summary=summarize(parts);
  const totals=summary.porMaterial.map(m=>td(safe(m.material),safe(m.thickness)+' mm',safe(m.quantidade),dec(m.areaM2)+' m²'));
  const rows=parts.slice(0,100).map(part=>td(safe(part.code||'—'),safe(part.name),dec(part.length)+' × '+dec(part.width)+' × '+dec(part.thickness)+' mm',String(part.qty),safe(part.material)));
  const body='<div class="ua-cut-overview"><strong>'+safe(p.nome)+'</strong><p>'+safe(c.filename)+' · '+safe(c.importedAt?.slice(0,10)||'')+
   '</p>'+projectCutlistStats(p)+'</div>'+
   (summary.issues.length?'<div class="ua-cut-warning">'+summary.issues.map(safe).join(' ')+'</div>':'')+
   '<h4>Materiais e áreas (sem otimização de corte)</h4>'+
   table(['Material','Espessura','Peças','Área'],totals,'Sem materiais')+
   '<h4>Lista de peças</h4>'+
   table(['Código','Peça','Dimensões (mm)','Qtde.','Material'],rows,'Nenhuma peça')+
   '<p class="muted">Exibindo até 100 tipos. O CSV exporta toda a lista. Não há baixa automática de materiais.</p>'+
   '<div class="actions gap-top">'+button('Exportar peças CSV','ua-cutlist-export',p.id,'small')+
   button('Atualizar pelo SketchUp','ua-cutlist-open',p.id,'small')+'</div>';
  openModal('Peças SketchUp — '+p.nome,body,()=>true);
 }
 function exportCutlist(projectId){
  const project=getProject(projectId);
  if(!project?.cutlist)throw Error('Projeto sem lista para exportar.');
  const parts=normalizeParts(project.cutlist.parts);
  const filename=String(project.nome||'projeto').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
   .replace(/[^A-Za-z0-9_-]+/g,'-').slice(0,50)||'projeto';
  exportCsv('universa-art-'+filename+'-lista-pecas.csv',
   ['Codigo','Peca','Comprimento_mm','Largura_mm','Espessura_mm','Quantidade','Material','Fita_m_por_peca'],
   parts.map(p=>[p.code,p.name,p.length,p.width,p.thickness,p.qty,p.material,p.edge]));
 }
 function openForProject(pid){
  if(pid&&!getProject(pid))throw Error('Projeto não encontrado.');
  chosenProjectId=pid||'';
  location.hash='sketchup';
  render('sketchup');
 }
 document.addEventListener('click',e=>{
  const btn=e.target?.closest?.('[data-ua-cut-action],[data-action^="ua-cutlist-"],[data-action="ua-project-quote"]');
  if(!btn)return;
  try{
   const action=btn.dataset.uaCutAction||btn.dataset.action;
   if(action==='attach'){
    const selected=content.querySelector('#uaCutProjectSelect')?.value;
    if(!selected)throw Error('Selecione um projeto existente.');
    const snapshot=cutlistFromImporter();
    if(saveLinked(selected,snapshot)){alert('Lista vinculada ao projeto com sucesso. Acesse Projetos de móveis para conferir.');render('sketchup')}
   }else if(action==='create'){
    const name=content.querySelector('#uaCutProjectName')?.value;
    const clientId=content.querySelector('#uaCutClientSelect')?.value||'';
    const project=newProjectFromCutlist(name,clientId,cutlistFromImporter());
    alert('Projeto '+project.nome+' criado com a lista de peças. Revise as medidas externas.');
    location.hash='projetos';render('projetos');
   }else if(action==='ua-project-quote'){
    const p=getProject(btn.dataset.id);
    if(!p)throw Error('Projeto não encontrado.');
    if(!(db.clients||[]).length)throw Error('Cadastre um cliente antes de fazer um orçamento.');
    openSales('quote','',p.id);
   }else if(action==='ua-cutlist-open')openForProject(btn.dataset.id);
   else if(action==='ua-cutlist-view')projectListModal(btn.dataset.id);
   else if(action==='ua-cutlist-export'){exportCutlist(btn.dataset.id)}
  }catch(error){alert(error.message||'Falha ao vincular lista SketchUp.')}
 });
 window.universaArtProjectBridge={
  normalizeParts,summarize,cutlistFromImporter,saveLinked,newProjectFromCutlist,sameParts,
  projectCutlistStats,projectListModal,exportCutlist,openForProject,panel,
  get selectedProjectId(){return chosenProjectId},
  set selectedProjectId(value){chosenProjectId=value}
 };
})();
