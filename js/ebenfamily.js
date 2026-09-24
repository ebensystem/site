(() => {
  const details = document.getElementById('excluir-conta');
  const form = document.getElementById('exclusaoForm');
  const button = document.getElementById('enviarExclusao');
  const status = document.getElementById('exclusaoStatus');
  const endpoint = 'https://script.google.com/macros/s/AKfycbyErbGTxbWgbDkYpPAev3G8jn32YWXqZ4-0YdC6YroZFDTGgHvf-Fb2URH-WttVSCJX/exec';
  function revealRequest() {
    if (location.hash === '#excluir-conta') details.open = true;
  }
  revealRequest();
  window.addEventListener('hashchange', revealRequest);
  document.querySelectorAll('a[href="#excluir-conta"]').forEach(link => link.addEventListener('click', () => { details.open = true; }));
  button.disabled = false;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (button.disabled || !form.reportValidity()) return;
    // Mantém o contrato do Apps Script do contato, sem novas colunas.
    const data = {
      nome: form.elements.nome.value.trim(),
      empresa: form.elements.empresa.value.trim(),
      email: form.elements.email.value.trim(),
      telefone: form.elements.telefone.value.trim(),
      mensagem: '[EbenFamily — solicitação de exclusão de conta]\n' + (form.elements.mensagem.value.trim() || 'Motivo não informado.'),
    };
    if (!data.nome || !data.empresa || !data.email || !data.telefone) {
      status.hidden = false;
      status.textContent = 'Preencha nome, sobrenome, e-mail e telefone.';
      return;
    }
    button.disabled = true;
    button.textContent = 'Enviando...';
    status.hidden = true;
    try {
      await fetch(endpoint, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      // Resposta opaca: o navegador não consegue confirmar a gravação no Google.
      status.textContent = 'Pedido encaminhado para processamento. Aguarde a confirmação da equipe pelo e-mail informado. Sua conta ainda não foi excluída. Se não receber retorno, entre em contato pelo e-mail contato@ebensystem.com.br.';
      form.reset();
    } catch {
      status.textContent = 'Não foi possível enviar. Verifique sua conexão e tente novamente, ou escreva para contato@ebensystem.com.br.';
    } finally {
      status.hidden = false;
      button.disabled = false;
      button.textContent = 'Enviar solicitação ↗';
    }
  });
})();