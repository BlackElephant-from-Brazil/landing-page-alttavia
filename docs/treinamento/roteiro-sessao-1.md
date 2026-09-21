# Sessão 1: o painel da Alttavia

**Terça, 22 de setembro, das 09:00 às 10:30, hora de Lisboa.** Remota e gravada, no staging: a versão de teste do site, com o Stripe em modo de teste. Nenhum pagamento é real, mas a base de dados é a mesma da produção.

## Objetivo

Ao fim da sessão você leva sozinha um pedido pago até a conclusão, pelo painel.
E sabe ajustar o catálogo de serviços, que fica pronto até quinta.

## O que ter aberto

O painel em **https://staging--bank-and-nif-in-portugal.netlify.app/admin/login**, num computador com Chrome, Edge ou Safari. A sua senha atual do painel, que continua valendo (na gravação ela aparece só como pontos). Se não lembrar dela, use **Forgot your password?** na tela de entrada antes das 09:00: o código de 6 dígitos chega no info@. Três PDFs quaisquer, sem dados de clientes, para enviar como entregáveis. Este roteiro no computador, para copiar os textos dos exercícios.

## Agenda

| Hora | O que fazemos |
|---|---|
| 09:00 | Abertura. Hoje nada muda no site. As vendas pelo sistema novo começam na sexta. |
| 09:04 | Entrar com a sua senha atual. Ela continua valendo, também depois do lançamento. Na tela de entrada fica **Forgot your password?**: se um dia esquecer, ele manda um código de 6 dígitos ao info@ (remetente hello@send.alttavia-relocation.com; se não chegar em um minuto, veja o spam) e você cria uma senha nova de 12 caracteres ou mais. Em **Settings**, **Change password** pede a atual. Hoje só mostramos onde ficam os dois. Por fim, **Sign out**, no pé do menu, leva ao site público. Entre de novo por **/admin/login**, com a mesma senha. |
| 09:14 | **Overview**: o período, os seis números (hoje todos de teste), os gráficos (passe o mouse), **In progress** e **Awaiting review**. A coluna **Client** mostra o e-mail: em **In progress**, a linha de business+emily@guyshore.com mostra **7 to review**. Um clique na linha abre o pedido. O botão **Feedback**, no canto de toda página, já vale a partir daqui. |
| 09:20 | O pedido de teste da Emily, do começo ao fim (abaixo). |
| 10:02 | **Users**: busca por e-mail. Um clique abre o perfil e os pedidos da conta. **business+admin@guyshore.com** é a conta de suporte do Guilherme. |
| 10:05 | **Services**: a lista e o editor. Nos quatro serviços do site, preço e código ficam travados. **Deactivate** pede confirmação, tira de venda na hora e guarda o histórico. Depois, os exercícios 3 e 1 no **Bank Account only**. |
| 10:22 | Pedidos para praticar e dever de casa. |
| 10:30 | Fim da gravação. Seguimos 30 minutos no Stripe, sem gravar, a começar pelo nome **Consulting** que ainda aparece no checkout. |

### O pedido de teste (09:20 às 10:02)

O pedido já está pronto: cliente **Emily Carter** (conta business+emily@guyshore.com; nas procurações, Emily Rose Carter), **NIF + Bank Account**, €497, pago com o cartão de teste, na etapa **Documents**. Os dados do passaporte estão preenchidos, o contrato versão 1 foi preparado e enviado, e os 7 documentos obrigatórios esperam revisão. Os arquivos são exemplos marcados SAMPLE FOR TRAINING. Abra pelo **Overview** ou por **Orders**.

1. **Avisos.** Este pedido já gerou quatro e-mails: **Payment received** e **Your service agreement**, com o PDF anexo, para a cliente; **New paid order** e **Documents ready to review** para a equipe. No staging, os avisos da equipe vão para a caixa de testes do Guilherme, não para o info@, e a Emily é uma conta dele. Ele mostra os quatro na tela.
2. **Documentos.** **Download** abre o arquivo numa aba nova. **Approve** e **Reject** só aparecem em arquivos **To review**, e a aprovação não se desfaz. Comece pelo **Proof of address**: **Reject** pede o motivo, em inglês, e **Reject and notify** manda à cliente o e-mail **A new file is needed: Proof of address**. Ela lê o motivo palavra por palavra, no e-mail e no painel dela. O Guilherme mostra esse e-mail e faz a Emily enviar um arquivo novo. Recarregue a página: o novo fica **To review**, o rejeitado passa para **1 earlier upload** (clique para ver, com o motivo), e um novo **Documents ready to review** chega à caixa da equipe. Aprove os outros seis e deixe o Proof of address novo para o passo 5.

<!-- Guilherme: depois do Reject, rode
node C:\Users\guilh\alttavia-tools\session-order.mjs reupload proof_of_address --base https://staging--bank-and-nif-in-portugal.netlify.app
Só funciona em documento rejeitado (senão 409). Se ela rejeitar outro: passport, origin_tax_number, bank_statements, employment_proof, poa_nif, poa_bank. Antes das 09:00, rode uma vez com proof_of_address ainda em To review: parar em "This slot already has a file." prova que o comando chega ao staging sem mudar o pedido. Não clique nos botões dos quatro e-mails antigos: apontam para localhost. Pedido direto: /admin/orders?order=e489bdb4-d9ca-491d-8086-0d0b2bd30938. -->

