# Sessão 1: o painel da Alttavia

**Terça, 22 de setembro, das 09:00 às 10:30, hora de Lisboa.** Remota e gravada, no staging: a cópia de teste da plataforma, com o Stripe em modo de teste. Nenhum pagamento é real.

## Objetivo

Ao fim da sessão você leva sozinha um pedido pago até a conclusão, pelo painel.
E o catálogo de serviços sai pronto para o lançamento.

## O que ter aberto

O painel em **https://staging--bank-and-nif-in-portugal.netlify.app/admin/login**, num computador com Chrome, Edge ou Safari. A sua senha nova, que você recebeu à parte (na gravação ela aparece só como pontos). A caixa **info@alttavia-relocation.com**, para o código de 6 dígitos. Este roteiro no computador, para copiar os textos dos exercícios.

## Agenda

| Hora | O que fazemos |
|---|---|
| 09:00 | Abertura. Hoje nada muda no site. As vendas pelo sistema novo começam na sexta. |
| 09:05 | Entrar com a senha nova. Depois **Sign out** e **Forgot your password?** até o fim: código no info@ (veja o spam), senha nova de 12 caracteres ou mais, entrar com ela. Em **Settings**, a troca de senha pede a atual. |
| 09:13 | **Overview**: o período, os seis números, os gráficos (passe o mouse), **In progress** e **Awaiting review**. Um clique na linha abre o pedido. |
| 09:20 | Um pedido de teste pago, do começo ao fim (abaixo). |
| 10:00 | **Users**: busca por e-mail. Um clique abre o perfil e os pedidos da conta. |
| 10:04 | **Services**: a lista e o editor. Nos quatro serviços do site, preço e código ficam travados. **Deactivate** tira de venda e guarda o histórico. |
| 10:08 | Os três exercícios. |
| 10:25 | O botão **Feedback** e o dever de casa. |
| 10:30 | Fim da gravação. Seguimos 30 minutos no Stripe, sem gravar. |

### O pedido de teste (09:20 às 10:00)

O Guilherme deixa pronto um pedido **NIF + Bank Account**, pago com o cartão de teste, com documentos e dados do cliente.

1. **Avisos.** Pedido pago gera o e-mail **New paid order**. O último documento obrigatório gera **Documents ready to review**. No staging eles vão para a caixa de testes, e o Guilherme mostra.
2. **Documentos.** **Download** abre o arquivo. **Approve** aprova. **Reject** pede o motivo, e **Reject and notify** avisa o cliente, que lê o motivo palavra por palavra. O envio anterior fica em **earlier upload**.
3. **Procuração.** **Download deed** baixa a procuração com os dados de **Details for the deeds**. O cliente assina à mão e envia no mesmo slot.
4. **Contrato.** **Service agreement** mostra versão, data e envio. **Download** abre o PDF. Se o cliente mudar os dados, surge um aviso âmbar e **Regenerate and resend** prepara outra versão.
5. **Etapas.** **Forward**, **Back**, ou **Jump to** e **Go**. Documento obrigatório sem aprovação gera um aviso, e o avanço funciona assim mesmo. Pare em **Issued documents delivery**.
6. **Entregáveis.** Escolha o item, **Choose file** e **Upload**: o cliente vê na hora. Envie um arquivo errado de propósito e apague com **Remove**.
7. **Relatório.** **Report for the client** e **Save report**. O cliente lê quando o pedido é concluído.
8. **Concluir.** **Forward** até **Account open**. O painel pergunta antes, e **Confirm** manda o e-mail **All done**, uma vez só. Por isso entregáveis e relatório vêm antes.

Para praticar à vontade, use os pedidos das contas **@demo.alttavia.invalid**: nenhum e-mail sai deles.

## Os três exercícios (10:08)

O staging usa a mesma base da produção: o que você salvar em **Services** vale para o lançamento. Comece pelo **Bank Account only**, que tem os três. Em cada serviço, faça tudo e clique **Save service** uma vez. O que sobrar vira a primeira tarefa de terça. Hoje não mexa em **Service contract** nem no **Stripe**.

**1. Dois slots opcionais para o trabalhador independente.** Em Bank Account only, NIF + Bank Account e Couple package, clique **Add document** duas vezes. Nos dois, marque **One per applicant** e desmarque **Required**. O resto fica como vem.

| | Primeiro slot | Segundo slot |
|---|---|---|
| Label | `Annual tax return (self employed)` | `Proof of services provided (self employed)` |
| Note | `Self employed only. Your last annual tax return, validated by the tax authority. In Portuguese, English or Spanish, or with a certified translation.` | `Self employed only. For example invoices or receipts for your clients. In Portuguese, English or Spanish, or with a certified translation.` |

O cliente vê **Optional.** antes da nota. Troque também a nota de **Proof of profession** por:
`Employer statement or payslip from the last 6 months. If self employed, your commercial register excerpt. In Portuguese, English or Spanish, or with a certified translation.`

**2. Aviso de idioma.** No fim da nota, depois de um espaço, cole `In Portuguese, English or Spanish, or with a certified translation.` em **Proof of address** (quatro serviços), **Tax identification number from your country** e **Bank statements or annual income statement** (três com conta). Confirme antes os idiomas que o banco e as Finanças aceitam.

**3. Nota do passaporte no Bank Account only.** O slot **Passport** está sem nota. Use a dos outros serviços: `Photograph of the full page with all four corners visible.`

## Dever de casa, de terça a sexta

1. Numa **janela anônima** (o painel continua aberto), com um e-mail pessoal seu e não o info@, abra **https://staging--bank-and-nif-in-portugal.netlify.app/en** e clique **Start my application**. Morada fora de Portugal, uma pessoa, já tem NIF, quer a conta: dá **Bank Account only**. Passaporte de fora do EEE pede um visto da lista.
2. Pague com o cartão **4242 4242 4242 4242** (validade futura, CVC qualquer). Em **Confirm my details**, o contrato abre numa aba nova. Envie arquivos de exemplo, nunca de clientes, e a procuração assinada.
3. No painel, cuide do pedido como na sessão, até concluir. Veja no seu e-mail o que o cliente recebe.
4. Cada coisa que travar ou estranhar vira uma nota no botão **Feedback**, uma por assunto. Sobre telas do cliente, escreva a página em **Which screen**. Com um pedido aberto, feche o pedido antes.
5. O que chegar até quinta entra na versão que vai ao ar. Na sexta, só o que for **Blocks my work**. O andamento fica em **Feedback**, no menu.
6. Antes de quinta, instale no celular um app autenticador, como o Google Authenticator, para o segundo fator.

## Glossário do painel

| Inglês | Português | Inglês | Português |
|---|---|---|---|
| Orders / Users | pedidos / contas | Approve / Reject | aprovar / rejeitar |
| Open orders | não pagos | Waiting | ainda não enviado |
| In progress | pagos, em andamento | To review | a revisar |
| Stage / Final stage | etapa / etapa final | Download deed | baixar a procuração |
| Forward / Back | avançar / voltar | Service agreement | contrato de serviço |
| Jump to | pular para | Deliverables / Report | entregáveis / relatório |
| Label / Note / Code | nome / nota / código | Active / Deactivate | à venda / fora de venda |
| Required | obrigatório | One per applicant | um por requerente |
| Blocks my work | impede meu trabalho | Should change / Nice to have | deveria mudar / seria bom |
