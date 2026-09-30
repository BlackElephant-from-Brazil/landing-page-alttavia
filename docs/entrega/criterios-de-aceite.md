<!--
Caminhos no repositório, só para o desenvolvedor:
Teste completo da plataforma = docs/treinamento/testes-ponta-a-ponta.html;
aviso de privacidade e mudanças aos termos = docs/legal/privacy-proposal.md e docs/legal/service-terms-changes.md.
-->

# Critérios de aceite da entrega

Plataforma de NIF e conta bancária da Alttavia Relocation, entregue a 25 de setembro de 2026 no ambiente de teste; folha atualizada a 30 de setembro de 2026. Produção: https://bank-nif-portugal.alttavia-relocation.com, com a versão indicada no documento de entrega. Teste: https://staging--bank-and-nif-in-portugal.netlify.app.

Cada linha é um teste para você fazer e marcar. **Passo N** remete ao **Teste completo da plataforma** (versão de 30/09, 34 passos). Sem outra indicação, teste no ambiente de teste, com o cartão `4242 4242 4242 4242`. As linhas que começam por **Em produção** só passam depois da publicação, o último passo do desenvolvedor (runbook, secção 0).

## 1. Site e formulário de pedido

- [ ] **1.1** Em produção, a página inicial mostra os quatro serviços a €149, €497, €399 e €597, e **Privacy** e **Service terms** no rodapé.
- [ ] **1.2** As respostas do passo 1 terminam em **NIF only** com **Continue · €149**, e **Back** não perde respostas. *Passo 1.*
- [ ] **1.3** Uma morada em Portugal termina num botão para o WhatsApp, com a mensagem já escrita.
- [ ] **1.4** No telemóvel, os ecrãs cabem sem deslizar para o lado, e uma fotografia enviada chega a **Uploaded**. *Passo 34.*

## 2. Área do cliente

- [ ] **2.1** O cliente entra sempre com o e-mail e um código de 6 dígitos de hello@send.alttavia-relocation.com. *Passos 2 e 29.*
- [ ] **2.2** A página inicial diz **Welcome.** antes do primeiro pagamento e **Welcome back.** depois. *Passos 2 e 9.*
- [ ] **2.3** Um segundo serviço comprado em **Services** aparece em **My purchases**, com data, valor e etapa. *Passos 10 e 11.*
- [ ] **2.4** Um pedido concluído mostra **Delivered**, os arquivos entregues, o **Closing report** e o contrato. *Passo 32.*

## 3. Pagamento

- [ ] **3.1** **Pay** abre o Stripe com o valor do pedido, e a volta ao site mostra **Payment received**. *Passo 4.*
- [ ] **3.2** Por baixo de **Pay** lê-se **By paying you accept the service terms and your service agreement.** O pedido regista a data e a versão dos termos, que a firma lê na secção **Service agreement** do pedido. *Passos 3 e 15.*
- [ ] **3.3** Em produção, uma compra real de €149 aparece paga no painel e é depois devolvida no Stripe. Feita pelo desenvolvedor logo depois da publicação.
- [ ] **3.4** A página do Stripe mostra o nome escolhido pela firma, e não **Consulting** (documento de entrega, decisão 9).

## 4. Documentos e procurações

- [ ] **4.1** Cada envio termina em **Uploaded** e o topo conta os recebidos. No NIF only são quatro (**Passport**, **Proof of address**, a procuração do NIF e **Signed service agreement**), e o topo termina em **4 of 4 received**. *Passos 6 e 7.*
- [ ] **4.2** **Download to sign** abre a procuração preenchida e datada de hoje, com **Sign exactly as you signed your passport.** *Passo 6.*
- [ ] **4.3** Na etapa **Documents**, o cliente troca ou apaga um arquivo ainda não aprovado. *Passo 8.*
- [ ] **4.4** No painel, **Reject and notify** mostra o motivo ao cliente, palavra por palavra. *Passo 16.*
- [ ] **4.5** **Forward** fica desativado até todos os documentos obrigatórios estarem aprovados. *Passos 16 e 18.*
- [ ] **4.6** No **Couple package**, há uma só procuração do banco, com as duas pessoas. *Passo 25.*

## 5. Contrato de serviço

- [ ] **5.1** Depois de pagar, a janela dos dados abre sozinha e o contrato abre em PDF e chega por e-mail. *Passos 4 e 5.*
- [ ] **5.2** O PDF traz o timbre, "VAT included" e a sede na Av. António Augusto Aguiar, 24. No ambiente de teste, a linha de assinatura da firma sai em branco e cada página diz no rodapé **Specimen from the test environment. Not a binding agreement.** *Passo 5.*
- [ ] **5.3** O contrato assinado à mão é enviado em **Signed service agreement** e revisto como os outros documentos. O **Forward** fica desativado em **Documents** até ele ser aprovado. O aviso **Signed service agreement received** vai para a equipa: no ambiente de teste, para a caixa de testes do desenvolvedor, sem o arquivo; em produção, para o info@alttavia-relocation.com, com a cópia anexada nos pedidos pagos com dinheiro real. *Passos 7 e 18.*
- [ ] **5.4** O **Couple package** recebe um só contrato, com as duas pessoas. *Passo 25.*
- [ ] **5.5** **Regenerate and resend** prepara a versão seguinte e manda-a de novo ao cliente. *Passo 23.*

## 6. Painel de administração

