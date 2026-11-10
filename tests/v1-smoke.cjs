/* UNIVERSALARTES v1 smoke tests — no npm dependencies; execute: node tests/v1-smoke.cjs */
'use strict';
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const scripts=[
 'preview-v1/upgrade.js','preview-v1/script.js','preview-v1/features-v05.js',
 'preview-v1/universalartes-v1.js','preview-v1/sketchup-v1.js','preview-v1/cloud-preview.js'
];
for(const file of scripts){
 const source=read(file);
 new vm.Script(source,{filename:file});
 console.log('OK sintaxe:',file);
}
const index=read('preview-v1/index.html');
for(const p of scripts){
 assert(index.includes('src="'+p.split('/').pop()),'Script ausente no HTML: '+p);
}
assert(!index.includes('src="cloud-v06.js'),'Nuvem antiga não deve aparecer na prévia');
const source=read('preview-v1/script.js');
assert(source.includes("universalartes-preview-v1-dados"),'Chave local exclusiva da prévia');
assert(!source.includes("const DB_KEY='oficina-marcenaria-v03'"),'Não misturar com sistema antigo');
const cloud=read('preview-v1/cloud-preview.js');
assert(cloud.includes('universalartes_preview_backups'),'Tabela própria da prévia');
assert(!cloud.includes('/rest/v1/oficina_backups'),'Tabela antiga não pode ser sobrescrita');
assert(cloud.includes("universalartes-v1-cloud-session"),'Sessão exclusiva da prévia');
const sql=read('preview-v1/supabase-preview.sql');
assert(/enable row level security/i.test(sql),'RLS obrigatória');
assert(/for select to authenticated/.test(sql),'Política de leitura autenticada');
assert(/for update to authenticated/.test(sql),'Política de atualização autenticada');
const ctx={
 window:{},document:{addEventListener(){}},
 sections:[['dashboard','⌂','Painel']],render(){},title:{textContent:''},
 nav:{innerHTML:'',querySelectorAll(){return[]}},
 sidebar:{classList:{remove(){}}},
 content:{innerHTML:''},location:{hash:''},
 console,Number,Math,Date,Set,Map,
};
vm.runInNewContext(read('preview-v1/sketchup-v1.js'),ctx,{timeout:1000});
const importer=ctx.window.universalartesSketchUp;
assert(importer&&typeof importer.parseCSV==='function');
const csv='Peca;Comprimento_mm;Largura_mm;Espessura_mm;Quantidade;Material;Fita_m_por_peca\r\n"Lateral, armário";2100;550;15;2;MDF branco;1,60\r\nPrateleira;760;500;15;3;MDF branco;0,76\r\n';
const sep=importer.detectSep(csv);
assert.equal(sep,';');
const rows=importer.parseCSV(csv,sep);
assert.equal(rows.length,3,'Cabeçalho mais duas peças');
assert.equal(rows[1][0],'Lateral, armário');
const st=importer.state;
st.headers=rows[0];st.raw=rows.slice(1);
st.map={name:0,length:1,width:2,thickness:3,qty:4,material:5,edge:6};
st.parts=importer.makeParts();
assert.equal(st.parts.length,2);
const area=st.parts.reduce((s,p)=>s+p.length*p.width*p.qty/1e6,0);
assert(Math.abs(area-3.45)<1e-8,'Área em m² calculada corretamente');
assert.equal(st.parts[0].length,2100,'Medidas em mm');
assert.equal(st.parts[0].qty,2,'Quantidade convertida');
const report=importer.calculated();
assert.equal(report.result.length,1,'Agrupar mesmo material e espessura');
assert(report.sheets>=1,'Estimativa de chapas (não é plano de corte)');
st.raw=[['Peça inválida','-10','500','15','1','MDF branco','0']];
assert.throws(()=>importer.makeParts(),/inválido|informe/i,'Medida negativa deve ser recusada');
console.log('OK importação SketchUp, mm, materiais, cálculos, validação, RLS e isolamento da prévia.');
