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
**Entrega:** 25 de setembro de 2026, no ambiente de teste. **Documento atualizado:** 30 de setembro de 2026.
**Versão publicada em produção:** [A CONFIRMAR: que código (commit) tem o deploy publicado, visto na Netlify em Deploys no dia da publicação?].

**Estado a 30/09/2026.** A plataforma está completa no ambiente de teste. As duas sessões de formação e a chamada final estão feitas, tal como o seu teste completo e os testes em iPhone e Android. O código está no ramo de produção desde 28/09. A publicação em produção é o último passo do desenvolvedor (secção 7). Até lá, o endereço de produção mostra a página de vendas anterior à plataforma, que vende pelos links de pagamento do Stripe.

## 1. O que é entregue

Uma plataforma para vender e prestar os serviços de NIF e de conta bancária em Portugal a quem vive fora, do primeiro clique à entrega final.

- **Página de vendas** com os quatro serviços: **NIF only** €149, **Bank Account only** €399, **NIF + Bank Account** €497, **Couple package** €597. No rodapé, a ALTTAVIA RELOCATION, Unipessoal Lda., com o NIPC e a sede, e os links **Privacy** e **Service terms**.
- **Formulário de candidatura.** Uma pergunta por ecrã, recomenda o serviço e cria a conta do cliente com um código de 6 dígitos enviado por e-mail. O que a plataforma não vende (morada em Portugal, 3 ou mais adultos, contas separadas) segue para o WhatsApp com a mensagem já escrita.
- **Área do cliente** (**Dashboard**, **Services**, **My purchases**). O cliente paga pelo Stripe, confirma os dados, abre o contrato e envia os documentos. Vê o motivo de cada recusa e recebe as entregas e o relatório final.
- **Painel da firma:** **Overview**, **Orders** (quadro por etapas e tabela), **Users**, **Services**, **Feedback** e **Settings**, com a troca de senha e o cartão opcional **Second factor**.
- **E-mails automáticos**, de hello@send.alttavia-relocation.com:
  - ao cliente: o código de entrada, **Payment received for your** [serviço] **order**, **Your service agreement** com o PDF, **A new file is needed:** [documento] com o motivo e **Your** [serviço] **order is complete**;
  - à equipa, em produção no info@alttavia-relocation.com: **New paid order**, **Documents ready to review**, **Paid amount does not match the order** e **Signed service agreement received**, este com a cópia assinada em anexo nos pedidos pagos com dinheiro real.
- **Procurações** de NIF e de conta bancária, com o texto dos seus modelos e os dados do cliente. O cliente assina à mão, como no passaporte, e envia a cópia; a firma aprova ou recusa com motivo. No **Couple package**, uma só procuração bancária com as duas pessoas.
- **Contrato de serviço**, gerado depois do pagamento a partir dos seus modelos e do Anexo I. Abre numa aba nova, segue por e-mail e fica no pedido. O cliente assina-o à mão e envia-o no documento **Signed service agreement**, revisto como qualquer outro. Antes de pagar, o cliente lê sob o botão **By paying you accept the service terms and your service agreement.**, e o pedido regista a data e a versão dos termos.
- **Aviso de privacidade** (`/en/privacy`) e **termos do serviço** (`/en/service-terms`), publicados a 28/09 para o lançamento.
- **Alertas por e-mail** ao suporte: erros do servidor e pagamentos do Stripe que o site recusou ou não conseguiu registar.
- **Staging**, a cópia do site para testes, que fica no ar de forma permanente (secção 2).
- **Documentação:** o guia de uso com imagens dos ecrãs, Guia-Alttavia.pdf; o roteiro e a gravação da sessão 1 (22/09); o **Teste completo da plataforma** (34 passos); e estes documentos: runbook, critérios de aceite, proposta de suporte e rascunho do acordo de subcontratação.

**Contratos, a 30/09/2026:**