- [ ] **6.1** O **Overview** muda os seis números e os quatro gráficos a cada período. *Passo 13.*
- [ ] **6.2** **Orders** abre no Kanban, onde um pedido não pago não se arrasta. *Passos 14 e 26.*
- [ ] **6.3** **Forward**, **Back** e **Jump to** mudam a etapa, e **History** regista cada mudança. *Passo 19.*
- [ ] **6.4** Um arquivo enviado em **Deliverables** aparece logo ao cliente, e **Remove** tira-o dos dois lados. *Passo 20.*
- [ ] **6.5** Antes de concluir, a pergunta lista em **Not sent yet:** o que falta entregar. *Passos 21 e 24.*
- [ ] **6.6** Em **Users** você cria, edita e atribui compras. Apaga só clientes sem pedidos pagos, e nunca administradores. *Passos 27 a 30.*

## 7. E-mails

- [ ] **7.1** O cliente recebe uma vez cada e-mail do passo 33, e cada botão abre a página certa. *Passo 33.*
- [ ] **7.2** Concluir de novo o mesmo pedido não repete o e-mail de conclusão. *Passo 22.*
- [ ] **7.3** Em produção, os avisos à equipa chegam ao info@alttavia-relocation.com; no ambiente de teste, à caixa de testes do desenvolvedor. A compra real (3.3) traz o primeiro, **New paid order**. *Passos 7 e 17.*

## 8. Segurança

- [ ] **8.1** O painel só abre com senha, nunca com um código por e-mail. *Passo 12.*
- [ ] **8.2** O segundo fator fica fora do lançamento (decisão de 30/09): o painel abre com o e-mail e a senha, e o cartão **Second factor**, em **Settings**, fica disponível e opcional.
- [ ] **8.3** **Change password** exige a senha atual (*passo 31*). Em `/admin/login`, **Forgot your password?** manda um código de 6 dígitos ao info@ e leva a escolher uma senha nova.
- [ ] **8.4** O Guilherme mostra o teste automático de permissões: nenhum cliente vê dados de outro.

## 9. Ambientes

- [ ] **9.1** Em produção, corre a versão indicada no documento de entrega, publicada depois de uma cópia da base de dados.
- [ ] **9.2** O ambiente de teste fica no ar de forma permanente, com o Stripe em modo de teste e a base de dados da produção.
- [ ] **9.3** As contas de demonstração (@demo.alttavia.invalid) não recebem e-mails, contam no **Overview** e ficam na base, tal como os pedidos de teste.
- [ ] **9.4** Contas: Supabase (organização guyshore.com), R2, Netlify e Resend (desenvolvedor; a Resend com o domínio send.alttavia-relocation.com), Stripe (firma).

## Fica para depois

Nada desta lista impede o aceite.

- **Último passo do desenvolvedor:** o Stripe em modo real, as variáveis de produção, a nova build e a publicação à mão; logo depois, a compra real de €149 (3.3).
- **Depois do lançamento:** a sua revisão do aviso de privacidade (`/en/privacy`) e dos termos (`/en/service-terms`), publicados a 28/09 e aprovados para o lançamento; as correções entram numa atualização.
- **Depois do lançamento:** o Livro de Reclamações Eletrónico e a entidade de resolução alternativa de litígios, nos termos e no site.
- **Depois do lançamento:** o monitor externo que confirma a cada poucos minutos que o site responde; nenhum plano serve hoje. Até lá, o suporte recebe por e-mail os erros do servidor e os avisos de pagamento do Stripe que o site recusou ou não conseguiu registar.
- **Depois do lançamento:** as frases da página de vendas, do formulário e do catálogo que ainda não correspondem ao serviço (documento de entrega, secção 7).
- **Depois do lançamento:** a proteção contra robôs no envio do código e na entrada do painel, e a medição de visitas com aviso de cookies.
- **Antes da compra real, se possível:** a sua assinatura digitalizada no contrato. A 30/09 ainda não está na plataforma. Os contratos de pedidos reais já preparados só a recebem com **Regenerate and resend**; os de teste nunca a recebem.
- **Só se a firma o quiser:** o segundo fator na entrada do painel.
- **Leitura pela firma:** o contrato e a procuração do banco do **Couple package** (documento de entrega, decisão 2).
- **Decisão da firma:** planos pagos. Supabase Pro custa cerca de 25 USD por mês; o plano atual pausa após 7 dias sem uso e não faz cópias. Resend Pro custa cerca de 20 USD por mês; o plano atual manda 100 e-mails por dia.
- **Decisão da firma:** onde e com que frequência se guardam as cópias de segurança; hoje são feitas à mão, no computador do desenvolvedor.
- **A pedido da firma, com estimativa:** devoluções de pagamento dentro da plataforma (hoje, no Stripe) e as outras funcionalidades da secção 7 do documento de entrega.
- **A firma:** perguntas por escrito ao banco sobre nacionalidades recusadas e vistos aceites.
- **Com o Guilherme:** teste guiado de **Services** e **Feedback**.

## Assinaturas

A assinatura confirma os critérios marcados; um critério não marcado é anotado ao lado, com a data da correção. O suporte depois da entrega não tem custo para a Alttavia, por decisão do Guilherme. *Modelo para outro cliente: aqui entram [CONDIÇÕES] e [VALOR] por mês do suporte.*

| | Pela Alttavia Relocation | Pelo desenvolvedor |
|---|---|---|
| Nome | Patrícia Soares Viana, [A CONFIRMAR: em que qualidade assina pela ALTTAVIA RELOCATION, Unipessoal Lda. (por exemplo gerente)?] | Guilherme Kodenvis, guyshore.com [A CONFIRMAR: assina em nome próprio ou por uma empresa, e qual?] |
| Data | ____ / ____ / 2026 | ____ / ____ / 2026 |
| Assinatura | | |
