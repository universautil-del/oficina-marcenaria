'use strict';
/* OFICINA 1.0 - backup manual criptografado + snapshots Supabase semanais. Sem Google OAuth. */
(function(){
 const ITERATIONS=310000;
 const MAX_BACKUP=8*1024*1024; // Arquivo codificado em base64 fica maior que o JSON original.
 const MAX_PLAINTEXT=5*1024*1024;
 const TYPE='universa-art-encrypted-backup-v1';
 const PREFIX='UniversaArt_Backup_';
 const enc=new TextEncoder(),dec=new TextDecoder();

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
  if(enc.encode(source).length>MAX_PLAINTEXT)throw Error('Dados de backup acima de 5 MB. Revise o tamanho dos anexos antes de continuar.');
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
  if(salt.length!==16||iv.length!==12||cipher.length<16||cipher.length>MAX_PLAINTEXT+64)throw Error('Backup criptografado corrompido.');
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
  const a=document.createElement('a');a.href=url;a.download=name;
  document.body?.appendChild?.(a);a.click();a.remove?.();
  setTimeout(()=>URL.revokeObjectURL(url),20000);
 }
 async function restoreData(encrypted,pass){
  const secure=!!window.UNIVERSA_REQUIRE_AUTH;
  if(!secure&&window.oficinaCloud?.active)throw Error('Desative a sincronização da nuvem e exporte um backup antes de restaurar. Restauração em conta ativa foi bloqueada.');
  if(secure&&(!window.oficinaCloud?.active||window.oficinaCloud?.paused))throw Error('Faça login e resolva eventuais conflitos de nuvem antes de restaurar.');
  const recovered=await decryptBackup(encrypted,pass);
  const count=key=>Array.isArray(recovered[key])?recovered[key].length:0;
  const summary=count('clients')+' clientes, '+count('products')+' produtos, '+count('orders')+' pedidos e '+count('transactions')+' lançamentos.';
  if(!confirm('ATENÇÃO: a restauração substituirá '+(secure?'os dados da SUA conta Supabase':'os dados LOCAIS deste navegador')+'. O backup contém '+summary+' Confirma a substituição?'))return false;
  // Antes de substituir, gerar cópia cifrada (nunca JSON aberto com dados pessoais).
  const current={app:'oficina',version:3,exportedAt:new Date().toISOString(),data:db};
  const safety=await encryptBackup(current,pass);
  await decryptBackup(safety,pass);
  saveBlob('Antes-da-restauracao-UniversaArt.uaenc.json',new Blob([JSON.stringify(safety)],{type:'application/json'}));
  const previous=db;
  try{
   db=recovered;
   if(typeof setupExtras==='function')setupExtras();
   if(typeof v5InitData==='function')v5InitData();
   if(save()===false)throw Error('Não foi possível preparar a restauração.');
   if(secure){
    await window.oficinaCloud.commit();
    const checked=await window.oficinaCloud.inspectConnection();
    if(!checked?.synchronized)throw Error('O servidor não confirmou a restauração. Verifique o banco antes de repetir.');
   }
   return true;
  }catch(err){db=previous;if(!secure)save();throw err}
 }

 let notice='',working=false,snapshots=[],scanState='Verificacao pendente. As copias automaticas precisam ser ativadas no Supabase.',lastScan=0;
 const safe=v=>esc(String(v??''));
 function passInput(){
  const element=document.querySelector('#uaBackupPass');
  return validatePass(element?.value||'');
 }
 function showNotice(message){
  notice=message;
  const target=document.querySelector('#uaBackupNotice');
  if(target)target.textContent=message;
 }
 function snapshotRows(){
  return snapshots.map(entry=>{
   const when=new Date(entry.criado_em);
   const date=Number.isFinite(when.getTime())?when.toLocaleString('pt-BR'):'Data a conferir';
   return '<tr><td>'+safe(date)+'</td><td>Revisao '+safe(entry.revisao_origem)+'</td>'+
    '<td><button type="button" class="btn" data-ua-backup-action="download-weekly" data-backup-id="'+safe(entry.id)+'">Baixar criptografado</button></td></tr>';
  }).join('');
 }
 async function scanWeekly(){
  const cloud=window.oficinaCloud;
  if(!window.UNIVERSA_REQUIRE_AUTH){
    scanState='Ambiente local de testes: entre na OFICINA 1.0 autenticada para ver as copias do servidor.';
    snapshots=[];renderPage();return;
  }
  if(!cloud?.active||cloud.paused){
    scanState='Entre e resolva a sincronizacao antes de consultar o backup do servidor.';
    snapshots=[];renderPage();return;
  }
  scanState='Consultando copias semanais do Supabase…';renderPage();
  try{
    const schedule=await cloud.weeklyBackupStatus();
    snapshots=await cloud.listWeeklyBackups();
    scanState=(schedule.agendamento_ativo?'Agendamento semanal ativo. ':'Agendamento semanal ainda NAO ativo. ')+
      snapshots.length+' de 4 copias no servidor. '+
      (snapshots.length?'Ultima: '+new Date(snapshots[0].criado_em).toLocaleString('pt-BR')+'.':'Aguardando primeira copia.')+
      (schedule.agendamento_ativo?' Confira os registros de execucao do Cron.':' Execute os scripts de instalacao para habilitar os backups.');
  }catch(error){
    snapshots=[];
    scanState='Nao foi possivel listar os backups automaticos: '+String(error.message||error).slice(0,150)+'. Verifique se executou os scripts de instalacao.';
  }
  lastScan=Date.now();renderPage();
 }
 function renderPage(){
  const typed=document.querySelector('#uaBackupPass')?.value||'';
  const rows=snapshotRows();
  content.innerHTML=
   '<div class="ua-welcome"><div><div class="ua-eyebrow">UNIVERSA ART · PROTECAO DE DADOS</div>'+
    '<h2>Backup e recuperacao</h2><p>Copias semanais no Supabase com quatro versoes rotativas e um backup criptografado para guardar fora do sistema.</p></div></div>'+
   '<section class="ua-section ua-drive-panel"><h3>1. Backup automatico semanal · Supabase</h3>'+
    '<p>O banco cria uma copia do documento aos domingos, mesmo que o site esteja fechado. Sao preservadas as <strong>4 ultimas copias por conta</strong>. Uma versao antiga so e excluida depois que a nova copia estiver salva e conferida.</p>'+
    '<div class="ua-drive-box"><strong>Situacao:</strong> <span id="uaBackupRemoteStatus" role="status">'+safe(scanState)+'</span></div>'+
    '<div class="ua-drive-actions"><button class="btn primary" type="button" data-ua-backup-action="refresh">Verificar backups no Supabase</button></div>'+
    (rows?'<div class="ua-table-wrap"><table class="ua-table"><thead><tr><th>Data</th><th>Documento</th><th>Acao</th></tr></thead><tbody>'+rows+'</tbody></table></div>':'')+
    '<p class="muted small">Ativacao unica: abra o <a href="https://github.com/universautil-del/oficina-marcenaria/blob/main/supabase/INSTALAR-backup-automatico-OFICINA-1-0.sql" target="_blank" rel="noopener noreferrer">SQL de instalacao do backup semanal</a>, copie todo o codigo (Raw) e execute no Editor SQL do seu projeto Supabase. Esta tela nao ativa o cron sozinha; confira em Integrations → Cron → Jobs.</p>'+
    '<p class="muted small">As copias estao dentro do MESMO projeto Supabase e nao utilizam uma senha particular. Uma falha ou exclusao do projeto pode afetar todas. Mantenha uma copia criptografada fora do Supabase.</p></section>'+
   '<section class="ua-section ua-drive-panel gap-top"><h3>2. Copia manual criptografada</h3>'+
    '<p class="muted">Baixe uma copia AES-256-GCM sempre que quiser. A senha nao e salva no Oficina: guarde-a em local seguro.</p>'+
    '<label for="uaBackupPass">Senha forte para proteger o arquivo (minimo de 12 caracteres)</label>'+
    '<input id="uaBackupPass" type="password" autocomplete="new-password" minlength="12" maxlength="200" placeholder="Crie e guarde a senha fora do sistema">'+
    '<div class="ua-drive-actions"><button class="btn primary" type="button" data-ua-backup-action="export">Baixar backup criptografado</button></div>'+
    '<p class="muted small">Voce pode guardar o arquivo em uma pasta privada do computador ou em outro servico de armazenamento. Nao publique os dados em repositorios GitHub.</p></section>'+
   '<section class="ua-section ua-drive-panel gap-top"><h3>3. Conferir ou restaurar um arquivo</h3>'+
    '<p class="muted">Selecione um arquivo .uaenc.json e informe a senha acima. Primeiro use Verificar: isso nao altera os registros. Restaurar substitui os dados da conta atual; faca uma copia preventiva e confirme antes.</p>'+
    '<input id="uaBackupImport" type="file" accept=".uaenc.json,.json,application/json">'+
    '<div class="ua-drive-actions"><button class="btn" type="button" data-ua-backup-action="verify">Verificar arquivo sem alterar dados</button>'+
    '<button class="btn" type="button" data-ua-backup-action="restore">Restaurar arquivo no '+(window.UNIVERSA_REQUIRE_AUTH?'Supabase':'navegador')+'</button></div>'+
    '<p class="ua-drive-status" id="uaBackupNotice" role="status" aria-live="polite">'+safe(notice)+'</p></section>';
  const input=document.querySelector('#uaBackupPass');if(input)input.value=typed;
 }
 const prevRender=render;
 if(!sections.some(x=>x[0]==='backupdrive'))sections.push(['backupdrive','☁','Backup e recuperacao']);
 render=function(section=location.hash.slice(1)||'dashboard'){
  if(section!=='backupdrive')return prevRender(section);
  title.textContent='Backup e recuperacao';
  nav.innerHTML=sections.map(([key,icon,label])=>'<button class="nav-btn '+(key===section?'active':'')+'" data-section="'+safe(key)+'"><span aria-hidden="true">'+safe(icon)+'</span>'+safe(label)+'</button>').join('');
  nav.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{
   const next=b.dataset.section;location.hash=next;sidebar.classList.remove('open');if(next===section)render(next);
  }));
  renderPage();
  if(window.UNIVERSA_REQUIRE_AUTH&&window.oficinaCloud?.active&&Date.now()-lastScan>45000)
   scanWeekly().catch(error=>showNotice(String(error.message||error)));
 };
 document.addEventListener('click',async event=>{
  const button=event.target?.closest?.('[data-ua-backup-action]');
  if(!button||working)return;
  const action=button.dataset.uaBackupAction;
  working=true;button.disabled=true;
  try{
   if(action==='refresh'){
    await scanWeekly();
   }else if(action==='export'){
    const pass=passInput();
    const payload=await buildPayload(pass);
    await decryptBackup(payload,pass);
    saveBlob(filename(),new Blob([JSON.stringify(payload)],{type:'application/json'}));
    showNotice('Arquivo criptografado gerado. Confira a pasta Downloads e depois use Verificar arquivo.');
   }else if(action==='download-weekly'){
    const candidate=snapshots.find(x=>String(x.id)===String(button.dataset.backupId));
    if(!candidate)throw Error('Copia nao encontrada. Atualize a lista.');
    const pass=passInput();
    const backup=await window.oficinaCloud.getWeeklyBackup(candidate.id);
    const payload=await encryptBackup({app:'oficina',version:3,exportedAt:new Date().toISOString(),data:backup.dados},pass);
    await decryptBackup(payload,pass);
    const name='UniversaArt_Semanal_'+String(candidate.semana_utc||candidate.id)+'.uaenc.json';
    saveBlob(name,new Blob([JSON.stringify(payload)],{type:'application/json'}));
    showNotice('Copia semanal criptografada baixada. Verifique o arquivo antes de precisar restaurar.');
   }else if(action==='verify'||action==='restore'){
    const file=document.querySelector('#uaBackupImport')?.files?.[0];
    if(!file)throw Error('Escolha um arquivo .uaenc.json.');
    if(file.size>MAX_BACKUP)throw Error('Arquivo maior que 8 MB.');
    const payload=JSON.parse(await file.text());
    if(action==='verify'){
      const restored=await decryptBackup(payload,passInput());
      showNotice('Arquivo valido. '+(restored.clients?.length||0)+' clientes, '+(restored.orders?.length||0)+' pedidos. Nenhum registro foi alterado.');
    }else{
      const restored=await restoreData(payload,passInput());
      showNotice(restored?'Restauracao concluida. Confira os dados e a sincronizacao.':'Restauracao cancelada.');
    }
   }
  }catch(error){showNotice('Operacao nao concluida: '+String(error.message||error).slice(0,230))}
  finally{working=false;button.disabled=false}
 });
 window.universaArtBackup={encryptBackup,decryptBackup,buildPayload,restoreData,filename,scanWeekly,renderPage};
 window.universaArtDriveBackup=window.universaArtBackup; // Compatibilidade de testes antigos; sem API Google.
 render(location.hash.slice(1)||'dashboard');
})();
