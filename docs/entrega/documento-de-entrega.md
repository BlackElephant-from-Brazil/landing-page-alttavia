<!--
Modelo de documento de entrega da guyshore.com. Os campos entre parênteses retos mudam de cliente para cliente;
os valores da Alttavia aparecem como exemplo preenchido. Cada [A CONFIRMAR] é resolvido antes de enviar.
Para outro cliente: o valor da passagem das contas (secção 3), o valor mensal do suporte e o preço das
funcionalidades novas (secção 8) levam [VALOR]; para a Alttavia, tudo sem custo, por decisão da guyshore.com.
Palavras do pacote: arquivo, senha, e-mail (as do guia); "o Stripe", no masculino.
Caminhos no repositório, só para o desenvolvedor: proposta de aviso de privacidade = docs/legal/privacy-proposal.md;
mudanças aos termos = docs/legal/service-terms-changes.md; fatos legais = docs/legal/fatos-para-patricia.md;
acordo de subcontratação = docs/entrega/acordo-de-subcontratacao-rascunho.md; guia = docs/guia/Guia-Alttavia.pdf.
-->

# Documento de entrega: plataforma de clientes Alttavia

**Cliente:** ALTTAVIA RELOCATION, Unipessoal Lda., aos cuidados de Patrícia Viana.
**Desenvolvimento e suporte:** guyshore.com, Guilherme Kodenvis.
**Entrega:** sexta, 25 de setembro de 2026. **Versão publicada:** [A CONFIRMAR: o código da versão publicada hoje].

[A CONFIRMAR antes de enviar: a publicação de hoje foi feita e o que está marcado "novo" está no ar (runbook, secção 0). Por volta das 14:15, a entrada do painel ainda não abria em produção. O guia só segue com todas as imagens tiradas (runbook, secção 0, passo 5).]

## 1. O que é entregue

Uma plataforma para vender e prestar os serviços de NIF e de conta bancária em Portugal a quem vive fora, do primeiro clique à entrega final.

- **Página de vendas** com os quatro serviços: **NIF only** €149, **Bank Account only** €399, **NIF + Bank Account** €497, **Couple package** €597.
- **Formulário de candidatura.** Uma pergunta por ecrã, recomenda o serviço e cria a conta do cliente com um código de 6 dígitos enviado por e-mail. O que a plataforma não vende (morada em Portugal, 3 ou mais adultos, contas separadas) segue para o WhatsApp com a mensagem já escrita.
- **Área do cliente** (**Dashboard**, **Services**, **My purchases**). O cliente paga pelo Stripe, confirma os dados, abre o contrato e envia os documentos. Vê o motivo de cada recusa e recebe as entregas e o relatório final.
- **Painel da firma:** **Overview**, **Orders** (quadro por etapas e tabela), **Users**, **Services**, **Feedback** e **Settings**, com a senha e, novo, o **Second factor**.
- **E-mails automáticos**, de hello@send.alttavia-relocation.com:
  - ao cliente: o código de entrada, **Payment received for your** [serviço] **order**, **Your service agreement** com o PDF, **A new file is needed:** [documento] com o motivo e **Your** [serviço] **order is complete**;
  - à equipa, em info@alttavia-relocation.com [A CONFIRMAR]: **New paid order**, **Documents ready to review** e **Paid amount does not match the order**;
  - novo, à equipa: **Signed service agreement received**, com a cópia assinada em anexo, na primeira cópia e depois de cada recusa sua.
- **Procurações** de NIF e de conta bancária, com o texto dos seus modelos e os dados do cliente. O cliente assina à mão, como no passaporte, e envia a cópia; a firma aprova ou recusa com motivo. Novo: no **Couple package**, uma só procuração bancária com as duas pessoas.
- **Contrato de serviço**, gerado depois do pagamento a partir dos seus modelos e do Anexo I, com IVA incluído e a sede na Av. António Augusto Aguiar, 24. Abre numa aba nova, segue por e-mail e fica no pedido. Novo hoje:
  - papel timbrado (a sua assinatura digitalizada entra quando a enviar, secção 7);
  - um contrato para as duas pessoas do **Couple package**;
  - o cliente assina-o à mão e envia-o no documento **Signed service agreement**, revisto como qualquer outro;
  - antes de pagar, o cliente lê sob o botão **By paying you accept the service terms and your service agreement.** O pedido regista a data e a versão dos termos em vigor. Se isto basta como aceitação é a decisão 1, item 14 (secção 6).
