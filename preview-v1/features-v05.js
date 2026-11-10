'use strict';
/* OFICINA v0.5 — módulos adicionais. Mantém a chave local da versão 0.3.
   Não cria login ou sincronização simulados. XML é importado localmente, não da SEFAZ. */
const V5_STATUS = {planejamento:'Planejamento',medicao:'Medição',desenho:'Projeto',aprovacao:'Aprovação',producao:'Produção',instalacao:'Instalação',concluido:'Concluído'};
let v5ProjectMode = 'cards';
let v5ProjectSearch = '';
let v5InvoiceSearch = '';
function v5InitData(){
 let changed = false;
 for(const key of ['projects','invoices','orderAttachments']) if(!Array.isArray(db[key])){db[key]=[];changed=true}
 if(!db.seq || typeof db.seq!=='object'){db.seq={};changed=true}
 for(const [key,items] of [['project',db.projects],['invoice',db.invoices]]) if(!Number.isSafeInteger(db.seq[key])||db.seq[key]<1){db.seq[key]=Math.max(1,...items.map(x=>Number(x.number||0)+1));changed=true}
 if(changed)save();
}
function v5FindProject(pid){return db.projects.find(p=>p.id===pid)}
function v5ProjectStatus(s){return V5_STATUS[s]||'Planejamento'}
function v5ProjectCard(p){
 const checks=(p.checklist||[]).filter(x=>x.done).length;
 const all=(p.checklist||[]).length;
 const image=p.image?`<img class="v5-project-photo" src="${esc(p.image)}" alt="Foto do projeto ${esc(p.nome)}">`:'<div class="v5-project-placeholder">▥</div>';
 return `<article class="v5-project-card">${image}<div class="v5-project-details"><div class="v5-between"><strong>${esc(p.nome)}</strong>${pill(v5ProjectStatus(p.status),p.status==='concluido'?'success':'')}</div><div class="muted small">${esc(p.clientNome||'Sem cliente')} · ${esc(p.ambiente||'Ambiente não informado')}</div><div class="v5-measures">${[p.largura,p.altura,p.profundidade].map(x=>Number(x)>0?dec(x):'—').join(' × ')} mm</div><div class="muted small">${esc(p.material||'Material a definir')} · ${esc(p.acabamento||'Acabamento a definir')}</div><div class="muted small">Checklist: ${checks}/${all}</div><div class="row-actions gap-top">${button('Editar','v5-project-edit',p.id,'small')}${button('Etapas','v5-project-check',p.id,'small')}${button('Comparar','v5-project-compare',p.id,'small')}${button('Excluir','v5-project-delete',p.id,'small danger')}</div></div></article>`;
}
function v5ProjectsView(){
 const q=v5ProjectSearch.toLocaleLowerCase('pt-BR');
 const all=db.projects.filter(p=>[p.nome,p.clientNome,p.ambiente,p.material,p.acabamento,p.status].some(s=>String(s||'').toLocaleLowerCase('pt-BR').includes(q)));
 const statusOrder=Object.keys(V5_STATUS);
 const toolbar=`<div class="toolbar"><input id="v5ProjectSearch" class="search" placeholder="Pesquisar projetos..." value="${esc(v5ProjectSearch)}" aria-label="Pesquisar projetos"><div class="actions">${button('Cartões','v5-view-cards','','small')}${button('Lista','v5-view-list','','small')}${button('Etapas','v5-view-kanban','','small')}${button('Exportar CSV','v5-project-export','','small')}${button('+ Novo projeto','v5-project-new','','primary')}</div></div>`;
 let body='';
 if(v5ProjectMode==='cards')body=all.length?`<div class="v5-project-grid">${all.map(v5ProjectCard).join('')}</div>`:'<div class="empty">Nenhum projeto encontrado. Clique em Novo projeto.</div>';
 if(v5ProjectMode==='list')body=table(['Projeto / Cliente','Ambiente / Material','Medidas (mm)','Etapa','Ações'],all.map(p=>td(`<strong>${esc(p.nome)}</strong><div class="muted small">${esc(p.clientNome||'—')}</div>`,`${esc(p.ambiente||'—')}<div class="muted small">${esc(p.material||'')}</div>`,`${dec(p.largura||0)} × ${dec(p.altura||0)} × ${dec(p.profundidade||0)}`,pill(v5ProjectStatus(p.status)),`<div class="row-actions">${button('Editar','v5-project-edit',p.id,'small')}${button('Checklist','v5-project-check',p.id,'small')}${button('Comparar','v5-project-compare',p.id,'small')}</div>`)));
 if(v5ProjectMode==='kanban')body=`<div class="v5-kanban">${statusOrder.map(s=>`<section class="v5-kanban-column"><h3>${V5_STATUS[s]} <span>${all.filter(p=>p.status===s).length}</span></h3>${all.filter(p=>p.status===s).map(p=>`<div class="v5-kanban-item"><strong>${esc(p.nome)}</strong><div class="muted small">${esc(p.clientNome||'')}</div>${button('Editar','v5-project-edit',p.id,'small')}</div>`).join('')}</section>`).join('')}</div>`;
 content.innerHTML=`${intro('Projetos de móveis','Planejamento, medidas, materiais, imagens, checklist e comparação de opções.',`${db.projects.length} projeto(s)`)}${notice()}<section class="panel">${toolbar}${body}<p class="footer-note">Imagens são reduzidas e guardadas somente neste navegador. Utilize fotos fictícias durante os testes.</p></section>`;
 const el=document.querySelector('#v5ProjectSearch');if(el)el.oninput=e=>{const pos=e.target.selectionStart;v5ProjectSearch=e.target.value;v5ProjectsView();const n=document.querySelector('#v5ProjectSearch');n?.focus();n?.setSelectionRange(pos,pos)};
}
function v5ProjectModal(pid=''){
 const old=v5FindProject(pid)||{nome:'',clientId:'',ambiente:'',largura:'',altura:'',profundidade:'',material:'',acabamento:'',status:'planejamento',prazo:'',observacoes:'',optionA:'',optionB:'',priceA:0,priceB:0,checklist:[{label:'Medição',done:false},{label:'Aprovação do desenho',done:false},{label:'Corte',done:false},{label:'Montagem',done:false},{label:'Instalação',done:false}]};
 const clients=`<option value="">Sem cliente definido</option>${db.clients.map(c=>`<option value="${esc(c.id)}" ${c.id===old.clientId?'selected':''}>${esc(c.nome)}</option>`).join('')}`;
 const stages=Object.entries(V5_STATUS).map(([key,label])=>`<option value="${key}" ${key===old.status?'selected':''}>${label}</option>`).join('');
 const fields=`<div class="form-grid"><label class="full">Nome do projeto *<input name="nome" maxlength="140" required value="${esc(old.nome||'')}"></label><label>Cliente<select name="clientId">${clients}</select></label><label>Ambiente<input name="ambiente" maxlength="100" placeholder="Cozinha, quarto, sala..." value="${esc(old.ambiente||'')}"></label><label>Largura (mm)<input type="number" min="0" step="0.1" name="largura" value="${esc(old.largura||'')}"></label><label>Altura (mm)<input type="number" min="0" step="0.1" name="altura" value="${esc(old.altura||'')}"></label><label>Profundidade (mm)<input type="number" min="0" step="0.1" name="profundidade" value="${esc(old.profundidade||'')}"></label><label>Prazo previsto<input type="date" name="prazo" value="${esc(old.prazo||'')}"></label><label>Material principal<input name="material" maxlength="120" value="${esc(old.material||'')}" placeholder="MDF branco TX 15 mm"></label><label>Acabamento<input name="acabamento" maxlength="120" value="${esc(old.acabamento||'')}" placeholder="Carvalho, fosco, amadeirado..."></label><label>Etapa<select name="status">${stages}</select></label><label class="full">Checklist (uma etapa por linha)<textarea rows="5" name="etapas">${esc((old.checklist||[]).map(c=>c.label).join('\n'))}</textarea></label><label>Opção A — descrição<input maxlength="180" name="optionA" value="${esc(old.optionA||'')}"></label><label>Estimativa A (R$)<input type="number" min="0" step="0.01" name="priceA" value="${Number(old.priceA||0)}"></label><label>Opção B — descrição<input maxlength="180" name="optionB" value="${esc(old.optionB||'')}"></label><label>Estimativa B (R$)<input type="number" min="0" step="0.01" name="priceB" value="${Number(old.priceB||0)}"></label><label class="full">Observações<textarea name="observacoes" rows="3">${esc(old.observacoes||'')}</textarea></label><label class="full">Imagem de referência (opcional, até 2 MB)<input type="file" id="v5ProjectImage" accept="image/png,image/jpeg,image/webp"></label></div>`;
 openModal(pid?'Editar projeto':'Novo projeto',fields,(v,dlg)=>{
   const name=v.nome.trim();if(!name)throw Error('Informe o nome do projeto.');
   for(const k of ['largura','altura','profundidade','priceA','priceB'])if(v[k]!==''&&(!Number.isFinite(Number(v[k]))||Number(v[k])<0))throw Error('As medidas e valores precisam ser positivos.');
   const labels=v.etapas.split('\n').map(x=>x.trim()).filter(Boolean).slice(0,30);
   if(labels.some(l=>l.length>110))throw Error('Resuma as descrições do checklist.');
   const checklist=labels.map(label=>({label,done:!!(old.checklist||[]).find(x=>x.label===label)?.done}));
   const client=db.clients.find(c=>c.id===v.clientId);
   const data={...old,id:old.id||id(),number:old.number||db.seq.project++,nome:name,clientId:client?.id||'',clientNome:client?.nome||'',ambiente:v.ambiente.trim(),material:v.material.trim(),acabamento:v.acabamento.trim(),status:v.status,prazo:v.prazo,largura:Number(v.largura)||0,altura:Number(v.altura)||0,profundidade:Number(v.profundidade)||0,optionA:v.optionA.trim(),optionB:v.optionB.trim(),priceA:round(v.priceA),priceB:round(v.priceB),observacoes:v.observacoes,checklist};
   const image=dlg.dataset.v5Image;if(image)data.image=image;
   if(pid){Object.assign(old,data)}else db.projects.push(data);
   return save();
 },dlg=>{
   const image=dlg.querySelector('#v5ProjectImage');image.addEventListener('change',async()=>{
    const f=image.files?.[0];if(!f)return;if(!['image/png','image/jpeg','image/webp'].includes(f.type)||f.size>2e6){alert('Use PNG, JPG ou WEBP de até 2 MB.');image.value='';return}
    try{const src=URL.createObjectURL(f),img=new Image();img.onload=()=>{const scale=Math.min(1,640/img.width,480/img.height),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);const data=canvas.toDataURL('image/jpeg',.65);URL.revokeObjectURL(src);if(data.length>145000){alert('Imagem ainda muito grande; use uma foto menor.');return}dlg.dataset.v5Image=data};img.onerror=()=>{URL.revokeObjectURL(src);alert('Imagem inválida.')};img.src=src}catch(e){alert('Não foi possível ler a imagem.')}})
 });
}
function v5DeleteProject(pid){if(!confirm('Excluir este projeto e seus dados locais?'))return;db.projects=db.projects.filter(p=>p.id!==pid);save();render('projetos')}
function v5Checklist(pid){const p=v5FindProject(pid);if(!p)return;const checks=(p.checklist||[]);const rows=checks.map((item,i)=>`<label class="v5-check"><input type="checkbox" data-v5-check="${i}" ${item.done?'checked':''}> ${esc(item.label)}</label>`).join('');openModal('Checklist — '+p.nome,`<div class="v5-checklist">${rows||'<p>Nenhuma etapa cadastrada.</p>'}</div>`,(_v,dlg)=>{checks.forEach((item,i)=>item.done=!!dlg.querySelector(`[data-v5-check="${i}"]`)?.checked);return save()});}
function v5Compare(pid){const p=v5FindProject(pid);if(!p)return;const rows=[['Materiais / acabamento',p.optionA||'Não informado',p.optionB||'Não informado'],['Custo estimado',money(p.priceA||0),money(p.priceB||0)],['Diferença',p.priceA&&p.priceB?money(Math.abs(p.priceA-p.priceB)):'—','']];openModal('Comparar opções — '+p.nome,`<p class="muted">Compare alternativas do mesmo móvel antes de aprovar o projeto.</p>${table(['Critério','Opção A','Opção B'],rows.map(a=>td(...a.map(esc))))}`,()=>true)}
function v5ExportProjects(){exportCsv(`oficina-projetos-${iso()}.csv`,['Projeto','Cliente','Ambiente','Largura mm','Altura mm','Profundidade mm','Material','Acabamento','Etapa','Prazo','Alternativa A','Valor A','Alternativa B','Valor B'],db.projects.map(p=>[p.nome,p.clientNome,p.ambiente,p.largura,p.altura,p.profundidade,p.material,p.acabamento,v5ProjectStatus(p.status),date(p.prazo),p.optionA,p.priceA,p.optionB,p.priceB]))}

