export const money = value => new Intl.NumberFormat('pt-BR', {style:'currency',currency:'BRL'}).format(value || 0);
export function today() {
  const parts = new Intl.DateTimeFormat('en-CA', {timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const get = type => parts.find(p => p.type === type).value;
  return get('year') + '-' + get('month') + '-' + get('day');
}
export function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const date = new Date(value + 'T12:00:00Z');
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0,10) === value && value >= '2000-01-01' && value <= '2099-12-31';
}
export const dateLabel = value => validDate(value) ? value.split('-').reverse().join('/') : 'Não informado';
export const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export const billStatus = (bill, date = today()) => bill.status === 'open' && bill.vencimento < date ? 'overdue' : bill.status;
export function dueDate(month, day) {
  if (!/^\d{4}-\d{2}$/.test(month) || !Number.isInteger(day) || day < 1 || day > 31) throw new Error('Competência ou dia inválido.');
  const [year, m] = month.split('-').map(Number);
  if (year < 2000 || year > 2099 || m < 1 || m > 12) throw new Error('Competência inválida.');
  const last = new Date(Date.UTC(year,m,0)).getUTCDate();
  return month + '-' + String(Math.min(day,last)).padStart(2,'0');
}
export function eligible(client, month) {
  return client.ativo && client.ciclo === 'mensal' && client.valorMensal > 0 &&
    validDate(client.inicioContrato) && client.inicioContrato.slice(0,7) <= month &&
    Number.isInteger(client.diaVencimento) && client.diaVencimento >= 1 && client.diaVencimento <= 31;
}
export function normalizeClient(client) {
  return {email:'',telefone:'',documento:'',servico:'Outro',observacoes:'',ciclo:client.valorMensal > 0 ? 'mensal':'unico',inicioContrato:'',diaVencimento:10,formaPagamento:'Pix',...client};
}
export function totals(clients, bills, date = today()) {
  const active = clients.filter(c=>c.ativo);
  const late = bills.filter(b=>billStatus(b,date)==='overdue');
  return {
    active:active.length,
    mrr:active.filter(c=>c.ciclo==='mensal').reduce((sum,c)=>sum+Math.round(c.valorMensal*100),0)/100,
    paid:bills.filter(b=>b.status==='paid' && b.paidDate.startsWith(date.slice(0,7))).reduce((sum,b)=>sum+b.valorCentavos,0)/100,
    overdue:late.reduce((sum,b)=>sum+b.valorCentavos,0)/100,
    overdueCount:late.length,
  };
}