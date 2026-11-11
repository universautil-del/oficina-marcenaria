/* node tests/entradas-seguras-v1-3.cjs */
'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../preview-v1/upgrade.js'),'utf8');
const start=source.indexOf('function receivePurchase('),end=source.indexOf('function viewPurchase(',start);
assert(start>=0&&end>start,'Funções de entrada encontradas');
const code=source.slice(start,end);
new vm.Script(code);
const db={
 products:[
  {id:'m1',tipo:'materia',nome:'MDF TX',estoque:3,custo:150,unidade:'chapa'},
  {id:'m2',tipo:'materia',nome:'Fita',estoque:5,custo:3,unidade:'m'}
 ],
 purchases:[
  {id:'e1',number:1,status:'aberta',receivedAt:'',accountId:'t1',items:[
   {productId:'m1',quantidade:2,custo:200},
   {productId:'m2',quantidade:1.125,custo:4}
  ]},
  {id:'e2',number:2,status:'aberta',receivedAt:'',accountId:'t2',items:[{productId:'m1',quantidade:1,custo:210}]}
 ],
 transactions:[
  {id:'t1',kind:'pagar',valor:404.5,payments:[]},
  {id:'t2',kind:'pagar',valor:210,payments:[]}
 ],
 stockMovements:[]
};
let ok=true,saveCount=0,confirms=0,renders=0,alerts=[],serial=0;
const ctx={db,Error,Map,Set,Math,Number,String,Date,
 getProduct:id=>db.products.find(p=>p.id===id),
 cashReceived:t=>t.payments.reduce((n,p)=>n+p.valor,0),
 round:n=>Math.round(Number(n)*100)/100,
 id:()=> 'evt-'+(++serial),
 iso:()=> '2026-11-10',
 save:()=>{saveCount++;return ok},
 render:()=>{renders++},
 confirm:()=>{confirms++;return true},
 alert:m=>{alerts.push(m)}
};
vm.runInNewContext(code,ctx,{timeout:1400});
ctx.receivePurchase('e1');
assert.equal(db.purchases[0].status,'recebida');
assert.equal(db.products[0].estoque,5);
assert.equal(db.products[1].estoque,6.125,'Não arredondar 1,125 m para centésimos');
assert.equal(db.stockMovements.length,2);
assert.equal(db.stockMovements[1].delta,1.125);
assert.equal(db.products[0].custo,170,'Custo médio ponderado');
assert.equal(saveCount,1);
ctx.receivePurchase('e1');
assert.equal(db.stockMovements.length,2,'Não realizar entrada duplicada');
const previous=JSON.stringify(db);
ok=false;ctx.receivePurchase('e2');
assert.equal(JSON.stringify(db),previous,'Rollback após falha no salvamento');
ok=true;ctx.receivePurchase('e2');
assert.equal(db.products[0].estoque,6);
assert.equal(db.stockMovements.length,3);
const count=db.transactions.length;
const newEntry={id:'e3',number:3,status:'aberta',receivedAt:'',accountId:'t3',items:[]};
db.purchases.push(newEntry);
db.transactions.push({id:'t3',payments:[],valor:0});
ok=false;
const before=JSON.stringify({entry:newEntry,transactions:db.transactions});
ctx.cancelPurchase('e3');
assert.equal(JSON.stringify({entry:newEntry,transactions:db.transactions}),before,'Rollback do cancelamento');
ok=true;ctx.cancelPurchase('e3');
assert.equal(newEntry.status,'cancelada');
assert.equal(db.transactions.length,count);
assert(alerts.some(s=>s.includes('Não foi possível')));
assert(confirms>=4&&renders>=3);
console.log('OK: entrada única, 3 casas decimais, custo médio, rollback de estoque, contas e cancelamento.');
