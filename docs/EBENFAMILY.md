# EbenFamily — página, privacidade e exclusão

URLs públicas:
- Produto: https://ebensystem.com.br/ebenfamily/
- Política: https://ebensystem.com.br/ebenfamily/privacy/
- Pedido de exclusão: https://ebensystem.com.br/ebenfamily/#excluir-conta

A política foi redigida a partir do levantamento da versão 1.0.6 fornecido pelo proprietário e dos compromissos expressamente confirmados: Ebensystem Tecnologia LTDA, contato@ebensystem.com.br, prazo de até 30 dias após confirmar identidade, tratamento de perfis infantis pelo responsável legal e retenções descritas no texto.

## Formulário

Endpoint e formato de envio iguais aos do contato. Não foi alterado Google Apps Script, planilha ou documento:
- Nome -> nome
- Sobrenome -> empresa
- E-mail -> email
- WhatsApp / Telefone -> telefone
- Motivo opcional -> mensagem, precedida de [EbenFamily — solicitação de exclusão de conta]

A solicitação não exclui contas automaticamente. A equipe deve confirmar identidade, executar a exclusão no projeto Firebase DO APLICATIVO e comunicar o resultado. Não confundir com site-ebensystem.

O fetch no-cors mantém o comportamento atual do contato: resposta opaca impede verificar pelo navegador se a gravação no Google foi concluída. A interface pede que o usuário aguarde confirmação da equipe. Não foi enviada solicitação fictícia para o endpoint de produção.

## Google Play

Use a URL /ebenfamily/privacy/ no campo Política de Privacidade e o link #excluir-conta no campo de exclusão de conta, quando solicitado pelo Console.

No aplicativo, inclua acesso à política e atualize o botão de exclusão, que atualmente aponta para /produtos/, para /ebenfamily/#excluir-conta. Este repositório contém apenas o site; essa mudança no app precisa ser feita em seu código e publicada na loja.

A seção Segurança dos dados do Play Console deve ser preenchida de acordo com a coleta e o compartilhamento reais, incluindo Firebase. Publicar a política não preenche essa seção nem garante aprovação.

Referências oficiais:
https://support.google.com/googleplay/android-developer/answer/10144311
https://support.google.com/googleplay/android-developer/answer/13327111

## Validação

4 testes locais passaram:
node --test tests/ebenfamily-form.test.cjs

Também foram conferidas a sintaxe e as referências relativas. Os GIFs não foram modificados. Não houve inspeção visual em navegador conectado nem confirmação de gravação real no endpoint Google.