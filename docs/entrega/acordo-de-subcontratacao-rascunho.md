# Acordo de subcontratação (artigo 28.º do RGPD): rascunho

**Rascunho para a advogada completar. Não é aconselhamento jurídico.** Preparado pelo desenvolvedor em 25/09/2026 e atualizado a 30/09/2026, a partir do código da plataforma e de `docs/legal/fatos-para-patricia.md` e `docs/legal/privacy-proposal.md`. **[A CONFIRMAR: ...]** marca cada escolha jurídica e cada facto que só as partes podem dar; "item N" remete à lista de decisões de `fatos-para-patricia.md`. O resto descreve o que a plataforma faz hoje. Serve de modelo para o próximo cliente: os campos entre parênteses retos mudam, e os valores da Alttavia ficam como exemplo preenchido.

## Partes

**Responsável pelo tratamento.** ALTTAVIA RELOCATION, Unipessoal Lda., NIPC 518 856 984. Sede: Av. António Augusto Aguiar, 24, 1.º direito, Escritório 3, 1050-016 Lisboa, a sede dos modelos de contrato desde 25/09/2026. Representada por Patrícia Soares Viana, [A CONFIRMAR: em que qualidade representa a empresa (por exemplo gerente)?]. Contacto: info@alttavia-relocation.com.

A empresa é a responsável pelo tratamento que o aviso de privacidade publicado a 28/09/2026 nomeia. [A CONFIRMAR: na revisão depois do lançamento, a empresa continua a única responsável, ou a empresa e Patrícia Soares Viana, advogada, são responsáveis distintas ou conjuntas (artigo 26.º)? (item 1 a)]

**Subcontratante.** guyshore.com, representado por Guilherme Kodenvis. [A CONFIRMAR: nome legal, forma jurídica, número fiscal, morada e país do subcontratante; assina em nome próprio ou por uma empresa?] Contacto: [A CONFIRMAR: que e-mail e telefone de contacto do subcontratante? Sugestão: business@guyshore.com].

**Contrato principal.** [A CONFIRMAR: que contrato de desenvolvimento, alojamento e suporte existe, e com que data?] Remuneração: [VALOR]. Exemplo Alttavia: suporte sem custo, por decisão do subcontratante, sem redução de nenhum dever deste acordo.

## 1. Objeto e duração

1.1. O subcontratante trata dados pessoais por conta do responsável para alojar, manter e dar suporte à plataforma de clientes dos serviços de NIF e conta bancária. Produção em https://bank-nif-portugal.alttavia-relocation.com e testes em https://staging--bank-and-nif-in-portugal.netlify.app.

1.2. Vigora de [A CONFIRMAR: desde que data vigora? Sugestão: a da assinatura, cobrindo também o tratamento feito antes dela no ambiente de testes] até ao fim do contrato principal. A base de dados da plataforma existe desde 11/09/2026 e o ambiente de testes está no ar desde 21/09/2026; a produção começa com a publicação, depois de 30/09/2026. Os deveres do subcontratante continuam enquanto ele guardar dados do responsável, cópias incluídas, até cumprida a cláusula 9.

1.3. As contas hoje:

- projeto Supabase na organização guyshore.com;
- armazenamento de arquivos (Cloudflare R2) na conta Cloudflare do desenvolvedor;
- site na equipa Netlify do desenvolvedor;
- domínio de envio `send.alttavia-relocation.com` na conta Resend do desenvolvedor (business@guyshore.com).

A conta Stripe é do responsável; o subcontratante acede a ela para a configurar. [A CONFIRMAR: se as contas passarem para o responsável, os fornecedores da cláusula 6 passam a subcontratantes diretos dele? (item 7)]

## 2. Natureza e finalidade

2.1. Finalidade: permitir ao responsável vender e prestar os serviços de NIF e conta bancária a não residentes. Inclui o formulário, a área do cliente, o pagamento, o envio e a revisão de documentos, as procurações e o contrato gerados em PDF, as entregas e os e-mails. O subcontratante não usa os dados para fins próprios.

2.2. Operações:

- alojar a plataforma e guardar os dados nos fornecedores da cláusula 6;
- manter o código;
- enviar os e-mails automáticos: códigos de acesso, pagamento recebido, contrato em anexo, pedido de novo documento, conclusão e avisos à equipa;
- desde 25/09/2026, avisar a equipa (em produção, info@alttavia-relocation.com) de cada contrato assinado recebido, com a cópia em anexo nos pedidos pagos com dinheiro real;
- desde 28/09/2026, enviar ao subcontratante alertas de erros do servidor e de falhas do webhook do Stripe, sem endereços de e-mail, nomes nem dados de passaporte;
- consultar dados só quando um pedido de suporte, uma instrução ou um incidente o exigir;
- fazer cópias de segurança;
- corrigir ou apagar por instrução.

