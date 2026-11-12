/* node tests/sketchup-project-bridge-v1.cjs */
'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const source=read('preview-v1/project-sketchup-bridge.js'),html=read('preview-v1/index.html');
new vm.Script(source,{filename:'project-sketchup-bridge.js'});
assert(html.includes('project-sketchup-bridge.js')&&html.includes('project-sketchup-bridge.css'));
assert(html.indexOf('project-sketchup-bridge.js')>html.indexOf('sketchup-v1.js'));
const features=read('preview-v1/features-v05.js'),skp=read('preview-v1/sketchup-v1.js');
assert(features.includes('ua-cutlist-open')&&features.includes('ua-cutlist-view'));
assert(features.includes('Importar SketchUp'));
assert(skp.includes('window.universaArtProjectBridge?.panel?.()'));
const up=read('preview-v1/upgrade.js'),base=read('preview-v1/script.js');
assert(base.includes("['compras','▥','Entrada de Materiais']"));
assert(up.includes("invoice?'Conferir entrada da NF")&&up.includes(":'Nova entrada de materiais'"),'Entrada de Materiais deve manter título normal e permitir NF vinculada');
assert(up.includes("button('Confirmar entrada','receive-purchase'"));
assert(up.includes("p.status='recebida'"));
assert(up.includes("const account={id:id(),kind:'pagar',purchaseId:pur.id"));
const db={projects:[],clients:[{id:'c1',nome:'Cliente Fictício'}],products:[{id:'m1',estoque:20}],
 transactions:[{id:'t1',valor:100}],orders:[{id:'o1'}],stockMovements:[],seq:{project:1}};
const state={file:'CutList Cozinha.csv',parts:[
 {code:'P01',name:'Lateral',length:900,width:600,thickness:15,qty:2,material:'MDF Branco',edge:0},
 {code:'P02',name:'Prateleira',length:850,width:550,thickness:15,qty:3,material:'MDF Branco',edge:0.85}
]};
let nextId=0,saved=0,shouldFail=false,confirmed=0,exported=null,listeners={},lastModal=null;
const context={
 db,window:{universalartesSketchUp:{state,makeParts:()=>state.parts}},
 document:{addEventListener:(event,fn)=>{listeners[event]=fn}},
 TextEncoder,Date,JSON,Map,Number,Math,String,Error,
 id:()=> 'prj-'+(++nextId),save:()=>{saved++;return !shouldFail},
 confirm:()=>{confirmed++;return true},
 esc:value=>String(value??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])),
 dec:x=>String(x),alert:msg=>{throw Error(msg)},location:{hash:'#projetos'},render:()=>{},
 content:{querySelector:()=>null},
 button:(label,a,item)=>'<button data-action="'+a+'" data-id="'+item+'">'+label+'</button>',
 td:(...cells)=>'<tr>'+cells.map(c=>'<td>'+c+'</td>').join('')+'</tr>',
 table:(h,rows)=>'<table>'+rows.join('')+'</table>',
 openModal:(title,html)=>{lastModal={title,html}},
 exportCsv:(filename,headers,rows)=>{exported={filename,headers,rows}}
};
vm.runInNewContext(source,context,{timeout:1500});
const bridge=context.window.universaArtProjectBridge;
assert(bridge?.cutlistFromImporter&&bridge?.newProjectFromCutlist);
const snap=bridge.cutlistFromImporter();
assert.equal(snap.summary.pecas,5);
assert.equal(snap.summary.tipos,2);
assert.equal(snap.summary.areaM2,2.4825);
assert.equal(snap.reviewStatus,'pendente');
assert.equal(snap.sourceUnits,'mm');
assert.equal(snap.parts[0].length,900);
const beforeBusiness=JSON.stringify({products:db.products,transactions:db.transactions,stockMovements:db.stockMovements,orders:db.orders});
const project=bridge.newProjectFromCutlist('Cozinha de teste','c1',snap);
assert.equal(project.number,1);
assert.equal(project.status,'desenho');
assert.equal(project.clientNome,'Cliente Fictício');
assert.deepEqual([project.largura,project.altura,project.profundidade],[0,0,0]);
assert.equal(db.projects.length,1);
assert.equal(db.seq.project,2);
assert.equal(JSON.stringify({products:db.products,transactions:db.transactions,stockMovements:db.stockMovements,orders:db.orders}),beforeBusiness);
assert.throws(()=>bridge.saveLinked(project.id,snap),/já está vinculada/);
assert.equal(db.projects.length,1);
assert.equal(confirmed,0);
state.parts=state.parts.map(p=>({...p}));state.parts[0].qty=4;
const updated=bridge.cutlistFromImporter();
assert.equal(updated.summary.pecas,7);
assert.equal(bridge.saveLinked(project.id,updated),true);
assert.equal(confirmed,1);
assert.equal(db.projects[0].cutlistHistory.length,1);
assert.equal(db.projects[0].cutlistHistory[0].summary.pecas,5);
assert.equal(db.projects[0].cutlist.summary.pecas,7);
assert.equal(db.seq.project,2);
bridge.projectListModal(project.id);
assert(lastModal.title.includes('Cozinha de teste'));
assert(lastModal.html.includes('MDF Branco'));
assert(lastModal.html.includes('Exportar peças CSV'));
bridge.exportCutlist(project.id);
assert(exported.filename.endsWith('-lista-pecas.csv'));
assert.equal(exported.rows.length,2);
assert.equal(exported.rows[0][5],4);
const oldProjects=db.projects;
state.parts[0].qty=5;
const candidate=bridge.cutlistFromImporter();
shouldFail=true;
assert.throws(()=>bridge.saveLinked(project.id,candidate),/Falha ao salvar/);
assert.equal(db.projects,oldProjects);
assert.equal(db.projects[0].cutlist.summary.pecas,7);
const n=db.seq.project;
assert.throws(()=>bridge.newProjectFromCutlist('Armário de teste','',candidate),/Falha ao salvar/);
assert.equal(db.seq.project,n);
assert.equal(db.projects,oldProjects);
shouldFail=false;
state.file='Outra lista.csv';
state.parts=[{code:'P03',name:'Fundo',length:800,width:600,thickness:0,qty:1,material:'Material não definido',edge:0}];
const missing=bridge.cutlistFromImporter();
assert(missing.summary.issues.length===2);
assert.throws(()=>bridge.newProjectFromCutlist('AB','',missing),/pelo menos 3/);
assert.throws(()=>bridge.newProjectFromCutlist('Cliente inexistente','err',missing),/cliente selecionado/);
assert.equal(JSON.stringify({products:db.products,transactions:db.transactions,stockMovements:db.stockMovements,orders:db.orders}),beforeBusiness);
assert(saved>=4);
console.log('OK: SketchUp integrado a Projeto; histórico, duplicatas, MM, rollback, cliente e estoque/financeiro intactos.');