- Cinco modelos em uso: NIF, conta bancária, NIF + conta bancária, Couple package e Anexo I. As suas respostas de 24/09 estão aplicadas desde 25/09: sede na Av. António Augusto Aguiar, 24, 1.º direito, Escritório 3, 1050-016 Lisboa; "VAT included"; "1 (one)" banco e "12 (twelve) months" de representação fiscal; numeração das cláusulas corrigida; timbre na primeira página, com o endereço de site dos modelos, https://visas.vianaconsultancy.com/ (trocá-lo pelo da plataforma é uma mudança pequena nos modelos, se um dia o quiser).
- O contrato do **Couple package** e a procuração bancária conjunta usam uma redação no plural escrita por nós, à espera da sua leitura (decisão 2). A alínea d) da procuração bancária ainda fala de um só titular.
- A assinatura digitalizada da firma entra só nos pedidos pagos com dinheiro real, e só depois de você a enviar (secção 7). A 30/09 ainda não está na plataforma. Nos pedidos de teste, cada página diz no rodapé **Specimen from the test environment. Not a binding agreement.**
- Ainda não há nenhum contrato real: a 30/09, nenhum pedido foi pago em modo real. O primeiro será o da compra de €149 depois da publicação.

## 2. Endereços e acessos

| Ambiente | Endereço base |
|---|---|
| Produção | https://bank-nif-portugal.alttavia-relocation.com |
| Staging (testes) | https://staging--bank-and-nif-in-portugal.netlify.app |

Caminhos iguais nos dois: vendas `/en`, formulário `/en/apply`, entrada do cliente `/en/login`, área do cliente `/en/dashboard`, termos `/en/service-terms`, privacidade `/en/privacy`, painel `/admin/login`. O seu painel: **https://bank-nif-portugal.alttavia-relocation.com/admin/login**. Até à publicação, use o do staging.

**Painel.** Duas contas têm acesso: a sua, info@alttavia-relocation.com, e a de suporte do desenvolvedor, business+admin@guyshore.com. Você entra com o e-mail e a sua senha. Um código por e-mail nunca abre o painel. No lançamento não há segundo fator (decisão de 30/09): o cartão **Second factor**, em **Settings**, fica disponível se um dia o quiser ligar. Sem ele, quem ler a caixa info@ consegue trocar a senha do painel em **Forgot your password?**, por isso guarde bem o acesso a essa caixa.

**Staging.** Usa a mesma base de dados, as mesmas contas de acesso e os mesmos arquivos da produção. Só o Stripe está em modo de teste (cartão 4242 4242 4242 4242), e os links dos e-mails levam ao staging. Por isso, uma ação no staging sobre um pedido real muda o pedido real e envia os e-mails reais ao cliente. As contas de demonstração (@demo.alttavia.invalid, 59 a 30/09) e os pedidos de teste aparecem também no painel de produção e entram nos números do **Overview**. Não recebem e-mails e ficam na base: por decisão de 30/09, os dados de teste e de demonstração não são apagados. Os avisos à equipa e os alertas enviados pelo staging vão para a caixa de testes do desenvolvedor, business@guyshore.com.

## 3. Contas e donos hoje

Nesta secção, "senhas técnicas" são as chaves que ligam o site a cada serviço. Não são senhas de pessoas.

| Serviço | Para quê | Onde está hoje | Para passar à firma |
|---|---|---|---|
| Supabase | Base de dados e entrada por código | Projeto em Londres, na organização guyshore.com do desenvolvedor | A firma cria uma organização e convida o desenvolvedor, que transfere o projeto. O projeto muda de organização com o mesmo endereço, as mesmas senhas técnicas e os mesmos dados |
| Cloudflare R2 | Arquivos dos clientes | Espaço `alttavia-documents`, na UE, na conta Cloudflare do desenvolvedor | Este espaço não muda de conta. Cria-se um novo, na UE, na conta da firma, e copiam-se os arquivos. O site recebe senhas técnicas novas |
| Netlify | Alojamento e publicação | Projeto `bank-and-nif-in-portugal`, na equipa Netlify do desenvolvedor | Transferência do projeto para uma equipa Netlify da firma e, depois, confirmação da ligação ao código |
| Resend | Envio dos e-mails (send.alttavia-relocation.com) | Conta Resend do desenvolvedor (business@guyshore.com), com o domínio de envio verificado | Conta da firma e nova verificação do domínio de envio na configuração do domínio. Senha técnica nova no site e na Supabase |
| Stripe | Pagamentos | Conta da firma. [A CONFIRMAR: com que papel entra o desenvolvedor na conta Stripe da firma para a configuração em modo real?] | Nada a transferir; a firma retira o acesso do desenvolvedor quando quiser |
| GitHub | Código e histórico | O código, `landing-page-alttavia`, na organização BlackElephant-from-Brazil, do desenvolvedor. Hoje é **público**: qualquer pessoa lê o código e os documentos do repositório, incluindo os modelos de contrato da firma. [A CONFIRMAR: o repositório passa a privado antes de enviar este documento?] | Transferência do código para uma conta da firma e nova ligação à Netlify |

