/* Universa Art — regressão da interface de homologação 1.2.
 * node tests/release-v1-2.cjs
 */
'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const html=read('preview-v1/index.html'),css=read('preview-v1/release-v1-2.css');
const script=read('preview-v1/release-v1-2.js'),cloud=read('preview-v1/cloud-preview.js');
new vm.Script(script);new vm.Script(cloud);
assert(html.includes('Oficina 1.2'));
assert(html.includes('role="status" class="ua-release-alert"'));
assert(html.includes('Versão de homologação'));
assert(html.includes('release-v1-2.js'));
assert(html.includes('release-v1-2.css'));
assert(!html.includes('PRÉVIA 1.0'));
assert(css.includes('.ua-fantasia-field')&&css.includes('.ua-release-alert'));
assert(cloud.includes('Nuvem e login · Universa Art 1.2'));
assert(cloud.includes('authForm.hidden=true'),'Campos de senha não devem aparecer antes da configuração');
assert(cloud.includes('isPublicKey(key)'),'Bloquear chaves de servidor no navegador');
assert(cloud.includes('panel()'),'Manter login funcional no projeto');

class FakeElement{
 constructor(tag){this.tagName=tag;this.children=[];this.childNodes=[];this.dataset={};this.textContent='';this.value='';this.disabled=false;this.innerHTML='';this.className=''}
 append(...nodes){this.children.push(...nodes)}
 prepend(...nodes){this.children.unshift(...nodes)}
 after(...nodes){this.afterNodes=(this.afterNodes||[]).concat(nodes)}
 before(...nodes){this.beforeNodes=(this.beforeNodes||[]).concat(nodes)}
 insertBefore(node,other){this.inserted=node}
 setAttribute(k,v){this[k]=v}
 querySelector(){return null}
}
const db={company:{nome:'Universalartes',nomeFantasia:'',logo:''}};
const coName=new FakeElement('input');coName.id='coNome';coName.value=db.company.nome;coName.focus=()=>{};
const row=new FakeElement('label');row.childNodes=[{nodeType:3,textContent:'Nome / Razão social'}];
coName.closest=()=>row;
const identity=new FakeElement('section');identity.querySelector=s=>s==='#coNome'?coName:null;
const settings=new FakeElement('section');settings.querySelector=s=>s==='.panel'?identity:null;
const backupSection=new FakeElement('section');
const label=new FakeElement('h3');label.textContent='Backup e restauração';
const desc=new FakeElement('p');desc.textContent='JSON';
const backupBtn=new FakeElement('button');backupBtn.textContent='Exportar backup completo';backupBtn.classList={remove(){}};
const importBtn=new FakeElement('button');
const actions=new FakeElement('div');actions.querySelector=s=>s==='[data-action="backup"]'?backupBtn:s==='[data-action="import"]'?importBtn:null;
backupSection.querySelector=s=>s==='h3'?label:s==='p.muted'?desc:s==='.actions'?actions:null;
const panel=new FakeElement('div');
const content={
 querySelector:s=>s==='.settings-grid'?settings:s==='#coNome'?coName:s==='#coFantasia'?panel:null,
 querySelectorAll:s=>s==='.panel'?[backupSection]:[]
};
const listeners={};let originalViews=0,originalSaves=0,confirmed=0;
const ctx={
 db,content,companyView(){originalViews++},
 companySave(){originalSaves++;db.company.nome=coName.value;return true},
 document:{createElement:tag=>new FakeElement(tag),addEventListener:(event,callback)=>{listeners[event]=callback}},
 window:{},confirm(){confirmed++;return true},Error,String
};
vm.runInNewContext(script,ctx,{timeout:2000});
ctx.companyView();
assert.equal(originalViews,1);
assert.equal(row.childNodes[0].textContent,'Razão social / Nome nos contratos');
assert.equal(settings.beforeNodes.length,1,'Mostrar atalhos para checagem e Drive');
assert.equal(row.afterNodes.length,1,'Mostrar campo separado para nome fantasia');
assert.equal(row.afterNodes[0].children.length,2);
assert.equal(panel.value,'','O teste não injeta dados pessoais automaticamente');
assert.equal(row.afterNodes[0].children[0].children[0].value,'UNIVERSA ART');
assert.equal(desc.textContent.includes('NÃO são criptografadas'),true);
assert.equal(backupBtn.textContent,'Baixar JSON local (sem senha)');
assert.equal(importBtn.textContent,'Importar JSON local');
assert.equal(backupSection.inserted.className,'ua-backup-recommended');
assert.equal(db.company.nome,'Universalartes','Não alterar razão social legada automaticamente');
panel.value='UNIVERSA ART';
assert.equal(ctx.companySave(),true);
assert.equal(db.company.nomeFantasia,'UNIVERSA ART');
assert.equal(db.company.nome,'Universalartes');
assert.equal(originalSaves,1);
coName.value='';
assert.throws(()=>ctx.companySave(),/razão social/);
coName.value='Universalartes';
const button={dataset:{uaUseBrandName:'1'},disabled:false};
listeners.click({target:{closest:s=>s==='[data-ua-use-brand-name]'?button:null}});
assert.equal(confirmed,1);
assert.equal(coName.value,'UNIVERSA ART');
assert.equal(db.company.nome,'Universalartes','Mudança de nome só salva após confirmação');
assert.equal(button.disabled,true);
ctx.companySave();
assert.equal(db.company.nome,'UNIVERSA ART');
console.log('OK: interface 1.2, nome fantasia preservado, alteração de razão social explícita e backup criptografado em destaque.');
