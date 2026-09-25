# Proposta de suporte da plataforma

**Modelo reutilizável da guyshore.com, preenchido para a Alttavia Relocation a 25/09/2026, dia da entrega.**

Esta proposta diz como a plataforma é mantida depois da entrega. Os campos entre [colchetes] preenchem-se para cada firma, e **[A CONFIRMAR]** marca o que ainda depende de uma decisão. O exemplo da secção 8 usa valores inventados.

## 1. Partes e vigência

| | |
|---|---|
| Quem presta o suporte | guyshore.com (Guilherme Kodenvis) [A CONFIRMAR: entidade que assina e fatura] |
| Firma | [nome da firma] |
| Produção e ambiente de testes | [endereços]. O ambiente de testes fica no ar depois da entrega. |
| Início e duração | [data do termo de aceite], por [12 meses], renovada [automaticamente]. Qualquer das partes termina com [30 dias] de aviso. |

## 2. O que o suporte cobre

| Tipo | O que é | Exemplos | Custo |
|---|---|---|---|
| Correção de defeito | A plataforma não faz o que foi entregue e aceite. | O botão de pagamento não abre o Stripe. Um e-mail previsto não sai. | Sempre incluída. Sem contrato de suporte, vale uma garantia de [90 dias] depois do aceite. |
| Pequeno ajuste | Uma mudança pequena no que já existe, até [2 horas] cada. | Trocar o texto de uma página ou de um e-mail. Mudar o preço de um serviço que já existe. | Incluído até [__ horas] por mês, que não passam para o mês seguinte. |
| Trabalho novo | O que acrescenta uma função ou muda a forma de trabalhar. | Um serviço novo no formulário de candidatura. Outra língua. Assinatura digital do contrato. Passar as contas dos fornecedores para o nome da firma. | Orçamento em horas antes de começar. Só avança com o sim da firma. |

**A firma faz sozinha:** em **Services**, as notas, os documentos pedidos, os entregáveis e as etapas; em **Users**, criar contas e atribuir compras.

**Fora do suporte:**

- as falhas dos próprios fornecedores: o suporte avisa a firma e age do lado da plataforma, mas não controla o tempo de reposição;
- o conteúdo jurídico dos termos e dos contratos;
- o atendimento aos clientes da firma;
- a faturação das vendas e as disputas de pagamento no Stripe.

## 3. Canais

1. **O botão Feedback**, no canto de todas as páginas do painel. É o canal principal. Preencha **Which screen** (para uma página do cliente, cole o endereço), **What did you expect**, **What happened** e a prioridade em **How much does it matter**, uma nota por assunto. O andamento aparece em **Feedback**, no menu: **Open**, **Planned**, **Done** ou **Won't do**. Cada nota chega também por e-mail ao suporte [A CONFIRMAR: caixa que a recebe em produção].
2. **E-mail** para [endereço de suporte]: quando o painel não abre, ou para perguntas sobre custos e contas.
3. **WhatsApp** para [número]: só para avisar de um **Blocks my work**. O detalhe fica na nota.

Nunca envie senhas, códigos de entrada ou documentos de clientes. Para indicar um pedido, basta o endereço da página dele.

## 4. Prazos de resposta

Dias úteis, das [09:00 às 18:00] de Lisboa, fora dos feriados [nacionais de Portugal]. Responder é dizer o tipo do pedido (defeito, ajuste ou trabalho novo) e quando fica pronto.

| Prioridade | Quando usar | Primeira resposta | Solução ou contorno |
|---|---|---|---|
| **Blocks my work** | O trabalho ou as vendas param: ninguém consegue pagar, o painel não abre. | [__ horas úteis] | [__ dia útil] |
| **Should change** | Funciona, mas está errado ou dificulta o dia a dia. | [__ dia útil] | Na atualização seguinte |
| **Nice to have** | Uma melhoria. | [__ dias úteis] | Lista com data, ou orçamento |

Fora do horário: [sem cobertura, ou melhor esforço quando as vendas param] [A CONFIRMAR].