- **Staging**, a cópia do site para testes, que fica no ar de forma permanente (secção 2).
- **Documentação:** o guia de uso com imagens dos ecrãs, Guia-Alttavia.pdf. Também a gravação e o roteiro da sessão 1 (22/09), e a lista de testes de ponta a ponta.

## 2. Endereços e acessos

| Ambiente | Endereço base |
|---|---|
| Produção | https://bank-nif-portugal.alttavia-relocation.com |
| Staging (testes) | https://staging--bank-and-nif-in-portugal.netlify.app |

Caminhos iguais nos dois: vendas `/en`, formulário `/en/apply`, entrada do cliente `/en/login`, área do cliente `/en/dashboard`, termos `/en/service-terms`, painel `/admin/login`. O seu painel: **https://bank-nif-portugal.alttavia-relocation.com/admin/login**.

**Painel.** Duas contas têm acesso: a sua, info@alttavia-relocation.com, e a de suporte do desenvolvedor, business+admin@guyshore.com. Entra-se com a senha e, a partir de hoje, com o código do app autenticador. A sua senha é a que você definiu em 22/09 por **Forgot your password?**; o app fica registado na chamada das 18:00. Um código por e-mail nunca abre o painel. Telemóvel perdido: o suporte confirma a sua identidade por telefone e retira o fator. Você entra com a senha e regista o telemóvel novo em **Settings**.

**Staging.** Usa a mesma base de dados, as mesmas contas de acesso e os mesmos arquivos da produção. Só o Stripe está em modo de teste (cartão 4242 4242 4242 4242). Por isso, uma ação no staging sobre um pedido real muda o pedido real e envia os e-mails reais ao cliente. Os 56 clientes de demonstração (@demo.alttavia.invalid) e os pedidos de teste aparecem também no painel de produção. Entram nos números do **Overview**, não recebem nenhum e-mail e saem quando a firma pedir. Os avisos à equipa enviados pelo staging vão para a caixa de testes do desenvolvedor [A CONFIRMAR].

## 3. Contas e donos hoje

Nesta secção, "senhas técnicas" são as chaves que ligam o site a cada serviço. Não são senhas de pessoas.

| Serviço | Para quê | Onde está hoje | Para passar à firma |
|---|---|---|---|
| Supabase | Base de dados e entrada por código | Projeto em Londres, na organização guyshore.com | A firma cria uma organização e o desenvolvedor transfere o projeto. O endereço, as senhas técnicas e os dados ficam iguais [A CONFIRMAR no dia] |
| Cloudflare R2 | Arquivos dos clientes | Espaço `alttavia-documents`, na UE, na conta Cloudflare do desenvolvedor | Este espaço não muda de conta. Cria-se um novo, na UE, na conta da firma, e copiam-se os arquivos. O site recebe senhas técnicas novas |
| Netlify | Alojamento e publicação | Projeto `bank-and-nif-in-portugal`, na equipa do desenvolvedor | Transferência do projeto para uma equipa da firma, e nova ligação ao código [A CONFIRMAR] |
| Resend | Envio dos e-mails (send.alttavia-relocation.com) | [A CONFIRMAR: em nome de quem] | Conta da firma e nova confirmação na configuração do domínio. Senha técnica nova no site e na Supabase |
| Stripe | Pagamentos | Conta da firma; o desenvolvedor com acesso de programador [A CONFIRMAR] | Nada a transferir; a firma retira o acesso do desenvolvedor quando quiser |
| GitHub | Código e histórico | O código, `landing-page-alttavia`, na organização BlackElephant-from-Brazil, do desenvolvedor. Hoje é **público** [A CONFIRMAR: passar a privado antes de enviar] | Transferência do código para uma conta da firma e nova ligação à Netlify |

O domínio alttavia-relocation.com e a sua configuração: [A CONFIRMAR: em nome de quem estão e quem os controla].

