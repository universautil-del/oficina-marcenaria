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
  const error=(!configured&&(!state?.status||state.status.startsWith('Local')))?'Conexão na nuvem ainda não configurada':state?.status||'Pronto para entrar';
  gate.innerHTML='<section class="ua-secure-box" aria-labelledby="ua-secure-title">'+
   '<div class="ua-secure-brand"><img src="assets/universa-art-logo.webp" alt="" width="64" height="64"><div><strong>UNIVERSA ART</strong><small>OFICINA · acesso autenticado</small></div></div>'+
   '<h1 id="ua-secure-title">Entrar na OFICINA</h1><p class="ua-secure-foot">Versão 1.2 · acesso pessoal</p>'+
   '<p>Uma única conta para você trabalhar no computador e no celular. Entre sempre com o mesmo e-mail e senha para acessar os mesmos dados. Seus registros só são carregados após autenticação.</p>'+
   '<div class="ua-secure-status" role="status">'+escHtml(status||error)+'</div>'+
   '<details class="ua-secure-details" '+(!configured?'open':'')+'><summary>'+(configured?'Configuração da nuvem (avançado)':'Primeiro acesso · Conectar o banco uma vez neste aparelho')+'</summary>'+
   '<p class="ua-secure-foot">A conexão é feita com a URL e a chave pública do seu projeto. Não é necessário criar um banco diferente para o celular.</p>'+
   '<form id="uaSecureConfig"><label>URL do projeto Supabase<input name="url" type="url" autocomplete="off" placeholder="https://seu-projeto.supabase.co" value="'+escHtml(cfg.url||'')+'" required></label>'+
   '<label>Chave pública publishable / anon<input name="key" type="text" autocomplete="off" value="'+escHtml(cfg.key||'')+'" required></label>'+
   '<button class="ua-secure-button secondary" type="submit">Salvar conexão</button></form>'+
   '<p class="ua-secure-foot">Execute primeiro o script <a href="https://github.com/universautil-del/oficina-marcenaria/blob/main/supabase/secure-document-v1.sql" target="_blank" rel="noopener noreferrer">SQL autenticado</a> em seu próprio Supabase. Nunca informe senha, chave secreta ou service_role aqui.</p></details>'+
   (configured?'<form id="uaSecureLogin" class="ua-secure-form"><h2>Entrar com sua conta</h2>':'<div class="ua-secure-foot">Configure a nuvem acima para liberar o login. Se ainda não tem Supabase, crie um projeto em <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer">supabase.com</a>. Os dados não são compartilhados entre aparelhos sem um banco online.</div><form id="uaSecureLogin" class="ua-secure-form" style="display:none"><h2>Entrar com sua conta</h2>')+
   '<label>E-mail<input name="email" autocomplete="username" type="email" required></label>'+
   '<label>Senha<input name="password" autocomplete="current-password" type="password" minlength="8" required></label>'+
   '<div class="ua-secure-actions"><button class="ua-secure-button" type="submit" name="action" value="login" '+(configured?'':'disabled')+'>Entrar</button>'+
   '<button class="ua-secure-button secondary" type="submit" name="action" value="signup" '+(configured?'':'disabled')+'>Criar conta</button></div>'+
   '</form>'+
   '<p class="ua-secure-foot">Crie apenas uma conta e use-a nos dois aparelhos. Após criar o acesso, desative novos cadastros públicos no Supabase (Authentication → Providers → Email). Talvez seja necessário confirmar seu e-mail antes de entrar.</p>'+
   '<p class="ua-secure-foot">Antes de trocar de aparelho, confira o status Sincronizado. Se estiver offline ou houver conflito, não continue lançando dados no outro aparelho. A sincronização e a restauração ainda precisam ser validadas com dados de teste.</p>'+
   '</section>';
 }
 gate.addEventListener('submit',async event=>{
  const form=event.target;if(!['uaSecureConfig','uaSecureLogin'].includes(form.id))return;
  event.preventDefault();if(busy)return;
  const data=new FormData(form),mode=event.submitter?.value||'login';
  busy=true;status='Verificando no servidor…';view();
  try{
   if(form.id==='uaSecureConfig'){
    cloud().configure(String(data.get('url')||'').trim().replace(/\/+$/,''),String(data.get('key')||'').trim());
    status='Conexão pública salva. Agora entre na conta.';
   }else{
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
