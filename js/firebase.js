import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import { getAuth, setPersistence, browserSessionPersistence } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { initializeFirestore, memoryLocalCache, doc, getDocFromServer } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

if (Object.values(firebaseConfig).some(value => !value)) {
  throw new Error('Firebase não configurado');
}
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// Sessão mantida ao recarregar; encerrada ao fechar a aba. Sem cache persistente de clientes.
export const authReady = setPersistence(auth, browserSessionPersistence);
export const db = initializeFirestore(app, { localCache: memoryLocalCache() });
export async function isAdmin(user) {
  if (!user) return false;
  // Consulta ao servidor: nunca autorizar usando uma permissão antiga do cache.
  const profile = await getDocFromServer(doc(db, 'users', user.uid));
  return profile.exists() && profile.data().role === 'admin';
}