Passar para a firma as contas que estão em nome do desenvolvedor (Supabase, Cloudflare, Netlify, GitHub e, se for dele, a Resend) leva cerca de 3,5 horas [A CONFIRMAR]. Para a Alttavia, sem custo. Para o suporte continuar, o desenvolvedor ficaria como membro de cada conta [A CONFIRMAR, decisão 6].

## 4. Custos mensais

Preços públicos conferidos a 25/09/2026, em dólares americanos. Podem mudar.

| Serviço | Hoje | Limite que importa | Opção paga |
|---|---|---|---|
| Supabase | sem mensalidade | 500 MB de base de dados, 5 GB de tráfego e 50 000 utilizadores ativos por mês. Pausa após 7 dias sem uso. Sem cópia automática | Pro, desde 25 USD por mês: não pausa e faz uma cópia diária, guardada 7 dias |
| Resend | sem mensalidade | 3 000 e-mails por mês e 100 por dia | Pro, 20 USD por mês: 50 000 e-mails por mês, sem limite diário |
| Netlify | sem mensalidade | 300 créditos por mês. Cada publicação em produção gasta 15, e cada GB de tráfego gasta 20 | Personal, 9 USD por mês, ou Pro, 20 USD por mês |
| Cloudflare R2 | sem mensalidade | Até 10 GB de arquivos guardados | 0,015 USD por GB e por mês acima disso |
| Stripe | sem mensalidade | Uma taxa por cada pagamento, no painel Stripe da firma | Não se aplica |
| GitHub | sem mensalidade | Não se aplica | Não se aplica |

Hoje: 0 USD por mês, fora as taxas do Stripe e o domínio. Com Supabase Pro e Resend Pro: cerca de 45 USD por mês. O que os dois planos pagos evitam:

- Supabase: com 7 dias sem uso, o projeto pausa, e o site deixa de criar contas e pedidos até ser reativado.
- Resend: depois do 100.º e-mail de um dia, os e-mails param até ao dia seguinte, códigos de entrada incluídos.

## 5. Cópias de segurança

- **Hoje:** cópia manual, feita pelo desenvolvedor, de todas as tabelas e das contas de acesso e, quando pedido, dos arquivos. Fica no computador dele, fora do código, e não vai para outro lugar. Últimas: 21/09 (duas, sem arquivos) e 22/09 (com arquivos) [A CONFIRMAR: cópia de hoje antes da publicação].
- **Não há cópia automática.** A Supabase Pro acrescenta uma diária da base de dados; os arquivos continuam na cópia manual.
- **Como pedir:** pelo suporte (secção 8) ou pelo botão **Feedback**, com "Pedido de cópia de segurança". A resposta traz a data e a hora da cópia. Recomendado: antes de cada atualização e [A CONFIRMAR: uma vez por semana].
- **Repor uma cópia** repõe os registos que faltam e nunca apaga nenhum. As contas de acesso e os arquivos repõem-se à mão.

## 6. Decisões em aberto

1. **Textos legais.** Aprovar a proposta de aviso de privacidade e as mudanças aos termos. Por decisão de 25/09, o site vai ao ar com a página de termos atual, e o link **Privacy** do rodapé leva à política do site principal. Das 19 decisões no fim do documento de fatos legais ("Textos legais da plataforma: fatos para a sua revisão"), continuam abertas, entre outras:
   - responsável pelo tratamento e quem vende (1);
   - prazos de conservação (5);
   - transferências para fora da UE (8);
   - parceiro e filhos (11);
   - Livro de Reclamações e resolução de litígios (13);
   - qual texto governa e quando o cliente o vê, incluindo a aceitação sob o botão Pay e a Parte A do Anexo I (14);
   - entrega por e-mail e cartões do banco (17);
   - promessas da página de termos (19).
