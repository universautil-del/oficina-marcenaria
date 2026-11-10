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
      '<div class="ua-shortcuts"><a href="#clientes">+ Cliente</a><a href="#projetos">+ Ver projetos</a><a href="#orcamentos">+ Orçamento</a><a href="#pedidos">Pedidos</a><a href="#producao">Produção</a><a href="#produtos">Estoque</a></div>' +
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
  if (brand) brand.textContent='UNIVERSALARTES';
  if ((location.hash.slice(1) || 'dashboard') === 'dashboard') render('dashboard');
})();