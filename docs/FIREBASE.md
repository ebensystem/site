# Ativação Firebase — Site-Ebensystem

> Painel atualizado: consulte [PAINEL.md](PAINEL.md) para cadastro ampliado, edição, cobranças e regras da versão atual.

## Estado atual

Projeto exclusivo: site-ebensystem. App Web configurado em js/firebase-config.js com os identificadores públicos fornecidos. Authentication Email/Password e Firestore (default), região southamerica-east1, já foram criados pelo proprietário. Nenhuma alteração no EbenFamily e nenhum deploy realizado.

A autorização agora usa EXCLUSIVAMENTE users/{UID}.role no Firestore, substituindo as custom claims da versão anterior. Não execute o antigo procedimento Admin SDK. Contas sem documento ou sem role exatamente admin são negadas. O frontend nunca cria/edita permissões. As regras permitem ao usuário apenas consultar seu próprio documento e proíbem qualquer escrita em users, inclusive por admins do site. A administração de papéis acontece pelo Console com permissões IAM.

## Próximos passos no Console (nesta ordem)

### 1. Publicar regras

Abra https://console.firebase.google.com/project/site-ebensystem/firestore/rules

Confirme o projeto Site-Ebensystem e o banco (default). Substitua TODO o conteúdo pelo arquivo firestore.rules da raiz do site e clique Publicar. Não acrescente as regras a regras antigas que concedam acesso público: permissões em matches sobrepostos se somam.

O arquivo local não muda o Firebase sozinho. As regras permitem operações em clientes apenas para admin e validam os campos. As demais coleções ficam bloqueadas, exceto a consulta individual do próprio documento users/{uid}.

### 2. Criar a autorização do administrador

1. Authentication > Usuários > abra adm@ebensystem.com.br.
2. Copie o UID completo (não o e-mail).
3. Firestore Database > Dados > Iniciar coleção.
4. ID da coleção: users (minúsculo).
5. ID do documento: cole exatamente o UID copiado. NÃO use ID automático.
6. Adicione o campo role, tipo string, valor admin (minúsculo, sem aspas no campo do Console).
7. Salve. O resultado será users/UID_REAL com { "role": "admin" }.

Não inclua senha nesse documento. Nenhuma alteração é necessária no usuário do Authentication. O Console autorizado por IAM pode criar esse registro, mesmo que as regras bloqueiem gravações pelo site.

Para revogar acesso, altere role para cliente/funcionario ou exclua o documento no Console. As regras consultam a permissão no banco em cada operação protegida; o painel também observa alterações na permissão e bloqueia a interface. Não é necessário aguardar expiração de custom claims. Dados já vistos não podem ser recuperados do usuário após revogação.

### 3. Authorized Domains

Authentication > Configurações > Domínios autorizados:
- ebensystem.com.br
- www.ebensystem.com.br, se usado
- localhost para Live Server
- 127.0.0.1, se usar esse endereço local
- <conta-ou-organizacao>.github.io, somente se acessar por esse domínio

Não inclua https://, portas ou caminhos. Preserve o domínio padrão site-ebensystem.firebaseapp.com. Não é necessário habilitar Firebase Hosting.

## Teste local

Abra a raiz do site no VS Code, use Live Server e acesse http://localhost:5500/contato/index.html#login (ajuste a porta se necessário). Não use file://. Os testes usam o projeto REAL: utilize clientes fictícios e remova-os pelo Console depois.

1. Sem login, abra /base/index.html: deve voltar ao contato com formulário aberto.
2. Informe senha incorreta: erro amigável, senha limpa e nenhuma senha na URL.
3. Entre com a conta admin: deve abrir painel e carregar clientes.
4. Cadastre um cliente com valores decimais, recarregue e confira a persistência.
5. Clique Sair e tente voltar ao painel: deve exigir login novamente.
6. Crie uma segunda conta de teste no Authentication, sem documento users ou com role cliente: não deve entrar no painel.
7. Com admin conectado, remova temporariamente sua role no Console: painel deve bloquear. Restaure admin depois.
8. Bloqueie rede/CDN ou desative JavaScript: painel não deve revelar dados nem formulário enviar senha via GET.
9. Verifique contato comercial, menu mobile, modal e caminhos relativos. Layout e cores não foram alterados nesta etapa.

Teste também as regras via Rules Playground ou Emulator Suite:
- Anônimo não pode consultar users nem ler/gravar clientes.
- Autenticado só pode obter seu próprio users/{uid}; não pode listar users ou obter documento alheio.
- Nem usuário comum nem admin podem criar/alterar/excluir documentos users pelo SDK/REST. Tentativa de promover a si próprio para admin deve falhar.
- Sem role admin: get/list/create/update/delete em clientes negados.
- Com users/UID.role=admin: leitura/criação/edição válidas permitidas; exclusões negadas; campos extras, valores negativos e autoria falsa devem ser rejeitados.
- Atualização não pode mudar createdAt/createdBy. Na criação use serverTimestamp() para createdAt.

## GitHub Pages

Somente quando decidir publicar, envie os arquivos do site incluindo js/, css/auth.css e css/admin.css. Não envie .backups/. Não houve deploy automático.

Após publicar, repita os testes em https://ebensystem.com.br/contato/index.html#login e https://ebensystem.com.br/base/index.html, também em aba anônima e celular. Se usar GitHub Pages com subdiretório, teste /<repositorio>/contato/index.html: os links continuam relativos.

O HTML é público; Authentication identifica o usuário e Firestore Rules protegem os dados, independentemente de modificações feitas no HTML/JavaScript do navegador.

## Comportamento e estrutura preservados

- js/firebase.js inicializa uma única instância Firebase, sessão e banco com cache em memória; isAdmin consulta users/{uid} no servidor.
- js/login.js valida credenciais com Firebase, depois a permissão, e trata erros em português.
- js/admin.js mantém painel oculto até autorizar, observa a role, carrega clientes, cadastra e executa signOut.
- A sessão é mantida na mesma aba ao navegar/recarregar e termina ao fechar a aba. Não há persistência local de clientes.
- Coleção clientes conserva empresa, contato, gerente, plano, valorProjeto, valorMensal e pago; ativo e metadados createdAt/createdBy já existiam na integração anterior.
- Indicadores atuais: clientes ativos, receita mensal contratada, recebido no mês e cobranças vencidas; consulte PAINEL.md.
- A interface oferece cadastro, listagem, edição e inativação, além do controle de cobranças. Exclusões são bloqueadas para preservar histórico.
- Cliente/funcionario são reservados para evolução e não possuem acesso administrativo. Um futuro vínculo ownerUid exigirá alteração controlada do esquema e das regras.
- Formulário comercial Google Apps Script, app.js, HTML e CSS permaneceram intactos nesta etapa.

## Backup e revisão

A pasta recebida não contém .git. Cópia anterior dos seis arquivos modificados: .backups/firebase-20260924/. Diff gerado com git diff --no-index: .backups/firebase-20260924/changes.diff. Esse diff registra a transição de custom claims para roles no Firestore e a configuração pública do projeto.

Verificações estáticas de sintaxe e caminhos e testes simulados de autorização foram realizados. Testes reais de login, regras no emulador e visualização em navegador dependem de ambiente/configuração; não foram executados nesta etapa. Não foram criados usuários nem publicadas regras automaticamente.

## Referências

- https://firebase.google.com/docs/firestore/solutions/role-based-access
- https://firebase.google.com/docs/rules/rules-and-auth
- https://firebase.google.com/docs/auth/web/auth-state-persistence