# Acordo de subcontratação (artigo 28.º do RGPD): rascunho

**Rascunho para a advogada completar. Não é aconselhamento jurídico.** Preparado pelo desenvolvedor em 25/09/2026 a partir do código da plataforma e de `docs/legal/fatos-para-patricia.md` e `docs/legal/privacy-proposal.md`. **[A CONFIRMAR]** marca cada escolha jurídica e cada facto que o código não mostra; "item N" remete à lista de decisões de `fatos-para-patricia.md`. O resto descreve o que a plataforma faz hoje. Serve de modelo para o próximo cliente: os campos entre parênteses retos mudam, e os valores da Alttavia ficam como exemplo preenchido.

## Partes

**Responsável pelo tratamento.** ALTTAVIA RELOCATION, Unipessoal Lda., NIPC 518 856 984. Sede: Av. António Augusto Aguiar, 24, 1050-016 Lisboa [A CONFIRMAR contra a certidão permanente; é a sede dos modelos de contrato desde 25/09/2026]. Representada por Patrícia Soares Viana, [A CONFIRMAR: gerente]. Contacto: info@alttavia-relocation.com.

[A CONFIRMAR, item 1 a): quem é o responsável pelo tratamento? Só a empresa; a empresa e Patrícia Soares Viana, advogada, como responsáveis distintos; ou as duas como responsáveis conjuntos (artigo 26.º).]

**Subcontratante.** guyshore.com [A CONFIRMAR: nome legal, forma jurídica, número fiscal, morada e país], representado por Guilherme Kodenvis [A CONFIRMAR: em nome próprio ou por uma empresa]. Contacto: [A CONFIRMAR: e-mail e telefone; sugestão: business@guyshore.com].

**Contrato principal.** [A CONFIRMAR: contrato de desenvolvimento, alojamento e suporte, e data]. Remuneração: [VALOR]. Exemplo Alttavia: suporte sem custo, por decisão do subcontratante, sem redução de nenhum dever deste acordo.

## 1. Objeto e duração

1.1. O subcontratante trata dados pessoais por conta do responsável para alojar, manter e dar suporte à plataforma de clientes dos serviços de NIF e conta bancária. Produção em https://bank-nif-portugal.alttavia-relocation.com e testes em https://staging--bank-and-nif-in-portugal.netlify.app.

1.2. Vigora de [A CONFIRMAR: data; a produção começa a 25/09/2026] até ao fim do contrato principal. Os seus deveres continuam enquanto o subcontratante guardar dados do responsável, cópias incluídas, até cumprida a cláusula 9.

1.3. As contas hoje:

- projeto Supabase na organização guyshore.com;
- armazenamento de arquivos (Cloudflare R2) na conta Cloudflare do desenvolvedor;
- site na equipa Netlify do desenvolvedor;
- domínio de envio `send.alttavia-relocation.com` na Resend [A CONFIRMAR: titular da conta].

A conta Stripe é do responsável; o subcontratante tem nela acesso de programador. [A CONFIRMAR, item 7: se as contas passarem para o responsável, os fornecedores da cláusula 6 passam a subcontratantes diretos dele.]

## 2. Natureza e finalidade

2.1. Finalidade: permitir ao responsável vender e prestar os serviços de NIF e conta bancária a não residentes. Inclui o formulário, a área do cliente, o pagamento, o envio e a revisão de documentos, as procurações e o contrato gerados em PDF, as entregas e os e-mails. O subcontratante não usa os dados para fins próprios.

2.2. Operações:

- alojar a plataforma e guardar os dados nos fornecedores da cláusula 6;
- manter o código;
- enviar os e-mails automáticos: códigos de acesso, pagamento recebido, contrato em anexo, pedido de novo documento, conclusão e avisos à equipa;
- desde 25/09/2026, enviar a cópia do contrato assinado para info@alttavia-relocation.com;
- consultar dados só quando um pedido de suporte, uma instrução ou um incidente o exigir;
- fazer cópias de segurança;
- corrigir ou apagar por instrução.

2.3. O ambiente de testes (staging) fica no ar depois da entrega. Usa a mesma base de dados, as mesmas contas de acesso e os mesmos arquivos da produção; só o Stripe está em modo de teste. O subcontratante tem uma conta de administração de suporte (business+admin@guyshore.com), que vê todos os pedidos e arquivos. [A CONFIRMAR, item 9: o responsável aceita a base partilhada e a conta de suporte depois da entrega.] Os 56 clientes de demonstração em `demo.alttavia.invalid` são fictícios e saem quando o responsável pedir.

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
| Registos técnicos | IP e navegador de cada sessão e visita; registos do servidor (podem conter e-mail e identificador da conta); uma linha por descarga ou alteração no admin; notas do botão **Feedback** |
| Cópias de segurança | Tudo o que está acima |

