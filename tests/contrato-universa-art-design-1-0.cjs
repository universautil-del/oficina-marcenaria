/* OFICINA 1.0 — contrato padrão UNIVERSA ART DESIGN com 15 cláusulas e reserva de domínio. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync(path.join(__dirname,'../preview-v1/contrato-universa-art-design-1-0.js'),'utf8');
const app=fs.readFileSync(path.join(__dirname,'../preview-v1/script.js'),'utf8');
const page=fs.readFileSync(path.join(__dirname,'../preview-v1/seguro.html'),'utf8');
new vm.Script(src,{filename:'contrato-universa-art-design-1-0.js'});
assert(page.includes('contrato-universa-art-design-1-0.js'));
assert(page.indexOf('contrato-universa-art-design-1-0.js')>page.indexOf('script.js'),'Novo modelo deve substituir impressão legada');
assert(app.includes('id="useCustomContract"')&&app.includes('contratoPersonalizado'));
let oldPrints=0,newHTML='',alerted=[];
const order={
 id:'order1',number:31,controlCode:'PED-2026-F3AC37',clientId:'client1',clientNome:'Cliente Exemplo',date:'2026-11-10',
 entregaData:'2026-12-07',entrega:'30 dias úteis',montagemDiasUteis:1,
 ambientes:'Cozinha',projectNome:'Cozinha sob medida',projectId:'project1',observacoes:'Frentes brancas',
 items:[{descricao:'Balcão de cozinha em MDF TX 18 mm',quantidade:1,preco:5300}],
 desconto:0,frete:0,payment:{tipo:'entrada',entrada:2000,parcelas:2,forma:'Pix',primeiroVencimento:'2026-12-07'}
};
const client={id:'client1',nome:'Cliente Exemplo',doc:'123.456.789-00',endereco:'Rua Exemplo',
 numero:'20',bairro:'Vila Modelo',cidade:'São Paulo',uf:'SP',cep:'01001-001',
 email:'cliente@example.com',telefone:'(11) 99999-1234'};
const db={company:{nome:'Universa Art',cnpj:'55.223.652/0001-87',endereco:'Rua São Judas Tadeu, 617A - Vila Marcelo - São Paulo/SP',email:'universautils@gmail.com',telefone:'11985218203',logo:'data:image/webp;base64,QUJD'},clients:[client],orders:[order]};
const copy=JSON.stringify(db);
const money=n=>'R$ '+Number(n||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const safe=x=>String(x??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const ctx={db,Date,Intl,Number,Math,String,Array,Set,URL,RegExp,
 esc:safe,dec:n=>String(n),money,
 getClient:id=>db.clients.find(c=>c.id===id),
 orderTotal:o=>o.items.reduce((x,i)=>x+i.preco*i.quantidade,0)-o.desconto+o.frete,
 buildInstallments:(total,payment,o)=>{
  if(payment.tipo==='entrada')return [
   {label:'Entrada',valor:payment.entrada,date:o.date},
   {label:'Parcela 1/2',valor:1650,date:'2026-12-07'},
   {label:'Parcela 2/2',valor:1650,date:'2027-01-07'}];
  return[{label:'Pagamento à vista',valor:total,date:o.date}];
 },
 location:{href:'https://universautil-del.github.io/oficina-marcenaria/preview-v1/seguro.html'},
 contractPrint:()=>{oldPrints++},
 alert:message=>alerted.push(message),
 window:{universaArtAssinatura:{image:()=>'<img class="ua-contract-sig-img" src="data:image/png;base64,QUJD">'},open:()=>({document:{open(){},write(html){newHTML=html},close(){}},focus(){}})}
};
vm.runInNewContext(src,ctx,{timeout:2500});
const api=ctx.window.universaArtContratoPadrao;
assert(api&&typeof api.htmlForContract==='function');
const html=api.htmlForContract(order);
assert(html.includes('UNIVERSA ART DESIGN')&&html.includes('55.223.652/0001-87'));
assert(html.includes('Rua São Judas Tadeu, 617A - Vila Marcelo - São Paulo/SP'));
assert(html.includes('universautils@gmail.com')&&html.includes('11985218203'));
assert(html.includes('CONTRATO DE COMPRA E VENDA DE MÓVEIS SOB MEDIDA COM RESERVA DE DOMÍNIO'));
assert(html.includes('Nº 2026-F3AC37')&&!html.includes('Nº PED-2026-F3AC37'));
assert(html.includes('CONTRATANTE')&&html.includes('CONTRATADA'));
assert(html.includes('Cliente Exemplo')&&html.includes('Rua Exemplo, 20')&&html.includes('123.456.789-00'));
assert(html.includes('Cozinha sob medida'));
assert(html.includes('Balcão de cozinha em MDF TX 18 mm'));
assert(html.includes('07/12/2026'));
assert(html.includes('DO OBJETO DO CONTRATO'));
for(let i=1;i<=15;i++)assert(html.includes('Cláusula '+i+'ª.'),'Falta cláusula '+i);
for(const title of ['IDENTIFICAÇÃO DAS PARTES CONTRATANTES','DADOS DOS SERVIÇOS',
 'DO PAGAMENTO','DAS PENALIDADES','DA RESERVA DE DOMÍNIO','DA CONSERVAÇÃO E USO DOS BENS',
 'DO INADIMPLEMENTO','DISPOSIÇÕES FINAIS','DO FORO'])assert(html.includes(title),'Falta seção '+title);
assert(html.includes('R$ 5.300,00'));
assert(html.includes('R$ 2.000,00')&&html.includes('R$ 1.650,00'));
assert(html.includes('07/01/2027'),'Pagamento deve usar vencimento da última parcela');
assert(html.includes('Testemunha 1')&&html.includes('Testemunha 2'));
assert(html.includes('@page{size:A4'));
assert(html.includes('assets/universa-art-logo-novo.webp'));
assert(html.includes('<img class="ua-contract-sig-img"'),'Assinatura só aparece no lado da contratada');
assert.equal((html.match(/ua-contract-sig-img" src=/g)||[]).length,1,'Nunca aplicar a assinatura da contratada ao cliente');
assert(!html.includes('RASCUNHO — DADOS PENDENTES'));
assert(html.includes('São Paulo/SP, terça-feira, 10 de novembro de 2026.'),'Dia da semana não deve ser inventado');
ctx.contractPrint(order);
assert(newHTML.includes('Nº 2026-F3AC37')&&oldPrints===0);
assert.equal(alerted.length,0);
db.company.contrato='Modelo antigo {{cliente}}';db.company.contratoPersonalizado=true;
ctx.contractPrint(order);
assert.equal(oldPrints,1,'Modelo antigo é usado só quando opção explícita está ativa');
db.company.contratoPersonalizado=false;
const missing=api.htmlForContract({...order,entregaData:'',clientId:'desconhecido',clientNome:'',date:'',items:[]});
assert(missing.includes('RASCUNHO — DADOS PENDENTES'));
assert(missing.includes('CPF/CNPJ do contratante'));
assert(missing.includes('data prevista de entrega'));
assert(missing.includes('____/____/________'));
assert(missing.includes('dia <strong>____/____/________</strong>'),'Sem data de entrega, o contrato não deve inventá-la; datas de vencimento existentes continuam no quadro de pagamento');
const malicious=api.htmlForContract({...order,items:[{descricao:'<script>alert(1)</script>',quantidade:1,preco:5300}],
 observacoes:'<img src=x onerror=alert(1)>'});
assert(!malicious.includes('<script>')&&!malicious.includes('<img src=x'),'Texto do usuário deve ser escapado');
assert.equal(db.orders.length,1);
assert.equal(JSON.stringify(db.orders),JSON.stringify([order]),'Imprimir contrato não altera dados do pedido');
console.log('OK contrato UNIVERSA ART DESIGN: 15 cláusulas, pagamento por pedido, CNPJ, data, assinaturas, rascunho, XSS e legado opcional.');
