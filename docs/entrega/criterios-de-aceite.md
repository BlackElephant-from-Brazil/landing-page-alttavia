<!--
Caminhos no repositório, só para o desenvolvedor:
Teste completo da plataforma = docs/treinamento/testes-ponta-a-ponta.html;
aviso de privacidade e mudanças aos termos = docs/legal/privacy-proposal.md e docs/legal/service-terms-changes.md.
-->

# Critérios de aceite da entrega

Plataforma de NIF e conta bancária da Alttavia Relocation, entregue na sexta, 25 de setembro de 2026, versão [A CONFIRMAR: o código da versão publicada hoje]. Produção: https://bank-nif-portugal.alttavia-relocation.com. Teste: https://staging--bank-and-nif-in-portugal.netlify.app.

Cada linha é um teste para você fazer e marcar. **Passo N** remete ao **Teste completo da plataforma**. Sem outra indicação, teste no ambiente de teste, com o cartão `4242 4242 4242 4242`. Nas linhas **Novo hoje** vale esta folha, e não o **Teste completo da plataforma** de 22/09. Essas linhas só passam depois da publicação de hoje, com as atualizações da base de dados que ela traz (runbook, secção 0).

## 1. Site e formulário de pedido

- [ ] **1.1** Em produção, a página inicial mostra os quatro serviços a €149, €497, €399 e €597, e **Service terms** no rodapé.
- [ ] **1.2** As respostas do passo 1 terminam em **NIF only** com **Continue · €149**, e **Back** não perde respostas. *Passo 1.*
- [ ] **1.3** Uma morada em Portugal termina num botão para o WhatsApp, com a mensagem já escrita.
- [ ] **1.4** No telemóvel, os ecrãs cabem sem deslizar para o lado, e uma fotografia enviada chega a **Uploaded**. *Passo 31.*

## 2. Área do cliente

- [ ] **2.1** O cliente entra sempre com o e-mail e um código de 6 dígitos de hello@send.alttavia-relocation.com. *Passos 2 e 26.*
- [ ] **2.2** A página inicial diz **Welcome.** antes do primeiro pagamento e **Welcome back.** depois. *Passos 2 e 7.*
- [ ] **2.3** Um segundo serviço comprado em **Services** aparece em **My purchases**, com data, valor e etapa. *Passos 8 e 9.*
- [ ] **2.4** Um pedido concluído mostra **Delivered**, os arquivos entregues, o **Closing report** e o contrato. *Passo 29.*

## 3. Pagamento

- [ ] **3.1** **Pay** abre o Stripe com o valor do pedido, e a volta ao site mostra **Payment received**. *Passo 3.*
- [ ] **3.2** **Novo hoje.** Por baixo de **Pay** lê-se **By paying you accept the service terms and your service agreement.** O pedido regista a data e a versão dos termos, que a firma lê na secção **Service agreement** do pedido.
- [ ] **3.3** Em produção, uma compra real de €149 aparece paga no painel e é depois devolvida no Stripe [A CONFIRMAR: hora].
- [ ] **3.4** A página do Stripe mostra o nome da firma, e não **Consulting** [A CONFIRMAR: nome escolhido].

## 4. Documentos e procurações

- [ ] **4.1** Cada envio termina em **Uploaded** e o topo conta os recebidos, no NIF only **4 of 4 received** [A CONFIRMAR]. *Passo 5.*
- [ ] **4.2** **Download to sign** abre a procuração preenchida e datada de hoje, com **Sign exactly as you signed your passport.** *Passo 5.*
- [ ] **4.3** Na etapa **Documents**, o cliente troca ou apaga um arquivo ainda não aprovado. *Passo 6.*
- [ ] **4.4** No painel, **Reject and notify** mostra o motivo ao cliente, palavra por palavra. *Passo 14.*
- [ ] **4.5** **Forward** fica desativado até todos os documentos obrigatórios estarem aprovados. *Passos 13 e 16.*
- [ ] **4.6** **Novo hoje.** No **Couple package**, há uma só procuração do banco, com as duas pessoas. *Passo 22.*

## 5. Contrato de serviço

- [ ] **5.1** Depois de pagar, a janela dos dados abre sozinha e o contrato abre em PDF e chega por e-mail. *Passos 3 e 4.*
- [ ] **5.2** **Novo hoje.** O PDF traz o timbre, "VAT included" e a sede na Av. António Augusto Aguiar, 24. A linha de assinatura da firma sai em branco. No ambiente de teste, cada página diz no rodapé **Specimen from the test environment. Not a binding agreement.**
- [ ] **5.3** **Novo hoje.** O contrato assinado à mão é enviado em **Signed service agreement** e revisto como os outros documentos. Chega ao info@ por e-mail [A CONFIRMAR, como 7.3]. O **Forward** fica desativado em **Documents** até ele ser aprovado.
- [ ] **5.4** **Novo hoje.** O **Couple package** recebe um só contrato, com as duas pessoas. *Passo 22.*
- [ ] **5.5** **Regenerate and resend** prepara a versão seguinte e manda-a de novo ao cliente. *Passo 20.*