3. **Procuração.** **Download deed** gera na hora uma procuração nova, sem assinatura, com os dados de **Details for the deeds** e a data de hoje, e nada fica guardado. A cópia que o cliente assina à mão e envia abre em **Download**, na linha do arquivo. As duas da Emily são o próprio PDF gerado, sem assinatura: num cliente real, confira a assinatura antes de aprovar.
4. **Contrato.** **Service agreement** mostra o modelo, a versão, a data de **Prepared** e a de **Emailed**. **Download** salva o PDF no computador. Se o cliente mudar os dados em **Edit your details**, surge um aviso âmbar. **Regenerate and resend** pede confirmação, prepara a versão seguinte e manda de novo ao cliente.
5. **Etapas**, no topo do pedido. Com o Proof of address novo ainda sem aprovação, a etapa **Documents** mostra um aviso, e o avanço funciona assim mesmo. Use **Forward**, **Back**, ou **Jump to** e **Go**. Aprove o Proof of address depois, em qualquer etapa. Pare em **Issued documents delivery**, a sétima de oito. Cada mudança fica em **History**, no fim do pedido.
6. **Entregáveis.** Em **Deliverable**, escolha o item: o nome entra em **Label the client sees**. Depois **Choose file** e **Upload**. A cliente vê o arquivo na hora, sem e-mail. Envie os três: **Your Portuguese NIF**, **Finanças access** e **Your Portuguese IBAN**. Envie também um arquivo errado de propósito, com **Other file** e um nome qualquer, e apague com **Remove** e **Yes, remove**.
7. **Relatório.** Antes de escrever, clique **Forward**. A pergunta mostra, logo abaixo, **Not sent yet: the report for the client.** Se faltasse um entregável, ele viria na mesma linha. Clique **Cancel**, escreva em **Report for the client** e clique **Save report**. O cliente lê quando o pedido é concluído.
8. **Concluir.** **Forward** até **Account open**. O painel pergunta antes, e **Confirm** conclui e manda à cliente o e-mail **All done** (assunto "Your NIF + Bank Account order is complete"), uma vez só: numa segunda conclusão, a pergunta avisa que nenhum e-mail sai. Por isso entregáveis e relatório vêm antes. O e-mail chega na caixa de testes, e o Guilherme mostra.

Para praticar à vontade: os pedidos das contas **@demo.alttavia.invalid** (ana, ben, carla, dora), de onde nenhum e-mail sai. O NIF + Bank Account de **ben@** está em **Issued documents delivery**: clique **Forward** e a pergunta mostra o **Not sent yet**; depois **Cancel**. E o **Couple package** de **business+brooks@guyshore.com**: dois requerentes, 4 procurações, 14 documentos a revisar e nenhum contrato, porque o pacote de casal ainda não tem modelo. Já foi concluído uma vez: clique **Back** e depois **Forward**, e a pergunta avisa que nenhum e-mail sai. No staging, todo pedido é de teste: o e-mail na coluna **Client** diz de quem é.

## Os três exercícios (10:05)

O staging usa a mesma base da produção: o que você salvar em **Services** vale para o lançamento. Na sessão, faça os exercícios 3 e 1 no **Bank Account only**, que tem os três, e clique **Save service**. O resto, incluindo o exercício 2 nesse serviço, fica para o dever de casa, até quinta. Em cada um dos outros serviços, faça tudo e clique **Save service** uma vez. Não mexa em **Service contract** nem na parte **Stripe**.

**1. Dois documentos opcionais para o trabalhador independente.** Em Bank Account only, NIF + Bank Account e Couple package, clique **Add document** duas vezes. Nos dois, deixe **One per applicant** marcado, como já vem, e desmarque **Required**. O resto fica como vem.

| | Primeiro documento | Segundo documento |
|---|---|---|
| Label | `Annual tax return (self employed)` | `Proof of services provided (self employed)` |
| Note | `Self employed only. Your last annual tax return, validated by the tax authority. In Portuguese, English or Spanish, or with a certified translation.` | `Self employed only. For example invoices or receipts for your clients. In Portuguese, English or Spanish, or with a certified translation.` |

O cliente vê **Optional.** antes da nota. Troque também a nota de **Proof of profession** por:
`Employer statement or payslip from the last 6 months. If self employed, your commercial register excerpt. In Portuguese, English or Spanish, or with a certified translation.`

**2. Aviso de idioma.** No fim da nota, depois de um espaço, cole `In Portuguese, English or Spanish, or with a certified translation.` em **Proof of address** (quatro serviços), **Tax identification number from your country** e **Bank statements or annual income statement** (três com conta). Confirme antes os idiomas que o banco e as Finanças aceitam.