A plataforma não pede categorias especiais (artigo 9.º). [A CONFIRMAR: os documentos enviados, como extratos, podem trazer dados não pedidos.]

## 4. Categorias de titulares

- clientes;
- potenciais clientes que pediram um código de acesso ou responderam ao formulário sem pagar (a conta nasce no pedido do código);
- parceiros e segundos requerentes (casal, contas conjuntas, segundo NIF), cujos dados chegam pelo titular da conta [A CONFIRMAR, item 11];
- utilizadores da administração.

Os dados dos filhos não entram na plataforma.

## 5. Deveres do subcontratante

5.1. **Instruções.** Trata os dados só por instrução documentada: este acordo e pedidos escritos de info@alttavia-relocation.com [A CONFIRMAR: outras pessoas autorizadas], transferências incluídas. Avisa de imediato se uma instrução lhe parecer contrária ao RGPD.

5.2. **Confidencialidade.** Acedem aos dados só as pessoas autorizadas [A CONFIRMAR: hoje só Guilherme Kodenvis], obrigadas por escrito à confidencialidade, também depois do fim do acordo. [A CONFIRMAR, item 9: extensão do sigilo profissional da firma ao subcontratante.]

5.3. **Segurança em vigor a 25/09/2026** (artigo 32.º):

- regras de acesso na base de dados (row level security) em todas as tabelas: cada cliente lê só os seus dados; as alterações passam pelo servidor, que verifica quem pede;
- a administração só abre em sessão iniciada com senha; quem entra com código por e-mail tem acesso de cliente;
- segundo fator nas contas de administração (aplicação de autenticação), a ativar pela fundadora em **Settings**, **Second factor**, na chamada das 18:00 de 25/09/2026 [A CONFIRMAR: ativado]. [A CONFIRMAR: obrigatório à data da assinatura, também na conta de suporte. Até lá, quem tiver acesso à caixa de correio de um administrador sem segundo fator consegue redefinir a senha em **Forgot your password?**];
- arquivos em armazenamento privado Cloudflare R2, jurisdição UE, acessíveis só por ligações pré-assinadas que expiram: 5 minutos para enviar, 2 para descarregar. O contrato só abre com sessão verificada [A CONFIRMAR: acesso público desligado no painel da Cloudflare];
- HTTPS em todas as páginas e ligações aos fornecedores;
- cookies de sessão enviados só por ligação cifrada (HTTPS) em produção;
- chaves secretas só na Netlify e num arquivo local do subcontratante, fora do código;
- cada descarga e alteração no admin deixa uma linha nos registos da Netlify (quem, o quê, onde).

[A CONFIRMAR: cifragem dos dados em repouso em cada fornecedor.]

5.4. **Limites conhecidos** [A CONFIRMAR: aceites ou a corrigir]:

- não há cópia automática;
- as cópias manuais da base de dados ficam no computador do subcontratante, sem prazo, e podem incluir passaportes e contratos [A CONFIRMAR, item 10: local, país, disco cifrado, prazo];
- nada apaga dados automaticamente, e não há exportação por cliente;
- os planos são sem custo: a Supabase suspende o projeto após 7 dias sem uso, e a Resend envia até 100 e-mails por dia;
- os planos pagos (Supabase Pro, cerca de 25 USD por mês; Resend, cerca de 20 USD por mês) são decisão do responsável;
- o subcontratante tem uma chave pessoal de acesso à base de produção, e as suas ferramentas, assistentes de IA incluídos, conseguem lê-la [A CONFIRMAR, item 9: limitar à estrutura das tabelas, ou incluir o fornecedor na cláusula 6].

5.5. **Assistência** nos artigos 32.º a 36.º (segurança, violações, avaliação de impacto, consulta prévia) [A CONFIRMAR], e registo das atividades do artigo 30.º, n.º 2 [A CONFIRMAR: ainda não existe].

## 6. Subcontratantes ulteriores

| Fornecedor | Função | Dados em | Conta |
|---|---|---|---|
| Supabase | Base de dados e entrada nas contas | Londres, Reino Unido | Organização guyshore.com |
| Cloudflare R2 | Arquivos | União Europeia | Desenvolvedor |
| Netlify | Alojamento, servidor, registos | [A CONFIRMAR: região e prazo dos registos] | Desenvolvedor |
| Resend | Envio de e-mails | [A CONFIRMAR: região e prazo] | [A CONFIRMAR] |
| [A CONFIRMAR: fornecedor de business@guyshore.com] | Recebe avisos e notas enviados do staging | [A CONFIRMAR] | Subcontratante |

6.1. Ficam fora desta lista, porque o responsável os usa diretamente: o Stripe, o fornecedor da caixa info@alttavia-relocation.com e o WhatsApp. O Stripe é a conta da firma e também trata dados para fins próprios, como a prevenção de fraude [A CONFIRMAR].