## 6. Painel de administração

- [ ] **6.1** O **Overview** muda os seis números e os quatro gráficos a cada período. *Passo 11.*
- [ ] **6.2** **Orders** abre no Kanban, onde um pedido não pago não se arrasta. *Passos 12 e 23.*
- [ ] **6.3** **Forward**, **Back** e **Jump to** mudam a etapa, e **History** regista cada mudança. *Passo 16.*
- [ ] **6.4** Um arquivo enviado em **Deliverables** aparece logo ao cliente, e **Remove** tira-o dos dois lados. *Passo 17.*
- [ ] **6.5** Antes de concluir, a pergunta lista em **Not sent yet:** o que falta entregar. *Passos 18 e 21.*
- [ ] **6.6** Em **Users** você cria, edita, atribui compras e apaga clientes, nunca administradores. *Passos 24 a 27.*

## 7. E-mails

- [ ] **7.1** O cliente recebe uma vez cada e-mail do passo 30, e cada botão abre a página certa. *Passo 30.*
- [ ] **7.2** Concluir de novo o mesmo pedido não repete o e-mail de conclusão. *Passo 19.*
- [ ] **7.3** Em produção, os avisos à equipa chegam ao [A CONFIRMAR: info@alttavia-relocation.com]. *Passo 15.*

## 8. Segurança

- [ ] **8.1** O painel só abre com senha, nunca com um código por e-mail. *Passo 10.*
- [ ] **8.2** **Novo hoje.** **Settings** tem **Second factor**, e cada entrada passa a pedir o código do app autenticador.
- [ ] **8.3** **Change password** exige a senha atual, e **Forgot your password?** manda um código ao info@. *Passo 28.*
- [ ] **8.4** O Guilherme mostra o teste automático de permissões: nenhum cliente vê dados de outro.

## 9. Ambientes

- [ ] **9.1** A produção corre a versão de hoje, publicada depois de uma cópia da base de dados [A CONFIRMAR].
- [ ] **9.2** O ambiente de teste fica no ar, com o Stripe em modo de teste e a base de dados da produção.
- [ ] **9.3** Os 56 clientes de demonstração não recebem e-mails e contam no **Overview** até serem removidos.
- [ ] **9.4** Contas: Supabase (guyshore.com), R2 e Netlify (desenvolvedor), Resend (domínio send.alttavia-relocation.com; titular [A CONFIRMAR]), Stripe (firma).

## Fica para depois

Nada desta lista impede o aceite.

- **Na sua aprovação:** a proposta de aviso de privacidade e as mudanças aos termos; até lá vale a página atual.
- **Quando a enviar:** a sua assinatura digitalizada no contrato. Os contratos de pedidos reais já preparados só a recebem com **Regenerate and resend**; os de teste nunca a recebem.
- **Hoje, 25/09, às 18:00:** ativação do seu segundo fator, na chamada.
- **[A CONFIRMAR]:** leitura, pela firma, do contrato e da procuração do banco do pacote casal.
- **Decisão da firma, [A CONFIRMAR]:** planos pagos. Supabase Pro custa cerca de 25 USD por mês; o plano atual pausa após 7 dias sem uso. Resend Pro custa cerca de 20 USD por mês; o plano atual manda 100 e-mails por dia.
- **[A CONFIRMAR]:** cópias de segurança automáticas; hoje são feitas à mão, no computador do desenvolvedor.
- **[A CONFIRMAR]:** medição de visitas no site, que só começa depois de o visitante aceitar os cookies no aviso.
- **[A CONFIRMAR]:** devoluções de pagamento dentro da plataforma; hoje são feitas no Stripe.
- **[A CONFIRMAR]:** perguntas por escrito ao banco sobre nacionalidades recusadas e vistos aceites.
- **[A CONFIRMAR]:** teste guiado de **Services** e **Feedback** com o Guilherme.

## Assinaturas

A assinatura confirma os critérios marcados; um critério não marcado é anotado ao lado, com a data da correção. O suporte depois da entrega não tem custo para a Alttavia, por decisão do Guilherme. *Modelo para outro cliente: aqui entram [CONDIÇÕES] e [VALOR] por mês do suporte.*

| | Pela Alttavia Relocation | Pelo desenvolvedor |
|---|---|---|
| Nome | Patrícia Viana, [A CONFIRMAR: qualidade] | Guilherme Kodenvis, guyshore.com [A CONFIRMAR: entidade] |
| Data | ____ / ____ / 2026 | ____ / ____ / 2026 |
| Assinatura | | |
