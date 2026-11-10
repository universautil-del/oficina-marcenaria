'use strict';
/* UNIVERSALARTES — SketchUp CSV -> pré-orçamento. Não interpreta arquivos SKP e não cria pedidos. */
(function(){
  const MAX_SIZE=1024*1024, MAX_ROWS=3000;
  let imported=[],filename='',lastReport=null;
  const escapeText=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const brMoney=n=>Number(n).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const brNum=n=>Number(n).toLocaleString('pt-BR',{maximumFractionDigits:3});
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/[\s\-()]+/g,'_').replace(/_+/g,'_');
  function numberValue(value,name,required=true){
    let v=String(value??'').trim().replace(/\s+/g,'');
    if(!v){if(required)throw Error(name+' não informado.');return 0}
    if(v.includes(',')&&v.includes('.')){if(v.lastIndexOf(',')>v.lastIndexOf('.'))v=v.replace(/\./g,'').replace(',','.');else v=v.replace(/,/g,'')}
    else if(v.includes(','))v=v.replace(',','.');
    if(!/^\d+(?:\.\d+)?$/.test(v))throw Error(name+' inválido: '+String(value).slice(0,35));
    const n=Number(v);if(!Number.isFinite(n)||n<0||n>1e8)throw Error(name+' fora de limite.');
    return n;
  }
  function parseCsv(text){
    const clean=String(text).replace(/^\ufeff/,'').replace(/\r\n?/g,'\n');
    const first=clean.split('\n').find(l=>l.trim())||'';
    const delims=[';',',','\t'];
    const count=d=>{let n=0,quote=false;for(const c of first){if(c==='"')quote=!quote;else if(c===d&&!quote)n++}return n};
    const delimiter=delims.sort((a,b)=>count(b)-count(a))[0];
    const rows=[];let row=[],field='',quoted=false;
    for(let i=0;i<clean.length;i++){
      const c=clean[i];
      if(c==='"'){if(quoted&&clean[i+1]==='"'){field+='"';i++}else quoted=!quoted}
      else if(c===delimiter&&!quoted){row.push(field);field=''}
      else if(c==='\n'&&!quoted){row.push(field);if(row.some(v=>v.trim()))rows.push(row);row=[];field='';if(rows.length>MAX_ROWS+2)throw Error('O arquivo tem muitas linhas. Divida em arquivos menores.')}
      else field+=c;
    }
    if(quoted)throw Error('O CSV contém aspas não fechadas.');
    row.push(field);if(row.some(v=>v.trim()))rows.push(row);
    return rows;
  }
  function parseParts(csv,unit='mm'){
    if(!['mm','cm','m'].includes(unit))throw Error('Unidade inválida.');
    const rows=parseCsv(csv);
    if(rows.length<2)throw Error('CSV vazio ou sem peças.');
    const headers=rows[0].map(norm);
    const keys={
      name:['peca','nome','descricao','component','component_name','definition_name','name','definicao'],
      length:['comprimento_mm','comprimento','largura_mm','largura','lenx','length','length_mm','lenx_mm'],
      width:['profundidade_mm','profundidade','altura_mm','altura','largura_mm','largura','leny','width','width_mm','leny_mm'],
      thick:['espessura_mm','espessura','thickness','thickness_mm','lenz','lenz_mm'],
      qty:['quantidade','qtd','qty','quantity','count'],
      material:['material','mdf','material_nome','material_name'],
      band:['fita_m','fita_de_borda_m','edge_band_m','borda_m']
    };
    const indexes=Object.fromEntries(Object.entries(keys).map(([k,v])=>[k,v.map(a=>headers.indexOf(a)).find(i=>i>=0)??-1]));
    for(const k of ['name','length','width'])if(indexes[k]<0)throw Error('Coluna obrigatória ausente: '+({name:'peça/nome',length:'comprimento/largura/LenX',width:'profundidade/altura/LenY'}[k])+'. Use o modelo CSV.');
    const factor={mm:1,cm:10,m:1000}[unit];
    return rows.slice(1).map((r,i)=>{
      const val=k=>indexes[k]<0?'':String(r[indexes[k]]??'').trim();
      const rowNum=i+2;
      const name=val('name');if(!name)throw Error('Linha '+rowNum+': nome da peça vazio.');
      const length=numberValue(val('length'),'Linha '+rowNum+' comprimento')*factor;
      const width=numberValue(val('width'),'Linha '+rowNum+' largura')*factor;
      const thickness=indexes.thick<0?0:numberValue(val('thick'),'Linha '+rowNum+' espessura',false)*factor;
      const quantity=indexes.qty<0?1:numberValue(val('qty'),'Linha '+rowNum+' quantidade');
      const band=indexes.band<0?0:numberValue(val('band'),'Linha '+rowNum+' fita',false);
      if(!length||!width||length>20000||width>20000)throw Error('Linha '+rowNum+': dimensões devem ser maiores que zero e menores que 20.000 mm.');
      if(!Number.isInteger(quantity)||quantity<1||quantity>10000)throw Error('Linha '+rowNum+': quantidade deve ser inteira de 1 a 10.000.');
      return {name,length,width,thickness,quantity,material:val('material')||'Material não informado',band};
    });
  }
  function calculate(parts,priceM2,bandPrice,wastePct){
    const totals=new Map();let area=0,bands=0,quantity=0;
    parts.forEach(p=>{
      const a=p.length*p.width/1e6*p.quantity, b=p.band*p.quantity;
      area+=a;bands+=b;quantity+=p.quantity;
      const key=p.material+' | '+(p.thickness||'não informada')+' mm';
      if(!totals.has(key))totals.set(key,{material:p.material,thickness:p.thickness,area:0,pieces:0,band:0});
      const t=totals.get(key);t.area+=a;t.pieces+=p.quantity;t.band+=b;
    });
    const purchaseArea=area*(1+wastePct/100);
    return {area,bands,quantity,groups:[...totals.values()],purchaseArea,
      costMdf:purchaseArea*priceM2,costBand:bands*bandPrice,
      subtotal:purchaseArea*priceM2+bands*bandPrice,wastePct,priceM2,bandPrice};
  }
  function csvCell(value){let s=String(value??'');if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'}
  function saveCsv(filename,table){
    const text='\ufeff'+table.map(row=>row.map(csvCell).join(';')).join('\r\n');
    const blob=new Blob([text],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;a.click();
    setTimeout(()=>URL.revokeObjectURL(url),3000);
  }
  function view(){
    content.innerHTML=
     '<div class="ua-welcome"><div><div class="ua-eyebrow">UNIVERSALARTES · SKETCHUP</div><h2>Projeto → Consumo de MDF</h2><p>Importe uma lista de peças em CSV exportada do SketchUp e veja uma estimativa de material e custo.</p></div></div>'+
     '<section class="ua-section"><h3>1. Importar lista do SketchUp</h3>'+
     '<p class="muted">No SketchUp, gere um relatório CSV com <strong>nome, duas dimensões da peça, quantidade e material</strong>. Confirme que cada componente representa uma peça real. Não é leitura direta de arquivos .skp.</p>'+
     '<div class="ua-sketch-input"><label>Arquivo CSV (até 1 MB)<input type="file" id="uaSketchFile" accept=".csv,text/csv"></label>'+
     '<label>Unidade das dimensões no arquivo<select id="uaSketchUnit"><option value="mm">Milímetros (mm)</option><option value="cm">Centímetros (cm)</option><option value="m">Metros (m)</option></select></label></div>'+
     '<button class="btn" type="button" id="uaSketchTemplate">Baixar modelo CSV</button>'+
     '<p id="uaSketchStatus" class="muted small" aria-live="polite">Nenhum arquivo importado.</p></section>'+
     '<section class="ua-section gap-top"><h3>2. Parâmetros do cálculo</h3>'+
     '<div class="ua-sketch-input"><label>Preço do MDF por m² (R$)<input id="uaPriceM2" type="text" inputmode="decimal" value="0" placeholder="Ex.: 85,00"></label>'+
     '<label>Margem de perda estimada (%)<input id="uaWaste" type="text" inputmode="decimal" value="15"></label>'+
     '<label>Preço da fita por metro (R$)<input id="uaBandPrice" type="text" inputmode="decimal" value="0"></label></div>'+
     '<p class="muted small">Preços são informados por você. Se não houver metragem de fita no CSV, ela não será contabilizada. Mão de obra, ferragens, frete e impostos não estão incluídos.</p>'+
     '<button class="btn primary gap-top" id="uaCalculate" type="button" disabled>Calcular consumo e custo</button></section>'+
     '<section class="ua-section gap-top"><h3>3. Pré-orçamento</h3><div id="uaSketchResult" aria-live="polite" class="ua-sketch-result">Importe um CSV para calcular.</div>'+
     '<button type="button" class="btn" id="uaSketchExport" disabled>Exportar lista revisada</button>'+
     '<div class="empty">A área em m² não corresponde automaticamente à quantidade de chapas a comprar. O cálculo final de chapas exige tamanho da chapa, sentido do veio, plano de corte, folgas, espessuras e sangria da serra. Confira as peças antes de fabricar.</div></section>';
    const status=document.getElementById('uaSketchStatus'), calculateButton=document.getElementById('uaCalculate'),
          result=document.getElementById('uaSketchResult'), exportButton=document.getElementById('uaSketchExport');
    imported=[];lastReport=null;filename='';
    document.getElementById('uaSketchTemplate').onclick=()=>saveCsv('universalartes-modelo-pecas.csv',[
      ['peça','comprimento_mm','largura_mm','espessura_mm','quantidade','material','fita_m'],
      ['Lateral armário','2100','550','15','2','MDF Branco TX','2,65'],
      ['Prateleira','760','550','15','3','MDF Branco TX','0,76']
    ]);
    document.getElementById('uaSketchFile').onchange=async e=>{
      const file=e.target.files?.[0];if(!file)return;
      imported=[];lastReport=null;calculateButton.disabled=true;exportButton.disabled=true;
      if(file.size>MAX_SIZE){status.textContent='Arquivo muito grande (máximo 1 MB).';return}
      try{
        filename=file.name;
        const text=await file.text();
        imported=parseParts(text,document.getElementById('uaSketchUnit').value);
        status.textContent=imported.length+' tipo(s) de peça importado(s) de '+filename+'. Revise unidade e dimensões antes de calcular.';
        calculateButton.disabled=false;
      }catch(err){status.textContent='Erro: '+err.message}
    };
    document.getElementById('uaSketchUnit').onchange=()=>{if(!imported.length)return;status.textContent='A unidade foi alterada. Selecione novamente o arquivo para recalcular as dimensões.';calculateButton.disabled=true;exportButton.disabled=true;lastReport=null};
    calculateButton.onclick=()=>{
      try{
        const priceM2=numberValue(document.getElementById('uaPriceM2').value,'Preço por m²'),bandPrice=numberValue(document.getElementById('uaBandPrice').value,'Preço da fita'),waste=numberValue(document.getElementById('uaWaste').value,'Margem de perda');
        if(waste>100)throw Error('A perda estimada deve ficar entre 0% e 100%.');
        const r=calculate(imported,priceM2,bandPrice,waste);lastReport=r;
        const rows=r.groups.map(x=>'<tr><td>'+escapeText(x.material)+'</td><td>'+escapeText(x.thickness||'Não informada')+' mm</td><td>'+x.pieces+'</td><td>'+brNum(x.area)+' m²</td></tr>').join('');
        result.innerHTML=
          '<div class="ua-sketch-metrics"><div><small>Peças</small><strong>'+brNum(r.quantity)+'</strong></div><div><small>Área útil de MDF</small><strong>'+brNum(r.area)+' m²</strong></div>'+
          '<div><small>Área com perda</small><strong>'+brNum(r.purchaseArea)+' m²</strong></div><div><small>Fita informada</small><strong>'+brNum(r.bands)+' m</strong></div></div>'+
          '<div style="overflow-x:auto"><table class="ua-table"><thead><tr><th>Material</th><th>Espessura</th><th>Peças</th><th>Área</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+
          '<div class="ua-sketch-cost"><span>MDF com perda: '+brMoney(r.costMdf)+'</span><span>Fitas informadas: '+brMoney(r.costBand)+'</span><strong>Custo estimado: '+brMoney(r.subtotal)+'</strong></div>'+
          '<p class="muted small">Estimativa de materiais apenas: não constitui preço final de venda, não inclui chapa otimizada, impostos, ferragens, mão de obra ou instalação.</p>';
        exportButton.disabled=false;
      }catch(err){result.textContent='Não foi possível calcular: '+err.message}
    };
    exportButton.onclick=()=>{
      if(!lastReport)return;
      saveCsv('universalartes-pecas-revisadas.csv',[
        ['Peça','Comprimento (mm)','Largura (mm)','Espessura (mm)','Quantidade','Material','Fita por peça (m)','Área total (m²)'],
        ...imported.map(p=>[p.name,p.length,p.width,p.thickness,p.quantity,p.material,p.band,(p.length*p.width/1e6*p.quantity).toFixed(4)])
      ]);
    };
  }
  if(typeof sections!=='undefined'&&!sections.some(s=>s[0]==='sketchup')){
    const pos=sections.findIndex(s=>s[0]==='assistente');
    sections.splice(pos>=0?pos+1:sections.length,0,['sketchup','▥','Importar do SketchUp']);
  }
  const previousRender=render;
  render=function sketchupRender(section=location.hash.slice(1)||'dashboard'){
    if(section!=='sketchup')return previousRender(section);
    title.textContent='SketchUp → Pré-orçamento';
    nav.innerHTML=sections.map(([key,icon,label])=>'<button class="nav-btn '+(key===section?'active':'')+'" data-section="'+key+'"><span aria-hidden="true">'+icon+'</span>'+escapeText(label)+'</button>').join('');
    nav.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{location.hash=b.dataset.section;sidebar.classList.remove('open');if(location.hash.slice(1)===section)render(section)}));
    view();
  };
  window.universalartesSketchup={parseParts,calculate};
})();