# Runbook da plataforma Alttavia

Para quem dá suporte à plataforma (hoje, Guilherme, guyshore.com). Estado em 30/09/2026: a plataforma está no staging e no ramo de produção; a publicação em produção é o último passo (secção 0). Serve de modelo para o próximo cliente: nomes, endereços e contas são os da Alttavia, como exemplo preenchido. **[A CONFIRMAR: ...]** marca o que só o dono ou a firma podem responder.

Decisões de 30/09/2026 que este runbook segue: sem segundo fator no lançamento (`ADMIN_REQUIRE_MFA` fica por definir); staging permanente; os dados de teste e de demonstração ficam na base; o monitor externo, o Livro de Reclamações e a revisão dos textos legais vêm depois do lançamento.

## 0. Antes de começar

| | |
|---|---|
| Produção | https://bank-nif-portugal.alttavia-relocation.com, Netlify `bank-and-nif-in-portugal`, ramo `main-split-bank-and-nif`, publicação automática travada. Publicado a 30/09: `571eb64`, a página de vendas antes da plataforma |
| Staging | https://staging--bank-and-nif-in-portugal.netlify.app, ramo `staging`, Stripe em modo de teste |
| Dados | Supabase `dgdbrnvgrpixsslgvmns` (plano sem mensalidade, **uma só base para produção e staging**, migrações até `0019_ops_alerts.sql`); R2 `alttavia-documents`; Resend `send.alttavia-relocation.com`; Stripe da firma |

- `npm run ...` corre na raiz de `landing-page-alttavia` e lê `.env.local`. Só `admin:create` sem `--support` imprime um segredo: corra-o no seu terminal, nunca através de um agente.
- SQL: SQL Editor do projeto Supabase, como `postgres`, sem RLS. Confira cada id duas vezes; na dúvida, `npm run db:dump` antes.
- O id de um pedido está em `/admin/orders?order=<id>`; o de um cliente em `/admin/users?user=<id>`.
- Registos: no painel da Netlify, projeto `bank-and-nif-in-portugal`, a lista de funções (Functions), função do servidor `___netlify-server-handler`. No plano atual guardam-se só cerca de 24 horas: procure logo. Cada ação de admin deixa `[admin] <id do admin> <ação> <alvo>`.

### Publicação em produção (último passo)

Estado a 30/09/2026: o ramo `main-split-bank-and-nif` tem o código da plataforma desde 28/09 (`e635507`). A base está completa: 0013 a 0017 aplicadas a 25/09, 0018 e 0019 a 28/09, cada uma com a sua linha em `schema_migrations`. A Supabase Auth também (`auth:config` aplicado a 25/09: senha de 12 caracteres, `site_url` de produção, staging na lista de endereços de retorno). A build de produção de `e635507` falhou só porque o contexto Production da Netlify ainda não tinha variáveis; o deploy publicado continua a ser `571eb64`. Por esta ordem:

1. **Stripe da firma, em modo real.**
   - Workbench, Webhooks, novo destino para `https://bank-nif-portugal.alttavia-relocation.com/api/stripe/webhook`, com os eventos `checkout.session.completed` e `checkout.session.async_payment_succeeded`. O segredo `whsec_` vai para `STRIPE_WEBHOOK_SECRET`.
   - Chave restrita `rk_live_` com Checkout Sessions em escrita e Prices em leitura, para `STRIPE_SECRET_KEY`.
   - O id de preço em modo real (`price_...`) de cada um dos quatro serviços, em `/admin/services`, campo **Stripe price id (live)**. A base é partilhada, por isso tanto faz gravá-lo no staging ou na produção. Sem ele, o botão Pay desse serviço usa o link de pagamento em modo real (secção 10), e só o webhook marca o pedido como pago.
   - De onde vêm os ids: a chave restrita acima não cria produtos. Copie-os do painel do Stripe, em modo real, do produto que cada um dos quatro links de pagamento vende (preço em EUR, com o valor da página). Em alternativa, ponha em `.env.local`, por uns minutos, uma chave em modo real que possa escrever Products, Prices e Payment Links, corra `npm run stripe:setup -- --live` (reaproveita os produtos marcados `alttavia_product` e imprime os ids), reponha a chave de teste e apague a temporária no Stripe. Um id errado não cobra: o checkout recusa um preço com outro valor ou moeda (409).
   - O nome público da conta, hoje "Consulting", é da firma (critério 3.4).
