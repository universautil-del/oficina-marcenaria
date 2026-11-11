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
  const status={remote:null,error:'',testedAt:'',backupChecked:false,message:''};
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
      {title:'Backup estruturado testado',ok:status.backupChecked,description:status.backupChecked?'O arquivo de teste foi validado em memória, sem substituir registros.':'Teste a estrutura do backup e baixe uma cópia.'}
    ];
    const finished=steps.filter(x=>x.ok).length;
    const metric=(label,n)=>'<div><small>'+escape(label)+'</small><strong>'+escape(n)+'</strong></div>';
    const currentState=cloud.paused?'Sincronização interrompida':cloud.active?'Nuvem ativada':cloud.session?'Conta conectada, sem sincronização':'Modo local / sem login';
    content.innerHTML=
      '<div class="ua-welcome"><div><div class="ua-eyebrow">UNIVERSA ART · PREPARAR LANÇAMENTO</div><h2>Segurança e confiabilidade</h2>'+
      '<p>Confira seus registros, a conexão com a nuvem e os backups antes de começar a usar o sistema na oficina.</p></div></div>'+
      '<section class="ua-section ua-launch"><div class="ua-launch-header"><div><h3>Diagnóstico do sistema</h3><p class="muted">Verificação local somente leitura. Não altera pedidos, estoque ou finanças.</p></div>'+
      '<div class="ua-launch-score">'+finished+' de '+steps.length+' verificações locais</div></div>'+
      '<div class="ua-launch-stats">'+metric('Clientes',audit.metrics.clients??'—')+metric('Fornecedores',audit.metrics.suppliers??'—')+
       metric('Produtos',audit.metrics.products??'—')+metric('Pedidos',audit.metrics.orders??'—')+
       metric('Financeiro',audit.metrics.transactions??'—')+metric('Estado da nuvem',currentState)+'</div>'+
      '<div class="ua-launch-checklist">'+steps.map(step=>'<div class="ua-launch-check '+(step.ok?'ok':'pending')+'"><span aria-hidden="true">'+(step.ok?'✓':'!')+'</span>'+
       '<div><strong>'+escape(step.title)+'</strong><p>'+escape(step.description)+'</p></div></div>').join('')+'</div>'+
      '<div class="ua-launch-actions">'+
       '<button class="btn primary" type="button" data-launch-action="run">Atualizar diagnóstico</button>'+
       '<button class="btn" type="button" data-launch-action="check-cloud">Verificar conexão Supabase</button>'+
       '<button class="btn" type="button" data-launch-action="check-backup">Validar estrutura do backup</button>'+
       '<button class="btn" type="button" data-launch-action="export-backup">Exportar backup JSON</button>'+
       '</div>'+
      '<p class="muted small" id="uaLaunchStatus" role="status" aria-live="polite">'+escape(status.message||status.error||'Nenhum teste externo foi executado nesta sessão.')+'</p>'+
      (audit.messages.length?'<div class="ua-launch-findings"><h4>Itens para revisar</h4><ul>'+audit.messages.map(m=>'<li><strong>'+escape(m.severity==='erro'?'Erro':'Atenção')+':</strong> '+escape(m.message)+'</li>').join('')+'</ul></div>':
       '<p class="muted small">A checagem local não encontrou erros conhecidos, mas não verifica a autenticidade de todos os documentos nem substitui auditoria de banco.</p>')+
      '</section>'+
      '<section class="ua-section gap-top ua-launch"><h3>O que ainda impede sair da versão de testes</h3>'+
      '<div class="ua-launch-remaining"><div><strong>1. Testar duas contas separadas</strong><p>Confirmar no Supabase que uma conta não consegue ler ou escrever dados da outra (RLS). Verificar permissões reais.</p></div>'+
      '<div><strong>2. Testar restauração completa</strong><p>Exportar um backup, restaurar em ambiente descartável e conferir cadastros, pedidos e valores. A verificação JSON acima não substitui este teste.</p></div>'+
      '<div><strong>3. Garantir transações de estoque e financeiro</strong><p>O sistema ainda usa um documento JSON por usuário; alterações simultâneas e operações críticas precisam de validação e proteção no servidor.</p></div>'+
      '<div><strong>4. Proteger anexos e dados pessoais</strong><p>Validar storage privado, política de acesso e isolamento do ambiente de produção antes de cadastrar informações reais.</p></div></div>'+
      '<p class="muted small"><strong>Este diagnóstico não libera automaticamente o uso comercial.</strong> A prévia continua em modo de testes até concluirmos a validação externa.</p>'+
      '<p><a href="https://github.com/universautil-del/oficina-marcenaria/blob/main/docs/FINALIZACAO-UNIVERSA ART-V1.md" target="_blank" rel="noopener noreferrer">Abrir roteiro completo de conclusão</a></p></section>';
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
      status.backupChecked=true;status.message='Estrutura JSON validada em memória. Faça também o download e teste a restauração em ambiente descartável.';
    }catch(err){status.backupChecked=false;status.message='Falha no teste do backup: '+String(err?.message||err).slice(0,200)}
    renderHealth();
  }
  const handle=async e=>{
    const btn=e.target.closest('[data-launch-action]');if(!btn)return;
    const action=btn.dataset.launchAction;
    btn.disabled=true;
    try{
      if(action==='run'){status.message='Diagnóstico local atualizado.';renderHealth()}
      else if(action==='check-cloud')await runCloud();
      else if(action==='check-backup')checkBackup();
      else if(action==='export-backup'){backup();status.message='Download do backup solicitado. Verifique o arquivo na pasta de downloads.';renderHealth()}
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
  };
  window.universalartesLaunch={inspect,renderHealth,checkBackup};
  render(location.hash.slice(1)||'dashboard');
})();