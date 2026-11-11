'use strict';
/* UNIVERSA ART 1.0 — central de verificação para lançamento.
   Apenas leitura dos dados. Não ativa produção, não altera registros comerciais,
   não afirma RLS ou backup de servidor sem testes reais. */
(function(){
  const oldRender=render;
  const oldSave=save;
  if(!sections.some(s=>s[0]==='seguranca')){
    const idx=sections.findIndex(x=>x[0]==='empresa');
    sections.splice(idx<0?sections.length:idx,0,['seguranca','✓','Segurança e lançamento']);
  }
  const status={remote:null,error:'',testedAt:'',backupChecked:false,message:'',backupRemote:null,backupRemoteError:'',backupRemoteLoading:false,backupRemoteAttempted:false};
  const isSecure=!!window.UNIVERSA_REQUIRE_AUTH;
  function inspect(data){
    const messages=[],metrics={};
    const required=['clients','products','quotes','orders','transactions','stockMovements'];
    for(const k of required){
      if(!Array.isArray(data?.[k]))messages.push({severity:'erro',message:'Estrutura de '+k+' não é uma lista válida.'});
    }
    if(messages.some(x=>x.severity==='erro'))return {messages,metrics,errors:messages.length,warnings:0,passed:false};
    const collections=['clients','suppliers','products','quotes','orders','transactions','stockMovements','purchases','projects'];
    for(const key of collections){
      const items=data[key]||[];
      if(!Array.isArray(items)){messages.push({severity:'erro',message:'Coleção '+key+' inválida.'});continue}
      metrics[key]=items.length;
      const seen=new Set();
      for(const row of items){
        if(!row||typeof row!=='object'||typeof row.id!=='string'||!row.id.trim()){
          messages.push({severity:'erro',message:'Registro sem identificador válido na coleção '+key+'.'});break;
        }
        if(seen.has(row.id)){messages.push({severity:'erro',message:'Identificadores duplicados em '+key+'.'});break}
        seen.add(row.id);
      }
    }
    const products=Array.isArray(data.products)?data.products:[];
    const productIds=new Set(products.map(p=>p.id));
    for(const p of products){
      if(p.tipo==='materia'&&(!Number.isFinite(Number(p.estoque))||Number(p.estoque)<0)){
        messages.push({severity:'erro',message:'Há material com estoque negativo ou inválido.'});break;
      }
      if(p.tipo==='acabado'&&(p.components||[]).some(x=>!productIds.has(x.materialId)||!(Number(x.quantidade)>0))){
        messages.push({severity:'aviso',message:'Há produto acabado com composição ou quantidade a conferir.'});break;
      }
    }
    const transactions=Array.isArray(data.transactions)?data.transactions:[];
    for(const t of transactions){
      const amount=Number(t.valor);
      const payments=Array.isArray(t.payments)?t.payments:[];
      const paid=payments.reduce((s,p)=>s+Number(p.valor),0);
      if(!Number.isFinite(amount)||amount<0||!Number.isFinite(paid)||payments.some(p=>!(Number(p.valor)>0))||paid>amount+.02){
        messages.push({severity:'erro',message:'Há lançamento financeiro com valores ou pagamentos inconsistentes.'});break;
      }
    }
    const clients=new Set((data.clients||[]).map(c=>c.id));
    if((data.orders||[]).some(o=>o.clientId&&!clients.has(o.clientId))){
      messages.push({severity:'aviso',message:'Há pedido com cliente não encontrado. Confira o histórico antes de faturar.'});
    }
    if((data.quotes||[]).some(o=>o.clientId&&!clients.has(o.clientId))){
      messages.push({severity:'aviso',message:'Há orçamento com cliente não encontrado.'});
    }
    const supplierIds=new Set((data.suppliers||[]).map(s=>s.id));
    if((data.purchases||[]).some(o=>o.supplierId&&!supplierIds.has(o.supplierId))){
      messages.push({severity:'aviso',message:'Há compra com fornecedor não encontrado.'});
    }
    // Auditoria cruzada de integrações. Avisos não alteram dados existentes.
    for(const type of ['quotes','orders']){
      const used=new Set();
      for(const row of data[type]||[]){
        if(row.number===undefined||row.number===null)continue;
        const number=String(row.number);
        if(used.has(number)){
          messages.push({severity:'erro',message:'Há números duplicados em '+(type==='orders'?'Pedidos.':'Orçamentos.')});break;
        }
        used.add(number);
      }
    }
    const projectIds=new Set((data.projects||[]).map(p=>p.id));
    if([...(data.quotes||[]),...(data.orders||[])].some(row=>row.projectId&&!projectIds.has(row.projectId)))
      messages.push({severity:'aviso',message:'Há pedido ou orçamento vinculado a projeto não encontrado.'});
    const usedCodes=new Set();
    for(const p of products){
      const c=String(p.codigo||'').trim();
      if(!/^\d{1,4}$/.test(c))continue;
      const n=Number(c);if(n<1||n>9999)continue;
      if(usedCodes.has(n)){messages.push({severity:'erro',message:'Códigos numéricos duplicados no cadastro de materiais.'});break}
      usedCodes.add(n);
    }
    for(const order of data.orders||[]){
      if(order.status==='cancelado'||!Array.isArray(order.items)||!order.items.length)continue;
      const expected=Math.round((order.items.reduce((sum,i)=>sum+Number(i.preco)*Number(i.quantidade),0)-
        Number(order.desconto||0)+Number(order.frete||0))*100)/100;
      if(!Number.isFinite(expected)||expected<0)continue;
      const accounts=transactions.filter(t=>t.orderId===order.id&&t.kind==='receber');
      if(!accounts.length){
        messages.push({severity:'aviso',message:'Pedido #'+order.number+' sem receita vinculada. Confira o Financeiro.'});
        continue;
      }
      const planned=Math.round(accounts.reduce((n,t)=>n+Number(t.valor||0),0)*100)/100;
      if(Math.abs(expected-planned)>.02){
        messages.push({severity:'aviso',message:'Pedido #'+order.number+' com valores de parcelas divergentes do total.'});
      }
    }
    let bytes=0;
    try{bytes=new Blob([JSON.stringify(data)]).size}
    catch{messages.push({severity:'erro',message:'Não foi possível serializar os dados atuais.'})}
    metrics.bytes=bytes;
    if(bytes>=2_000_000)messages.push({severity:'aviso',message:'Dados acima de 2 MB: limite atual de sincronização com a nuvem.'});
    const errors=messages.filter(x=>x.severity==='erro').length;
    const warnings=messages.filter(x=>x.severity==='aviso').length;
    return {messages,metrics,errors,warnings,passed:errors===0};
  }
  const escape=v=>esc(String(v??''));
  function renderHealth(){
    const audit=inspect(db);
    const cloud=window.oficinaCloud||{};
    const connection=cloud.session&&cloud.active&&!cloud.paused;
    const steps=[
      {title:'Estrutura e consistência dos registros',ok:audit.passed,description:audit.passed?'Nenhuma inconsistência crítica detectada na checagem local.':'Corrija os erros antes de usar cadastros reais.'},
      {title:'Conta autenticada e nuvem ativa',ok:!!connection,description:connection?'A nuvem está ativada. Execute também o teste da conexão.':'Necessário entrar no Supabase e ativar a sincronização.'},
      {title:'Leitura autenticada do banco',ok:status.remote?.auth&&status.remote?.table,description:status.remote?.auth?'Leitura da tabela com sua conta verificada nesta sessão.':'Clique em Verificar conexão após entrar na nuvem.'},
      {title:'Cópia semanal no Supabase',ok:!!status.backupRemote?.count,description:status.backupRemoteLoading?
       'Consultando as cópias disponíveis na sua conta Supabase…':
       status.backupRemote?.count?
         status.backupRemote.count+' cópia(s) encontrada(s). Última: '+(status.backupRemote.last||'data não informada')+
         '. Agendamento '+(status.backupRemote.active?'ativo':'não confirmado')+'. Cópia no mesmo projeto não substitui backup externo.':
       status.backupRemoteError?
         'Não foi possível consultar o backup do servidor: '+status.backupRemoteError+'. Confira em Backup e recuperação.':
         'Ainda não consultado nesta sessão. Abra esta tela com a nuvem ativa ou clique em Consultar backups no Supabase.'}
    ];
    const finished=steps.filter(x=>x.ok).length;
    const metric=(label,n)=>'<div><small>'+escape(label)+'</small><strong>'+escape(n)+'</strong></div>';
    const currentState=cloud.paused?'Sincronização interrompida':cloud.active?(String(cloud.status||'').startsWith('Sincronizado')?cloud.status:'Nuvem ativada — confira a sincronização'):cloud.session?'Conta conectada, sem sincronização':'Modo local / sem login';
    content.innerHTML=
      '<div class="ua-welcome"><div><div class="ua-eyebrow">UNIVERSA ART · '+(isSecure?'OFICINA 1.0':'AMBIENTE DE TESTES')+'</div><h2>Segurança e confiabilidade</h2>'+
      '<p>Confira seus registros, a conexão com a nuvem e os backups antes de começar a usar o sistema na oficina.</p></div></div>'+
      '<section class="ua-section ua-launch"><div class="ua-launch-header"><div><h3>Diagnóstico do sistema</h3><p class="muted">Verificação local somente leitura. Não altera pedidos, estoque ou finanças.</p></div>'+
      '<div class="ua-launch-score">'+finished+' de '+steps.length+' etapas conferidas</div></div>'+
      '<div class="ua-launch-stats">'+metric('Clientes',audit.metrics.clients??'—')+metric('Fornecedores',audit.metrics.suppliers??'—')+
       metric('Produtos',audit.metrics.products??'—')+metric('Pedidos',audit.metrics.orders??'—')+
       metric('Financeiro',audit.metrics.transactions??'—')+metric('Estado da nuvem',currentState)+'</div>'+
      '<div class="ua-launch-checklist">'+steps.map(step=>'<div class="ua-launch-check '+(step.ok?'ok':'pending')+'"><span aria-hidden="true">'+(step.ok?'✓':'!')+'</span>'+
       '<div><strong>'+escape(step.title)+'</strong><p>'+escape(step.description)+'</p></div></div>').join('')+'</div>'+
      '<div class="ua-launch-actions">'+
       '<button class="btn primary" type="button" data-launch-action="run">Atualizar diagnóstico</button>'+
       '<button class="btn" type="button" data-launch-action="check-cloud">Verificar conexão Supabase</button>'+
       '<button class="btn" type="button" data-launch-action="check-weekly-backups">Consultar backups no Supabase</button>'+
       '<button class="btn" type="button" data-launch-action="check-backup">Verificar estrutura local (opcional)</button>'+
       '<button class="btn" type="button" data-launch-action="open-encrypted-backup">Fazer backup criptografado</button>'+
       '</div>'+
      '<p class="muted small" id="uaLaunchStatus" role="status" aria-live="polite">'+escape(status.message||status.error||'O diagnóstico local não substitui a confirmação da cópia no Supabase ou um teste de restauração.')+'</p>'+
      (audit.messages.length?'<div class="ua-launch-findings"><h4>Itens para revisar</h4><ul>'+audit.messages.map(m=>'<li><strong>'+escape(m.severity==='erro'?'Erro':'Atenção')+':</strong> '+escape(m.message)+'</li>').join('')+'</ul></div>':
       '<p class="muted small">Sem erros conhecidos no diagnóstico local. Os indicadores acima não comprovam, sozinhos, recuperação de backup, isolamento entre contas ou sincronização no celular.</p>')+
      '</section>'+
      (isSecure?
      '<section class="ua-section gap-top ua-launch"><h3>Conferências complementares</h3>'+
      '<div class="ua-launch-remaining"><div><strong>Conexão com o Supabase</strong><p>A leitura autenticada pode ser repetida quando necessário. O resultado não comprova sozinho isolamento de usuários.</p></div>'+
      '<div><strong>Sincronização entre aparelhos</strong><p>Se já testou no computador e celular, não precisa repetir a cada visita. Repita após mudanças relevantes no sistema.</p></div>'+
      '<div><strong>Cópias e recuperação</strong><p>O quadro acima consulta cópias semanais reais do Supabase. Não confirma que um arquivo foi restaurado: mantenha também um backup criptografado externo, caso já tenha conferido a recuperação.</p></div>'+
      '<div><strong>Segurança e estoque</strong><p>Após mudanças grandes, confira permissões RLS em ambiente isolado e o fluxo orçamento → pedido → estoque → financeiro, sem lançamento duplicado.</p></div></div>'+
      '<p class="muted small">A existência de uma cópia confirma apenas seu registro no Supabase, não sua capacidade de restauração. Confira a situação real dos backups no painel de recuperação.</p>'+
      '<p class="muted small">Se ainda não atualizou o Supabase para códigos 01–9999, execute a <a href="https://github.com/universautil-del/oficina-marcenaria/blob/main/supabase/migrate-material-codes-9999.sql" target="_blank" rel="noopener noreferrer">migração SQL preparada</a> após guardar backup. Não execute novamente o SQL inicial.</p></section>':
      '<section class="ua-section gap-top ua-launch"><h3>Prévia de testes 1.2</h3><p>Esta página permite dados locais de teste e não deve ser usada com informações reais. Para trabalhar com uma conta Supabase, abra o ambiente autenticado.</p><p><a class="btn primary" href="../oficina.html">Abrir OFICINA 1.0 com login</a></p></section>');
  }
  async function runCloud(){
    status.remote=null;status.error='';status.message='Consultando login e tabela no Supabase…';renderHealth();
    const cloud=window.oficinaCloud;
    if(!cloud?.inspectConnection){status.message='O módulo Supabase ainda não terminou de carregar.';renderHealth();return}
    try{
      const result=await cloud.inspectConnection();
      status.remote=result;
      status.testedAt=new Date().toLocaleString('pt-BR');
      status.message='Conta autenticada e acesso à tabela verificados às '+status.testedAt+
        (result.synchronized?'. Cópia local sincronizada.':'. Confirme se há mudanças locais não sincronizadas.');
    }catch(err){status.error='Erro na verificação: '+String(err?.message||err).slice(0,200);status.message=status.error}
    renderHealth();
  }
  function checkBackup(){
    try{
      const snap=JSON.parse(JSON.stringify({app:'oficina',version:3,exportedAt:new Date().toISOString(),data:db}));
      const test=validateBackup(snap);
      if(test.kind!==3||test.data.clients.length!==db.clients.length||test.data.orders.length!==db.orders.length)throw Error('Dados divergentes ao validar o backup.');
      status.backupChecked=true;status.message='Estrutura conferida em memória (não é um backup salvo). A consulta das cópias automáticas está separada e pode ser feita pelo botão Consultar backups no Supabase.';
    }catch(err){status.backupChecked=false;status.message='Falha no teste do backup: '+String(err?.message||err).slice(0,200)}
    renderHealth();
  }
  async function refreshBackupStatus(){
    if(status.backupRemoteLoading)return;
    const cloud=window.oficinaCloud;
    if(!cloud?.active||cloud.paused||!cloud.session){
      status.backupRemote=null;
      status.backupRemoteError='Faça login e aguarde a sincronização';
      status.backupRemoteAttempted=false;
      renderHealth();
      return;
    }
    if(typeof cloud.weeklyBackupStatus!=='function'||typeof cloud.listWeeklyBackups!=='function'){
      status.backupRemote=null;
      status.backupRemoteError='Consulta não disponível nesta versão';
      status.backupRemoteAttempted=true;
      renderHealth();
      return;
    }
    status.backupRemoteLoading=true;status.backupRemoteError='';status.backupRemoteAttempted=true;
    renderHealth();
    try{
      const schedule=await cloud.weeklyBackupStatus();
      const backups=await cloud.listWeeklyBackups();
      if(!Array.isArray(backups))throw Error('Lista de cópias inválida');
      const count=backups.length;
      const newest=backups[0]?.criado_em;
      const rawDate=newest?new Date(newest):null;
      const last=rawDate&&Number.isFinite(rawDate.getTime())?rawDate.toLocaleString('pt-BR'):'';
      status.backupRemote={count,last,active:schedule?.agendamento_ativo===true};
      status.message=count?'Consulta concluída: '+count+' cópia(s) semanais no Supabase.':'Consulta concluída: não há cópias semanais acessíveis.';
    }catch(error){
      status.backupRemote=null;
      status.backupRemoteError=String(error?.message||error).slice(0,150);
      status.message='Não foi possível confirmar as cópias no Supabase. Consulte Backup e recuperação.';
    }finally{status.backupRemoteLoading=false;renderHealth()}
  }
  const handle=async e=>{
    const btn=e.target.closest('[data-launch-action]');if(!btn)return;
    const action=btn.dataset.launchAction;
    btn.disabled=true;
    try{
      if(action==='run'){status.message='Diagnóstico local atualizado.';renderHealth()}
      else if(action==='check-cloud')await runCloud();
      else if(action==='check-backup')checkBackup();
      else if(action==='check-weekly-backups')await refreshBackupStatus();
      else if(action==='open-encrypted-backup'){location.hash='backupdrive';render('backupdrive')}
    }finally{btn.disabled=false}
  };
  document.addEventListener('click',handle);
  // Uma edição invalida a checagem do backup anterior: é preciso validar novamente.
  save=function(...args){status.backupChecked=false;return oldSave(...args)};
  render=function launchRender(section=location.hash.slice(1)||'dashboard'){
    if(section!=='seguranca')return oldRender(section);
    title.textContent='Segurança e lançamento';
    nav.innerHTML=sections.map(([key,icon,label])=>'<button class="nav-btn '+(key===section?'active':'')+'" data-section="'+escape(key)+'"><span aria-hidden="true">'+escape(icon)+'</span>'+escape(label)+'</button>').join('');
    nav.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{
      const next=b.dataset.section;location.hash=next;sidebar.classList.remove('open');
      if(location.hash.slice(1)===section)render(next);
    }));
    renderHealth();
    // Consulta real, não a simulação local. Uma vez por visita à tela,
    // podendo ser repetida pelo botão sempre que desejar.
    if(!status.backupRemoteAttempted&&window.oficinaCloud?.active)void refreshBackupStatus();
  };
  window.universalartesLaunch={inspect,renderHealth,checkBackup,refreshBackupStatus};
  render(location.hash.slice(1)||'dashboard');
})();