2. **Variáveis na Netlify.** Preencha em `C:\Users\guilh\alttavia-production.env` (fora do código) a chave restrita, o segredo do webhook e um token novo do R2, e importe o arquivo só no contexto **Production**, com os âmbitos que incluem **Builds** (sem eles a build volta a falhar ao pré-gerar `/admin/feedback`). `ADMIN_REQUIRE_MFA` fica por definir. `ALERTS_TO` também: os alertas vão para `FEEDBACK_TO` (secção 14).
3. **Build.** Netlify, Deploys, um deploy novo do ramo `main-split-bank-and-nif` (ou **Retry** no deploy falhado de `e635507`, se o ramo não mudou). Com a publicação travada, a build fica pronta sem substituir o que está no ar.
4. **Conferir no endereço do próprio deploy** (`https://<id do deploy>--bank-and-nif-in-portugal.netlify.app`): `/api/health` dá 200; abrem `/en`, `/en/apply`, `/en/login` e `/admin/login`.
5. **Cópia:** `npm run db:dump -- --with-files` (secção 7).
6. **Publish deploy**, à mão, nesse deploy.
7. **Compra real.** Um **NIF only** de €149 com um cartão real, no endereço de produção. Depois, devolva o pagamento no Stripe da firma.
   - Antes dela, se a Patrícia já enviou a imagem da assinatura: `npm run firm:signature -- <signature.png>` (secção 5). A 30/09, `firm/signature.png` não está no R2. Sem ela, o contrato da compra real sai com a linha da firma em branco; quando a imagem chegar, esse contrato recebe-a com **Regenerate and resend**.

**Verificar:**

- `https://bank-nif-portugal.alttavia-relocation.com/api/health` dá 200 (antes da publicação dá 404: a versão `571eb64` não tem essa rota);
- **Pay** abre o Stripe em modo real, com o valor do pedido;
- na compra real: o evento aparece com 200 no separador **Event deliveries** do endpoint; o pedido fica pago, em **Documents**; chegam "Payment received" ao comprador e "New paid order" ao info@alttavia-relocation.com; o contrato não traz a linha "Specimen" e traz a assinatura da firma se `firm/signature.png` estiver no R2 (secção 5; a 30/09 não estava);
- depois da devolução, o pedido continua pago no painel e conta no **Overview**. A conta do comprador já não se apaga pelo painel (secção 6).

Se algo falhar depois do Publish: secção 10.

## 1. Repor a senha de um admin

**Sintomas:** a Patrícia não entra em `/admin/login`. Primeiro, ela usa **Forgot your password?** (código de 6 dígitos em info@alttavia-relocation.com). Se falhar, no seu terminal:

```
npm run admin:create -- info@alttavia-relocation.com --reset-password
```

Gera 20 caracteres, confirma o papel admin e imprime a senha uma vez. Entregue-a por telefone, nunca por e-mail; ela troca-a em `/admin/settings`, **Change password**. Se a conta tiver segundo fator, ele mantém-se (secção 2).

- `--promote` só serve para uma conta que existe como cliente; sem ele o script recusa, para que um erro no e-mail nunca promova um cliente.
- Admin de suporte (`business+admin@guyshore.com`): `npm run admin:create -- --support`. Senha nova escrita em `.env.local` (`ADMIN_SUPPORT_EMAIL`, `ADMIN_SUPPORT_PASSWORD`), nunca impressa, nunca na Netlify. Esta é a única conta com segundo fator: regista-se com `npm run admin:totp` (segredo em `ADMIN_SUPPORT_TOTP_SECRET`, `.env.local`); se deixar de bater certo, `node scripts/admin-totp.mjs --unenrol` e de novo sem opções. Registar um fator termina as outras sessões da conta.

**Verificar:** o script imprime o papel lido de volta; ela entra com a senha nova.

## 2. Segundo fator (opcional)

