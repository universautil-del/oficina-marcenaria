/* OFICINA: acesso padrão deve exigir login, sem apagar registros locais antigos. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const home=read('index.html'),preview=read('preview-v1/index.html'),secure=read('preview-v1/seguro.html');
const legacy=read('recuperar-dados-locais.html');
assert(home.includes('oficina.html')&&home.includes('recuperar-dados-locais.html'));
assert(!home.includes('<script src="script.js"'),'A página principal não deve iniciar o app sem login');
assert(secure.includes('window.UNIVERSA_REQUIRE_AUTH=true'),'Portal seguro exige autenticação');
assert(secure.includes('secure-access-v1.js'),'Portal protegido precisa do controle de login');
assert(preview.includes('Entrar na OFICINA com login'),'Prévia deve indicar entrada autenticada');
assert(preview.includes('Use apenas dados fictícios'),'Prévia sem login deve alertar sobre privacidade');
assert(legacy.includes('RECUPERAÇÃO DE DADOS DO SISTEMA ANTIGO'));
assert(legacy.includes('script.js'),'Cópia antiga precisa continuar acessível para exportação');
const inline=home.match(/<script>\s*([\s\S]*?)\s*<\/script>/);
assert(inline,'Página principal precisa de roteamento');
new vm.Script(inline[1]);
function visit(values,hash=''){
 const storage=new Map(Object.entries(values));
 let redirected=null;
 const elements={
  uaSecureEntry:{href:''},
  uaOldLocalNotice:{hidden:true},
  uaLegacyEntry:{hidden:true}
 };
 const ctx={
  localStorage:{getItem:key=>storage.get(key)??null},
  document:{getElementById:id=>elements[id]},
  location:{hash,replace:url=>{redirected=url}},
  JSON,Array,Object,Error
 };
 vm.runInNewContext(inline[1],ctx,{timeout:1000});
 return {storage,redirected,elements};
}
let output=visit({});
assert.equal(output.redirected,'oficina.html');
assert(output.elements.uaLegacyEntry.hidden);
output=visit({'oficina-marcenaria-v03':JSON.stringify({
 version:3,clients:[{id:'a1'}],products:[],orders:[],transactions:[]
})},'#financeiro');
assert.equal(output.redirected,null,'Não redirecionar automaticamente quando há dados antigos não exportados');
assert.equal(output.elements.uaOldLocalNotice.hidden,false);
assert.equal(output.elements.uaLegacyEntry.hidden,false);
assert.equal(output.storage.size,1,'Não apagar os dados antigos');
output=visit({'oficina-clientes-v02':JSON.stringify([{id:'a2'}])});
assert.equal(output.redirected,null,'Não ignorar contatos do formato mais antigo');
output=visit({'oficina-marcenaria-v03':JSON.stringify({version:3,clients:[],orders:[],products:[]})},'#pedidos');
assert.equal(output.redirected,'oficina.html#pedidos','Conservar rota se não houver dados');
output=visit({'oficina-marcenaria-v03':'{inválido'});
assert.equal(output.redirected,null,'Se os dados forem ilegíveis, preservar chance de recuperação');
assert.equal(output.elements.uaOldLocalNotice.hidden,false);
console.log('OK: acesso principal com login, prévia sinalizada, dados antigos preservados e recuperação disponível.');
