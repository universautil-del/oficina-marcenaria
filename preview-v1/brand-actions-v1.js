'use strict';
/* Apresentação da marca e aplicação opcional nos documentos.
 * Preserva razão social cadastrada; somente altera db.company após clique explícito.
 */
(function(){
 const originalCompany=companyView;
 companyView=function(){
  originalCompany();
  const panel=content.querySelector('.settings-grid .panel');
  if(!panel)return;
  const div=document.createElement('section');
  div.className='ua-brand-in-settings';
  div.innerHTML='<img src="assets/universa-art-logo.webp" alt="Logomarca Universa Art">'+
    '<div><strong>Marca: UNIVERSA ART</strong><p class="muted">Esta é a logomarca enviada pela empresa. Aplicá-la aos PDFs não altera automaticamente sua razão social.</p>'+
    '<button type="button" class="btn" id="uaUseOfficialLogo">Usar esta logomarca nos documentos</button></div>';
  panel.prepend(div);
  div.querySelector('#uaUseOfficialLogo').addEventListener('click',async ()=>{
   const button=div.querySelector('#uaUseOfficialLogo');
   button.disabled=true;
   try{
    const response=await fetch('assets/universa-art-logo.webp',{cache:'no-store'});
    if(!response.ok)throw Error('Não foi possível carregar a imagem da empresa.');
    const blob=await response.blob();
    if(blob.size>300000||blob.type!=='image/webp')throw Error('O arquivo da marca não é válido.');
    const uri=await new Promise((resolve,reject)=>{
      const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Falha ao ler imagem.'));reader.readAsDataURL(blob);
    });
    if(!/^data:image\/webp;base64,[A-Za-z0-9+/=]+$/.test(uri))throw Error('Formato não suportado.');
    const previous=db.company.logo;
    db.company.logo=uri;
    if(save()===false){db.company.logo=previous;throw Error('Sem espaço para salvar a logomarca no navegador.')}
    companyView();
    alert('Logomarca UNIVERSA ART aplicada aos documentos da empresa.');
   }catch(error){alert(error.message||'Não foi possível aplicar a logomarca.')}
   finally{button.disabled=false}
  });
 };
})();