No lançamento, a conta da firma não usa segundo fator: a Patrícia entra com e-mail e senha, e `ADMIN_REQUIRE_MFA` fica por definir na Netlify (decisão de 30/09/2026). O cartão **Second factor**, em `/admin/settings`, continua disponível e funciona; ninguém é obrigado a usá-lo. Sem fator, quem ler a caixa de um admin consegue trocar a senha em **Forgot your password?**.

Para confirmar que a conta da firma continua sem fator (por exemplo, antes da publicação): `node scripts/admin-totp.mjs --unenrol --email info@alttavia-relocation.com`, sem `--apply`, só lista. A resposta "No authenticator app factor on this account." confirma a entrada só com senha.

Regra do código (`src/lib/supabase/admin-user.ts` e `0015_admin_mfa.sql`): uma conta com um fator verificado precisa sempre do código; sem fator, basta a senha. `ADMIN_REQUIRE_MFA=1` obrigaria todas as contas admin a ter fator: só se a firma o pedir, depois de cada conta registar o seu.

**Telemóvel perdido**, numa conta que ligou o fator. Sintomas: senha certa, a página passa a **One more step** e pede o código do app (ou, ao reabrir `/admin/login`, mostra "Sign in with your password and your code."), e o app já não existe.

1. Confirme a identidade da pessoa por telefone: quem lê a caixa da firma não pode conseguir tirar o fator.
2. Retire o fator com o script (API de administração do Auth, chave secreta, sem código; recusa contas de cliente):
   ```
   node scripts/admin-totp.mjs --unenrol --email info@alttavia-relocation.com           # lista os fatores
   node scripts/admin-totp.mjs --unenrol --email info@alttavia-relocation.com --apply   # e remove-os
   ```
   A Supabase termina as sessões dessa conta em todo o lado. Só se o script falhar, no SQL Editor (não ensaiado): `delete from auth.mfa_factors where user_id = (select id from auth.users where email = 'info@alttavia-relocation.com');`
3. A pessoa entra com a senha e, se quiser, regista o telemóvel novo em `/admin/settings`, **Second factor**.

**Verificar:** a listagem do passo 2 fica vazia; a entrada seguinte pede só a senha.

## 3. Marcar um pedido como pago à mão

**Sintomas:** pagamento por transferência ou antes da plataforma; ou o Stripe cobrou e o pedido continua em **Awaiting payment** (aí, tente antes a secção 9).

**Sem pedido desse serviço:** `/admin/users`, linha do cliente, **Assign a purchase**, **Service**, marque **Already paid outside the platform**, **Assign**. O pedido nasce pago, em **Documents**, e o cliente recebe "Payment received". O histórico diz "Paid outside the platform, recorded by the admin on the live site" em produção e "... on the test site" em staging; só a primeira conta como dinheiro real (secção 5). Os registos anteriores a esta regra (25/09/2026) dizem "Paid outside the platform, recorded by the admin" e contam como teste.

**Com um pedido por pagar desse serviço:** **Assign a purchase** criaria um segundo pedido, e o antigo ficaria com o botão Pay. Último recurso, SQL no pedido existente:

```sql
with antes as (
  select s.id, s.stage_key as de, st.key as para
  from public.user_services s
  join public.service_stages st on st.service_id = s.service_id and st.position = 2
  where s.id = 'ID_DO_PEDIDO' and s.paid_at is null
), pago as (
  update public.user_services s set paid_at = now(), stage_key = antes.para
  from antes where s.id = antes.id and s.paid_at is null
  returning s.id
)
insert into public.user_service_events (user_service_id, from_stage, to_stage, note)
select antes.id, antes.de, antes.para, 'Paid outside the platform, recorded by the admin on the live site'
from antes join pago on pago.id = antes.id;
```

Esta nota é a que `src/lib/orders/live-payment.ts` lê para dar ao contrato a assinatura da firma: use-a só para dinheiro que a firma recebeu.

Não envia e-mail. Também não regista a aceitação dos termos: `terms_accepted_at` e `terms_version` (0014) ficam vazios, como em todo o pedido pago fora da plataforma, porque só o botão Pay os grava. A aceitação desse cliente fica no contrato que ele assina e envia em **Signed service agreement**. Avise o cliente você mesmo.

**Verificar:** `select paid_at, stage_key from public.user_services where id = 'ID_DO_PEDIDO';` mostra a data e `documents`.

