/* OFICINA 1.0 — tamanhos informados pela marcenaria e custo único de fitas/ferragens */
'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const catalog=read('preview-v1/catalogo-produtos-1-0.js');
const skp=read('preview-v1/sketchup-v1.js');
new vm.Script(catalog);new vm.Script(skp);
const wood=['mdf15','mdf18','mdf25','mdf06'];
const screws=['par3_5x16','par4x20','par4x25','par4x30','par4x35','par4x40','par4x45','par4x50','par4x60','par5x70'];
const anchors=['bucha06','bucha08','bucha10','bucha12'];
const borders=['fita22','fita35','fita45','fita64'];
for(const key of [...wood,...screws,...anchors,...borders])
 assert(catalog.includes('value="'+key+'"'),'Opção de material faltante: '+key);
assert.equal(new Set([...wood,...screws,...anchors,...borders]).size,22);
assert(catalog.includes("'Fitas de borda',unidade:'m'"));
assert(catalog.includes('MDF 06 mm'));
assert(catalog.includes("'Bucha '+size+' mm'"));
assert(skp.includes('Fitas/Ferragens e acessórios (R$)'));
assert(!skp.includes("['edgePrice','Fita de borda (R$/m)']"));
assert(!skp.includes("['Fita de borda',cash(r.edgeCost)]"));
const ctx={window:{},document:{addEventListener(){}},sections:[],render(){},title:{textContent:''},
 nav:{innerHTML:'',querySelectorAll(){return []}},sidebar:{classList:{remove(){}}},location:{hash:'#dashboard'},
 content:{innerHTML:''},Number,Math,Date,Map,Set,String,Error,Intl,
 esc:x=>String(x??''),db:{products:[]}};
vm.runInNewContext(skp,ctx,{timeout:2000});
const api=ctx.window.universalartesSketchUp,st=api.state;
st.parts=[{code:'p1',name:'Lateral',length:1000,width:500,thickness:15,
 qty:1,material:'MDF Branco TX',edge:4}];
st.hardware=120;st.edgePrice=999;st.efficiency=80;
const before=api.calculated();
assert.equal(before.band,4,'A metragem continua disponível tecnicamente');
assert.equal(before.edgeCost,0,'Não lançar custo da fita em separado');
assert.equal(before.cost,120,'Fitas e ferragens lançadas somente uma vez');
st.hardware=200;
const after=api.calculated();
assert.equal(after.cost,200);
assert.equal(after.edgeCost,0);
console.log('OK medidas: 4 MDF, 10 parafusos, 4 buchas, 4 fitas; custo consolidado sem dupla contagem.');
