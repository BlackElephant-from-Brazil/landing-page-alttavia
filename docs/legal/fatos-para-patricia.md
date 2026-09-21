# Textos legais da plataforma: fatos para a sua revisão

**Prazo para aprovar: quinta-feira, 24 de setembro de 2026, às 12:00 (Lisboa).**

Este documento não é aconselhamento jurídico nosso. É um levantamento factual, feito a partir do código em 21 de setembro, para a sua revisão como advogada.

**O que revisar** (nada está publicado ainda):

1. `privacy-proposal.md`: aviso de privacidade em inglês para `/en/privacy`. Hoje o link "Privacy" do rodapé leva à política geral do site principal, que não fala desta plataforma.
2. `service-terms-changes.md`: as frases de `/en/service-terms` que deixaram de ser verdade, com a troca proposta, e 10 perguntas sobre a relação da página com o contrato e o Anexo I.

Nos dois, **[TO CONFIRM]** marca suposições e **PROPOSAL** marca valores que só você decide.

## Os dados, onde ficam e quem trata

| Dado | Quando | Onde fica | Quem trata |
|---|---|---|---|
| Respostas do formulário: país do comprovante de morada, número de adultos, se há filhos que precisam de NIF (só sim ou não), quem já tem NIF, conta desejada, país de cada passaporte, tipo de visto | Em `/en/apply`; só no navegador até a conta ser criada | Supabase, Londres (Reino Unido) | Supabase |
| Primeiro nome e email; IP e navegador de cada sessão | Criação da conta, com código por email | Supabase, Londres | Supabase; os códigos saem pela Resend |
| Pagamento: valor, data, referências da Stripe. O cartão nunca passa por nós | No checkout | Stripe [TO CONFIRM: Irlanda] e Supabase | Stripe |
| Documentos: passaporte, comprovante de morada, número fiscal do país de origem, extratos ou declaração anual de rendimentos, comprovante de profissão, NIF (só conta bancária), procurações assinadas | Depois do pagamento, na área do cliente | Cloudflare R2, jurisdição UE | Cloudflare |
| Dados para procurações e contrato: nome, "nascido" ou "nascida", local e data de nascimento, passaporte, entidade emissora, datas, morada fiscal, cidade de assinatura | Depois do pagamento | Supabase (e cópia dos valores impressos junto ao contrato) | Supabase |
| Contrato em PDF, com esses dados | Quando o cliente confirma os dados | R2 (todas as versões) e anexo no email | Cloudflare, Resend |
| Entregas: NIF, acesso ao Portal das Finanças, IBAN, relatório final | Ao longo do serviço | R2 e Supabase | Cloudflare |
| Emails ao cliente e avisos à equipe (com o email do cliente e o serviço) | Em cada etapa | Resend [TO CONFIRM: região] | Resend |
| Site, código de servidor e registros técnicos | Sempre | Netlify [TO CONFIRM: região das funções; o padrão é EUA] | Netlify |

**Quem acessa.** O cliente vê só os próprios pedidos (regra no banco de dados). A administração tem 1 conta hoje (info@alttavia-relocation.com), que vê tudo e baixa os arquivos. O desenvolvedor (guyshore.com) tem acesso técnico a Supabase, R2, Resend e Netlify; o projeto Supabase está na organização da guyshore.com. O rascunho do contrato de subcontratação (artigo 28.º do RGPD) está previsto para quarta, 23. Finanças e o banco recebem os dados do serviço.

**O que não existe hoje.**
- Nenhuma exclusão automática. O sistema não apaga documentos de clientes; qualquer exclusão é manual, feita por nós. Nesta rodada entra só a remoção de um arquivo entregue ao cliente por engano.
- Arquivos recusados e versões antigas do contrato continuam guardados.
- Uma conta com pedidos não pode ser apagada, só anonimizada à mão.
- Nenhum cookie de análise ou publicidade: só o cookie de sessão. As fontes são servidas pelo próprio site. O Google Tag Manager existe no código, mas está desligado.
- As entregas também ficam sem prazo de exclusão, inclusive o arquivo "Finanças access" (o acesso do cliente ao Portal das Finanças).
- Quem compra pela primeira vez (formulário e depois o botão Pay) não vê link para os termos. Só a compra pela aba Services mostra "By purchasing you accept the Terms". A aceitação no Pay está prevista para quarta, 23.

## Decisões que só você pode tomar

1. **Prazos de conservação.** A proposta no texto: quem nunca pagou, 12 meses; documentos, dados das procurações e entregas, fim do serviço mais N meses (por exemplo 12, o período da representação fiscal); contrato e registros de pagamento, 10 anos. Todos a decidir.
2. **Lei 83/2017 (branqueamento de capitais).** Aplica-se ao serviço de abertura de conta? Se sim, ela fixa um prazo próprio para guardar os documentos de identificação.
3. **Morada do responsável pelo tratamento.** Os modelos de contrato e o formulário de livre resolução dizem Av. Elias Garcia, 123-A, 1050-098. O timbre e as procurações dizem Av. António Augusto Aguiar, 24, 1050-016. Qual vale?
4. **Consumidor: Livro de Reclamações Eletrónico.** Se a Alttavia vende a consumidores, o site precisa do link?
5. **Consumidor: entidade RAL.** Qual entidade de resolução alternativa de litígios indicar no site e nos termos?
6. **Consumidor: livre resolução de 14 dias.** O Anexo I já trata do assunto, mas a página de termos hoje diz outra coisa (troca proposta no arquivo 2, item 1.6). A regra 4 da casa (nenhuma promessa de devolver pagamentos) esbarra na Parte B do Anexo I, que descreve a devolução exigida por lei. A proposta remete ao Anexo I em vez de repetir o texto na página. Serve?
7. **Anexo I, Parte A.** Deve ser assinada antes de o trabalho começar, mas hoje o PDF sai sem assinatura e nada é registrado. Como o cliente faz o pedido de início imediato?
8. **Contrato antes do pagamento.** Hoje o cliente paga e só depois vê o contrato. Deixamos os modelos em branco visíveis na página de termos?
9. **Transferências e encarregado.** Você aceita fornecedores com sede nos EUA, com as garantias de cada um [TO CONFIRM]? A Alttavia precisa nomear um encarregado de proteção de dados?
10. **Entrega por email.** A Cláusula Quinta, n.º 6, dá o serviço por cumprido na entrega por email do NIF e das credenciais. A plataforma entrega na área do cliente e manda um email com link. Basta?

Respostas até **quinta, 24, às 12:00**. Se preferir, levamos as dúvidas para a sessão de terça, 22, às 09:00.
