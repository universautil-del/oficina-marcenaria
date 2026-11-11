/* Teste REAL de aceite Supabase (NUNCA use com contas comerciais).
   ALLOW_DISPOSABLE_CLOUD_TESTS=SIM UA_SUPABASE_URL=... UA_SUPABASE_PUBLIC_KEY=...
   UA_TEST_A_EMAIL=... UA_TEST_A_PASSWORD=... UA_TEST_B_EMAIL=... UA_TEST_B_PASSWORD=...
   node tests/supabase-live-rls.cjs
   Cria dados fictícios nas duas contas de teste e os conserva para auditoria.
   Não divulga credenciais, tokens nem conteúdo de backup no console.
*/
'use strict';
const assert=require('node:assert/strict');
const env=process.env;
if(env.ALLOW_DISPOSABLE_CLOUD_TESTS!=='SIM'){
 console.error('Testes reais desativados: usar explicitamente ALLOW_DISPOSABLE_CLOUD_TESTS=SIM somente em projeto/contas descartáveis.');
 process.exit(2);
}
const cfg=['UA_SUPABASE_URL','UA_SUPABASE_PUBLIC_KEY','UA_TEST_A_EMAIL','UA_TEST_A_PASSWORD','UA_TEST_B_EMAIL','UA_TEST_B_PASSWORD'];
for(const k of cfg)if(!env[k]){console.error('Falta variável:',k);process.exit(2)}
const base=env.UA_SUPABASE_URL.replace(/\/+$/,'');
if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(base))throw Error('URL Supabase inválida.');
if(!/^(sb_publishable_|eyJ)/.test(env.UA_SUPABASE_PUBLIC_KEY))throw Error('Use apenas chave pública do Supabase.');
if(env.UA_TEST_A_EMAIL===env.UA_TEST_B_EMAIL)throw Error('Use duas contas diferentes.');
const apiKey=env.UA_SUPABASE_PUBLIC_KEY;
async function req(path,{token,method='GET',body,prefer}={}){
 const response=await fetch(base+path,{method,headers:{
  'apikey':apiKey,'Content-Type':'application/json',
  ...(token?{Authorization:'Bearer '+token}:{}),
  ...(prefer?{Prefer:prefer}:{})
 },body:body===undefined?undefined:JSON.stringify(body)});
 const raw=await response.text();
 let data;try{data=JSON.parse(raw)}catch{data=raw}
 return {ok:response.ok,status:response.status,data};
}
async function signIn(email,password){
 const r=await req('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password}});
 assert(r.ok,'Falha na autenticação de uma conta de teste.');
 assert(r.data?.user?.id&&r.data?.access_token,'Resposta de login incompleta.');
 return {id:r.data.user.id,token:r.data.access_token};
}
const snapshot=label=>({
 version:3,clients:[{id:'teste-'+label,nome:'Cliente Fictício '+label}],products:[],quotes:[],
 orders:[],transactions:[],stockMovements:[],suppliers:[],purchases:[],
 projects:[],invoices:[],orderAttachments:[],company:{nome:'Teste isolado'},
 seq:{quote:1,order:1,purchase:1,project:1,invoice:1}
});
const rowPath=(userId,select='user_id,revision,data')=>
 '/rest/v1/universalartes_preview_backups?user_id=eq.'+encodeURIComponent(userId)+'&select='+encodeURIComponent(select);
(async()=>{
 const A=await signIn(env.UA_TEST_A_EMAIL,env.UA_TEST_A_PASSWORD);
 const B=await signIn(env.UA_TEST_B_EMAIL,env.UA_TEST_B_PASSWORD);
 console.log('Autenticação com duas contas fictícias: OK');
 const emptyA=await req(rowPath(A.id),{token:A.token});
 const emptyB=await req(rowPath(B.id),{token:B.token});
 assert(emptyA.ok&&emptyB.ok,'A tabela não está acessível. Execute o SQL de segurança.');
 assert.equal(emptyA.data.length,0,'Conta A já contém dados. Use conta de teste nova!');
 assert.equal(emptyB.data.length,0,'Conta B já contém dados. Use conta de teste nova!');
 const anon=await req(rowPath(A.id),{});
 assert(!anon.ok||Array.isArray(anon.data)&&anon.data.length===0,'Leitura anônima indevida.');
 const initA=await req('/rest/v1/rpc/ua_iniciar_documento',{token:A.token,method:'POST',body:{p_documento:snapshot('A')}});
 const initB=await req('/rest/v1/rpc/ua_iniciar_documento',{token:B.token,method:'POST',body:{p_documento:snapshot('B')}});
 assert(initA.ok&&initB.ok,'Falha ao criar registros de teste. Confira as funções SQL.');
 assert.equal(Number(initA.data),1);assert.equal(Number(initB.data),1);
 const readA=await req(rowPath(A.id),{token:A.token});
 assert(readA.ok&&readA.data.length===1);
 const aSeesB=await req(rowPath(B.id),{token:A.token});
 const bSeesA=await req(rowPath(A.id),{token:B.token});
 assert(aSeesB.ok&&bSeesA.ok,'Consulta RLS negada completamente (verifique permissão SELECT).');
 assert.equal(aSeesB.data.length,0,'ALERTA: conta A leu dados da conta B!');
 assert.equal(bSeesA.data.length,0,'ALERTA: conta B leu dados da conta A!');
 console.log('RLS SELECT com duas contas + anônimo: OK');
 const forbiddenWrite=await req(rowPath(B.id),{token:A.token,method:'PATCH',prefer:'return=representation',body:{data:snapshot('INVASAO'),revision:20}});
 assert(!forbiddenWrite.ok||forbiddenWrite.data.length===0,'ALERTA: conta A editou dados da conta B!');
 console.log('RLS UPDATE cruzado: OK');
 const before=JSON.parse(JSON.stringify(readA.data[0].data));
 const after=structuredClone(before);
 after.clients.push({id:'teste-extra',nome:'Cliente Fictício extra'});
 const update=await req('/rest/v1/rpc/ua_atualizar_documento',{token:A.token,method:'POST',body:{p_documento:after,p_revisao_esperada:1}});
 assert(update.ok&&Number(update.data)===2,'Falha ao atualizar com revisão correta.');
 const conflict=await req('/rest/v1/rpc/ua_atualizar_documento',{token:A.token,method:'POST',body:{p_documento:before,p_revisao_esperada:1}});
 assert(!conflict.ok,'ALERTA: revisão antiga sobrescreveu documento atualizado.');
 let state=await req(rowPath(A.id),{token:A.token});
 assert.equal(state.data[0].revision,2);
 assert.equal(state.data[0].data.clients.length,2);
 console.log('Conflito entre aparelhos e preservação dos registros: OK');
 const invalid=structuredClone(after);
 invalid.products=[{id:'m1',tipo:'materia',codigo:'01',estoque:-1}];
 const rejected=await req('/rest/v1/rpc/ua_atualizar_documento',{token:A.token,method:'POST',body:{p_documento:invalid,p_revisao_esperada:2}});
 assert(!rejected.ok,'ALERTA: servidor aceitou estoque negativo.');
 // Restauração em conta descartável: substituir pela versão anterior com a revisão atual.
 const restored=await req('/rest/v1/rpc/ua_atualizar_documento',{token:A.token,method:'POST',body:{p_documento:before,p_revisao_esperada:2}});
 assert(restored.ok&&Number(restored.data)===3,'Falha na recuperação dos dados fictícios.');
 state=await req(rowPath(A.id),{token:A.token});
 assert.deepEqual(state.data[0].data,before,'Restauração do documento não corresponde ao backup fictício.');
 assert.equal(state.data[0].revision,3);
 console.log('Validação de estoque e restauração do documento: OK');
 console.log('ATENÇÃO: anexos externos, Drive e operações de múltiplos colaboradores não são cobertos por este aceite.');
 console.log('Teste concluído somente no banco descartável. As duas contas de teste mantêm dados fictícios.');
})().catch(err=>{console.error('FALHA DE ACEITE:',err.message);process.exitCode=1});