function v5ConverterView(){
 content.innerHTML=
  intro('Conversor métrico','Padrão brasileiro: milímetros (mm), centímetros (cm) e metros (m).')+
  '<div class="v5-split"><section class="panel"><h3>Converter medida</h3>'+
  '<p class="muted">Informe uma medida e escolha a unidade. Aceita vírgula decimal, como 2,45.</p>'+
  '<label class="v5-label">Medida<input id="v5MetricValue" type="text" inputmode="decimal" placeholder="Ex.: 2,45" value="1,60"></label>'+
  '<label class="v5-label">Unidade de origem<select id="v5MetricUnit"><option value="m">Metros (m)</option><option value="cm">Centímetros (cm)</option><option value="mm">Milímetros (mm)</option></select></label>'+
  '<div class="actions gap-top">'+button('Converter medida','v5-convert-metric','','primary')+'</div>'+
  '<output id="v5MetricResult" class="v5-convert-output" aria-live="polite">1.600 mm = 160 cm = 1,6 m</output></section>'+
  '<section class="panel"><h3>Medidas para fabricação</h3>'+
  '<p class="muted">Nos projetos, listas de peças e ordens de produção da Universalartes, registre largura, altura, profundidade e espessura sempre em milímetros.</p>'+
  '<div class="empty">Exemplo: armário de 1,60 m × 2,10 m × 0,55 m → <strong>1.600 × 2.100 × 550 mm</strong>.</div>'+
  '</section></div>'+
  '<section class="panel gap-top"><h3>Referências rápidas da marcenaria</h3>'+
  table(['Metros','Centímetros','Milímetros'],[['0,30 m','30 cm','300 mm'],['0,45 m','45 cm','450 mm'],['0,55 m','55 cm','550 mm'],['0,60 m','60 cm','600 mm'],['1,20 m','120 cm','1.200 mm'],['1,60 m','160 cm','1.600 mm'],['2,10 m','210 cm','2.100 mm'],['2,75 m','275 cm','2.750 mm']].map(a=>td(...a)))+'</section>';
}
function v5ParseMetric(input){
 const s=String(input??'').trim().replace(/\s/g,'');
 if(!/^\d+(?:[,.]\d+)?$/.test(s))throw Error('Informe uma medida válida, como 2,45 ou 160.');
 const n=Number(s.replace(',','.'));
 if(!Number.isFinite(n)||n<0||n>1000000)throw Error('Informe uma medida entre 0 e 1.000.000.');
 return n;
}
function v5Convert(){
 try{
  const value=v5ParseMetric(document.querySelector('#v5MetricValue').value);
  const unit=document.querySelector('#v5MetricUnit').value;
  if(!['mm','cm','m'].includes(unit))throw Error('Unidade de medida inválida.');
  const mm=value*({mm:1,cm:10,m:1000}[unit]);
  const fmt=n=>n.toLocaleString('pt-BR',{maximumFractionDigits:3});
  document.querySelector('#v5MetricResult').textContent=fmt(mm)+' mm = '+fmt(mm/10)+' cm = '+fmt(mm/1000)+' m';
 }catch(e){alert(e.message||'Não foi possível converter a medida.')}
}
function v5InvoiceView(){const q=v5InvoiceSearch.toLowerCase();const list=db.invoices.filter(n=>[n.numero,n.chave,n.emitente,n.destinatario,n.tipo,n.origem].some(x=>String(x||'').toLowerCase().includes(q))).slice().reverse();content.innerHTML=`${intro('Notas fiscais','Cadastro manual e importação local de arquivos XML de NF-e.',`${db.invoices.length} nota(s)`)}${notice()}<section class="panel"><div class="toolbar"><input id="v5InvoiceSearch" class="search" placeholder="Pesquisar NF, emitente ou chave..." value="${esc(v5InvoiceSearch)}"><div class="actions">${button('Importar XML','v5-invoice-xml')}${button('+ Nota manual','v5-invoice-new','','primary')}</div></div>${table(['Número / Data','Emitente','Destinatário','Valor','Origem','Ações'],list.map(n=>td(`<strong>${esc(n.numero||'—')}</strong><div class="muted small">${date(n.data)}</div>`,esc(n.emitente||'—'),esc(n.destinatario||'—'),money(n.valor),pill(n.origem==='XML'?'Importação XML':'Manual'),button('Excluir','v5-invoice-delete',n.id,'small danger'))),'Nenhuma nota fiscal registrada.')}</section><p class="footer-note">Este módulo não emite notas fiscais, não valida autorização na SEFAZ e não importa documentos diretamente de serviços fiscais. As informações são apenas registradas no navegador.</p>`;
 const el=document.querySelector('#v5InvoiceSearch');el.oninput=e=>{const pos=e.target.selectionStart;v5InvoiceSearch=e.target.value;v5InvoiceView();const n=document.querySelector('#v5InvoiceSearch');n.focus();n.setSelectionRange(pos,pos)}}
