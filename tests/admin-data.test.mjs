import test from 'node:test';
import assert from 'node:assert/strict';
import {generateMonthlyBill,updateBillStatus} from '../js/admin-data.js';
function database() {
  const records=new Map();
  const store={
    doc:(_,collection,id)=>collection+'/'+id,
    serverTimestamp:()=>123,
    runTransaction:async(_,callback)=>{
      const writes=[];
      const result=await callback({
        get:async ref=>({exists:()=>records.has(ref),data:()=>records.get(ref)}),
        set:(ref,data)=>writes.push(()=>records.set(ref,data)),
        update:(ref,data)=>writes.push(()=>records.set(ref,{...records.get(ref),...data})),
      });
      writes.forEach(write=>write());return result;
    },
  };
  return {records,store,db:{},uid:'admin'};
}
test('geração é idempotente e preserva mensalidades pagas/canceladas',async()=>{
  const env=database(),request={...env,clientId:'cliente',month:'2026-02'};
  env.records.set('clientes/cliente',{ativo:true,ciclo:'mensal',valorMensal:129.9,inicioContrato:'2026-01-01',diaVencimento:31,plano:'Profissional'});
  assert.equal(await generateMonthlyBill(request),true);
  assert.equal(env.records.get('cobrancas/cliente_2026-02').valorCentavos,12990);
  assert.equal(env.records.get('cobrancas/cliente_2026-02').vencimento,'2026-02-28');
  for(const status of ['open','paid','cancelled']){
    const bill=env.records.get('cobrancas/cliente_2026-02');
    bill.status=status;
    assert.equal(await generateMonthlyBill(request),false);
    assert.equal(env.records.get('cobrancas/cliente_2026-02').status,status);
  }
});
test('geração lê contrato atual, não um valor desatualizado da tela',async()=>{
  const env=database();
  env.records.set('clientes/cliente',{ativo:false,ciclo:'mensal',valorMensal:99,inicioContrato:'2026-01-01',diaVencimento:10,plano:'Start'});
  assert.equal(await generateMonthlyBill({...env,clientId:'cliente',month:'2026-09'}),false);
  assert.equal(env.records.size,1);
});
test('primeira cobrança nunca vence antes do início do contrato',async()=>{
  const env=database();
  env.records.set('clientes/cliente',{ativo:true,ciclo:'mensal',valorMensal:100,inicioContrato:'2026-09-20',diaVencimento:5,plano:'Start'});
  await generateMonthlyBill({...env,clientId:'cliente',month:'2026-09'});
  assert.equal(env.records.get('cobrancas/cliente_2026-09').vencimento,'2026-09-20');
});
test('baixa e reabertura preservam valor, cliente e vencimento',async()=>{
  const env=database();
  env.records.set('cobrancas/b',{status:'open',paidDate:'',valorCentavos:10000,clienteId:'c',vencimento:'2020-01-01'});
  await updateBillStatus({...env,id:'b',status:'paid',paidDate:'2020-02-01'});
  assert.equal(env.records.get('cobrancas/b').status,'paid');
  await assert.rejects(()=>updateBillStatus({...env,id:'b',status:'paid',paidDate:'2020-02-02'}),/já mudou/);
  await updateBillStatus({...env,id:'b',status:'open'});
  const bill=env.records.get('cobrancas/b');
  assert.equal(bill.paidDate,'');assert.equal(bill.valorCentavos,10000);assert.equal(bill.clienteId,'c');assert.equal(bill.vencimento,'2020-01-01');
});
test('não recebe cobrança cancelada nem aceita data futura',async()=>{
  const env=database();
  env.records.set('cobrancas/b',{status:'cancelled',paidDate:''});
  await assert.rejects(()=>updateBillStatus({...env,id:'b',status:'paid',paidDate:'2020-02-01'}),/já mudou/);
  await assert.rejects(()=>updateBillStatus({...env,id:'b',status:'paid',paidDate:'2099-01-01'}),/Data/);
  await assert.rejects(()=>updateBillStatus({...env,id:'ausente',status:'open'}),/não encontrada/);
});