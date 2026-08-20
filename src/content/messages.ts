import type { Locale } from "@/lib/i18n";

/**
 * Localized UI copy. Same shape across all locales (enforced by the `Messages` type).
 * Voice rules in force here:
 *  - No em-dashes anywhere. Use commas, periods, semicolons, or parentheses.
 *  - Concrete over abstract. Numbers, named things, real consequences.
 *  - Vary sentence length. No stacked one-word fragments.
 *  - Skip AI buzzwords (seamless, transformative, leverage, comprehensive, robust, etc.).
 */
export const messages = {
  en: {
    cityLabel: "Lisbon",
    country: "Portugal",
    officeHours: "Mon to Fri, 10:00 to 18:00 WET",

    metaTitle:
      "Alttavia Relocation. NIF and Portuguese bank account, handled by the attorneys other firms hire.",
    metaDescription:
      "Licensed Portuguese attorneys get your NIF with fiscal representation and open your Portuguese bank account remotely. The two prerequisites your D7 or D8 visa cannot skip. 800+ cases completed.",

    navCtaLabel: "Book a free call",
    nav: [
      { href: "#services", label: "Services" },
      { href: "#why", label: "Why us" },
      { href: "#about", label: "About" },
      { href: "#faq", label: "FAQ" },
      { href: "#contact", label: "Contact" },
    ],

    hero: {
      eyebrow: "Licensed attorneys. No agency in between.",
      titleBefore: "The",
      titleHighlight: "law firm",
      titleAfter: " other firms outsource their legal work to.",
      subtitle:
        "Your NIF with fiscal representation and your Portuguese bank account are the two requirements no D7 or D8 visa can skip. Most people hire a relocation agency that hires us anyway. Work with us directly.",
      ctaPrimary: "Get my NIF",
      ctaSecondary: "Open my bank account",
      cardTitle: "Patrícia Viana",
      cardRole: "OA Portugal · OAB Brasil",
      cardDesc:
        "A licensed attorney manages your case from first contact to completion.",
      stats: [
        { number: "800+", label: "cases completed" },
        { number: "100%", label: "attorney-led" },
        { number: "100%", label: "remote" },
      ],
    },

    services: {
      eyebrow: "What we do",
      title: "Two documents. One law firm. No one else in the chain.",
      desc: "A NIF and a Portuguese bank account are the two requirements every D7 and D8 consulate checks before approving your visa. Relocation agencies hire attorneys to handle them for their clients. Now you can hire us directly.",
      items: [
        {
          id: "nif",
          tag: "Required for D7 applicants",
          title: "NIF with fiscal representation",
          subtitle: "Portugal's tax ID. Without it, nothing else moves.",
          body: "The NIF is Portugal's tax identification number. Without it you cannot rent an apartment, open a bank account, or enroll children in school. D7 applicants must also appoint a registered fiscal representative physically based in Portugal, a role reserved by law for licensed attorneys.",
          body2:
            "We issue your NIF remotely and stay on as your registered fiscal representative for as long as your visa requires.",
          bullets: [
            "100% remote, no travel required",
            "Registered fiscal representative included",
            "Required before D7 and D8 consular interviews",
            "Needed for banking, rentals, utilities, and school enrollment",
          ],
          cta: "Get my NIF",
        },
        {
          id: "bank",
          tag: "Required for D7 and Golden Visa",
          title: "Remote bank account for non-residents",
          subtitle: "Proof of funds the consulate will ask for by name.",
          body: "D7 and Golden Visa consulates require funds already deposited in a Portuguese bank account before the interview, not just evidence the money exists elsewhere. Most Portuguese banks decline foreign applications. The few that accept non-residents require a detailed compliance file to proceed.",
          body2:
            "We open your account through our banking partners, build the full KYC compliance file, and follow the process through until your funds are confirmed.",
          bullets: [
            "100% remote, signed electronically",
            "Full KYC and compliance file included",
            "Accepted at D7 and Golden Visa interviews",
            "Pre-screened to minimize rejection risk",
          ],
          cta: "Open my bank account",
        },
      ],
    },

    whyUs: {
      eyebrow: "Why Alttavia Relocation",
      title: "Other relocation firms outsource their legal work to us.",
      intro:
        "When a relocation agency needs a NIF or a bank account for a client, they call a Portuguese attorney. That call frequently reaches us. You can skip the agency, skip the markup, and work with the source directly.",
      items: [
        {
          title: "Attorneys from day one, not account managers",
          desc: "Your NIF, your bank account, and your fiscal representation are handled personally by licensed Portuguese attorneys. No handoff to paralegals. No sales layer between you and the person making decisions. The attorney you meet on day one closes your case.",
        },
        {
          title: "The firm other firms call",
          desc: "When the relocation industry needs legal documents handled for their clients, they outsource to us. With Alttavia, you access that team directly, without the agency markup.",
        },
        {
          title: "800 cases deep in D7 and D8 visas",
          desc: "We know what each consulate expects, how compliance reviewers read KYC files, and where most applications fall apart. Over 800 passive-income and digital-nomad visa cases have moved through this office.",
        },
        {
          title: "Fully remote, with clear updates at every step",
          desc: "Your documents are signed, filed, and tracked without you setting foot in Portugal. You receive a written update at each stage, in plain English, before you need to ask.",
        },
      ],
    },

    about: {
      eyebrow: "Our story",
      title: "Built for clients who were done paying for the middleman.",
      paragraphs: [
        "Alttavia Relocation started with a pattern I kept seeing as a licensed Portuguese attorney. Relocation companies called me to handle the legal work for their clients. Every firm, eventually, needed a lawyer to get the documents done. I was already doing the work. The question was why there needed to be a layer between me and the person who actually needed help.",
        "Our purpose is simple: help people move to Portugal without the legal uncertainty that makes the process feel bigger than it is.",
        "Every case at Alttavia goes through a licensed Portuguese attorney. Your fiscal identity and the funds behind your new life are too important to hand to someone who hands them to someone else.",
      ],
      highlight: {
        name: "Patrícia Viana",
        role: "Founder, OA Portugal & OAB Brasil",
        quote:
          "I want every client to feel the clarity I wish I had had the first time I navigated this myself.",
      },
      stats: [
        { number: "800+", label: "cases completed" },
        { number: "10+", label: "years of practice" },
        { number: "100%", label: "attorney-led" },
      ],
    },

    principles: {
      eyebrow: "How we work",
      title: "Four things we will not outsource.",
      items: [
        {
          quote:
            "Your paperwork moves on a schedule. Every step is documented, acted on, and confirmed to you in writing.",
          attribution: "On speed",
        },
        {
          quote:
            "If we cannot help you, we say so before you pay anything. If we can, you get a written plan of exactly how, before any commitment.",
          attribution: "On honesty",
        },
        {
          quote:
            "You speak directly with your attorney. No coordinator in between, no handoffs, no surprise invoices.",
          attribution: "On direct access",
        },
        {
          quote:
            "Relocating is a decision you live with for years. You get time and space to ask every question, in the language you think best in.",
          attribution: "On patience",
        },
      ],
    },

    faq: {
      eyebrow: "Frequently asked",
      title: "Questions most clients bring to their first call with us.",
      items: [
        {
          q: "Can I get my NIF or open a Portuguese bank account on my own?",
          a: "Technically you can attempt it, but both processes require a licensed Portuguese attorney. The Tax Authority requires your fiscal representative to hold a Portuguese address, a role only an attorney based in Portugal can fill. Most banks decline foreign applications outright. The few that accept non-residents require a compliance file our team builds for you. Attempting either without legal representation typically results in rejection or significant delays.",
        },
        {
          q: "What does it cost?",
          a: "Our pricing is flat and written down before any work begins. No hourly billing, no surprise invoices. After your first call, you will have a written quote, a clear scope, and the name of the attorney on your case. Compare that to the cost of a denied visa or a three-month delay in your move.",
        },
        {
          q: "How long does each process take?",
          a: "NIF issuance takes 3 to 5 business days after we receive your documents. Remote bank account opening takes 2 to 4 weeks, depending on the bank's compliance review and your nationality. We give you a realistic timeline before you commit and update you at every stage.",
        },
        {
          q: "Do I need to travel to Portugal for any of this?",
          a: "No. Both services are fully remote. You sign documents electronically, we file with the authorities, the bank reviews your application from wherever you are. A trip to Lisbon makes sense once your account is live and you want to see your new city.",
        },
        {
          q: "I am applying for a D7 visa. Do I need both services?",
          a: "Yes. The D7 requires a NIF with a registered fiscal representative and a Portuguese bank account with funds already deposited, both required before your consular interview. Missing either one results in a rejected application. We handle both and coordinate the timing between them.",
        },
        {
          q: "What documents do you need from me?",
          a: "Usually your passport, proof of address, proof of income or retirement funds, and a short questionnaire we send after your first call. Exact requirements depend on your nationality and visa type. We confirm everything in writing before any document leaves your inbox.",
        },
        {
          q: "What if the bank rejects my application?",
          a: "It rarely happens, because our compliance team reviews every file before it goes in. When it does, we open your account with a different partner bank at no extra cost. Your process does not stop until your account is active.",
        },
      ],
    },

    ctaBanner: {
      title: "Ready to get this done?",
      desc: "Your first call is free and without obligation. You leave it with a clear timeline, a written quote, and the name of the attorney who will manage your case.",
      button: "Book my free call",
    },

    contact: {
      eyebrow: "Let's talk",
      title: "Tell us where you are in the process.\nWe'll tell you exactly what comes next.",
      desc: "Fill out the form and an attorney replies within one business day. Everything you share is covered by attorney-client privilege.",
      emailLabel: "Email",
      phoneLabel: "Phone or WhatsApp",
      officeLabel: "Office",
      selectPrompt: "Select one",
      messageSent: "Request received",
      formLabels: {
        name: "Full name",
        email: "Email",
        phone: "Phone or WhatsApp",
        country: "Country of residence",
        interest: "I'm interested in",
        message: "Tell us about your move",
        submit: "Send my request",
        disclaimer:
          "By submitting, you accept our privacy policy. We reply within one business day.",
      },
      formPlaceholders: {
        name: "How should we address you?",
        email: "your@email.com",
        phone: "+1 (555) 000 0000",
        country: "United States, Canada, UK, ...",
        message:
          "Where are you in your move? What would make this feel more manageable?",
      },
      interestOptions: [
        "NIF with fiscal representation",
        "Remote bank account",
        "Both",
        "D7 visa guidance",
        "D8 visa guidance",
        "Not sure yet",
      ],
    },

    location: {
      eyebrow: "Come in, or don't",
      title: "Our office is in central Lisbon.",
      desc: "Everything we do is remote. You do not need to cross an ocean to get your documents sorted. If you are already in Lisbon, or plan to be once you have your visa, come by.",
      openMaps: "Open in Google Maps",
    },

    footer: {
      tagline:
        "A Portuguese law firm for people moving to Portugal. NIF with fiscal representation and remote bank accounts for D7, D8, and Golden Visa applicants.",
      officeLabel: "OFFICE",
      getInTouchLabel: "GET IN TOUCH",
      craftedIn: "Crafted with care in Lisbon.",
      columns: [
        {
          title: "Services",
          links: [
            { href: "#services", label: "NIF with fiscal representation" },
            { href: "#services", label: "Remote bank account" },
          ],
        },
        {
          title: "Firm",
          links: [
            { href: "#about", label: "About" },
            { href: "#why", label: "Why Alttavia" },
            { href: "#faq", label: "FAQ" },
            { href: "#contact", label: "Contact" },
          ],
        },
        {
          title: "Legal",
          links: [
            { href: "#", label: "Privacy policy" },
            { href: "#", label: "Terms of service" },
            { href: "#", label: "Cookies" },
            { href: "#", label: "Regulator (OA)" },
          ],
        },
      ],
      copyright: (year: number) =>
        `© ${year} Alttavia Relocation · Viana Consultancy. All rights reserved.`,
    },

    whatsappLabel: "Chat on WhatsApp",
    openMenuLabel: "Open menu",
    closeMenuLabel: "Close menu",
    marquee: {
      items: [
        "800+ cases completed",
        "Licensed Portuguese attorneys",
        "100% remote",
        "NIF with fiscal representation",
        "Remote bank account opening",
        "D7 · D8 · Golden Visa",
        "Zero intermediaries",
        "10+ years of practice",
        "OA Portugal · OAB Brasil",
      ],
    },
  },

  pt: {
    cityLabel: "Lisboa",
    country: "Portugal",
    officeHours: "Seg a sex, 10h às 18h WET",

    metaTitle:
      "Alttavia Relocation. NIF e conta bancária em Portugal com os advogados que outras firmas contratam.",
    metaDescription:
      "Advogados portugueses licenciados emitem o seu NIF com representação fiscal e abrem a sua conta bancária portuguesa de forma remota. Os dois documentos que o visto D7 ou D8 exige. Mais de 800 casos conduzidos.",

    navCtaLabel: "Agendar chamada gratuita",
    nav: [
      { href: "#services", label: "Serviços" },
      { href: "#why", label: "Por que nós" },
      { href: "#about", label: "Sobre" },
      { href: "#faq", label: "FAQ" },
      { href: "#contact", label: "Contato" },
    ],

    hero: {
      eyebrow: "Advogados portugueses. Sem intermediários.",
      titleBefore: "O escritório que",
      titleHighlight: "outras firmas",
      titleAfter: " contratam para fazer o jurídico.",
      subtitle:
        "O NIF com representação fiscal e a conta bancária portuguesa são as duas exigências que nenhum visto D7 ou D8 pode pular. A maioria das pessoas paga uma empresa de relocation que nos contrata de qualquer forma. Trabalhe com a gente diretamente.",
      ctaPrimary: "Solicitar meu NIF",
      ctaSecondary: "Abrir minha conta bancária",
      cardTitle: "Patrícia Viana",
      cardRole: "OA Portugal · OAB Brasil",
      cardDesc:
        "Seu caso é conduzido por uma advogada licenciada, do início ao fim.",
      stats: [
        { number: "800+", label: "casos conduzidos" },
        { number: "100%", label: "advogada à frente" },
        { number: "100%", label: "remoto" },
      ],
    },

    services: {
      eyebrow: "O que fazemos",
      title: "Dois documentos. Um escritório. Ninguém mais na cadeia.",
      desc: "O NIF e a conta bancária portuguesa são as duas exigências que todo consulado verifica antes de aprovar o visto D7 ou D8. Empresas de relocation nos contratam para cuidar disso pelos clientes delas. Agora você pode nos contratar diretamente.",
      items: [
        {
          id: "nif",
          tag: "Obrigatório para candidatos ao D7",
          title: "NIF com representação fiscal",
          subtitle: "O CPF português. Sem ele, nada mais funciona.",
          body: "O NIF é a identificação fiscal portuguesa. Sem ele, você não aluga apartamento, não abre conta, não matricula filhos na escola. Quem aplica para o D7 ainda precisa nomear um representante fiscal com endereço em Portugal, função reservada por lei a advogados.",
          body2:
            "Emitimos o seu NIF de forma remota e seguimos como seu representante fiscal registrado pelo tempo que o visto exigir.",
          bullets: [
            "100% remoto, sem necessidade de viagem",
            "Representante fiscal registrado incluído",
            "Obrigatório antes das entrevistas consulares D7 e D8",
            "Necessário para banco, aluguel, serviços e escolas",
          ],
          cta: "Solicitar meu NIF",
        },
        {
          id: "bank",
          tag: "Obrigatório para D7 e Golden Visa",
          title: "Conta bancária remota para não residentes",
          subtitle: "Prova de fundos que o consulado vai exigir pelo nome.",
          body: "Consulados do D7 e do Golden Visa exigem fundos já depositados em conta bancária portuguesa antes da entrevista, não apenas comprovante de que o dinheiro existe em outro lugar. A maioria dos bancos rejeita candidaturas do exterior. Os poucos que aceitam não residentes precisam de um dossiê de compliance completo.",
          body2:
            "Abrimos a sua conta com nossos bancos parceiros, montamos o dossiê de KYC e acompanhamos o processo até a confirmação dos fundos.",
          bullets: [
            "100% remoto, com assinatura eletrônica",
            "Dossiê completo de KYC e compliance incluído",
            "Aceita nas entrevistas para D7 e Golden Visa",
            "Pré-revisado para minimizar risco de rejeição",
          ],
          cta: "Abrir minha conta bancária",
        },
      ],
    },

    whyUs: {
      eyebrow: "Por que Alttavia Relocation",
      title: "Outras firmas de relocation terceirizam o jurídico para nós.",
      intro:
        "Quando uma empresa de relocation precisa de NIF ou conta bancária para um cliente, ela liga para um advogado português. Essa ligação chega aqui com frequência. Pule a empresa, pule o markup e trabalhe diretamente com a fonte.",
      items: [
        {
          title: "Advogados desde o primeiro dia, não gerentes de conta",
          desc: "Seu NIF, sua conta bancária e sua representação fiscal são conduzidos pessoalmente por advogados portugueses licenciados. Sem repasse para estagiários. Sem camada comercial entre você e quem toma decisões. A advogada que você conhece no início é quem fecha o seu caso.",
        },
        {
          title: "O escritório que as outras firmas chamam",
          desc: "Quando o setor de relocation precisa de trabalho jurídico para os próprios clientes, terceiriza para nós. Com a Alttavia, você acessa essa equipe diretamente, sem o markup da agência.",
        },
        {
          title: "800 casos de D7 e D8 na conta",
          desc: "Sabemos o que cada consulado espera, como revisores de compliance leem dossiês de KYC e em que ponto a maioria dos processos trava. Mais de 800 casos de visto de renda passiva e nômade digital passaram por este escritório.",
        },
        {
          title: "100% remoto, com atualizações claras em cada etapa",
          desc: "Seus documentos são assinados, protocolados e acompanhados sem você precisar pisar em Portugal. Você recebe uma atualização escrita a cada etapa, em linguagem direta, antes de precisar perguntar.",
        },
      ],
    },

    about: {
      eyebrow: "Nossa história",
      title: "Criado para quem estava cansado de pagar pelo intermediário.",
      paragraphs: [
        "A Alttavia Relocation começou com um padrão que eu continuava vendo como advogada portuguesa licenciada. Empresas de relocation ligavam para mim para cuidar do jurídico dos clientes delas. Toda firma, na hora certa, precisava de uma advogada para fazer os documentos. Eu já fazia o trabalho. A questão era por que precisava existir uma camada entre mim e a pessoa que realmente precisava de ajuda.",
        "Nosso propósito é direto: ajudar pessoas a se mudar para Portugal sem a incerteza jurídica que faz o processo parecer maior do que é.",
        "Todo caso na Alttavia passa por uma advogada portuguesa licenciada. Sua identidade fiscal e o dinheiro por trás da sua nova vida são importantes demais para entregar a alguém que vai repassar para outro.",
      ],
      highlight: {
        name: "Patrícia Viana",
        role: "Fundadora, OA Portugal & OAB Brasil",
        quote:
          "Quero que cada cliente sinta a clareza que eu queria ter tido na primeira vez em que precisei navegar por isso sozinha.",
      },
      stats: [
        { number: "800+", label: "casos conduzidos" },
        { number: "10+", label: "anos de prática" },
        { number: "100%", label: "advogada à frente" },
      ],
    },

    principles: {
      eyebrow: "Como trabalhamos",
      title: "Quatro coisas que não terceirizamos.",
      items: [
        {
          quote:
            "A burocracia tem prazo. Cada etapa é documentada, executada e confirmada para você por escrito.",
          attribution: "Sobre celeridade",
        },
        {
          quote:
            "Se não podemos ajudar, dizemos antes de você pagar qualquer coisa. Se podemos, você recebe um plano escrito de exatamente como, antes de qualquer compromisso.",
          attribution: "Sobre honestidade",
        },
        {
          quote:
            "Você fala diretamente com sua advogada. Sem coordenador no meio, sem repasses, sem fatura surpresa.",
          attribution: "Sobre acesso direto",
        },
        {
          quote:
            "Mudar de país é uma decisão que você vive por anos. Você tem tempo e espaço para fazer cada pergunta, no idioma em que pensa melhor.",
          attribution: "Sobre empatia",
        },
      ],
    },

    faq: {
      eyebrow: "Perguntas frequentes",
      title: "As dúvidas que a maioria traz na primeira conversa com a gente.",
      items: [
        {
          q: "Posso obter o NIF ou abrir uma conta portuguesa por conta própria?",
          a: "Tecnicamente é possível tentar, mas os dois processos exigem uma advogada portuguesa licenciada. A Autoridade Tributária exige que o seu representante fiscal tenha endereço em Portugal, função que só um advogado sediado aqui pode exercer. A maioria dos bancos rejeita candidaturas diretas do exterior. Os poucos que aceitam não residentes precisam de um dossiê de compliance que nossa equipe monta por você. Tentar sem representação jurídica geralmente resulta em rejeição ou atraso significativo.",
        },
        {
          q: "Quanto custa?",
          a: "Nosso preço é fixo e está por escrito antes de qualquer trabalho começar. Sem cobrança por hora, sem fatura surpresa. Depois da primeira conversa, você terá uma proposta escrita, escopo claro e o nome da advogada no seu caso. Compare isso ao custo de um visto negado ou três meses de atraso na sua mudança.",
        },
        {
          q: "Quanto tempo cada processo leva?",
          a: "Emissão do NIF: 3 a 5 dias úteis depois de receber a documentação. Abertura de conta bancária remota: 2 a 4 semanas, dependendo do compliance do banco e da sua nacionalidade. Comunicamos prazos realistas antes de você se comprometer e atualizamos a cada etapa.",
        },
        {
          q: "Preciso viajar para Portugal em algum momento?",
          a: "Não. Os dois serviços são totalmente remotos. Você assina os documentos eletronicamente, nós protocolamos junto às autoridades, o banco avalia a candidatura de onde você estiver. Uma visita a Lisboa faz sentido quando a sua conta já estiver ativa e você quiser conhecer a sua nova cidade.",
        },
        {
          q: "Vou aplicar para o visto D7. Preciso dos dois serviços?",
          a: "Sim. O D7 exige NIF com representante fiscal registrado e conta bancária portuguesa com fundos depositados, ambos antes da entrevista consular. A falta de qualquer um deles resulta em candidatura rejeitada. Cuidamos dos dois e coordenamos o timing entre eles.",
        },
        {
          q: "Quais documentos vou precisar?",
          a: "Em geral: passaporte, comprovante de residência, comprovante de renda ou aposentadoria e um questionário curto que enviamos depois da primeira conversa. As exigências exatas dependem da sua nacionalidade e do tipo de visto. Confirmamos tudo por escrito antes de qualquer documento sair da sua caixa.",
        },
        {
          q: "E se o banco rejeitar minha candidatura?",
          a: "É raro, porque nossa equipe de compliance revisa cada dossiê antes de submetê-lo. Se acontecer, abrimos a sua conta em outro banco parceiro sem custo extra. O seu processo não para até a conta estar ativa.",
        },
      ],
    },

    ctaBanner: {
      title: "Pronto para resolver isso?",
      desc: "A primeira conversa é gratuita e sem compromisso. Você sai dela com um cronograma claro, proposta por escrito e o nome da advogada que vai cuidar do seu caso.",
      button: "Agendar minha chamada gratuita",
    },

    contact: {
      eyebrow: "Vamos conversar",
      title: "Conte onde você está no processo.\nA gente te diz exatamente o que vem depois.",
      desc: "Preencha o formulário e uma advogada responde em até um dia útil. Tudo o que você compartilhar fica protegido pelo sigilo profissional.",
      emailLabel: "E-mail",
      phoneLabel: "Telefone ou WhatsApp",
      officeLabel: "Escritório",
      selectPrompt: "Escolha uma opção",
      messageSent: "Solicitação recebida",
      formLabels: {
        name: "Nome completo",
        email: "E-mail",
        phone: "Telefone ou WhatsApp",
        country: "País de residência",
        interest: "Tenho interesse em",
        message: "Conte sobre a sua mudança",
        submit: "Enviar minha solicitação",
        disclaimer:
          "Ao enviar, você concorda com nossa política de privacidade. Respondemos em até um dia útil.",
      },
      formPlaceholders: {
        name: "Como podemos chamar você?",
        email: "seu@email.com",
        phone: "+55 (11) 99999 9999",
        country: "Brasil, Estados Unidos, Reino Unido, ...",
        message:
          "Em que ponto da mudança você está? O que tornaria esse processo mais tranquilo?",
      },
      interestOptions: [
        "NIF com representação fiscal",
        "Conta bancária remota",
        "Os dois",
        "Orientação sobre visto D7",
        "Orientação sobre visto D8",
        "Ainda estou decidindo",
      ],
    },

    location: {
      eyebrow: "Venha visitar, ou não",
      title: "Nosso escritório fica no coração de Lisboa.",
      desc: "Tudo o que fazemos é remoto. Você não precisa atravessar o oceano para a documentação ficar pronta. Se já está em Lisboa, ou vai estar assim que pegar as chaves, é só passar.",
      openMaps: "Abrir no Google Maps",
    },

    footer: {
      tagline:
        "Escritório de advocacia português para quem se muda para Portugal. NIF com representação fiscal e conta bancária remota para candidatos ao D7, D8 e Golden Visa.",
      officeLabel: "ESCRITÓRIO",
      getInTouchLabel: "FALE CONOSCO",
      craftedIn: "Feito com cuidado em Lisboa.",
      columns: [
        {
          title: "Serviços",
          links: [
            { href: "#services", label: "NIF com representação fiscal" },
            { href: "#services", label: "Conta bancária remota" },
          ],
        },
        {
          title: "Escritório",
          links: [
            { href: "#about", label: "Sobre" },
            { href: "#why", label: "Por que Alttavia" },
            { href: "#faq", label: "FAQ" },
            { href: "#contact", label: "Contato" },
          ],
        },
        {
          title: "Legal",
          links: [
            { href: "#", label: "Política de privacidade" },
            { href: "#", label: "Termos de uso" },
            { href: "#", label: "Cookies" },
            { href: "#", label: "Ordem dos Advogados" },
          ],
        },
      ],
      copyright: (year: number) =>
        `© ${year} Alttavia Relocation · Viana Consultancy. Todos os direitos reservados.`,
    },

    whatsappLabel: "Falar no WhatsApp",
    openMenuLabel: "Abrir menu",
    closeMenuLabel: "Fechar menu",
    marquee: {
      items: [
        "800+ casos conduzidos",
        "Advogados portugueses licenciados",
        "100% remoto",
        "NIF com representação fiscal",
        "Abertura de conta bancária remota",
        "D7 · D8 · Golden Visa",
        "Zero intermediários",
        "10+ anos de prática",
        "OA Portugal · OAB Brasil",
      ],
    },
  },

  es: {
    cityLabel: "Lisboa",
    country: "Portugal",
    officeHours: "Lun a vie, 10:00 a 18:00 WET",

    metaTitle:
      "Alttavia Relocation. NIF y cuenta bancaria portuguesa con los abogados que otras firmas contratan.",
    metaDescription:
      "Abogados portugueses licenciados emiten tu NIF con representación fiscal y abren tu cuenta bancaria portuguesa de forma remota. Los dos requisitos que tu visado D7 o D8 no puede saltarse. Más de 800 casos gestionados.",

    navCtaLabel: "Agendar llamada gratuita",
    nav: [
      { href: "#services", label: "Servicios" },
      { href: "#why", label: "Por qué nosotros" },
      { href: "#about", label: "Nosotros" },
      { href: "#faq", label: "FAQ" },
      { href: "#contact", label: "Contacto" },
    ],

    hero: {
      eyebrow: "Abogados portugueses. Sin intermediarios.",
      titleBefore: "El bufete que",
      titleHighlight: "otras firmas",
      titleAfter: " contratan para el trabajo jurídico.",
      subtitle:
        "Tu NIF con representación fiscal y tu cuenta bancaria portuguesa son los dos requisitos que ningún visado D7 o D8 puede omitir. La mayoría paga una agencia de relocation que nos contrata de todas formas. Trabaja directamente con nosotros.",
      ctaPrimary: "Solicitar mi NIF",
      ctaSecondary: "Abrir mi cuenta bancaria",
      cardTitle: "Patrícia Viana",
      cardRole: "OA Portugal · OAB Brasil",
      cardDesc:
        "Una abogada licenciada gestiona tu caso de principio a fin.",
      stats: [
        { number: "800+", label: "casos gestionados" },
        { number: "100%", label: "con abogada al frente" },
        { number: "100%", label: "remoto" },
      ],
    },

    services: {
      eyebrow: "Qué hacemos",
      title: "Dos documentos. Un bufete. Nadie más en la cadena.",
      desc: "El NIF y la cuenta bancaria portuguesa son los dos requisitos que todo consulado verifica antes de aprobar el visado D7 o D8. Las agencias de relocation nos contratan para gestionarlos por sus clientes. Ahora puedes contratarnos directamente.",
      items: [
        {
          id: "nif",
          tag: "Obligatorio para solicitantes del D7",
          title: "NIF con representación fiscal",
          subtitle: "El número fiscal portugués. Sin él, nada más avanza.",
          body: "El NIF es el número de identificación fiscal de Portugal. Sin él no puedes alquilar un apartamento, abrir una cuenta bancaria ni matricular a tus hijos en el colegio. Quien solicita el D7 también debe nombrar un representante fiscal con domicilio en Portugal, función reservada por ley a abogados.",
          body2:
            "Emitimos tu NIF de forma remota y seguimos como tu representante fiscal registrado durante el tiempo que requiera tu visado.",
          bullets: [
            "100% remoto, sin necesidad de viajar",
            "Representante fiscal registrado incluido",
            "Obligatorio antes de las entrevistas consulares D7 y D8",
            "Necesario para banco, alquileres, servicios y colegios",
          ],
          cta: "Solicitar mi NIF",
        },
        {
          id: "bank",
          tag: "Obligatorio para D7 y Golden Visa",
          title: "Cuenta bancaria remota para no residentes",
          subtitle: "Una prueba de fondos que el consulado pedirá por nombre.",
          body: "Los consulados del D7 y del Golden Visa exigen fondos ya depositados en una cuenta bancaria portuguesa antes de la entrevista, no solo un comprobante de que el dinero existe en otro lugar. La mayoría de los bancos portugueses rechaza solicitudes del exterior. Los pocos que aceptan no residentes requieren un dosier de compliance completo.",
          body2:
            "Abrimos tu cuenta con nuestros bancos asociados, preparamos el dosier KYC completo y seguimos el proceso hasta que tus fondos estén confirmados.",
          bullets: [
            "100% remoto, firmado electrónicamente",
            "Dosier completo de KYC y compliance incluido",
            "Aceptado en entrevistas para D7 y Golden Visa",
            "Pre-revisado para minimizar el riesgo de rechazo",
          ],
          cta: "Abrir mi cuenta bancaria",
        },
      ],
    },

    whyUs: {
      eyebrow: "Por qué Alttavia Relocation",
      title: "Otras firmas de relocation nos subcontratan el trabajo jurídico.",
      intro:
        "Cuando una agencia de relocation necesita un NIF o una cuenta bancaria para un cliente, llama a un abogado portugués. Esa llamada termina aquí con frecuencia. Sáltate la agencia, sáltate el markup y trabaja directamente con la fuente.",
      items: [
        {
          title: "Abogados desde el primer día, no gestores de cuenta",
          desc: "Tu NIF, tu cuenta bancaria y tu representación fiscal los gestiona personalmente un abogado portugués licenciado. Sin traspasos a pasantes. Sin capa comercial entre tú y quien toma las decisiones. La abogada que conoces el primer día cierra tu caso.",
        },
        {
          title: "El bufete al que llaman las otras firmas",
          desc: "Cuando el sector de relocation necesita trabajo jurídico para sus clientes, nos lo subcontrata. Con Alttavia, accedes a ese equipo directamente, sin el markup de la agencia.",
        },
        {
          title: "800 casos de visados D7 y D8 en el bagaje",
          desc: "Sabemos qué espera cada consulado, cómo leen los revisores de compliance un dosier KYC y en qué punto falla la mayoría de las solicitudes. Más de 800 casos de visados de ingresos pasivos y nómadas digitales han pasado por este bufete.",
        },
        {
          title: "Totalmente remoto, con actualizaciones claras en cada paso",
          desc: "Tus documentos se firman, se presentan y se siguen sin que pongas un pie en Portugal. Recibes una actualización escrita en cada etapa, en lenguaje directo, antes de que necesites preguntar.",
        },
      ],
    },

    about: {
      eyebrow: "Nuestra historia",
      title: "Creada para quienes estaban hartos de pagar al intermediario.",
      paragraphs: [
        "Alttavia Relocation nació de un patrón que seguía viendo como abogada portuguesa licenciada. Las firmas de relocation me llamaban para gestionar el trabajo jurídico de sus clientes. Toda firma, llegado el momento, necesitaba una abogada para tramitar los documentos. Yo ya hacía el trabajo. La pregunta era por qué tenía que existir una capa entre yo y la persona que realmente necesitaba ayuda.",
        "Nuestro propósito es directo: ayudar a las personas a mudarse a Portugal sin la incertidumbre jurídica que hace que el proceso parezca más grande de lo que es.",
        "Todos los casos de Alttavia pasan por una abogada portuguesa licenciada. Tu identidad fiscal y los fondos de tu nueva vida son demasiado importantes para entregarlos a alguien que los va a redelegar.",
      ],
      highlight: {
        name: "Patrícia Viana",
        role: "Fundadora, OA Portugal & OAB Brasil",
        quote:
          "Quiero que cada cliente sienta la claridad que me habría gustado tener la primera vez que tuve que navegar esto.",
      },
      stats: [
        { number: "800+", label: "casos gestionados" },
        { number: "10+", label: "años de práctica" },
        { number: "100%", label: "con abogada al frente" },
      ],
    },

    principles: {
      eyebrow: "Cómo trabajamos",
      title: "Cuatro cosas que no subcontratamos.",
      items: [
        {
          quote:
            "Tu papeleo avanza según un calendario. Cada paso se documenta, se ejecuta y se confirma por escrito.",
          attribution: "Sobre celeridad",
        },
        {
          quote:
            "Si no podemos ayudarte, lo decimos antes de que pagues nada. Si podemos, recibes un plan escrito de exactamente cómo, antes de cualquier compromiso.",
          attribution: "Sobre honestidad",
        },
        {
          quote:
            "Hablas directamente con tu abogada. Sin coordinador en medio, sin traspasos, sin facturas sorpresa.",
          attribution: "Sobre acceso directo",
        },
        {
          quote:
            "Mudarse de país es una decisión con la que convives durante años. Tienes tiempo y espacio para hacer cada pregunta, en el idioma en que mejor piensas.",
          attribution: "Sobre empatía",
        },
      ],
    },

    faq: {
      eyebrow: "Preguntas frecuentes",
      title: "Las dudas que la mayoría trae a la primera llamada con nosotros.",
      items: [
        {
          q: "¿Puedo obtener el NIF o abrir una cuenta bancaria portuguesa por mi cuenta?",
          a: "Técnicamente puedes intentarlo, pero ambos procesos requieren una abogada portuguesa licenciada. La Autoridad Tributaria exige que tu representante fiscal tenga domicilio en Portugal, función que solo puede ejercer un abogado radicado aquí. La mayoría de los bancos rechaza solicitudes directas del exterior. Los pocos que aceptan no residentes requieren un dosier de compliance que nuestro equipo prepara por ti. Intentarlo sin representación jurídica suele resultar en rechazo o retrasos significativos.",
        },
        {
          q: "¿Cuánto cuesta?",
          a: "Nuestro precio es cerrado y está por escrito antes de empezar cualquier trabajo. Sin facturación por horas, sin facturas sorpresa. Después de la primera llamada tendrás una propuesta escrita, un alcance claro y el nombre de la abogada asignada a tu caso. Compara eso con el coste de un visado denegado o tres meses de retraso en tu mudanza.",
        },
        {
          q: "¿Cuánto tarda cada proceso?",
          a: "Emisión del NIF: 3 a 5 días laborables tras recibir la documentación. Apertura de cuenta bancaria remota: 2 a 4 semanas, según el análisis de compliance del banco y tu nacionalidad. Comunicamos plazos realistas antes de que te comprometas y actualizamos en cada etapa.",
        },
        {
          q: "¿Tengo que viajar a Portugal en algún momento?",
          a: "No. Ambos servicios son totalmente remotos. Firmas los documentos electrónicamente, nosotros los presentamos ante las autoridades, el banco tramita tu solicitud desde donde estés. Un viaje a Lisboa tiene sentido cuando tu cuenta ya esté activa y quieras conocer tu nueva ciudad.",
        },
        {
          q: "Voy a solicitar el visado D7. ¿Necesito los dos servicios?",
          a: "Sí. El D7 exige un NIF con representante fiscal registrado y una cuenta bancaria portuguesa con fondos depositados, ambos antes de la entrevista consular. La falta de cualquiera de los dos resulta en una solicitud rechazada. Los gestionamos ambos y coordinamos el timing entre ellos.",
        },
        {
          q: "¿Qué documentos necesitáis de mi parte?",
          a: "Normalmente: pasaporte, comprobante de domicilio, comprobante de ingresos o pensión y un cuestionario breve que enviamos tras la primera llamada. Los requisitos exactos dependen de tu nacionalidad y del tipo de visado. Lo confirmamos todo por escrito antes de que nada salga de tu bandeja de entrada.",
        },
        {
          q: "¿Qué pasa si el banco rechaza mi solicitud?",
          a: "Es poco frecuente, porque nuestro equipo de compliance revisa cada dosier antes de presentarlo. Cuando ocurre, abrimos tu cuenta en un banco asociado diferente sin coste adicional. Tu proceso no se detiene hasta que la cuenta esté activa.",
        },
      ],
    },

    ctaBanner: {
      title: "¿Listo para resolver esto?",
      desc: "La primera llamada es gratuita y sin compromiso. Saldrás con un calendario claro, una propuesta por escrito y el nombre de la abogada que gestionará tu caso.",
      button: "Agendar mi llamada gratuita",
    },

    contact: {
      eyebrow: "Hablemos",
      title: "Cuéntanos dónde estás en el proceso.\nTe diremos exactamente qué viene después.",
      desc: "Rellena el formulario y una abogada responde en un día laborable. Todo lo que compartas está protegido por el secreto profesional.",
      emailLabel: "Email",
      phoneLabel: "Teléfono o WhatsApp",
      officeLabel: "Oficina",
      selectPrompt: "Elige una opción",
      messageSent: "Solicitud recibida",
      formLabels: {
        name: "Nombre completo",
        email: "Email",
        phone: "Teléfono o WhatsApp",
        country: "País de residencia",
        interest: "Me interesa",
        message: "Cuéntanos sobre tu mudanza",
        submit: "Enviar mi solicitud",
        disclaimer:
          "Al enviar, aceptas nuestra política de privacidad. Respondemos en un día laborable.",
      },
      formPlaceholders: {
        name: "¿Cómo podemos llamarte?",
        email: "tu@email.com",
        phone: "+34 600 000 000",
        country: "España, México, Argentina, ...",
        message:
          "¿En qué punto de la mudanza estás? ¿Qué haría que este proceso se sintiera más manejable?",
      },
      interestOptions: [
        "NIF con representación fiscal",
        "Cuenta bancaria remota",
        "Los dos",
        "Orientación sobre visado D7",
        "Orientación sobre visado D8",
        "Todavía estoy decidiendo",
      ],
    },

    location: {
      eyebrow: "Ven a vernos, o no",
      title: "Nuestra oficina está en el centro de Lisboa.",
      desc: "Todo lo que hacemos es remoto. No hace falta cruzar un océano para tener tu documentación lista. Si ya estás en Lisboa, o lo estarás cuando recibas las llaves, pásate.",
      openMaps: "Abrir en Google Maps",
    },

    footer: {
      tagline:
        "Un bufete portugués para quienes se mudan a Portugal. NIF con representación fiscal y cuentas bancarias remotas para solicitantes de D7, D8 y Golden Visa.",
      officeLabel: "OFICINA",
      getInTouchLabel: "CONTACTO",
      craftedIn: "Hecho con cuidado en Lisboa.",
      columns: [
        {
          title: "Servicios",
          links: [
            { href: "#services", label: "NIF con representación fiscal" },
            { href: "#services", label: "Cuenta bancaria remota" },
          ],
        },
        {
          title: "Bufete",
          links: [
            { href: "#about", label: "Nosotros" },
            { href: "#why", label: "Por qué Alttavia" },
            { href: "#faq", label: "FAQ" },
            { href: "#contact", label: "Contacto" },
          ],
        },
        {
          title: "Legal",
          links: [
            { href: "#", label: "Política de privacidad" },
            { href: "#", label: "Términos de uso" },
            { href: "#", label: "Cookies" },
            { href: "#", label: "Colegio de Abogados (OA)" },
          ],
        },
      ],
      copyright: (year: number) =>
        `© ${year} Alttavia Relocation · Viana Consultancy. Todos los derechos reservados.`,
    },

    whatsappLabel: "Hablar por WhatsApp",
    openMenuLabel: "Abrir menú",
    closeMenuLabel: "Cerrar menú",
    marquee: {
      items: [
        "800+ casos gestionados",
        "Abogados portugueses licenciados",
        "100% remoto",
        "NIF con representación fiscal",
        "Apertura de cuenta bancaria remota",
        "D7 · D8 · Golden Visa",
        "Sin intermediarios",
        "10+ años de práctica",
        "OA Portugal · OAB Brasil",
      ],
    },
  },
} as const;

export type Messages = (typeof messages)[Locale];
