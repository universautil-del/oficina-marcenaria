'use strict';
/* Universa Art — backup criptografado + Google Drive (OAuth opcional, manual).
 * Nenhuma senha, token ou arquivo descriptografado é enviado ao GitHub.
 * A integração direta exige Google Cloud OAuth Client ID e consentimento do usuário.
 * NÃO agenda backups silenciosos; isso requer backend e autorização offline.
 */
(function(){
 const CFG='universa-art-drive-client-id-v1';
 const SCOPE='https://www.googleapis.com/auth/drive.file';
 const ITERATIONS=310000;
 const MAX_BACKUP=5*1024*1024;
 const TYPE='universa-art-encrypted-backup-v1';
 const PREFIX='UniversaArt_Backup_';
 const enc=new TextEncoder(),dec=new TextDecoder();
 let token='',tokenExp=0,files=[],notice='',working=false;
 const safe=v=>esc(String(v??''));
 const getClientId=()=>{try{return localStorage.getItem(CFG)||''}catch{return ''}};
 const b64=bytes=>{
   let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));
   return btoa(s);
 };
 const unb64=s=>{
  if(!/^[A-Za-z0-9+/]+={0,2}$/.test(s)||s.length>10*1024*1024)throw Error('Backup criptografado inválido.');
  const raw=atob(s);return Uint8Array.from(raw,c=>c.charCodeAt(0));
 };
 const filename=()=>{
  const d=new Date(),num=n=>String(n).padStart(2,'0');
  return PREFIX+d.getFullYear()+num(d.getMonth()+1)+num(d.getDate())+'_'+num(d.getHours())+num(d.getMinutes())+num(d.getSeconds())+'.uaenc.json';
 };
 function validatePass(pass){
  if(typeof pass!=='string'||pass.length<12||pass.length>200)throw Error('Digite uma senha de backup com pelo menos 12 caracteres e guarde-a fora do site.');
  return pass;
 }
 async function derive(pass,salt){
  const master=await crypto.subtle.importKey('raw',enc.encode(validatePass(pass)),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:ITERATIONS,hash:'SHA-256'},master,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
 }
 async function encryptBackup(backup,pass){
  if(!crypto?.subtle)throw Error('Criptografia disponível apenas em HTTPS.');
  const source=JSON.stringify(backup);
  if(enc.encode(source).length>MAX_BACKUP)throw Error('Backup maior que 5 MB. Faça um backup local e revise o tamanho dos anexos.');
  const salt=crypto.getRandomValues(new Uint8Array(16));
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const key=await derive(pass,salt);
  const encrypted=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,enc.encode(source)));
  return {format:TYPE,createdAt:new Date().toISOString(),algorithm:'AES-256-GCM',kdf:'PBKDF2-SHA256',iterations:ITERATIONS,salt:b64(salt),iv:b64(iv),ciphertext:b64(encrypted)};
 }
 async function decryptBackup(obj,pass){
  if(!obj||obj.format!==TYPE||obj.algorithm!=='AES-256-GCM'||obj.kdf!=='PBKDF2-SHA256'||obj.iterations!==ITERATIONS)
    throw Error('Formato de backup não reconhecido ou parâmetros de criptografia inválidos.');
  const salt=unb64(obj.salt),iv=unb64(obj.iv),cipher=unb64(obj.ciphertext);
  if(salt.length!==16||iv.length!==12||cipher.length<16||cipher.length>MAX_BACKUP+64)throw Error('Backup criptografado corrompido.');
  try{
   const key=await derive(pass,salt);
   const bytes=await crypto.subtle.decrypt({name:'AES-GCM',iv},key,cipher);
   const contents=JSON.parse(dec.decode(bytes));
   const validated=validateBackup(contents);
   if(validated.kind!==3||!validated.data)throw Error('Backup deve conter dados OFICINA versão 3.');
   return validated.data;
  }catch(e){if(e.message&&e.message.startsWith('Backup deve'))throw e;throw Error('Senha incorreta ou arquivo danificado. Nenhum dado foi alterado.')}
 }
 async function buildPayload(pass){
  const snapshot={app:'oficina',version:3,exportedAt:new Date().toISOString(),data:db};
  return encryptBackup(snapshot,pass);
 }
 function saveBlob(name,blob){
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=name;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),4000);
 }
 function hasToken(){return token&&Date.now()<tokenExp-60000}
 function authButton(){
  const id=getClientId();
  if(!/^[0-9]+-[a-z0-9_-]+\.apps\.googleusercontent\.com$/.test(id))throw Error('Informe um OAuth Client ID do Google Cloud para aplicativo Web.');
  if(!window.google?.accounts?.oauth2)throw Error('Google Identity Services não carregado. Reabra a página e confira sua conexão.');
  // Solicitação iniciada diretamente pelo clique, para evitar bloqueio de pop-up.
  const client=window.google.accounts.oauth2.initTokenClient({
   client_id:id,scope:SCOPE,
   callback:response=>{
    if(response?.error||!response?.access_token){notice='Conexão não autorizada. Confira as permissões Google.';renderPage();return}
    if(!window.google.accounts.oauth2.hasGrantedAllScopes(response,SCOPE)){
     notice='A permissão limitada drive.file não foi concedida.';renderPage();return;
    }
    token=response.access_token;tokenExp=Date.now()+Math.min(Number(response.expires_in)||3000,3600)*1000;
    notice='Google Drive conectado temporariamente. Você pode enviar e recuperar os backups criados por este aplicativo.';
    renderPage();
   },
   error_callback:()=>{notice='A janela de autorização foi fechada ou bloqueada.';renderPage()}
  });
  client.requestAccessToken({prompt:'consent'});
 }
 async function requestDrive(url,options={}){
  if(!hasToken())throw Error('Conecte sua conta Google para continuar.');
  const response=await fetch(url,{...options,headers:{Authorization:'Bearer '+token,...(options.headers||{})},cache:'no-store'});
  if(!response.ok){
   if(response.status===401){token='';tokenExp=0}
   throw Error('Google Drive respondeu '+response.status+'. Confira a conexão e as permissões.');
  }
  return response;
 }
 async function sendDrive(pass){
  const data=await buildPayload(pass),name=filename(),body=JSON.stringify(data);
  if(enc.encode(body).length>MAX_BACKUP)throw Error('Arquivo criptografado maior que 5 MB. Baixe um backup e revise o tamanho.');
  const boundary='ua_'+Array.from(crypto.getRandomValues(new Uint8Array(10))).map(b=>b.toString(16).padStart(2,'0')).join('');
  const multipart=new Blob([
   '--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n',
   JSON.stringify({name,mimeType:'application/json',description:'Backup criptografado Universa Art OFICINA'}),
   '\r\n--'+boundary+'\r\nContent-Type: application/json\r\n\r\n',body,
   '\r\n--'+boundary+'--\r\n'
  ]);
  const res=await requestDrive('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size',
   {method:'POST',headers:{'Content-Type':'multipart/related; boundary='+boundary},body:multipart});
  const saved=await res.json();
  if(!saved?.id)throw Error('O Drive não confirmou o identificador do arquivo. Confira sua pasta antes de tentar novamente.');
  return saved;
 }
 async function loadList(){
  // Escopo drive.file: só retorna arquivos criados/selecionados pelo aplicativo.
  const query="name contains '"+PREFIX+"' and trashed = false";
  const q=new URLSearchParams({q:query,page_size:'30',orderBy:'createdTime desc',fields:'nextPageToken,files(id,name,size,createdTime,mimeType)'});
  const res=await requestDrive('https://www.googleapis.com/drive/v3/files?'+q.toString());
  const data=await res.json();
  files=(data.files||[]).filter(f=>/^[A-Za-z0-9_-]{10,}$/.test(f.id)&&f.name.startsWith(PREFIX)&&f.name.endsWith('.uaenc.json'));
  return files;
 }
 async function loadDriveFile(id){
  const found=files.find(f=>f.id===id);
  if(!found)throw Error('Escolha um backup da lista de arquivos gerados pelo sistema.');
  if(Number(found.size)>MAX_BACKUP)throw Error('Backup maior que 5 MB: não é possível restaurar por esta tela.');
  const res=await requestDrive('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(id)+'?alt=media');
  const text=await res.text();
  if(enc.encode(text).length>MAX_BACKUP)throw Error('Arquivo muito grande.');
  return JSON.parse(text);
 }
 async function restoreData(encrypted,pass){
  if(window.oficinaCloud?.active)throw Error('Desative a sincronização da nuvem e exporte um backup antes de restaurar. Restauração em conta ativa foi bloqueada.');
  const recovered=await decryptBackup(encrypted,pass);
  const count=key=>Array.isArray(recovered[key])?recovered[key].length:0;
  const summary=count('clients')+' clientes, '+count('products')+' produtos, '+count('orders')+' pedidos e '+count('transactions')+' lançamentos.';
  if(!confirm('ATENÇÃO: a restauração substitui dados LOCAIS neste navegador. O backup contém '+summary+' Deseja continuar?'))return false;
  // Exigir uma cópia local antes de qualquer substituição. Não há garantia de upload para nuvem.
  const current={app:'oficina',version:3,exportedAt:new Date().toISOString(),data:db};
  saveBlob('Antes-da-restauracao-UniversaArt.json',new Blob([JSON.stringify(current)],{type:'application/json'}));
  const previous=db;
  try{
   db=recovered;
   if(typeof setupExtras==='function')setupExtras();
   if(save()===false)throw Error('Não foi possível gravar o backup neste navegador.');
   return true;
  }catch(err){db=previous;save();throw err}
 }
 function passInput(){
  const input=document.querySelector('#uaDrivePass');
  return validatePass(input?.value||'');
 }
 function showNotice(message){notice=message;const target=document.querySelector('#uaDriveStatus');if(target)target.textContent=message}
 function renderPage(){
  const connected=!!hasToken();
  const list=files.map(f=>'<tr><td>'+safe(f.name)+'</td><td>'+safe(new Date(f.createdTime).toLocaleString('pt-BR'))+
    '</td><td><button type="button" class="btn" data-drive-action="download" data-fileid="'+safe(f.id)+'">Baixar</button> '+
    '<button type="button" class="btn" data-drive-action="restore" data-fileid="'+safe(f.id)+'">Restaurar</button></td></tr>').join('');
  content.innerHTML=
   '<div class="ua-welcome"><div><div class="ua-eyebrow">UNIVERSA ART · PROTEÇÃO DE DADOS</div>'+
   '<h2>Backups no Google Drive</h2><p>Salve uma cópia criptografada dos cadastros, projetos, pedidos e finanças.</p></div></div>'+
   '<section class="ua-section ua-drive-panel"><h3>1. Backup criptografado</h3>'+
   '<p class="muted">A senha protege o conteúdo com AES-256-GCM antes de gerar o arquivo. Ela não é salva pelo sistema. <strong>Sem essa senha, não será possível recuperar o backup.</strong></p>'+
   '<label for="uaDrivePass">Senha forte do backup (mínimo de 12 caracteres)</label><input id="uaDrivePass" type="password" autocomplete="new-password" minlength="12" maxlength="200" placeholder="Crie e guarde uma senha para recuperar os arquivos">'+
   '<div class="ua-drive-actions"><button type="button" class="btn primary" data-drive-action="export">Baixar backup criptografado</button>'+
   '<button type="button" class="btn" data-drive-action="open-drive">Abrir Google Drive para enviar manualmente</button></div>'+
   '<p class="muted small">A opção manual funciona sem criar um projeto Google Cloud. Baixe o arquivo .uaenc.json e envie para a pasta de backups da sua conta Google.</p></section>'+
   '<section class="ua-section ua-drive-panel gap-top"><h3>2. Enviar diretamente ao Google Drive</h3>'+
   '<p class="muted">Opcional. Requer configurar uma vez um OAuth Client ID do Google Cloud para este site. A autorização usa somente o escopo <code>drive.file</code>, sem acesso a todos os seus arquivos.</p>'+
   '<label for="uaDriveClientId">Google OAuth Client ID (público, nunca segredo)</label><input id="uaDriveClientId" autocomplete="off" value="'+safe(getClientId())+'" placeholder="123456789-xxxx.apps.googleusercontent.com">'+
   '<div class="ua-drive-actions"><button class="btn" type="button" data-drive-action="save-client">Salvar Client ID</button>'+
   '<button class="btn" type="button" data-drive-action="connect">Conectar conta Google</button>'+
   '<button class="btn primary" type="button" data-drive-action="upload" '+(connected?'':'disabled')+'>Salvar backup no Drive</button>'+
   '<button class="btn" type="button" data-drive-action="list" '+(connected?'':'disabled')+'>Listar backups</button></div>'+
   '<p id="uaDriveStatus" class="ua-drive-status" role="status" aria-live="polite">'+safe(notice||'Nenhum arquivo foi enviado ainda.')+'</p>'+
   '<div class="ua-drive-box"><strong>Configuração:</strong> habilite a Google Drive API no Google Cloud, crie um cliente OAuth tipo <em>Aplicativo Web</em> e cadastre a origem JavaScript <code>https://universautil-del.github.io</code>. Configure a tela de consentimento e seus usuários de teste, se necessário. <strong>Não cole client secret aqui.</strong></div>'+
   (list?'<div class="ua-table-wrap"><table class="ua-table"><thead><tr><th>Arquivo</th><th>Data</th><th>Ações</th></tr></thead><tbody>'+list+'</tbody></table></div>':'')+
   '</section>'+
   '<section class="ua-section ua-drive-panel gap-top"><h3>3. Recuperar cópia baixada</h3>'+
   '<p class="muted">Selecione um arquivo criptografado .uaenc.json. A restauração exige a senha, confirmação e cria antes um backup local do estado atual.</p>'+
   '<input id="uaDriveImport" type="file" accept=".json,application/json">'+
   '<div class="ua-drive-actions"><button type="button" class="btn" data-drive-action="import">Validar e restaurar backup local</button></div>'+
   '<p class="muted small">Não há backup automático diário nesta versão estática. Uma rotina agendada exige serviço no servidor e autorização segura do Google.</p></section>';
 }
 const prevRender=render;
 if(!sections.some(x=>x[0]==='backupdrive'))sections.push(['backupdrive','☁','Backup Google Drive']);
 render=function(section=location.hash.slice(1)||'dashboard'){
  if(section!=='backupdrive')return prevRender(section);
  title.textContent='Backup Google Drive';
  nav.innerHTML=sections.map(([key,icon,label])=>'<button class="nav-btn '+(key===section?'active':'')+'" data-section="'+safe(key)+'"><span aria-hidden="true">'+safe(icon)+'</span>'+safe(label)+'</button>').join('');
  nav.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{const next=b.dataset.section;location.hash=next;sidebar.classList.remove('open');if(next===section)render(next)}));
  renderPage();
 };
 document.addEventListener('click',async e=>{
  const b=e.target?.closest?.('[data-drive-action]');if(!b||working)return;
  const action=b.dataset.driveAction;
  if(action==='open-drive'){window.open('https://drive.google.com/drive/u/0/my-drive','_blank','noopener,noreferrer');return}
  if(action==='connect'){
   try{authButton()}catch(err){showNotice(err.message)}
   return;
  }
  if(action==='save-client'){
   const id=document.querySelector('#uaDriveClientId')?.value.trim();
   if(!/^[0-9]+-[a-z0-9_-]+\.apps\.googleusercontent\.com$/.test(id)){showNotice('ID OAuth inválido. Confira as credenciais do aplicativo Web.');return}
   try{localStorage.setItem(CFG,id);token='';tokenExp=0;showNotice('Client ID salvo neste navegador. Conecte sua conta Google para continuar.')}catch{showNotice('Não foi possível salvar a configuração.')}
   return;
  }
  working=true;b.disabled=true;
  try{
   if(action==='export'){
    const payload=await buildPayload(passInput()),name=filename();
    saveBlob(name,new Blob([JSON.stringify(payload)],{type:'application/json'}));
    showNotice('Backup criptografado gerado. Guarde a senha e confira o arquivo baixado.');
   }else if(action==='upload'){
    const result=await sendDrive(passInput());
    showNotice('Backup criptografado enviado ao Google Drive: '+result.name+'. Confira em sua conta.');
   }else if(action==='list'){
    const listed=await loadList();
    notice=listed.length+' backup(s) encontrado(s) no Google Drive.';renderPage();
   }else if(action==='download'){
    const data=await loadDriveFile(b.dataset.fileid);
    const entry=files.find(f=>f.id===b.dataset.fileid);
    saveBlob(entry.name,new Blob([JSON.stringify(data)],{type:'application/json'}));
    showNotice('Download solicitado. Confira o arquivo e sua senha antes de restaurar.');
   }else if(action==='restore'){
    const data=await loadDriveFile(b.dataset.fileid);
    const restored=await restoreData(data,passInput());
    showNotice(restored?'Backup do Drive restaurado neste navegador. Confira os registros.':'Restauração cancelada.');
   }else if(action==='import'){
    const file=document.querySelector('#uaDriveImport')?.files?.[0];
    if(!file)throw Error('Selecione o arquivo .uaenc.json.');
    if(file.size>MAX_BACKUP)throw Error('Arquivo maior que 5 MB.');
    const restored=await restoreData(JSON.parse(await file.text()),passInput());
    showNotice(restored?'Backup restaurado neste navegador. Confira os registros.':'Restauração cancelada.');
   }
  }catch(err){showNotice('Não foi possível concluir: '+String(err?.message||err).slice(0,220))}
  finally{working=false;b.disabled=false}
 });
 window.universaArtDriveBackup={encryptBackup,decryptBackup,buildPayload,filename,loadList,sendDrive,restoreData};
 render(location.hash.slice(1)||'dashboard');
})();