Cada mudança passa pelos testes automáticos e pelo ambiente de testes, e é publicada à mão numa janela fixa, [dia e hora de Lisboa]. Uma correção de **Blocks my work** sai assim que estiver testada, e uma publicação que corra mal volta à versão anterior em minutos. Atenção: o ambiente de testes usa a mesma base de dados da produção, só o Stripe está em modo de teste.

## 5. Rotina mensal

No [primeiro dia útil] de cada mês, o suporte verifica o mês anterior e manda à firma um resumo curto por e-mail.

1. **Limites.** Supabase: 500 MB de base de dados, 5 GB de tráfego e 50 mil contas ativas por mês; o projeto pausa depois de 7 dias sem uso. Resend: 3 mil e-mails por mês e 100 por dia, códigos de entrada incluídos. Cloudflare R2: 10 GB. Netlify: 300 créditos por mês. Acima de [70 %] de um limite, o resumo traz a opção paga.
2. **Verificação do site.** Um endereço do site, bank-nif-portugal.alttavia-relocation.com/api/health, responde se o site chega à base de dados. Um serviço externo abre-o a cada 5 minutos e avisa o suporte quando falha. Cada falha do mês fica explicada. [A CONFIRMAR: o serviço externo.]
3. **Cópias de segurança.** Não há cópia automática. O suporte faz uma cópia de todas as tabelas (e dos documentos dos clientes, quando pedido) e confirma que ela se lê, sem repor nada. Guarda as [3] últimas no computador do desenvolvedor. Contêm dados pessoais. [A CONFIRMAR: frequência e um segundo local.]
4. **Stripe contra o painel.** Em **Overview**, preencha **From** e **To** com o mês e clique **Apply**. Compare **Paid** e **Revenue** com os pagamentos do Stripe em modo real e, depois, pedido a pedido em **Orders**. Diferenças esperadas: os pedidos com **Already paid outside the platform** não estão no Stripe. Os pedidos do ambiente de testes e das contas de demonstração (demo.alttavia.invalid) estão no painel, porque a base é a mesma. Um pagamento devolvido no Stripe continua pago no painel. Outra diferença, ou um e-mail **Paid amount does not match the order**, trata-se como defeito.
5. **Feedback.** Uma nota **Open** há mais de [5 dias úteis] tem explicação no resumo.
6. **Acessos.** As contas de administração e o segundo fator de cada uma. As chaves com prazo, como a chave pessoal com que o desenvolvedor acede à base de dados, que expira a 11/10/2026. As atualizações de segurança do código.

## 6. Fornecedores: quem paga e quanto

Preços públicos de 25/09/2026, em dólares americanos. Podem mudar.

| Fornecedor | Para quê | Conta em nome de | Hoje | Opção paga |
|---|---|---|---|---|
| Supabase | Base de dados e entrada nas contas | guyshore.com | Plano de entrada, 0 USD | Pro, desde 25 USD por mês: sem pausa, cópia diária guardada 7 dias |
| Cloudflare R2 | Documentos, contratos e entregas | Desenvolvedor | Até 10 GB, 0 USD | 0,015 USD por GB e por mês acima disso |
| Netlify | Site e servidor | Desenvolvedor | Plano de entrada, 0 USD: 300 créditos por mês (cada publicação em produção gasta 15, cada GB de tráfego 20) | Personal, 9 USD por mês, ou Pro, 20 USD |
| Resend | E-mails, de send.alttavia-relocation.com | [A CONFIRMAR] | 3 mil por mês, 0 USD | Pro, 20 USD por mês: 50 mil, sem limite diário |
| Stripe | Pagamentos | A firma | Comissão por pagamento, sem mensalidade [A CONFIRMAR: tabela da conta] | Não se aplica |
| Domínio e caixas de e-mail | Endereços da firma | [A CONFIRMAR] | [A CONFIRMAR] | Não se aplica |

Um plano pago é pago [pela firma, numa conta em nome dela] ou [pelo suporte, repassado sem margem] [A CONFIRMAR]. Recomendação: se a firma contratar um plano, o primeiro é o Supabase Pro, que traz a cópia diária que hoje não existe e acaba com a pausa. Passar as contas para o nome da firma é trabalho novo, de cerca de 3,5 horas [A CONFIRMAR].