2.3. O ambiente de testes (staging) fica no ar de forma permanente (decisão de 30/09/2026). Usa a mesma base de dados, as mesmas contas de acesso e os mesmos arquivos da produção; só o Stripe está em modo de teste. O subcontratante tem uma conta de administração de suporte (business+admin@guyshore.com), que vê todos os pedidos e arquivos. [A CONFIRMAR: o responsável aceita a base partilhada e a conta de suporte depois da entrega? (item 9)] As contas de demonstração em `demo.alttavia.invalid` (59 a 30/09/2026) são fictícias e ficam na base, tal como os pedidos de teste, por decisão de 30/09/2026.

## 3. Categorias de dados

| Categoria | O que inclui |
|---|---|
| Conta | Primeiro nome, nome completo, e-mail; telefone, se a firma o registar em **Users** |
| Formulário | País do comprovativo de morada, número de adultos, se há filhos que precisam de NIF (sim ou não), quem já tem NIF, conta pretendida, país de cada passaporte, visto |
| Identificação | Nome completo, "nascido" ou "nascida", local e data de nascimento, passaporte (número, emissor, datas), morada fiscal, local de assinatura (opcional) |
| Documentos | Passaporte, comprovativo de morada, número fiscal do país de origem, extratos ou declaração de rendimentos, comprovativo de profissão, NIF português, procurações e contrato assinados; contratos gerados em PDF, todas as versões |
| Entregas | NIF, acesso ao Portal das Finanças, IBAN, relatório final |
| Pagamentos | Serviço, valor, data, referências do Stripe. O cartão nunca passa pela plataforma |
| Histórico | Etapas com data e autor; nome, tipo e tamanho de cada arquivo; revisões e motivos de recusa; data e versão dos termos aceites no botão Pay |
| E-mails | Os da cláusula 2.2, incluindo o contrato em anexo |
| Registos técnicos | IP e navegador de cada sessão e visita; registos do servidor (podem conter e-mail e identificador da conta); uma linha por descarga ou alteração no admin; notas do botão **Feedback**; alertas de operação |
| Cópias de segurança | Tudo o que está acima |

A plataforma não pede categorias especiais (artigo 9.º). Os documentos enviados, como extratos, podem trazer dados que a plataforma não pede, categorias especiais incluídas.

## 4. Categorias de titulares

- clientes;
- potenciais clientes que pediram um código de acesso ou responderam ao formulário sem pagar (a conta nasce no pedido do código);
- parceiros e segundos requerentes (casal, contas conjuntas, segundo NIF), cujos dados chegam pelo titular da conta [A CONFIRMAR: com que base legal se tratam os dados do parceiro? (itens 3 e 11)];
- utilizadores da administração.

Os dados dos filhos não entram na plataforma.

## 5. Deveres do subcontratante

5.1. **Instruções.** Trata os dados só por instrução documentada: este acordo e pedidos escritos de Patrícia Soares Viana, a partir de info@alttavia-relocation.com, transferências incluídas. Avisa de imediato se uma instrução lhe parecer contrária ao RGPD.

5.2. **Confidencialidade.** Acedem aos dados só as pessoas autorizadas, hoje só Guilherme Kodenvis, obrigadas por escrito à confidencialidade, também depois do fim do acordo. [A CONFIRMAR: o sigilo profissional da firma estende-se ao subcontratante, e em que termos? (item 9)]

5.3. **Segurança em vigor a 30/09/2026** (artigo 32.º):

- regras de acesso na base de dados (row level security) em todas as tabelas: cada cliente lê só os seus dados; as alterações passam pelo servidor, que verifica quem pede;
- a administração só abre em sessão iniciada com senha, de 12 caracteres ou mais; quem entra com código por e-mail tem acesso de cliente;
- segundo fator (aplicação de autenticação) disponível nas contas de administração e ligado na conta de suporte. A conta da firma entra no lançamento só com senha, por decisão de 30/09/2026 (ver 5.4);
- arquivos em armazenamento privado Cloudflare R2, jurisdição UE, acessíveis só por ligações pré-assinadas que expiram: 5 minutos para enviar, 2 para descarregar. O contrato só abre com sessão verificada. [A CONFIRMAR: no painel da Cloudflare, o espaço alttavia-documents tem o acesso público (r2.dev e domínio próprio) desligado?];
- HTTPS em todas as páginas e ligações aos fornecedores;
- cookies de sessão enviados só por ligação cifrada (HTTPS) em produção;
- dados cifrados em repouso com AES-256 na Supabase, no Cloudflare R2, na Netlify e na Resend;
- chaves secretas só na Netlify e em arquivos locais do subcontratante, fora do código;
- cada descarga e alteração no admin deixa uma linha nos registos da Netlify (quem, o quê, onde).