## 4. Reabrir um documento aprovado por engano

A aprovação não se desfaz pela página. SQL em `public.user_documents`:

```sql
select d.id, sd.label, d.applicant_index, d.status, d.file_name
from public.user_documents d join public.service_docs sd on sd.id = d.service_doc_id
where d.user_service_id = 'ID_DO_PEDIDO' order by d.created_at desc;

update public.user_documents
set status = 'uploaded', reviewed_at = null, reviewed_by = null, rejection_reason = null
where id = 'ID_DO_DOCUMENTO' and status = 'approved';
```

O arquivo volta a **To review** no modal, com **Approve** e **Reject** (o motivo segue por e-mail ao cliente). O cliente só envia arquivos com o pedido em **Documents**: se já avançou, use antes **Back** ou **Jump to**. **Forward** fica bloqueado até os obrigatórios estarem aprovados.

**Verificar:** o documento aparece em **Awaiting review** no `/admin`.

## 5. Contrato: regenerar, e a assinatura da firma

**Quando:** o cliente corrigiu os dados (aviso âmbar na secção), a assinatura da firma chegou depois, ou o e-mail do contrato não saiu.

Abra o pedido, **Service agreement**, **Regenerate and resend** e **Yes, regenerate and resend** (sem versão anterior: **Prepare and send** e **Yes, prepare and send**). Só aparece com o pedido pago e os dados preenchidos. A versão seguinte fica em `contracts/<id do pedido>/v<n>-<sufixo>.pdf` (o sufixo são 8 caracteres aleatórios; a chave exata está em `user_service_contracts.storage_key`), e a anterior mantém-se. "Your service agreement" segue de novo.

A plataforma não pede uma nova assinatura ao cliente: a cópia assinada da versão anterior fica no documento **Signed service agreement**. Pedir que assine a versão nova é decisão da firma. Para o pedir, recuse essa cópia com o motivo (se já estava aprovada, reabra-a antes, secção 4), com o pedido em **Documents**; o cliente recebe o motivo por e-mail e envia a nova.

**Assinatura da firma:** PNG no R2 com a chave `firm/signature.png`. Cada geração de um pedido pago com dinheiro real desenha-o sobre a linha da Second Party. Dinheiro real quer dizer uma sessão `cs_live_` do Stripe, ou um pagamento registado fora da plataforma em produção (secção 3; regra em `src/lib/orders/live-payment.ts`). Em staging, em pedidos pagos com cartão de teste e em pagamentos registados em staging, a assinatura nunca entra, e cada página traz no rodapé "Specimen from the test environment. Not a binding agreement.".

Num pedido real, se o PNG faltar, sai a linha em branco sem aviso nos registos. Se não for um PNG, ou não se conseguir ler, sai em branco e o registo diz `contracts: firm/signature.png ...`. Contratos de pedidos reais preparados antes do arquivo só o recebem se forem regenerados; os de teste nunca o recebem.

```
npm run firm:signature -- <signature.png>                 # confere e envia (PNG com menos de 2 MB)
npm run firm:signature -- <signature.png> --dry-run       # só confere
npm run contract:preview -- --filled --signature <signature.png>   # vê-la num contrato antes de enviar
```

Enviar de novo substitui o arquivo. Fundo transparente e recorte junto à tinta: o gerador escala o que recebe, margens incluídas.

**Verificar:** a secção mostra a versão nova, "Prepared" e "Emailed". Num pedido real de produção, **Download** abre o PDF com a assinatura; num pedido de teste, sem ela e com a linha "Specimen" no rodapé.

## 6. Apagar um cliente

`/admin/users`, linha do cliente, **Delete**; escreva o e-mail em **Type the email to confirm**; **Delete this client**. Recusa contas admin e a sua própria. Desde 28/09/2026 recusa também uma conta com pelo menos um pedido pago ("This client has 1 paid order. We keep their records for 10 years, so the account cannot be deleted."): o aviso de privacidade guarda o contrato e os registos de pagamento de um pedido pago durante 10 anos. Só se apaga uma conta sem pedidos pagos. Um pedido de apagamento de um cliente com pedidos pagos responde-se por escrito: os dados desses pedidos ficam pelo prazo legal.