**3. Nota do passaporte no Bank Account only.** O documento **Passport** está sem nota. Use a dos outros serviços: `Photograph of the full page with all four corners visible.`

## Dever de casa, de terça a sexta

1. Numa **janela anônima** (o painel continua aberto), com um e-mail pessoal seu e não o info@, abra **https://staging--bank-and-nif-in-portugal.netlify.app/en** e clique **Start my application**. Endereço fora de Portugal, **Just me**, **Yes, I have one** no NIF e **Yes, open one for me** na conta. Com passaporte de fora do EEE, escolha um visto da lista, por exemplo D7: **Not applying for a visa** leva a uma tela sem nada para comprar. O resultado é **Bank Account only**, €399: clique **Continue · €399**. Depois, o seu nome, o seu e-mail e o código de 6 dígitos que chega nele abrem a sua área de cliente. O código vem de hello@send.alttavia-relocation.com: se não chegar em um minuto, veja o spam.
2. Na sua área, abra o pedido, clique **Pay €399 and start** e pague com o cartão **4242 4242 4242 4242** (validade futura, CVC qualquer). Na volta, o formulário dos seus dados abre sozinho; se não abrir, clique **Confirm my details**. Use dados de passaporte inventados e clique **Confirm and open my agreement**: o contrato abre numa aba nova e uma cópia chega no seu e-mail. Envie arquivos de exemplo, nunca de clientes. A procuração sai em **Download to sign**; no teste, envie o próprio PDF, sem assinar, em **Upload the signed copy**.
3. No painel, cuide do pedido como na sessão, até concluir. No seu e-mail chega o que o cliente recebe: **Payment received**, **Your service agreement**, **A new file is needed** se você rejeitar algo e, ao concluir, **Your Bank Account only order is complete**. Os avisos da equipe (**New paid order**, **Documents ready to review**) e as notas de **Feedback** vão para a caixa de testes do Guilherme, não para o info@. Os botões desses e-mails abrem o staging. No **Bank Account only** a lista de entregáveis está vazia: escreva o nome em **Label the client sees**, por exemplo `Your Portuguese IBAN`. Se esse item deve estar sempre na lista, acrescente com **Add deliverable** em **Services** e avise o Guilherme.
4. Cada coisa que travar ou estranhar vira uma nota no botão **Feedback**, uma por assunto: **What did you expect**, **What happened** e a prioridade em **How much does it matter**. Sobre telas do cliente, cole o endereço da página em **Which screen**. Com um pedido aberto o botão não responde: copie o endereço da barra, feche o pedido, clique **Feedback** e cole o endereço em **Which screen**.
5. O que chegar até quinta entra na versão que vai ao ar na sexta. Na sexta, só o que for **Blocks my work**. O andamento de cada nota fica em **Feedback**, no menu: **Open**, **Planned**, **Done** ou **Won't do**.
6. Antes de quinta, instale no celular um app autenticador, como o Google Authenticator. O segundo fator entra na quarta e passa a ser pedido na quinta.
7. Até quinta, termine os exercícios em **Services**: o 2 no **Bank Account only**; o 1 e o 2 no **NIF + Bank Account** e no **Couple package**; o 2 no **NIF only**, só no **Proof of address**. Clique **Save service** uma vez em cada serviço.

## Glossário do painel

Alguns títulos e campos aparecem em maiúsculas na tela (por exemplo JUMP TO, LABEL, NOTE). São os mesmos nomes deste roteiro.

| Inglês | Português | Inglês | Português |
|---|---|---|---|
| Open orders / Open, unpaid | pedidos não pagos | Paid / Completed | pagos / concluídos |
| In progress / Paid, in progress | pagos, em andamento | Documents to review / Awaiting review | documentos a revisar |
| Waiting / Not arrived | ainda não enviado / não chegou | To review / Approved / Rejected | a revisar / aprovado / rejeitado |
| 1 earlier upload | envio anterior | Details for the deeds | dados das procurações |
| Service agreement | contrato de serviço | Prepared / Emailed / Not emailed yet | preparado / enviado / e-mail ainda não enviado |
| Awaiting payment / Documents / Submitted | aguardando pagamento / documentos / enviado às Finanças | NIF ready / Finanças access ready | NIF pronto / acesso às Finanças pronto |
| With the bank / Issued documents delivery | no banco / entrega dos documentos emitidos | Account open / Final stage | conta aberta / etapa final |
| Deliverable / Label the client sees | entregável / nome que o cliente vê | Not sent yet / Still to send | o cliente ainda não recebeu / falta enviar |
| Short code / Code | código do serviço, no editor / código: na lista de serviços, o do serviço; no editor, o de cada etapa, documento ou entregável | One per applicant / Required | um por requerente / obrigatório |
| Active / Inactive | à venda / fora de venda | Deactivate / Reactivate | tirar de venda / voltar a vender |
| Blocks my work / Should change / Nice to have | impede meu trabalho / deveria mudar / seria bom | Open / Planned / Done / Won't do | aberta / planejada / feita / não será feita |
