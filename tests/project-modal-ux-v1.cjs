'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const features = read('preview-v1/features-v05.js');
const sketchup = read('preview-v1/sketchup-v1.js');
const html = read('preview-v1/index.html');
const css = read('preview-v1/project-modal-ux.css');

new vm.Script(features, { filename: 'features-v05.js' });
new vm.Script(sketchup, { filename: 'sketchup-v1.js' });
assert(!sketchup.includes('O CSV não possui coluna de metros de fita'), 'Aviso obsoleto ainda presente');
assert(sketchup.includes('Nenhum preço de chapa informado.'), 'Alerta de preço necessário removido');
assert(html.includes('project-modal-ux.css'), 'Layout do formulário não carregado');
assert(css.includes('dialog.ua-project-dialog .dialog-actions'), 'Ações do modal sem estilo fixo');

const from = features.indexOf("function v5ProjectModal(pid=''){");
const to = features.indexOf('\nfunction v5DeleteProject(', from);
assert(from >= 0 && to > from, 'Função do editor não localizada');
const code = features.slice(from, to);
const old = {
 id:'proj-1', number:3, nome:'Guarda Roupas', clientId:'cli-1',
 ambiente:'Quarto', largura:2500, altura:2300, profundidade:600,
 material:'MDF TX 15 mm', acabamento:'Amadeirado', status:'desenho',
 prazo:'2026-12-10', optionA:'Portas de correr', optionB:'Portas de abrir',
 priceA:5200, priceB:4800, observacoes:'Medidas preliminares',
 checklist:[{label:'Medição',done:true},{label:'Aprovação',done:false}],
 cutlist:{filename:'lista.csv',rows:[{nome:'Lateral'}]}, image:'data:image/jpeg;base64,YWJj'
};
const db = { projects:[old], clients:[{id:'cli-1',nome:'Cliente da obra'}],seq:{project:4} };
let captured, saved=0;
const ctx = {
 db, V5_STATUS:{planejamento:'Planejamento',desenho:'Projeto',concluido:'Concluído'},
 v5FindProject:pid=>db.projects.find(p=>p.id===pid),
 esc:v=>String(v??'').replace(/&/g,'&amp;').replace(/"/g,'&quot;'),
 openModal:(head,fields,submit,after)=>{captured={head,fields,submit,after};return {}},
 id:()=> 'novo-id', round:x=>Math.round(Number(x)*100)/100,
 save:()=>{saved++;return true}
};
const edit = vm.runInNewContext(code+'\nv5ProjectModal', ctx);
edit('proj-1');
assert.equal(captured.head,'Editar projeto');
for(const name of ['nome','clientId','ambiente','largura','altura','profundidade','material','acabamento','status','prazo','etapas','optionA','optionB','priceA','priceB','observacoes'])
 assert(captured.fields.includes('name="'+name+'"'), 'Campo perdido: '+name);
assert.equal((captured.fields.match(/class="ua-project-section/g)||[]).length,5);
assert(captured.fields.includes('value="2500"'), 'Medidas existentes não carregadas');
assert(captured.fields.includes('name="optionA" value="Portas de correr"'), 'Opções existentes não carregadas');

const dlg={
 classList:{add:name=>assert.equal(name,'ua-project-dialog')},
 querySelector: selector => selector === '[data-v5-quick-client]' ? {onclick:null} :
   selector === '#v5ProjectImage' ? {addEventListener:(event,listener)=>{assert.equal(event,'change');assert.equal(typeof listener,'function')}} : null
};
captured.after(dlg);
const values={
 nome:'Guarda Roupas Atualizado',clientId:'cli-1',ambiente:'Quarto',
 largura:'2500',altura:'2300',profundidade:'600',material:'MDF TX 15 mm',
 acabamento:'Amadeirado',status:'desenho',prazo:'2026-12-10',
 etapas:'Medição\nAprovação',optionA:'Portas de correr',optionB:'Portas de abrir',
 priceA:'5200',priceB:'4800',observacoes:'Medidas revisadas'
};
assert.equal(captured.submit(values,{dataset:{}}),true);
assert.equal(saved,1);
assert.equal(db.projects[0].nome,values.nome);
assert.equal(db.projects[0].largura,2500);
assert.equal(db.projects[0].clientNome,'Cliente da obra');
assert.equal(db.projects[0].checklist[0].done,true,'Progresso do checklist não preservado');
assert.equal(db.projects[0].cutlist.filename,'lista.csv','Vínculo SketchUp perdido');
assert.equal(db.projects[0].image,old.image,'Imagem do projeto perdida');
console.log('Edição de projetos, medidas, vínculos e alerta CSV: OK');