**Vai:** pedidos, histórico, documentos, dados dos requerentes, contratos, entregas, respostas, perfil, utilizador do Auth e, no R2, `orders/<id>/`, `deliverables/<id>/`, `contracts/<id>/`. **Fica:** o Stripe da firma, os e-mails já enviados (cópias assinadas em info@ incluídas), as pastas de `db:dump`. Não há volta. Quem pagou não se apaga pelo painel (acima); a Patrícia confirma na revisão pós-lançamento se os 10 anos do aviso de privacidade são o prazo certo.

**Dados de teste e de demonstração: ficam na base** (decisão de 30/09/2026). O staging é o ambiente de testes permanente e a formação usa estas contas. Os scripts abaixo só correm a pedido escrito da firma, e `db:purge` só simula sem `--apply`:

```
npm run db:purge -- --demo      # contas @demo.alttavia.invalid
npm run db:purge -- --tests     # pedidos cs_test_, pedidos por pagar de contas de teste, essas contas
```

Repita com `--apply` depois de ler a lista. `--i-know` leva também pedidos por pagar de outras pessoas que o script retém. Admins nunca são apagados. **Nunca corra `npm run demo:history -- --reset --apply`:** apaga todas as contas de cliente, reais incluídas.

**Verificar:** nova simulação sem nada a apagar.

## 7. Cópia de segurança e reposição

Não há cópia automática: o plano sem mensalidade da Supabase não inclui nenhuma, e a Supabase recomenda exportar os dados com regularidade. Antes de qualquer SQL, purge, migração ou publicação:

```
npm run db:dump                   # tabelas e utilizadores do Auth
npm run db:dump -- --with-files   # e os arquivos do R2
```