6.2. O responsável dá [A CONFIRMAR: autorização geral escrita] aos fornecedores da tabela; qualquer mudança é avisada com [A CONFIRMAR: 30] dias, e o responsável pode opor-se. O subcontratante impõe-lhes obrigações equivalentes através do acordo de dados de cada um [A CONFIRMAR: aceite em cada conta] e responde por eles (artigo 28.º, n.º 4).

6.3. **Transferências.** Vários fornecedores têm sede fora da UE, a Supabase guarda os dados no Reino Unido, e o acesso remoto do subcontratante de fora do EEE também pode contar. [A CONFIRMAR, item 8: país de cada entidade, se há transferência e a garantia: adequação, Data Privacy Framework ou cláusulas-tipo da Decisão de Execução (UE) 2021/914.]

## 7. Pedidos dos titulares

O subcontratante reencaminha ao responsável qualquer pedido que receba, sem responder, em [A CONFIRMAR: 2] dias úteis. Cumpre a sua parte em [A CONFIRMAR: 5] dias úteis, para o responsável responder no prazo de um mês do artigo 12.º, n.º 3. Hoje:

- **acesso:** o painel mostra perfil, pedidos, dados das procurações, contrato e arquivos, um a um; uma cópia completa sai da base pelo subcontratante;
- **retificação:** o cliente corrige os dados das procurações enquanto houver uma por enviar. A firma corrige nome, e-mail e telefone em **Users**, **Edit**, e refaz o contrato com **Regenerate and resend**. O resto, o subcontratante;
- **apagamento:** desde 22/09/2026 a firma apaga uma conta de cliente em **Users**, **Delete** (arquivos, pedidos com o registo do pagamento, respostas, conta); depois, o subcontratante apaga também os dados dessa conta das cópias de segurança. Ficam Stripe, e-mails e registos da Netlify, cada um no seu prazo [A CONFIRMAR, item 6: apagar ou anonimizar; não há ferramenta para anonimizar];
- **limitação, oposição, portabilidade:** feitas pelo subcontratante a pedido escrito do responsável.

## 8. Violações de dados pessoais

8.1. **O subcontratante avisa o responsável** sem demora injustificada e no máximo [A CONFIRMAR: 24] horas depois de ter conhecimento. Avisa por telefone para [A CONFIRMAR: número] e por escrito para info@alttavia-relocation.com. O aviso traz o que já souber (artigo 33.º, n.º 3): o que aconteceu, que dados e quantas pessoas, as consequências prováveis, as medidas tomadas e propostas, e um contacto. O resto segue por fases.

8.2. **O responsável notifica a CNPD** em até 72 horas depois de ter conhecimento, salvo se a violação não for suscetível de resultar num risco para as pessoas (artigo 33.º). **Informa os titulares** se o risco for elevado (artigo 34.º). O subcontratante não notifica ninguém sem instrução escrita [A CONFIRMAR].

8.3. Exemplos: fuga de uma chave secreta, perda do computador com as cópias, acesso indevido ao admin, contrato enviado ao endereço errado. O subcontratante regista cada violação (artigo 33.º, n.º 5).

## 9. Fim: devolução e apagamento

À escolha escrita do responsável [A CONFIRMAR]:

- a) transferência das contas para o seu nome; ou
- b) devolução da base de dados completa (um arquivo por tabela e a lista de utilizadores) e de todos os arquivos, por [A CONFIRMAR: meio seguro].

Depois, em [A CONFIRMAR: 30] dias, o subcontratante apaga a base, os arquivos, as contas que fiquem com ele e as cópias no seu computador. Confirma-o por escrito. Os registos dos fornecedores seguem o prazo de cada um. Só fica o que a lei o obrigue a guardar, com indicação da lei.

## 10. Auditorias e disposições finais

10.1. O subcontratante disponibiliza a informação que demonstra o cumprimento: a lista da cláusula 6, as medidas da cláusula 5.3, as linhas de registo do admin e o registo de violações. Aceita auditorias do responsável, ou de auditor mandatado sujeito a sigilo, com [A CONFIRMAR: 15] dias de aviso [A CONFIRMAR: frequência e custos].

10.2. [A CONFIRMAR: responsabilidade e limites (artigo 82.º); prevalência sobre o contrato principal em matéria de dados; alterações por escrito; lei portuguesa; foro.]

## Assinaturas

Feito em [local], em [data], em dois exemplares.

| | Responsável pelo tratamento | Subcontratante |
|---|---|---|
| Entidade | [A CONFIRMAR: ALTTAVIA RELOCATION, Unipessoal Lda.] | [A CONFIRMAR: nome legal de guyshore.com] |
| Nome | Patrícia Soares Viana | Guilherme Kodenvis |
| Qualidade | [A CONFIRMAR: gerente] | [A CONFIRMAR] |
| Assinatura | | |
