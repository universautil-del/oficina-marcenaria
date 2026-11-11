/* Teste do assistente integrado: medidas, prompt SketchUp e salvamento sem duplicação. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync(path.join(__dirname,'../preview-v1/universalartes-v1.js'),'utf8');
const start=src.indexOf("  // Assistente de projetos: organiza um pedido"),end=src.indexOf("  const previousRender=render;",start);
assert(start>=0&&end>start,'Assistente existente');
const code='(function(){'+src.slice(start,end)+'\nwindow.__assistantTest={assistantView};\n})();';
new vm.Script(code);
const events={};
const mk=()=>({textContent:'',value:'',disabled:true,listeners:{},addEventListener(k,fn){this.listeners[k]=fn},focus(){},select(){},add(opt){this.value=opt.value}});
const values={selectedProject:'',clientId:'c1',ambiente:'Cozinha',movel:'Balcão em L',largura:'2500',altura:'900',profundidade:'600',material:'MDF TX 15 mm',componentes:'4 gavetas',acabamento:'Amadeirado',observacoes:'Rodapé de 90 mm'};
const fields=Object.fromEntries(Object.entries(values).map(([k,v])=>[k,{value:v}]));
fields.selectedProject.add=function(option){this.value=option.value};
const form={listeners:{},elements:{namedItem:k=>fields[k]},addEventListener(k,fn){this.listeners[k]=fn},querySelector(sel){return sel==='#uaAssistantProject'?projectSelect:null}};
const projectSelect=mk();projectSelect.value='';
const nodes={uaAssistantForm:form,uaAssistantStatus:mk(),uaAssistantProject:projectSelect,
 uaAssistantOutput:mk(),uaCopyPrompt:mk(),uaMetricApply:mk(),uaMetricValue:mk(),
 uaMetricUnit:mk(),uaMetricTarget:mk(),uaMetricResult:mk(),uaSaveProject:mk(),uaAssistantContext:mk()};
nodes.uaMetricUnit.value='m';nodes.uaMetricTarget.value='largura';nodes.uaMetricValue.value='2,5';
const db={clients:[{id:'c1',nome:'Cliente Teste'}],projects:[],quotes:[],orders:[],products:[{id:'x1',tipo:'materia',codigo:'01',nome:'MDF TX 15 mm',estoque:4,unidade:'chapa'}],seq:{project:1}};
let saved=0,confirms=0;
const ctx={window:{},db,sections:[['projetos','✎','Projetos']],content:{innerHTML:''},document:{getElementById:id=>nodes[id]},
 esc:v=>String(v??'').replace(/[&<>"]/g,''),FormData:class FormData{constructor(f){this.f=f}*[Symbol.iterator](){for(const [k,v] of Object.entries(fields))yield [k,v.value]}},Option:class Option{constructor(name,value){this.text=name;this.value=value}},
 id:()=> 'project-new',save:()=>{saved++;return true},confirm:()=>{confirms++;return true},navigator:{clipboard:{writeText:async()=>{}}},Number,String,Object,Array,Error,Math};
vm.runInNewContext(code,ctx,{timeout:3000});
ctx.window.__assistantTest.assistantView();
assert(ctx.content.innerHTML.includes('Converter e preencher'));
assert(ctx.content.innerHTML.includes('Cliente vinculado'));
assert(ctx.content.innerHTML.includes('Salvar no projeto'));
assert(ctx.content.innerHTML.includes('Importar peças SketchUp'));
assert(!ctx.content.innerHTML.includes('Exportar arquivo .skp pronto'));
fields.largura.value='1600';
nodes.uaMetricApply.listeners.click();
assert.equal(fields.largura.value,'2500','Conversor deve alterar 1600 mm para 2500 mm');
assert(nodes.uaMetricResult.textContent.includes('2500')||nodes.uaMetricResult.textContent.includes('2.500'));
form.listeners.submit({preventDefault(){}});
const prompt=nodes.uaAssistantOutput.value;
assert(prompt.includes('SketchUp 2022')&&prompt.includes('Ruby'),'Descrever modelagem real no SketchUp');
assert(prompt.includes('Cliente Teste'));
assert(prompt.includes('MDF TX 15 mm'));
assert(prompt.includes('NÃO invente'));
assert.equal(saved,0,'Gerar pedido não grava sem clicar em salvar');
nodes.uaSaveProject.listeners.click();
assert.equal(saved,1,'Falha no cadastro: '+nodes.uaAssistantStatus.textContent);
assert.equal(db.projects.length,1);
assert.equal(db.projects[0].clientId,'c1');
assert.equal(db.projects[0].largura,2500);
assert.equal(fields.selectedProject.value,'project-new');
nodes.uaSaveProject.listeners.click();
assert.equal(saved,2);
assert.equal(db.projects.length,1,'Editar projeto existente não cria cópia');
assert.equal(confirms,1,'Confirmar atualização do projeto');
console.log('OK: assistente integrado a clientes, conversão mm, prompt SketchUp Ruby, projeto salvo sem duplicar.');