Uma pasta por execução em `%USERPROFILE%\alttavia-backups\` (`ALTTAVIA_BACKUP_DIR` muda o local); tem passaportes, fica neste computador. A 30/09/2026 havia seis: 21/09 (duas), 22/09 (com arquivos), 25/09, 28/09 e 30/09.

```
npm run db:restore -- --latest            # simulação (ou -- <pasta>)
npm run db:restore -- <pasta> --apply     # insere só as linhas em falta
```

- O destino é o projeto de `.env.local`. `--apply` repõe o que foi apagado sem desfazer o resto. `--overwrite` volta atrás em tudo desde a cópia (pedidos pagos voltam a por pagar), nunca em `users.role`. `--replace-catalogue` serve um projeto novo.
- Nunca repõe utilizadores do Auth, arquivos ou `schema_migrations`; um perfil só volta se o utilizador do Auth com o mesmo id existir. Projeto novo: `npm run db:migrate` antes, e os scripts têm `PROJECT_REF` fixo.

**Verificar:** nova simulação sem nada a inserir. Perder hoje o projeto Supabase é perder as contas dos clientes. A proteção real é o plano Pro, desde 25 USD por mês, com uma cópia diária guardada 7 dias (preços públicos conferidos a 30/09/2026).

## 8. Trocar chaves

Uma variável mudada na Netlify só vale depois de um deploy novo. Produção: Trigger deploy e depois Publish deploy (publicação travada). Staging: novo deploy do ramo `staging`. Contextos: **Production** (valores de `C:\Users\guilh\alttavia-production.env`: Stripe em modo real, `NEXT_PUBLIC_SITE_URL` de produção, avisos à equipa e respostas dos clientes para info@alttavia-relocation.com, notas de Feedback e alertas para business@guyshore.com) e **Branch deploys** (staging: Stripe de teste, `NEXT_PUBLIC_SITE_URL` do staging, avisos, notas e alertas para business@guyshore.com); `.env.local` para os scripts e o servidor local.

| Chave | Onde nasce | Variável e onde vai |
|---|---|---|
| R2 | Cloudflare, R2, API token de objetos só para `alttavia-documents` | `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`: os dois contextos e `.env.local` |
| Stripe | Stripe da firma, live: roll da chave restrita (Checkout Sessions escrita, Prices leitura) | `STRIPE_SECRET_KEY` (`rk_live_`): só Production |
| Webhook | Stripe, Workbench, Webhooks, endpoint de produção, **Roll secret** | `STRIPE_WEBHOOK_SECRET`: Production; staging tem o seu |
| Resend | resend.com, API key só de envio | `EMAIL_API_KEY`: os dois contextos. A Supabase envia os códigos de acesso pelo SMTP da Resend, com a chave guardada em Authentication, SMTP Settings (a chave `alttavia-supabase-auth` foi criada para isso). Se o site usar a mesma, troque-a nos dois lugares |
| Supabase | Project Settings, API Keys, nova secret key | `SUPABASE_SECRET_KEY`: os dois contextos e `.env.local` |
| Token pessoal | Supabase, Account, Access Tokens | `SUPABASE_ACCESS_TOKEN`: só `.env.local`. **Expira a 11/10/2026** |
| `UPLOAD_TOKEN_SECRET` | nenhum | O código não a lê: nada a trocar |

Apague a chave antiga só depois de verificar quatro coisas:

- `/api/health` dá 200 nos dois ambientes;
- em staging, um documento abre com **View** no admin;
- Pay abre o Stripe;
- o e-mail seguinte aparece entregue na Resend.

## 9. Reprocessar um webhook do Stripe

`POST /api/stripe/webhook`, eventos `checkout.session.completed` e `checkout.session.async_payment_succeeded`.

| Código | Quando |
|---|---|
| 503 | Falta `STRIPE_WEBHOOK_SECRET`. Chega um alerta por e-mail (secção 14). |
| 400 | Assinatura inválida (chega um alerta) ou ausente (só no registo). |
| 500 | Erro da base; o Stripe repete sozinho. Chega um alerta com o id do pedido e **Open the order**. |
| 200 sem mudar nada | Outro modo, outro evento, sessão não paga, sem `client_reference_id`, pedido inexistente ou já pago. |
| 200 e aviso à equipa | Valor ou moeda diferentes: "Paid amount does not match the order". |

Uma segunda sessão paga no mesmo pedido fica no registo como `second payment on a paid order`: esse dinheiro devolve-se à mão no Stripe.

Corrija a causa (variável, deploy, base em pausa). Depois, no Stripe da firma, em modo real: Workbench, **Webhooks**, o endpoint de produção, separador **Event deliveries**, o evento e **Resend**. O Stripe repete sozinho um evento falhado durante até 3 dias em modo real (em teste, três vezes em poucas horas). O **Resend** do painel funciona até 15 dias depois do evento; a Stripe CLI (`stripe events resend <id do evento> --webhook-endpoint=<id do endpoint>`), até 30.

**Verificar:** o evento fica com 200 e o pedido aparece pago em **Documents**.

## 10. Voltar a um deploy anterior

Netlify, Deploys, o último deploy bom, Publish deploy. É imediato e fica até alguém publicar outro. A base não volta atrás: um deploy anterior corre contra a base de hoje. Último recurso: `571eb64`, a página de vendas antes da plataforma. Vende pelos quatro links de pagamento do Stripe em modo real (os mesmos que o código novo usa quando um serviço não tem preço em modo real), por isso só serve enquanto esses links estiverem ativos. Esses pagamentos não criam pedidos na plataforma.

**Verificar:** `/api/health` dá 200 (na `571eb64`, 404); abrem a landing, `/en/login` e `/admin/login`.

## 11. Supabase em pausa

**Sintomas:** `/api/health` dá 503 `{"ok":false,"db":"down"}`; a landing abre, mas login, área do cliente e admin falham ou mostram "Something did not load.". O plano sem mensalidade pausa após 7 dias sem atividade.

**Acordar:** painel Supabase, o projeto, Restore project; alguns minutos. **Verificar:** `/api/health` volta a 200.

Não há monitor externo até depois do lançamento (secção 14): só o uso real do site lê a base, e uma semana sem clientes nem admin pode pausá-la. Com a base em pausa, as páginas que a leem falham e podem trazer alertas `Server error` (secção 14); na dúvida, abra `/api/health`. A garantia é o plano Pro (cerca de 25 USD por mês, com cópias diárias): decisão da firma.

## 12. Um e-mail não chegou

**Código de acesso** (clientes; recuperação de senha do admin): sai da Supabase Auth pelo SMTP da Resend e vale 10 minutos. Veja os logs de Auth na Supabase, o limite de envios em Authentication, Rate Limits, e a lista de e-mails na Resend.

**E-mails da plataforma e da equipa**: procure nos registos da Netlify.

- `reserved .invalid address skipped`: conta de demonstração; o admin mostra como enviado.
- `EMAIL_API_KEY or EMAIL_FROM not set`: variável em falta nesse contexto.
- `Resend answered <código>`: 429 costuma ser a quota do plano sem mensalidade (100 por dia).
- `EMAIL_TEAM_INBOX not set`: os avisos à equipa não têm destino nesse contexto. Valores: info@alttavia-relocation.com em Production, business@guyshore.com em Branch deploys (staging).
- `ops alert: ALERTS_TO and FEEDBACK_TO are not set`: os alertas da secção 14 não têm destino nesse contexto; defina `FEEDBACK_TO` (ou `ALERTS_TO`) e faça um deploy novo.
- `ops alert: ... held`: alerta retido pelo limite da secção 14; conta no e-mail seguinte do mesmo alerta.
- `ops alert: throttle table unavailable`: a tabela `ops_alerts` não se lê (base em pausa). Os erros do servidor e os pagamentos por registar saem na mesma, com o limite contado em cada instância (`this instance decides alone`); as duas recusas do webhook que qualquer pessoa pode provocar (assinatura, segredo em falta) ficam só no registo (`this alert is logged only`).
- `the stripe-signature header is not Stripe's, or its time is stale; no alert`: um pedido ao webhook com um cabeçalho que não tem o formato do Stripe ou com a hora fora dos 5 minutos. Quase sempre alguém de fora; não gera e-mail.
- Respostas dos clientes: vão para `EMAIL_REPLY_TO`, info@alttavia-relocation.com em Production; sem ela, para o remetente, `EMAIL_FROM` (hello@send.alttavia-relocation.com).

