'use strict';
/* Universa Art — melhorias da versão 1.2.
 * A razão social preexistente nunca é alterada automaticamente; a confirmação
 * do usuário é necessária para mudanças que afetam PDFs e contratos.
 * Mantenha o alerta de homologação até RLS e backups serem testados de verdade.
 */
(function(){
  const previousCompanyView=companyView;
  const previousCompanySave=companySave;
  const LEGACY_NAME='universalartes';
  const BRAND_NAME='UNIVERSA ART';
  function trim(value){return String(value??'').trim()}
  function styleCompanyPanel(){
    const settings=content.querySelector('.settings-grid');
    if(!settings)return;
    const identity=settings.querySelector('.panel');
    const coName=identity?.querySelector('#coNome');
    if(!coName)return;
    const c=db.company||{};
    const fantasia=trim(c.nomeFantasia)||BRAND_NAME;

    const identityIntro=document.createElement('section');
    identityIntro.className='ua-release-intro';
    identityIntro.innerHTML='<h3>Configurações da Universa Art · versão '+(window.UNIVERSA_REQUIRE_AUTH?'1.0':'1.2')+'</h3>'+
      (window.UNIVERSA_REQUIRE_AUTH?'<p>Seu acesso usa a conta Supabase configurada neste aparelho. Confira a situação da sincronização e teste a recuperação do backup antes de operar com dados reais.</p>':'<p>Esta é a prévia de testes. Confira os cadastros e proteja os dados. Os registros permanecem neste navegador até conectar e validar o Supabase.</p>')+
      '<div class="ua-release-links"><a href="#backupdrive">Backup criptografado Google Drive</a>'+
      '<a href="#seguranca">Conferir segurança</a><a href="#sketchup">Testar importação SketchUp</a></div>';
    settings.before(identityIntro);

    const row=coName.closest('label');
    if(row){
      for(const node of row.childNodes){
        if(node.nodeType===3&&node.textContent.trim()){
          node.textContent='Razão social / Nome nos contratos';
          break;
        }
      }
      const wrapper=document.createElement('section');
      wrapper.className='ua-fantasia-field';
      const label=document.createElement('label');
      label.setAttribute('for','coFantasia');
      label.textContent='Nome fantasia exibido no sistema';
      const input=document.createElement('input');
      input.id='coFantasia';input.name='nomeFantasia';input.maxLength=120;input.value=fantasia;
      input.setAttribute('autocomplete','organization');
      label.append(input);
      const note=document.createElement('p');
      note.textContent='A marca visual é UNIVERSA ART. A razão social acima é utilizada em contratos, recibos e outros documentos; confirme o nome legal antes de salvar.';
      wrapper.append(label,note);
      row.after(wrapper);
      if(trim(c.nome).toLowerCase()===LEGACY_NAME){
        const warning=document.createElement('div');
        warning.className='ua-legacy-identity';
        const p=document.createElement('p');
        p.textContent='O cadastro antigo ainda guarda “Universalartes” como nome para documentos. Você pode substituí-lo se o nome correto for “UNIVERSA ART”.';
        const btn=document.createElement('button');
        btn.type='button';btn.className='btn';btn.dataset.uaUseBrandName='1';
        btn.textContent='Preencher nome UNIVERSA ART';
        warning.append(p,btn);
        wrapper.after(warning);
      }
    }

    const backupSection=[...content.querySelectorAll('.panel')].find(p=>p.querySelector('h3')?.textContent?.trim()==='Backup e restauração');
    if(backupSection){
      const firstDescription=backupSection.querySelector('p.muted');
      if(firstDescription)firstDescription.textContent='Cópias simples em JSON são úteis para testes, mas NÃO são criptografadas. Para proteger informações comerciais, prefira o backup criptografado.';
      const recommended=document.createElement('div');
      recommended.className='ua-backup-recommended';
      recommended.innerHTML='<strong>Backup recomendado: Google Drive criptografado</strong>'+
       '<p>Crie uma senha forte, salve uma cópia segura em seu computador ou envie ao Google Drive após autorizar a sua conta.</p>'+
       '<a href="#backupdrive">Abrir Backup Google Drive</a>';
      const actions=backupSection.querySelector('.actions');
      if(actions){
        backupSection.insertBefore(recommended,actions);
        const rawExport=actions.querySelector('[data-action="backup"]');
        if(rawExport){rawExport.textContent='Baixar JSON local (sem senha)';rawExport.classList.remove('primary')}
        const importAction=actions.querySelector('[data-action="import"]');
        if(importAction)importAction.textContent='Importar JSON local';
      }else backupSection.append(recommended);
      const warning=document.createElement('p');
      warning.className='ua-backup-insecure';
      warning.textContent='Não armazene JSON sem criptografia com dados reais de clientes em pastas compartilhadas. Restaurações devem ser testadas primeiro com dados fictícios.';
      backupSection.append(warning);
    }
  }
  companyView=function companyView12(){
    previousCompanyView();
    styleCompanyPanel();
  };
  companySave=function saveCompany12(){
    const fantasia=trim(content.querySelector('#coFantasia')?.value)||BRAND_NAME;
    const legal=trim(content.querySelector('#coNome')?.value);
    if(!legal)throw Error('Preencha o nome ou razão social para documentos.');
    if(fantasia.length>120)throw Error('Nome fantasia muito longo.');
    // companySave original grava a razão social e chama save().
    const oldFantasia=db.company.nomeFantasia;
    db.company.nomeFantasia=fantasia;
    try{return previousCompanySave()}
    catch(e){db.company.nomeFantasia=oldFantasia;throw e}
  };
  document.addEventListener('click',e=>{
    const btn=e.target.closest?.('[data-ua-use-brand-name]');
    if(!btn)return;
    const target=content.querySelector('#coNome');
    if(!target)return;
    if(!confirm('Usar UNIVERSA ART como nome dos documentos? Confira se corresponde à razão social da empresa. A alteração só será gravada ao clicar em Salvar dados.'))return;
    target.value=BRAND_NAME;target.focus();
    btn.textContent='Nome preenchido — agora clique em Salvar dados';
    btn.disabled=true;
  });

  window.universaArtRelease12={styleCompanyPanel,brand:BRAND_NAME};
})();