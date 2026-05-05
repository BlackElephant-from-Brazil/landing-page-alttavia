import type { Locale } from "@/lib/i18n";

/**
 * Localized UI copy. Same shape across all locales (enforced by the `Messages` type).
 * Voice rules in force here:
 *  - No em-dashes anywhere. Use commas, periods, semicolons, or parentheses.
 *  - Concrete over abstract. Numbers, named things, real consequences.
 *  - Vary sentence length. No stacked one-word fragments.
 *  - Skip AI buzzwords (seamless, transformative, leverage, comprehensive, robust, etc.).
 *  - Central angle: "Your relocation agency was going to call us anyway."
 */
export const messages = {
  en: {
    cityLabel: "Lisbon",
    country: "Portugal",
    officeHours: "Mon to Fri, 10:00 to 18:00 WET",

    metaTitle:
      "Alttavia Relocation. The Portuguese law firm your relocation agency was going to call anyway.",
    metaDescription:
      "Licensed Portuguese attorneys handle your NIF, fiscal representation, and remote bank account. The two documents your D7 or D8 visa cannot skip. 800+ cases completed. No agency in between.",

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
      live: "Taking new clients",
      label: "May 2026 intake open",
    },

    hero: {
      issueLabel: "Case file",
      issueDate: "Lisbon · Est. 2017",
      eyebrow: "A Portuguese law firm. No agency in between.",
      kicker: "Your relocation agency was going to call us anyway.",
      titlePre: "Get your Portugal file",
      titleEm: "done right",
      titleEm2: "the first time",
      titlePost: ".",
      lede: "NIF, fiscal representation, and a Portuguese bank account. The two things your D7 or D8 visa cannot skip. Handled by the attorneys most relocation agencies subcontract to, without the agency and without the markup.",
      ctaPrimary: "Book a free call",
      ctaSecondary: "See how it works",
      photoCaption: "Patrícia Viana, OA Portugal · OAB Brasil",
      floatingChips: [
        { label: "OA Portugal · 1148L" },
        { label: "Attorney on every file" },
        { label: "800+ cases since 2017" },
      ],
      heroStat: {
        number: "800+",
        label: "files completed since 2017",
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
      title:
        "Every D7 visa needs a Portuguese attorney. The question is how many layers you pay for.",
      lede: "Relocation agencies buy legal services from licensed attorneys, mark them up, and resell them to you. When you work with Alttavia directly, the attorney who signs your documents is the one on your calls.",
      headerLeft: "Through a relocation agency",
      headerRight: "Directly with Alttavia",
      rows: [
        {
          left: "A sales rep opens your file. You meet a lawyer near the end, briefly.",
          right:
            "A licensed attorney takes your file on day one and holds it until it closes.",
        },
        {
          left: "Fiscal representation is subcontracted. You rarely know who actually holds it.",
          right:
            "We issue and hold your fiscal representation. No third party, no unknown name on your file.",
        },
        {
          left: "Bank application submitted as-is. Compliance issues surface only after rejection.",
          right:
            "Every bank file is screened before submission. Most are approved on the first attempt.",
        },
        {
          left: "Three teams, two handoffs, one slow email thread.",
          right:
            "One named attorney. One thread. Every decision documented in writing.",
        },
        {
          left: "Final cost includes extras, follow-up charges, and currency buried in the fine print.",
          right:
            "Flat fee, quoted in writing before any work starts. No additions, no surprises.",
        },
      ],
    },

    services: {
      eyebrow: "What we handle",
      title: "Two legal requirements. One law firm. No one else in the chain.",
      lede: "Your consulate will ask for both before your interview. Most applicants find out too late. We handle both, remotely, from the same Lisbon office that has been doing this since 2017.",
      bento: {
        nifTag: "D7 and D8 applicants need this first",
        nifNumber: "01",
        nifTitle: "NIF with fiscal representation",
        nifDesc:
          "Portugal's tax ID, plus a licensed fiscal representative with a Portuguese address. Without the NIF you cannot rent, bank, enroll children, or book a consular interview. The fiscal representative role is reserved by law for licensed attorneys.",
        nifBullets: [
          "Licensed fiscal representative included",
          "Issued in 3 to 5 business days",
          "Fully remote, no Portugal trip required",
        ],
        nifCta: "Get my NIF",
        bankTag: "Required for D7 and Golden Visa",
        bankNumber: "02",
        bankTitle: "Portuguese bank account for non-residents",
        bankDesc:
          "Your consulate wants funds already sitting in a Portuguese account before your interview, not just a wire record. Most Portuguese banks reject applications from abroad. We open yours through partner banks that accept non-residents and build the entire compliance file.",
        bankBullets: [
          "Partner banks experienced with non-residents",
          "Full KYC compliance file prepared for you",
          "Funds confirmed before your consular interview",
        ],
        bankCta: "Open my account",
        sideOne: {
          tag: "Included",
          title: "Consular timeline check",
          desc: "We map your NIF and bank deadlines against your consulate's available dates before you commit.",
        },
        sideTwo: {
          tag: "Included",
          title: "Second review before submission",
          desc: "A second attorney reads every file before it leaves the office. One pass when it still matters.",
        },
      },
    },

    process: {
      eyebrow: "From your home to a Lisbon address",
      title: "Four steps. One attorney the whole way.",
      lede: "You always know which step your file is on, who holds it, and what is missing. No chasing updates.",
      steps: [
        {
          n: "01",
          title: "Call",
          duration: "Day 1",
          desc: "Free call with the attorney who would handle your file. She reads your situation, names the documents you need, and sends a written flat-fee quote. No commitment required.",
        },
        {
          n: "02",
          title: "Sign",
          duration: "Days 2 to 5",
          desc: "Digital power of attorney. We issue your NIF, register your fiscal representation with the Tax Authority, and open the compliance dossier with a partner bank.",
        },
        {
          n: "03",
          title: "File",
          duration: "Weeks 2 to 4",
          desc: "Bank submission, compliance review, follow-up until your account is active. NIF certificate in your inbox. Consular dates aligned.",
        },
        {
          n: "04",
          title: "Done",
          duration: "Week 4+",
          desc: "Funds wired and confirmed. All documents bundled for your visa interview. We stay on as your fiscal representative for as long as your visa requires.",
        },
      ],
      footnote:
        "Most files reach step 04 within four weeks. Complex compliance cases may take up to six.",
    },

    bigStats: {
      eyebrow: "Eight years. One practice.",
      title:
        "What working the legal side of relocation looks like over time.",
      items: [
        {
          number: "800+",
          label: "files completed",
          caption: "Since 2017. All signed by licensed counsel.",
        },
        {
          number: "8",
          label: "years at the OA bar",
          caption: "Patrícia licensed in Portugal, previously at the Brazilian bar.",
        },
        {
          number: "100%",
          label: "attorney-led",
          caption: "Every file. No exceptions, no handoffs.",
        },
        {
          number: "0",
          label: "middlemen",
          caption: "No reseller, no markup, no unknown subcontract.",
        },
      ],
    },

    founder: {
      eyebrow: "The attorney on your file",
      title:
        "Patrícia Viana. She started this firm because she was tired of being the invisible one doing the work.",
      bio: "Licensed Portuguese attorney since 2017 (OA 1148L), previously at the Brazilian bar (OAB SP). For years, relocation agencies sent her files to prepare for clients who would never learn her name. She founded Alttavia so the client could call the attorney first. Native Portuguese. Fluent English. Fluent Spanish.",
      quote:
        "I want every client to leave that first call knowing exactly what happens next, who is handling it, and why it will work.",
      credentials: [
        { label: "OA Portugal", value: "1148L" },
        { label: "OAB Brasil", value: "Active" },
        { label: "Languages", value: "PT · EN · ES" },
        { label: "Practice", value: "Since 2017" },
      ],
      stickerCta: "Book 30 minutes with Patrícia",
    },

    globe: {
      eyebrow: "One office. Every timezone.",
      title: "Files signed in Lisbon. Calls on your schedule.",
      lede: "We work from one office in Lisbon, where every document is prepared and signed. Your calls happen in your timezone. The file that lands on your consulate's desk reads exactly like it was prepared by a Lisbon attorney. It was.",
      cityListLabel: "Recent client cities",
    },

    faq: {
      eyebrow: "Before the call",
      title: "The questions clients bring to the first conversation.",
      categories: ["Eligibility", "Pricing", "Timing", "Logistics"],
      items: [
        {
          n: "01",
          category: "Eligibility",
          q: "Can I get my NIF or open a Portuguese bank account without a lawyer?",
          a: "Both require a licensed Portuguese attorney by law. The Tax Authority mandates a fiscal representative with a Portuguese address, a role only an attorney based in Portugal can fill. Most Portuguese banks reject direct applications from abroad. The few that accept non-residents require a compliance file our team builds for you. Attempting either without legal representation usually results in rejection or delays that set your consular interview back by months.",
        },
        {
          n: "02",
          category: "Pricing",
          q: "What does it cost?",
          a: "We quote a flat fee in writing after your first call, before any work starts. You will know exactly what you are paying, for exactly what scope, with the name of the attorney on your file. Compare that to the cost of a denied visa or a three-month delay. Compare it also to what a relocation agency charges for the same work they would have outsourced to us.",
        },
        {
          n: "03",
          category: "Timing",
          q: "How long does each step take?",
          a: "NIF issuance typically takes 3 to 5 business days after we receive your documents. Bank account opening takes 2 to 4 weeks, depending on the bank's compliance review and your nationality. You get a realistic timeline before you commit and a status update at every stage, without having to ask.",
        },
        {
          n: "04",
          category: "Logistics",
          q: "Do I need to travel to Portugal for any of this?",
          a: "No. Both services are fully remote. You sign electronically, we file with Portuguese authorities, and the bank reviews from wherever you are. A trip to Lisbon makes sense once your account is live and you are ready to visit the city you are moving to.",
        },
        {
          n: "05",
          category: "Eligibility",
          q: "I am applying for a D7 visa. Do I need both services?",
          a: "Yes. The D7 requires a NIF with a registered fiscal representative and a Portuguese bank account with funds already deposited, both confirmed before your consular interview. One missing document is enough for the consulate to reject the application. We handle both and coordinate the timing so nothing arrives too late.",
        },
        {
          n: "06",
          category: "Logistics",
          q: "What documents do you need from me?",
          a: "Usually your passport, proof of address, proof of income or pension, and a short questionnaire we send after the call. Exact requirements depend on your nationality and visa type. We confirm everything in writing before any document leaves your inbox.",
        },
        {
          n: "07",
          category: "Logistics",
          q: "What happens if the bank turns down my application?",
          a: "It rarely happens, because we review every file before submission. When it does, we open with a different partner bank at no additional cost. Your file does not close until your account is active and funded.",
        },
      ],
    },

    contact: {
      eyebrow: "Start your file",
      title: "One call. A written plan.\nThe name of your attorney.",
      desc: "The first call is free, with a licensed attorney, no commitment attached. You leave it with a clear scope, a flat fee on paper, and the name of the person who will handle your file from day one.",
      replyTime: "We reply within one business day",
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
        interest: "I need help with",
        message: "Tell us about your situation",
        submit: "Start my file",
        disclaimer:
          "By submitting, you agree to our privacy policy. We respond within one business day.",
      },
      formPlaceholders: {
        name: "How should we address you?",
        email: "you@email.com",
        phone: "+1 (555) 000 0000",
        country: "United States, Canada, UK, ...",
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
        "A Portuguese law firm handling the legal groundwork for people moving to Portugal. NIF, fiscal representation, and remote bank accounts for D7, D8, and Golden Visa applicants.",
      officeLabel: "OFFICE",
      getInTouchLabel: "GET IN TOUCH",
      craftedIn: "Built with care in Lisbon.",
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
      "Alttavia Relocation. O escritório jurídico português que a sua agência de relocation ia contratar de qualquer jeito.",
    metaDescription:
      "Advogadas portuguesas licenciadas emitem o seu NIF com representação fiscal e abrem a sua conta bancária em Portugal de forma remota. Os dois documentos que o visto D7 ou D8 exige. Mais de 800 casos. Sem intermediário.",

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
      live: "Aceitando novos clientes",
      label: "Vagas abertas para maio/26",
    },

    hero: {
      issueLabel: "Dossiê",
      issueDate: "Lisboa · Desde 2017",
      eyebrow: "Um escritório jurídico português. Sem agência no caminho.",
      kicker: "A agência de relocation ia nos contratar de qualquer jeito.",
      titlePre: "Resolva sua documentação",
      titleEm: "com quem faz",
      titleEm2: "o trabalho de verdade",
      titlePost: ".",
      lede: "NIF, representação fiscal e conta bancária em Portugal. Os dois documentos que o visto D7 ou D8 exige. Cuidados pelas mesmas advogadas que as agências de relocation contratam, sem intermediário e sem markup.",
      ctaPrimary: "Agendar conversa",
      ctaSecondary: "Ver como funciona",
      photoCaption: "Patrícia Viana, OA Portugal · OAB Brasil",
      floatingChips: [
        { label: "OA Portugal · 1148L" },
        { label: "Advogada em cada dossiê" },
        { label: "800+ casos desde 2017" },
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
      title:
        "Todo visto D7 precisa de uma advogada portuguesa. A questão é quantas camadas você vai pagar.",
      lede: "As agências de relocation compram serviços jurídicos de advogadas licenciadas, colocam markup e vendem de volta para você. Quando você trabalha direto com a Alttavia, quem assina os documentos é quem atende o seu telefone.",
      headerLeft: "Pela agência de relocation",
      headerRight: "Direto com a Alttavia",
      rows: [
        {
          left: "Um consultor comercial abre o dossiê. Você vê a advogada no final, por pouco tempo.",
          right:
            "Advogada licenciada assume o dossiê no dia 1 e segura até o fechamento.",
        },
        {
          left: "Representação fiscal terceirizada. Raramente você sabe quem a detém.",
          right:
            "Nós emitimos e mantemos a sua representação fiscal. Sem terceiros, sem nome desconhecido no processo.",
        },
        {
          left: "Documentação bancária submetida sem revisão. Problemas aparecem só depois da recusa.",
          right:
            "Todo dossiê bancário é revisado antes da submissão. A maioria é aprovada na primeira tentativa.",
        },
        {
          left: "Três equipes, dois handoffs, uma thread lenta de e-mail.",
          right:
            "Uma advogada nomeada. Uma única thread. Cada decisão documentada por escrito.",
        },
        {
          left: "Custo final inclui extras e cobranças adicionais no miúdo do contrato.",
          right:
            "Honorário fixo, por escrito, antes de qualquer trabalho começar. Sem acréscimos, sem surpresas.",
        },
      ],
    },

    services: {
      eyebrow: "O que fazemos",
      title: "Dois requisitos legais. Um escritório. Ninguém mais na cadeia.",
      lede: "O consulado vai exigir os dois antes da sua entrevista. A maioria descobre tarde demais. Nós cuidamos dos dois, de forma remota, do mesmo escritório em Lisboa que faz isso desde 2017.",
      bento: {
        nifTag: "Candidatos ao D7 e D8 precisam disso primeiro",
        nifNumber: "01",
        nifTitle: "NIF com representação fiscal",
        nifDesc:
          "O número de identificação fiscal português, mais uma representante fiscal licenciada com endereço em Portugal. Sem o NIF você não aluga, não abre conta, não matricula filhos e não agenda entrevista consular. O cargo de representante fiscal é reservado por lei para advogadas licenciadas.",
        nifBullets: [
          "Representante fiscal licenciada inclusa",
          "Emissão em 3 a 5 dias úteis",
          "100% remoto, sem precisar ir a Portugal",
        ],
        nifCta: "Obter meu NIF",
        bankTag: "Obrigatório para D7 e Golden Visa",
        bankNumber: "02",
        bankTitle: "Conta bancária portuguesa para não-residentes",
        bankDesc:
          "O consulado quer fundos já depositados em uma conta portuguesa antes da entrevista, não só um comprovante de transferência. A maioria dos bancos portugueses recusa candidaturas vindas do exterior. Nós abrimos a sua conta por bancos parceiros que trabalham com não-residentes e montamos todo o dossiê de compliance.",
        bankBullets: [
          "Bancos parceiros experientes com não-residentes",
          "Dossiê de KYC e compliance preparado para você",
          "Fundos confirmados antes da entrevista consular",
        ],
        bankCta: "Abrir minha conta",
        sideOne: {
          tag: "Incluso",
          title: "Revisão de timing consular",
          desc: "Mapeamos seus prazos de NIF e banco contra as datas disponíveis do seu consulado antes de você se comprometer.",
        },
        sideTwo: {
          tag: "Incluso",
          title: "Segunda revisão antes da submissão",
          desc: "Uma segunda advogada lê cada dossiê antes de sair do escritório. Uma checagem quando ainda dá para ajustar.",
        },
      },
    },

    process: {
      eyebrow: "Da sua mesa à Lisboa",
      title: "Quatro passos. Uma advogada o tempo todo.",
      lede: "Você sempre sabe em qual passo está o seu dossiê, quem o detém e o que falta. Sem precisar pedir atualização.",
      steps: [
        {
          n: "01",
          title: "Conversa",
          duration: "Dia 1",
          desc: "Ligação gratuita com a advogada que cuidaria do seu dossiê. Ela lê sua situação, nomeia os documentos necessários e envia proposta com honorário fixo por escrito. Sem compromisso.",
        },
        {
          n: "02",
          title: "Assinar",
          duration: "Dias 2 a 5",
          desc: "Procuração digital. Emitimos o NIF, registramos a representação fiscal na Autoridade Tributária e abrimos o dossiê de compliance com banco parceiro.",
        },
        {
          n: "03",
          title: "Protocolar",
          duration: "Semanas 2 a 4",
          desc: "Submissão ao banco, revisão de compliance, acompanhamento até a conta ficar ativa. Certidão de NIF na sua caixa. Datas consulares alinhadas.",
        },
        {
          n: "04",
          title: "Pronto",
          duration: "Semana 4+",
          desc: "Fundos transferidos e confirmados. Todos os documentos preparados para a entrevista consular. Continuamos como sua representante fiscal pelo tempo que o visto exigir.",
        },
      ],
      footnote:
        "A maioria dos dossiês chega ao passo 04 em até quatro semanas. Casos de compliance complexo podem levar até seis.",
    },

    bigStats: {
      eyebrow: "Oito anos. Um escritório.",
      title:
        "O que trabalhar o lado jurídico do relocation ensina ao longo do tempo.",
      items: [
        {
          number: "800+",
          label: "casos fechados",
          caption: "Desde 2017. Todos assinados por advogada licenciada.",
        },
        {
          number: "8",
          label: "anos de prática",
          caption: "Patrícia inscrita na OA, com passagem pela OAB SP.",
        },
        {
          number: "100%",
          label: "conduzidos por advogada",
          caption: "Cada dossiê. Sem exceção, sem repasse.",
        },
        {
          number: "0",
          label: "intermediários",
          caption: "Sem revendedor, sem markup, sem subcontratado desconhecido.",
        },
      ],
    },

    founder: {
      eyebrow: "A advogada no seu dossiê",
      title:
        "Patrícia Viana. Ela abriu o escritório porque estava cansada de ser a advogada invisível que fazia o trabalho.",
      bio: "Advogada portuguesa licenciada desde 2017 (OA 1148L), com passagem pela OAB SP. Por anos, agências de relocation mandavam dossiês para ela resolver para clientes que nunca saberiam o nome dela. Fundou a Alttavia para que o cliente pudesse ligar para a advogada primeiro. Português nativo. Inglês fluente. Espanhol fluente.",
      quote:
        "Quero que cada cliente saia da primeira conversa sabendo exatamente o que acontece a seguir, quem está cuidando e por que vai funcionar.",
      credentials: [
        { label: "OA Portugal", value: "1148L" },
        { label: "OAB Brasil", value: "Ativa" },
        { label: "Idiomas", value: "PT · EN · ES" },
        { label: "Atuação", value: "Desde 2017" },
      ],
      stickerCta: "Agendar 30 min com a Patrícia",
    },

    globe: {
      eyebrow: "Um escritório. Todos os fusos.",
      title: "Dossiês assinados em Lisboa. Ligações no seu horário.",
      lede: "Trabalhamos de um único escritório em Lisboa, onde cada documento é preparado e assinado. Suas ligações acontecem no seu fuso. O dossiê que chega ao consulado lê exatamente como se tivesse sido preparado por uma advogada lisboeta. Porque foi.",
      cityListLabel: "Cidades recentes de clientes",
    },

    faq: {
      eyebrow: "Antes da conversa",
      title: "As perguntas que os clientes trazem na primeira ligação.",
      categories: ["Elegibilidade", "Preço", "Prazos", "Logística"],
      items: [
        {
          n: "01",
          category: "Elegibilidade",
          q: "Posso obter o NIF ou abrir conta bancária portuguesa sem advogada?",
          a: "Os dois exigem advogada portuguesa licenciada por lei. A Autoridade Tributária exige representante fiscal com endereço em Portugal, cargo reservado por lei a advogadas licenciadas. A maioria dos bancos portugueses recusa candidaturas diretas vindas do exterior. Os poucos que aceitam não-residentes exigem um dossiê de compliance que a nossa equipe monta para você. Tentar qualquer um dos dois sem representação legal quase sempre resulta em recusa ou atrasos que empurram a entrevista consular por meses.",
        },
        {
          n: "02",
          category: "Preço",
          q: "Quanto custa?",
          a: "Enviamos proposta com honorário fixo por escrito após a primeira ligação, antes de qualquer trabalho começar. Você saberá exatamente o que está pagando, por qual escopo, com o nome da advogada no seu dossiê. Compare com o custo de um visto negado ou três meses de atraso na mudança. Compare também com o que uma agência cobra pelo mesmo trabalho que terceirizaria para nós.",
        },
        {
          n: "03",
          category: "Prazos",
          q: "Quanto tempo leva cada etapa?",
          a: "Emissão do NIF: normalmente 3 a 5 dias úteis depois de recebermos os documentos. Abertura de conta bancária remota: 2 a 4 semanas, conforme o compliance do banco e a sua nacionalidade. Você recebe prazo realista antes de se comprometer e atualização em cada etapa, sem precisar pedir.",
        },
        {
          n: "04",
          category: "Logística",
          q: "Preciso ir a Portugal em algum momento?",
          a: "Não. Os dois serviços são totalmente remotos. Você assina eletronicamente, nós protocolamos com as autoridades portuguesas e o banco revisa de onde você estiver. Uma visita a Lisboa faz sentido quando a conta já estiver ativa e você quiser conhecer a cidade para a qual está se mudando.",
        },
        {
          n: "05",
          category: "Elegibilidade",
          q: "Vou solicitar o visto D7. Preciso dos dois serviços?",
          a: "Sim. O D7 exige NIF com representante fiscal inscrita e conta bancária portuguesa com fundos já depositados, ambos confirmados antes da entrevista consular. Um documento faltando é suficiente para o consulado recusar a candidatura. Cuidamos dos dois e coordenamos o timing para que nada chegue tarde.",
        },
        {
          n: "06",
          category: "Logística",
          q: "Quais documentos você precisa de mim?",
          a: "Em geral: passaporte, comprovante de residência, comprovante de renda ou aposentadoria e um questionário curto que enviamos após a ligação. Os requisitos exatos dependem da sua nacionalidade e do tipo de visto. Confirmamos tudo por escrito antes de qualquer documento sair da sua caixa.",
        },
        {
          n: "07",
          category: "Logística",
          q: "E se o banco recusar minha candidatura?",
          a: "Acontece raramente, porque revisamos cada dossiê antes da submissão. Quando acontece, abrimos com outro banco parceiro sem custo adicional. O seu processo não encerra até a conta estar ativa e com fundos.",
        },
      ],
    },

    contact: {
      eyebrow: "Iniciar o dossiê",
      title: "Uma conversa. Um plano escrito.\nO nome da sua advogada.",
      desc: "A primeira ligação é gratuita, com uma advogada licenciada, sem compromisso. Você sai dela com escopo claro, honorário fixo no papel e o nome de quem cuidará do seu dossiê desde o primeiro dia.",
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
        interest: "Preciso de ajuda com",
        message: "Conte sua situação",
        submit: "Iniciar meu dossiê",
        disclaimer:
          "Ao enviar, você concorda com nossa política de privacidade. Respondemos em até um dia útil.",
      },
      formPlaceholders: {
        name: "Como podemos te chamar?",
        email: "voce@email.com",
        phone: "+55 (11) 99999 9999",
        country: "Brasil, Estados Unidos, Portugal, ...",
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
        "Escritório jurídico português cuidando da base legal de quem se muda para Portugal. NIF, representação fiscal e contas bancárias remotas para candidatos ao D7, D8 e Golden Visa.",
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
      "Alttavia Relocation. El bufete jurídico portugués que tu agencia de relocation iba a contratar de todas formas.",
    metaDescription:
      "Abogadas portuguesas licenciadas emiten tu NIF con representación fiscal y abren tu cuenta bancaria en Portugal de forma remota. Los dos documentos que tu visado D7 o D8 no puede saltarse. Más de 800 casos. Sin intermediarios.",

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
      live: "Aceptando nuevos clientes",
      label: "Cupos abiertos para mayo/26",
    },

    hero: {
      issueLabel: "Expediente",
      issueDate: "Lisboa · Desde 2017",
      eyebrow: "Un bufete jurídico portugués. Sin agencia de por medio.",
      kicker: "Tu agencia de relocation nos iba a contratar de todas formas.",
      titlePre: "Tu documentación para Portugal,",
      titleEm: "bien hecha",
      titleEm2: "desde el inicio",
      titlePost: ".",
      lede: "NIF, representación fiscal y cuenta bancaria portuguesa. Las dos cosas que tu visado D7 o D8 no puede saltarse. Gestionadas por las abogadas que la mayoría de las agencias de relocation subcontratan, sin la agencia y sin el markup.",
      ctaPrimary: "Agendar llamada",
      ctaSecondary: "Ver cómo funciona",
      photoCaption: "Patrícia Viana, OA Portugal · OAB Brasil",
      floatingChips: [
        { label: "OA Portugal · 1148L" },
        { label: "Abogada en cada expediente" },
        { label: "800+ casos desde 2017" },
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
      title:
        "Todo visado D7 necesita una abogada portuguesa. La pregunta es cuántas capas pagas.",
      lede: "Las agencias de relocation compran servicios jurídicos a abogadas licenciadas, les aplican un margen y te los revenden. Cuando trabajas directamente con Alttavia, quien firma tus documentos es quien atiende tus llamadas.",
      headerLeft: "A través de una agencia de relocation",
      headerRight: "Directamente con Alttavia",
      rows: [
        {
          left: "Un comercial abre tu expediente. Conoces a la abogada casi al final, brevemente.",
          right:
            "Una abogada licenciada toma tu expediente el día 1 y lo mantiene hasta el cierre.",
        },
        {
          left: "La representación fiscal se subcontrata. Raramente sabes quién la tiene.",
          right:
            "Nosotros emitimos y mantenemos tu representación fiscal. Sin terceros, sin nombre desconocido.",
        },
        {
          left: "El dossier bancario se envía tal cual. Los problemas de compliance aparecen solo tras el rechazo.",
          right:
            "Cada dossier bancario se revisa antes de presentarlo. La mayoría se aprueba al primer intento.",
        },
        {
          left: "Tres equipos, dos transferencias, un hilo de email lento.",
          right:
            "Una abogada nombrada. Un solo hilo. Cada decisión documentada por escrito.",
        },
        {
          left: "El coste final incluye extras y cargos en la letra pequeña.",
          right:
            "Honorario fijo, por escrito, antes de que empiece cualquier trabajo. Sin añadidos, sin sorpresas.",
        },
      ],
    },

    services: {
      eyebrow: "Qué gestionamos",
      title: "Dos requisitos legales. Un bufete. Nadie más en la cadena.",
      lede: "Tu consulado exigirá ambos antes de la entrevista. La mayoría lo descubre demasiado tarde. Nosotros los gestionamos, de forma remota, desde la misma oficina de Lisboa que lleva haciendo esto desde 2017.",
      bento: {
        nifTag: "Candidatos a D7 y D8 lo necesitan primero",
        nifNumber: "01",
        nifTitle: "NIF con representación fiscal",
        nifDesc:
          "El número de identificación fiscal portugués, más una representante fiscal licenciada con dirección en Portugal. Sin el NIF no puedes alquilar, abrir cuenta, matricular hijos ni reservar entrevista consular. El cargo de representante fiscal está reservado por ley a abogadas licenciadas.",
        nifBullets: [
          "Representante fiscal licenciada incluida",
          "Emisión en 3 a 5 días hábiles",
          "100% remoto, sin necesidad de viajar a Portugal",
        ],
        nifCta: "Obtener mi NIF",
        bankTag: "Obligatoria para D7 y Golden Visa",
        bankNumber: "02",
        bankTitle: "Cuenta bancaria portuguesa para no residentes",
        bankDesc:
          "Tu consulado quiere fondos ya depositados en una cuenta portuguesa antes de la entrevista, no solo un justificante de transferencia. La mayoría de los bancos portugueses rechazan solicitudes desde el exterior. Abrimos la tuya a través de bancos asociados que trabajan con no residentes y preparamos todo el dossier de compliance.",
        bankBullets: [
          "Bancos asociados con experiencia en no residentes",
          "Dossier completo de KYC y compliance preparado para ti",
          "Fondos confirmados antes de tu entrevista consular",
        ],
        bankCta: "Abrir mi cuenta",
        sideOne: {
          tag: "Incluido",
          title: "Revisión del calendario consular",
          desc: "Mapeamos tus plazos de NIF y banco contra las fechas disponibles de tu consulado antes de que te comprometas.",
        },
        sideTwo: {
          tag: "Incluido",
          title: "Segunda revisión antes de la presentación",
          desc: "Una segunda abogada lee cada expediente antes de que salga de la oficina. Una revisión cuando aún se puede corregir.",
        },
      },
    },

    process: {
      eyebrow: "De tu casa a una dirección en Lisboa",
      title: "Cuatro pasos. Una abogada en todo momento.",
      lede: "Siempre sabes en qué paso está tu expediente, quién lo tiene y qué falta. Sin tener que pedir actualizaciones.",
      steps: [
        {
          n: "01",
          title: "Llamada",
          duration: "Día 1",
          desc: "Llamada gratuita con la abogada que llevaría tu expediente. Lee tu situación, nombra los documentos necesarios y envía una propuesta con honorario fijo por escrito. Sin compromiso.",
        },
        {
          n: "02",
          title: "Firma",
          duration: "Días 2 a 5",
          desc: "Poder notarial digital. Emitimos tu NIF, registramos la representación fiscal en la Autoridad Tributaria y abrimos el dossier de compliance con un banco asociado.",
        },
        {
          n: "03",
          title: "Presentación",
          duration: "Semanas 2 a 4",
          desc: "Presentación al banco, revisión de compliance, seguimiento hasta que tu cuenta esté activa. Certificado de NIF en tu bandeja. Fechas consulares alineadas.",
        },
        {
          n: "04",
          title: "Listo",
          duration: "Semana 4+",
          desc: "Fondos transferidos y confirmados. Todos los documentos preparados para la entrevista consular. Seguimos como tu representante fiscal el tiempo que tu visado requiera.",
        },
      ],
      footnote:
        "La mayoría de los expedientes llegan al paso 04 en cuatro semanas. Los casos de compliance complejo pueden tardar hasta seis.",
    },

    bigStats: {
      eyebrow: "Ocho años. Un bufete.",
      title:
        "Lo que trabajar el lado jurídico del relocation enseña con el tiempo.",
      items: [
        {
          number: "800+",
          label: "expedientes cerrados",
          caption: "Desde 2017. Todos firmados por abogada licenciada.",
        },
        {
          number: "8",
          label: "años de práctica",
          caption: "Patrícia en el colegio portugués, antes en el brasileño.",
        },
        {
          number: "100%",
          label: "con abogada al frente",
          caption: "Cada expediente. Sin excepciones, sin transferencias.",
        },
        {
          number: "0",
          label: "intermediarios",
          caption: "Sin revendedor, sin markup, sin subcontratado desconocido.",
        },
      ],
    },

    founder: {
      eyebrow: "La abogada en tu expediente",
      title:
        "Patrícia Viana. Fundó este bufete porque estaba cansada de ser la abogada invisible que hacía el trabajo.",
      bio: "Abogada portuguesa licenciada desde 2017 (OA 1148L), con experiencia previa en el colegio brasileño (OAB SP). Durante años, las agencias de relocation le enviaban expedientes para preparar para clientes que nunca sabrían su nombre. Fundó Alttavia para que el cliente pudiera llamar a la abogada primero. Portugués nativo. Inglés fluido. Español fluido.",
      quote:
        "Quiero que cada cliente salga de esa primera llamada sabiendo exactamente qué pasa a continuación, quién lo gestiona y por qué va a funcionar.",
      credentials: [
        { label: "OA Portugal", value: "1148L" },
        { label: "OAB Brasil", value: "Activa" },
        { label: "Idiomas", value: "PT · EN · ES" },
        { label: "Práctica", value: "Desde 2017" },
      ],
      stickerCta: "Agendar 30 min con Patrícia",
    },

    globe: {
      eyebrow: "Una oficina. Todos los husos horarios.",
      title: "Expedientes firmados en Lisboa. Llamadas a tu hora.",
      lede: "Trabajamos desde una sola oficina en Lisboa, donde cada documento se prepara y se firma. Tus llamadas ocurren en tu huso horario. El expediente que llega al escritorio de tu consulado se lee exactamente como si lo hubiera preparado una abogada lisboeta. Porque así fue.",
      cityListLabel: "Ciudades recientes de clientes",
    },

    faq: {
      eyebrow: "Antes de la llamada",
      title: "Las preguntas que los clientes traen a la primera conversación.",
      categories: ["Elegibilidad", "Precio", "Plazos", "Logística"],
      items: [
        {
          n: "01",
          category: "Elegibilidad",
          q: "¿Puedo obtener el NIF o abrir una cuenta bancaria portuguesa sin abogada?",
          a: "Ambos requieren una abogada portuguesa licenciada por ley. La Autoridad Tributaria exige un representante fiscal con dirección en Portugal, cargo reservado solo a abogadas licenciadas en el país. La mayoría de los bancos portugueses rechazan solicitudes directas desde el exterior. Los pocos que trabajan con no residentes exigen un dossier de compliance que nuestro equipo prepara para ti. Intentar cualquiera de los dos sin representación legal casi siempre termina en rechazo o retrasos que posponen tu entrevista consular varios meses.",
        },
        {
          n: "02",
          category: "Precio",
          q: "¿Cuánto cuesta?",
          a: "Enviamos una propuesta con honorario fijo por escrito después de la primera llamada, antes de que empiece cualquier trabajo. Sabrás exactamente lo que pagas, por exactamente qué alcance, con el nombre de la abogada en tu expediente. Compáralo con el coste de un visado denegado o tres meses de retraso en tu mudanza. Compáralo también con lo que una agencia cobra por el mismo trabajo que habría subcontratado con nosotros.",
        },
        {
          n: "03",
          category: "Plazos",
          q: "¿Cuánto tarda cada etapa?",
          a: "La emisión del NIF suele tardar de 3 a 5 días hábiles desde que recibimos tus documentos. La apertura de cuenta bancaria remota tarda de 2 a 4 semanas, según el análisis de compliance del banco y tu nacionalidad. Recibes un plazo realista antes de comprometerte y una actualización en cada etapa, sin necesidad de pedirla.",
        },
        {
          n: "04",
          category: "Logística",
          q: "¿Tengo que viajar a Portugal en algún momento?",
          a: "No. Ambos servicios son totalmente remotos. Tú firmas electrónicamente, nosotros presentamos ante las autoridades portuguesas y el banco revisa desde donde estés. Visitar Lisboa tiene sentido cuando tu cuenta ya esté activa y quieras conocer la ciudad a la que te mudas.",
        },
        {
          n: "05",
          category: "Elegibilidad",
          q: "Voy a solicitar el visado D7. ¿Necesito ambos servicios?",
          a: "Sí. El D7 requiere un NIF con representante fiscal registrada y una cuenta bancaria portuguesa con fondos ya depositados, ambos confirmados antes de la entrevista consular. Un documento que falta es suficiente para que el consulado rechace la solicitud. Gestionamos los dos y coordinamos los plazos para que nada llegue tarde.",
        },
        {
          n: "06",
          category: "Logística",
          q: "¿Qué documentos necesitas de mi parte?",
          a: "Normalmente tu pasaporte, comprobante de domicilio, comprobante de ingresos o pensión y un cuestionario breve que enviamos tras la llamada. Los requisitos exactos dependen de tu nacionalidad y el tipo de visado. Lo confirmamos todo por escrito antes de que ningún documento salga de tu bandeja.",
        },
        {
          n: "07",
          category: "Logística",
          q: "¿Qué pasa si el banco rechaza mi solicitud?",
          a: "Ocurre raramente, porque revisamos cada expediente antes de presentarlo. Cuando sucede, abrimos con otro banco asociado sin coste adicional. Tu proceso no se cierra hasta que tu cuenta esté activa y con fondos.",
        },
      ],
    },

    contact: {
      eyebrow: "Iniciar el expediente",
      title: "Una llamada. Un plan por escrito.\nEl nombre de tu abogada.",
      desc: "La primera llamada es gratuita, con una abogada licenciada, sin compromiso. Sales de ella con un alcance claro, un honorario fijo en papel y el nombre de quien gestionará tu expediente desde el primer día.",
      replyTime: "Respondemos en un día hábil",
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
        interest: "Necesito ayuda con",
        message: "Cuéntanos tu situación",
        submit: "Iniciar mi expediente",
        disclaimer:
          "Al enviar, aceptas nuestra política de privacidad. Respondemos en un día hábil.",
      },
      formPlaceholders: {
        name: "¿Cómo podemos llamarte?",
        email: "tu@email.com",
        phone: "+34 600 000 000",
        country: "España, México, Argentina, ...",
        message:
          "¿En qué punto de la mudanza estás, y qué haría el proceso más fácil?",
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
        "Un bufete jurídico portugués que gestiona la base legal para quienes se mudan a Portugal. NIF, representación fiscal y cuentas bancarias remotas para candidatos a D7, D8 y Golden Visa.",
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
