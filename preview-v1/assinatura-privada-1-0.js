/* OFICINA 1.0 — Assinatura do responsável armazenada SOMENTE nos dados autenticados.
 * Não publica o arquivo de assinatura no GitHub Pages.
 * A imagem é apenas representação visual do responsável; não equivale a assinatura eletrônica qualificada.
 */
(function(){
 'use strict';
 const pattern=/^data:image\/(?:webp|png|jpeg);base64,[A-Za-z0-9+/=]+$/i;
 const signStored=()=>String(db.company?.assinaturaImagem||'');
 const source=()=>pattern.test(signStored())?signStored():'';
 const logoSource=()=>{
  const stored=String(db.company?.logo||'');
  return db.company?.logoPersonalizado===true&&pattern.test(stored)?stored:'assets/universa-art-logo-novo.webp';
 };
 const image=(cls='ua-document-signature')=>{
  const src=source();
  return src?'<img class="'+String(cls).replace(/[^a-z0-9_-]/gi,'')+
   '" alt="Assinatura cadastrada da UNIVERSA ART DESIGN" src="'+src+'">':'';
 };
 function refreshLogo(){
  if(!window.UNIVERSA_REQUIRE_AUTH)return;
  const src=logoSource();
  document.querySelectorAll('.ua-brand-logo,.ua-header-logo').forEach(el=>{
   if(el.getAttribute('src')!==src)el.setAttribute('src',src);
  });
 }
 function signaturePanel(){
  const preview=content.querySelector('#uaCompanyLogoPreview');
  if(!preview||content.querySelector('#uaCompanySignaturePanel'))return;
  const panel=document.createElement('section');
  panel.id='uaCompanySignaturePanel';
  panel.className='ua-company-signature-settings';
  panel.innerHTML=
   '<h3>Assinatura nos documentos</h3>'+
   '<p class="muted small">A assinatura cadastrada aparecerá na área da CONTRATADA dos contratos, pedidos e recibos. Não preenche a assinatura do cliente.</p>'+
   '<div class="actions">'+
    '<button type="button" id="uaUploadSignature" class="btn primary">Adicionar / trocar assinatura</button>'+
    '<button type="button" id="uaRemoveSignature" class="btn danger"'+(!source()?' disabled':'')+'>Remover assinatura</button>'+
   '</div>'+
   '<input id="uaSignatureInput" type="file" accept="image/png,image/jpeg,image/webp" hidden>'+
   '<div id="uaSignaturePreview" class="ua-signature-preview"></div>'+
   '<p class="muted small" id="uaSignatureStatus" role="status" aria-live="polite"></p>'+
   '<p class="muted small">A imagem fica nos seus dados autenticados da OFICINA/Supabase; não será adicionada ao repositório público do site. Confirme “Sincronizado” antes de utilizá-la no outro aparelho. A imagem impressa não substitui a assinatura de todas as partes nem a validação jurídica do documento.</p>';
  preview.after(panel);
  const imageEl=panel.querySelector('#uaSignaturePreview');
  if(source()){
   const img=document.createElement('img');img.src=source();img.alt='Assinatura da empresa cadastrada';
   imageEl.append(img);
  }else imageEl.textContent='Nenhuma assinatura cadastrada ainda.';
  if(!window.UNIVERSA_REQUIRE_AUTH){
   panel.querySelector('#uaUploadSignature').disabled=true;
   panel.querySelector('#uaSignatureStatus').textContent='Use a versão autenticada da OFICINA para salvar sua assinatura.';
  }
 }
 async function processSignature(file){
  if(!window.UNIVERSA_REQUIRE_AUTH||!window.oficinaCloud?.active)
   throw Error('Entre na OFICINA autenticada no Supabase antes de cadastrar a assinatura.');
  if(!file||!['image/png','image/jpeg','image/webp'].includes(file.type))
   throw Error('Escolha um arquivo PNG, JPG ou WebP.');
  if(file.size<=0||file.size>4_000_000)throw Error('A imagem deve ter no máximo 4 MB.');
  const url=URL.createObjectURL(file);
  let imageObj;
  try{
   imageObj=await new Promise((resolve,reject)=>{
    const img=new Image();
    img.onload=()=>resolve(img);
    img.onerror=()=>reject(Error('Não foi possível ler a imagem da assinatura.'));
    img.src=url;
   });
  }finally{URL.revokeObjectURL(url)}
  const w=imageObj.naturalWidth,h=imageObj.naturalHeight;
  if(!w||!h||w>10000||h>10000||w*h>30_000_000)
   throw Error('Dimensões inválidas para a imagem.');
  // Elimina bordas vazias do JPG da assinatura, sem tentar reconhecer quem assinou.
  const small=document.createElement('canvas');
  const scanScale=Math.min(1,700/Math.max(w,h));
  small.width=Math.max(1,Math.round(w*scanScale));
  small.height=Math.max(1,Math.round(h*scanScale));
  const scan=small.getContext('2d',{willReadFrequently:true});
  if(!scan)throw Error('Seu navegador não conseguiu preparar a assinatura.');
  scan.drawImage(imageObj,0,0,small.width,small.height);
  const pixels=scan.getImageData(0,0,small.width,small.height).data;
  let minx=small.width,miny=small.height,maxx=-1,maxy=-1;
  for(let y=0;y<small.height;y++)for(let x=0;x<small.width;x++){
   const i=(y*small.width+x)*4;
   const r=pixels[i],g=pixels[i+1],b=pixels[i+2],a=pixels[i+3];
   // Ignore bordas brancas e marcações quase invisíveis no papel.
   if(a<70||Math.min(r,g,b)>195)continue;
   if(x<minx)minx=x;if(y<miny)miny=y;if(x>maxx)maxx=x;if(y>maxy)maxy=y;
  }
  if(maxx<minx||maxy<miny)throw Error('Nenhum traço visível foi encontrado na imagem.');
  const pad=12;
  const sx=Math.max(0,(minx-pad)/scanScale),sy=Math.max(0,(miny-pad)/scanScale);
  const sw=Math.min(w-sx,(maxx-minx+2*pad+1)/scanScale);
  const sh=Math.min(h-sy,(maxy-miny+2*pad+1)/scanScale);
  const outScale=Math.min(1,650/Math.max(sw,sh)),out=document.createElement('canvas');
  out.width=Math.max(1,Math.round(sw*outScale));
  out.height=Math.max(1,Math.round(sh*outScale));
  const pen=out.getContext('2d');
  if(!pen)throw Error('Falha ao tratar a assinatura.');
  pen.fillStyle='#fff';pen.fillRect(0,0,out.width,out.height);
  pen.drawImage(imageObj,sx,sy,sw,sh,0,0,out.width,out.height);
  const data=out.toDataURL('image/webp',.84);
  if(!pattern.test(data)||data.length>130000)
   throw Error('A assinatura não pôde ser comprimida com segurança. Use uma imagem menor.');
  if(!db.company)throw Error('Dados da empresa não disponíveis.');
  const before=db.company.assinaturaImagem;
  db.company.assinaturaImagem=data;
  try{
   if(new Blob([JSON.stringify(db)]).size>1_950_000)
    throw Error('O banco está próximo do limite. Faça backup e reduza o tamanho do arquivo.');
   if(save()===false)throw Error('A assinatura não foi salva. Verifique sua conexão.');
  }catch(e){
   if(before===undefined)delete db.company.assinaturaImagem;
   else db.company.assinaturaImagem=before;
   throw e;
  }
  return data;
 }
 const previousCompanyView=companyView;
 companyView=function(){
  const r=previousCompanyView();
  const logoPreview=content.querySelector('#uaCompanyLogoPreview');
  if(logoPreview&&db.company?.logoPersonalizado!==true){
   logoPreview.innerHTML='<div class="gap-top"><img src="assets/universa-art-logo-novo.webp" alt="Nova logomarca da UNIVERSA ART" style="max-height:85px;max-width:220px;object-fit:contain"></div>';
  }
  signaturePanel();refreshLogo();return r;
 };
 const previousProcessLogo=processCompanyLogo;
 processCompanyLogo=async function(file){
  const before=db.company?.logoPersonalizado;
  if(db.company)db.company.logoPersonalizado=true;
  try{
   const result=await previousProcessLogo(file);
   if(!result&&db.company)db.company.logoPersonalizado=before;
   if(result)refreshLogo();
   return result;
  }catch(error){
   if(db.company)db.company.logoPersonalizado=before;
   throw error;
  }
 };
 const previousRender=render;
 render=function(...args){const r=previousRender(...args);refreshLogo();return r};
 document.addEventListener('click',async e=>{
  if(e.target?.id==='uaUploadSignature'){
   const input=content.querySelector('#uaSignatureInput');
   if(input){input.value='';input.click()}
  }else if(e.target?.id==='uaRemoveSignature'){
   if(!source()||!confirm('Remover a assinatura armazenada? Ela deixará de aparecer nos novos documentos.'))return;
   const prior=db.company.assinaturaImagem;
   delete db.company.assinaturaImagem;
   if(save()===false){db.company.assinaturaImagem=prior;return alert('Não foi possível remover a assinatura.')}
   signaturePanelRefresh();
  }
 });
 function signaturePanelRefresh(){
  if(location.hash.slice(1)==='empresa')companyView();
  else refreshLogo();
 }
 document.addEventListener('change',async e=>{
  if(e.target?.id!=='uaSignatureInput')return;
  const file=e.target.files?.[0],status=content.querySelector('#uaSignatureStatus');
  const button=content.querySelector('#uaUploadSignature');
  if(!file)return;
  if(button)button.disabled=true;
  if(status)status.textContent='Preparando a assinatura...';
  try{
   const data=await processSignature(file);
   const display=content.querySelector('#uaSignaturePreview');
   if(display){
    display.textContent='';
    const img=document.createElement('img');img.src=data;img.alt='Assinatura da empresa';
    display.append(img);
   }
   const remove=content.querySelector('#uaRemoveSignature');
   if(remove)remove.disabled=false;
   if(status)status.textContent='Assinatura salva. Confira o estado Sincronizado antes de imprimir em outro aparelho.';
  }catch(error){if(status)status.textContent='Falha: '+String(error?.message||error)}
  finally{if(button)button.disabled=false;e.target.value=''}
 });
 window.universaArtAssinatura={source,image,processSignature,refreshLogo,signaturePanel};
 document.addEventListener('DOMContentLoaded',refreshLogo);
})();
