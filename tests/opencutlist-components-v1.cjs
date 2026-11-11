'use strict';
/* node tests/opencutlist-components-v1.cjs */
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'preview-v1/sketchup-v1.js'),'utf8');
new vm.Script(source);
const ctx={
 window:{},document:{addEventListener(){}},sections:[['dashboard','⌂','Dashboard']],
 render(){},title:{textContent:''},nav:{innerHTML:'',querySelectorAll(){return[]}},
 sidebar:{classList:{remove(){}}},location:{hash:'#dashboard'},content:{innerHTML:''},
 esc:v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
 console,Number,Math,Date,Set,Map,Error,String
};
vm.runInNewContext(source,ctx,{timeout:1500});
const importer=ctx.window.universalartesSketchUp;
assert(importer,'Importador não inicializado');
const fixture=fs.readFileSync(path.join(root,'tests/fixtures/opencutlist-components-sample.csv'),'utf8');
const sep=importer.detectSep(fixture);
assert.equal(sep,';','Separador do arquivo de componentes');
const rows=importer.parseCSV(fixture,sep);
assert.equal(rows[0][0],'Components');
const table=importer.extractPartTable(rows);
assert.equal(table.skipped,1);
assert.equal(table.raw.length,2,'Ignorar o resumo final do OpenCutList');
assert.equal(table.headers[0],'Part#');
const state=importer.state;
state.headers=table.headers;state.raw=table.raw;
importer.mapping();
assert(state.map.code>=0,'Importar Part# como código');
assert(state.map.name>=0,'Description é a peça');
assert(state.map.length>=0&&state.map.width>=0);
state.parts=importer.makeParts();
assert.equal(state.parts.length,2);
assert.equal(state.parts[0].code,'C-001');
assert.equal(state.parts[0].name,'Lateral');
assert.equal(state.parts[0].length,500);
assert.equal(state.parts[0].width,150);
assert.equal(state.parts[0].thickness,15);
assert.equal(state.parts[0].qty,12);
assert.equal(state.parts[0].material,'Material não definido');
assert.equal(state.parts.reduce((n,p)=>n+p.qty,0),18);
const area=state.parts.reduce((total,p)=>total+p.length*p.width*p.qty/1e6,0);
assert(Math.abs(area-1.83024)<1e-7,'Área do exemplo em m²');
const report=importer.calculated();
assert(report.bad.some(w=>w.includes('Material não definido')));
assert(report.result.length===1);
const other='Peca;Comprimento_mm;Largura_mm;Quantidade;Material\nLateral;2100;550;2;MDF Branco';
const otherRows=importer.parseCSV(other,importer.detectSep(other));
assert.equal(importer.extractPartTable(otherRows).raw.length,1,'CSV simples ainda funciona');
console.log('OK: CSV OpenCutList com preâmbulo Components, código, medidas em mm, 18 peças e resumo ignorado.');
