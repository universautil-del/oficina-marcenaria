'use strict';
/* Regressão da mensagem de Backup e restauração em ambiente autenticado. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const src=read('preview-v1/script.js');
const start=src.indexOf('function companyBackupSecurityNotice(){');
const end=src.indexOf('function companyView(){',start);
assert(start>=0&&end>start,'Texto de segurança deve ser condicional');
const functionCode=src.slice(start,end);
assert(!src.includes('Este site no GitHub Pages é público e não tem login. Os dados ficam apenas no navegador'),'Mensagem antiga deve ser eliminada');
assert(src.includes('$'+'{companyBackupSecurityNotice()}'),'O backup deve apresentar mensagem adequada ao ambiente');
function message({auth=false,active=false,session=null}={}){
 const ctx={window:{UNIVERSA_REQUIRE_AUTH:auth,oficinaCloud:{active,session}},String};
 return vm.runInNewContext(functionCode+';companyBackupSecurityNotice()',ctx);
}
let secured=message({auth:true,active:true,session:{user:{id:'demo'}}});
assert(secured.includes('Acesso autenticado'));
assert(secured.includes('Supabase'));
assert(secured.includes('Sincronizado'));
assert(secured.includes('GitHub Pages hospeda a interface pública'));
assert(!secured.includes('não tem login'));
assert(!secured.includes('ficam no navegador'));
assert(secured.includes('cópia criptografada'));
const disconnected=message({auth:true,active:false,session:null});
assert(disconnected.includes('não está confirmado'));
assert(disconnected.includes('Supabase'));
assert(!disconnected.includes('Acesso autenticado nesta sessão'));
const preview=message({auth:false,active:false,session:null});
assert(preview.includes('prévia pública'));
assert(preview.includes('sem login obrigatório'));
assert(preview.includes('informações fictícias'));
assert(!preview.includes('Acesso autenticado'));
for(const page of ['preview-v1/seguro.html','preview-v1/index.html']){
 const html=read(page);
 assert(/src="script\.js\?v=[^"]+"/.test(html),page+' requer versão do script para renovar cache');
}
assert(read('preview-v1/seguro.html').includes('window.UNIVERSA_REQUIRE_AUTH=true'),'Portal protegido preserva exigência de login');
console.log('OK: backup informa acesso autenticado apenas após sessão válida, alerta sem conexão e distingue prévia.');