5.4. **Limites conhecidos** [A CONFIRMAR: o responsável aceita cada limite abaixo, ou quer algum corrigido antes da assinatura?]:

- não há cópia automática;
- as cópias manuais da base de dados ficam no computador do subcontratante, sem prazo, e podem incluir passaportes e contratos [A CONFIRMAR: em que país está esse computador, o disco está cifrado, e por quanto tempo se guardam as cópias? (item 10)];
- nada apaga dados automaticamente, e não há exportação por cliente;
- os planos são sem custo: a Supabase suspende o projeto após 7 dias sem uso, e a Resend envia até 100 e-mails por dia;
- os planos pagos (Supabase Pro, cerca de 25 USD por mês; Resend, cerca de 20 USD por mês) são decisão do responsável;
- sem segundo fator na conta da firma, quem ler a caixa info@alttavia-relocation.com consegue trocar a senha do painel em **Forgot your password?** e entrar na administração;
- os registos da Netlify guardam-se só cerca de 24 horas no plano atual (7 dias apenas em alguns planos pagos); não há registo permanente das ações do painel;
- o código e a documentação técnica estão num repositório público do GitHub, sem chaves nem dados de clientes, mas com os modelos de contrato da firma, que incluem os dados profissionais da representante (ver o documento de entrega, secção 3);
- o subcontratante tem uma chave pessoal de acesso à base de produção, e as suas ferramentas, assistentes de IA incluídos, conseguem lê-la [A CONFIRMAR: limita-se esse acesso à estrutura das tabelas, ou inclui-se o fornecedor do assistente na cláusula 6? (item 9)].

5.5. **Assistência** nos artigos 32.º a 36.º (segurança, violações, avaliação de impacto, consulta prévia), e registo das atividades do artigo 30.º, n.º 2, que ainda não existe. [A CONFIRMAR: o subcontratante assume esta assistência sem custo, e até quando cria o registo do artigo 30.º, n.º 2?]

## 6. Subcontratantes ulteriores

| Fornecedor | Função | Dados em | Conta |
|---|---|---|---|
| Supabase | Base de dados e entrada nas contas | Londres, Reino Unido | Organização guyshore.com |
| Cloudflare R2 | Arquivos | União Europeia | Desenvolvedor |
| Netlify | Alojamento, servidor, registos | Funções do servidor nos Estados Unidos (Ohio), a região de fábrica, que só muda no plano Pro; páginas servidas pela rede global da Netlify; registos das funções guardados cerca de 24 horas | Desenvolvedor |
| Resend | Envio de e-mails | Estados Unidos; registos de envio guardados 30 dias | Desenvolvedor (business@guyshore.com) |
| Google (Google Workspace, caixa business@guyshore.com) | Recebe as notas do botão **Feedback** e os alertas de operação, e, do staging, os avisos à equipa | Centros de dados da Google, sem região escolhida | Subcontratante |

6.1. Ficam fora desta lista, porque o responsável os usa diretamente: o Stripe, o fornecedor da caixa info@alttavia-relocation.com (Google Workspace) e o WhatsApp. O Stripe é a conta da firma e trata também dados para fins próprios, como a prevenção de fraude, e para esses fins é responsável pelo tratamento.

6.2. O responsável dá [A CONFIRMAR: autorização geral escrita, ou autorização caso a caso?] aos fornecedores da tabela; qualquer mudança é avisada com [A CONFIRMAR: com quantos dias de antecedência? Sugestão: 30] dias, e o responsável pode opor-se. O subcontratante impõe-lhes obrigações equivalentes através do acordo de dados de cada um e responde por eles (artigo 28.º, n.º 4). Os acordos de dados da Supabase e da Resend fazem parte dos termos aceites ao criar a conta; a Resend guarda uma cópia assinada nas definições da conta. [A CONFIRMAR: o subcontratante aceitou o acordo de dados da Cloudflare e o da Netlify nas respetivas contas?]

6.3. **Transferências.** Vários fornecedores têm sede fora da UE. A Supabase guarda os dados no Reino Unido, com decisão de adequação. As funções da Netlify correm nos Estados Unidos. A Resend guarda os dados nos Estados Unidos e declara cobrir as transferências com cláusulas contratuais-tipo e o Data Privacy Framework UE-EUA. O acesso remoto do subcontratante de fora do EEE também pode contar. [A CONFIRMAR: que garantia aceita o responsável para cada transferência (adequação, Data Privacy Framework ou cláusulas-tipo da Decisão de Execução (UE) 2021/914), e de que país acede o subcontratante? (item 8)]