**Domínio.** alttavia-relocation.com está registado na GoDaddy até 13/01/2029. A sua configuração (DNS) está na Netlify, e o e-mail da firma no Google Workspace. [A CONFIRMAR: em nome de quem está o registo na GoDaddy, e em que conta Netlify está a configuração do domínio?]

Passar para a firma as contas que estão em nome do desenvolvedor (Supabase, Cloudflare, Netlify, GitHub e Resend) é trabalho novo, estimado em horas antes de começar. Para a Alttavia, sem custo. Fica para quando a firma decidir (decisão 4). Para o suporte continuar depois disso, o desenvolvedor fica como membro de cada conta.

## 4. Custos mensais

Preços públicos conferidos a 30/09/2026, em dólares americanos (o Stripe em euros). Podem mudar.

| Serviço | Hoje | Limite que importa | Opção paga |
|---|---|---|---|
| Supabase | sem mensalidade | 500 MB de base de dados, 5 GB de tráfego e 50 000 utilizadores ativos por mês. Pausa após 7 dias sem uso. Sem cópia automática | Pro, desde 25 USD por mês: não pausa e faz uma cópia diária, guardada 7 dias |
| Resend | sem mensalidade | 3 000 e-mails por mês e 100 por dia | Pro, 20 USD por mês: 50 000 e-mails por mês, sem limite diário |
| Netlify | sem mensalidade | No plano por créditos: 300 créditos por mês. Cada publicação em produção gasta 15, cada GB de tráfego 20, cada GB-hora do servidor 10 e cada 10 000 pedidos 2. [A CONFIRMAR: a equipa Netlify guiblackelephant está no plano por créditos ou num plano antigo, de antes de 04/09/2025?] | Personal, 9 USD por mês, ou Pro, 20 USD por mês |
| Cloudflare R2 | sem mensalidade | Até 10 GB de arquivos guardados | 0,015 USD por GB e por mês acima disso |
| Stripe | sem mensalidade | Uma taxa por pagamento, no painel Stripe da firma. Tabela pública em Portugal: 1,5 % + 0,25 € nos cartões do EEE, 2,8 % + 0,25 € nos cartões premium do EEE, 2,5 % + 0,25 € nos do Reino Unido, 3,15 % + 0,25 € nos outros, mais 2 % quando há conversão de moeda | Não se aplica |
| GitHub | sem mensalidade | Não se aplica | Não se aplica |

Hoje: 0 USD por mês, fora as taxas do Stripe e o domínio. Com Supabase Pro e Resend Pro: cerca de 45 USD por mês. O que os dois planos pagos evitam:

- Supabase: com 7 dias sem uso, o projeto pausa, e o site deixa de criar contas e pedidos até ser reativado.
- Resend: depois do 100.º e-mail de um dia, os e-mails param até ao dia seguinte, códigos de entrada incluídos.

Na Netlify, no plano por créditos, gastos os créditos do mês, todas as páginas do site mostram "Site not available" até ao mês seguinte ou até se mudar de plano.

## 5. Cópias de segurança

- **Hoje:** cópia manual, feita pelo desenvolvedor, de todas as tabelas e das contas de acesso e, quando pedido, dos arquivos. Fica no computador dele, fora do código, e não vai para outro lugar. Feitas: 21/09 (duas), 22/09 (com os arquivos), 25/09 e 28/09 (antes das atualizações da base de dados) e 30/09. A próxima, com os arquivos, é feita logo antes da publicação em produção.
- **Não há cópia automática.** O plano atual da Supabase não inclui nenhuma. A Supabase Pro acrescenta uma diária da base de dados; os arquivos continuam na cópia manual.
- **Como pedir:** pelo suporte (secção 8) ou pelo botão **Feedback**, com "Pedido de cópia de segurança". A resposta traz a data e a hora da cópia. O desenvolvedor faz sempre uma antes de cada atualização da base; a frequência regular é a decisão 6.
- **Repor uma cópia** repõe os registos que faltam e nunca apaga nenhum. As contas de acesso e os arquivos repõem-se à mão.

## 6. Decisões em aberto

