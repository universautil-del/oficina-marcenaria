/* OFICINA 1.0 — service worker de instalação.
 * Cache restrito a arquivos públicos; NUNCA cachear HTML autenticado,
 * banco Supabase, respostas privadas, formulários ou dados do usuário.
 */
'use strict';
const VERSION='ua-oficina-shell-20261111-1';
const OFFLINE=new URL('./offline.html',self.registration.scope).href;
const CORE=[
 OFFLINE,
 new URL('./pwa/icon-192.png',self.registration.scope).href,
 new URL('./pwa/icon-512.png',self.registration.scope).href
];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(VERSION).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil(Promise.all([
  caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('ua-oficina-shell-')&&k!==VERSION).map(k=>caches.delete(k)))),
  self.clients.claim()
 ]));
});
self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET')return;
 const url=new URL(req.url);
 const scope=new URL(self.registration.scope);
 if(url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname))return;
 if(req.mode==='navigate'){
  // A navegação real exige rede: não servir tela de login/dados defasados.
  event.respondWith(fetch(req).catch(async()=>(
   await caches.match(OFFLINE)||
   new Response('OFICINA sem conexão.',{status:503,headers:{'Content-Type':'text/plain;charset=utf-8'}})
  )));
  return;
 }
 // Apenas arquivos públicos estáticos podem ser consultados no cache.
 if(CORE.includes(url.href)){
  event.respondWith(caches.match(req).then(cached=>cached||fetch(req)));
 }
});
