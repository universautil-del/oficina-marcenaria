'use strict';
/* OFICINA 1.0 — CEP brasileiro, apenas consulta do CEP público.
 * Não envia CPF, nome ou outros dados pessoais a serviços de CEP.
 * Integrado por delegação a cadastro único, cliente e fornecedor.
 */
(function(){
 const digits=v=>String(v??'').replace(/\D/g,'').slice(0,8);
 const cache=new Map(),formStates=new WeakMap();
 const fields=['uf','cidade','bairro','endereco'];
 const statusOf=form=>{
   let node=form.querySelector('[data-ua-cep-status]');
   if(node)return node;
   const cep=form.querySelector('[name="cep"]');
   if(!cep)return null;
   node=document.createElement('small');node.dataset.uaCepStatus='1';
   node.className='ua-cep-status';node.setAttribute('role','status');node.setAttribute('aria-live','polite');
   cep.closest('label')?.append(node);
   return node;
 };
 const notify=(form,message,fail=false)=>{
   const el=statusOf(form);
   if(el){el.textContent=message;el.classList.toggle('ua-cep-error',fail)}
 };
 const providers=[
   cep=>'https://viacep.com.br/ws/'+cep+'/json/',
   cep=>'https://brasilapi.com.br/api/cep/v2/'+cep
 ];
 async function lookup(cep){
   cep=digits(cep);
   if(cep.length!==8)throw Error('O CEP precisa de 8 dígitos.');
   if(cache.has(cep))return cache.get(cep);
   let lastError;
   for(let i=0;i<providers.length;i++){
     try{
       const response=await fetch(providers[i](cep),{method:'GET',headers:{Accept:'application/json'}});
       if(!response.ok)throw Error('Serviço de CEP indisponível.');
       const payload=await response.json();
       if(payload.erro||(!payload.localidade&&!payload.city))throw Error('CEP não encontrado.');
       const data={
         cidade:String(payload.localidade||payload.city||'').trim(),
         uf:String(payload.uf||payload.state||'').trim().toUpperCase(),
         bairro:String(payload.bairro||payload.neighborhood||'').trim(),
         endereco:String(payload.logradouro||payload.street||'').trim()
       };
       if(!data.cidade||!/^[A-Z]{2}$/.test(data.uf))throw Error('Endereço retornado incompleto.');
       cache.set(cep,data);
       return data;
     }catch(error){lastError=error}
   }
   throw lastError||Error('Não foi possível consultar o CEP.');
 }
 function apply(form,cep,data){
   let state=formStates.get(form);
   if(!state)state={request:0,auto:{},lastCep:''};
   const changed=state.lastCep!==cep;
   for(const name of fields){
     const el=form.querySelector('[name="'+name+'"]');
     if(!el||!data[name])continue;
     const previous=state.auto[name];
     const isBlank=!String(el.value||'').trim();
     const matchesOldAuto=previous!==undefined&&el.value===previous;
     // Cidade/UF devem acompanhar o CEP recém-informado. Rua/bairro manuais são preservados.
     if(isBlank||matchesOldAuto||(changed&&(name==='cidade'||name==='uf'))){
       el.value=data[name];state.auto[name]=data[name];
       el.dispatchEvent(new Event('change',{bubbles:true}));
     }
   }
   state.lastCep=cep;formStates.set(form,state);
   return data;
 }
 async function update(input){
   const form=input?.closest('form');if(!form)return false;
   const cep=digits(input.value);
   const state=formStates.get(form)||{request:0,auto:{},lastCep:'',timer:null};
   state.request=(state.request||0)+1;
   if(state.timer)clearTimeout(state.timer);
   formStates.set(form,state);
   if(cep.length!==8){notify(form,cep?'Informe os 8 dígitos do CEP.':'');return false}
   const requested=state.request;
   notify(form,'Consultando CEP…');
   try{
     const data=await lookup(cep);
     if(formStates.get(form)?.request!==requested||digits(input.value)!==cep)return false;
     apply(form,cep,data);
     notify(form,'Endereço encontrado: '+data.cidade+' / '+data.uf+'. Confira número e demais dados.');
     return true;
   }catch(error){
     if(formStates.get(form)?.request===requested)
       notify(form,(error?.message==='CEP não encontrado.'?'CEP não encontrado.':'Consulta indisponível. Preencha o endereço manualmente.'),true);
     return false;
   }
 }
 document.addEventListener('input',event=>{
   const target=event.target;
   if(target?.name!=='cep'||!target.closest?.('form'))return;
   const form=target.closest('form'),state=formStates.get(form)||{request:0,auto:{},lastCep:'',timer:null};
   if(state.timer)clearTimeout(state.timer);
   state.request++;
   formStates.set(form,state);
   if(digits(target.value).length===8){
     state.timer=setTimeout(()=>update(target),320);
   }else notify(form,'');
 });
 document.addEventListener('focusout',event=>{
   const target=event.target;
   if(target?.name==='cep'&&digits(target.value).length===8)update(target);
 });
 document.addEventListener('change',event=>{
   if(event.target?.name==='cep'&&digits(event.target.value).length===8)update(event.target);
 });
 window.universaArtCep={digits,lookup,apply,update};
})();
