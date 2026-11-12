/* OFICINA 1.0 — importar NF-e XML com itens, unidades e vencimento sem lançar estoque. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync(path.join(__dirname,'../preview-v1/features-v05.js'),'utf8');
const begin=src.indexOf('function v5InvoiceXml(){'),end=src.indexOf('function v5InvoiceDelete(',begin);
assert(begin>=0&&end>begin);const code=src.slice(begin,end);new vm.Script(code);
class Node{
 constructor(tag,text='',children=[],attrs={}){this.tag=tag;this.textContent=text;this.children=children;this.attrs=attrs}
 getElementsByTagName(tag){
  const out=[];
  for(const c of this.children){if(c.tag===tag)out.push(c);out.push(...c.getElementsByTagName(tag))}
  return out;
 }
 getAttribute(key){return this.attrs[key]||null}
}
const t=(tag,text)=>new Node(tag,text);
const n=(tag,...children)=>new Node(tag,'',children);
const prod=n('prod',t('cProd','SKU001'),t('xProd','MDF Branco TX 15 mm'),t('uCom','CHAPA'),t('qCom','2.0000'),t('vUnCom','200.00'),t('vProd','400.00'));
const prod2=n('prod',t('cProd','SKU002'),t('xProd','Parafuso 4 x 40 mm'),t('uCom','UN'),t('qCom','20.000'),t('vUnCom','0.50'),t('vProd','10.00'));
const inf=new Node('infNFe','',[
 n('ide',t('nNF','101'),t('dhEmi','2026-11-11T12:00:00-03:00')),
 n('emit',t('xNome','Fornecedor Teste')),
 n('dest',t('xNome','UNIVERSA ART DESIGN')),
 n('total',n('ICMSTot',t('vNF','410.00'))),
 n('det',prod),n('det',prod2),
 n('cobr',n('dup',t('dVenc','2026-12-10')))
 ],{Id:'NFe'+'1'.repeat(44)});
const xml=n('nfeProc',inf);
const db={invoices:[],products:[{id:'prod',estoque:4}],transactions:[],purchases:[],stockMovements:[],seq:{invoice:1}};
let alerts=[],saveWorks=true,saves=0,renders=0,fileXml='<nfeProc/>',task;
const input={type:'',accept:'',onchange:null,files:[{
 size:1200,async text(){return fileXml}
}],click(){task=this.onchange()}};
const ctx={db,Number,Date,Math,Error,Array,Uint8Array,RegExp,
 DOMParser:class {parseFromString(){return xml}},
 document:{createElement:tag=>{assert.equal(tag,'input');return input}},
 alert:v=>alerts.push(String(v)),confirm:()=>true,
 save:()=>{saves++;return saveWorks},render:()=>{renders++},
 id:(()=>{let x=0;return()=>'note-'+(++x)})(),iso:()=> '2026-11-11',
 round:n=>Math.round(Number(n)*100)/100,
 money:n=>'R$ '+Number(n).toFixed(2)
};
vm.runInNewContext(code,ctx,{timeout:1500});
(async()=>{
 ctx.v5InvoiceXml();await task;
 assert.equal(input.accept,'.xml,application/xml,text/xml');
 assert.equal(db.invoices.length,1);
 const invoice=db.invoices[0];
 assert.equal(invoice.numero,'101');
 assert.equal(invoice.valor,410);
 assert.equal(invoice.tipo,'entrada');
 assert.equal(invoice.origem,'XML');
 assert.equal(invoice.chave,'1'.repeat(44));
 assert.equal(invoice.vencimento,'2026-12-10');
 assert.equal(invoice.items.length,2);
 assert.equal(invoice.items[0].nome,'MDF Branco TX 15 mm');
 assert.equal(invoice.items[0].unidade,'CHAPA');
 assert.equal(invoice.items[0].quantidade,2);
 assert.equal(invoice.items[0].custo,200);
 assert.equal(invoice.items[1].quantidade,20);
 assert.equal(invoice.items[1].custo,0.5);
 assert.equal(db.products[0].estoque,4);
 assert.equal(db.transactions.length,0);
 assert.equal(db.stockMovements.length,0);
 assert(alerts.at(-1).includes('Preparar entrada'));
 assert.equal(db.seq.invoice,2);
 ctx.v5InvoiceXml();await task;
 assert.equal(db.invoices.length,1,'Mesmo XML não pode duplicar NF-e');
 assert(alerts.at(-1).includes('duplicada'));
 db.invoices=[];db.seq.invoice=1;saveWorks=false;
 ctx.v5InvoiceXml();await task;
 assert.equal(db.invoices.length,0,'Falha em save reverte NF');
 assert.equal(db.seq.invoice,1,'Falha em save reverte sequencial');
 fileXml='<!DOCTYPE foo><nfeProc/>';
 ctx.v5InvoiceXml();await task;
 assert.equal(db.invoices.length,0);
 assert(alerts.at(-1).includes('não permitidas'));
 console.log('OK NF-e XML: descrição, unidade, custo, vencimento, chave, deduplicação, rollback e nenhuma movimentação automática.');
})().catch(error=>{console.error(error);process.exitCode=1});
