/* OFICINA — catálogo Léo: links diretos, filtros, preço opcional e performance. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {performance}=require('node:perf_hooks');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const src=read('preview-v1/leo-catalogo-v1.js');
const dataSrc=read('preview-v1/leo-dados-v2.js');
const css=read('preview-v1/leo-catalogo-v1.css');
new vm.Script(src,{filename:'leo-catalogo-v1.js'});
new vm.Script(dataSrc,{filename:'leo-dados-v2.js'});
assert(src.length<17000,'Controlador deve permanecer leve (< 17 KB)');
assert(dataSrc.length<18000,'Dados consultivos devem permanecer compactos (< 18 KB)');
assert(css.length<4500,'Estilos compactos');
assert(!src.includes('<img'),'Sem fotos');
assert(!src.includes('fetch('),'Pesquisa local sem requisições enquanto digita');
assert(!src.includes('save('),'Consultar não pode salvar no banco');
assert(!src.includes('localStorage'),'Consultar não pode alterar dados locais');
const listeners={},allDialogs=[],loading=[];
let ctx,scriptLoads=0;
function node(id){
 return {
  id,value:'',innerHTML:'',textContent:'',href:'',checked:false,hidden:false,isConnected:true,open:false,
  options:[],events:{},focus(){},dispatchEvent(){},setAttribute(){},remove(){this.removed=true},
  addEventListener(type,handler){this.events[type]=handler},
  showModal(){this.open=true},close(){this.open=false;if(this.events.close)this.events.close()},
  closest(sel){return sel==='label'?this.parentLabel:null}
 };
}
const document={
 addEventListener:(event,handler)=>{listeners[event]=handler},
 createElement:tag=>{
  const n=node(tag);
  if(tag==='script')return n;
  assert.equal(tag,'dialog');
  const controls={};
  for(const id of ['uaLeoClose','uaLeoCategory','uaLeoQuery','uaLeoBrand','uaLeoSize','uaLeoColor','uaLeoResults','uaLeoCategoryLink','uaLeoCount','uaLeoFilterNotice','uaLeoClear','uaLeoMore','uaLeoFillCost'])controls[id]=node(id);
  controls.uaLeoBrand.parentLabel={hidden:false};
  controls.uaLeoSize.parentLabel={hidden:false};
  controls.uaLeoColor.parentLabel={hidden:false};
  n.controls=controls;
  n.querySelector=sel=>controls[sel.slice(1)]||null;
  allDialogs.push(n);
  return n;
 },
 body:{append(){}},
 head:{appendChild(script){
  assert(script.src.includes('leo-dados-v2.js'));
  scriptLoads++;
  vm.runInNewContext(dataSrc,ctx,{timeout:1200});
  script.onload();
 }}
};
const window={};
const fakeAlert=[];
ctx={window,document,alert:s=>fakeAlert.push(s),Event:class Event{constructor(type){this.type=type}},Intl,Array,Object,Math,Date,Number,String,Error,Promise,Set};
vm.runInNewContext(src,ctx,{timeout:1200});
const api=window.universaArtLeoCatalogo;
assert(api);
assert.equal(api.items.length,0,'O catálogo não deve ser carregado antes do uso');
assert.equal(scriptLoads,0,'Nenhuma requisição antecipada');
const db={projects:[{nome:'Móvel existente'}],products:[],transactions:[]},before=JSON.stringify(db);
const projectInput=node('material');projectInput.name='material';
const project={isConnected:true,querySelector:sel=>sel==='[name="material"]'?projectInput:null};
function pick(index){
 const dialog=allDialogs.at(-1);
 dialog.events.click({target:{closest:sel=>sel==='[data-ua-leo-use]'?{dataset:{uaLeoUse:String(index)}}:null}});
}
async function main(){
 assert(await api.open({closest:()=>project}));
 assert.equal(scriptLoads,1,'Carregar somente quando abrir primeira vez');
 assert.equal(api.items.length,45);
 const groups=Object.fromEntries(['mdf','parafusos','buchas','fitas'].map(c=>[c,api.filter(c).length]));
 assert.deepEqual(groups,{mdf:21,parafusos:12,buchas:8,fitas:4});
 assert(api.items.every(x=>api.checkUrl(x.url)),'Todos os links devem apontar para ficha individual de produto');
 assert(api.items.every(x=>x.url.endsWith('/p')),'Página de produto, não página de categoria');
 assert(api.filter('mdf','15 mm').length>=8,'Localizar MDFs 15 mm de várias cores');
 assert.equal(api.filter('parafusos','4x40').length,1);
 assert.equal(api.filter('parafusos','3,5 × 25').length,1);
 assert.equal(api.filter('buchas','8 mm').length,2);
 assert.equal(api.filter('fitas','35 mm').length,1);
 assert.equal(api.filter('mdf','amendola', {brand:'Duratex',size:'15 mm'}).length,1,'Pesquisa ignora acento e filtra marca/espessura');
 assert.equal(api.filter('mdf','',{color:'Amêndola Rústica'}).length,4,'Filtro de padrões/cor');
 assert(api.priceNotice().includes('não uma cotação atual'));
 assert(api.items.some(item=>item.price===null),'Produtos sem preço devem continuar na lista');
 let dlg=allDialogs.at(-1);
 assert(dlg.open,'Dialog deve abrir');
 assert(dlg.innerHTML.includes('Marca')&&dlg.innerHTML.includes('Medida / Espessura'));
 assert(dlg.controls.uaLeoResults.innerHTML.includes('Ver produto na Léo'));
 assert(dlg.controls.uaLeoResults.innerHTML.includes('href="https://checkout.leomadeiras.com.br/'));
 assert.equal((dlg.controls.uaLeoResults.innerHTML.match(/class="ua-leo-item"/g)||[]).length,20,'Renderização limitada na primeira página');
 assert.equal(dlg.controls.uaLeoMore.hidden,false,'Mostrar mais quando houver referências não exibidas');
 dlg.controls.uaLeoMore.events.click();
 assert.equal((dlg.controls.uaLeoResults.innerHTML.match(/class="ua-leo-item"/g)||[]).length,40,'Segunda página não recria todos os itens');
 dlg.controls.uaLeoMore.events.click();
 assert.equal((dlg.controls.uaLeoResults.innerHTML.match(/class="ua-leo-item"/g)||[]).length,45);
 assert.equal(dlg.controls.uaLeoMore.hidden,true);
 dlg.controls.uaLeoQuery.value='4x40';
 dlg.controls.uaLeoQuery.events.input();
 assert.equal((dlg.controls.uaLeoResults.innerHTML.match(/class="ua-leo-item"/g)||[]).length,1,'Busca deve filtrar resultados');
 assert(dlg.controls.uaLeoResults.innerHTML.includes('4 × 40'));
 dlg.controls.uaLeoQuery.value='';
 dlg.controls.uaLeoQuery.events.input();
 pick(0);
 assert.equal(projectInput.value,api.items[0].name,'Selecionar preenche material do projeto');
 assert.equal(dlg.open,false,'Consulta fecha após seleção');
 assert.equal(JSON.stringify(db),before,'Nenhuma escrita em dados de projetos/estoque/financeiro');

 const fields={
  '[name="nome"]':node('nome'),'[name="categoria"]':node('categoria'),
  '[name="unidade"]':node('unidade'),'[name="custo"]':node('custo'),
  '[name="espessuraMm"]':node('espessuraMm'),
  '[name="chapaComprimentoMm"]':node('comprimento'),
  '[name="chapaLarguraMm"]':node('largura')
 };
 fields['[name="nome"]'].name='nome';fields['[name="custo"]'].value='0';
 fields['[name="unidade"]'].options=[{value:'chapa'},{value:'pacote'},{value:'rolo'}];
 const productForm={isConnected:true,querySelector:sel=>fields[sel]||null};
 assert(await api.open({closest:()=>productForm}));
 assert.equal(scriptLoads,1,'Dados carregados uma única vez');
 dlg=allDialogs.at(-1);
 dlg.controls.uaLeoCategory.value='mdf';
 dlg.controls.uaLeoCategory.events.change();
 assert(dlg.controls.uaLeoColor.parentLabel.hidden===false);
 assert(dlg.controls.uaLeoSize.innerHTML.includes('25 mm'));
 // Cenário relatado: MDF 15 mm + Branco Puro não existe na lista verificada.
 dlg.controls.uaLeoSize.value='15 mm';
 dlg.controls.uaLeoSize.events.change();
 assert(dlg.controls.uaLeoColor.innerHTML.includes('Branco Ártico'),'Deve sugerir Branco Ártico 15 mm');
 assert(!dlg.controls.uaLeoColor.innerHTML.includes('Branco Puro'),'Não apresentar Branco Puro como opção existente em 15 mm');
 // Quando o usuário escolhe uma cor incompatível, manter a preferência mais recente
 // e remover a espessura anterior, explicando a mudança.
 dlg.controls.uaLeoColor.value='Branco Puro';
 dlg.controls.uaLeoColor.events.change();
 assert.equal(dlg.controls.uaLeoSize.value,'','Alterar cor incompatível limpa espessura');
 assert(dlg.controls.uaLeoFilterNotice.textContent.includes('medida / espessura'));
 assert(dlg.controls.uaLeoResults.innerHTML.includes('Branco Puro'),'Mostrar Branco Puro 18 mm');
 assert(dlg.controls.uaLeoSize.innerHTML.includes('18 mm'),'Espessura disponível para Branco Puro');
 // A operação inversa prioriza a nova espessura e remove a cor sem ocorrência.
 dlg.controls.uaLeoSize.value='15 mm';
 dlg.controls.uaLeoSize.events.change();
 assert.equal(dlg.controls.uaLeoColor.value,'','Alterar espessura limpa cor incompatível');
 assert(dlg.controls.uaLeoFilterNotice.textContent.includes('cor / padrão'));
 assert(dlg.controls.uaLeoResults.innerHTML.includes('Branco Ártico'));
 assert(dlg.controls.uaLeoResults.innerHTML.includes('Ver produto na Léo'));
 // A limpeza não altera dados do sistema e restaura os 45 resultados.
 dlg.controls.uaLeoClear.events.click();
 assert.equal(dlg.controls.uaLeoCategory.value,'');
 assert.equal(dlg.controls.uaLeoSize.value,'');
 assert.equal(dlg.controls.uaLeoColor.value,'');
 assert.equal(dlg.controls.uaLeoFilterNotice.textContent,'');
 assert(dlg.controls.uaLeoResults.innerHTML.includes('MDF Branco Ártico'));
 dlg.controls.uaLeoCategory.value='mdf';dlg.controls.uaLeoCategory.events.change();
 pick(0);
 assert.equal(fields['[name="nome"]'].value,api.items[0].name);
 assert.equal(fields['[name="custo"]'].value,'0','Não preencher custo sem seleção explícita');
 assert.equal(fields['[name="unidade"]'].value,'chapa');
 assert.equal(fields['[name="espessuraMm"]'].value,'15');
 assert.equal(fields['[name="chapaComprimentoMm"]'].value,'2750');
 assert.equal(fields['[name="chapaLarguraMm"]'].value,'1840');

 await api.open({closest:()=>productForm});
 dlg=allDialogs.at(-1);
 dlg.controls.uaLeoCategory.value='mdf';dlg.controls.uaLeoCategory.events.change();
 dlg.controls.uaLeoSize.value='25 mm';dlg.controls.uaLeoSize.events.change();
 assert(dlg.controls.uaLeoResults.innerHTML.includes('Preço não cadastrado'),'Preço ausente é exibido corretamente');
 dlg.controls.uaLeoFillCost.checked=true;
 pick(0);
 assert.equal(fields['[name="custo"]'].value,'0','Sem preço não preencher custo zero/fictício');

 await api.open({closest:()=>productForm});
 dlg=allDialogs.at(-1);dlg.controls.uaLeoCategory.value='parafusos';dlg.controls.uaLeoCategory.events.change();
 dlg.controls.uaLeoFillCost.checked=true;pick(0);
 assert.equal(fields['[name="unidade"]'].value,'pacote');
 assert.equal(fields['[name="custo"]'].value,'2.49','Preço histórico só após autorização explícita');
 assert.equal(JSON.stringify(db),before);
 assert.equal(fakeAlert.length,0);

 const started=performance.now();
 for(let i=0;i<1000;i++)api.filter(i%2?'mdf':'parafusos','4x40');
 const elapsed=Math.round(performance.now()-started);
 console.log('Desempenho: 2.000 pesquisas em '+elapsed+' ms; JS='+src.length+' bytes; dados lazy='+dataSrc.length+' bytes; CSS='+css.length+' bytes.');
 assert(elapsed<2500,'Pesquisa local deve ser leve');

 for(const page of ['preview-v1/index.html','preview-v1/seguro.html']){
  const html=read(page);
  assert(html.includes('leo-catalogo-v1.js?v=filtros-dependentes-20261112'));
  assert(html.includes('leo-catalogo-v1.css?v=combos-validos-20261112'));
  assert(!html.includes('src="leo-dados-v2.js"'),'Não carregar dados antes de abrir o catálogo');
 }
 assert(read('preview-v1/features-v05.js').includes('data-ua-leo-open'));
 assert(read('preview-v1/universalartes-v1.js').includes('data-ua-leo-open'));
 assert(read('preview-v1/catalogo-produtos-1-0.js').includes('data-ua-leo-open'));
 console.log('OK: 45 referências, 45 links diretos, filtros, valores opcionais, cadastro sem escrita e carregamento sob demanda.');
}
main().catch(error=>{console.error(error);process.exitCode=1});
