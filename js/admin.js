(async () => {
  const $ = id => document.getElementById(id);
  const panel = $('admin-panel'), gate = $('auth-status');
  let clients = [], bills = [], allowed = false, readyClients = false, readyBills = false;
  let subscriptions = [], generation = 0, displayMode = 'table', selectedClient = '', paymentId = '';
  let auth, db, sdk, isAdmin, model, dataAPI;
  let generating = false;
  const labels = {active:'Ativo',inactive:'Inativo',paid:'Pago',open:'Em aberto',overdue:'Vencida',cancelled:'Cancelada'};
  function el(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  function action(text, handler, className = 'quiet-button') {
    const node = el('button',text,className); node.type = 'button'; node.onclick = handler; return node;
  }
  function badge(status) { return el('span',labels[status] || status,'badge '+status); }
  function notice(text) { $('panel-status').textContent = text; $('panel-status').hidden = !text; }
  function empty(title, description) {
    const box = el('div',undefined,'empty-state'); box.append(el('strong',title),el('p',description)); return box;
  }
  function lock() {
    allowed = false; readyClients = false; readyBills = false;
    subscriptions.forEach(stop=>stop()); subscriptions = [];
    clients = []; bills = [];
    panel.hidden = true;
    document.querySelectorAll('dialog[open]').forEach(d=>d.close());
    ['clients-list','bills-list','due-list','recent-clients','service-chart','detail-body'].forEach(id=>$(id).replaceChildren());
    ['clientForm','bill-form','payment-form'].forEach(id=>$(id).reset());
    $('generate-bills').disabled = true; $('new-bill').disabled = true;
    $('addClientBtn').disabled = true;
  }
  const redirect = () => location.replace(new URL('../contato/index.html?login=denied#login',location.href));
  function errorText(error) {
    if (error.code === 'permission-denied') return 'Acesso negado. Verifique sua permissão e a publicação das regras atualizadas do painel.';
    if (error.code === 'unavailable') return 'Sem conexão com o banco. Verifique a internet e tente novamente.';
    return error.message && !error.code ? error.message : 'Não foi possível concluir. Tente novamente.';
  }
  function clientName(id) { return clients.find(c=>c.id===id)?.empresa || 'Cliente não disponível'; }
  function showView(view) {
    for (const name of ['overview','clients','billing']) $('view-'+name).hidden = name !== view;
    document.querySelectorAll('.side-nav [data-view]').forEach(b=>{
      b.classList.toggle('selected',b.dataset.view===view);
      if (b.dataset.view===view) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current');
    });
    $('page-title').textContent = {overview:'Visão geral',clients:'Clientes',billing:'Financeiro'}[view];
  }
  function table(headers, rows) {
    const wrap = el('div',undefined,'table-wrap'), t = el('table'), head = el('thead'), tr = el('tr'), body=el('tbody');
    headers.forEach(h=>{ const cell=el('th',h); cell.scope='col'; tr.append(cell); });
    head.append(tr); rows.forEach(row=>{ const r=el('tr'); row.forEach(value=>{ const cell=el('td'); if(value instanceof Node)cell.append(value); else cell.textContent=value; r.append(cell); }); body.append(r); });
    t.append(head,body);wrap.append(t);return wrap;
  }
  function titleCell(title,subtitle) {const node=el('div');node.append(el('strong',title),el('small',subtitle));return node;}
  function lateFor(id) { return bills.filter(b=>b.clienteId===id && model.billStatus(b)==='overdue'); }
  function tile(c) {
    const node=action('',()=>openDetail(c.id),'client-tile'), top=el('div',undefined,'tile-top'), foot=el('div',undefined,'tile-footer');
    top.append(el('span',c.empresa.slice(0,2).toUpperCase(),'avatar'),badge(c.ativo?'active':'inactive'));
    foot.append(el('span',c.plano),el('span',c.ciclo==='mensal'?model.money(c.valorMensal)+'/mês':'Pagamento único'));
    node.append(top,el('h3',c.empresa),el('p',c.contato+' · '+c.servico),foot);
    return node;
  }
  function renderClients() {
    const query=model.normalize($('client-search').value), state=$('client-status').value, service=$('client-service').value;
    let visible=clients.filter(c=>model.normalize([c.empresa,c.contato,c.email,c.documento,c.gerente].join(' ')).includes(query) &&
      (!state || state==='active'&&c.ativo || state==='inactive'&&!c.ativo || state==='overdue'&&lateFor(c.id).length) && (!service||c.servico===service));
    const sort=$('client-sort').value;
    visible.sort(sort==='value'?(a,b)=>b.valorMensal-a.valorMensal:sort==='recent'?(a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0):(a,b)=>a.empresa.localeCompare(b.empresa,'pt-BR'));
    $('client-count').textContent=visible.length+' de '+clients.length+' clientes';
    const list=$('clients-list');list.replaceChildren();
    if(!visible.length){list.append(empty(clients.length?'Nenhum resultado':'Sua carteira começa aqui',clients.length?'Ajuste a busca ou os filtros.':'Clique em Novo cliente para cadastrar sua primeira empresa.'));return;}
    if(displayMode==='cards'){const grid=el('div',undefined,'client-grid');visible.forEach(c=>grid.append(tile(c)));list.append(grid);return;}
    list.append(table(['Cliente / responsável','Serviço / pacote','Mensalidade','Situação','Financeiro',''],visible.map(c=>[
      titleCell(c.empresa,c.contato),titleCell(c.servico,c.plano),c.ciclo==='mensal'?model.money(c.valorMensal):'Pagamento único',
      badge(c.ativo?'active':'inactive'),
      !readyBills?'Indisponível':lateFor(c.id).length?badge('overdue'):el('span',bills.some(b=>b.clienteId===c.id)?'Sem atraso':'Sem cobranças',''),
      action('Ver cliente ↗',()=>openDetail(c.id))
    ])));
  }
  function renderBills() {
    const query=model.normalize($('bill-search').value), state=$('bill-status').value, period=$('bill-period').value;
    const visible=bills.filter(b=>model.normalize(clientName(b.clienteId)+' '+b.descricao).includes(query) &&
      (!state || model.billStatus(b)===state) && (!period || b.vencimento.startsWith($('billing-month').value))).sort((a,b)=>a.vencimento.localeCompare(b.vencimento));
    $('bill-count').textContent=visible.length+' cobranças · '+model.money(visible.filter(b=>b.status!=='cancelled').reduce((n,b)=>n+b.valorCentavos,0)/100);
    $('bills-list').replaceChildren();
    if(!readyBills){$('bills-list').append(empty('Financeiro indisponível','Publique as regras atualizadas no Firebase e recarregue o painel.'));return;}
    if(!visible.length){$('bills-list').append(empty('Nenhuma cobrança nesta visualização','Gere as mensalidades ou registre uma cobrança avulsa.'));return;}
    $('bills-list').append(billTable(visible));
  }
  function billTable(items) {
    return table(['Cliente / descrição','Vencimento','Valor','Situação','Recebimento','Ações'],items.map(b=>{
      const actions=el('div',undefined,'row-actions');
      if(b.status==='open'){
        actions.append(action('Receber',()=>openPayment(b)),action('Cancelar',()=>changeStatus(b,'cancelled')));
      } else actions.append(action('Reabrir',()=>changeStatus(b,'open')));
      return [titleCell(clientName(b.clienteId),b.descricao),model.dateLabel(b.vencimento),model.money(b.valorCentavos/100),badge(model.billStatus(b)),b.paidDate?model.dateLabel(b.paidDate):'—',actions];
    }));
  }
  function renderOverview() {
    const stats=model.totals(clients,bills);
    $('metric-active').textContent=stats.active;$('metric-total').textContent=clients.length+' clientes cadastrados';
    $('metric-mrr').textContent=model.money(stats.mrr);
    $('metric-paid').textContent=readyBills?model.money(stats.paid):'—';
    $('metric-overdue').textContent=readyBills?model.money(stats.overdue):'—';
    $('metric-overdue-count').textContent=readyBills?stats.overdueCount+' cobranças vencidas':'Financeiro indisponível';
    const due=$('due-list');due.replaceChildren();
    const pending=bills.filter(b=>b.status==='open').sort((a,b)=>a.vencimento.localeCompare(b.vencimento)).slice(0,5);
    if(!readyBills)due.append(empty('Aguardando financeiro','As regras atualizadas são necessárias para consultar as cobranças.'));
    else if(!pending.length)due.append(empty('Nenhuma pendência registrada','Cobranças em aberto aparecerão aqui.'));
    pending.forEach(b=>{
      const row=el('div',undefined,'due-row'), description=el('div'), amount=el('div',undefined,'due-amount');
      description.append(action(clientName(b.clienteId),()=>openDetail(b.clienteId)),el('small',b.descricao+' · '+model.dateLabel(b.vencimento)));
      amount.append(el('b',model.money(b.valorCentavos/100)),badge(model.billStatus(b)));row.append(description,amount);due.append(row);
    });
    const chart=$('service-chart');chart.replaceChildren();
    const active=clients.filter(c=>c.ativo),groups={};active.forEach(c=>groups[c.servico]=(groups[c.servico]||0)+1);
    if(!active.length)chart.append(empty('Sem contratos ativos','A distribuição aparecerá após o cadastro.'));
    Object.entries(groups).sort((a,b)=>b[1]-a[1]).forEach(([name,count])=>{
      const row=el('div',undefined,'chart-row'),label=el('div',undefined,'chart-label'),track=el('div',undefined,'bar-track'),fill=el('div',undefined,'bar-fill');
      label.append(el('b',name),el('span',count+' clientes'));fill.style.width=(count/active.length*100)+'%';track.append(fill);row.append(label,track);chart.append(row);
    });
    const recent=$('recent-clients');recent.replaceChildren();
    [...clients].sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)).slice(0,3).forEach(c=>recent.append(tile(c)));
    if(!clients.length)recent.append(empty('Nenhum cliente cadastrado','Comece pelo botão Novo cliente.'));
  }
  function render() {
    if(!allowed)return;
    renderClients();renderBills();renderOverview();
    if($('detail-dialog').open) renderDetail();
    $('generate-bills').disabled=generating || !(readyClients&&readyBills);
    $('new-bill').disabled=!(readyClients&&readyBills&&clients.length);
    $('addClientBtn').disabled=!readyClients;
    $('sync-label').textContent=readyClients&&readyBills?'● Dados atualizados':'● Sincronização parcial';
  }
  function openClient(id='') {
    if(!allowed||!readyClients)return;
    const form=$('clientForm');form.reset();form.elements.id.value=id;
    $('client-error').textContent='';
    const c=clients.find(c=>c.id===id);
    if(c){
      Object.entries(c).forEach(([key,value])=>{
        const field=form.elements.namedItem(key);if(!field)return;
        if(field.type==='checkbox')field.checked=!!value;else field.value=String(value??'');
      });
    }else { form.elements.inicioContrato.value=model.today();form.elements.gerente.value='Ebensystem'; }
    $('client-dialog-title').textContent=c?'Editar cliente':'Novo cliente';
    $('client-dialog').showModal();
  }
  function openDetail(id) { if(!clients.some(c=>c.id===id))return;selectedClient=id;renderDetail();$('detail-dialog').showModal(); }
  function renderDetail() {
    const c=clients.find(c=>c.id===selectedClient);if(!c)return;
    $('detail-title').textContent=c.empresa;const body=$('detail-body');body.replaceChildren();
    const summary=el('div',undefined,'detail-summary');summary.append(badge(c.ativo?'active':'inactive'),el('span',c.servico+' / '+c.plano,'badge'));body.append(summary);
    const grid=el('dl',undefined,'detail-grid');
    for(const [label,value] of [['Responsável',c.contato],['Responsável interno',c.gerente],['E-mail',c.email],['Telefone',c.telefone],['CPF / CNPJ',c.documento],['Início do contrato',model.dateLabel(c.inicioContrato)],['Recorrência',c.ciclo==='mensal'?'Mensal · dia '+c.diaVencimento:'Pagamento único'],['Mensalidade',model.money(c.valorMensal)],['Valor do projeto',model.money(c.valorProjeto)],['Projeto inicial',c.pago?'Pago':'Pendente'],['Forma de pagamento',c.formaPagamento],['Observações',c.observacoes]]){const item=el('div');item.append(el('dt',label),el('dd',value||'Não informado'));grid.append(item);}
    body.append(grid,el('h3','Histórico financeiro'));
    const history=bills.filter(b=>b.clienteId===c.id).sort((a,b)=>b.vencimento.localeCompare(a.vencimento));
    body.append(!readyBills?empty('Financeiro indisponível','Verifique as regras do Firebase.'):history.length?billTable(history):empty('Nenhuma cobrança','Gere uma mensalidade ou crie uma cobrança avulsa.'));
  }
  async function guardedWrite(operation) {
    if(!allowed || !auth.currentUser)throw new Error('Sessão encerrada. Entre novamente.');
    const current=generation;
    if(!await isAdmin(auth.currentUser) || current!==generation || !allowed){lock();redirect();throw new Error('Acesso encerrado.');}
    return operation(auth.currentUser.uid);
  }
  function openPayment(b) {
    paymentId=b.id;$('payment-form').reset();$('payment-error').textContent='';
    $('payment-summary').textContent=clientName(b.clienteId)+' · '+model.money(b.valorCentavos/100)+' · '+b.descricao;
    $('payment-form').elements.paidDate.value=model.today();$('payment-form').elements.paidDate.max=model.today();
    $('payment-dialog').showModal();
  }
  async function mutateBill(id,status,paidDate='') {
    return guardedWrite(uid=>dataAPI.updateBillStatus({db,store:sdk,id,status,paidDate,uid}));
  }
  async function changeStatus(b,status) {
    const question=status==='cancelled'?'Cancelar esta cobrança? Ela continuará no histórico.':'Reabrir esta cobrança? O registro atual de recebimento será removido.';
    if(!confirm(question))return;
    try{await mutateBill(b.id,status);notice('Cobrança atualizada.');}catch(error){notice(errorText(error));}
  }
  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>showView(b.dataset.view));
  document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());
  $('addClientBtn').onclick=()=>openClient();
  $('detail-edit').onclick=()=>{$('detail-dialog').close();openClient(selectedClient);};
  for(const id of ['client-search','client-status','client-service','client-sort'])$(id).addEventListener('input',()=>{if(model)renderClients();});
  for(const id of ['bill-search','bill-status','bill-period','billing-month'])$(id).addEventListener('input',()=>{if(model)renderBills();});
  $('table-view').onclick=()=>{displayMode='table';$('table-view').setAttribute('aria-pressed','true');$('cards-view').setAttribute('aria-pressed','false');renderClients();};
  $('cards-view').onclick=()=>{displayMode='cards';$('table-view').setAttribute('aria-pressed','false');$('cards-view').setAttribute('aria-pressed','true');renderClients();};
  $('clientForm').addEventListener('submit',async event=>{
    event.preventDefault();const form=event.currentTarget,button=$('save-client');if(button.disabled)return;button.disabled=true;$('client-error').textContent='';
    try{
      const f=Object.fromEntries(new FormData(form)),id=f.id;
      const data={
        empresa:f.empresa.trim(),contato:f.contato.trim(),gerente:f.gerente.trim(),plano:f.plano.trim(),
        email:f.email.trim(),telefone:f.telefone.trim(),documento:f.documento.trim(),servico:f.servico,
        inicioContrato:f.inicioContrato,ativo:f.ativo==='true',valorProjeto:Number(f.valorProjeto),pago:form.elements.pago.checked,
        ciclo:f.ciclo,valorMensal:f.ciclo==='mensal'?Number(f.valorMensal):0,diaVencimento:Number(f.diaVencimento),
        formaPagamento:f.formaPagamento,observacoes:f.observacoes.trim(),schemaVersion:2,
      };
      if(!data.empresa||!data.contato||!data.gerente||!data.plano||!model.validDate(data.inicioContrato)||
        !Number.isInteger(data.diaVencimento)||data.diaVencimento<1||data.diaVencimento>31||
        !Number.isFinite(data.valorMensal)||!Number.isFinite(data.valorProjeto)||data.valorMensal<0||data.valorProjeto<0)
        throw new Error('Revise os campos obrigatórios e os valores do contrato.');
      await guardedWrite(async uid=>{
        if(id)await sdk.updateDoc(sdk.doc(db,'clientes',id),{...data,updatedAt:sdk.serverTimestamp(),updatedBy:uid});
        else await sdk.addDoc(sdk.collection(db,'clientes'),{...data,createdAt:sdk.serverTimestamp(),createdBy:uid,updatedAt:sdk.serverTimestamp(),updatedBy:uid});
      });
      $('client-dialog').close();notice(id?'Cadastro atualizado.':'Cliente cadastrado com sucesso.');showView('clients');
    }catch(error){$('client-error').textContent=errorText(error);}finally{button.disabled=false;}
  });
  $('new-bill').onclick=()=>{
    const form=$('bill-form');form.reset();$('bill-error').textContent='';
    const select=form.elements.clienteId;select.replaceChildren();
    [...clients].sort((a,b)=>a.empresa.localeCompare(b.empresa)).forEach(c=>{const option=el('option',c.empresa+(c.ativo?'':' (inativo)'));option.value=c.id;select.append(option);});
    form.elements.vencimento.value=model.today();$('bill-dialog').showModal();
  };
  $('bill-form').addEventListener('submit',async event=>{
    event.preventDefault();const form=event.currentTarget,button=form.querySelector('[type=submit]');if(button.disabled)return;button.disabled=true;
    try{
      const f=Object.fromEntries(new FormData(form)),value=Math.round(Number(f.valor)*100);
      if(!model.validDate(f.vencimento)||!Number.isSafeInteger(value)||value<=0||!f.descricao.trim())throw new Error('Informe uma descrição, valor e vencimento válidos.');
      await guardedWrite(uid=>sdk.addDoc(sdk.collection(db,'cobrancas'),{clienteId:f.clienteId,descricao:f.descricao.trim(),valorCentavos:value,vencimento:f.vencimento,competencia:f.vencimento.slice(0,7),tipo:'avulsa',status:'open',paidDate:'',createdAt:sdk.serverTimestamp(),createdBy:uid,updatedAt:sdk.serverTimestamp(),updatedBy:uid}));
      $('bill-dialog').close();notice('Cobrança registrada.');showView('billing');
    }catch(error){$('bill-error').textContent=errorText(error);}finally{button.disabled=false;}
  });
  $('payment-form').addEventListener('submit',async event=>{
    event.preventDefault();const form=event.currentTarget,button=form.querySelector('[type=submit]');if(button.disabled)return;button.disabled=true;
    try{const date=form.elements.paidDate.value;if(!model.validDate(date)||date>model.today())throw new Error('Informe uma data de recebimento válida, até hoje.');
      await mutateBill(paymentId,'paid',date);$('payment-dialog').close();notice('Pagamento registrado.');
    }catch(error){$('payment-error').textContent=errorText(error);}finally{button.disabled=false;}
  });
  $('generate-bills').onclick=async()=>{
    const button=$('generate-bills'),month=$('billing-month').value;
    if(button.disabled)return;
    let candidates;
    try{model.dueDate(month,1);candidates=clients.filter(c=>model.eligible(c,month));}catch(error){notice(errorText(error));return;}
    if(!candidates.length){notice('Nenhum contrato mensal elegível. Confira valor, início do contrato e situação dos clientes.');return;}
    if(!confirm('Gerar mensalidades de '+month.split('-').reverse().join('/')+' para até '+candidates.length+' clientes? Cobranças existentes não serão duplicadas, inclusive canceladas.'))return;
    generating=true;button.disabled=true;let created=0,skipped=0;
    try{
      for(const c of candidates){
        const result=await guardedWrite(uid=>dataAPI.generateMonthlyBill({db,store:sdk,clientId:c.id,month,uid}));
        if(result)created++;else skipped++;
      }
      notice(created+' mensalidades geradas; '+skipped+' já existentes ou não elegíveis.');
    }catch(error){notice(created+' mensalidades geradas antes da interrupção. '+errorText(error)+' Você pode repetir sem duplicar.');}
    finally{generating=false;button.disabled=!(allowed&&readyBills&&readyClients);}
  };
  try {
    const [firebase,authSDK,store,helpers,operations]=await Promise.all([import('./firebase.js'),import('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js'),import('https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js'),import('./admin-model.js'),import('./admin-data.js')]);
    auth=firebase.auth;db=firebase.db;isAdmin=firebase.isAdmin;sdk=store;model=helpers;dataAPI=operations;
    $('billing-month').value=model.today().slice(0,7);
    $('today-label').textContent=new Intl.DateTimeFormat('pt-BR',{day:'numeric',month:'long',year:'numeric',timeZone:'America/Sao_Paulo'}).format(new Date());
    await firebase.authReady;await auth.authStateReady();
    $('logoutBtn').onclick=async()=>{++generation;lock();gate.hidden=false;gate.textContent='Saindo...';try{await authSDK.signOut(auth);redirect();}catch{gate.textContent='Não foi possível sair. Recarregue e tente novamente.';}};
    authSDK.onAuthStateChanged(auth,async user=>{
      const current=++generation;lock();gate.hidden=false;gate.textContent='Verificando seu acesso...';
      if(!user){redirect();return;}
      try{
        if(!await isAdmin(user)){redirect();return;}
        if(current!==generation)return;
        allowed=true;panel.hidden=false;gate.hidden=true;$('admin-email').textContent=user.email || 'Administrador';
        subscriptions.push(sdk.onSnapshot(sdk.doc(db,'users',user.uid),snapshot=>{
          if(current!==generation||snapshot.metadata.fromCache)return;
          if(!snapshot.exists()||snapshot.data().role!=='admin'){lock();redirect();}
        },()=>{if(current===generation){lock();redirect();}}));
        subscriptions.push(sdk.onSnapshot(sdk.collection(db,'clientes'),snapshot=>{
          if(current!==generation||!allowed)return;
          clients=snapshot.docs.map(doc=>model.normalizeClient({...doc.data(),id:doc.id}));readyClients=true;render();
        },error=>{if(current!==generation)return;readyClients=false;clients=[];render();notice(errorText(error));}));
        subscriptions.push(sdk.onSnapshot(sdk.collection(db,'cobrancas'),snapshot=>{
          if(current!==generation||!allowed)return;
          bills=snapshot.docs.map(doc=>({...doc.data(),id:doc.id}));readyBills=true;render();
        },error=>{if(current!==generation)return;readyBills=false;bills=[];render();notice(errorText(error));}));
        render();
      }catch(error){if(current!==generation)return;lock();gate.hidden=false;gate.textContent=errorText(error);gate.append(action('Voltar ao login',redirect));}
    },()=>{lock();redirect();});
    window.addEventListener('pagehide',()=>{++generation;lock();});
    window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
    setInterval(()=>{if(allowed&&document.visibilityState==='visible')render();},60000);
  }catch{
    lock();gate.hidden=false;gate.textContent='Não foi possível iniciar o painel. Verifique a conexão e recarregue a página.';
    gate.append(action('Voltar ao login',redirect));
  }
})();