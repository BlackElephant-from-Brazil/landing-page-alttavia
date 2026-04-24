import type { Locale } from "@/lib/i18n";

/**
 * Localized UI copy. Same shape across all locales — enforced by the `Messages` type.
 * When updating any block, update all three locales to keep parity.
 */
export const messages = {
  en: {
    cityLabel: "Lisbon",
    country: "Portugal",
    officeHours: "Mon – Fri · 10:00 – 18:00 WET",

    metaTitle:
      "Alttavia Relocation — NIF and Portuguese bank account, handled by licensed lawyers",
    metaDescription:
      "Licensed Portuguese lawyers issuing your NIF with fiscal representation and opening your Portuguese bank account remotely — the two documents your D7 or D8 visa depends on. Over 800 cases handled.",

    navCtaLabel: "Start my application",
    nav: [
      { href: "#services", label: "Services" },
      { href: "#why", label: "Why us" },
      { href: "#about", label: "About" },
      { href: "#faq", label: "FAQ" },
      { href: "#contact", label: "Contact" },
    ],

    hero: {
      eyebrow: "Licensed Portuguese lawyers · no intermediaries",
      titleBefore: "Move to Portugal with the",
      titleHighlight: "lawyers",
      titleAfter: " other firms trust.",
      subtitle:
        "Fiscal representation and remote bank account opening — the two documents your D7 or D8 visa depends on. Delivered directly by licensed Portuguese attorneys, without outsourcing. Over 800 successful cases.",
      ctaPrimary: "Request my NIF",
      ctaSecondary: "Open my bank account",
      cardTitle: "Patrícia Viana",
      cardRole: "OA Portugal · OAB Brasil",
      cardDesc:
        "Your case is handled directly by a licensed attorney — start to finish.",
      stats: [
        { number: "800+", label: "cases handled" },
        { number: "100%", label: "attorney-led" },
        { number: "100%", label: "remote process" },
      ],
    },

    services: {
      eyebrow: "What we do",
      title: "Two documents. One law firm. Zero intermediaries.",
      desc: "The path to your D7 or D8 visa runs through two essential steps — the same two steps relocation companies across the market ask us to handle for them. Now you can skip straight to the firm they call.",
      items: [
        {
          id: "nif",
          tag: "Essential for D7 applicants",
          title: "NIF with fiscal representation",
          subtitle: "Your Portuguese fiscal identity — required from day one.",
          body: "The NIF (Número de Identificação Fiscal) is Portugal's tax ID. It is mandatory for every practical act of life here: renting, banking, school enrollment, signing utility contracts. For D7 visa applicants (retirees and passive-income residents), the Portuguese Tax Authority also requires a fiscal representative in-country — a role only a licensed professional can hold.",
          body2:
            "We issue your NIF remotely and act as your registered fiscal representative for as long as you need one, communicating directly with the Tax Authority on your behalf.",
          bullets: [
            "100% remote — no travel required",
            "Registered fiscal representative included",
            "Required before D7 and D8 visa interviews",
            "Needed for banking, rentals, utilities, schools",
          ],
          cta: "Request my NIF",
        },
        {
          id: "bank",
          tag: "Essential for D7 & Golden Visa applicants",
          title: "Remote bank account for non-residents",
          subtitle: "A proof-of-funds that visa applications cannot do without.",
          body: "Portuguese consulates require applicants to demonstrate funds already deposited in a Portuguese bank account — making this step non-negotiable for the D7 visa (passive income) and Golden Visa (investment residency). Most banks refuse direct non-resident applications; those that accept them require a legally compliant KYC file most applicants can't assemble alone.",
          body2:
            "We open your account remotely with our banking partners, prepare the full compliance file, and stay on the line with the bank until funds clear and your account is operational.",
          bullets: [
            "100% remote — signed digitally",
            "Full KYC & compliance support",
            "Required for D7 visa and Golden Visa",
            "Pre-screened file to minimise rejection",
          ],
          cta: "Open my bank account",
        },
      ],
    },

    whyUs: {
      eyebrow: "Why Alttavia Relocation",
      title: "Most relocation firms outsource their legal work. We are the law firm.",
      intro:
        "When a major relocation company needs a NIF issued or a bank account opened for a client, they don't do it themselves — they call a Portuguese lawyer. That call often lands with us. Skip the middleman.",
      items: [
        {
          title: "Handled by actual attorneys",
          desc: "Your NIF, your bank account, your fiscal representation — all managed personally by licensed Portuguese lawyers. Not by sales teams. Not by paralegals. Not by third parties.",
        },
        {
          title: "The firm other firms call",
          desc: "When the industry needs legal work done for their clients, they outsource it — to us. With Alttavia Relocation, you work directly with the team the market already relies on.",
        },
        {
          title: "Specialists in D7 and D8 visas",
          desc: "We know the documentation, the compliance, the consular expectations. Over 800 cases in passive-income visas, digital-nomad visas, Golden Visa, and consular proceedings.",
        },
        {
          title: "Remote from start to finish",
          desc: "Everything is signed, filed, and followed up without you leaving home. You always know what's happening, when, and why — in plain English.",
        },
      ],
    },

    about: {
      eyebrow: "Our story",
      title: "Founded because the lawyer was always the last to be called.",
      paragraphs: [
        "Alttavia Relocation began with an observation. As a licensed Portuguese attorney, I kept receiving calls from relocation companies asking to sub-contract the legal side of their cases. Every one of them eventually needed a lawyer. If I was already doing the work behind the scenes, I could do it directly — for the people who actually needed it. Without markups. Without intermediaries.",
        "Our mission is simple: to make the move to Portugal as calm and uncomplicated as a life-changing decision can be. For retirees. For digital nomads. For families starting a new chapter. For anyone trusting us with this part of their story.",
        "Everything we do is handled by licensed Portuguese attorneys — because it has to be. Because when you're trusting a firm with your fiscal identity and the funds that will support your new life, the question of who actually handles it matters.",
      ],
      highlight: {
        name: "Patrícia Viana",
        role: "Founder · OA Portugal & OAB Brasil",
        quote:
          "I want every client to feel the calm I wish I had had the first time I ever had to do this myself.",
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
            "Paperwork shouldn't hold your life back. Every step is scheduled, acted on, and reported — in writing.",
          attribution: "On celerity",
        },
        {
          quote:
            "If we can't help you, we'll say so. If we can, we tell you exactly how — in writing, before you commit.",
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
          a: "Both processes require Portuguese legal representation, an in-country address, and compliance with KYC rules designed for non-residents. The Tax Authority requires a fiscal representative with a Portuguese address. Most banks refuse direct applications from abroad. These aren't formalities — they're legal requirements only a licensed Portuguese lawyer can fulfil for you.",
        },
        {
          q: "Is it expensive?",
          a: "Compared to the cost of a denied visa, a rejected bank account, or months of avoidable delay — no. Our pricing is flat and transparent: quoted and agreed in writing before any work begins. You'll know exactly what you're paying and exactly what you get.",
        },
        {
          q: "How long does each process take?",
          a: "NIF issuance: typically 3–5 business days after documentation is received. Remote bank account opening: 2–4 weeks depending on the bank's compliance review and your nationality. We communicate realistic timelines before you commit — and update you as they evolve.",
        },
        {
          q: "Do I need to travel to Portugal for any of this?",
          a: "No. Both services are fully remote. You sign, we file, the authorities and the bank approve — from wherever you are. A visit only makes sense after your account is live and you want to explore your new city.",
        },
        {
          q: "I'm applying for a D7 visa. Do I need both services?",
          a: "Yes. The D7 visa requires a NIF (with a registered fiscal representative) and a Portuguese bank account with deposited funds before the consular interview. Without either, the consulate will not approve the application.",
        },
        {
          q: "What documents will I need to provide?",
          a: "Typically: passport, proof of address, proof of income or pension, and a short questionnaire we send you. Exact requirements depend on your nationality and chosen visa type. We confirm everything with you before any document leaves your inbox.",
        },
        {
          q: "What if the bank rejects my application?",
          a: "It rarely happens — our compliance team pre-screens every file. If it does, we re-open with another banking partner at no extra cost. Your process doesn't stop until your account is live.",
        },
      ],
    },

    ctaBanner: {
      title: "Ready to start?",
      desc: "A first conversation is free and without commitment. You'll leave it with a clear plan, written pricing, and the name of the attorney who will handle your case.",
      button: "Start my application",
    },

    contact: {
      eyebrow: "Let's talk",
      title: "Tell us where you are.\nWe'll tell you what comes next.",
      desc: "Fill the form and one of our attorneys will reply within one business day. Everything you share is protected by attorney–client privilege.",
      emailLabel: "Email",
      phoneLabel: "Phone / WhatsApp",
      officeLabel: "Office",
      selectPrompt: "Select one",
      messageSent: "Message sent",
      formLabels: {
        name: "Full name",
        email: "Email",
        phone: "Phone / WhatsApp",
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
        phone: "+1 (555) 000-0000",
        country: "United States, UK, Brazil…",
        message:
          "Where are you in your relocation journey — and what would make this easier?",
      },
      interestOptions: [
        "NIF with fiscal representation",
        "Remote bank account opening",
        "Both",
        "D7 visa guidance",
        "D8 visa guidance",
        "Not sure yet",
      ],
    },

    location: {
      eyebrow: "Come visit — or don't",
      title: "Our office is in the heart of Lisbon.",
      desc: "Everything we do is remote-first, so there's no need to cross an ocean before your paperwork is done. But if you're already in the city — or want to be once the keys are handed over — you're welcome to stop by.",
      openMaps: "Open in Google Maps",
    },

    footer: {
      tagline:
        "A licensed Portuguese law firm moving people with legal certainty. NIF, fiscal representation, and remote bank accounts for those relocating to Portugal.",
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
    officeHours: "Seg – Sex · 10h – 18h WET",

    metaTitle:
      "Alttavia Relocation — NIF e conta bancária em Portugal com advogados licenciados",
    metaDescription:
      "Advogados portugueses licenciados emitindo o seu NIF com representação fiscal e abrindo a sua conta bancária portuguesa de forma remota — os dois documentos de que o visto D7 ou D8 depende. Mais de 800 casos conduzidos.",

    navCtaLabel: "Quero aplicar",
    nav: [
      { href: "#services", label: "Serviços" },
      { href: "#why", label: "Por que nós" },
      { href: "#about", label: "Sobre" },
      { href: "#faq", label: "FAQ" },
      { href: "#contact", label: "Contato" },
    ],

    hero: {
      eyebrow: "Advogados portugueses licenciados · sem intermediários",
      titleBefore: "Mude-se para Portugal com os",
      titleHighlight: "advogados",
      titleAfter: " em quem as outras empresas confiam.",
      subtitle:
        "Representação fiscal e abertura de conta bancária remota — os dois documentos de que o seu visto D7 ou D8 depende. Entregues diretamente por advogados portugueses licenciados, sem terceirização. Mais de 800 casos bem-sucedidos.",
      ctaPrimary: "Solicitar meu NIF",
      ctaSecondary: "Abrir minha conta bancária",
      cardTitle: "Patrícia Viana",
      cardRole: "OA Portugal · OAB Brasil",
      cardDesc:
        "O seu caso é conduzido diretamente por uma advogada licenciada — do início ao fim.",
      stats: [
        { number: "800+", label: "casos conduzidos" },
        { number: "100%", label: "conduzido por advogada" },
        { number: "100%", label: "processo remoto" },
      ],
    },

    services: {
      eyebrow: "O que fazemos",
      title: "Dois documentos. Um escritório. Zero intermediários.",
      desc: "O caminho para o seu visto D7 ou D8 passa por duas etapas essenciais — as mesmas duas etapas que empresas de relocation do mercado inteiro nos pedem para executar. Agora você pode ir direto ao escritório que elas contratam.",
      items: [
        {
          id: "nif",
          tag: "Essencial para candidatos ao D7",
          title: "NIF com representação fiscal",
          subtitle:
            "A sua identidade fiscal portuguesa — obrigatória desde o primeiro dia.",
          body: "O NIF (Número de Identificação Fiscal) é o equivalente português ao CPF. É obrigatório para qualquer ato prático da vida em Portugal: aluguel, banco, matrícula escolar, contratos de serviços. Para candidatos ao visto D7 (aposentados e pessoas com renda passiva), a Autoridade Tributária ainda exige um representante fiscal em Portugal — função que apenas um profissional licenciado pode exercer.",
          body2:
            "Emitimos o seu NIF remotamente e atuamos como representante fiscal pelo tempo em que precisar, falando diretamente com a Autoridade Tributária em seu nome.",
          bullets: [
            "100% remoto — sem viagens",
            "Representante fiscal inscrito incluído",
            "Obrigatório antes das entrevistas de visto D7 e D8",
            "Necessário para bancos, aluguel, contas e escolas",
          ],
          cta: "Solicitar meu NIF",
        },
        {
          id: "bank",
          tag: "Essencial para D7 e Golden Visa",
          title: "Conta bancária remota para não-residentes",
          subtitle:
            "Prova de fundos sem a qual nenhum pedido de visto avança.",
          body: "Os consulados portugueses exigem que o candidato comprove fundos depositados em uma conta bancária portuguesa — etapa inegociável para o visto D7 (renda passiva) e o Golden Visa (residência por investimento). A maioria dos bancos recusa candidaturas diretas de não-residentes; os que aceitam exigem um dossier de KYC que a maioria dos clientes não consegue montar sozinho.",
          body2:
            "Abrimos a sua conta remotamente junto aos nossos bancos parceiros, preparamos todo o compliance e permanecemos em contato com o banco até o seu dinheiro entrar e a conta estar operacional.",
          bullets: [
            "100% remoto — assinatura digital",
            "Suporte completo de KYC e compliance",
            "Obrigatório para D7 e Golden Visa",
            "Dossier pré-revisado para minimizar recusas",
          ],
          cta: "Abrir minha conta bancária",
        },
      ],
    },

    whyUs: {
      eyebrow: "Por que Alttavia Relocation",
      title:
        "A maioria das empresas de relocation terceiriza o jurídico. Nós somos o escritório jurídico.",
      intro:
        "Quando uma grande empresa de relocation precisa emitir um NIF ou abrir uma conta bancária para um cliente, ela não faz sozinha — liga para um advogado português. Essa ligação frequentemente chega até nós. Pule o intermediário.",
      items: [
        {
          title: "Conduzido por advogados de verdade",
          desc: "O seu NIF, a sua conta bancária, a sua representação fiscal — todos tratados pessoalmente por advogados portugueses licenciados. Não por equipes comerciais. Não por estagiários. Não por terceiros.",
        },
        {
          title: "O escritório que as outras empresas chamam",
          desc: "Quando o setor precisa de trabalho jurídico para os próprios clientes, ele terceiriza — para nós. Com a Alttavia, você trabalha diretamente com a equipe em que o mercado já confia.",
        },
        {
          title: "Especialistas em visto D7 e D8",
          desc: "Conhecemos a documentação, o compliance, as expectativas consulares. Mais de 800 casos em vistos de renda passiva, de nômades digitais, Golden Visa e processos consulares.",
        },
        {
          title: "Remoto do início ao fim",
          desc: "Tudo é assinado, protocolado e acompanhado sem você sair de casa. Você sempre sabe o que está acontecendo, quando e por quê — em linguagem clara.",
        },
      ],
    },

    about: {
      eyebrow: "Nossa história",
      title: "Nasceu porque o advogado sempre era o último a ser chamado.",
      paragraphs: [
        "A Alttavia Relocation nasceu de uma observação. Como advogada portuguesa licenciada, eu recebia ligações de empresas de relocation pedindo para subcontratar o lado jurídico dos casos delas. Todas, no fim, precisavam de um advogado. Se eu já estava fazendo o trabalho nos bastidores, poderia fazer diretamente — para as pessoas que realmente precisavam. Sem markup. Sem intermediário.",
        "Nossa missão é simples: tornar a mudança para Portugal o mais tranquila e descomplicada que uma decisão tão grande permite ser. Para aposentados. Para nômades digitais. Para famílias começando um novo capítulo. Para qualquer pessoa que confia em nós uma parte importante da própria história.",
        "Tudo o que fazemos é conduzido por advogados portugueses licenciados — porque tem de ser. Porque, quando você confia a um escritório a sua identidade fiscal e os fundos que vão sustentar a sua nova vida, quem cuida disso importa.",
      ],
      highlight: {
        name: "Patrícia Viana",
        role: "Fundadora · OA Portugal & OAB Brasil",
        quote:
          "Quero que cada cliente sinta a calma que eu gostaria de ter sentido na primeira vez em que precisei fazer isso sozinha.",
      },
      stats: [
        { number: "800+", label: "casos conduzidos" },
        { number: "10+", label: "anos de prática" },
        { number: "100%", label: "conduzido por advogada" },
      ],
    },

    principles: {
      eyebrow: "Como trabalhamos",
      title: "Quatro princípios que não terceirizamos.",
      items: [
        {
          quote:
            "Burocracia não pode segurar a sua vida. Cada etapa é agendada, executada e reportada — por escrito.",
          attribution: "Sobre celeridade",
        },
        {
          quote:
            "Se não podemos ajudar, dizemos. Se podemos, contamos exatamente como — por escrito, antes de você se comprometer.",
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
          a: "Ambos os processos exigem representação legal em Portugal, morada no país e o cumprimento das regras de KYC desenhadas para não-residentes. A Autoridade Tributária exige um representante fiscal com endereço português. A maioria dos bancos recusa candidaturas diretas vindas do exterior. Não são formalidades — são exigências legais que apenas um advogado português licenciado pode cumprir por você.",
        },
        {
          q: "É caro?",
          a: "Comparado ao custo de um visto negado, uma conta recusada ou meses de atraso evitável — não. Nosso preço é fixo e transparente: cotado e acordado por escrito antes de qualquer trabalho começar. Você sabe exatamente o que está pagando e o que recebe.",
        },
        {
          q: "Quanto tempo cada processo leva?",
          a: "Emissão do NIF: tipicamente 3 a 5 dias úteis após a documentação. Abertura de conta bancária remota: 2 a 4 semanas, dependendo da análise de compliance do banco e da sua nacionalidade. Comunicamos prazos realistas antes de você se comprometer — e atualizamos conforme evoluem.",
        },
        {
          q: "Preciso viajar para Portugal em alguma etapa?",
          a: "Não. Os dois serviços são totalmente remotos. Você assina, nós protocolamos, as autoridades e o banco aprovam — de onde você estiver. Uma visita só faz sentido quando a conta já estiver ativa e você quiser conhecer a sua nova cidade.",
        },
        {
          q: "Vou aplicar para o visto D7. Preciso dos dois serviços?",
          a: "Sim. O D7 exige um NIF (com representante fiscal inscrito) e uma conta bancária portuguesa com fundos depositados antes da entrevista consular. Sem um dos dois, o consulado não aprova a candidatura.",
        },
        {
          q: "Quais documentos vou precisar?",
          a: "Tipicamente: passaporte, comprovante de residência, comprovante de rendimento ou aposentadoria e um questionário curto que enviamos. As exigências exatas dependem da sua nacionalidade e do tipo de visto. Confirmamos tudo antes de qualquer documento sair da sua caixa.",
        },
        {
          q: "E se o banco recusar minha candidatura?",
          a: "Raramente acontece — a nossa equipe de compliance revisa cada dossier antes de submeter. Se acontecer, abrimos com outro banco parceiro sem custo extra. O seu processo não para até a sua conta estar ativa.",
        },
      ],
    },

    ctaBanner: {
      title: "Pronta para dar o primeiro passo?",
      desc: "Uma conversa inicial é gratuita e sem compromisso. Você sai dela com um plano claro, preço por escrito e o nome da advogada que vai cuidar do seu caso.",
      button: "Quero aplicar",
    },

    contact: {
      eyebrow: "Vamos conversar",
      title: "Conte onde você está.\nA gente diz o que vem a seguir.",
      desc: "Preencha o formulário e uma de nossas advogadas retorna em até um dia útil. Tudo o que você compartilhar fica protegido pelo sigilo profissional.",
      emailLabel: "E-mail",
      phoneLabel: "Telefone / WhatsApp",
      officeLabel: "Escritório",
      selectPrompt: "Selecione uma opção",
      messageSent: "Mensagem enviada",
      formLabels: {
        name: "Nome completo",
        email: "E-mail",
        phone: "Telefone / WhatsApp",
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
        phone: "+55 (11) 99999-9999",
        country: "Brasil, Estados Unidos, Reino Unido…",
        message:
          "Em que ponto da mudança você está — e o que tornaria o processo mais fácil?",
      },
      interestOptions: [
        "NIF com representação fiscal",
        "Abertura de conta bancária remota",
        "Os dois",
        "Orientação sobre visto D7",
        "Orientação sobre visto D8",
        "Ainda estou decidindo",
      ],
    },

    location: {
      eyebrow: "Venha visitar — ou não",
      title: "Nosso escritório fica no coração de Lisboa.",
      desc: "Tudo o que fazemos é remoto, então não há por que atravessar um oceano antes de a papelada estar pronta. Mas se você já está na cidade — ou quer estar assim que receber as chaves —, será bem-vindo.",
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
    officeHours: "Lun – Vie · 10:00 – 18:00 WET",

    metaTitle:
      "Alttavia Relocation — NIF y cuenta bancaria portuguesa, gestionados por abogados licenciados",
    metaDescription:
      "Abogados portugueses licenciados emitiendo tu NIF con representación fiscal y abriendo tu cuenta bancaria portuguesa de forma remota — los dos documentos que tu visado D7 o D8 necesita. Más de 800 casos gestionados.",

    navCtaLabel: "Iniciar mi solicitud",
    nav: [
      { href: "#services", label: "Servicios" },
      { href: "#why", label: "Por qué nosotros" },
      { href: "#about", label: "Nosotros" },
      { href: "#faq", label: "FAQ" },
      { href: "#contact", label: "Contacto" },
    ],

    hero: {
      eyebrow: "Abogados portugueses licenciados · sin intermediarios",
      titleBefore: "Múdate a Portugal con los",
      titleHighlight: "abogados",
      titleAfter: " en quienes otras firmas confían.",
      subtitle:
        "Representación fiscal y apertura de cuenta bancaria remota — los dos documentos que tu visado D7 o D8 necesita. Entregados directamente por abogados portugueses licenciados, sin tercerizar. Más de 800 casos con éxito.",
      ctaPrimary: "Solicitar mi NIF",
      ctaSecondary: "Abrir mi cuenta bancaria",
      cardTitle: "Patrícia Viana",
      cardRole: "OA Portugal · OAB Brasil",
      cardDesc:
        "Tu caso lo gestiona directamente una abogada licenciada — de principio a fin.",
      stats: [
        { number: "800+", label: "casos gestionados" },
        { number: "100%", label: "a cargo de abogada" },
        { number: "100%", label: "proceso remoto" },
      ],
    },

    services: {
      eyebrow: "Qué hacemos",
      title: "Dos documentos. Un bufete. Cero intermediarios.",
      desc: "El camino a tu visado D7 o D8 pasa por dos pasos esenciales — los mismos que las empresas de relocation del mercado nos piden gestionar. Ahora puedes ir directo al bufete al que ellas llaman.",
      items: [
        {
          id: "nif",
          tag: "Esencial para solicitantes del D7",
          title: "NIF con representación fiscal",
          subtitle:
            "Tu identidad fiscal portuguesa — obligatoria desde el primer día.",
          body: "El NIF (Número de Identificación Fiscal) es el identificador fiscal portugués. Es obligatorio para todo acto práctico en Portugal: alquilar, abrir cuentas, matricular hijos, firmar contratos. Para solicitantes del visado D7 (jubilados y residentes con ingresos pasivos), la Autoridad Tributaria exige además un representante fiscal en el país — rol que sólo un profesional licenciado puede ejercer.",
          body2:
            "Emitimos tu NIF de forma remota y actuamos como tu representante fiscal durante el tiempo que lo necesites, comunicándonos directamente con la Autoridad Tributaria en tu nombre.",
          bullets: [
            "100% remoto — sin viajar",
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
          subtitle:
            "Una prueba de fondos sin la cual ningún visado avanza.",
          body: "Los consulados portugueses exigen que el solicitante demuestre fondos depositados en una cuenta bancaria portuguesa — paso no negociable para el visado D7 (ingresos pasivos) y para el Golden Visa (residencia por inversión). La mayoría de los bancos rechaza solicitudes directas de no residentes; los que aceptan requieren un dossier KYC que la mayoría no sabe preparar solo.",
          body2:
            "Abrimos tu cuenta de forma remota con nuestros bancos asociados, preparamos todo el dossier de compliance y hacemos seguimiento con el banco hasta que el dinero entra y la cuenta queda operativa.",
          bullets: [
            "100% remoto — firma digital",
            "Soporte completo de KYC y compliance",
            "Obligatoria para D7 y Golden Visa",
            "Dossier pre-revisado para minimizar rechazos",
          ],
          cta: "Abrir mi cuenta bancaria",
        },
      ],
    },

    whyUs: {
      eyebrow: "Por qué Alttavia Relocation",
      title:
        "La mayoría de las firmas de relocation tercerizan lo jurídico. Nosotros somos el bufete.",
      intro:
        "Cuando una gran firma de relocation necesita emitir un NIF o abrir una cuenta bancaria para un cliente, no lo hace sola — llama a un abogado portugués. Esa llamada suele llegar aquí. Sáltate al intermediario.",
      items: [
        {
          title: "Gestionado por abogados de verdad",
          desc: "Tu NIF, tu cuenta bancaria, tu representación fiscal — todo gestionado personalmente por abogados portugueses licenciados. No por equipos comerciales. No por pasantes. No por terceros.",
        },
        {
          title: "El bufete al que llaman las otras firmas",
          desc: "Cuando el sector necesita trabajo jurídico para sus clientes, lo terceriza — a nosotros. Con Alttavia Relocation, trabajas directamente con el equipo en el que el mercado ya confía.",
        },
        {
          title: "Especialistas en visados D7 y D8",
          desc: "Conocemos la documentación, el compliance, las expectativas consulares. Más de 800 casos en visados de ingresos pasivos, de nómadas digitales, Golden Visa y procedimientos consulares.",
        },
        {
          title: "Remoto de principio a fin",
          desc: "Todo se firma, se presenta y se sigue sin salir de casa. Sabes siempre qué está pasando, cuándo y por qué — en lenguaje claro.",
        },
      ],
    },

    about: {
      eyebrow: "Nuestra historia",
      title: "Nacida porque al abogado siempre lo llamaban al final.",
      paragraphs: [
        "Alttavia Relocation nació de una observación. Como abogada portuguesa licenciada, recibía continuamente llamadas de empresas de relocation que querían subcontratar la parte jurídica de sus casos. Todas, al final, necesitaban un abogado. Si yo ya hacía el trabajo entre bastidores, podía hacerlo directamente — para las personas que realmente lo necesitaban. Sin markup. Sin intermediario.",
        "Nuestra misión es simple: que mudarse a Portugal sea tan tranquilo y poco complicado como permite una decisión que cambia la vida. Para jubilados. Para nómadas digitales. Para familias que empiezan un nuevo capítulo. Para cualquiera que nos confíe una parte importante de su historia.",
        "Todo lo que hacemos lo gestionan abogados portugueses licenciados — porque así tiene que ser. Porque cuando confías a un bufete tu identidad fiscal y los fondos que sostendrán tu nueva vida, importa quién lo gestiona.",
      ],
      highlight: {
        name: "Patrícia Viana",
        role: "Fundadora · OA Portugal & OAB Brasil",
        quote:
          "Quiero que cada cliente sienta la calma que me habría gustado tener la primera vez que tuve que hacer esto.",
      },
      stats: [
        { number: "800+", label: "casos gestionados" },
        { number: "10+", label: "años de práctica" },
        { number: "100%", label: "a cargo de abogada" },
      ],
    },

    principles: {
      eyebrow: "Cómo trabajamos",
      title: "Cuatro principios que no tercerizamos.",
      items: [
        {
          quote:
            "La burocracia no puede detener tu vida. Cada paso se agenda, se ejecuta y se reporta — por escrito.",
          attribution: "Sobre celeridad",
        },
        {
          quote:
            "Si no podemos ayudarte, lo decimos. Si podemos, te decimos exactamente cómo — por escrito, antes de que te comprometas.",
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
          a: "Ambos procesos requieren representación jurídica portuguesa, dirección en el país y el cumplimiento de reglas KYC diseñadas para no residentes. La Autoridad Tributaria exige un representante fiscal con dirección portuguesa. La mayoría de los bancos rechazan solicitudes directas desde el exterior. No son formalidades — son exigencias legales que sólo un abogado portugués licenciado puede cumplir por ti.",
        },
        {
          q: "¿Es caro?",
          a: "Comparado con el coste de un visado denegado, una cuenta rechazada o meses de retraso evitable — no. Nuestro precio es cerrado y transparente: cotizado y acordado por escrito antes de empezar. Sabes exactamente lo que pagas y lo que recibes.",
        },
        {
          q: "¿Cuánto tarda cada proceso?",
          a: "Emisión del NIF: normalmente 3 – 5 días laborables desde la documentación. Apertura de cuenta bancaria remota: 2 – 4 semanas según el análisis de compliance del banco y tu nacionalidad. Comunicamos plazos realistas antes de que te comprometas — y actualizamos según evolucionan.",
        },
        {
          q: "¿Tengo que viajar a Portugal en algún momento?",
          a: "No. Ambos servicios son totalmente remotos. Tú firmas, nosotros presentamos, las autoridades y el banco aprueban — desde donde estés. Visitar sólo tiene sentido cuando la cuenta ya está activa y quieres conocer tu nueva ciudad.",
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
          a: "Es raro — nuestro equipo de compliance revisa cada dossier antes de presentarlo. Si ocurre, abrimos con otro banco asociado sin coste adicional. Tu proceso no se detiene hasta que tu cuenta esté activa.",
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
      phoneLabel: "Teléfono / WhatsApp",
      officeLabel: "Oficina",
      selectPrompt: "Elige una opción",
      messageSent: "Mensaje enviado",
      formLabels: {
        name: "Nombre completo",
        email: "Email",
        phone: "Teléfono / WhatsApp",
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
        country: "España, México, Argentina…",
        message:
          "¿En qué punto de la mudanza estás — y qué te haría todo más fácil?",
      },
      interestOptions: [
        "NIF con representación fiscal",
        "Apertura de cuenta bancaria remota",
        "Los dos",
        "Orientación sobre visado D7",
        "Orientación sobre visado D8",
        "Todavía estoy decidiendo",
      ],
    },

    location: {
      eyebrow: "Ven a visitarnos — o no",
      title: "Nuestra oficina está en el corazón de Lisboa.",
      desc: "Todo lo que hacemos es remoto, así que no hay por qué cruzar un océano antes de tener lista la documentación. Pero si ya estás en la ciudad — o quieres estar cuando te den las llaves —, te esperamos.",
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
