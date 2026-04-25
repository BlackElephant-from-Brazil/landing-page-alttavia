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
      "Alttavia Relocation. NIF and Portuguese bank account, handled by licensed lawyers.",
    metaDescription:
      "Licensed Portuguese lawyers issue your NIF with fiscal representation and open your Portuguese bank account remotely. Two documents your D7 or D8 visa needs. 800+ cases handled.",

    navCtaLabel: "Book a free call",
    nav: [
      { href: "#versus", label: "The difference" },
      { href: "#services", label: "Services" },
      { href: "#process", label: "Process" },
      { href: "#founder", label: "Founder" },
      { href: "#faq", label: "FAQ" },
      { href: "#contact", label: "Contact" },
    ],

    statusBadge: {
      live: "Accepting cases",
      label: "April 2026 intake open",
    },

    hero: {
      issueLabel: "Issue 02",
      issueDate: "Lisbon",
      eyebrow: "A relocation file by Alttavia",
      kicker: "The lawyer is the one signing.",
      titlePre: "Move to Portugal",
      titleEm: "the way",
      titleEm2: "the lawyers",
      titlePost: "do.",
      lede: "NIF and Portuguese bank account, signed by a Lisbon attorney. The same firm other relocation companies hire. No middleman.",
      ctaPrimary: "Book a free call",
      ctaSecondary: "See how it works",
      photoCaption: "Patrícia Viana, OA Portugal · OAB Brasil",
      floatingChips: [
        { label: "OA Portugal · 1148L" },
        { label: "Files signed by counsel" },
        { label: "Lisbon, by hand" },
      ],
      heroStat: {
        number: "800+",
        label: "files closed since 2017",
      },
    },

    trustMarquee: {
      label: "Clients arriving from",
      cities: [
        "New York",
        "Miami",
        "Los Angeles",
        "Houston",
        "Chicago",
        "Toronto",
        "London",
        "Madrid",
        "São Paulo",
        "Rio",
        "Mexico City",
        "Dubai",
        "Singapore",
      ],
    },

    visaMarquee: {
      types: [
        "D7 passive income",
        "D8 digital nomad",
        "Golden Visa",
        "Family reunification",
        "Tech visa",
        "Student visa",
        "Retiree visa",
      ],
    },

    versus: {
      eyebrow: "The difference",
      title: "Two ways to apply for a Portuguese visa.",
      lede: "Most relocation firms outsource the legal work. We are the legal work. Here is what changes when the lawyer answers the phone.",
      headerLeft: "Most relocation firms",
      headerRight: "Alttavia",
      rows: [
        {
          left: "Sales rep on the call. Lawyer enters at the end, briefly.",
          right: "Licensed attorney handles your file from intake to filing.",
        },
        {
          left: "Fiscal representation outsourced to a third party for a markup.",
          right: "Fiscal representation issued and held by us, no markup, no middlemen.",
        },
        {
          left: "Bank account opened through a generic referral. KYC built ad hoc.",
          right: "Bank file pre-screened against compliance before submission.",
        },
        {
          left: "Generic email replies, mixed signals between teams.",
          right: "One named lawyer. One thread. Decisions in writing.",
        },
        {
          left: "Pricing depends on bundle, upsells, conversions.",
          right: "Flat fee, on paper, before any work begins.",
        },
      ],
    },

    services: {
      eyebrow: "What we do",
      title: "Two documents. One firm. Zero intermediaries.",
      lede: "These are the only two files we handle, because they are the two that decide D7 and D8 outcomes. Both are remote. Both are signed by a licensed lawyer.",
      bento: {
        nifTag: "Required for D7 from day one",
        nifNumber: "01",
        nifTitle: "NIF with fiscal representation",
        nifDesc:
          "Your Portuguese tax ID, plus a registered fiscal representative inside Portugal. Without these, you cannot rent, bank, enroll children, or schedule a consular interview.",
        nifBullets: [
          "Registered fiscal representative",
          "Issued in 3 to 5 business days",
          "100% remote, signed digitally",
        ],
        nifCta: "Request my NIF",
        bankTag: "Required for D7 and Golden Visa",
        bankNumber: "02",
        bankTitle: "Remote Portuguese bank account",
        bankDesc:
          "Your proof-of-funds account, opened with a partner Portuguese bank. We build the KYC file, run pre-screening, and follow the wire until it lands.",
        bankBullets: [
          "Partner banks accustomed to non-residents",
          "Pre-screened compliance dossier",
          "Funds received before consular interview",
        ],
        bankCta: "Open my account",
        sideOne: {
          tag: "Bonus",
          title: "Consular timing review",
          desc: "We map your timeline against the consulate that will hear your case so the dates line up.",
        },
        sideTwo: {
          tag: "Bonus",
          title: "Compliance second look",
          desc: "Before any document leaves your inbox, a second lawyer reviews the file end to end.",
        },
      },
    },

    process: {
      eyebrow: "How it runs",
      title: "Four steps from your kitchen table to a Lisbon postbox.",
      lede: "Every Alttavia file moves through the same four-step path. You always know which step you are on, which lawyer holds it, and what is missing.",
      steps: [
        {
          n: "01",
          title: "Brief",
          duration: "Day 1",
          desc: "A free call with the attorney who would handle your file. We read your case, name the documents you need, and send a flat-fee proposal in writing.",
        },
        {
          n: "02",
          title: "File",
          duration: "Day 2 to 5",
          desc: "Power of attorney signed digitally. We issue your NIF, register your fiscal representation, and open the KYC dossier with a partner bank.",
        },
        {
          n: "03",
          title: "Submit",
          duration: "Week 2 to 4",
          desc: "Bank submission, compliance back-and-forth, follow-up until your account is live. NIF certificate in your inbox. Consular dates aligned.",
        },
        {
          n: "04",
          title: "Live",
          duration: "Week 4+",
          desc: "Funds wired and confirmed. Documents bundled for your visa interview. We stay on as your fiscal representative for as long as you need.",
        },
      ],
      footnote: "Most files clear step 03 inside 4 weeks. Complex compliance cases may take 6.",
    },

    bigStats: {
      eyebrow: "By the numbers",
      title: "What 8 years on the lawyer side of relocation looks like.",
      items: [
        { number: "800+", label: "files closed", caption: "Since 2017, all signed by counsel." },
        { number: "8", label: "years on file", caption: "Patrícia at the OA bar, OAB before that." },
        { number: "100%", label: "attorney-led", caption: "Every file. No exceptions." },
        { number: "0", label: "middlemen", caption: "No reseller, no markup, no kickbacks." },
      ],
    },

    founder: {
      eyebrow: "The lawyer",
      title: "Patrícia Viana, the lawyer signing your file.",
      bio: "Licensed Portuguese attorney since 2017 (OA 1148L), prior practice in Brazil (OAB SP). Patrícia spent six years on the receiving end of subcontracted relocation work before launching Alttavia, so clients could call the lawyer first instead of last. Native Portuguese, fluent English, fluent Spanish.",
      quote:
        "I want every client to feel the calm I wish I had had the first time I ever did this myself.",
      credentials: [
        { label: "OA Portugal", value: "1148L" },
        { label: "OAB Brasil", value: "Active" },
        { label: "Languages", value: "PT · EN · ES" },
        { label: "Practice", value: "Since 2017" },
      ],
      stickerCta: "Book a 30-minute call with Patrícia",
    },

    globe: {
      eyebrow: "Lisbon, by hand",
      title: "We work from one office. Our clients move from everywhere.",
      lede: "Files are signed in Lisbon. Calls happen in your timezone. Your visa application reads as if a Portuguese local prepared it, because one did.",
      cityListLabel: "Recent intakes",
    },

    faq: {
      eyebrow: "Questions before the call",
      title: "Things every client asks on day one.",
      categories: ["Eligibility", "Pricing", "Timing", "Logistics"],
      items: [
        {
          n: "01",
          category: "Eligibility",
          q: "Can I get my NIF or open a Portuguese bank account by myself?",
          a: "Both processes need Portuguese legal representation, an in-country address, and KYC compliance built for non-residents. The Tax Authority requires a fiscal representative with a Portuguese address. Most banks refuse direct applications from abroad. These are legal requirements only a licensed Portuguese lawyer can carry out for you.",
        },
        {
          n: "02",
          category: "Pricing",
          q: "Is it expensive?",
          a: "Compared to a denied visa, a rejected bank account, or months of avoidable delay, no. Our pricing is flat and written down before any work begins. You will know exactly what you are paying and exactly what you get.",
        },
        {
          n: "03",
          category: "Timing",
          q: "How long does each process take?",
          a: "NIF issuance usually takes 3 to 5 business days after we receive your documents. Remote bank account opening takes 2 to 4 weeks depending on the bank's compliance review and your nationality. We give you realistic timelines before you commit and update you as they evolve.",
        },
        {
          n: "04",
          category: "Logistics",
          q: "Do I need to travel to Portugal for any of this?",
          a: "No. Both services are fully remote. You sign, we file, the authorities and the bank approve, from wherever you are. Visiting only makes sense once your account is live and you want to see your new city.",
        },
        {
          n: "05",
          category: "Eligibility",
          q: "I am applying for a D7 visa. Do I need both services?",
          a: "Yes. The D7 needs a NIF (with a registered fiscal representative) and a Portuguese bank account with deposited funds before the consular interview. Without one of them the consulate will not approve the application.",
        },
        {
          n: "06",
          category: "Logistics",
          q: "What documents will I need to provide?",
          a: "Usually your passport, a proof of address, proof of income or pension, and a short questionnaire we send you. Exact requirements depend on your nationality and visa type. We confirm everything before any document leaves your inbox.",
        },
        {
          n: "07",
          category: "Logistics",
          q: "What if the bank rejects my application?",
          a: "It rarely happens, because our compliance team reviews every file before it goes in. If it does, we open with another partner bank at no extra cost. Your process does not stop until your account is live.",
        },
      ],
    },

    contact: {
      eyebrow: "Open the file",
      title: "Tell us where you are.\nWe will tell you what comes next.",
      desc: "A first call is free, on the calendar of an actual attorney, without commitment. You leave it with a clear plan, written pricing, and the name of the lawyer holding your file.",
      replyTime: "We reply inside one business day",
      privilege: "Protected by attorney-client privilege",
      emailLabel: "Email",
      phoneLabel: "Phone or WhatsApp",
      officeLabel: "Office",
      selectPrompt: "Pick one",
      messageSent: "Message sent",
      formLabels: {
        name: "Full name",
        email: "Email",
        phone: "Phone or WhatsApp",
        country: "Country of residence",
        interest: "I am interested in",
        message: "Tell us where you are in your move",
        submit: "Send my brief",
        disclaimer:
          "By submitting, you agree to our privacy policy. We respond within one business day.",
      },
      formPlaceholders: {
        name: "How should we address you?",
        email: "your@email.com",
        phone: "+1 (555) 000 0000",
        country: "United States, UK, Brazil, ...",
        message:
          "Where are you in your move, and what would make this easier?",
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

    footer: {
      tagline:
        "A Portuguese law firm helping people move with legal certainty. NIF, fiscal representation, and remote bank accounts for those relocating to Portugal.",
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
            { href: "#founder", label: "Founder" },
            { href: "#versus", label: "The difference" },
            { href: "#process", label: "Process" },
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
  },

  pt: {
    cityLabel: "Lisboa",
    country: "Portugal",
    officeHours: "Seg a sex, 10h às 18h WET",

    metaTitle:
      "Alttavia Relocation. NIF e conta bancária em Portugal com advogados licenciados.",
    metaDescription:
      "Advogados portugueses licenciados emitem o seu NIF com representação fiscal e abrem a sua conta bancária portuguesa de forma remota. Os dois documentos que o visto D7 ou D8 exige. Mais de 800 casos conduzidos.",

    navCtaLabel: "Agendar conversa",
    nav: [
      { href: "#versus", label: "A diferença" },
      { href: "#services", label: "Serviços" },
      { href: "#process", label: "Processo" },
      { href: "#founder", label: "Fundadora" },
      { href: "#faq", label: "FAQ" },
      { href: "#contact", label: "Contato" },
    ],

    statusBadge: {
      live: "Aceitando casos",
      label: "Pauta aberta para abril/26",
    },

    hero: {
      issueLabel: "Edição 02",
      issueDate: "Lisboa",
      eyebrow: "Um dossiê de relocation, por Alttavia",
      kicker: "Quem assina é a advogada.",
      titlePre: "Mude para Portugal",
      titleEm: "do jeito que",
      titleEm2: "as advogadas",
      titlePost: "fazem.",
      lede: "NIF e conta bancária em Portugal, assinados por uma advogada de Lisboa. O escritório que outras empresas de relocation contratam. Sem intermediário.",
      ctaPrimary: "Agendar conversa",
      ctaSecondary: "Ver como funciona",
      photoCaption: "Patrícia Viana, OA Portugal · OAB Brasil",
      floatingChips: [
        { label: "OA Portugal · 1148L" },
        { label: "Dossiê assinado por advogada" },
        { label: "Lisboa, à mão" },
      ],
      heroStat: {
        number: "800+",
        label: "casos fechados desde 2017",
      },
    },

    trustMarquee: {
      label: "Clientes vindos de",
      cities: [
        "Nova Iorque",
        "Miami",
        "Los Angeles",
        "Houston",
        "Chicago",
        "Toronto",
        "Londres",
        "Madri",
        "São Paulo",
        "Rio",
        "Cidade do México",
        "Dubai",
        "Singapura",
      ],
    },

    visaMarquee: {
      types: [
        "D7 renda passiva",
        "D8 nômade digital",
        "Golden Visa",
        "Reagrupamento familiar",
        "Tech Visa",
        "Visto de estudante",
        "Visto de aposentado",
      ],
    },

    versus: {
      eyebrow: "A diferença",
      title: "Dois caminhos para um visto português.",
      lede: "A maioria das empresas de relocation terceiriza o jurídico. Nós somos o jurídico. O que muda quando é a advogada que atende.",
      headerLeft: "A maioria das empresas",
      headerRight: "Alttavia",
      rows: [
        {
          left: "Vendedor na ligação. O advogado entra no fim, rapidinho.",
          right: "Advogada licenciada cuida do dossiê do briefing à protocolação.",
        },
        {
          left: "Representação fiscal terceirizada com markup.",
          right: "Representação fiscal emitida e mantida por nós, sem markup, sem intermediário.",
        },
        {
          left: "Conta bancária por indicação genérica. KYC montado ao acaso.",
          right: "Dossiê do banco pré-revisado pelo compliance antes da submissão.",
        },
        {
          left: "Respostas genéricas, sinais cruzados entre equipes.",
          right: "Uma advogada nomeada. Uma única thread. Decisões por escrito.",
        },
        {
          left: "Preço varia conforme pacote, upsell, conversão.",
          right: "Honorário fixo, no papel, antes de qualquer trabalho começar.",
        },
      ],
    },

    services: {
      eyebrow: "O que fazemos",
      title: "Dois documentos. Um escritório. Zero intermediários.",
      lede: "São os dois únicos serviços que executamos, porque são os dois que decidem o D7 e o D8. Os dois remotos. Os dois assinados por advogada licenciada.",
      bento: {
        nifTag: "Obrigatório para o D7 desde o dia 1",
        nifNumber: "01",
        nifTitle: "NIF com representação fiscal",
        nifDesc:
          "A sua identidade fiscal portuguesa, mais um representante fiscal inscrito em Portugal. Sem estes dois, você não aluga, não abre conta, não matricula filhos, não agenda entrevista consular.",
        nifBullets: [
          "Representante fiscal inscrito",
          "Emissão em 3 a 5 dias úteis",
          "100% remoto, assinatura digital",
        ],
        nifCta: "Solicitar meu NIF",
        bankTag: "Obrigatório para D7 e Golden Visa",
        bankNumber: "02",
        bankTitle: "Conta bancária remota em Portugal",
        bankDesc:
          "A sua conta de prova de fundos, aberta com banco parceiro português. Montamos o KYC, fazemos pré-revisão e acompanhamos a transferência até o dinheiro cair.",
        bankBullets: [
          "Bancos parceiros acostumados a não-residentes",
          "Dossiê de compliance pré-revisado",
          "Fundos confirmados antes da entrevista consular",
        ],
        bankCta: "Abrir minha conta",
        sideOne: {
          tag: "Bônus",
          title: "Revisão de timing consular",
          desc: "Mapeamos o seu cronograma contra o consulado que vai julgar o seu caso para as datas baterem.",
        },
        sideTwo: {
          tag: "Bônus",
          title: "Segunda revisão de compliance",
          desc: "Antes de qualquer documento sair da sua caixa, uma segunda advogada lê o dossiê de ponta a ponta.",
        },
      },
    },

    process: {
      eyebrow: "Como roda",
      title: "Quatro passos da sua mesa de jantar à caixa do correio em Lisboa.",
      lede: "Todo dossiê Alttavia corre pelos mesmos quatro passos. Você sempre sabe em qual está, qual advogada o segura e o que falta.",
      steps: [
        {
          n: "01",
          title: "Briefing",
          duration: "Dia 1",
          desc: "Conversa gratuita com a advogada que cuidaria do seu caso. Lemos o cenário, listamos os documentos e mandamos proposta com honorário fixo por escrito.",
        },
        {
          n: "02",
          title: "Protocolar",
          duration: "Dia 2 a 5",
          desc: "Procuração assinada digitalmente. Emitimos o NIF, registramos a representação fiscal e abrimos o KYC com banco parceiro.",
        },
        {
          n: "03",
          title: "Submeter",
          duration: "Semana 2 a 4",
          desc: "Submissão ao banco, idas e vindas com compliance, acompanhamento até a conta ficar ativa. Certidão de NIF na caixa de entrada. Datas consulares alinhadas.",
        },
        {
          n: "04",
          title: "No ar",
          duration: "Semana 4+",
          desc: "Fundos transferidos e confirmados. Documentos prontos para a entrevista consular. Continuamos como representante fiscal pelo tempo que precisar.",
        },
      ],
      footnote: "A maioria dos casos vence o passo 03 em até 4 semanas. Casos de compliance complexos podem levar 6.",
    },

    bigStats: {
      eyebrow: "Em números",
      title: "É assim que se parece o relocation visto pelo lado da advogada.",
      items: [
        { number: "800+", label: "casos fechados", caption: "Desde 2017, todos assinados pela advogada." },
        { number: "8", label: "anos de barra", caption: "Patrícia inscrita na OA, antes na OAB." },
        { number: "100%", label: "advogada à frente", caption: "Cada caso, sem exceção." },
        { number: "0", label: "intermediários", caption: "Sem revenda, sem markup, sem comissão." },
      ],
    },

    founder: {
      eyebrow: "A advogada",
      title: "Patrícia Viana, a advogada que assina o seu dossiê.",
      bio: "Advogada portuguesa licenciada desde 2017 (OA 1148L), prática anterior no Brasil (OAB SP). Antes de fundar a Alttavia, Patrícia passou seis anos recebendo trabalho jurídico subcontratado por empresas de relocation. A Alttavia nasceu para que o cliente possa ligar primeiro para a advogada, não por último. Português nativo, inglês fluente, espanhol fluente.",
      quote:
        "Quero que cada cliente sinta a calma que eu queria ter sentido na primeira vez em que precisei fazer isso sozinha.",
      credentials: [
        { label: "OA Portugal", value: "1148L" },
        { label: "OAB Brasil", value: "Ativa" },
        { label: "Idiomas", value: "PT · EN · ES" },
        { label: "Atuação", value: "Desde 2017" },
      ],
      stickerCta: "Agendar 30 min com a Patrícia",
    },

    globe: {
      eyebrow: "Lisboa, à mão",
      title: "Trabalhamos a partir de um escritório. Os clientes mudam de todo lado.",
      lede: "Os dossiês são assinados em Lisboa. As ligações acontecem no seu fuso. O seu pedido de visto chega ao consulado lendo como se um português local o tivesse preparado, porque foi exatamente isso.",
      cityListLabel: "Casos recentes",
    },

    faq: {
      eyebrow: "Antes da primeira conversa",
      title: "O que quase todo cliente pergunta no dia um.",
      categories: ["Elegibilidade", "Preço", "Prazos", "Logística"],
      items: [
        {
          n: "01",
          category: "Elegibilidade",
          q: "Posso obter o NIF ou abrir uma conta portuguesa sozinho?",
          a: "Os dois processos exigem representação legal em Portugal, morada no país e regras de KYC desenhadas para não-residentes. A Autoridade Tributária pede um representante fiscal com endereço português. A maioria dos bancos recusa candidaturas diretas vindas do exterior. Não são formalidades, são exigências legais que apenas um advogado português licenciado pode cumprir por você.",
        },
        {
          n: "02",
          category: "Preço",
          q: "É caro?",
          a: "Comparado a um visto negado, uma conta recusada ou meses de atraso evitável, não. Nosso preço é fixo e está no papel antes de qualquer trabalho começar. Você sabe exatamente o que está pagando e o que recebe.",
        },
        {
          n: "03",
          category: "Prazos",
          q: "Quanto tempo cada processo leva?",
          a: "Emissão do NIF: tipicamente 3 a 5 dias úteis depois de recebermos a documentação. Abertura de conta bancária remota: 2 a 4 semanas, conforme o compliance do banco e a sua nacionalidade. Comunicamos prazos realistas antes de você se comprometer e atualizamos conforme avançam.",
        },
        {
          n: "04",
          category: "Logística",
          q: "Preciso viajar para Portugal em alguma etapa?",
          a: "Não. Os dois serviços são totalmente remotos. Você assina, nós protocolamos, as autoridades e o banco aprovam, de onde você estiver. Uma visita só faz sentido quando a conta já estiver ativa e você quiser conhecer a sua nova cidade.",
        },
        {
          n: "05",
          category: "Elegibilidade",
          q: "Vou aplicar para o D7. Preciso dos dois serviços?",
          a: "Sim. O D7 exige NIF (com representante fiscal inscrito) e conta bancária portuguesa com fundos depositados antes da entrevista consular. Sem um dos dois, o consulado não aprova a candidatura.",
        },
        {
          n: "06",
          category: "Logística",
          q: "Quais documentos vou precisar?",
          a: "Em geral: passaporte, comprovante de residência, comprovante de rendimento ou aposentadoria e um questionário curto que enviamos. As exigências exatas dependem da sua nacionalidade e do tipo de visto. Confirmamos tudo antes de qualquer documento sair da sua caixa.",
        },
        {
          n: "07",
          category: "Logística",
          q: "E se o banco recusar minha candidatura?",
          a: "Raramente acontece, porque a nossa equipe de compliance revisa cada dossier antes da submissão. Se acontecer, abrimos com outro banco parceiro sem custo extra. Seu processo não para até a sua conta estar ativa.",
        },
      ],
    },

    contact: {
      eyebrow: "Abrir o dossiê",
      title: "Conte onde você está.\nA gente diz o que vem a seguir.",
      desc: "A primeira conversa é gratuita, na agenda de uma advogada de verdade, sem compromisso. Você sai dela com plano claro, preço por escrito e o nome da advogada que vai segurar o seu caso.",
      replyTime: "Respondemos em até um dia útil",
      privilege: "Protegido pelo sigilo profissional",
      emailLabel: "E-mail",
      phoneLabel: "Telefone ou WhatsApp",
      officeLabel: "Escritório",
      selectPrompt: "Escolha uma opção",
      messageSent: "Mensagem enviada",
      formLabels: {
        name: "Nome completo",
        email: "E-mail",
        phone: "Telefone ou WhatsApp",
        country: "País de residência",
        interest: "Tenho interesse em",
        message: "Conte em que ponto está",
        submit: "Enviar briefing",
        disclaimer:
          "Ao enviar, você concorda com nossa política de privacidade. Respondemos em até um dia útil.",
      },
      formPlaceholders: {
        name: "Como podemos chamar você?",
        email: "seu@email.com",
        phone: "+55 (11) 99999 9999",
        country: "Brasil, Estados Unidos, Reino Unido, ...",
        message:
          "Em que ponto da mudança você está, e o que tornaria o processo mais fácil?",
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

    footer: {
      tagline:
        "Escritório de advocacia português acompanhando quem se muda para Portugal com segurança jurídica. NIF, representação fiscal e contas bancárias remotas.",
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
            { href: "#founder", label: "Fundadora" },
            { href: "#versus", label: "A diferença" },
            { href: "#process", label: "Processo" },
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
  },

  es: {
    cityLabel: "Lisboa",
    country: "Portugal",
    officeHours: "Lun a vie, 10:00 a 18:00 WET",

    metaTitle:
      "Alttavia Relocation. NIF y cuenta bancaria portuguesa con abogados licenciados.",
    metaDescription:
      "Abogados portugueses licenciados emiten tu NIF con representación fiscal y abren tu cuenta bancaria portuguesa de forma remota. Los dos documentos que tu visado D7 o D8 necesita. Más de 800 casos gestionados.",

    navCtaLabel: "Agendar llamada",
    nav: [
      { href: "#versus", label: "La diferencia" },
      { href: "#services", label: "Servicios" },
      { href: "#process", label: "Proceso" },
      { href: "#founder", label: "Fundadora" },
      { href: "#faq", label: "FAQ" },
      { href: "#contact", label: "Contacto" },
    ],

    statusBadge: {
      live: "Aceptando casos",
      label: "Cupo abierto para abril/26",
    },

    hero: {
      issueLabel: "Edición 02",
      issueDate: "Lisboa",
      eyebrow: "Un expediente de relocation, por Alttavia",
      kicker: "Firma la abogada.",
      titlePre: "Múdate a Portugal",
      titleEm: "como lo hacen",
      titleEm2: "los abogados",
      titlePost: ".",
      lede: "NIF y cuenta bancaria portuguesa, firmados por una abogada de Lisboa. El bufete que otras firmas de relocation contratan. Sin intermediarios.",
      ctaPrimary: "Agendar llamada",
      ctaSecondary: "Ver cómo funciona",
      photoCaption: "Patrícia Viana, OA Portugal · OAB Brasil",
      floatingChips: [
        { label: "OA Portugal · 1148L" },
        { label: "Expediente firmado por abogada" },
        { label: "Lisboa, a mano" },
      ],
      heroStat: {
        number: "800+",
        label: "expedientes cerrados desde 2017",
      },
    },

    trustMarquee: {
      label: "Clientes que llegan desde",
      cities: [
        "Nueva York",
        "Miami",
        "Los Ángeles",
        "Houston",
        "Chicago",
        "Toronto",
        "Londres",
        "Madrid",
        "São Paulo",
        "Río",
        "Ciudad de México",
        "Dubái",
        "Singapur",
      ],
    },

    visaMarquee: {
      types: [
        "D7 ingresos pasivos",
        "D8 nómada digital",
        "Golden Visa",
        "Reagrupación familiar",
        "Tech Visa",
        "Visado de estudiante",
        "Visado de jubilado",
      ],
    },

    versus: {
      eyebrow: "La diferencia",
      title: "Dos formas de pedir un visado portugués.",
      lede: "La mayoría de las firmas de relocation terceriza el trabajo jurídico. Nosotros somos el trabajo jurídico. Esto cambia cuando es la abogada quien atiende.",
      headerLeft: "La mayoría de las firmas",
      headerRight: "Alttavia",
      rows: [
        {
          left: "Comercial en la llamada. El abogado entra al final, brevemente.",
          right: "Abogada licenciada lleva tu expediente desde el briefing hasta la presentación.",
        },
        {
          left: "Representación fiscal tercerizada con markup.",
          right: "Representación fiscal emitida y mantenida por nosotros, sin markup, sin intermediarios.",
        },
        {
          left: "Cuenta bancaria por referencia genérica. KYC armado al vuelo.",
          right: "Dossier bancario revisado por compliance antes de la presentación.",
        },
        {
          left: "Respuestas genéricas, señales cruzadas entre equipos.",
          right: "Una abogada nombrada. Un solo hilo. Decisiones por escrito.",
        },
        {
          left: "El precio depende del paquete, upsells, conversiones.",
          right: "Honorario fijo, por escrito, antes de que empiece el trabajo.",
        },
      ],
    },

    services: {
      eyebrow: "Qué hacemos",
      title: "Dos documentos. Un bufete. Cero intermediarios.",
      lede: "Son los dos únicos servicios que ejecutamos, porque son los dos que deciden el D7 y el D8. Ambos remotos. Ambos firmados por abogada licenciada.",
      bento: {
        nifTag: "Obligatorio para el D7 desde el día 1",
        nifNumber: "01",
        nifTitle: "NIF con representación fiscal",
        nifDesc:
          "Tu identidad fiscal portuguesa, más un representante fiscal registrado en Portugal. Sin esos dos, no alquilas, no abres cuenta, no matriculas hijos, no agendas entrevista consular.",
        nifBullets: [
          "Representante fiscal registrado",
          "Emisión en 3 a 5 días hábiles",
          "100% remoto, firma digital",
        ],
        nifCta: "Solicitar mi NIF",
        bankTag: "Obligatoria para D7 y Golden Visa",
        bankNumber: "02",
        bankTitle: "Cuenta bancaria remota en Portugal",
        bankDesc:
          "Tu cuenta de prueba de fondos, abierta con un banco asociado portugués. Armamos el KYC, hacemos pre-revisión y seguimos la transferencia hasta que el dinero entra.",
        bankBullets: [
          "Bancos asociados acostumbrados a no residentes",
          "Dossier de compliance pre-revisado",
          "Fondos confirmados antes de la entrevista consular",
        ],
        bankCta: "Abrir mi cuenta",
        sideOne: {
          tag: "Extra",
          title: "Revisión de timing consular",
          desc: "Mapeamos tu cronograma contra el consulado que verá tu caso para que las fechas calcen.",
        },
        sideTwo: {
          tag: "Extra",
          title: "Segunda revisión de compliance",
          desc: "Antes de que ningún documento salga de tu bandeja, una segunda abogada lee el expediente entero.",
        },
      },
    },

    process: {
      eyebrow: "Cómo corre",
      title: "Cuatro pasos de tu mesa al buzón en Lisboa.",
      lede: "Todo expediente de Alttavia corre por los mismos cuatro pasos. Siempre sabes en cuál estás, qué abogada lo tiene y qué falta.",
      steps: [
        {
          n: "01",
          title: "Briefing",
          duration: "Día 1",
          desc: "Llamada gratuita con la abogada que llevaría tu caso. Leemos el escenario, listamos los documentos y enviamos propuesta con honorario fijo por escrito.",
        },
        {
          n: "02",
          title: "Presentar",
          duration: "Día 2 a 5",
          desc: "Poder firmado digitalmente. Emitimos el NIF, registramos la representación fiscal y abrimos el KYC con banco asociado.",
        },
        {
          n: "03",
          title: "Someter",
          duration: "Semana 2 a 4",
          desc: "Presentación al banco, idas y vueltas con compliance, seguimiento hasta que la cuenta esté activa. Certificado del NIF en tu bandeja. Fechas consulares alineadas.",
        },
        {
          n: "04",
          title: "En el aire",
          duration: "Semana 4+",
          desc: "Fondos transferidos y confirmados. Documentos listos para la entrevista consular. Seguimos como representante fiscal el tiempo que necesites.",
        },
      ],
      footnote: "La mayoría de los expedientes pasa el paso 03 en hasta 4 semanas. Los casos de compliance complejo pueden llegar a 6.",
    },

    bigStats: {
      eyebrow: "En cifras",
      title: "Así se ve el relocation desde el lado de la abogada.",
      items: [
        { number: "800+", label: "expedientes cerrados", caption: "Desde 2017, todos firmados por abogada." },
        { number: "8", label: "años de barra", caption: "Patrícia en la OA, antes en la OAB." },
        { number: "100%", label: "con abogada al frente", caption: "Cada caso, sin excepción." },
        { number: "0", label: "intermediarios", caption: "Sin reventa, sin markup, sin comisión." },
      ],
    },

    founder: {
      eyebrow: "La abogada",
      title: "Patrícia Viana, la abogada que firma tu expediente.",
      bio: "Abogada portuguesa licenciada desde 2017 (OA 1148L), práctica previa en Brasil (OAB SP). Antes de fundar Alttavia, Patrícia pasó seis años recibiendo trabajo jurídico subcontratado por firmas de relocation. Alttavia nació para que el cliente pueda llamar a la abogada primero, no al final. Portugués nativo, inglés fluido, español fluido.",
      quote:
        "Quiero que cada cliente sienta la calma que me habría gustado tener la primera vez que tuve que hacer esto.",
      credentials: [
        { label: "OA Portugal", value: "1148L" },
        { label: "OAB Brasil", value: "Activa" },
        { label: "Idiomas", value: "PT · EN · ES" },
        { label: "Práctica", value: "Desde 2017" },
      ],
      stickerCta: "Agendar 30 min con Patrícia",
    },

    globe: {
      eyebrow: "Lisboa, a mano",
      title: "Trabajamos desde una oficina. Nuestros clientes se mudan desde todas partes.",
      lede: "Los expedientes se firman en Lisboa. Las llamadas ocurren en tu huso horario. Tu solicitud de visado le llega al consulado leyéndose como si la hubiera preparado un portugués local, porque así fue.",
      cityListLabel: "Casos recientes",
    },

    faq: {
      eyebrow: "Antes de la primera llamada",
      title: "Lo que casi todo cliente pregunta el primer día.",
      categories: ["Elegibilidad", "Precio", "Plazos", "Logística"],
      items: [
        {
          n: "01",
          category: "Elegibilidad",
          q: "¿Puedo obtener el NIF o abrir una cuenta bancaria portuguesa por mi cuenta?",
          a: "Ambos procesos requieren representación jurídica portuguesa, dirección en el país y reglas KYC diseñadas para no residentes. La Autoridad Tributaria exige un representante fiscal con dirección portuguesa. La mayoría de los bancos rechazan solicitudes directas desde el exterior. No son formalidades, son exigencias legales que sólo un abogado portugués licenciado puede cumplir por ti.",
        },
        {
          n: "02",
          category: "Precio",
          q: "¿Es caro?",
          a: "Comparado con un visado denegado, una cuenta rechazada o meses de retraso evitable, no. Nuestro precio es cerrado y está por escrito antes de empezar. Sabes exactamente lo que pagas y lo que recibes.",
        },
        {
          n: "03",
          category: "Plazos",
          q: "¿Cuánto tarda cada proceso?",
          a: "Emisión del NIF: normalmente 3 a 5 días laborables desde la documentación. Apertura de cuenta bancaria remota: 2 a 4 semanas según el análisis de compliance del banco y tu nacionalidad. Comunicamos plazos realistas antes de que te comprometas y actualizamos según evolucionan.",
        },
        {
          n: "04",
          category: "Logística",
          q: "¿Tengo que viajar a Portugal en algún momento?",
          a: "No. Ambos servicios son totalmente remotos. Tú firmas, nosotros presentamos, las autoridades y el banco aprueban, desde donde estés. Visitar sólo tiene sentido cuando la cuenta ya está activa y quieres conocer tu nueva ciudad.",
        },
        {
          n: "05",
          category: "Elegibilidad",
          q: "Voy a solicitar el visado D7. ¿Necesito los dos servicios?",
          a: "Sí. El D7 exige un NIF (con representante fiscal registrado) y una cuenta bancaria portuguesa con fondos depositados antes de la entrevista consular. Sin uno u otro, el consulado no aprueba la solicitud.",
        },
        {
          n: "06",
          category: "Logística",
          q: "¿Qué documentos necesitaré aportar?",
          a: "Normalmente: pasaporte, comprobante de domicilio, comprobante de ingresos o pensión y un cuestionario breve que te enviamos. Los requisitos exactos dependen de tu nacionalidad y del tipo de visado. Lo confirmamos todo antes de que nada salga de tu bandeja de entrada.",
        },
        {
          n: "07",
          category: "Logística",
          q: "¿Y si el banco rechaza mi solicitud?",
          a: "Es raro, porque nuestro equipo de compliance revisa cada dossier antes de presentarlo. Si ocurre, abrimos con otro banco asociado sin coste adicional. Tu proceso no se detiene hasta que tu cuenta esté activa.",
        },
      ],
    },

    contact: {
      eyebrow: "Abrir el expediente",
      title: "Cuéntanos dónde estás.\nTe diremos qué viene a continuación.",
      desc: "La primera llamada es gratuita, en la agenda de una abogada de verdad, sin compromiso. Saldrás con un plan claro, precio por escrito y el nombre de la abogada que llevará tu caso.",
      replyTime: "Respondemos en un día laborable",
      privilege: "Protegido por el secreto profesional",
      emailLabel: "Email",
      phoneLabel: "Teléfono o WhatsApp",
      officeLabel: "Oficina",
      selectPrompt: "Elige una opción",
      messageSent: "Mensaje enviado",
      formLabels: {
        name: "Nombre completo",
        email: "Email",
        phone: "Teléfono o WhatsApp",
        country: "País de residencia",
        interest: "Me interesa",
        message: "Cuéntanos en qué momento estás",
        submit: "Enviar briefing",
        disclaimer:
          "Al enviar, aceptas nuestra política de privacidad. Respondemos en un día laborable.",
      },
      formPlaceholders: {
        name: "¿Cómo podemos llamarte?",
        email: "tu@email.com",
        phone: "+34 600 000 000",
        country: "España, México, Argentina, ...",
        message:
          "¿En qué punto de la mudanza estás, y qué te haría todo más fácil?",
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

    footer: {
      tagline:
        "Bufete portugués que acompaña a quien se muda a Portugal con seguridad jurídica. NIF, representación fiscal y cuentas bancarias remotas.",
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
            { href: "#founder", label: "Fundadora" },
            { href: "#versus", label: "La diferencia" },
            { href: "#process", label: "Proceso" },
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
  },
} as const;

export type Messages = (typeof messages)[Locale];