1. **Textos legais.** A 28/09, aprovados para o lançamento, foram publicados o aviso de privacidade (`/en/privacy`, aberto pelo link **Privacy** do rodapé, por uma linha no passo do e-mail do formulário e da entrada do cliente, pelo formulário de dados da área do cliente e pela linha sob cada botão de pagar) e os termos corrigidos (`/en/service-terms`, "Last updated: 28 September 2026"). Os dois nomeiam a ALTTAVIA RELOCATION, Unipessoal Lda. como responsável pelo tratamento e como quem vende, com a mesma morada, e o rodapé do site passou a dizer o mesmo; o link **Terms** do rodapé, que levava aos termos de uso do site principal, saiu. O que o código não mostrava ficou de fora, sem nada adivinhado. Você revê cada texto depois do lançamento, e as suas correções entram numa atualização. Para ler primeiro (a lista "Read first, for Patrícia after launch" da proposta de aviso de privacidade): quem é o representante fiscal (as procurações nomeiam você; os termos agora dizem só que a procuração do NIF o nomeia); o consentimento da Cláusula Décima Sexta; desde quando contam os 14 dias de desistência (os termos agora remetem para o Anexo I); as transferências para fora da UE; o prazo do contrato assinado (10 anos); e o **Bank Account only**, que hoje não tem nenhum arquivo a entregar na plataforma. Das 19 decisões no fim do documento de fatos legais ("Textos legais da plataforma: fatos para a sua revisão"), ficam para essa revisão, entre outras:
   - prazos de conservação (5): publicados os valores propostos;
   - transferências para fora da UE (8): uma frase no aviso;
   - parceiro e filhos (3 e 11): a base legal dos dados do parceiro ficou de fora; os NIF dos filhos são orçados à parte;
   - Livro de Reclamações e resolução de litígios (13): os termos ainda não têm o link nem a entidade; entram depois do lançamento (decisão de 30/09);
   - qual texto governa e quando o cliente o vê, incluindo a aceitação sob o botão Pay e a Parte A do Anexo I (14): os termos dizem que o contrato prevalece, e cada pedido regista a versão aceite;
   - entrega por e-mail e cartões do banco (17): a página de vendas e o formulário ainda falam de cartão de débito e de envio dos documentos no pagamento;
   - promessas da página de termos (19): corrigidas; os termos não dizem ainda como chegam o NIF e os códigos, nem o que o cliente recebe se desistir.
2. **Texto do Couple package.** Aprovar a redação para duas pessoas no contrato e na procuração bancária, alínea d) incluída. E, nas contas conjuntas de **Bank Account only** e **NIF + Bank Account**, o contrato deve nomear os dois titulares, como no casal?
3. **Planos pagos.** Supabase Pro e Resend Pro, e em nome de quem fica a cobrança.
4. **Contas e subcontratação.** Passar as contas para a firma, ou mantê-las e assinar o acordo de subcontratação (o rascunho vai em anexo; item 7 dos fatos).
5. **Acesso de suporte e staging.** Decidido a 30/09: o staging fica no ar de forma permanente, na base da produção, e a conta de suporte business+admin@guyshore.com continua no painel enquanto houver suporte. Falta a sua aceitação disto no acordo de subcontratação (item 9 dos fatos).
6. **Cópias:** onde ficam, por quanto tempo, com que frequência e se levam os arquivos dos clientes (item 10).
7. **Fatura e IVA:** quem emite a fatura certificada de cada venda.
8. **Novo Banco.** Nacionalidades recusadas (lista hoje vazia) e vistos aceites (hoje D1 a D9 e familiar de cidadão da UE). E a conta para quem é de fora do EEE sem visto em andamento. Estas perguntas seguem por escrito ao banco quando a firma as enviar.
9. **Nome na página de pagamento.** Hoje a página do Stripe mostra "Consulting". Que nome deve ver o cliente? Muda-se no painel do Stripe da firma.

## 7. O que fica para depois