Depois, na Resend: entregue, devolvido ou spam? O contrato reenvia-se com **Regenerate and resend**; "Payment received" e rejeições não se reenviam, escreva ao cliente. Em staging, os links dos e-mails apontam para o staging (`NEXT_PUBLIC_SITE_URL` do contexto Branch deploys); sem essa variável, apontariam para a produção.

## 13. Staging

Ambiente de testes permanente (decisão de 30/09/2026). Atualizar com `git push origin main-split-bank-and-nif:staging`. Stripe de teste (cartão 4242 4242 4242 4242), com webhook e segredo próprios. A base é a de produção. Cada pedido de staging é real, e editar um serviço em `/admin/services` edita-o em produção. As contas admin são as mesmas e os e-mails saem de verdade (teste com business@guyshore.com). Os dados de teste e de demonstração ficam na base: não os limpe sem pedido escrito da firma (secção 6).

## 14. Saúde, alertas e o que vigiar

`GET /api/health`, público, sem cache: 200 `{"ok":true,"db":"ok","at":"..."}`; 503 `{"ok":false,"db":"down"}` se a leitura de `services` falhar ou passar de 5 segundos.

**Monitor externo: adiado para depois do lançamento.** Nenhum plano serve hoje (decisão de 28/09/2026), por isso nada chama `/api/health` de forma regular. Abra-o à mão quando algo parecer parado, depois de cada publicação e antes de apagar uma chave antiga (secções 8 e 10). Quando o monitor voltar: a cada 5 minutos em `https://bank-nif-portugal.alttavia-relocation.com/api/health`, com alerta para o seu e-mail. Até lá, os alertas abaixo são a vigia.

**Alertas por e-mail** (desde 28/09/2026; código em `src/lib/ops/`):

