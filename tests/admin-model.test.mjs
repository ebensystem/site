import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source = fs.readFileSync(new URL('../js/admin-model.js', import.meta.url),'utf8');
const m = await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
test('vencimento adapta dia 31 e fevereiro bissexto sem mudar de mês',()=>{
  assert.equal(m.dueDate('2026-02',31),'2026-02-28');
  assert.equal(m.dueDate('2028-02',31),'2028-02-29');
  assert.equal(m.dueDate('2026-04',31),'2026-04-30');
  assert.throws(()=>m.dueDate('2026-13',10));
  assert.throws(()=>m.dueDate('2026-09',0));
});
test('datas impossíveis e entradas incompletas são recusadas',()=>{
  assert.equal(m.validDate('2026-02-30'),false);
  assert.equal(m.validDate('2028-02-29'),true);
  assert.equal(m.validDate(''),false);
  assert.equal(m.validDate('2100-01-01'),false);
});
test('vencimento hoje não é atraso; pago e cancelado não viram vencidos',()=>{
  assert.equal(m.billStatus({status:'open',vencimento:'2026-09-24'},'2026-09-24'),'open');
  assert.equal(m.billStatus({status:'open',vencimento:'2026-09-23'},'2026-09-24'),'overdue');
  for(const status of ['paid','cancelled']) assert.equal(m.billStatus({status,vencimento:'2020-01-01'},'2026-09-24'),status);
});
test('geração exclui inativos, únicos e contratos que ainda não começaram',()=>{
  const c={ativo:true,ciclo:'mensal',valorMensal:99.9,inicioContrato:'2026-09-15',diaVencimento:31};
  assert.equal(m.eligible(c,'2026-09'),true);
  assert.equal(m.eligible({...c,ativo:false},'2026-09'),false);
  assert.equal(m.eligible({...c,ciclo:'unico'},'2026-09'),false);
  assert.equal(m.eligible({...c,inicioContrato:''},'2026-09'),false);
  assert.equal(m.eligible(c,'2026-08'),false);
});
test('indicadores separam recorrência, recebimentos e atraso; canceladas não somam',()=>{
  const clients=[{ativo:true,ciclo:'mensal',valorMensal:0.1},{ativo:true,ciclo:'mensal',valorMensal:0.2},{ativo:false,ciclo:'mensal',valorMensal:99},{ativo:true,ciclo:'unico',valorMensal:500}];
  const bills=[
    {status:'paid',paidDate:'2026-09-01',valorCentavos:10000,vencimento:'2026-08-01'},
    {status:'paid',paidDate:'2026-08-31',valorCentavos:90000,vencimento:'2026-08-01'},
    {status:'cancelled',paidDate:'',valorCentavos:80000,vencimento:'2026-08-01'},
    {status:'open',paidDate:'',valorCentavos:12345,vencimento:'2026-09-23'},
    {status:'open',paidDate:'',valorCentavos:5000,vencimento:'2026-09-24'}
  ];
  assert.deepEqual(m.totals(clients,bills,'2026-09-24'),{active:3,mrr:0.3,paid:100,overdue:123.45,overdueCount:1});
});
test('cadastros antigos são compatíveis, mas não inventam início para gerar dívida',()=>{
  const c=m.normalizeClient({empresa:'Legado',ativo:true,valorMensal:150,plano:'Essencial'});
  assert.equal(c.ciclo,'mensal');
  assert.equal(c.servico,'Outro');
  assert.equal(m.eligible(c,'2026-09'),false);
});