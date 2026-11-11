'use strict';
/* OFICINA 1.0 — botão de instalação não invasivo.
 * Instalável no Android; instruções de tela inicial para iPhone.
 * Nenhum dado do Supabase é copiado ou armazenado por este módulo.
 */
(function(){
 if(!window.UNIVERSA_REQUIRE_AUTH)return; // A prévia 1.2 não deve virar o app instalado.
 let deferred=null;
 const isStandalone=()=>window.matchMedia?.('(display-mode: standalone)')?.matches||
   window.navigator.standalone===true;
 const isiOS=()=>/iPad|iPhone|iPod/.test(navigator.userAgent)||
   (navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 function dialog(title,steps){
  const el=document.createElement('dialog');
  el.className='ua-install-dialog';
  const heading=document.createElement('h2');heading.textContent=title;
  const info=document.createElement('p');info.textContent=steps;
  const close=document.createElement('button');close.className='btn primary';close.type='button';close.textContent='Entendi';
  close.onclick=()=>el.close();
  el.append(heading,info,close);
  document.body.append(el);
  el.addEventListener('close',()=>el.remove(),{once:true});
  if(typeof el.showModal==='function')el.showModal();
  else {el.setAttribute('open','');}
 }
 function status(){
  const button=document.getElementById('uaInstallPwa');
  if(!button)return;
  button.hidden=!!isStandalone();
  button.textContent=deferred?'Instalar aplicativo OFICINA':'Instalar no celular';
  button.title=deferred?'Instalar OFICINA como aplicativo':'Como adicionar OFICINA à tela inicial';
 }
 function prepare(){
  const sidefoot=document.querySelector('.sidebar .sidefoot');
  if(!sidefoot||document.getElementById('uaInstallPwa'))return;
  const button=document.createElement('button');
  button.type='button';button.id='uaInstallPwa';button.className='ua-install-button';
  button.addEventListener('click',async()=>{
   if(isStandalone())return;
   if(deferred){
    const event=deferred;deferred=null;
    try{
     await event.prompt();
     await event.userChoice;
    }catch(e){dialog('Instalação não disponível','Abra o menu do navegador e escolha Instalar aplicativo ou Adicionar à tela inicial.');}
    status();return;
   }
   if(isiOS())dialog('Instalar no iPhone ou iPad',
    'Abra a OFICINA no Safari. Toque em Compartilhar e escolha Adicionar à Tela de Início; depois toque em Adicionar.');
   else dialog('Instalar a OFICINA',
    'No Chrome ou navegador compatível, abra o menu de três pontos e escolha Instalar aplicativo (ou Adicionar à tela inicial).');
  });
  sidefoot.prepend(button);status();
 }
 window.addEventListener('beforeinstallprompt',event=>{
  event.preventDefault();deferred=event;status();
 });
 window.addEventListener('appinstalled',()=>{deferred=null;status()});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',prepare);
 else prepare();
 if('serviceWorker' in navigator&&location.protocol==='https:'){
  window.addEventListener('load',()=>{
   navigator.serviceWorker.register('../sw.js',{scope:'../'}).catch(error=>{
    // Não bloquear login ou sincronização em falha de instalação.
    console.warn('Instalação da OFICINA indisponível:',error.message);
   });
  });
 }
})();
