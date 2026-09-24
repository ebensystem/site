const menuButton = document.querySelector('.menu-toggle');
const nav = document.querySelector('header nav');

if (menuButton && nav) {
  menuButton.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('open');
    menuButton.setAttribute('aria-expanded', String(isOpen));
    menuButton.setAttribute('aria-label', isOpen ? 'Fechar menu' : 'Abrir menu');
  });

  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      nav.classList.remove('open');
      menuButton.setAttribute('aria-expanded', 'false');
      menuButton.setAttribute('aria-label', 'Abrir menu');
    });
  });
}

// Abrir modal
const modal = document.getElementById("clientModal");
const btn = document.getElementById("addClientBtn");
const span = document.querySelector(".close");
const form = document.getElementById("clientForm");
const clientsList = document.getElementById("clientsList");

btn.onclick = () => modal.style.display = "flex";
span.onclick = () => modal.style.display = "none";
window.onclick = e => { if (e.target === modal) modal.style.display = "none"; };

// Adicionar cliente
form.addEventListener("submit", e => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(form).entries());
  const card = document.createElement("div");
  card.className = "client-card";
  card.innerHTML = `
    <strong>${data.empresa}</strong>
    <span>${data.plano} • R$${data.valorMensal}/mês • ${data.pago ? "Pago" : "Pendente"}</span>
  `;
  clientsList.appendChild(card);
  modal.style.display = "none";
  form.reset();
});
