'use strict';
/*
 * OFICINA 1.0 — contrato oficial da UNIVERSA ART DESIGN.
 * Estrutura do contrato fornecida pelo usuário em 11/11/2026:
 * compra e venda de móveis sob medida com reserva de domínio, 15 cláusulas.
 * Usa exclusivamente dados já cadastrados, sem modificar pedidos, financeiro
 * ou estoque. Mantém modelo personalizado antigo por opção explícita.
 */
(function(){
 const printOriginal=contractPrint;
 const safe=v=>esc(String(v??''));
 const nonempty=(v,fallback='')=>String(v??'').trim()||fallback;
 const digits=v=>String(v??'').replace(/\D/g,'');
 const BRmoney=v=>money(Number(v)||0);
 const BRdate=value=>{
   if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value||'')))return '';
   const d=new Date(value+'T12:00:00Z');
   if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==value)return '';
   return new Intl.DateTimeFormat('pt-BR',{timeZone:'UTC',day:'2-digit',month:'2-digit',year:'numeric'}).format(d);
 };
 const dateLong=value=>{
   if(!BRdate(value))return 'data a confirmar';
   return new Intl.DateTimeFormat('pt-BR',{timeZone:'UTC',weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date(value+'T12:00:00Z'));
 };
 const para=text=>'<p>'+text+'</p>';
 const H=label=>'<h2 class="ua-contract-heading">'+safe(label)+'</h2>';
 const clause=(n,body)=>'<div class="ua-contract-clause"><p><strong>Cláusula '+n+'ª.</strong> '+body+'</p></div>';
 const note=text=>'<p class="ua-contract-sub">'+text+'</p>';
 const fallbackCompany={
   nome:'UNIVERSA ART DESIGN',cnpj:'55.223.652/0001-87',
   endereco:'Rua São Judas Tadeu, 617A - Vila Marcelo - São Paulo/SP',
   email:'universautils@gmail.com',telefone:'11985218203'
 };
 function companyInfo(){
  const c=db.company||{};
  // O nome padrão anterior não era a razão social do contrato fornecido.
  return {
   nome:nonempty(c.nome)&&!/^universa art$/i.test(c.nome)?c.nome:fallbackCompany.nome,
   cnpj:nonempty(c.cnpj,fallbackCompany.cnpj),
   endereco:nonempty(c.endereco,fallbackCompany.endereco),
   email:nonempty(c.email,fallbackCompany.email),
   telefone:nonempty(c.telefone,fallbackCompany.telefone),
   logo:c.logo
  };
 }
 function clientAddress(c){
  const street=[nonempty(c.endereco),nonempty(c.numero)].filter(Boolean).join(', ');
  const complement=nonempty(c.complemento);
  const city=[nonempty(c.cidade),nonempty(c.uf)].filter(Boolean).join('/');
  return [street,complement,nonempty(c.bairro),city,c.cep?'CEP '+String(c.cep):''].filter(Boolean).join(' - ');
 }
 function logoUrl(){
  const raw=String(db.company?.logo||'');
  if(db.company?.logoPersonalizado===true&&/^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(raw))return raw;
  return new URL('assets/universa-art-logo-novo.webp',location.href).href;
 }
 function installments(o){
  // Usa o mesmo motor do Financeiro; não reconstrói parcelamentos na mão.
  const rows=buildInstallments(orderTotal(o),o.payment,o);
  return rows.map((r,i)=>({
   index:i+1,label:nonempty(r.label,'Parcela '+(i+1)),
   due:BRdate(r.date)||'A confirmar',value:BRmoney(r.valor),
   observation:nonempty(o.payment?.forma,'A combinar')
  }));
 }
 function docControl(o){
  const code=nonempty(o.controlCode);
  return code?/^PED-/i.test(code)?code.slice(4):code:'Número a confirmar';
 }
 function pendingInfo(o,client,installments){
  const pending=[];
  if(!nonempty(client?.nome||o.clientNome))pending.push('nome do contratante');
  if(!nonempty(client?.doc))pending.push('CPF/CNPJ do contratante');
  if(!client||!clientAddress(client))pending.push('endereço do contratante');
  if(!BRdate(o.entregaData))pending.push('data prevista de entrega');
  if(!BRdate(o.date))pending.push('data do contrato');
  if(!Array.isArray(o.items)||!o.items.length)pending.push('itens do pedido');
  if(!installments.length||installments.some(r=>r.due==='A confirmar'))pending.push('vencimento das parcelas');
  return pending;
 }
 function htmlForContract(o){
  if(!o||!Array.isArray(o.items))throw Error('O pedido não possui itens válidos.');
  const client=getClient(o.clientId);
  const company=companyInfo();
  const number=docControl(o);
  const total=BRmoney(orderTotal(o));
  const paymentRows=installments(o);
  const pending=pendingInfo(o,client,paymentRows);
  const name=nonempty(client?.nome||o.clientNome,'NOME A PREENCHER');
  const clientDoc=nonempty(client?.doc,'CPF/CNPJ A PREENCHER');
  const clientAddressString=clientAddress(client||{})||'ENDEREÇO A PREENCHER';
  const telephone=nonempty(client?.telefone);
  const clientEmail=nonempty(client?.email);
  const project=nonempty(o.projectNome);
  const items=(o.items||[]).map((i,index)=>{
   const qty=Number(i.quantidade)||0;
   const price=Number(i.preco)||0;
   return '<tr><td>'+String(index+1)+'</td><td>'+safe(nonempty(i.descricao,'Item '+(index+1)))+'</td>'+
    '<td class="ua-num">'+safe(dec(qty))+'</td><td class="ua-num">'+safe(BRmoney(price))+'</td>'+
    '<td class="ua-num">'+safe(BRmoney(qty*price))+'</td></tr>';
  }).join('');
  const payments=paymentRows.map(r=>'<tr><td>'+r.index+'º</td><td>'+safe(r.observation)+'</td>'+
    '<td>'+safe(r.due)+'</td><td class="ua-num">'+safe(r.value)+'</td><td>'+safe(r.label)+'</td></tr>').join('');
  const deadline=BRdate(o.entregaData)||'____/____/________';
  const dateFooter=nonempty(o.date)?dateLong(o.date):'data a confirmar';
  const projectText=project?para('<strong>Projeto vinculado:</strong> '+safe(project)):'';
  const serviceDescription=nonempty(o.ambientes);
  const notes=nonempty(o.observacoes);
  const signDate='São Paulo/SP, '+dateFooter+'.';
  const contractTitle='CONTRATO DE COMPRA E VENDA DE MÓVEIS SOB MEDIDA COM RESERVA DE DOMÍNIO';
  const signature=window.universaArtAssinatura?.image?.('ua-contract-sig-img')||'';
  const header='<header class="ua-contract-header"><div class="ua-contract-brand">'+
   '<img class="ua-contract-logo" alt="Logotipo UNIVERSA ART" src="'+safe(logoUrl())+'">'+
   '<div><h1>'+safe(company.nome)+'</h1><p>CNPJ: '+safe(company.cnpj)+'</p>'+
   '<p>'+safe(company.endereco)+'</p><p>E-mail: '+safe(company.email)+' | Tel.: '+safe(company.telefone)+'</p></div></div>'+
   '<div class="ua-contract-title"><h2>'+contractTitle+'</h2><strong>Nº '+safe(number)+'</strong></div></header>';
  const sections=[
   H('IDENTIFICAÇÃO DAS PARTES CONTRATANTES'),
   para('<strong>CONTRATANTE:</strong> '+safe(name)+', CPF/CNPJ: '+safe(clientDoc)+', com endereço em '+safe(clientAddressString)+'.'+
      (telephone?' Telefone: '+safe(telephone)+'.':'')+(clientEmail?' E-mail: '+safe(clientEmail)+'.':'')),
   para('<strong>CONTRATADA:</strong> '+safe(company.nome)+', pessoa jurídica de direito privado, inscrita sob o CNPJ nº '+safe(company.cnpj)+
      ', com endereço em '+safe(company.endereco)+'.'),
   H('DADOS DOS SERVIÇOS'),
   para('<strong>SERVIÇO:</strong> Produção/Instalação'+(serviceDescription?' · Ambiente(s): '+safe(serviceDescription):'')+'.'),
   projectText,
   '<table class="ua-contract-table ua-items"><thead><tr><th>Nº</th><th>Descrição dos móveis/serviços</th><th>Qtd.</th><th>Unitário</th><th>Subtotal</th></tr></thead>'+
    '<tbody>'+items+'</tbody><tfoot><tr><td colspan="4">Valor total do pedido (incluindo descontos e frete)</td><td class="ua-num">'+safe(total)+'</td></tr></tfoot></table>',
   H('DO OBJETO DO CONTRATO'),
   clause('1','O presente contrato tem como OBJETO a compra e venda de móveis sob medida 100% MDF da marcenaria '+safe(company.nome)+
    ', que serão devidamente montados e instalados pela CONTRATADA no endereço indicado pelo CONTRATANTE, de acordo com os projetos apresentados pela '+safe(company.nome)+'.'),
   note('<strong>Parágrafo quarto:</strong> Todos os móveis serão fabricados e montados de acordo com o projeto apresentado pelo(a) Ademir J. de Araujo e aceitos pelo cliente.'),
   clause('2','Obriga-se a CONTRATADA a efetuar a entrega até o dia <strong>'+safe(deadline)+
    '</strong>, com o prazo máximo de <strong>'+safe(Number(o.montagemDiasUteis)>0?Number(o.montagemDiasUteis):1)+
    ' dia(s) útil(eis)</strong> para montagem. Se houver alteração da data de entrega ou montagem por motivo maior de ambas as partes, deverão ser comunicadas com 05 dias de antecedência por e-mail, WhatsApp ou comunicado por escrito.'),
   note('<strong>Parágrafo único:</strong> Caso ocorra atraso da entrega por conta das obras civis em geral, será remarcada uma nova data de entrega com prazo máximo de 30 dias úteis.'),
   clause('3','O CONTRATANTE fica responsável por entregar a planta hidráulica e elétrica do imóvel, para evitar problemas com encanamentos ou descargas elétricas decorrentes da fixação dos móveis. Caso não seja fornecida, a CONTRATADA ficará isenta dos danos que possam ocorrer por essa falta, observadas as responsabilidades legais.'),
   note('<strong>Parágrafo único:</strong> O presente contrato não inclui instalações hidráulicas e elétricas relativas aos móveis montados pela CONTRATADA. A instalação de eletrônicos e eletrodomésticos será cobrada como serviço extra, a ser acertado diretamente com o responsável pela montagem.'),
   clause('4','A CONTRATADA executará os serviços com material de qualidade e excelente padrão de acabamento, fornecendo <strong>GARANTIA CONTRATUAL DE 1 ANO</strong> para os produtos fornecidos e fabricados pela CONTRATADA, complementar à garantia legal aplicável.'),
   note('<strong>Parágrafo primeiro:</strong> A garantia contratual não cobre danos decorrentes das seguintes situações, sem prejuízo dos direitos assegurados por lei:'),
   '<ul><li>Uso inadequado, acidentes, impactos, quedas e ações naturais.</li>'+
   '<li>Manchas na pintura causadas por agentes químicos, abrasivos ou produtos de limpeza inadequados.</li>'+
   '<li>Chuvas, inundações, infiltrações de umidade ou exposição inadequada do produto.</li>'+
   '<li>Consertos ou alterações por profissionais não autorizados pela '+safe(company.nome)+'.</li>'+
   '<li>Transporte inadequado, desgaste natural ou excesso de peso.</li>'+
   '<li>Danos causados por insetos, especialmente cupins.</li></ul>',
   note('<strong>Parágrafo segundo:</strong> Em ambientes com armários de bancada, a garantia contratual específica contra oxidação é de 6 (seis) meses para corrediças e dobradiças metálicas de aço zincado, sem prejuízo da garantia legal.'),
   clause('5','O CONTRATANTE deverá deixar o local das instalações totalmente limpo e livre de móveis ou quaisquer objetos que possam impossibilitar a montagem dos móveis pelos funcionários (montadores) da CONTRATADA.'),
   note('<strong>Parágrafo primeiro:</strong> O CONTRATANTE compromete-se a fornecer aos montadores, caso necessário e previamente combinado, o material elétrico e hidráulico necessário para a montagem, tais como cabos, fios, canos, fita isolante, fontes elétricas, fitas e luminárias LED, veda-rosca e cola de cano.'),
   note('<strong>Parágrafo segundo:</strong> Ao final do serviço, a CONTRATADA compromete-se a deixar o local limpo de restos de madeira e embalagens dos móveis instalados.'),
   clause('6','A CONTRATADA responsabiliza-se por avarias ocorridas nas paredes e portas durante a montagem dos móveis, desde que identificadas por ambas as partes, por escrito, no ato do ocorrido, ressalvadas as responsabilidades legalmente previstas e a simples pintura final como acabamento de decoração.'),
   clause('7','O CONTRATANTE, no momento da montagem, não poderá solicitar diretamente aos funcionários (montadores) da CONTRATADA modificações do projeto aprovado.'),
   note('<strong>Parágrafo único:</strong> Caso seja necessária alguma modificação do projeto no ato da montagem, a CONTRATADA deverá ser comunicada por escrito, ainda que por correio eletrônico, para modificação do projeto e eventual reajuste no valor do contrato.'),
   note('<strong>Inciso I:</strong> Decorações, eletrodomésticos, eletroeletrônicos, iluminações, mármores, granitos, móveis extras não inclusos no objeto deste contrato, cortinas e papéis de parede têm efeito meramente decorativo e não fazem parte da negociação.'),
   note('<strong>Parágrafo único:</strong> O CONTRATANTE fica ciente de que o cumprimento do prazo de entrega da Cláusula 2ª está vinculado ao pagamento do valor de entrada, dentro do prazo combinado.'),
   H('DO PAGAMENTO'),
   clause('8','O CONTRATANTE obriga-se a efetuar o pagamento no valor de <strong>'+safe(total)+
    '</strong>, na seguinte forma de pagamento:'),
   '<table class="ua-contract-table ua-payments"><thead><tr><th>Nº</th><th>Forma de pagamento</th><th>Vencimento</th><th>Valor</th><th>Obs.</th></tr></thead><tbody>'+payments+'</tbody></table>',
   H('DAS PENALIDADES'),
   clause('9','O atraso no pagamento acarretará multa moratória de 2% (dois por cento) sobre o valor da parcela em atraso, observada a legislação aplicável.'),
   H('DA RESERVA DE DOMÍNIO'),
   clause('10','Em virtude da reserva de domínio estabelecida neste instrumento, fica reservado à CONTRATADA o direito de propriedade dos móveis sob medida objeto do contrato até a total quitação do valor estabelecido na Cláusula 8ª, observados os requisitos legais para validade e oposição a terceiros.'),
   H('DA CONSERVAÇÃO E USO DOS BENS'),
   clause('11','Enquanto não for pago o valor total da Cláusula 8ª, o CONTRATANTE obriga-se a zelar pela conservação dos móveis, providenciando os recursos necessários à sua manutenção, correndo seus custos por sua conta. Deve preservar sua aparência e funcionamento e não alterar sua estrutura sem autorização ou participação da CONTRATADA, de modo que não desvirtue seu uso ou características.'),
   H('DO INADIMPLEMENTO'),
   clause('12','Em caso de inadimplemento da última parcela prevista na Cláusula 8ª, cabe à CONTRATADA, em razão do pacto com reserva de domínio, buscar as medidas judiciais cabíveis relativas à cobrança ou recuperação dos bens, após constituição em mora e conforme os requisitos legais.'),
   clause('13','As partes estabelecem cláusula penal de 2% (dois por cento) sobre o valor total do contrato, corrigido monetariamente pelo INPC e com juros de mora de 1% ao mês, assim como honorários advocatícios legalmente cabíveis, para a parte que descumprir compromissos assumidos, observados os limites legais.'),
   H('DISPOSIÇÕES FINAIS'),
   clause('14','Fica estabelecido que este contrato tenha vigência até a data da entrega final da mercadoria, devidamente acompanhada de recibo de entrega (“checklist”), permanecendo aplicáveis após a entrega as condições de compra e venda com reserva de domínio e a garantia prevista na Cláusula 4ª, conforme seus prazos e condições.'),
   H('DO FORO'),
   clause('15','Para dirimir controvérsias oriundas deste contrato, as partes elegem o foro da comarca de São Paulo/SP, desde que respeitadas as regras legais de competência e proteção do consumidor.'),
   notes?'<section class="ua-contract-notes">'+H('OBSERVAÇÕES DO PEDIDO')+para(safe(notes))+'</section>':'',
   para('Por estarem assim justos e contratados, firmam o presente instrumento em duas vias de igual teor, juntamente com duas testemunhas.'),
   '<div class="ua-contract-date">'+safe(signDate)+'</div>',
   '<section class="ua-contract-sign"><div>'+signature+'<span class="ua-contract-line"></span>'+
     '<strong>'+safe(company.nome)+'</strong><span>CNPJ: '+safe(company.cnpj)+'</span><span>CONTRATADA</span></div>'+
     '<div><span class="ua-contract-line"></span><strong>'+safe(name)+'</strong><span>CPF/CNPJ: '+safe(clientDoc)+'</span><span>CONTRATANTE</span></div></section>',
   '<div class="ua-contract-witness"><div><span class="ua-contract-line"></span><span>Testemunha 1</span><span>Nome: _______________________________</span><span>CPF: ________________________________</span></div>'+
     '<div><span class="ua-contract-line"></span><span>Testemunha 2</span><span>Nome: _______________________________</span><span>CPF: ________________________________</span></div></div>'
  ].filter(Boolean).join('\n');
  return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">'+
   '<meta name="viewport" content="width=device-width,initial-scale=1">'+
   '<title>'+safe('Contrato '+number+' — UNIVERSA ART DESIGN')+'</title>'+
   '<style>'+contractCSS()+'</style></head><body>'+
   '<div class="ua-contract-actions"><button type="button" onclick="window.print()">Imprimir / Salvar PDF</button>'+
    '<button type="button" onclick="window.close()">Fechar</button>'+
    '<small>Revise os dados e cláusulas antes de assinar. Na impressão, selecione “Salvar como PDF”.</small></div>'+
   '<main class="ua-contract-page">'+
     (pending.length?'<div class="ua-contract-pending"><strong>RASCUNHO — DADOS PENDENTES:</strong> '+safe(pending.join(', '))+'. Confira antes da assinatura.</div>':'')+
     header+sections+
     '<footer class="ua-contract-footer">UNIVERSA ART DESIGN · Contrato nº '+safe(number)+' · Documento emitido pela OFICINA 1.0</footer>'+
   '</main></body></html>';
 }
 function contractCSS(){return [
  '@page{size:A4;margin:16mm 13mm 18mm;}',
  '*{box-sizing:border-box;}',
  'html{background:#edf1ed;}body{margin:0;color:#212121;font:10pt/1.52 Arial,Helvetica,sans-serif;}',
  '.ua-contract-page{width:210mm;max-width:100%;min-height:297mm;margin:20px auto;background:#fff;padding:16mm 16mm 20mm;box-shadow:0 8px 22px #10201822;}',
  '.ua-contract-header{border-bottom:2px solid #244d3b;padding-bottom:7mm;}',
  '.ua-contract-brand{display:flex;align-items:flex-start;gap:16px;}',
  '.ua-contract-logo{max-width:26mm;max-height:24mm;object-fit:contain;}',
  '.ua-contract-brand h1{font-size:13pt;color:#153d30;letter-spacing:.7px;margin:0 0 3px;}',
  '.ua-contract-brand p{margin:2px 0;font-size:8.4pt;}',
  '.ua-contract-title{text-align:center;margin-top:6mm;}',
  '.ua-contract-title h2{font-size:11.2pt;line-height:1.35;margin:0 0 3px;}',
  '.ua-contract-title strong{font-size:11pt;}',
  '.ua-contract-heading{font-size:10.1pt;font-weight:800;margin:8mm 0 3mm;text-transform:uppercase;break-after:avoid;}',
  '.ua-contract-clause,.ua-contract-sub{break-inside:avoid;}',
  '.ua-contract-page p{margin:5px 0;text-align:justify;overflow-wrap:anywhere;}',
  '.ua-contract-page ul{margin:6px 0 9px;padding-left:23px;}',
  '.ua-contract-page li{margin:5px 0;break-inside:avoid;}',
  '.ua-contract-table{width:100%;border-collapse:collapse;margin:5mm 0;font-size:8.2pt;}',
  '.ua-contract-table thead{display:table-header-group;}',
  '.ua-contract-table tr{break-inside:avoid;}',
  '.ua-contract-table th,.ua-contract-table td{border:1px solid #bac4bd;padding:6px 6px;text-align:left;vertical-align:top;overflow-wrap:anywhere;}',
  '.ua-contract-table th{background:#e7eee8;color:#193d30;font-weight:700;}',
  '.ua-contract-table tfoot{font-weight:800;background:#f2f6f2;}',
  '.ua-contract-table .ua-num{text-align:right;white-space:nowrap;}',
  '.ua-contract-date{text-align:right;font-weight:600;margin:14mm 0 9mm;}',
  '.ua-contract-sign,.ua-contract-witness{display:grid;grid-template-columns:1fr 1fr;gap:12mm;margin-top:19mm;break-inside:avoid;}',
  '.ua-contract-sign>div,.ua-contract-witness>div{text-align:center;min-width:0;}',
  '.ua-contract-sign span,.ua-contract-witness span{display:block;font-size:8.5pt;overflow-wrap:anywhere;}',
  '.ua-contract-sign strong{display:block;font-size:9.5pt;margin-top:5px;}',
  '.ua-contract-sig-img{display:block;width:auto;max-width:75mm;max-height:18mm;object-fit:contain;margin:0 auto -3mm;}',
  '.ua-contract-line{display:block;border-top:1px solid #222;margin:5mm 0 5px;}',
  '.ua-contract-witness{margin-top:12mm;}',
  '.ua-contract-footer{margin-top:12mm;border-top:1px solid #d6e2d7;padding-top:5px;font-size:8pt;color:#56665d;}',
  '.ua-contract-pending{background:#fff0de;border:1px solid #dbb468;border-radius:7px;padding:9px 12px;margin-bottom:10mm;font-size:9pt;color:#764c19;}',
  '.ua-contract-actions{max-width:210mm;margin:16px auto;display:flex;flex-wrap:wrap;align-items:center;gap:10px;font:12px Arial,sans-serif;}',
  '.ua-contract-actions button{padding:10px 14px;border:0;border-radius:8px;background:#1b533d;color:#fff;cursor:pointer;}',
  '.ua-contract-actions button+button{background:#fff;color:#1b533d;border:1px solid #c8d8cc;}',
  '.ua-contract-actions small{color:#59675d;}',
  '@media print{html,body{background:#fff;}body{margin:0;}',
   '.ua-contract-actions{display:none!important;}',
   '.ua-contract-page{width:auto;max-width:none;min-height:0;margin:0;padding:0;box-shadow:none;}',
   '.ua-contract-header{break-inside:avoid;}',
   '.ua-contract-witness{break-inside:avoid;}}',
  '@media(max-width:690px){.ua-contract-page{width:100%;margin:0;padding:16px;}',
   '.ua-contract-brand{gap:8px;}.ua-contract-logo{max-width:50px;}',
   '.ua-contract-table{font-size:7pt;}.ua-contract-sign,.ua-contract-witness{gap:8px;}',
   '.ua-contract-actions{padding:12px;}}'
 ].join('');}
 contractPrint=function(order){
  if(!order)return;
  if(db.company?.contratoPersonalizado===true&&nonempty(db.company?.contrato)){
   return printOriginal(order);
  }
  try{
   const html=htmlForContract(order);
   const w=window.open('','_blank');
   if(!w){alert('Permita pop-ups da OFICINA para gerar o contrato em PDF.');return}
   w.document.open();w.document.write(html);w.document.close();w.focus();
  }catch(error){alert('Não foi possível preparar o contrato: '+String(error?.message||error))}
 };
 window.universaArtContratoPadrao={htmlForContract,companyInfo,installments,pendingInfo,contractCSS};
})();