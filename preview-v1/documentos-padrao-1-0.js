'use strict';
/* OFICINA 1.0 — layout de impressão padrão de orçamentos e pedidos.
 * Referência: orçamento-modelo PDF fornecido pela UNIVERSA ART em 11/11/2026.
 * Não utiliza assinatura manuscrita do modelo; deixa linha para assinar.
 * Não modifica dados, condições nem valores do orçamento/pedido.
 */
(function(){
 const originalSalesPrint=salesPrint;
 function text(value){return esc(String(value??''))}
 function moneySafe(value){const n=Number(value);return money(Number.isFinite(n)?n:0)}
 function dateSafe(value){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value||'')))return '';
  return date(value);
 }
 function longDate(value){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value||'')))return '';
  const day=new Date(value+'T12:00:00Z');
  if(!Number.isFinite(day.getTime()))return '';
  return new Intl.DateTimeFormat('pt-BR',{timeZone:'UTC',day:'numeric',month:'long',year:'numeric'}).format(day);
 }
 function field(label,value){
  const v=String(value??'').trim();
  return '<div class="ua-doc-info"><strong>'+text(label)+'</strong> '+(v?text(v):'<span class="ua-doc-muted">—</span>')+'</div>';
 }
 function clientAddress(client){
  if(!client)return '';
  const full=[client.endereco,client.numero,client.complemento,client.bairro].filter(v=>String(v||'').trim()).join(' - ');
  const city=[client.cidade,client.uf].filter(Boolean).join(' / ');
  const cep=client.cep?'CEP: '+client.cep:'';
  return [full,cep,city].filter(Boolean).join(' - ');
 }
 function sanitizePaymentOptions(raw){
  return String(raw||'').split(/\r?\n/).map(x=>x.replace(/^\s*\d+[.)]\s*/,'').trim()).filter(Boolean).slice(0,8);
 }
 function logoSrc(company){
  const saved=String(company.logo||'');
  if(/^data:image\/(webp|png|jpeg);base64,[a-zA-Z0-9+/=]+$/.test(saved))return saved;
  // Usa sempre o arquivo institucional publicado na OFICINA como alternativa.
  return new URL('assets/universa-art-logo.webp',location.href).href;
 }
 function htmlForSale(order,type){
  const isQuote=/orçamento/i.test(String(type));
  const company=db.company||{},customer=typeof getClient==='function'?getClient(order.clientId):null;
  const isOrder=!isQuote;
  const name=String(company.nome||'Universa Art');
  const control=String(order.controlCode||('#'+order.number));
  const logo=logoSrc(company);
  const env=String(order.ambientes||'Não informado');
  const price=moneySafe(orderTotal(order));
  const items=Array.isArray(order.items)?order.items:[];
  const itemHtml=items.map((item,index)=>{
   const qty=Number(item.quantidade)||0;
   const amount=moneySafe(qty*Number(item.preco||0));
   const details=String(item.descricao||'Item '+(index+1));
   return '<div class="ua-doc-item">'+
     '<div class="ua-doc-description">'+text(details)+'</div>'+
     '<div class="ua-doc-item-bottom"><div><strong>Quantidade:</strong> '+text(dec(qty))+' un</div>'+
       '<div><span>Valor unitário: '+moneySafe(item.preco)+'</span><span><strong>Subtotal:</strong> '+amount+'</span></div></div>'+
    '</div>';
  }).join('');
  const payment=paymentText(order.payment||{});
  const options=[payment,...sanitizePaymentOptions(order.propostasPagamento)];
  const terms=options.map(row=>'<li>'+text(row)+'</li>').join('');
  const haveDiscount=Number(order.desconto||0)>0;
  const haveFreight=Number(order.frete||0)>0;
  const adjustments=(haveDiscount||haveFreight)?'<div class="ua-doc-adjustments">'+
    (haveDiscount?'<span>Desconto: '+moneySafe(order.desconto)+'</span>':'')+
    (haveFreight?'<span>Frete / entrega: '+moneySafe(order.frete)+'</span>':'')+'</div>':'';
  const delivery=(order.entrega||order.entregaData)?
    '<p><strong>Prazo / entrega:</strong> '+text(order.entrega||'A combinar')+
    (order.entregaData?' · prevista para '+text(dateSafe(order.entregaData)):'')+'</p>':'';
  const validity=isQuote&&order.validade?'<p><strong>Validade do orçamento:</strong> '+text(dateSafe(order.validade))+'</p>':'';
  const notes=String(order.observacoes||'').trim();
  const extras=notes?'<p class="ua-doc-note"><strong>Observações:</strong> '+text(notes)+'</p>':'';
  const dateText=longDate(order.date)||longDate(iso());
  const place=String(company.cidade||'São Paulo');
  const clientName=String(customer?.nome||order.clientNome||'Cliente não informado');
  const clientDocument=String(customer?.doc||'');
  const clientPhone=String(customer?.telefone||'');
  const clientEmail=String(customer?.email||'');
  const brandEmail=String(company.email||'');
  const companyPhone=String(company.telefone||'');
  const companyDoc=String(company.cnpj||'');
  const companyAddress=String(company.endereco||'');
  const companyDetails=[
    companyDoc?'CPF / CNPJ: '+companyDoc:'',
    companyAddress,
    [brandEmail?'E-mail: '+brandEmail:'',companyPhone?'Tel.: '+companyPhone:''].filter(Boolean).join(' | ')
  ].filter(Boolean).map(line=>'<div>'+text(line)+'</div>').join('');
  const rightFields=[
    field('Responsável:',order.responsavel||''),
    field('Telefone:',clientPhone),
    field('E-mail:',clientEmail)
  ].join('');
  const dateFooter=text(place)+', '+text(dateText)+'.';
  const title=isQuote?'ORÇAMENTO Nº':'PEDIDO Nº';
  const totalLabel=isQuote?'VALOR TOTAL DO ORÇAMENTO:':'VALOR TOTAL DO PEDIDO:';
  const finalItems=items.length?itemHtml:'<div class="ua-doc-item ua-doc-description">Nenhum item informado.</div>';
  const status= isOrder&&order.status?
    '<p><strong>Situação do pedido:</strong> '+text(statusText[order.status]||order.status)+'</p>':'';
  const project=order.projectId?
    '<p><strong>Projeto:</strong> '+text(order.projectNome||'Vinculado')+'</p>':'';

  return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">'+
   '<meta name="viewport" content="width=device-width, initial-scale=1">'+
   '<title>'+text((isQuote?'Orcamento':'Pedido')+'-'+control)+'</title>'+
   '<style>'+printStyle()+'</style></head><body>'+
   '<div class="ua-doc-controls"><button type="button" onclick="window.print()">Imprimir / Salvar em PDF</button>'+
   '<button type="button" onclick="window.close()">Fechar</button>'+
   '<span>Selecione “Salvar como PDF” na janela de impressão para gerar o arquivo.</span></div>'+
   '<main class="ua-doc-page">'+
    '<header class="ua-doc-header">'+
      '<img class="ua-doc-logo" src="'+text(logo)+'" alt="Logotipo Universa Art">'+
      '<div class="ua-doc-company"><strong>'+text(name)+'</strong>'+companyDetails+'</div>'+
    '</header>'+
    '<section class="ua-doc-title"><h1>'+title+'</h1><strong>'+text(control)+'</strong></section>'+
    '<section class="ua-doc-client-grid"><div>'+
      field('Cliente:',clientName)+field('CPF / CNPJ:',clientDocument)+
      field('Endereço:',clientAddress(customer))+field('Representante:',order.representante||'')+
     '</div><div class="ua-doc-client-right">'+rightFields+'</div></section>'+
    '<section class="ua-doc-items">'+
      '<div class="ua-doc-item-heading">AMBIENTE: '+text(env)+'</div>'+
      finalItems+'</section>'+
    '<section class="ua-doc-total"><strong>'+totalLabel+'</strong><strong>'+price+'</strong></section>'+
    adjustments+
    '<section class="ua-doc-extra"><h2>CONSIDERAÇÕES FINAIS</h2>'+validity+delivery+project+status+extras+'</section>'+
    '<section class="ua-doc-extra ua-doc-payment"><h2>'+(isQuote?'PROPOSTAS DE PAGAMENTO':'CONDIÇÕES DE PAGAMENTO')+
     '</h2><ol>'+terms+'</ol></section>'+
    '<section class="ua-doc-sign"><p class="ua-doc-city-date">'+dateFooter+'</p>'+
     '<div class="ua-doc-signature"><div class="ua-doc-sign-line"></div><strong>'+text(name)+'</strong>'+
     (companyDoc?'<div>CPF / CNPJ: '+text(companyDoc)+'</div>':'')+'</div></section>'+
   '</main></body></html>';
 }
 function printStyle(){
  return '@page{size:A4;margin:13mm 13mm 17mm;'+
       '@bottom-right{content:counter(page) " / " counter(pages);font:10px Arial,sans-serif;color:#444}}'+
   '*{box-sizing:border-box}html{background:#f3f4f4}body{margin:0;color:#292929;font:10.4pt/1.4 Arial,Helvetica,sans-serif}'+
   '.ua-doc-page{background:#fff;width:210mm;min-height:297mm;max-width:100%;margin:20px auto;padding:13mm 13mm 18mm;box-shadow:0 5px 22px #0002}'+
   '.ua-doc-controls{max-width:210mm;margin:16px auto;display:flex;align-items:center;gap:9px;flex-wrap:wrap;font:12px Arial;color:#47584c}'+
   '.ua-doc-controls button{background:#1e553e;border:0;color:#fff;border-radius:7px;padding:10px 14px;cursor:pointer}'+
   '.ua-doc-controls button+button{background:#fff;color:#1e553e;border:1px solid #b7c9bd}'+
   '.ua-doc-header{display:flex;align-items:flex-start;justify-content:space-between;min-height:28mm;gap:12mm}'+
   '.ua-doc-logo{max-width:42mm;max-height:27mm;object-fit:contain;object-position:left top}'+
   '.ua-doc-company{text-align:right;font-size:9.1pt;line-height:1.34;color:#3d3d3d}'+
   '.ua-doc-company strong{display:block;font-size:13pt;margin-bottom:2px;color:#282828}'+
   '.ua-doc-title{margin:8mm 0 7mm}.ua-doc-title h1{font-size:12.5pt;margin:0;font-weight:800}'+
   '.ua-doc-title>strong{font-size:12.5pt;display:block;line-height:1.25}'+
   '.ua-doc-client-grid{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(0,1fr);gap:12px;border-top:1px solid #666;min-height:27mm;padding-top:3mm}'+
   '.ua-doc-info{font-size:9.3pt;line-height:1.45;overflow-wrap:anywhere}.ua-doc-info strong{font-weight:500}'+
   '.ua-doc-client-right{text-align:right}.ua-doc-muted{color:#777}'+
   '.ua-doc-items{border:1px solid #555;margin-top:16mm;break-inside:auto}'+
   '.ua-doc-item-heading{font-weight:750;background:#e1e1e1;border-bottom:1px solid #777;padding:6px 10px;font-size:9.6pt;break-after:avoid}'+
   '.ua-doc-item{min-height:26mm;display:flex;flex-direction:column;justify-content:space-between;padding:12px 10px 8px;break-inside:avoid}'+
   '.ua-doc-item+.ua-doc-item{border-top:1px solid #bbb}'+
   '.ua-doc-description{min-height:14mm;white-space:pre-wrap;overflow-wrap:anywhere;font-size:9.7pt}'+
   '.ua-doc-item-bottom{display:flex;justify-content:space-between;align-items:flex-end;gap:10px;font-size:9.4pt}'+
   '.ua-doc-item-bottom>div:last-child{display:flex;justify-content:flex-end;gap:16px;flex-wrap:wrap;text-align:right}'+
   '.ua-doc-total{display:flex;justify-content:space-between;border-bottom:2px dotted #b5b5b5;padding:11px 0 6px;gap:12px;font-size:11pt;break-inside:avoid}'+
   '.ua-doc-adjustments{display:flex;justify-content:flex-end;gap:18px;font-size:9pt;color:#4e4e4e;margin-top:4px}'+
   '.ua-doc-extra{margin-top:12mm;break-inside:avoid}.ua-doc-extra h2{font-size:10.2pt;font-weight:800;margin:0 0 5mm}'+
   '.ua-doc-extra p{margin:4px 0;font-size:9.7pt;overflow-wrap:anywhere}.ua-doc-note{white-space:pre-wrap}'+
   '.ua-doc-payment{margin-top:10mm}.ua-doc-payment ol{padding-left:18px;margin:4px 0}'+
   '.ua-doc-payment li{font-size:10pt;font-weight:650;margin:3px 0;overflow-wrap:anywhere}'+
   '.ua-doc-sign{margin-top:16mm;break-inside:avoid}.ua-doc-city-date{font-weight:650;font-size:10pt}'+
   '.ua-doc-signature{width:60%;max-width:102mm;margin:24mm auto 0;text-align:center;font-size:9.6pt}'+
   '.ua-doc-sign-line{border-top:1px solid #777;margin-bottom:5px}'+
   '.ua-doc-signature strong{display:block}.ua-doc-signature div:last-child{font-size:8.8pt}'+
   '@media print{html{background:#fff}body{margin:0}.ua-doc-controls{display:none!important}'+
     '.ua-doc-page{width:auto;min-height:0;margin:0;padding:0;box-shadow:none}'+
     '.ua-doc-items,.ua-doc-client-grid,.ua-doc-header{break-inside:avoid}}'+
   '@media screen and (max-width:690px){.ua-doc-page{width:100%;margin:0;padding:20px}'+
      '.ua-doc-header{gap:10px}.ua-doc-logo{max-width:100px}.ua-doc-company{font-size:9px}'+
      '.ua-doc-client-grid{grid-template-columns:1fr}.ua-doc-client-right{text-align:left}.ua-doc-controls{padding:10px}}';
 }
 salesPrint=function(order,type){
  if(!order)return;
  try{
   const html=htmlForSale(order,type);
   const w=window.open('','_blank');
   if(!w){alert('O navegador bloqueou a janela do PDF. Permita pop-ups para a OFICINA.');return}
   w.document.open();w.document.write(html);w.document.close();w.focus();
  }catch(error){alert('Não foi possível preparar o documento: '+String(error?.message||error))}
 };
 window.universaArtDocumentoPadrao={htmlForSale,printStyle,logoSrc};
})();