| O quê | Quando |
|---|---|
| **Publicação em produção**, pelo desenvolvedor, por esta ordem: Stripe em modo real (endpoint do webhook, chave restrita, ids de preço em modo real em **Services**); variáveis de produção na Netlify; nova build, conferida no endereço do próprio deploy; cópia da base de dados; publicação à mão (runbook, secção 0) | Último passo, depois das correções combinadas. Até lá, o endereço de produção mostra a página de vendas anterior |
| Compra real de €149 (**NIF only**), devolvida depois no Stripe | Logo depois da publicação. O pedido fica pago no painel e conta no **Overview** |
| Os quatro links de pagamento do Stripe em modo real. A página anterior vende por eles, e o código novo usa-os quando um serviço não tem preço em modo real | [A CONFIRMAR: os quatro links ficam ativos depois da publicação, ou são desativados?] |
| A sua revisão do aviso de privacidade e dos termos, publicados a 28/09 | Depois do lançamento, texto a texto. As correções entram numa atualização |
| Livro de Reclamações Eletrónico e entidade de resolução alternativa de litígios (RAL): o link e o nome da entidade nos termos e no site | Depois do lançamento, com a revisão dos textos legais |
| Frases da página de vendas, do formulário e do catálogo que ainda não correspondem ao serviço (secção 3 das mudanças aos termos): documentos enviados "no pagamento" (são enviados depois, na área do cliente); "debit card" na conta bancária; conta aberta "remotely" (o banco pode pedir para ver o cliente); "we tell you before you buy" sobre a nacionalidade; "Within 1 business day" e "Your NIF arrives by email" na página de sucesso; "12 months of tax representation" para os dois adultos no casal e nas contas conjuntas; listas de documentos mais curtas do que as pedidas | Depois do lançamento, com a sua revisão dos textos |
| Monitor externo, que confirma a cada poucos minutos que o site e a base de dados respondem | Depois do lançamento: nenhum plano serve hoje. Até lá, o suporte recebe por e-mail os erros do servidor e os avisos de pagamento do Stripe que o site recusou ou não conseguiu registar |
| A sua assinatura digitalizada no contrato (imagem PNG, fundo transparente) | A 30/09 a imagem ainda não está na plataforma. Enviada antes da compra real de €149, o primeiro contrato real já sai assinado. Até lá, a linha de assinatura da firma sai em branco. Os contratos de pedidos reais já preparados recebem a assinatura com **Regenerate and resend**; os de teste nunca a recebem. |
| Segundo fator na entrada do painel | Só se a firma o quiser. O cartão **Second factor** em **Settings** já funciona: ligado, o painel pede também o código de uma aplicação no telemóvel |
| Proteção contra robôs (Cloudflare Turnstile) no envio do código de entrada e na entrada do painel | Depois do lançamento. [A CONFIRMAR: em que data entra a proteção contra robôs?] |
| Medição de visitas (Google Tag Manager), com aviso de cookies | Depois do lançamento. A medição só liga depois de existir o aviso de consentimento, como promete o aviso de privacidade |
| Renovar a chave de acesso do desenvolvedor à Supabase (expira a 11/10) | Até 09/10 |
| Passar as contas para a firma e registar quem controla a configuração do domínio | Quando a firma decidir (decisão 4) |
| Funcionalidades pedidas: devolver um pagamento pelo painel (até lá, no Stripe); desfazer a revisão de um documento (até lá, pelo suporte); procurar clientes por nome e telefone; registo permanente das ações do painel; base de dados própria para o staging; painel em português; renovação anual de €99 como assinatura | Sem data. Cada uma recebe uma estimativa em horas quando a firma a pedir (secção 8) |

## 8. Suporte

- **Canal:** [A CONFIRMAR: qual é o e-mail do suporte, e o número de WhatsApp ou telefone para urgências?]. O botão **Feedback** do painel guarda a nota em **Feedback**, com o estado **Open**, **Planned**, **Done** ou **Won't do**, e avisa o desenvolvedor por e-mail, em business@guyshore.com.
- **Urgente:** site que não abre, pagamento sem pedido marcado como pago, cliente que não consegue enviar documentos, você sem acesso ao painel.
- **Prazo de resposta:** os da proposta de suporte (secções 4 e 7), em dias úteis e hora de Lisboa.
- **Incluído:** correções, dúvidas de uso, cópias, apagar ou corrigir os dados de um cliente a pedido e, se um dia ligar o segundo fator, retirá-lo quando perder o telemóvel.
- **Funcionalidades novas:** estimativa em horas antes de começar, para você decidir e saber quando fica pronto. Para a Alttavia, sem custo (proposta de suporte, secção 9).
- **Atualizações:** passam primeiro pelo staging. A produção tem a publicação automática travada: só muda quando o desenvolvedor publica à mão.
- **Valor mensal:** para a Alttavia, sem custo, por decisão da guyshore.com. As correções de defeitos estão incluídas enquanto durar o suporte (proposta de suporte, secção 2).
