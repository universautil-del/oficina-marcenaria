/* OFICINA 1.0 — conferir layout do PDF referência aplicado aos dois documentos. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync(path.join(__dirname,'../preview-v1/documentos-padrao-1-0.js'),'utf8');
const app=fs.readFileSync(path.join(__dirname,'../preview-v1/script.js'),'utf8');
const page=fs.readFileSync(path.join(__dirname,'../preview-v1/seguro.html'),'utf8');
new vm.Script(src,{filename:'documentos-padrao-1-0.js'});
assert(page.includes('documentos-padrao-1-0.js'),'Script do layout carregado na OFICINA autenticada');
assert(app.includes('Validade do orçamento'),'Formulário deve permitir validade');
assert(app.includes('Propostas adicionais de pagamento'),'Formulário deve permitir propostas');
assert(app.includes("propostasPagamento:q.propostasPagamento||''"),'Pedido deve herdar propostas do orçamento');
let html='',printed=false,alerts=0;
const client={id:'cl1',nome:'Cliente de Teste',doc:'000.111.222-33',telefone:'(11) 90000-0000',email:'teste@example.com',endereco:'Rua Modelo',numero:'10',bairro:'Centro',cep:'01001-000',cidade:'São Paulo',uf:'SP'};
const db={company:{nome:'Universa Art',cnpj:'00.111.222/0001-33',endereco:'Rua da Oficina, 100',telefone:'(11) 90000-0001',email:'contato@example.com',logo:'data:image/webp;base64,QUJD',cidade:'São Paulo'}};
const base={clientId:'cl1',clientNome:client.nome,date:'2026-11-11',items:[
 {descricao:'Dormitório: cômoda de 8 gavetas em MDF TX',quantidade:1,preco:4000}
],desconto:150,frete:50,ambientes:'Dormitório',entrega:'30 dias úteis',entregaData:'2026-12-12',validade:'2026-11-30',
propostasPagamento:'50% de entrada e 50% na entrega\n6x no cartão',payment:{tipo:'avista',forma:'Pix'},observacoes:'Acabamento amadeirado',
projectId:'p1',projectNome:'Dormitório',number:1};
const ctx={db,window:{universaArtAssinatura:{image:()=>'<img class="ua-doc-sig-img" src="data:image/png;base64,QUJD">'},open:()=>({document:{open(){},write(t){html=t},close(){}},focus(){}})},
 location:{href:'https://universautil-del.github.io/oficina-marcenaria/preview-v1/seguro.html'},
 URL,Intl,Date,String,Number,Math,RegExp,Array,Error,
 salesPrint:()=>{throw Error('Impressão antiga chamada')},
 getClient:id=>id==='cl1'?client:null,
 esc:x=>String(x??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'),
 date:x=>String(x).split('-').reverse().join('/'),
 iso:()=>'2026-11-11',
 dec:x=>String(x),
 money:x=>'R$ '+Number(x).toLocaleString('pt-BR',{minimumFractionDigits:2}),
 orderTotal:o=>o.items.reduce((a,i)=>a+i.quantidade*i.preco,0)-Number(o.desconto||0)+Number(o.frete||0),
 paymentText:p=>'À vista'+(p.forma?' · '+p.forma:''),
 statusText:{confirmado:'Confirmado',entregue:'Entregue'},
 alert:()=>{alerts++}
};
vm.runInNewContext(src,ctx,{timeout:2500});
const docs=ctx.window.universaArtDocumentoPadrao;
assert(docs&&typeof docs.htmlForSale==='function');
const quote=docs.htmlForSale({...base,controlCode:'ORC-2026-8E318C'},'Orçamento');
assert(quote.includes('ORÇAMENTO Nº')&&quote.includes('ORC-2026-8E318C'));
assert(quote.includes('AMBIENTE: Dormitório'));
assert(quote.includes('Cliente de Teste')&&quote.includes('000.111.222-33'));
assert(quote.includes('Rua Modelo')&&quote.includes('01001-000'));
assert(quote.includes('Prazo / entrega:'));
assert(quote.includes('Validade do orçamento:'));
assert(quote.includes('30/11/2026'));
assert(quote.includes('PROPOSTAS DE PAGAMENTO'));
assert(quote.includes('50% de entrada e 50% na entrega'));
assert(quote.includes('6x no cartão'));
assert(quote.includes('VALOR TOTAL DO ORÇAMENTO:'));
assert(quote.includes('R$ 3.900,00'));
assert(quote.includes('assets/universa-art-logo-novo.webp'));
assert(!quote.includes('ua-doc-sig-img" src='),'Orçamentos continuam sem assinatura manuscrita pré-aplicada');
assert(!quote.includes('ua-doc-sign-line'),'Orçamento não deve conter linha de assinatura');
assert(!quote.includes('<div class="ua-doc-signature">'),'Orçamento sem campo de assinatura');
assert(quote.includes('@page{size:A4')&&quote.includes('counter(page)'));
assert(quote.includes('Imprimir / Salvar em PDF'));
assert(quote.includes('São Paulo, 11 de novembro de 2026'));
const order=docs.htmlForSale({...base,controlCode:'PED-2026-000123',status:'confirmado'},'Pedido');
assert(order.includes('PEDIDO Nº')&&order.includes('PED-2026-000123'));
assert(order.includes('<img class="ua-doc-sig-img"'),'Pedido deve conter assinatura da empresa quando cadastrada');
assert(order.includes('ua-doc-sign-line'),'Pedido deve manter linha de assinatura');
assert(order.includes('VALOR TOTAL DO PEDIDO:'));
assert(order.includes('CONDIÇÕES DE PAGAMENTO'));
assert(order.includes('Situação do pedido:'));
assert(!order.includes('Validade do orçamento:'));
ctx.salesPrint({...base,controlCode:'ORC-2026-8E318C'},'Orçamento');
assert(html.includes('ORC-2026-8E318C')&&html.includes('ua-doc-header'));
assert.equal(alerts,0);
const injected=docs.htmlForSale({...base,controlCode:'ORC-2026-2',items:[{descricao:'<script>alert("pwn")</script>',quantidade:1,preco:1}],propostasPagamento:'<img src=x onerror=alert(1)>'},'Orçamento');
assert(!injected.includes('<script>')&&!injected.includes('<img src=x'),'HTML do PDF não executa informações do cadastro');
db.company.logo='';
const fallback=docs.htmlForSale({...base,controlCode:'ORC-2026-3'},'Orçamento');
assert(fallback.includes('assets/universa-art-logo-novo.webp'),'Logo institucional caso nenhuma foto própria tenha sido escolhida');
console.log('OK orçamento e pedido em layout A4 oficial: cabeçalho, logo, cliente, itens, totais, validade, condições, orçamento sem assinatura e pedido com assinatura segura.');
