/* CEP automático sem Supabase nem dados pessoais reais. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const js=fs.readFileSync(path.join(__dirname,'../preview-v1/cep-autofill-v1.js'),'utf8');
new vm.Script(js);
const listeners={};let calls=[];
const fetch=async url=>{
  calls.push(String(url));
  const cep=String(url).match(/(\d{8})/)?.[1];
  if(cep==='99999999')return {ok:true,json:async()=>({erro:true})};
  if(cep==='01001000')return {ok:true,json:async()=>({cep:'01001-000',logradouro:'Praça da Sé',bairro:'Sé',localidade:'São Paulo',uf:'SP'})};
  return {ok:true,json:async()=>({erro:true})};
};
const context={window:{},document:{addEventListener(type,fn){listeners[type]=fn}},fetch,
  Map,WeakMap,String,Error,Promise,setTimeout,clearTimeout,
  Event:class Event{constructor(type,args){this.type=type;this.bubbles=args?.bubbles}}};
vm.runInNewContext(js,context);
const api=context.window.universaArtCep;
assert.equal(api.digits('04880-130'),'04880130');
(async()=>{
 const r=await api.lookup('01001-000');assert.equal(r.cidade,'São Paulo');assert.equal(r.uf,'SP');
 assert.equal(calls.length,1);
 assert.equal((await api.lookup('01001000')).bairro,'Sé','CEP cacheado sem requisição repetida');
 assert.equal(calls.length,1);
 const inputs=Object.fromEntries(['uf','cidade','bairro','endereco','numero','cep'].map(x=>[x,{name:x,value:'',dispatchEvent(){}}]));
 inputs.cep.value='01001-000';
 inputs.numero.value='25';
 inputs.bairro.value='Bairro digitado manualmente';
 const note={textContent:'',classList:{toggle(){}}};
 const form={querySelector(q){if(q==='[data-ua-cep-status]')return note;const field=q.match(/^\[name="([^"]+)"\]$/);return field?inputs[field[1]]:null}};
 for(const v of Object.values(inputs))v.closest=()=>form;
 const ok=await api.update(inputs.cep);
 assert.equal(ok,true);
 assert.equal(inputs.cidade.value,'São Paulo');
 assert.equal(inputs.uf.value,'SP');
 assert.equal(inputs.endereco.value,'Praça da Sé');
 assert.equal(inputs.bairro.value,'Bairro digitado manualmente','Preservar bairro preenchido pelo usuário');
 assert.equal(inputs.numero.value,'25','Não sobrescrever número manual');
 assert(note.textContent.includes('São Paulo / SP'));
 inputs.cep.value='99999-999';
 assert.equal(await api.update(inputs.cep),false,'CEP inexistente não apaga dados antigos');
 assert.equal(inputs.cidade.value,'São Paulo');
 assert.equal(inputs.numero.value,'25');
 assert(listeners.input&&listeners.focusout&&listeners.change);
 console.log('OK: CEP valida, consulta, preenche UF/cidade/rua, preserva campos manuais, cache e erro sem apagar dados.');
})().catch(e=>{console.error(e);process.exitCode=1});
