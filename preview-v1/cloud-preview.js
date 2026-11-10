'use strict';
/* OFICINA v0.6 — login + sincronização opcional no Supabase (não armazena senhas). */
(function () {
 const CFG='universalartes-v1-cloud-config', SES='universalartes-v1-cloud-session';
 const CACHE='universalartes-v1-cloud-cache', META='universalartes-v1-cloud-meta';
 const state={cfg:null,session:null,remote:null,rev:null,active:false,paused:false,busy:false,
   lastSynced:'',status:'Local — somente neste navegador',timer:null,userId:null};
 const safeParse=(s)=>{try{return JSON.parse(s)}catch{return null}};
 state.cfg=safeParse(localStorage.getItem(CFG));
 state.session=safeParse(sessionStorage.getItem(SES));
 const msg=e=>e?.message||'Erro desconhecido';
 function valid(data){return data&&data.version===3&&['clients','products','orders','quotes','transactions','stockMovements'].every(k=>Array.isArray(data[k]))}
 function validURL(url){try{const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.search&&!u.hash&&/^[a-z0-9-]+\.supabase\.co$/.test(u.hostname)&&!u.pathname.replace(/\//g,'')}catch{return false}}
 function friendlyError(e){const m=String(msg(e));return m.slice(0,190)}
 function isPublicKey(key){
  if(/^sb_publishable_[A-Za-z0-9_-]+$/.test(key))return true;
  try{
   const parts=String(key).split('.');
   if(parts.length!==3)return false;
   const payload=JSON.parse(atob(parts[1].replace(/-/g,'+').replace(/_/g,'/')));
   return payload?.role==='anon';
  }catch{return false}
 }
 function apiKey(){return state.cfg?.key||''}
 async function request(path,{method='GET',body,auth=true,extra={}}={}){
  if(!state.cfg||!validURL(state.cfg.url))throw Error('Configure uma URL válida do projeto Supabase.');
  const headers={'apikey':apiKey(),'Content-Type':'application/json',...extra};
  if(auth){const token=await accessToken();headers.Authorization=`Bearer ${token}`}
  const res=await fetch(state.cfg.url+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});
  const content=await res.text();let data=null;try{data=content?JSON.parse(content):null}catch{data=content}
  if(!res.ok)throw Error(data?.msg||data?.error_description||data?.message||`HTTP ${res.status}`);
  return data;
 }
 async function accessToken(){
  if(!state.session)throw Error('É necessário entrar na sua conta.');
  if((state.session.exp||0)>Date.now()+75_000)return state.session.at;
  const s=await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:state.session.rt},auth:false});
  if(!s?.access_token)throw Error('Sessão expirada. Faça login novamente.');
  saveSession(s);return state.session.at;
 }
 function saveSession(s){
  if(!s?.access_token||!s?.user?.id)throw Error('Não foi possível identificar o usuário do Supabase.');
  state.session={at:s.access_token,rt:s.refresh_token,exp:Date.now()+(Number(s.expires_in)||3600)*1000,id:s.user.id,email:s.user.email||''};
  sessionStorage.setItem(SES,JSON.stringify(state.session));state.userId=s.user.id;
 }
 async function login(email,password,signup=false){
  if(!state.cfg)throw Error('Configure o projeto Supabase antes de entrar.');
  const path=signup?'/auth/v1/signup':'/auth/v1/token?grant_type=password';
  const response=await request(path,{method:'POST',body:{email,password},auth:false});
  if(!response?.access_token){if(signup){alert('Conta criada. Confirme seu e-mail, se solicitado pelo Supabase, e depois entre com sua senha.');return}
   throw Error('Login não autorizado. Confira seu e-mail e senha.')}
  saveSession(response);
  state.active=false;state.paused=false;state.remote=null;state.lastSynced='';state.rev=null;
  await fetchRemote();state.status='Conectado — escolha como iniciar a sincronização';
  render('empresa');
 }
 async function fetchRemote(){
  const rows=await request(`/rest/v1/universalartes_preview_backups?user_id=eq.${encodeURIComponent(state.userId)}&select=data,revision&limit=1`);
  state.remote=Array.isArray(rows)?rows[0]||null:null;
  if(state.remote&&!valid(state.remote.data))throw Error('Os dados na nuvem têm formato incompatível. Não foram carregados.');
  return state.remote;
 }
 function setDb(data){
  if(!valid(data))throw Error('Estrutura de dados incompatível.');
  db=JSON.parse(JSON.stringify(data));
 }
 function retainLocalCopy(){
  try{download(`universalartes-v1-backup-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(db,null,2));return true}
  catch(e){alert('Não foi possível fazer o backup: '+friendlyError(e));return false}
 }
 function saveLocalCloud(){sessionStorage.setItem(CACHE,JSON.stringify(db));sessionStorage.setItem(META,JSON.stringify({id:state.userId,rev:state.rev,lastSynced:state.lastSynced,active:true}))}
 function activate(data,rev){
  setDb(data);state.rev=rev;state.active=true;state.paused=false;state.lastSynced=JSON.stringify(data);
  state.status='Sincronizado';saveLocalCloud();
  // Após exportar o backup anterior, deixa o modo visitante sem dados privados.
  localStorage.setItem(DB_KEY,JSON.stringify(blank()));localStorage.removeItem(OLD_CLIENTS);
  render(location.hash.slice(1)||'dashboard');
 }
 async function selectRemote(){
  if(!state.session)throw Error('Entre na sua conta.');
  await fetchRemote();if(!state.remote){alert('A nuvem ainda está vazia. Use Enviar dados deste aparelho.');return}
  if(!confirm('Carregar os dados da nuvem neste navegador? Uma cópia dos dados locais será baixada antes da troca.'))return;
  if(!retainLocalCopy())return;
  activate(state.remote.data,state.remote.revision);
 }
 async function sendLocal(){
  if(!state.session)throw Error('Entre na sua conta.');
  const remote=await fetchRemote();
  if(remote)throw Error('Sua conta já tem dados na nuvem. Por segurança, esta ação NÃO sobrescreve registros existentes. Escolha "Usar dados da nuvem" e faça backup antes de qualquer restauração.');
  if(!confirm('A nuvem está vazia. Confirmar o primeiro envio dos dados deste aparelho?'))return;
  if(!retainLocalCopy())return;
  if(!valid(db))throw Error('Os dados locais são inválidos.');
  const snapshot=JSON.parse(JSON.stringify(db));
  const result=await request('/rest/v1/universalartes_preview_backups',{
   method:'POST',body:{user_id:state.userId,data:snapshot,revision:1},extra:{Prefer:'return=representation'}});

  if(!Array.isArray(result)||result.length!==1)throw Error('Conflito ao enviar: o registro na nuvem mudou. Recarregue e compare as versões.');
  activate(snapshot,result[0].revision);
 }
 function schedule(){
  if(!state.active||state.paused)return;
  clearTimeout(state.timer);state.timer=setTimeout(()=>flush().catch(error=>{
   state.status=`Não sincronizado: ${friendlyError(error)}`;showStatus();
  }),1200);
 }
 async function flush(){
  if(!state.active||state.paused||state.busy)return;
  if(!navigator.onLine){state.status='Offline — alterações só nesta sessão';showStatus();return}
  const snap=JSON.stringify(db);if(snap===state.lastSynced){state.status='Sincronizado';showStatus();return}
  if(new Blob([snap]).size>2_000_000){state.status='Backup maior que 2 MB: faça exportação e reduza anexos';state.paused=true;showStatus();return}
  state.busy=true;state.status='Enviando alterações…';showStatus();
  try{
   const rows=await request(`/rest/v1/universalartes_preview_backups?user_id=eq.${encodeURIComponent(state.userId)}&revision=eq.${state.rev}`,{
    method:'PATCH',body:{data:JSON.parse(snap),revision:state.rev+1},extra:{Prefer:'return=representation'}});
   if(!state.active||!state.userId)return;
   if(!Array.isArray(rows)||rows.length!==1){state.paused=true;state.status='Conflito: outro aparelho alterou os dados. Faça backup e escolha qual versão manter.';return}
   state.rev=rows[0].revision;state.lastSynced=snap;state.status='Sincronizado às '+new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
   saveLocalCloud();
  }catch(error){
   // Uma falha de rede ou permissão não pode disparar tentativas infinitas a cada 1,2 s.
   // Preserva o estado local nesta sessão e exige verificação antes de tentar novamente.
   state.paused=true;
   state.status='Envio interrompido: '+friendlyError(error)+'. Exporte um backup e verifique a nuvem.';
   throw error;
  }finally{state.busy=false;showStatus();if(state.active&&!state.paused&&JSON.stringify(db)!==state.lastSynced)schedule()}
 }
 async function refresh(){
  if(!state.active)return fetchRemote().then(()=>render('empresa'));
  if(state.busy)return;
  const local=JSON.stringify(db), dirty=local!==state.lastSynced;
  await fetchRemote();
  if(!state.remote)throw Error('A nuvem está vazia. Verifique seu projeto Supabase.');
  if(state.remote.revision===state.rev){state.paused=false;if(dirty)schedule();else{state.status='Sincronizado';showStatus()}return}
  if(dirty){state.paused=true;state.status='Conflito: mudanças em dois aparelhos. Exporte backup e escolha a versão.';showStatus();return}
  activate(state.remote.data,state.remote.revision);
 }

 async function inspectConnection(){
  if(!state.cfg||!validURL(state.cfg.url)||!isPublicKey(state.cfg.key))throw Error('Configure URL e chave pública do Supabase.');
  if(!state.session)throw Error('Entre com sua conta do Supabase.');
  const account=await request('/auth/v1/user');
  if(!account?.id||account.id!==state.userId)throw Error('A sessão autenticada não corresponde ao usuário atual.');
  const remote=await fetchRemote();
  return {auth:true,table:true,hasRecord:!!remote,revision:remote?.revision??null,
   synchronized:!!(state.active&&!state.paused&&remote&&state.rev===remote.revision&&JSON.stringify(db)===state.lastSynced)};
 }
 state.inspectConnection=inspectConnection;
 function logout(){
  const wasActive=state.active;
  if(state.active&&JSON.stringify(db)!==state.lastSynced&&!confirm('Existem alterações não sincronizadas. Ao sair elas podem ser perdidas. Deseja continuar?'))return;
  clearTimeout(state.timer);state.active=false;state.paused=false;state.rev=null;state.remote=null;state.lastSynced='';state.userId=null;state.session=null;
  sessionStorage.removeItem(SES);sessionStorage.removeItem(CACHE);sessionStorage.removeItem(META);
  state.status='Local — somente neste navegador';if(wasActive){db=blank();localStorage.setItem(DB_KEY,JSON.stringify(db))}else{db=load()}render('empresa');
 }
 function showStatus(){
  let item=document.getElementById('cloudStatus');
  if(!item){item=document.createElement('button');item.id='cloudStatus';item.type='button';item.className='cloud-pill';item.onclick=()=>{location.hash='empresa';render('empresa')};document.querySelector('.top')?.insertBefore(item,document.querySelector('.avatar'))}
  item.textContent=state.active?state.status:(state.session?'Nuvem — conectada, sem sincronização':'Ativar nuvem');
  item.title='Acessar configurações de nuvem';
  item.classList.toggle('cloud-warn',state.paused||state.status.startsWith('Não sincronizado')||state.status.startsWith('Offline'));
  const panel=document.getElementById('cloudPanel');if(panel){const line=panel.querySelector('[data-cloud-status]');if(line)line.textContent=state.status}
 }
 function panel(){
  let el=document.getElementById('cloudPanel');if(el)return;
  el=document.createElement('section');el.id='cloudPanel';el.className='panel cloud-panel gap-top';
  const email=esc(state.session?.email||'');
  const configured=Boolean(state.cfg?.url&&state.cfg?.key);
  el.innerHTML=`<h3>☁️ Login da Universalartes — banco de testes</h3><p class="muted">Configuração opcional para a prévia 1.0. Cada usuário guarda seus dados de teste separadamente. Para sincronizar entre seus aparelhos, entre com a <strong>mesma conta</strong>. Não use dados reais até validar o acesso e os backups.</p>
  <div class="cloud-state"><strong>Estado:</strong> <span data-cloud-status>${esc(state.status)}</span></div>
  <div class="cloud-two">
   <div><h4>1. Conectar ao Supabase</h4><form data-cloud-form="config"><label>Project URL<input name="url" type="url" placeholder="https://projeto.supabase.co" value="${esc(state.cfg?.url||'')}" required></label><label>Chave pública (publishable / anon)<input name="key" type="text" autocomplete="off" value="${esc(state.cfg?.key||'')}" required></label><button class="btn" type="submit">Salvar configuração</button></form><p class="cloud-help">Antes de entrar, abra o <a href="https://github.com/universautil-del/oficina-marcenaria/blob/main/preview-v1/supabase-preview.sql" target="_blank" rel="noopener noreferrer">SQL do banco de testes</a>, copie seu conteúdo e execute no SQL Editor do Supabase. Nunca cole aqui chaves secretas ou service_role.</p></div>
   <div><h4>2. Entrar ou criar conta</h4>${state.session?`<p>Usuário: <strong>${email}</strong></p><div class="actions"><button class="btn" type="button" data-cloud-action="logout">Sair</button></div>`:`<form data-cloud-form="auth"><label>E-mail<input name="email" type="email" autocomplete="email" required></label><label>Senha<input name="password" type="password" minlength="8" autocomplete="current-password" required></label><div class="actions"><button class="btn primary" name="mode" value="login" type="submit" ${configured?'':'disabled'}>Entrar</button><button class="btn" name="mode" value="signup" type="submit" ${configured?'':'disabled'}>Criar conta</button></div></form>`}</div>
  </div>
  ${state.session?`<div class="cloud-actions"><h4>3. Vincular dados deste aparelho à nuvem</h4><p class="muted">Envio inicial disponível apenas quando a nuvem está vazia. O sistema NÃO sobrescreve um registro existente por esse botão. Conflitos interrompem a sincronização, e você deve manter um backup de segurança.</p><div class="actions"><button type="button" class="btn primary" data-cloud-action="load">Usar dados da nuvem</button><button type="button" class="btn" data-cloud-action="upload">Enviar dados deste aparelho</button><button type="button" class="btn" data-cloud-action="refresh">Verificar atualizações</button><button type="button" class="btn" data-cloud-action="flush">Sincronizar agora</button></div></div>`:''}
  <p class="cloud-help">Enquanto a nuvem não estiver configurada, este site continua no modo local de testes. Em modo nuvem, os dados também permanecem temporariamente nesta aba para tolerar falhas de conexão. Não use equipamentos compartilhados e faça backups frequentes.</p>`;
  content.append(el);
 }
 const baseSave=save;
 save=function(){
  if(!state.active)return baseSave();
  try{saveLocalCloud();schedule();return true}catch(e){alert('Não foi possível manter alterações nesta sessão. Exporte backup: '+friendlyError(e));return false}
 };
 const baseRender=render;
 render=function(...args){baseRender(...args);if((args[0]||location.hash.slice(1))==='empresa')panel();showStatus()};
 document.addEventListener('submit',async e=>{
  const form=e.target.closest('form[data-cloud-form]');if(!form)return;
  e.preventDefault();const data=new FormData(form),btn=e.submitter;form.querySelectorAll('button').forEach(x=>x.disabled=true);
  try{
   if(form.dataset.cloudForm==='config'){
    const url=String(data.get('url')||'').trim().replace(/\/+$/,''),key=String(data.get('key')||'').trim();
    if(!validURL(url))throw Error('Use a URL HTTPS do projeto Supabase (*.supabase.co).');
    if(!isPublicKey(key))throw Error('Use somente a chave pública anon (JWT) ou sb_publishable_. Não use nenhuma chave secreta ou service_role.');
    if(state.session&&url!==state.cfg?.url)throw Error('Saia da conta antes de mudar de projeto.');
    state.cfg={url,key};localStorage.setItem(CFG,JSON.stringify(state.cfg));alert('Configuração pública salva neste navegador.');render('empresa');
   }else{
    const mode=btn?.value||'login';await login(String(data.get('email')||'').trim(),String(data.get('password')||''),mode==='signup');
   }
  }catch(error){alert('Nuvem: '+friendlyError(error));render('empresa')}
  finally{form.querySelectorAll('button').forEach(x=>x.disabled=false)}
 });
 document.addEventListener('click',async e=>{
  const btn=e.target.closest('[data-cloud-action]');if(!btn)return;
  btn.disabled=true;
  try{
   switch(btn.dataset.cloudAction){
    case 'logout':return logout();
    case 'load':await selectRemote();break;
    case 'upload':await sendLocal();break;
    case 'refresh':await refresh();break;
    case 'flush':await flush();break;
   }
   render('empresa');
  }catch(error){state.status='Não sincronizado: '+friendlyError(error);alert('Nuvem: '+friendlyError(error));render('empresa')}
  finally{btn.disabled=false}
 });
 window.addEventListener('online',()=>{if(state.active)refresh().catch(e=>{state.status='Não sincronizado: '+friendlyError(e);showStatus()})});
 window.addEventListener('beforeunload',event=>{
  // Antes de fechar, avise sobre dados comerciais ainda não recebidos pelo servidor.
  if(state.active&&JSON.stringify(db)!==state.lastSynced){event.preventDefault();event.returnValue=''}
 });
 async function boot(){
  if(!state.session?.at){state.session=null;render();return}
  state.userId=state.session.id;
  const meta=safeParse(sessionStorage.getItem(META)),cached=safeParse(sessionStorage.getItem(CACHE));
  if(meta?.active&&meta.id===state.userId&&valid(cached)){
   state.rev=meta.rev;state.lastSynced=meta.lastSynced||'';state.active=true;setDb(cached);state.status='Verificando sincronização…';render();
   try{await refresh()}catch(e){state.status='Não sincronizado: '+friendlyError(e);showStatus()}
  }else{try{await fetchRemote();state.status='Conectado — escolha como iniciar'}catch(e){state.status='Erro ao conectar: '+friendlyError(e)}render()}
 }
 window.oficinaCloud=state;
 boot();
})();