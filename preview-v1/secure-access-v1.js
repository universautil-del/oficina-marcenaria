'use strict';
/* PORTAL AUTENTICADO — dados somente do Supabase vinculado pelo proprietário.
   A proteção verdadeira dos registros está no login do servidor e nas RLS.
   Essa interface é uma camada de acesso; não substitui políticas do banco. */
(function(){
 if(!window.UNIVERSA_REQUIRE_AUTH)return;
 const gate=document.querySelector('#uaSecureGate');
 if(!gate)return;
 const escHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;',"'":'&#39;'}[c]));
 let busy=false,status='';
 const cloud=()=>window.oficinaCloud||null;
 function locked(){document.documentElement.classList.add('ua-auth-required')}
 function unlocked(){document.documentElement.classList.remove('ua-auth-required')}
 function view(){
  const state=cloud();
  if(state?.session&&state?.active){
   status='';unlocked();return;
  }
  locked();
  const cfg=state?.cfg||{},configured=!!(cfg.url&&cfg.key);
  const error=state?.status||'Aguardando autenticação';
  gate.innerHTML='<section class="ua-secure-box" aria-labelledby="ua-secure-title">'+
   '<div class="ua-secure-brand"><img src="assets/universa-art-logo.webp" alt="" width="64" height="64"><div><strong>UNIVERSA ART</strong><small>OFICINA · acesso autenticado</small></div></div>'+
   '<h1 id="ua-secure-title">Entrar na OFICINA</h1>'+
   '<p>Seus dados serão carregados somente após autenticação na sua conta Supabase. Nenhuma informação da versão local anterior é importada automaticamente.</p>'+
   '<div class="ua-secure-status" role="status">'+escHtml(status||error)+'</div>'+
   '<details class="ua-secure-details" '+(!configured?'open':'')+'><summary>1. Configurar o banco Supabase</summary>'+
   '<form id="uaSecureConfig"><label>URL do projeto Supabase<input name="url" type="url" autocomplete="off" placeholder="https://seu-projeto.supabase.co" value="'+escHtml(cfg.url||'')+'" required></label>'+
   '<label>Chave pública publishable / anon<input name="key" type="text" autocomplete="off" value="'+escHtml(cfg.key||'')+'" required></label>'+
   '<button class="ua-secure-button secondary" type="submit">Salvar conexão</button></form>'+
   '<p class="ua-secure-foot">Execute primeiro o script <a href="https://github.com/universautil-del/oficina-marcenaria/blob/main/supabase/secure-document-v1.sql" target="_blank" rel="noopener noreferrer">SQL autenticado</a> em seu próprio Supabase. Nunca informe senha, chave secreta ou service_role aqui.</p></details>'+
   '<form id="uaSecureLogin" class="ua-secure-form"><h2>2. Sua conta</h2>'+
   '<label>E-mail<input name="email" autocomplete="username" type="email" required></label>'+
   '<label>Senha<input name="password" autocomplete="current-password" type="password" minlength="8" required></label>'+
   '<div class="ua-secure-actions"><button class="ua-secure-button" type="submit" name="action" value="login" '+(configured?'':'disabled')+'>Entrar</button>'+
   '<button class="ua-secure-button secondary" type="submit" name="action" value="signup" '+(configured?'':'disabled')+'>Criar conta</button></div>'+
   '</form>'+
   '<p class="ua-secure-foot">Ao criar uma conta, talvez seja necessário confirmar seu e-mail antes de entrar. Se a conexão não funcionar, verifique URL, chave pública, SQL e RLS no Supabase.</p>'+
   '<p class="ua-secure-foot">Este acesso está em homologação técnica até os testes com duas contas e restauração real do backup serem concluídos.</p>'+
   '</section>';
 }
 gate.addEventListener('submit',async event=>{
  const form=event.target;if(!['uaSecureConfig','uaSecureLogin'].includes(form.id))return;
  event.preventDefault();if(busy)return;
  busy=true;status='Verificando no servidor…';view();
  try{
   if(form.id==='uaSecureConfig'){
    const data=new FormData(form);
    cloud().configure(String(data.get('url')||'').trim().replace(/\/+$/,''),String(data.get('key')||'').trim());
    status='Conexão pública salva. Agora entre na conta.';
   }else{
    const data=new FormData(form),mode=event.submitter?.value||'login';
    const email=String(data.get('email')||'').trim(),password=String(data.get('password')||'');
    if(!cloud()?.cfg)throw Error('Configure primeiro o banco Supabase.');
    if(mode==='signup'){
      await cloud().signUp(email,password);
      status='Cadastro solicitado. Se necessário, confirme o e-mail e entre.';
    }else{
      await cloud().signIn(email,password);
      status='Acesso autenticado.';
    }
   }
  }catch(error){status='Não foi possível entrar: '+String(error?.message||error).slice(0,240)}
  finally{busy=false;view()}
 });
 window.addEventListener('ua-secure-change',view);
 window.addEventListener('pageshow',view);
 view();
})();