## 7. Pedidos dos titulares

O subcontratante reencaminha ao responsável qualquer pedido que receba, sem responder, em [A CONFIRMAR: em quantos dias úteis? Sugestão: 2] dias úteis. Cumpre a sua parte em [A CONFIRMAR: em quantos dias úteis? Sugestão: 5] dias úteis, para o responsável responder no prazo de um mês do artigo 12.º, n.º 3. Hoje:

- **acesso:** o painel mostra perfil, pedidos, dados das procurações, contrato e arquivos, um a um; uma cópia completa sai da base pelo subcontratante;
- **retificação:** o cliente corrige os dados das procurações enquanto houver uma por enviar. A firma corrige nome, e-mail e telefone em **Users**, **Edit**, e refaz o contrato com **Regenerate and resend**. O resto, o subcontratante;
- **apagamento:** a firma apaga em **Users**, **Delete** uma conta de cliente sem pedidos pagos (arquivos, pedidos, respostas, conta); depois, o subcontratante apaga também os dados dessa conta das cópias de segurança. Desde 28/09/2026, uma conta com um pedido pago não se apaga pelo painel: o aviso de privacidade guarda o contrato e os registos de pagamento durante 10 anos. Ficam Stripe, e-mails e registos da Netlify, cada um no seu prazo [A CONFIRMAR: num pedido de apagamento de um cliente com pedidos pagos, apaga-se o resto e guarda-se o pedido, ou anonimiza-se a conta, sabendo que não há ferramenta para anonimizar? (item 6)];
- **limitação, oposição, portabilidade:** feitas pelo subcontratante a pedido escrito do responsável.

## 8. Violações de dados pessoais

8.1. **O subcontratante avisa o responsável** sem demora injustificada e no máximo [A CONFIRMAR: em quantas horas? Sugestão: 24] horas depois de ter conhecimento. Avisa por telefone para [A CONFIRMAR: para que número de telefone da firma?] e por escrito para info@alttavia-relocation.com. O aviso traz o que já souber (artigo 33.º, n.º 3): o que aconteceu, que dados e quantas pessoas, as consequências prováveis, as medidas tomadas e propostas, e um contacto. O resto segue por fases.

8.2. **O responsável notifica a CNPD** em até 72 horas depois de ter conhecimento, salvo se a violação não for suscetível de resultar num risco para as pessoas (artigo 33.º). **Informa os titulares** se o risco for elevado (artigo 34.º). O subcontratante não notifica ninguém sem instrução escrita [A CONFIRMAR: o responsável quer esta regra sem exceções?].

8.3. Exemplos: fuga de uma chave secreta, perda do computador com as cópias, acesso indevido ao admin, contrato enviado ao endereço errado. O subcontratante regista cada violação (artigo 33.º, n.º 5).

## 9. Fim: devolução e apagamento

À escolha escrita do responsável [A CONFIRMAR: o responsável quer as duas opções abaixo, ou só uma?]:

- a) transferência das contas para o seu nome; ou
- b) devolução da base de dados completa (um arquivo por tabela e a lista de utilizadores) e de todos os arquivos, por [A CONFIRMAR: que meio seguro de entrega?].

Depois, em [A CONFIRMAR: em quantos dias? Sugestão: 30] dias, o subcontratante apaga a base, os arquivos, as contas que fiquem com ele e as cópias no seu computador. Confirma-o por escrito. Os registos dos fornecedores seguem o prazo de cada um. Só fica o que a lei o obrigue a guardar, com indicação da lei.

## 10. Auditorias e disposições finais

10.1. O subcontratante disponibiliza a informação que demonstra o cumprimento: a lista da cláusula 6, as medidas da cláusula 5.3, as linhas de registo do admin e o registo de violações. Aceita auditorias do responsável, ou de auditor mandatado sujeito a sigilo, com [A CONFIRMAR: com quantos dias de aviso? Sugestão: 15] dias de aviso [A CONFIRMAR: com que frequência, e quem paga os custos?].

10.2. [A CONFIRMAR: que regras se escrevem sobre responsabilidade e limites (artigo 82.º), prevalência sobre o contrato principal em matéria de dados, alterações por escrito, lei aplicável (sugestão: portuguesa) e foro?]

## Assinaturas

Feito em [local], em [data], em dois exemplares.

| | Responsável pelo tratamento | Subcontratante |
|---|---|---|
| Entidade | ALTTAVIA RELOCATION, Unipessoal Lda. | [nome legal do subcontratante, ver Partes] |
| Nome | Patrícia Soares Viana | Guilherme Kodenvis |
| Qualidade | [qualidade, ver Partes] | [qualidade, ver Partes] |
| Assinatura | | |
