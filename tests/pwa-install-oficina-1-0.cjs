/* Testar instalação OFICINA 1.0: manifesto, ícones, conexão e segurança offline. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),zlib=require('node:zlib'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('preview-v1/seguro.html'),redirect=read('oficina.html'),
 script=read('preview-v1/pwa-install-1-0.js'),worker=read('sw.js'),offline=read('offline.html');
const manifest=JSON.parse(read('manifest.json'));
new vm.Script(script);new vm.Script(worker);
assert.equal(manifest.name,'UNIVERSA ART — OFICINA');
assert.equal(manifest.start_url,'./preview-v1/seguro.html');
assert.equal(manifest.scope,'./');
assert.equal(manifest.display,'standalone');
assert.equal(manifest.id,'./preview-v1/seguro.html');
assert(html.includes('<link rel="manifest" href="../manifest.json">'));
assert(html.includes('<link rel="apple-touch-icon"'));
assert(html.includes('pwa-install-1-0.js')&&html.includes('pwa-install-1-0.css'));
assert(redirect.includes('<link rel="manifest" href="manifest.json">'));
assert(!read('preview-v1/index.html').includes('pwa-install-1-0.js'),'A prévia de homologação não deve ser instalada');
const sizes=new Set();
for(const icon of manifest.icons){
 assert.equal(icon.type,'image/png');
 const file=path.join(root,icon.src.replace(/^\.\//,''));
 const bytes=fs.readFileSync(file);
 assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
 assert.equal(icon.sizes,width+'x'+height,'Tamanho real igual ao manifesto');
 assert.equal(width,height,'Ícone quadrado');
 sizes.add(width);
 let offset=8,idat=[];
 while(offset<bytes.length){
  const len=bytes.readUInt32BE(offset),tag=bytes.toString('ascii',offset+4,offset+8);
  if(tag==='IDAT')idat.push(bytes.subarray(offset+8,offset+8+len));
  offset+=12+len;
 }
 const raw=zlib.inflateSync(Buffer.concat(idat));
 assert.equal(raw.length,height*(1+Math.ceil(width*2/8)),'Ícone PNG deve descomprimir corretamente');
 assert(raw.some(v=>v!==0),'Ícone não pode estar vazio');
}
assert(sizes.has(192)&&sizes.has(512));
assert(worker.includes("req.mode==='navigate'"));
assert(worker.includes('fetch(req).catch'));
assert(worker.includes('caches.match(OFFLINE)'));
assert(!worker.includes('localStorage')&&!worker.includes('sessionStorage')&&!worker.includes('universalartes_preview_backups'));
assert(!worker.includes('cache.put(req'),'Jamais cachear dados do Supabase');
assert(offline.includes('Sem conexão')&&offline.includes('Supabase'));
let click,domReady,load,installEvent,installedEvent,dialogOpened=0,registration=null,prevented=false,prompted=false;
const sidefoot={prepend(el){this.button=el}};
const body={append(el){this.last=el}};
const document={
 readyState:'loading',body,
 addEventListener(name,fn){if(name==='DOMContentLoaded')domReady=fn},
 getElementById(id){return id==='uaInstallPwa'?sidefoot.button||null:null},
 querySelector(q){return q==='.sidebar .sidefoot'?sidefoot:null},
 createElement(tag){
  return {tag,attributes:{},children:[],hidden:false,
   addEventListener(type,fn){if(type==='click')click=fn},
   append(...xs){this.children.push(...xs)},
   setAttribute(k,v){this.attributes[k]=v},
   showModal(){dialogOpened++},
   close(){this.closed=true;this.onclose?.()},
   onclick:null
  };
 }
};
const navigator={userAgent:'Mozilla/5.0 (Linux; Android 14) Chrome/130',platform:'Linux',maxTouchPoints:5,
 serviceWorker:{async register(path,config){registration={path,config};return{scope:'https://example.com/oficina-marcenaria/'}}}};
const window={UNIVERSA_REQUIRE_AUTH:true,matchMedia:()=>({matches:false}),navigator,
 addEventListener(name,fn){if(name==='load')load=fn;else if(name==='beforeinstallprompt')installEvent=fn;else if(name==='appinstalled')installedEvent=fn}};
const context={window,document,navigator,location:{protocol:'https:'},console,Error,Set,Promise,String};
vm.runInNewContext(script,context,{timeout:1200});
assert.equal(typeof domReady,'function');
assert.equal(typeof installEvent,'function');
domReady();
assert(sidefoot.button);
assert.equal(sidefoot.button.textContent,'Instalar no celular');
load();
(async()=>{
 await Promise.resolve();
 assert.equal(registration.path,'../sw.js');
 assert.equal(registration.config.scope,'../');
 await click();
 assert.equal(dialogOpened,1,'Abrir instruções sem prompt disponível');
 const evt={preventDefault(){prevented=true},prompt(){prompted=true},userChoice:Promise.resolve({outcome:'accepted'})};
 installEvent(evt);
 assert(prevented);
 await click();
 assert(prompted,'Instalação pela API depende de ação do usuário');
 installedEvent();
 assert.equal(sidefoot.button.textContent,'Instalar no celular');
 console.log('OK PWA: ícones 192/512 PNG, manifest Android/iOS, registro restrito e instalação sem armazenar dados privados.');
})().catch(e=>{console.error(e);process.exitCode=1});
