# Painel de clientes — operação e validação

## O que está disponível

- Visão geral: clientes ativos, receita mensal contratada, recebido no mês e cobranças vencidas.
- Clientes: pesquisa por empresa, responsável, e-mail, documento e responsável interno; filtros de situação e serviço; ordenação por nome, cadastro ou mensalidade; lista ou cartões.
- Cadastro/edição: empresa, responsável, CPF/CNPJ opcional, e-mail, telefone, responsável interno, serviço, pacote personalizável, início, situação, valor do projeto, mensalidade, dia de vencimento, forma de pagamento e observações.
- Ficha detalhada com contrato e histórico de cobranças.
- Financeiro: mensalidades por competência, cobranças avulsas, baixas com data de recebimento, cancelamento e reabertura.
- Inativação de clientes sem apagar histórico. Não cria contas de Authentication, boletos ou débitos automáticos.

## Uso

1. Em Clientes, clique Novo cliente. Cadastre empresa e responsável, configure contrato e salve.
2. Para clientes antigos, revise contato/responsável e preencha a data de início antes de gerar mensalidades. A versão antiga não registrava essa informação; o painel não presume dívidas anteriores.
3. Em Financeiro, selecione a competência e clique Gerar mensalidades. São elegíveis contratos ativos, mensais, com valor positivo e iniciados até esse mês.
4. A geração usa transação e um ID estável por cliente/mês. Repetir não duplica nem sobrescreve pagamentos ou cancelamentos existentes.
5. O dia 31 é ajustado ao último dia de meses menores. Se o primeiro vencimento cair antes do início, usa a data de início. O primeiro mês tem valor integral; não há cálculo proporcional.
6. Cobranças avulsas servem para implantação, parcelas ou serviços extras.
7. Após conferir o recebimento integral, clique Receber e informe a data. O registro não movimenta dinheiro.
8. Para corrigir uma baixa, Reabrir devolve a cobrança a aberto e limpa a data de pagamento atual. O histórico lista cobranças e seus estados atuais; não é um livro de auditoria de todas as alterações.
9. Cancelar mantém a cobrança no histórico e a exclui dos indicadores. A mensalidade cancelada não é recriada ao gerar o mesmo mês.
10. Inativar um cliente interrompe a elegibilidade para novas mensalidades, mas não cancela suas cobranças anteriores.

## Interpretação dos valores

- Receita mensal contratada: soma das mensalidades de contratos ativos; é previsão, não caixa.
- Recebido no mês: soma das cobranças pagas cuja data de recebimento pertence ao mês atual.
- Vencida: cobrança aberta com data anterior ao dia atual em America/Sao_Paulo. Vencimento hoje continua em aberto.
- Cobranças são gravadas em centavos inteiros. O valor do contrato permanece em reais para compatibilidade.
- Não há juros, multa, conciliação bancária, pagamentos parciais, geração automática em segundo plano ou notificações.
- Alterar o contrato não reescreve cobranças já geradas. Para corrigir uma cobrança, cancele e crie uma avulsa correta.
- A lista é sincronizada em tempo real. Esta versão consulta a carteira completa; para milhares de registros será necessário paginação/consulta no servidor.

## Banco e segurança

Somente o projeto site-ebensystem. Autorização permanece no documento users/{uid} com role=admin. Nenhum usuário pode alterar roles pelo site.

clientes: campos anteriores preservados; novos campos são email, telefone, documento, servico, inicioContrato, ciclo, diaVencimento, formaPagamento, observacoes, schemaVersion, updatedAt e updatedBy.

cobrancas: clienteId, descricao, valorCentavos, vencimento (AAAA-MM-DD), competencia (AAAA-MM), tipo, status, paidDate e metadados de criação/alteração.

Regras negam todo acesso administrativo sem admin; validam campos; proíbem excluir clientes e cobranças; permitem alterar na cobrança apenas estado, data de recebimento e metadados de alteração. Valor, cliente, vencimento e autoria de criação são imutáveis após geração.

A versão atualizada de firestore.rules deve ser publicada no Console antes de usar os novos formulários. O usuário confirmou essa publicação durante a implementação. A publicação no GitHub não aplica regras.

## Validação

Testes automatizados:
node --test tests/admin-model.test.mjs tests/admin-data.test.mjs

11 casos aprovados: datas inválidas, ano bissexto, atraso, indicadores, compatibilidade, elegibilidade, geração idempotente, leitura do contrato atual, primeiro vencimento, baixa/reabertura e recusa de baixa inválida. Testes de operações usam um adaptador Firestore em memória; não substituem o Emulator Suite.

Também conferidos sintaxe JavaScript, referências relativas e IDs da interface. Não foi possível inspecionar visualmente em navegador conectado. Não foram criados dados de teste no Firebase real.

Aceite no site publicado:
- Cadastre uma empresa de teste, recarregue, edite e confira a ficha.
- Gere duas vezes a mesma competência e confirme uma só cobrança.
- Registre uma cobrança vencida; dê baixa e confira os indicadores.
- Reabra/cancele e confirme o histórico.
- Inative o cliente e confirme que não entra na próxima geração.
- Verifique em celular e desktop.
- Sem login e com usuário sem role admin, confira bloqueio do painel e leitura/escrita negadas.
- No Rules Playground/Emulator Suite, confira escrita em users negada até para admin, alteração de valor em cobrança negada e exclusões negadas.

## Referências de produto

HubSpot CRM: separação de contatos/empresas e visão consolidada.
https://www.hubspot.com/products/crm

Asaas: cobranças recorrentes organizadas por competência e vencimento.
https://docs.asaas.com/docs/assinaturas

As referências orientaram a organização. Não há integração com esses serviços.