function v5InvoiceModal(){openModal('Registrar nota fiscal',`<div class="form-grid"><label>Número *<input name="numero" required maxlength="30"></label><label>Data de emissão *<input name="data" type="date" value="${iso()}" required></label><label>Tipo<select name="tipo"><option value="entrada">Entrada</option><option value="saida">Saída</option></select></label><label>Valor (R$) *<input type="number" min="0" step="0.01" name="valor" required></label><label>Emitente<input name="emitente" maxlength="160"></label><label>Destinatário<input name="destinatario" maxlength="160"></label><label class="full">Chave de acesso (se houver)<input name="chave" maxlength="44" pattern="[0-9]{44}" placeholder="44 dígitos"></label><label class="full">Observações<textarea name="observacoes" rows="3"></textarea></label></div>`,v=>{
 const numero=v.numero.trim(),valor=Number(v.valor);if(!numero||!Number.isFinite(valor)||valor<0)throw Error('Número e valor são obrigatórios e precisam ser válidos.');if(v.chave&&db.invoices.some(n=>n.chave===v.chave))throw Error('Já existe nota com esta chave de acesso.');db.invoices.push({...v,id:id(),number:db.seq.invoice++,numero,valor:round(valor),origem:'Manual'});return save()})}
function v5InvoiceXml(){const el=document.createElement('input');el.type='file';el.accept='.xml,application/xml,text/xml';el.onchange=async()=>{const f=el.files?.[0];if(!f)return;if(f.size>2e6)return alert('Arquivo XML acima de 2 MB.');try{const raw=await f.text();if(/<!DOCTYPE|<!ENTITY/i.test(raw))throw Error('O arquivo contém declarações XML não permitidas.');const xml=new DOMParser().parseFromString(raw,'application/xml');if(xml.getElementsByTagName('parsererror').length)throw Error('XML inválido.');const first=(parent,tag)=>parent?.getElementsByTagName(tag)?.[0]||null;const txt=(parent,tag)=>first(parent,tag)?.textContent?.trim()||'';const info=first(xml,'infNFe');if(!info)throw Error('Não encontrei infNFe de uma NF-e neste XML.');const ide=first(info,'ide'),emit=first(info,'emit'),dest=first(info,'dest'),tot=first(info,'ICMSTot');const chave=(info.getAttribute('Id')||'').replace(/^NFe/,'');const numero=txt(ide,'nNF'),emissao=txt(ide,'dhEmi')||txt(ide,'dEmi'),valor=Number(txt(tot,'vNF'));if(!numero||!Number.isFinite(valor)||valor<0)throw Error('Faltam número ou valor total válidos.');if(chave&&db.invoices.some(n=>n.chave===chave))throw Error('Nota já importada (chave de acesso duplicada).');const nome=txt(emit,'xNome'),destName=txt(dest,'xNome');if(!confirm(`Importar NF-e ${numero}\nEmitente: ${nome}\nTotal: ${money(valor)}\n\nO sistema não verifica a autorização na SEFAZ.`))return;db.invoices.push({id:id(),number:db.seq.invoice++,numero,data:/^\d{4}-\d\d-\d\d/.test(emissao)?emissao.slice(0,10):iso(),tipo:'entrada',valor:round(valor),emitente:nome,destinatario:destName,chave,observacoes:'Importada de XML local. Autenticidade e autorização não verificadas.',origem:'XML'});save();render('notas');alert('Dados da NF-e importados como registro local.')}catch(e){alert('Falha na importação: '+e.message)}};el.click()}
function v5InvoiceDelete(id){if(!confirm('Excluir este registro de nota fiscal?'))return;db.invoices=db.invoices.filter(n=>n.id!==id);save();render('notas')}
function v5AttachmentsView(){const orders=db.orders.slice().reverse();content.innerHTML=`${intro('Contratos anexados','Associe contratos e documentos PDF aos pedidos.',`${db.orderAttachments.length} anexo(s)`)}${notice()}<section class="panel"><div class="toolbar"><p class="muted">Os anexos pequenos são armazenados apenas neste navegador.</p><div class="actions">${button('+ Anexar contrato','v5-attachment-new','','primary')}</div></div>${table(['Pedido','Documento','Tamanho','Ações'],db.orderAttachments.slice().reverse().map(a=>td(esc('#'+(db.orders.find(o=>o.id===a.orderId)?.number||'—')),esc(a.name),`${Math.round(a.size/1024)} KB`,`<div class="row-actions">${button('Baixar','v5-attachment-download',a.id,'small')}${button('Excluir','v5-attachment-delete',a.id,'small danger')}</div>`)),'Nenhum contrato anexado.')}</section><p class="footer-note">Limite de 150 KB por PDF, apenas para demonstração. Documentos reais exigem armazenamento protegido (como Cloudflare R2 ou Supabase Storage) e controle de acesso.</p>`}
function v5Attach(){if(!db.orders.length)return alert('Cadastre um pedido antes de anexar documentos.');const f=document.createElement('input');f.type='file';f.accept='application/pdf';f.onchange=async()=>{const file=f.files?.[0];if(!file)return;if(file.type!=='application/pdf'||file.size>150000)return alert('Selecione um arquivo PDF de até 150 KB.');const orderId=prompt('Número do pedido ao qual anexar o documento:');const order=db.orders.find(o=>String(o.number)===String(orderId||'').trim());if(!order)return alert('Pedido não encontrado.');try{const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Leitura interrompida.'));reader.readAsDataURL(file)});db.orderAttachments.push({id:id(),orderId:order.id,name:file.name.slice(0,160),size:file.size,data});if(save())render('anexos')}catch(e){alert('Não foi possível anexar: '+e.message)}};f.click()}
function v5AttachmentDownload(attachmentId){
 const a=db.orderAttachments.find(x=>x.id===attachmentId);if(!a)return;
 // Backups JSON podem ser manipulados. Nunca navegar para um endereço arbitrário vindo do backup.
 const value=typeof a.data==='string'?a.data:'';
 const match=/^data:application\/pdf;base64,([A-Za-z0-9+/]+={0,2})$/i.exec(value);
 if(!match||match[1].length>250000)return alert('Anexo inválido ou acima do limite. Aceitamos apenas PDFs armazenados no aplicativo.');
 let bytes;
 try{
  const raw=atob(match[1]);
  if(!raw.slice(0,1024).includes('%PDF-'))throw Error('Assinatura PDF ausente');
  bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
 }catch(e){return alert('Anexo PDF inválido. Não foi aberto.')}
 const url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));
 try{
  const link=document.createElement('a');
  link.href=url;
  link.download=String(a.name||'contrato.pdf').replace(/[\/\\:*?"<>|]/g,'_').slice(0,160)||'contrato.pdf';
  link.click();
 }finally{setTimeout(()=>URL.revokeObjectURL(url),2000)}
}
function v5AttachmentDelete(attachmentId){if(!confirm('Excluir este anexo local?'))return;db.orderAttachments=db.orderAttachments.filter(a=>a.id!==attachmentId);save();render('anexos')}
function v5PaidReceipt(orderId){const o=getOrder(orderId);if(!o||o.status==='cancelado')return alert('Pedido não encontrado ou cancelado.');const total=orderTotal(o),paid=orderPaid(o);if(paid+0.005<total)return alert(`Este pedido ainda não foi totalmente pago. Saldo: ${money(total-paid)}. Um recibo de quitação só pode ser emitido após receber o valor integral.`);const pays=db.transactions.filter(t=>t.orderId===o.id&&t.kind==='receber').flatMap(t=>t.payments||[]).sort((a,b)=>a.date.localeCompare(b.date));const last=pays[pays.length-1]?.date||iso();const client=getClient(o.clientId);openPrint(`Recibo de quitação — Pedido nº ${o.number}`,`<p>Declaramos o recebimento integral de <strong>${esc(client?.nome||o.clientNome)}</strong> do valor de <strong>${money(total)}</strong> referente ao pedido nº ${o.number}.</p><p><strong>Data da quitação:</strong> ${date(last)}<br><strong>Total recebido:</strong> ${money(paid)}<br><strong>Saldo:</strong> ${money(Math.max(0,total-paid))}</p><div class="sign"><div>Assinatura / Responsável</div></div>`)}
// Acopla os novos módulos sem recriar o aplicativo nem alterar a chave dos backups.
v5InitData();
sections.splice(sections.findIndex(x=>x[0]==='produtos'),0,['projetos','▥','Projetos de móveis']);
sections.splice(sections.findIndex(x=>x[0]==='documentos'),0,['conversor','⇄','Conversor métrico'],['notas','▤','Notas fiscais']);
sections.splice(sections.findIndex(x=>x[0]==='empresa'),0,['anexos','▧','Contratos anexados']);
const v5OriginalRender=render;
render=function(section=location.hash.slice(1)||'dashboard'){
 const views={projetos:v5ProjectsView,conversor:v5ConverterView,notas:v5InvoiceView,anexos:v5AttachmentsView};
 if(!Object.prototype.hasOwnProperty.call(views,section))return v5OriginalRender(section);
 const selected=sections.find(x=>x[0]===section);title.textContent=selected[2];
 nav.innerHTML=sections.map(([key,icon,label])=>`<button class="nav-btn ${key===section?'active':''}" data-section="${key}"><span aria-hidden="true">${icon}</span>${label}</button>`).join('');
 nav.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{location.hash=b.dataset.section;sidebar.classList.remove('open');if(location.hash.slice(1)===section)render(section)}));
 views[section]();
};
const v5OldDashboard=dashboardUpgrade;
dashboardUpgrade=function(){v5OldDashboard();const region=document.createElement('section');region.className='panel gap-top';region.innerHTML=`<div class="panel-head"><h3>Projetos e documentos</h3><div class="actions">${button('Ver projetos','v5-go-projects','','small')}${button('Converter medidas','v5-go-converter','','small')}</div></div><div class="v5-summary"><span>Projetos cadastrados: <strong>${db.projects.length}</strong></span><span>Projetos em andamento: <strong>${db.projects.filter(p=>p.status!=='concluido').length}</strong></span><span>Notas registradas: <strong>${db.invoices.length}</strong></span></div>`;content.append(region)};
document.addEventListener('click',e=>{
 const btn=e.target.closest('[data-action^="v5-"]');if(!btn)return;const a=btn.dataset.action, ref=btn.dataset.id||'';
 switch(a){
  case 'v5-project-new':return v5ProjectModal();case 'v5-project-edit':return v5ProjectModal(ref);case 'v5-project-delete':return v5DeleteProject(ref);case 'v5-project-check':return v5Checklist(ref);case 'v5-project-compare':return v5Compare(ref);case 'v5-project-export':return v5ExportProjects();
  case 'v5-view-cards':v5ProjectMode='cards';return render('projetos');case 'v5-view-list':v5ProjectMode='list';return render('projetos');case 'v5-view-kanban':v5ProjectMode='kanban';return render('projetos');
  case 'v5-convert-metric':return v5Convert();
  case 'v5-invoice-new':return v5InvoiceModal();case 'v5-invoice-xml':return v5InvoiceXml();case 'v5-invoice-delete':return v5InvoiceDelete(ref);
  case 'v5-attachment-new':return v5Attach();case 'v5-attachment-download':return v5AttachmentDownload(ref);case 'v5-attachment-delete':return v5AttachmentDelete(ref);
  case 'v5-paid-receipt':return v5PaidReceipt(ref);case 'v5-go-attachments':location.hash='anexos';return render('anexos');
  case 'v5-go-projects':location.hash='projetos';return render('projetos');case 'v5-go-converter':location.hash='conversor';return render('conversor');
 }
});
// Após o registro dos novos menus, atualiza a navegação.
render(location.hash.slice(1)||'dashboard');
// Documentos: inclui acesso ao recibo de quitação integral.
const v5OldDocuments=documentsView;
documentsView=function(){v5OldDocuments();const eligible=db.orders.filter(o=>o.status!=='cancelado'&&orderPaid(o)+0.005>=orderTotal(o)&&orderPaid(o)>0);const section=document.createElement('section');section.className='panel gap-top';section.innerHTML=`<div class="panel-head"><h3>Recibos de quitação integral</h3>${button('Contratos anexados','v5-go-attachments')}</div>${table(['Pedido','Cliente','Total','Ação'],eligible.map(o=>td('#'+esc(o.number),esc(o.clientNome),money(orderTotal(o)),button('Emitir quitação','v5-paid-receipt',o.id,'small'))),'Nenhum pedido totalmente pago ainda.')}`;content.append(section)};