## 7. Valores

| Campo | A preencher | Alttavia Relocation |
|---|---|---|
| Mensalidade | [__] € por mês [+ IVA] | 0 € |
| Horas de pequenos ajustes incluídas | [__] por mês | Sem teto fixo [A CONFIRMAR] |
| Hora adicional ou de trabalho novo | [__] € por hora, ou orçamento fechado | 0 € |
| Defeitos e rotina mensal | Incluídos | Incluídos |
| Fornecedores | [diretos] ou [repassados ao custo] | 0 USD hoje. Planos pagos [A CONFIRMAR] |
| Faturação e atualização dos valores | [mensal, a __ dias; uma vez por ano, com aviso] | Não se aplica |
| Início e duração | [data], [12 meses] | 25/09/2026, [A CONFIRMAR: duração] |
| Prazos da secção 4 | [valores] | **Blocks my work**: resposta em 2 horas úteis, solução em 1 dia útil; **Should change**: 1 dia útil; **Nice to have**: 3 dias úteis [A CONFIRMAR] |

## 8. Exemplo, com valores inventados

> **EXEMPLO.** Não se aplica à Alttavia. Mostra como a proposta funciona num mês.

A Firma Exemplo paga 300 € + IVA por mês, com 4 horas de ajustes incluídas, e 60 € por hora adicional. **Blocks my work**: resposta em 2 horas úteis, solução em 1 dia útil. **Should change**: resposta em 1 dia útil, publicação na terça seguinte às 08:00. **Nice to have**: resposta em 3 dias úteis. Supabase Pro e Resend Pro repassados ao custo: 45 USD por mês.

- Terça, 10:15, **Blocks my work**: "o botão de pagamento não abre". Resposta às 10:40, correção no ar às 15:00. É defeito: 0 €.
- Quarta, **Should change**: mudar uma frase do e-mail de pagamento recebido. Usa 1 das 4 horas e sai na terça seguinte.
- Sexta, **Nice to have**: a página de serviços em espanhol. É trabalho novo: 8 horas, 480 €. A firma aprova e a nota passa a **Planned**, com data.

Fatura do mês: 300 € + 480 € = 780 € + IVA, mais 45 USD de fornecedores. As 3 horas que sobraram não passam para o mês seguinte.

## 9. Alttavia Relocation

Para a Alttavia Relocation, o suporte descrito nesta proposta é prestado sem custo, por decisão da guyshore.com. Por isso, para esta firma, os campos de valor ficam a zero: mensalidade 0 €, hora adicional 0 €, trabalho novo 0 €. Tudo o resto vale como está escrito (canais, prioridades, rotina mensal e classificação de cada pedido), para que a firma saiba sempre o que pediu e quando fica pronto. Os fornecedores custam hoje 0 USD; se a firma escolher um plano pago, quem o paga decide-se antes [A CONFIRMAR]. Produção: https://bank-nif-portugal.alttavia-relocation.com. Ambiente de testes permanente: https://staging--bank-and-nif-in-portugal.netlify.app. Primeira atualização prevista: terça, 29/09/2026, às 08:00 de Lisboa.

## 10. O que falta confirmar

1. A entidade que assina e fatura pela guyshore.com, e a duração para a Alttavia.
2. O e-mail e o WhatsApp do suporte, e a caixa que recebe as notas de **Feedback** em produção.
3. O horário, os feriados, a cobertura fora de horas, os prazos da secção 4 e a janela das atualizações.
4. O serviço externo que vigia bank-nif-portugal.alttavia-relocation.com/api/health, e a frequência e o segundo local das cópias de segurança.
5. O titular da conta Resend e do domínio.
6. Quem paga um plano pago, e se as contas passam para o nome da firma.
7. Se a conta de suporte business+admin@guyshore.com continua administradora depois da entrega (item 9 dos fatos legais).

**Aceite.** Pela firma: ______________________ Data: ____/____/______ · Pela guyshore.com: ______________________ Data: ____/____/______
