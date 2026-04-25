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
      "Licensed Portuguese lawyers issue your NIF with fiscal representation and open your Portuguese bank account remotely. Two documents your D7 or D8 visa needs. Over 800 cases handled.",

    navCtaLabel: "Start my application",
    nav: [
      { href: "#services", label: "Services" },
      { href: "#why", label: "Why us" },
      { href: "#about", label: "About" },
      { href: "#faq", label: "FAQ" },
      { href: "#contact", label: "Contact" },
    ],

    hero: {
      eyebrow: "Portuguese lawyers. No middleman.",
      titleBefore: "The same",
      titleHighlight: "lawyers",
      titleAfter: " other firms hire.",
      subtitle:
        "Your Portuguese NIF and bank account, opened without you leaving home. The two documents your D7 or D8 visa needs. Handled by us, over 800 times.",
      ctaPrimary: "Request my NIF",
      ctaSecondary: "Open my bank account",
      cardTitle: "Patrícia Viana",
      cardRole: "OA Portugal · OAB Brasil",
      cardDesc:
        "Your case is handled by a licensed attorney, start to finish.",
      stats: [
        { number: "800+", label: "cases handled" },
        { number: "100%", label: "attorney-led" },
        { number: "100%", label: "remote" },
      ],
    },

    services: {
      eyebrow: "What we do",
      title: "Two documents. One law firm. Zero intermediaries.",
      desc: "Two steps decide your D7 or D8 visa. Relocation firms across the market call us to handle them. Now you can call us directly.",
      items: [
        {
          id: "nif",
          tag: "Essential for D7 applicants",
          title: "NIF with fiscal representation",
          subtitle: "Your Portuguese tax ID, required from day one.",
          body: "The NIF is Portugal's tax ID. Without it you can't rent, bank, or enroll children. D7 applicants also need a registered fiscal representative inside Portugal, a role only a lawyer can hold.",
          body2:
            "We issue your NIF remotely and stay on as your fiscal representative for as long as you need.",
          bullets: [
            "100% remote, no travel needed",
            "Registered fiscal representative included",
            "Required before D7 and D8 visa interviews",
            "Needed for banking, rentals, utilities, and schools",
          ],
          cta: "Request my NIF",
        },
        {
          id: "bank",
          tag: "Essential for D7 and Golden Visa applicants",
          title: "Remote bank account for non-residents",
          subtitle: "Proof of funds your visa cannot move without.",
          body: "Portuguese consulates ask for funds already in a Portuguese bank account. A fixed condition of the D7 and Golden Visa. Most banks reject foreign applications. The few that accept them ask for a complex KYC file.",
          body2:
            "We open your account with our banking partners, build the compliance file, and follow it through until your funds clear.",
          bullets: [
            "100% remote, signed digitally",
            "Full KYC and compliance support",
            "Accepted for D7 and Golden Visa",
            "Pre-screened file to reduce rejection risk",
          ],
          cta: "Open my bank account",
        },
      ],
    },

    whyUs: {
      eyebrow: "Why Alttavia Relocation",
      title: "Other relocation firms outsource their legal work to us.",
      intro:
        "When a relocation firm needs a NIF or a bank account for a client, they call a Portuguese lawyer. That call often lands here. Skip the middleman.",
      items: [
        {
          title: "Handled by actual attorneys",
          desc: "Your NIF, your bank account, your fiscal representation. All managed personally by licensed Portuguese lawyers, never sales teams, paralegals, or third parties.",
        },
        {
          title: "The firm other firms call",
          desc: "When the industry needs legal work done for clients, they outsource it to us. With Alttavia, you work directly with the team the market already relies on.",
        },
        {
          title: "Specialists in D7 and D8 visas",
          desc: "We know the documentation, the compliance, the consular expectations. Over 800 cases in passive-income visas, digital-nomad visas, Golden Visa, and consular proceedings.",
        },
        {
          title: "Remote from start to finish",
          desc: "Everything is signed, filed, and followed up without you leaving home. You always know what's happening, when, and why, in plain English.",
        },
      ],
    },

    about: {
      eyebrow: "Our story",
      title: "Founded because the lawyer was always the last to be called.",
      paragraphs: [
        "Alttavia Relocation started with one observation. As a Portuguese attorney, I kept getting calls from relocation companies who wanted to subcontract their legal work. Every one of them eventually needed a lawyer. If I was already doing it, I could do it directly. No markup. No middleman.",
        "Our mission is straightforward. Make moving to Portugal feel less like paperwork and more like the start of a new life.",
        "Everything we do goes through a Portuguese-licensed lawyer. When you trust someone with your fiscal identity and the money behind your new life, who actually handles it matters.",
      ],
      highlight: {
        name: "Patrícia Viana",
        role: "Founder, OA Portugal & OAB Brasil",
        quote:
          "I want every client to feel the calm I wish I had had the first time I ever did this myself.",
      },
      stats: [
        { number: "800+", label: "cases handled" },
        { number: "10+", label: "years of practice" },
        { number: "100%", label: "attorney-led" },
      ],
    },

    principles: {
      eyebrow: "How we work",
      title: "Four principles we will not outsource.",
      items: [
        {
          quote:
            "Paperwork shouldn't hold your life back. Every step is scheduled, acted on, and reported in writing.",
          attribution: "On celerity",
        },
        {
          quote:
            "If we can't help you, we say so. If we can, we tell you exactly how, in writing, before you commit.",
          attribution: "On ethics",
        },
        {
          quote:
            "Your attorney is your point of contact. No sales layer. No handoff to paralegals. No surprise invoices.",
          attribution: "On direct access",
        },
        {
          quote:
            "Moving abroad is a life-sized decision. You deserve the room to ask every question, in the language that feels most yours.",
          attribution: "On empathy",
        },
      ],
    },

    faq: {
      eyebrow: "Frequently asked",
      title: "The questions most clients bring to the first call.",
      items: [
        {
          q: "Can I get my NIF or open a Portuguese bank account by myself?",
          a: "Both processes need Portuguese legal representation, an in-country address, and KYC compliance built for non-residents. The Tax Authority requires a fiscal representative with a Portuguese address. Most banks refuse direct applications from abroad. These are legal requirements only a licensed Portuguese lawyer can carry out for you.",
        },
        {
          q: "Is it expensive?",
          a: "Compared to a denied visa, a rejected bank account, or months of avoidable delay, no. Our pricing is flat and written down before any work begins. You'll know exactly what you're paying and exactly what you get.",
        },
        {
          q: "How long does each process take?",
          a: "NIF issuance usually takes 3 to 5 business days after we receive your documents. Remote bank account opening takes 2 to 4 weeks depending on the bank's compliance review and your nationality. We give you realistic timelines before you commit and update you as they evolve.",
        },
        {
          q: "Do I need to travel to Portugal for any of this?",
          a: "No. Both services are fully remote. You sign, we file, the authorities and the bank approve, from wherever you are. Visiting only makes sense once your account is live and you want to see your new city.",
        },
        {
          q: "I'm applying for a D7 visa. Do I need both services?",
          a: "Yes. The D7 needs a NIF (with a registered fiscal representative) and a Portuguese bank account with deposited funds before the consular interview. Without one of them the consulate won't approve the application.",
        },
        {
          q: "What documents will I need to provide?",
          a: "Usually your passport, a proof of address, proof of income or pension, and a short questionnaire we send you. Exact requirements depend on your nationality and visa type. We confirm everything before any document leaves your inbox.",
        },
        {
          q: "What if the bank rejects my application?",
          a: "It rarely happens, because our compliance team reviews every file before it goes in. If it does, we open with another partner bank at no extra cost. Your process doesn't stop until your account is live.",
        },
      ],
    },

    ctaBanner: {
      title: "Ready to start?",
      desc: "A first call is free and without commitment. You'll leave it with a clear plan, written pricing, and the name of the attorney handling your case.",
      button: "Start my application",
    },

    contact: {
      eyebrow: "Let's talk",
      title: "Tell us where you are.\nWe'll tell you what comes next.",
      desc: "Fill the form and one of our attorneys replies inside one business day. Everything you share is protected by attorney-client privilege.",
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
        interest: "I'm interested in",
        message: "Tell us a little about your plans",
        submit: "Send my request",
        disclaimer:
          "By submitting, you agree to our privacy policy. We respond within one business day.",
      },
      formPlaceholders: {
        name: "How should we address you?",
        email: "your@email.com",
        phone: "+1 (555) 000 0000",
        country: "United States, UK, Brazil, …",
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

    location: {
      eyebrow: "Come visit, or don't",
      title: "Our office is in the heart of Lisbon.",
      desc: "Everything we do is remote. You don't need to cross an ocean for the paperwork to be done. If you're already in Lisbon, or plan to be once you have the keys, drop by.",
      openMaps: "Open in Google Maps",
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
  },

  pt: {
    cityLabel: "Lisboa",
    country: "Portugal",
    officeHours: "Seg a sex, 10h às 18h WET",

    metaTitle:
      "Alttavia Relocation. NIF e conta bancária em Portugal com advogados licenciados.",
    metaDescription:
      "Advogados portugueses licenciados emitem o seu NIF com representação fiscal e abrem a sua conta bancária portuguesa de forma remota. Os dois documentos que o visto D7 ou D8 exige. Mais de 800 casos conduzidos.",

    navCtaLabel: "Quero aplicar",
    nav: [
      { href: "#services", label: "Serviços" },
      { href: "#why", label: "Por que nós" },
      { href: "#about", label: "Sobre" },
      { href: "#faq", label: "FAQ" },
      { href: "#contact", label: "Contato" },
    ],

    hero: {
      eyebrow: "Advogados portugueses. Sem intermediários.",
      titleBefore: "Os mesmos",
      titleHighlight: "advogados",
      titleAfter: " que outras firmas contratam.",
      subtitle:
        "NIF e conta bancária em Portugal abertos sem você sair de casa. Os dois documentos que o D7 e o D8 exigem, conduzidos por nós, mais de 800 vezes.",
      ctaPrimary: "Solicitar meu NIF",
      ctaSecondary: "Abrir minha conta bancária",
      cardTitle: "Patrícia Viana",
      cardRole: "OA Portugal · OAB Brasil",
      cardDesc:
        "Seu caso conduzido por uma advogada licenciada, do começo ao fim.",
      stats: [
        { number: "800+", label: "casos conduzidos" },
        { number: "100%", label: "advogada à frente" },
        { number: "100%", label: "remoto" },
      ],
    },

    services: {
      eyebrow: "O que fazemos",
      title: "Dois documentos. Um escritório. Zero intermediários.",
      desc: "Duas etapas decidem o seu visto D7 ou D8. Empresas de relocation pelo mundo nos chamam para executá-las. Agora você pode chamar a gente direto.",
      items: [
        {
          id: "nif",
          tag: "Essencial para candidatos ao D7",
          title: "NIF com representação fiscal",
          subtitle: "A sua identidade fiscal portuguesa, obrigatória desde o primeiro dia.",
          body: "O NIF é o CPF português. Sem ele, você não aluga, não abre conta, não matricula filhos. Quem aplica para o D7 ainda precisa de um representante fiscal em Portugal, função reservada a advogados.",
          body2:
            "Emitimos o seu NIF remotamente e seguimos como seu representante o tempo que precisar.",
          bullets: [
            "100% remoto, sem viagens",
            "Representante fiscal inscrito incluído",
            "Obrigatório antes das entrevistas D7 e D8",
            "Necessário para banco, aluguel, contas e escolas",
          ],
          cta: "Solicitar meu NIF",
        },
        {
          id: "bank",
          tag: "Essencial para D7 e Golden Visa",
          title: "Conta bancária remota para não-residentes",
          subtitle: "Prova de fundos sem a qual nenhum visto avança.",
          body: "Os consulados pedem fundos já em conta portuguesa. Exigência fixa do D7 e do Golden Visa. A maioria dos bancos recusa pedidos do exterior. Os poucos que aceitam pedem KYC complexo.",
          body2:
            "Abrimos a sua conta com bancos parceiros, montamos o compliance e acompanhamos até o dinheiro cair.",
          bullets: [
            "100% remoto, com assinatura digital",
            "Suporte completo de KYC e compliance",
            "Aceita para D7 e Golden Visa",
            "Dossier pré-revisado para reduzir recusas",
          ],
          cta: "Abrir minha conta bancária",
        },
      ],
    },

    whyUs: {
      eyebrow: "Por que Alttavia Relocation",
      title: "Outras empresas de relocation terceirizam o jurídico para nós.",
      intro:
        "Quando uma empresa de relocation precisa de NIF ou conta para um cliente, ela liga para um advogado. Essa ligação chega aqui com frequência. Pule o intermediário.",
      items: [
        {
          title: "Conduzido por advogados",
          desc: "Seu NIF, sua conta bancária, sua representação fiscal. Tudo cuidado pessoalmente por advogados portugueses, nunca por equipe comercial, estagiários ou terceiros.",
        },
        {
          title: "O escritório que as outras empresas chamam",
          desc: "Quando o setor precisa de jurídico para os próprios clientes, terceiriza para nós. Com a Alttavia, você trabalha direto com a equipe em que o mercado já confia.",
        },
        {
          title: "Especialistas em visto D7 e D8",
          desc: "Conhecemos a documentação, o compliance, as expectativas consulares. Mais de 800 casos em vistos de renda passiva, nômade digital, Golden Visa e processos consulares.",
        },
        {
          title: "Remoto do início ao fim",
          desc: "Tudo é assinado, protocolado e acompanhado sem você sair de casa. Você sempre sabe o que está acontecendo, quando e por quê, em linguagem clara.",
        },
      ],
    },

    about: {
      eyebrow: "Nossa história",
      title: "Nasceu porque o advogado sempre era o último a ser chamado.",
      paragraphs: [
        "A Alttavia Relocation começou com uma observação. Como advogada portuguesa, eu recebia ligações de empresas de relocation pedindo para subcontratar o jurídico. No fim, todas precisavam de um advogado. Se eu já fazia o trabalho, podia fazer direto. Sem markup. Sem intermediário.",
        "Nossa missão é direta: mudar para Portugal deve parecer menos com burocracia e mais com começar uma nova vida.",
        "Tudo o que fazemos passa por um advogado licenciado em Portugal. Quando você confia sua identidade fiscal e o dinheiro da sua nova vida, quem cuida disso importa.",
      ],
      highlight: {
        name: "Patrícia Viana",
        role: "Fundadora, OA Portugal & OAB Brasil",
        quote:
          "Quero que cada cliente sinta a calma que eu queria ter sentido na primeira vez em que precisei fazer isso sozinha.",
      },
      stats: [
        { number: "800+", label: "casos conduzidos" },
        { number: "10+", label: "anos de prática" },
        { number: "100%", label: "advogada à frente" },
      ],
    },

    principles: {
      eyebrow: "Como trabalhamos",
      title: "Quatro princípios que não terceirizamos.",
      items: [
        {
          quote:
            "Burocracia não pode segurar a sua vida. Cada etapa é agendada, executada e reportada por escrito.",
          attribution: "Sobre celeridade",
        },
        {
          quote:
            "Se não podemos ajudar, dizemos. Se podemos, contamos exatamente como, por escrito, antes de você se comprometer.",
          attribution: "Sobre ética",
        },
        {
          quote:
            "A sua advogada é o seu ponto de contato. Sem camada comercial. Sem repasse para estagiários. Sem fatura-surpresa.",
          attribution: "Sobre acesso direto",
        },
        {
          quote:
            "Mudar de país é uma decisão do tamanho de uma vida. Você merece espaço para fazer cada pergunta, no idioma em que se sente mais em casa.",
          attribution: "Sobre empatia",
        },
      ],
    },

    faq: {
      eyebrow: "Perguntas frequentes",
      title: "As dúvidas que quase todo cliente traz na primeira conversa.",
      items: [
        {
          q: "Posso obter o NIF ou abrir uma conta portuguesa sozinho?",
          a: "Os dois processos exigem representação legal em Portugal, morada no país e regras de KYC desenhadas para não-residentes. A Autoridade Tributária pede um representante fiscal com endereço português. A maioria dos bancos recusa candidaturas diretas vindas do exterior. Não são formalidades, são exigências legais que apenas um advogado português licenciado pode cumprir por você.",
        },
        {
          q: "É caro?",
          a: "Comparado a um visto negado, uma conta recusada ou meses de atraso evitável, não. Nosso preço é fixo e está no papel antes de qualquer trabalho começar. Você sabe exatamente o que está pagando e o que recebe.",
        },
        {
          q: "Quanto tempo cada processo leva?",
          a: "Emissão do NIF: tipicamente 3 a 5 dias úteis depois de recebermos a documentação. Abertura de conta bancária remota: 2 a 4 semanas, conforme o compliance do banco e a sua nacionalidade. Comunicamos prazos realistas antes de você se comprometer e atualizamos conforme avançam.",
        },
        {
          q: "Preciso viajar para Portugal em alguma etapa?",
          a: "Não. Os dois serviços são totalmente remotos. Você assina, nós protocolamos, as autoridades e o banco aprovam, de onde você estiver. Uma visita só faz sentido quando a conta já estiver ativa e você quiser conhecer a sua nova cidade.",
        },
        {
          q: "Vou aplicar para o D7. Preciso dos dois serviços?",
          a: "Sim. O D7 exige NIF (com representante fiscal inscrito) e conta bancária portuguesa com fundos depositados antes da entrevista consular. Sem um dos dois, o consulado não aprova a candidatura.",
        },
        {
          q: "Quais documentos vou precisar?",
          a: "Em geral: passaporte, comprovante de residência, comprovante de rendimento ou aposentadoria e um questionário curto que enviamos. As exigências exatas dependem da sua nacionalidade e do tipo de visto. Confirmamos tudo antes de qualquer documento sair da sua caixa.",
        },
        {
          q: "E se o banco recusar minha candidatura?",
          a: "Raramente acontece, porque a nossa equipe de compliance revisa cada dossier antes da submissão. Se acontecer, abrimos com outro banco parceiro sem custo extra. Seu processo não para até a sua conta estar ativa.",
        },
      ],
    },

    ctaBanner: {
      title: "Pronta para começar?",
      desc: "Uma primeira conversa é gratuita e sem compromisso. Você sai dela com um plano claro, preço por escrito e o nome da advogada que vai cuidar do seu caso.",
      button: "Quero aplicar",
    },

    contact: {
      eyebrow: "Vamos conversar",
      title: "Conte onde você está.\nA gente diz o que vem a seguir.",
      desc: "Preencha o formulário e uma de nossas advogadas retorna em até um dia útil. Tudo o que você compartilhar fica protegido pelo sigilo profissional.",
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
        message: "Conte um pouco do seu momento",
        submit: "Enviar mensagem",
        disclaimer:
          "Ao enviar, você concorda com nossa política de privacidade. Respondemos em até um dia útil.",
      },
      formPlaceholders: {
        name: "Como podemos chamar você?",
        email: "seu@email.com",
        phone: "+55 (11) 99999 9999",
        country: "Brasil, Estados Unidos, Reino Unido, …",
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

    location: {
      eyebrow: "Venha visitar, ou não",
      title: "Nosso escritório fica no coração de Lisboa.",
      desc: "Tudo o que fazemos é remoto. Você não precisa atravessar o oceano para a papelada ficar pronta. Se já está em Lisboa, ou se vai estar assim que pegar as chaves, é só passar.",
      openMaps: "Abrir no Google Maps",
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
  },

  es: {
    cityLabel: "Lisboa",
    country: "Portugal",
    officeHours: "Lun a vie, 10:00 a 18:00 WET",

    metaTitle:
      "Alttavia Relocation. NIF y cuenta bancaria portuguesa con abogados licenciados.",
    metaDescription:
      "Abogados portugueses licenciados emiten tu NIF con representación fiscal y abren tu cuenta bancaria portuguesa de forma remota. Los dos documentos que tu visado D7 o D8 necesita. Más de 800 casos gestionados.",

    navCtaLabel: "Iniciar mi solicitud",
    nav: [
      { href: "#services", label: "Servicios" },
      { href: "#why", label: "Por qué nosotros" },
      { href: "#about", label: "Nosotros" },
      { href: "#faq", label: "FAQ" },
      { href: "#contact", label: "Contacto" },
    ],

    hero: {
      eyebrow: "Abogados portugueses. Sin intermediarios.",
      titleBefore: "Los mismos",
      titleHighlight: "abogados",
      titleAfter: " que otras firmas contratan.",
      subtitle:
        "Tu NIF y tu cuenta bancaria portuguesa, sin salir de casa. Los dos documentos que exigen los visados D7 y D8, resueltos por nosotros más de 800 veces.",
      ctaPrimary: "Solicitar mi NIF",
      ctaSecondary: "Abrir mi cuenta bancaria",
      cardTitle: "Patrícia Viana",
      cardRole: "OA Portugal · OAB Brasil",
      cardDesc:
        "Tu caso lo lleva una abogada licenciada, de principio a fin.",
      stats: [
        { number: "800+", label: "casos gestionados" },
        { number: "100%", label: "con abogada al frente" },
        { number: "100%", label: "remoto" },
      ],
    },

    services: {
      eyebrow: "Qué hacemos",
      title: "Dos documentos. Un bufete. Cero intermediarios.",
      desc: "Dos pasos deciden tu visado D7 o D8. Las firmas de relocation del mundo nos llaman para resolverlos. Ahora puedes llamarnos directamente.",
      items: [
        {
          id: "nif",
          tag: "Esencial para solicitantes del D7",
          title: "NIF con representación fiscal",
          subtitle: "Tu identidad fiscal portuguesa, obligatoria desde el primer día.",
          body: "El NIF es el equivalente al CPF brasileño y al NIE español. Sin él no alquilas, no abres cuenta, no matriculas a tus hijos. Quien solicita el D7 además necesita un representante fiscal en Portugal, una función reservada a abogados.",
          body2:
            "Emitimos tu NIF de forma remota y seguimos como tu representante el tiempo que necesites.",
          bullets: [
            "100% remoto, sin viajar",
            "Representante fiscal registrado incluido",
            "Obligatorio antes de las entrevistas D7 y D8",
            "Necesario para bancos, alquileres, servicios y colegios",
          ],
          cta: "Solicitar mi NIF",
        },
        {
          id: "bank",
          tag: "Esencial para D7 y Golden Visa",
          title: "Cuenta bancaria remota para no residentes",
          subtitle: "Una prueba de fondos sin la cual ningún visado avanza.",
          body: "Los consulados piden fondos ya en una cuenta portuguesa. Condición fija del D7 y del Golden Visa. La mayoría de los bancos rechaza solicitudes del extranjero. Los que aceptan piden un KYC complejo.",
          body2:
            "Abrimos tu cuenta con nuestros bancos asociados, montamos el compliance y seguimos hasta que el dinero entra.",
          bullets: [
            "100% remoto, firma digital",
            "Soporte completo de KYC y compliance",
            "Aceptada para D7 y Golden Visa",
            "Dossier pre-revisado para reducir rechazos",
          ],
          cta: "Abrir mi cuenta bancaria",
        },
      ],
    },

    whyUs: {
      eyebrow: "Por qué Alttavia Relocation",
      title: "Otras firmas de relocation tercerizan lo jurídico con nosotros.",
      intro:
        "Cuando una firma de relocation necesita un NIF o una cuenta para un cliente, llama a un abogado portugués. Esa llamada termina aquí muchas veces. Sáltate al intermediario.",
      items: [
        {
          title: "Lo gestionan abogados reales",
          desc: "Tu NIF, tu cuenta bancaria, tu representación fiscal. Todo lo lleva personalmente un abogado portugués, nunca equipos comerciales, pasantes o terceros.",
        },
        {
          title: "El bufete al que llaman las otras firmas",
          desc: "Cuando el sector necesita trabajo jurídico para sus clientes, lo terceriza a nosotros. Con Alttavia, trabajas directamente con el equipo en el que el mercado ya confía.",
        },
        {
          title: "Especialistas en visados D7 y D8",
          desc: "Conocemos la documentación, el compliance, las expectativas consulares. Más de 800 casos en visados de ingresos pasivos, nómadas digitales, Golden Visa y procedimientos consulares.",
        },
        {
          title: "Remoto de principio a fin",
          desc: "Todo se firma, se presenta y se sigue sin salir de casa. Sabes siempre qué está pasando, cuándo y por qué, en lenguaje claro.",
        },
      ],
    },

    about: {
      eyebrow: "Nuestra historia",
      title: "Nacida porque al abogado siempre lo llamaban al final.",
      paragraphs: [
        "Alttavia Relocation nació de una observación. Como abogada portuguesa, recibía llamadas de firmas de relocation que querían subcontratar lo jurídico. Todas, al final, necesitaban un abogado. Si yo ya hacía el trabajo, podía hacerlo directo. Sin markup. Sin intermediario.",
        "Nuestra misión es directa: que mudarse a Portugal se parezca menos a papeleo y más al principio de una vida nueva.",
        "Todo lo que hacemos pasa por un abogado licenciado en Portugal. Cuando le confías a alguien tu identidad fiscal y el dinero detrás de tu vida nueva, importa quién lo gestiona.",
      ],
      highlight: {
        name: "Patrícia Viana",
        role: "Fundadora, OA Portugal & OAB Brasil",
        quote:
          "Quiero que cada cliente sienta la calma que me habría gustado tener la primera vez que tuve que hacer esto.",
      },
      stats: [
        { number: "800+", label: "casos gestionados" },
        { number: "10+", label: "años de práctica" },
        { number: "100%", label: "con abogada al frente" },
      ],
    },

    principles: {
      eyebrow: "Cómo trabajamos",
      title: "Cuatro principios que no tercerizamos.",
      items: [
        {
          quote:
            "La burocracia no puede detener tu vida. Cada paso se agenda, se ejecuta y se reporta por escrito.",
          attribution: "Sobre celeridad",
        },
        {
          quote:
            "Si no podemos ayudarte, lo decimos. Si podemos, te decimos exactamente cómo, por escrito, antes de que te comprometas.",
          attribution: "Sobre ética",
        },
        {
          quote:
            "Tu abogada es tu punto de contacto. Sin capa comercial. Sin traspaso a pasantes. Sin facturas sorpresa.",
          attribution: "Sobre acceso directo",
        },
        {
          quote:
            "Mudarse de país es una decisión del tamaño de una vida. Mereces espacio para hacer todas las preguntas, en el idioma que te resulte más tuyo.",
          attribution: "Sobre empatía",
        },
      ],
    },

    faq: {
      eyebrow: "Preguntas frecuentes",
      title: "Las dudas que casi todo cliente trae a la primera llamada.",
      items: [
        {
          q: "¿Puedo obtener el NIF o abrir una cuenta bancaria portuguesa por mi cuenta?",
          a: "Ambos procesos requieren representación jurídica portuguesa, dirección en el país y reglas KYC diseñadas para no residentes. La Autoridad Tributaria exige un representante fiscal con dirección portuguesa. La mayoría de los bancos rechazan solicitudes directas desde el exterior. No son formalidades, son exigencias legales que sólo un abogado portugués licenciado puede cumplir por ti.",
        },
        {
          q: "¿Es caro?",
          a: "Comparado con un visado denegado, una cuenta rechazada o meses de retraso evitable, no. Nuestro precio es cerrado y está por escrito antes de empezar. Sabes exactamente lo que pagas y lo que recibes.",
        },
        {
          q: "¿Cuánto tarda cada proceso?",
          a: "Emisión del NIF: normalmente 3 a 5 días laborables desde la documentación. Apertura de cuenta bancaria remota: 2 a 4 semanas según el análisis de compliance del banco y tu nacionalidad. Comunicamos plazos realistas antes de que te comprometas y actualizamos según evolucionan.",
        },
        {
          q: "¿Tengo que viajar a Portugal en algún momento?",
          a: "No. Ambos servicios son totalmente remotos. Tú firmas, nosotros presentamos, las autoridades y el banco aprueban, desde donde estés. Visitar sólo tiene sentido cuando la cuenta ya está activa y quieres conocer tu nueva ciudad.",
        },
        {
          q: "Voy a solicitar el visado D7. ¿Necesito los dos servicios?",
          a: "Sí. El D7 exige un NIF (con representante fiscal registrado) y una cuenta bancaria portuguesa con fondos depositados antes de la entrevista consular. Sin uno u otro, el consulado no aprueba la solicitud.",
        },
        {
          q: "¿Qué documentos necesitaré aportar?",
          a: "Normalmente: pasaporte, comprobante de domicilio, comprobante de ingresos o pensión y un cuestionario breve que te enviamos. Los requisitos exactos dependen de tu nacionalidad y del tipo de visado. Lo confirmamos todo antes de que nada salga de tu bandeja de entrada.",
        },
        {
          q: "¿Y si el banco rechaza mi solicitud?",
          a: "Es raro, porque nuestro equipo de compliance revisa cada dossier antes de presentarlo. Si ocurre, abrimos con otro banco asociado sin coste adicional. Tu proceso no se detiene hasta que tu cuenta esté activa.",
        },
      ],
    },

    ctaBanner: {
      title: "¿Lista para empezar?",
      desc: "Una primera conversación es gratuita y sin compromiso. Saldrás con un plan claro, precio por escrito y el nombre de la abogada que llevará tu caso.",
      button: "Iniciar mi solicitud",
    },

    contact: {
      eyebrow: "Hablemos",
      title: "Cuéntanos dónde estás.\nTe diremos qué viene a continuación.",
      desc: "Rellena el formulario y una de nuestras abogadas responde en un día laborable. Todo lo que compartas está protegido por el secreto profesional.",
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
        message: "Cuéntanos un poco tu momento",
        submit: "Enviar mi solicitud",
        disclaimer:
          "Al enviar, aceptas nuestra política de privacidad. Respondemos en un día laborable.",
      },
      formPlaceholders: {
        name: "¿Cómo podemos llamarte?",
        email: "tu@email.com",
        phone: "+34 600 000 000",
        country: "España, México, Argentina, …",
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

    location: {
      eyebrow: "Ven a visitarnos, o no",
      title: "Nuestra oficina está en el corazón de Lisboa.",
      desc: "Todo lo que hacemos es remoto. No hace falta cruzar un océano para tener tu documentación lista. Si ya estás en Lisboa, o vas a estar cuando recibas las llaves, eres bienvenido.",
      openMaps: "Abrir en Google Maps",
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
  },
} as const;

export type Messages = (typeof messages)[Locale];