- **O quê.** Erros do servidor numa página, numa rota da API ou no proxy: assunto `Server error: <tipo> <rota>`, com o método, o caminho sem a parte depois de `?`, o erro, o `Digest` e as primeiras linhas do stack. E o webhook do Stripe recusado ou falhado (secção 9): `Stripe webhook refused: STRIPE_WEBHOOK_SECRET is not set` (503), `Stripe webhook refused: the signature did not verify` (400) e `Stripe webhook: a payment could not be recorded` (500).
- **Base.** A migração `0019_ops_alerts.sql` foi aplicada a 28/09, antes de este código chegar a qualquer deploy. Sem ela, cada instância do servidor contaria os alertas sozinha, e as recusas do webhook não gerariam e-mail nenhum.
- **Para onde.** `ALERTS_TO`; sem ela, `FEEDBACK_TO`. `ALERTS_TO` fica por definir nos dois contextos, e `FEEDBACK_TO` é business@guyshore.com: no staging, o alerta `[staging]` de 28/09 chegou a essa caixa; na produção, entra com as variáveis de produção (secção 0).
- **De onde.** Do contexto da Netlify, que o `next.config.ts` copia para o código no momento da build (`NETLIFY_BUILD_CONTEXT`): `[production]` no deploy de produção, `[staging]` no branch deploy. Não há variável a definir. `OPS_ENVIRONMENT` só serve para forçar outro valor e fica sem definir. Depois da primeira publicação, uma chamada ao webhook com um segredo errado e um cabeçalho no formato do Stripe deve trazer um e-mail `[production]`; `[local]` quer dizer que a build não viu o contexto.
- **Quando.** Só uma build de produção envia, e staging também é uma: o assunto começa por `[production]` ou `[staging]`. Em `npm run dev` fica uma linha no registo.
- **Quantos.** No máximo um e-mail por alerta (a mesma rota, a mesma falha do webhook, o mesmo pedido que não ficou pago) a cada 30 minutos, 20 por hora e 30 por dia no total, contados à parte em produção e em staging. As duas recusas do webhook que qualquer pessoa pode provocar (assinatura, segredo em falta) repetem-se no máximo a cada 6 horas. O limite por dia deixa folga à quota diária da Resend, que os códigos de acesso e os e-mails dos clientes partilham. Os repetidos não se perdem: o e-mail seguinte do mesmo alerta diz `N more since the last email.` Se a Resend recusar um alerta, ele volta a tentar 5 minutos depois.
- **O que não leva.** Endereços de e-mail (passam a `[email]`), o que vem depois de `?` nos caminhos, tokens e chaves, nomes e dados de passaporte.

**Quando chega um alerta:**

1. Veja o prefixo. `[staging]` só afeta testes: trate no horário normal. `[production]`: siga os passos abaixo já.
2. `Server error`: abra a rota indicada (com a conta de suporte, se for do painel) e `/api/health`. 503 é a base (secção 11). Procure o `Digest` nos registos da Netlify; é o mesmo que a página de erro mostra ao cliente como "Reference". Se a rota falha para todos logo depois de uma publicação, volte ao deploy anterior (secção 10) e corrija no staging.
3. `STRIPE_WEBHOOK_SECRET is not set`: a variável falta nesse contexto. Defina-a na Netlify, faça um deploy novo (secção 8) e reenvie os eventos falhados (secção 9).
4. `the signature did not verify`: veja **Claimed event**. Se for um id `evt_...` que existe no Stripe da firma, com falhas, o segredo não bate com o endpoint (chave trocada, ou de outro modo): acerte `STRIPE_WEBHOOK_SECRET`, deploy, reenvie (secções 8 e 9). Com `Not readable`, ou um evento que o Stripe não conhece, é um pedido de fora: nada a fazer se não se repetir. Este alerta repete-se no máximo a cada 6 horas: depois de mudar o segredo, confirme no painel do Stripe que os eventos seguintes passam, em vez de esperar o e-mail seguinte.
5. `a payment could not be recorded`: o Stripe cobrou e o pedido não ficou pago. Cada pedido tem o seu e-mail. **Open the order** e `/api/health`. O Stripe repete o evento sozinho; se o pedido continuar em **Awaiting payment**, secção 9 e, em último caso, secção 3.
6. Vários alertas seguidos: o limite segura o volume. Veja primeiro o que mudou (publicação, variável, base) e responda à causa, não a cada e-mail.

Sem alerta não quer dizer que está tudo bem: o que o código trata sem erro (um e-mail que não saiu, um contrato por preparar) só fica nos registos da Netlify.

- Stripe: falhas do webhook. Resend: devoluções e quota. Supabase: avisos de pausa e uso.
- Registos da Netlify: `second payment on a paid order`, `markOrderPaid`, `Resend answered`, `EMAIL_TEAM_INBOX not set`, `firm/signature.png`, linhas `[admin]`.
- O token pessoal da Supabase expira a 11/10/2026.
