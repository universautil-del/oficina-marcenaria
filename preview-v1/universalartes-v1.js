'use strict';
/* UNIVERSALARTES — OFICINA 1.0 (prévia do painel). Leitura apenas; mantém dados legados. */
(function(){
  const previous = dashboardUpgrade;
  dashboardUpgrade = function universalartesToday(){
    if(typeof db === 'undefined' || !db) return previous();
    const orders = Array.isArray(db.orders) ? db.orders : [];
    const quotes = Array.isArray(db.quotes) ? db.quotes : [];
    const txs = Array.isArray(db.transactions) ? db.transactions : [];
    const projects = Array.isArray(db.projects) ? db.projects : [];
    const mats = (db.products || []).filter(p => p.tipo === 'materia');
    const today = iso();
    const valid = o => o.status !== 'cancelado' && o.status !== 'entregue';
    const open = orders.filter(valid);
    const until = d => d && /^\d{4}-\d\d-\d\d$/.test(d) ? Math.round((new Date(d + 'T12:00:00') - new Date(today + 'T12:00:00')) / 86400000) : null;
    const late = open.filter(o => until(o.entregaData) !== null && until(o.entregaData) < 0);
    const nextWeek = open.filter(o => until(o.entregaData) !== null && until(o.entregaData) >= 0 && until(o.entregaData) <= 7);
    const shortages = open.filter(o => o.stockState === 'pendente');
    const low = mats.filter(p => Number(p.estoque || 0) <= Number(p.minimo || 0));
    const receivables = txs.filter(t => t.kind === 'receber');
    const unpaid = receivables.reduce((s,t) => s + balance(t), 0);
    const overdue = txs.filter(t => t.dueDate && t.dueDate < today && balance(t) > 0.004);
    const sold = orders.filter(o => o.status !== 'cancelado' && String(o.date || '').slice(0,7) === today.slice(0,7)).reduce((s,o) => s + orderTotal(o), 0);
    const work = projects.filter(p => p.status !== 'concluido');
    const plainCard = (title, value, detail, hash, type='') =>
      '<a class="ua-card ' + type + '" href="#' + hash + '"><div class="ua-card-title">' + title + '</div><div class="ua-card-value">' + value + '</div><div class="ua-card-detail">' + detail + ' <span aria-hidden="true">↗</span></div></a>';
    const priority = (label, count, hash, desc, severity) =>
      '<a class="ua-priority ' + severity + '" href="#' + hash + '"><span class="ua-priority-dot"></span><span><strong>' + label + '</strong><small>' + desc + '</small></span><b>' + count + '</b></a>';
    const recent = open.slice().sort((a,b) => String(a.entregaData || '9999').localeCompare(String(b.entregaData || '9999'))).slice(0,6);
    const orderRows = recent.map(o =>
      '<tr><td><strong>#' + esc(o.number) + '</strong><small>' + esc(o.clientNome || 'Cliente não informado') + '</small></td><td>' +
      esc((statusText && statusText[o.status]) || o.status || 'Aberto') + '</td><td>' + (o.entregaData ? date(o.entregaData) : 'A definir') +
      '</td><td>' + money(orderTotal(o)) + '</td></tr>').join('');
    content.innerHTML =
      '<div class="ua-welcome"><div><div class="ua-eyebrow">UNIVERSALARTES · PAINEL DO MARCENEIRO</div>' +
      '<h2>O que precisa da sua atenção hoje?</h2><p>Uma visão da produção, das entregas e do dinheiro da marcenaria.</p></div>' +
      '<a class="ua-help-link" href="#empresa">Minha empresa ↗</a></div>' +
      notice() +
      '<div class="ua-shortcuts"><a href="#assistente">✎ Pedir ajuda no projeto</a><a href="#clientes">+ Cliente</a><a href="#projetos">+ Ver projetos</a><a href="#orcamentos">+ Orçamento</a><a href="#pedidos">Pedidos</a><a href="#producao">Produção</a><a href="#produtos">Estoque</a></div>' +
      '<div class="ua-metrics">' +
        plainCard('Vendas do mês',money(sold),'Pedidos do mês','pedidos') +
        plainCard('Pedidos em andamento',String(open.length),'Produção e entrega','producao') +
        plainCard('Próximas entregas',String(nextWeek.length),'Até 7 dias','producao',nextWeek.length ? 'ua-attention' : '') +
        plainCard('A receber',money(unpaid),'Parcelas pendentes','financeiro') +
        plainCard('Materiais no mínimo',String(low.length),'Ver matérias-primas','produtos',low.length ? 'ua-attention' : '') +
        plainCard('Projetos em aberto',String(work.length),'Medição a aprovação','projetos') +
      '</div>' +
      '<div class="ua-columns"><section class="ua-section"><div class="ua-section-head"><h3>Prioridades da oficina</h3><span>Atualizado pelos registros</span></div>' +
       priority('Entregas atrasadas',late.length,'producao','Pedidos fora do prazo previsto',late.length?'danger':'ok') +
       priority('Entregas nos próximos 7 dias',nextWeek.length,'producao','Organize montagem e instalação',nextWeek.length?'attention':'ok') +
       priority('Pedidos aguardando materiais',shortages.length,'compras','Verifique estoque e compras',shortages.length?'attention':'ok') +
       priority('Contas vencidas',overdue.length,'financeiro','Recebimentos e pagamentos',overdue.length?'attention':'ok') +
       priority('Orçamentos ainda abertos',quotes.filter(q=>q.status==='aberto').length,'orcamentos','Acompanhe retorno dos clientes','ok') +
      '</section><section class="ua-section"><div class="ua-section-head"><h3>Próximos serviços</h3><a href="#producao">Abrir produção ↗</a></div>' +
       (recent.length ? '<div class="ua-table-wrap"><table class="ua-table"><thead><tr><th>Pedido</th><th>Etapa</th><th>Entrega</th><th>Valor</th></tr></thead><tbody>' + orderRows + '</tbody></table></div>' :
         '<div class="ua-no-data">Ainda não há pedidos em produção. Comece cadastrando um cliente e criando um orçamento.</div>') +
      '</section></div>' +
      '<div class="ua-footnote">Esta é uma prévia da interface 1.0. Dados permanecem no modelo local/JSON da versão 0.6 até a migração segura para o banco de dados por empresa.</div>';
  };
  const brand = document.querySelector('.brand strong');
  if (brand) brand.textContent='UNIVERSA ART';
  if ((location.hash.slice(1) || 'dashboard') === 'dashboard') render('dashboard');

  // Ordem de produção impressa: somente consulta, não altera estoque nem status.
  function printProductionOrder(oid){
    const order = getOrder(oid);
    if(!order){alert('Pedido não encontrado.');return;}
    const items = Array.isArray(order.items) ? order.items : [];
    const materials = Array.isArray(order.materials) ? order.materials : [];
    const rows = items.map((item,i) =>
       '<tr><td>' + (i+1) + '</td><td>' + esc(item.descricao||'Item não especificado') +
       '</td><td>' + esc(item.quantidade||0) + '</td><td style="min-width:110px">__________</td></tr>').join('');
    const materialRows = materials.map((m,i)=>{
      const p=getProduct(m.productId);
      return '<tr><td>' + (i+1) + '</td><td>' + esc(p?.nome||'Material não encontrado') +
      '</td><td>' + esc(m.quantidade||0) + ' ' + esc(p?.unidade||'un') + '</td><td>□</td></tr>';
    }).join('');
    const tasks=['Medição conferida e projeto aprovado','Plano de corte conferido','Separação de MDF e ferragens','Corte de peças','Aplicação de fita de borda','Furação e usinagem','Montagem e conferência','Acabamento e limpeza','Conferência final','Transporte e instalação'];
    const checks=tasks.map(t => '<div style="display:inline-block;width:48%;min-width:230px;margin:9px 0">□ '+esc(t)+'</div>').join('');
    const html =
       '<p><b>Pedido:</b> #'+esc(order.number)+' &nbsp; <b>Cliente:</b> '+esc(order.clientNome||'—')+
       '<br><b>Data do pedido:</b> '+date(order.date)+' &nbsp; <b>Entrega prevista:</b> '+
       (order.entregaData?date(order.entregaData):esc(order.entrega||'A definir'))+
       '<br><b>Ambientes:</b> '+esc(order.ambientes||'Não informado')+'</p>'+
       '<h2>1. Móveis / serviços da ordem</h2>'+
       '<table><thead><tr><th>#</th><th>Descrição</th><th>Quantidade</th><th>Visto</th></tr></thead><tbody>'+
       (rows||'<tr><td colspan="4">Nenhum item registrado</td></tr>')+'</tbody></table>'+
       '<h2>2. Materiais previstos</h2>'+
       '<table><thead><tr><th>#</th><th>Material</th><th>Quantidade</th><th>Separado?</th></tr></thead><tbody>'+
       (materialRows||'<tr><td colspan="4">Nenhuma composição vinculada. Conferir projeto e lista de corte.</td></tr>')+'</tbody></table>'+
       '<h2>3. Etapas da oficina</h2><div>'+checks+'</div>'+
       '<h2>4. Conferência e execução</h2>'+
       '<p>Responsável: __________________________________ &nbsp; Início: ___/___/______</p>'+
       '<p>Observações técnicas: '+esc(order.observacoes||'Consultar medidas e desenhos aprovados.')+'</p>'+
       '<p>Conferência final: ______________________________ &nbsp; Data: ___/___/______</p>'+
       '<p style="font-size:12px;color:#666">Importante: esta ordem resume o pedido. Confirme dimensões, espessura, sentido do veio, folgas e desenhos técnicos antes do corte. Este documento não faz baixa de estoque.</p>';
    openPrint('Ordem de produção — Pedido #' + String(order.number), html);
  }
  window.universalartesPrintProductionOrder=printProductionOrder;
  const baseOrdersView=ordersView;
  ordersView = function universalartesOrdersView(){
    baseOrdersView();
    content.querySelectorAll('[data-action="view-order"]').forEach(button=>{
      const id=button.dataset.id;
      const action=document.createElement('button');
      action.type='button';action.className='btn small';action.textContent='Ordem de produção';
      action.addEventListener('click',()=>printProductionOrder(id));
      button.parentElement?.append(action);
    });
  };


  // Assistente de projetos: organiza um pedido para conversa com ChatGPT.
  // Não envia dados a terceiros automaticamente e não é uma integração com a API.
  if(!sections.some(s=>s[0]==='assistente')){
    const p=sections.findIndex(s=>s[0]==='projetos');
    sections.splice(Math.max(p+1,0),0,['assistente','✎','Assistente de projetos']);
  }
  let generatedBrief='';
  function assistantView(){
    const projects=Array.isArray(db.projects)?db.projects:[];
    const projectOptions=projects.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.nome||'Projeto sem nome')+' — '+esc(p.ambiente||'Ambiente')+'</option>').join('');
    content.innerHTML=
      '<div class="ua-welcome"><div><div class="ua-eyebrow">UNIVERSALARTES · ASSISTENTE DE PROJETOS</div><h2>Descreva o móvel que você precisa fabricar</h2>'+
      '<p>Organize o projeto e leve as informações para uma conversa com o ChatGPT.</p></div></div>'+
      '<div class="ua-assistant-grid"><section class="ua-section"><h3>1. Informações do móvel</h3>'+
      '<p class="muted">Use medidas em milímetros (mm). Os campos marcados com * são obrigatórios.</p>'+
      '<form id="uaAssistantForm" class="ua-form">'+
      '<label>Usar projeto cadastrado (opcional)<select name="selectedProject" id="uaAssistantProject"><option value="">Começar um novo briefing</option>'+projectOptions+'</select></label>'+
      '<label>Ambiente *<input name="ambiente" required maxlength="120" placeholder="Ex.: Cozinha, quarto, sala"></label>'+
      '<label>Tipo de móvel *<input name="movel" required maxlength="150" placeholder="Ex.: Armário aéreo, guarda-roupa"></label>'+
      '<div class="ua-form-3"><label>Largura (mm)<input name="largura" inputmode="decimal" placeholder="1600"></label><label>Altura (mm)<input name="altura" inputmode="decimal" placeholder="2100"></label><label>Profundidade (mm)<input name="profundidade" inputmode="decimal" placeholder="550"></label></div>'+
      '<label>Material e espessura<input name="material" maxlength="180" placeholder="Ex.: MDF branco TX de 15 mm"></label>'+
      '<label>Portas, gavetas, nichos e ferragens<textarea name="componentes" maxlength="1800" rows="3" placeholder="Ex.: 4 portas, 2 gavetas, dobradiças com amortecedor"></textarea></label>'+
      '<label>Acabamentos e detalhes<textarea name="acabamento" maxlength="1800" rows="2" placeholder="Ex.: Fitamento de bordas, acabamento amadeirado"></textarea></label>'+
      '<label>Restrições e observações<textarea name="observacoes" maxlength="2400" rows="3" placeholder="Ex.: Pia existente, tomada, parede irregular, espaço do rodapé"></textarea></label>'+
      '<button type="submit" class="btn primary">Preparar pedido para o ChatGPT</button></form></section>'+
      '<section class="ua-section"><h3>2. Pedido técnico organizado</h3><p class="muted">O sistema vai montar um texto com suas informações. Você copia, abre o ChatGPT e anexa as fotos ou desenhos disponíveis.</p>'+
      '<textarea id="uaAssistantOutput" class="ua-generated" aria-label="Pedido técnico para o ChatGPT" readonly placeholder="Preencha o formulário para preparar seu projeto."></textarea>'+
      '<div class="actions gap-top"><button type="button" class="btn" id="uaCopyPrompt" disabled>Copiar pedido</button><a class="btn primary" href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer">Abrir ChatGPT ↗</a></div>'+
      '<div id="uaAssistantStatus" class="muted small" aria-live="polite"></div>'+
      '<div class="empty">Confira todas as medidas na obra antes de fabricar. Um desenho ou plano de corte gerado por IA é uma proposta de trabalho, não substitui a conferência das ferragens, folgas, prumo, esquadro, sentido do veio e tolerâncias.</div>'+
      '</section></div>';
    const form=document.getElementById('uaAssistantForm');
    const status=document.getElementById('uaAssistantStatus');
    form.querySelector('#uaAssistantProject').addEventListener('change',e=>{
      const p=projects.find(x=>x.id===e.target.value);if(!p)return;
      const fields={ambiente:p.ambiente||'',movel:p.nome||'',largura:p.largura||'',altura:p.altura||'',profundidade:p.profundidade||'',material:p.material||'',componentes:p.componentes||'',acabamento:p.acabamento||'',observacoes:p.observacoes||''};
      Object.entries(fields).forEach(([key,val])=>{const input=form.elements.namedItem(key);if(input)input.value=String(val)});
    });
    form.addEventListener('submit',e=>{
      e.preventDefault();
      const values=Object.fromEntries(new FormData(form));
      const parseMeasure=(s,label)=>{
        if(!String(s||'').trim())return 'não informada';
        const raw=String(s).trim().replace(/\s/g,'').replace(',','.');
        if(!/^\d+(?:\.\d+)?$/.test(raw)||Number(raw)<=0||Number(raw)>100000)throw Error(label+': informe um número positivo em mm (ex.: 1600).');
        return String(Number(raw))+' mm';
      };
      try{
        const largura=parseMeasure(values.largura,'Largura'),altura=parseMeasure(values.altura,'Altura'),profundidade=parseMeasure(values.profundidade,'Profundidade');
        generatedBrief=[
          'Estou desenvolvendo um móvel sob medida para a marcenaria Universalartes, no Brasil. Seja meu assistente técnico de projetos de marcenaria.',
          'Use milímetros (mm) em TODAS as medidas e português brasileiro. Não utilize polegadas.',
          '',
          'INFORMAÇÕES DO PROJETO',
          'Ambiente: '+String(values.ambiente||'Não informado').trim(),
          'Móvel: '+String(values.movel||'Não informado').trim(),
          'Largura: '+largura,
          'Altura: '+altura,
          'Profundidade: '+profundidade,
          'Material e espessura: '+String(values.material||'não informado').trim(),
          'Divisões e ferragens: '+String(values.componentes||'não informado').trim(),
          'Acabamentos: '+String(values.acabamento||'não informado').trim(),
          'Restrições no local: '+String(values.observacoes||'não informado').trim(),
          '',
          'QUERO SUA AJUDA PARA:',
          '1. Fazer as perguntas essenciais que faltam ANTES de definir dimensões de corte ou ferragens.',
          '2. Propor um layout funcional do móvel e uma sequência de montagem, explicando opções.',
          '3. Montar um desenho técnico esquemático e uma lista preliminar de peças em mm, somente quando houver informações suficientes; identifique claramente suposições.',
          '4. Sugerir materiais, espessuras, fita de borda, ferragens e insumos com quantidades aproximadas.',
          '5. Apontar pontos que precisam de conferência na obra: prumo, esquadro, folgas, portas e gavetas, fundo, recuos, tomadas, água, ventilação, sentido do veio e largura de corte da serra.',
          '6. Preparar uma lista de compras, um checklist de produção e perguntas para o cliente.',
          '7. Se eu enviar fotos ou croquis, use-os como referência visual, mas NÃO invente cotas que não estejam medidas.',
          '',
          'Não apresente qualquer plano de corte como final sem minha aprovação e sem conferir os dados essenciais.'
        ].join('\n');
        document.getElementById('uaAssistantOutput').value=generatedBrief;
        document.getElementById('uaCopyPrompt').disabled=false;
        status.textContent='Pedido preparado. Copie, abra o ChatGPT e anexe fotos/croquis para continuar.';
      }catch(err){status.textContent=err.message||'Verifique as medidas informadas.'}
    });
    document.getElementById('uaCopyPrompt').addEventListener('click',async ()=>{
      if(!generatedBrief)return;
      try{
        await navigator.clipboard.writeText(generatedBrief);
        status.textContent='Copiado! Agora abra o ChatGPT e cole seu pedido.';
      }catch{
        const output=document.getElementById('uaAssistantOutput');output.focus();output.select();
        status.textContent='Selecione e copie o texto usando Ctrl+C.';
      }
    });
  }
  const previousRender=render;
  render=function universalartesRender(section=location.hash.slice(1)||'dashboard'){
    if(section!=='assistente')return previousRender(section);
    title.textContent='Assistente de projetos';
    nav.innerHTML=sections.map(([key,icon,label])=>'<button class="nav-btn '+(key===section?'active':'')+'" data-section="'+key+'"><span aria-hidden="true">'+icon+'</span>'+esc(label)+'</button>').join('');
    nav.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{location.hash=b.dataset.section;sidebar.classList.remove('open');if(location.hash.slice(1)===section)render(section)}));
    assistantView();
  };

})();
