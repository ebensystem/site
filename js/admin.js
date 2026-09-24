(async () => {
  const panel = document.getElementById('admin-panel');
  const status = document.getElementById('auth-status');
  const list = document.getElementById('clientsList');
  const message = document.getElementById('panel-status');
  const form = document.getElementById('clientForm');
  const modal = document.getElementById('clientModal');
  const save = form.querySelector('button[type="submit"]');
  const logout = document.getElementById('logoutBtn');
  let unsubscribe = () => {};
  let unsubscribeRole = () => {};
  let generation = 0;
  let allowed = false;
  function lock() {
    allowed = false;
    panel.hidden = true;
    modal.style.display = 'none';
    list.replaceChildren();
    for (const id of ['totalClients', 'activeClients', 'paidProjects', 'ongoingProjects']) {
      document.getElementById(id).textContent = '0';
    }
    unsubscribeRole();
    unsubscribeRole = () => {};
    unsubscribe();
    unsubscribe = () => {};
  }
  function redirect(reason = 'required') {
    location.replace(new URL('../contato/index.html?login=' + reason + '#login', location.href));
  }
  try {
    const [firebase, authSDK, store] = await Promise.all([
      import('./firebase.js'),
      import('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js'),
    ]);
    const { auth, authReady, db, isAdmin } = firebase;
    await authReady;
    await auth.authStateReady();
    if (auth.currentUser) await auth.currentUser.getIdToken(true);
    const clients = store.collection(db, 'clientes');
    document.getElementById('addClientBtn').onclick = () => {
      if (allowed) modal.style.display = 'flex';
    };
    document.querySelector('.close').onclick = () => { modal.style.display = 'none'; };
    modal.addEventListener('click', event => {
      if (event.target === modal) modal.style.display = 'none';
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') modal.style.display = 'none';
    });
    logout.onclick = async () => {
      ++generation;
      lock();
      status.hidden = false;
      status.textContent = 'Saindo...';
      try { await authSDK.signOut(auth); redirect(); }
      catch {
        status.textContent = 'Não foi possível sair. Recarregue a página e tente novamente.';
      }
    };
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!allowed || save.disabled) return;
      const currentGeneration = generation;
      const user = auth.currentUser;
      save.disabled = true;
      message.textContent = '';
      try {
        if (!(await isAdmin(user)) || !allowed || currentGeneration !== generation) {
          lock(); redirect('denied'); return;
        }
        const values = Object.fromEntries(new FormData(form));
        const data = {
          empresa: values.empresa.trim(), contato: values.contato.trim(),
          gerente: values.gerente.trim(), plano: values.plano,
          valorProjeto: Number(values.valorProjeto), valorMensal: Number(values.valorMensal),
          pago: form.elements.pago.checked, ativo: true,
          createdAt: store.serverTimestamp(), createdBy: user.uid,
        };
        if (!data.empresa || !data.contato || !data.gerente ||
            !Number.isFinite(data.valorProjeto) || !Number.isFinite(data.valorMensal)) {
          throw new Error('invalid');
        }
        await store.addDoc(clients, data);
        if (currentGeneration !== generation) return;
        form.reset();
        modal.style.display = 'none';
        message.textContent = 'Cliente salvo.';
      } catch (error) {
        if (error.code === 'permission-denied') { lock(); redirect('denied'); }
        else message.textContent = 'Não foi possível salvar. Verifique os campos, a conexão e tente novamente.';
      } finally { save.disabled = false; }
    });
    authSDK.onIdTokenChanged(auth, async user => {
      const currentGeneration = ++generation;
      lock();
      status.hidden = false;
      status.textContent = 'Verificando acesso...';
      if (!user) { redirect(); return; }
      try {
        // O observador acompanha tokens renovados; sem refresh recursivo aqui.
        if (!(await isAdmin(user))) {
          if (currentGeneration === generation) redirect('denied');
          return;
        }
        if (currentGeneration !== generation) return;
        allowed = true;
        panel.hidden = false;
        status.hidden = true;
        message.textContent = 'Carregando clientes...';
        // A permissão pode ser removida pelo Console enquanto o painel está aberto.
        unsubscribeRole = store.onSnapshot(store.doc(db, 'users', user.uid), profile => {
          if (currentGeneration !== generation || profile.metadata.fromCache) return;
          if (!profile.exists() || profile.data().role !== 'admin') {
            lock();
            redirect('denied');
          }
        }, () => {
          if (currentGeneration !== generation) return;
          lock();
          redirect('denied');
        });
        unsubscribe = store.onSnapshot(clients, snapshot => {
          if (!allowed || currentGeneration !== generation) return;
          list.replaceChildren();
          let active = 0, paid = 0, ongoing = 0;
          snapshot.forEach(doc => {
            const data = doc.data();
            active += data.ativo === true ? 1 : 0;
            paid += data.pago === true ? 1 : 0;
            ongoing += data.ativo === true && !data.pago ? 1 : 0;
            const card = document.createElement('div');
            card.className = 'client-card';
            const title = document.createElement('strong');
            title.textContent = data.empresa;
            const detail = document.createElement('span');
            const price = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(data.valorMensal);
            detail.textContent = data.plano + ' • ' + price + '/mês • ' + (data.pago ? 'Pago' : 'Pendente');
            card.append(title, detail);
            list.appendChild(card);
          });
          document.getElementById('totalClients').textContent = snapshot.size;
          document.getElementById('activeClients').textContent = active;
          document.getElementById('paidProjects').textContent = paid;
          document.getElementById('ongoingProjects').textContent = ongoing;
          message.textContent = snapshot.empty ? 'Nenhum cliente cadastrado.' : '';
        }, error => {
          if (currentGeneration !== generation) return;
          lock();
          if (error.code === 'permission-denied') redirect('denied');
          else {
            status.hidden = false;
            status.textContent = 'Não foi possível carregar os clientes. Recarregue a página para tentar novamente.';
          }
        });
      } catch {
        if (currentGeneration !== generation) return;
        lock();
        redirect();
      }
    }, () => { lock(); redirect(); });
    window.addEventListener('pagehide', lock);
    window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
  } catch {
    lock();
    status.hidden = false;
    status.textContent = 'Painel indisponível. Verifique a configuração do Firebase e a conexão.';
    const link = document.createElement('a');
    link.href = '../contato/index.html#login';
    link.textContent = ' Voltar ao login';
    status.appendChild(link);
  }
})();