import {normalizeClient, eligible, dueDate, validDate, today} from './admin-model.js';

// ID estável por cliente/competência; transação nunca sobrescreve mensalidade existente.
export async function generateMonthlyBill({db, store, clientId, month, uid}) {
  dueDate(month,1);
  return store.runTransaction(db,async transaction=>{
    const clientRef=store.doc(db,'clientes',clientId);
    const billRef=store.doc(db,'cobrancas',clientId+'_'+month);
    const [clientSnap,billSnap]=await Promise.all([transaction.get(clientRef),transaction.get(billRef)]);
    if(billSnap.exists() || !clientSnap.exists())return false;
    const client=normalizeClient(clientSnap.data());
    if(!eligible(client,month))return false;
    const vencimento=[dueDate(month,client.diaVencimento),client.inicioContrato].sort().at(-1);
    transaction.set(billRef,{
      clienteId:clientId,descricao:'Mensalidade '+month+' · '+client.plano,
      valorCentavos:Math.round(client.valorMensal*100),vencimento,competencia:month,
      tipo:'mensalidade',status:'open',paidDate:'',
      createdAt:store.serverTimestamp(),createdBy:uid,updatedAt:store.serverTimestamp(),updatedBy:uid,
    });
    return true;
  });
}

export async function updateBillStatus({db,store,id,status,paidDate='',uid}) {
  if(!['open','paid','cancelled'].includes(status))throw new Error('Situação inválida.');
  if(status==='paid'&&(!validDate(paidDate)||paidDate>today()))throw new Error('Data de recebimento inválida.');
  return store.runTransaction(db,async transaction=>{
    const ref=store.doc(db,'cobrancas',id),snapshot=await transaction.get(ref);
    if(!snapshot.exists())throw new Error('Cobrança não encontrada.');
    const before=snapshot.data().status;
    if(!((before==='open'&&['paid','cancelled'].includes(status))||(['paid','cancelled'].includes(before)&&status==='open'))) {
      throw new Error('A cobrança já mudou. Atualize a visualização antes de continuar.');
    }
    transaction.update(ref,{status,paidDate:status==='paid'?paidDate:'',updatedAt:store.serverTimestamp(),updatedBy:uid});
  });
}