2. **Texto do Couple package.** Aprovar a redação para duas pessoas no contrato e na procuração bancária, alínea d) incluída. Nas contas conjuntas de **Bank Account only** e **NIF + Bank Account**, o contrato cobre os dois titulares? [A CONFIRMAR]
3. **Endereço de site no timbre.** Os modelos citam https://visas.vianaconsultancy.com/. Mantém ou troca pelo da plataforma?
4. **Valores fixos do contrato.** "1 (one)" banco, "12 (twelve) months" de representação fiscal e os saltos de numeração das cláusulas [A CONFIRMAR: se já respondidos].
5. **Planos pagos.** Supabase Pro e Resend Pro, e em nome de quem fica a cobrança.
6. **Contas e subcontratação.** Passar as contas para a firma, ou mantê-las e assinar o acordo de subcontratação (o rascunho vai em anexo; item 7 dos fatos).
7. **Acesso de suporte e staging.** A conta business+admin@guyshore.com continua no painel, e o staging continua na base da produção (item 9)?
8. **Cópias:** onde ficam, por quanto tempo e se levam os arquivos dos clientes (item 10).
9. **Fatura e IVA:** quem emite a fatura certificada de cada venda.
10. **Novo Banco.** Nacionalidades recusadas (lista hoje vazia) e vistos aceites (hoje D1 a D9 e familiar de cidadão da UE). E a conta para quem é de fora do EEE sem visto em andamento.

## 7. O que fica para depois

| O quê | Quando |
|---|---|
| Publicar a privacidade e as mudanças dos termos | Quando você aprovar [A CONFIRMAR: data] |
| A sua assinatura digitalizada no contrato | Quando você a enviar. Até lá, a linha de assinatura da firma sai em branco. Os contratos de pedidos reais já preparados recebem a assinatura com **Regenerate and resend**; os de teste nunca a recebem |
| Conferir o Stripe contra o painel e desativar os quatro links de pagamento antigos | Segunda, 28/09 [A CONFIRMAR] |
| Primeira atualização: o feedback que ficou para depois e as respostas do Novo Banco | Terça, 29/09, 08:00 |
| Proteção contra robôs no envio do código e na entrada do painel | Primeira semana [A CONFIRMAR: até 02/10] |
| Renovar a chave de acesso do desenvolvedor à Supabase (expira a 11/10) | Até 09/10 |
| Passar as contas para a firma e registar quem controla a configuração do domínio | Quando a firma decidir |
| Medição de visitas, com aviso de cookies | [A CONFIRMAR: data] |
| Perguntas escritas ao banco | [A CONFIRMAR: data] |
| Cancelar e devolver um pagamento pelo painel (até lá, no Stripe) | [A CONFIRMAR: data] |
| Desfazer uma revisão de documento (até lá, pelo suporte) | [A CONFIRMAR: data] |
| Procura por nome e telefone do cliente | [A CONFIRMAR: data] |
| Registo das ações do painel | [A CONFIRMAR: data] |
| Base de dados própria para o staging | [A CONFIRMAR: data] |
| Painel em português | [A CONFIRMAR: data] |
| Renovação anual de €99 como assinatura | [A CONFIRMAR: data] |

## 8. Suporte

- **Canal:** [A CONFIRMAR: e-mail de suporte]; urgências por [A CONFIRMAR: WhatsApp ou telefone]. O botão **Feedback** do painel guarda a nota em **Feedback**, com o estado **Open**, **Planned**, **Done** ou **Won't do**. Também avisa o desenvolvedor por e-mail [A CONFIRMAR: endereço que recebe as notas em produção].
- **Urgente:** site que não abre, pagamento sem pedido marcado como pago, cliente que não consegue enviar documentos, você sem acesso ao painel.
- **Prazo de resposta**, hora de Lisboa, como na proposta de suporte (secção 7). **Blocks my work**: resposta em 2 horas úteis e solução em 1 dia útil. **Should change**: 1 dia útil. **Nice to have**: 3 dias úteis [A CONFIRMAR].
- **Incluído:** correções, dúvidas de uso, cópias, reposição do segundo fator, apagar ou corrigir os dados de um cliente a pedido.
- **Funcionalidades novas:** estimativa em horas antes de começar, para você decidir e saber quando fica pronto. Para a Alttavia, sem custo (proposta de suporte, secção 9).
- **Atualizações:** passam primeiro pelo staging; a produção só muda quando o desenvolvedor publica à mão [A CONFIRMAR: regra mantida].
- **Valor mensal:** para a Alttavia, sem custo, por decisão da guyshore.com. Garantia de correções: [A CONFIRMAR: prazo].
