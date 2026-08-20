/**
 * Copy for the NIF + Portuguese bank account sales landing.
 *
 * Route: /[locale] on the bank.alttavia-relocation.com deploy, so the page the
 * ad points at is bank.alttavia-relocation.com/en.
 *
 * Language: American English only. This product is bought by D7 and D8
 * applicants who read English, so PT and ES versions come later.
 *
 * House rules, all set by the client. Every one of them has been broken once
 * already, so they are written down:
 *
 *   1. No dashes as punctuation in any user facing string. Ranges are spelled
 *      out ("3 to 5 business days") and a middot separates list fragments.
 *   2. The page sells Alttavia Relocation, a relocation firm. It never says the
 *      company is run or managed by lawyers. Patrícia's own credential belongs
 *      in section 6 and nowhere else.
 *   3. The words "problem" and "trap" do not appear.
 *   4. No money back promise, anywhere. Delivery times are ours to control up
 *      to the point where Finanças, a bank or any other public body takes over,
 *      and the page says exactly that instead of guaranteeing an outcome.
 *   5. No VAT or IVA mention next to a price.
 *   6. No video call. The client buys, uploads documents, and that is all the
 *      contact the process requires.
 *   7. Short. This page was cut by about a third for being tiring to read, so
 *      when in doubt, delete the sentence.
 *
 * Inline emphasis uses **bold** and *italic* markers, rendered by <RichText />.
 */

/**
 * Checkout destinations.
 *
 * TODO(dev): these four point at the checkout being built, which takes payment
 * and then collects the document upload in the same flow. Nothing else in the
 * codebase holds a checkout URL, so this block is the only edit needed.
 */
export const STRIPE_LINKS = {
  /** NIF only */
  nifOnly: "#checkout-nif-only",
  /** NIF + bank account bundle */
  bundle: "#checkout-nif-bank",
  /** Bank account only */
  bankOnly: "#checkout-bank-only",
  /** Couple package: 2 NIFs + joint account */
  couple: "#checkout-couple",
} as const;

/**
 * Every price on the page.
 *
 * Positioned deliberately above AnchorLess, the volume player this product is
 * shopped against. Their Essential package (NIF + Portuguese bank account) is
 * €438, their NIF starts at €99, and their tiers above Essential are €899 and
 * €1199. The bundle sits at €497: clear of Essential, well under the concierge
 * tier, and it already includes the twelve months of tax representation that
 * AnchorLess only bundles at €1199.
 *
 * The arithmetic has to stay internally consistent:
 *   anchor = nifOnly + bankOnly   (149 + 399 = 548)
 *   saving = anchor  - bundle     (548 - 497 =  51)
 */
export const PRICES = {
  nifOnly: "€149",
  bundle: "€497",
  bankOnly: "€399",
  couple: "€597",
  /** Anchor: what card 1 plus card 3 would cost separately. */
  anchor: "€548",
  saving: "€51",
  /** Year two onward, optional. */
  renewal: "€99",
  strategyCredit: "€50",
} as const;

/**
 * Delivery times. Every mention on the page and in the service terms reads from
 * here, so there is one place to change them.
 */
export const TIMES = {
  nif: "3 to 5 business days",
  bank: "1 to 3 weeks",
} as const;

/**
 * The one sentence that replaces the old money back guarantee.
 *
 * It appears wherever a timeline does. Saying out loud that Finanças keeps its
 * own calendar reads as candour rather than as a caveat, and it is the honest
 * version of a promise nobody in this market can actually keep.
 */
export const TIMING_DISCLAIMER =
  "These are our turnaround times. Finanças, the banks and every public body keep their own schedule, and we tell you the moment one of them moves.";

/** Shared CTA label. Hero, sticky bar and final CTA must match. */
export const CTA_LABEL = `Start my application · ${PRICES.bundle}`;

/** Canonical origin. Used by the canonical tag, the sitemap and the JSON-LD. */
export const SITE_URL = "https://bank.alttavia-relocation.com";

/** Contact details for this product. Confirmed by the client. */
export const CONTACT = {
  email: "info@alttavia-relocation.com",
  phone: "+351 934 548 395",
  phoneDigits: "351934548395",
  whatsapp: "https://wa.me/351934548395",
  nipc: "NIPC 518 856 984",
} as const;

/**
 * The organic search terms this page is written to rank for, in priority order.
 *
 * They are not stuffed anywhere. They are listed so the next person editing the
 * copy knows which phrases are load bearing and does not paraphrase them out of
 * the title, the H2s, the eyebrows or the FAQ questions.
 */
export const SEO_KEYWORDS = [
  "Portuguese NIF",
  "NIF for non residents",
  "get a NIF in Portugal remotely",
  "open a Portuguese bank account from abroad",
  "Portuguese bank account for non residents",
  "tax representative in Portugal",
  "NIF to rent a property in Portugal",
  "D7 visa proof of funds",
  "D8 digital nomad visa NIF",
] as const;

/** Subsistence funds the consulate expects. Confirmed by the firm for 2026. */
export const SUBSISTENCE_FUNDS = "€11,040";

/** Press. Both links point at the real published articles. */
export const press = [
  {
    name: "SIC Notícias",
    href: "https://sicnoticias.pt/pais/2025-04-04-video-advogados-protestam-contra-dificuldades-no-acesso-aos-processos-da-aima-5cfae453",
    src: "/sicnot.svg",
    width: 250,
    height: 34,
    className: "h-5 w-auto sm:h-6",
  },
  {
    name: "Público",
    href: "https://www.publico.pt/2025/06/23/publico-brasil/noticia/advogados-imigracao-unem-entraves-aima-irn-seguranca-social-2137561",
    src: "/publico-jornal.webp",
    width: 132,
    height: 132,
    className: "h-8 w-auto sm:h-9",
  },
] as const;

export type Review = {
  author: string;
  /**
   * What the card shows. Must be a **contiguous verbatim excerpt** of
   * `fullText`, never a paraphrase and never two distant sentences stitched
   * together. An empty string renders a labeled slot rather than filler.
   */
  text: string;
  /** The complete review as published, kept so the excerpt can be re-cut. */
  fullText: string;
  /** Short label for what the review is about, shown above the quote. */
  topic: string;
};

/**
 * Real Google reviews, supplied by the client.
 *
 * The cards show excerpts because the full reviews run to several hundred words
 * each and this page was cut down twice for being tiring to read. Each excerpt
 * is lifted word for word from a single unbroken passage, and `fullText` keeps
 * the published version in the repo so a different cut is a copy and paste away.
 *
 * Note for the record: both reviewers describe Patrícia as a lawyer. That is
 * their wording inside a quotation, not the page claiming the company is a law
 * practice, and it is also the most credible place for that credential to
 * appear. Nothing inside the quote marks has been edited.
 */
export const reviews: Review[] = [
  {
    author: "Hendranus Vermeulen",
    topic: "NIF and bank account",
    text: "She went above and beyond to assist me, helping me obtain my NIF number and open a bank account. Patricia’s deep knowledge of Portuguese immigration laws was invaluable, guiding me through the process with clarity and ease.",
    fullText:
      "I highly recommend Patricia, an exceptional immigration lawyer who impressed me with her professionalism, warmth, and extensive expertise. She went above and beyond to assist me, helping me obtain my NIF number and open a bank account. Patricia’s deep knowledge of Portuguese immigration laws was invaluable, guiding me through the process with clarity and ease. Her adeptness at bridging language barriers by providing translation services was immensely helpful, ensuring effective communication throughout. Thank you, Patricia!",
  },
  {
    author: "Jamieson Shea",
    topic: "D7 visa application",
    text: "When we handed our application binder to the consular officer, he smiled and said, “This will be easy.” After reviewing everything, he added, “You must have had help.” That moment alone spoke volumes about the quality of Patricia’s preparation and guidance.",
    fullText:
      "My wife and I worked with Patricia Viana and her team on our D7 visa application, and we could not be happier with the experience. From the beginning, Patricia guided us through every step of the process with professionalism, patience, and incredible attention to detail. The application process can feel overwhelming, but she kept us organized, answered our questions promptly, and made sure every document was prepared correctly. The true value of her work became clear during our consulate interview. When we handed our application binder to the consular officer, he smiled and said, “This will be easy.” After reviewing everything, he added, “You must have had help.” That moment alone spoke volumes about the quality of Patricia’s preparation and guidance. What impressed us most was the level of care and personal attention we received. We never felt like just another client. Patricia and her team were always available, supportive, and genuinely invested in helping us succeed. If you are considering a move to Portugal and need legal or immigration assistance, I recommend Patricia Viana without hesitation. Her expertise, organization, and dedication made a complicated process feel manageable, and we are extremely grateful for everything she has done for us. Thank you, Patricia and team!",
  },
];

/** Public Google profile the review badges link to. */
export const googleProfileUrl = "https://share.google/OBdFa5ruoNI45MEys";

export const bankNif = {
  /**
   * Section 0.
   *
   * Title leads with the two terms people type, then the visas that send them
   * looking. Description stays under 160 characters so the timeline, which is
   * the line that earns the click, is not truncated.
   */
  meta: {
    title: "Portuguese NIF and Bank Account for D7 and D8 Visas | Alttavia",
    description: `Get your Portuguese NIF and open a Portuguese bank account without leaving home. Tax representation included. NIF in ${TIMES.nif}.`,
  },

  /** Section 1. */
  announcement: {
    lead: "Portuguese NIF and bank accounts, opened remotely",
    press: "As featured in SIC Notícias and Público",
  },

  header: {
    nav: [
      { label: "Why you need one", href: "#requirements" },
      { label: "How it works", href: "#how-it-works" },
      { label: "Pricing", href: "#pricing" },
      { label: "FAQ", href: "#faq" },
    ],
    cta: "Start my application",
  },

  /** Section 2. */
  hero: {
    eyebrow: "Portuguese NIF and bank account · D7 and D8 visas",
    /**
     * The H1, split for typography. The highlight is the half that carries the
     * argument, so it gets the serif italic and the gold underline, and it also
     * carries the two search terms.
     */
    titleBefore: "Your move to Portugal looks like something you can handle yourself.",
    titleHighlight: "The Portuguese NIF and bank account are not.",
    subtitle:
      "A Portuguese account cannot open until you hold a NIF, and neither is arranged from abroad on your own. We do both, while you stay where you are.",
    ctaPrimary: CTA_LABEL,
    ctaSecondary: "See how it works",
    micro: [
      `NIF in ${TIMES.nif}`,
      "12 months of tax representation included",
      "No trip to Portugal",
    ],
    /** The deliverables card that sits beside the copy on desktop. */
    deliverables: {
      label: "What lands in your inbox",
      nif: {
        title: "Your Portuguese NIF",
        detail: "Official Finanças document",
        eta: TIMES.nif,
      },
      bank: {
        title: "Your Portuguese IBAN",
        detail: "Debit card and online banking",
        eta: TIMES.bank,
      },
      seal: "Pay, upload two documents, and you are done",
    },
  },

  /** Section 3. */
  trustBar: {
    items: [
      "800+ immigration cases handled",
      "Clients from 40+ countries",
      "Lisbon based, everything filed in Portuguese",
    ],
    pressLabel: "Featured in",
  },

  /**
   * Section 4.
   *
   * Cut from three paragraphs and a long card down to two paragraphs and two
   * numbers. The accommodation point is here rather than in the FAQ because it
   * is what widens the audience: a D8 applicant who never touches the proof of
   * funds requirement still cannot sign a lease without a NIF.
   */
  requirement: {
    eyebrow: "Why you need one",
    h2: "Nobody moves to Portugal without a NIF.",
    paragraphs: [
      "The D7 asks for proof of funds in a Portuguese account, and that account cannot open until you hold a NIF. They arrive in a fixed order.",
      "And it does not end at the visa. Leases, utilities and phone contracts all ask for a NIF. **Even a D8 applicant, who never has to show funds here, needs one to rent a place to live.**",
    ],
    /** The calendar block. Urgency from arithmetic, not from alarm. */
    clock: {
      lead: "The consulate date is the one thing you cannot move.",
      body: `Your funds have to be sitting in a Portuguese account on the day you apply. Everything else in the file can run in parallel. This cannot, because the account waits on the NIF.`,
      stats: [
        {
          value: SUBSISTENCE_FUNDS,
          label: "in a Portuguese account on the day you apply, single applicant, 2026",
        },
        {
          value: TIMES.bank,
          label: "from NIF to a working Portuguese account, with us",
        },
      ],
    },
  },

  /**
   * Section 5.
   *
   * Both columns explain how each step works. Neither one catalogues things
   * going wrong: a reader who finishes this section dreading Portugal is a
   * reader who stops planning the move.
   */
  wedge: {
    eyebrow: "NIF and bank account, step by step",
    h2: "Why you can’t do this by yourself",
    h2Sub: "The rules were written for people who already live here.",
    columns: [
      {
        kicker: "01",
        title: "How a Portuguese NIF actually gets issued",
        body: "Non EU residents have to appoint a **tax representative living in Portugal** before a NIF can be issued. You cannot appoint yourself.",
        listTitle: "Going direct",
        list: [
          "Finanças appointments are booked **15 to 40 days out**, and rarely near Lisbon or Porto",
          "A representative has to be found, and has to hold the role for a year",
          "Your Portal das Finanças password is posted to *their* address. Without it, no AIMA certificates and no tax filings",
        ],
      },
      {
        kicker: "02",
        title: "How a Portuguese bank account opens from abroad",
        body: "Portuguese banks are built around people who already live here. What changes the answer is the relationship: we work with **banking partners who serve incoming residents**.",
        listTitle: "How ours opens",
        list: [
          "A partner bank that already serves people who have not moved yet",
          "A limited power of attorney, so the account is opened on your behalf",
          "IBAN, debit card and online banking, live before you land",
        ],
      },
    ],
    closing:
      "Two requirements, one way through: someone here who can act for you, and a bank that already works with us.",
  },

  /**
   * Section 6.
   *
   * The only place on the page that mentions the Bar. It is a fact about the
   * founder, not a claim that the company is a law practice, and that
   * distinction is the client's, deliberately.
   */
  solution: {
    eyebrow: "Who does the work",
    h2: "The relocation firm the Portuguese press calls when immigration stalls.",
    paragraphs: [
      "Alttavia Relocation was founded by **Patrícia Viana**: admitted in Portugal and Brazil, postgraduate in **administrative and tax litigation**, **800+ immigration cases**. When Portuguese immigration makes the news, **SIC Notícias** and **Público** call her.",
      "Nothing is outsourced. The people who take your file answer for it, in Portuguese, from Lisbon.",
    ],
    portrait: {
      src: "/patricia.webp",
      alt: "Patrícia Viana, founder of Alttavia Relocation, Portuguese immigration specialist",
      name: "Patrícia Viana",
      role: "Founder, Alttavia Relocation",
      credential:
        "Ordem dos Advogados, Portugal · OAB, Brazil · Postgraduate, administrative and tax litigation",
    },
  },

  /**
   * Section 7.
   *
   * No video call anywhere. The client buys, uploads two documents in the same
   * flow, and hears nothing until the results land.
   */
  howItWorks: {
    eyebrow: "How it works",
    h2: "Three things happen. You do one of them.",
    steps: [
      {
        title: "Pay and upload",
        meta: "5 minutes",
        body: "Choose your package, then upload your passport and proof of address in the same flow. Nothing to print or post.",
      },
      {
        title: "We take it from there",
        meta: "You do nothing",
        body: "We become your tax representative, file with Finanças, and build the bank file in Portuguese.",
      },
      {
        title: "Everything arrives by email",
        meta: `NIF in ${TIMES.nif}`,
        body: `Your NIF in **${TIMES.nif}**. IBAN, card and online banking in **${TIMES.bank}**.`,
      },
    ],
  },

  /** Section 8. */
  pricing: {
    eyebrow: "NIF and bank account pricing",
    h2: "One payment. Nothing hidden behind it.",
    cards: [
      {
        id: "nif-only",
        name: "NIF only",
        price: PRICES.nifOnly,
        summary: "The tax number, filed for you.",
        meta: `Delivered in ${TIMES.nif}`,
        featured: false,
        badge: null,
        anchor: null,
        features: [
          "Official NIF, filed directly with Finanças",
          "12 months of tax representation **included**",
          "Every Finanças letter forwarded, Portal password included",
          `Renewal ${PRICES.renewal} a year, optional, cancel once you are resident`,
        ],
        cta: `Get my NIF · ${PRICES.nifOnly}`,
        href: STRIPE_LINKS.nifOnly,
      },
      {
        id: "bundle",
        name: "NIF + Bank Account",
        price: PRICES.bundle,
        summary: "Both, in the right order, from one checkout.",
        meta: null,
        featured: true,
        badge: "Most D7 applicants choose this",
        anchor: `${PRICES.anchor} separately · save ${PRICES.saving}`,
        features: [
          "Everything in both services, sequenced correctly",
          "12 months of tax representation **included**",
          `**${PRICES.strategyCredit} credit toward your Relocation Strategy Session**`,
          `NIF in ${TIMES.nif} · IBAN in ${TIMES.bank}`,
        ],
        cta: CTA_LABEL,
        href: STRIPE_LINKS.bundle,
      },
      {
        id: "bank-only",
        name: "Bank Account only",
        price: PRICES.bankOnly,
        summary: "Already have a NIF? This one is yours.",
        meta: `IBAN in ${TIMES.bank}`,
        featured: false,
        badge: null,
        anchor: null,
        features: [
          "An account with **Novo Banco**, one of our banking partners",
          "Limited power of attorney prepared for you",
          "Compliance file built in Portuguese for you",
          "IBAN, debit card and online banking",
        ],
        cta: `Open my account · ${PRICES.bankOnly}`,
        href: STRIPE_LINKS.bankOnly,
      },
    ],
    couple: {
      text: `Moving as a couple? **2 NIFs plus a joint account for ${PRICES.couple}.** Children’s NIFs on request.`,
      cta: `Couple package · ${PRICES.couple}`,
      href: STRIPE_LINKS.couple,
    },
    footnote: TIMING_DISCLAIMER,
  },

  /** Section 9. The answer to the price objection. */
  comparison: {
    eyebrow: "The difference",
    h2: "Cheaper NIF websites exist. Here’s what the difference buys you.",
    columns: ["Online NIF services", "Alttavia"],
    rows: [
      {
        label: "Who actually files it",
        them: "A “partner network” you will never meet",
        us: "The firm you signed the power of attorney with",
      },
      {
        label: "If Finanças stalls",
        them: "A support ticket",
        us: "A founder with postgraduate training in administrative and tax litigation",
      },
      {
        label: "Tax representation",
        them: "Sold separately, or bundled at four figures",
        us: "12 months, included in every package",
      },
      {
        label: "The bank account",
        them: "Not offered, or a referral",
        us: "Opened with our own banking partner",
      },
      {
        label: "After you arrive",
        them: "Goodbye",
        us: "The same team handles your residency, AIMA and taxes",
      },
    ],
  },

  /** Section 10. */
  socialProof: {
    eyebrow: "Client reviews",
    h2: "What clients say when the paperwork is behind them.",
    badge: "Google Review",
    profileCta: "Read every review on Google",
    /** Shown per slot while a review's text is still empty. */
    emptyState: {
      title: "Review text pending",
      body: "Paste this reviewer’s verbatim Google text into the content file and this slot becomes a real quote.",
    },
  },

  /**
   * Section 11.
   *
   * This used to be the guarantees block. Every money back promise is gone at
   * the client's instruction, and the timing disclaimer took the fourth slot.
   * Framed as what is included rather than as caveats.
   */
  guarantees: {
    eyebrow: "Included",
    h2: "What comes with every order.",
    items: [
      {
        icon: "clock",
        title: "Tax representation",
        body: "12 months included, letters forwarded, Portal das Finanças password sent on.",
      },
      {
        icon: "bank",
        title: "The Portuguese side",
        body: "Filings, compliance and follow up, all handled in Portuguese.",
      },
      {
        icon: "card",
        title: "Payment and upload",
        body: "One secure checkout. Documents uploaded in the same flow, encrypted.",
      },
      {
        icon: "lock",
        title: "Timelines, honestly",
        body: TIMING_DISCLAIMER,
      },
    ],
  },

  /** Section 12. Answers cut to the shortest true version. */
  faq: {
    eyebrow: "NIF and bank account questions",
    h2: "Asked before every order.",
    items: [
      {
        q: "Do I need a NIF to rent a place in Portugal?",
        a: "Yes. Leases, utilities and phone contracts all need one. Every residence visa route, D8 included.",
      },
      {
        q: "Can my NIF application be rejected?",
        a: "With a valid passport and proof of address, a NIF is issued. What varies is how fast.",
      },
      {
        q: "Do I need to travel to Portugal to get a NIF?",
        a: "No. We act under a limited power of attorney and handle every step here.",
      },
      {
        q: "Is there a video call?",
        a: "No. You pay, you upload two documents, and that is the last thing we need from you.",
      },
      {
        q: "Which Portuguese bank will my account be with?",
        a: "Novo Banco, one of our banking partners. They serve people who have not moved yet and accept a file opened under power of attorney.",
      },
      {
        q: "How long does it take to get a Portuguese NIF and bank account?",
        a: `NIF in ${TIMES.nif}. Account in ${TIMES.bank}. ${TIMING_DISCLAIMER}`,
      },
      {
        q: "What is a tax representative in Portugal, and why 12 months?",
        a: `A Portugal resident who receives your tax correspondence and Portal das Finanças password. It is what makes a remote NIF possible. Twelve months are included, and you can drop it once you move. Renewal is ${PRICES.renewal} a year, optional.`,
      },
      {
        q: "I’m a US citizen. Does FATCA complicate this?",
        a: "It adds paperwork, and we handle the paperwork.",
      },
      {
        q: "Is the power of attorney safe?",
        a: "Limited in scope, covering only these acts. You get the full text before signing, in English and Portuguese.",
      },
      {
        q: "Do you work with my nationality?",
        a: "All nationalities for the NIF. Bank policies vary, and we tell you before you buy if yours is one we cannot serve.",
      },
      {
        q: "What documents do I need to provide?",
        a: "Passport and proof of address. For the bank, proof of income or source of funds.",
      },
      {
        q: "Can I open a Portuguese bank account if I already have a NIF?",
        a: `Yes: ${PRICES.bankOnly}.`,
      },
    ],
  },

  /** Section 13. */
  finalCta: {
    eyebrow: "Start today",
    h2: "The consulate date won’t move. Start the slowest part of your move now.",
    cta: CTA_LABEL,
    micro: [
      "One checkout, one upload",
      `NIF in ${TIMES.nif}`,
      "12 months of tax representation included",
    ],
  },

  /** Section 14. */
  footer: {
    nipc: CONTACT.nipc,
    /** Required by Google Ads for this niche. Keep it visually bold. */
    disclaimer:
      "Alttavia Relocation is a private company and is not affiliated with AT/Finanças or any government body.",
    links: [
      {
        label: "Terms",
        href: "https://alttavia-relocation.com/en/terms-of-use",
        external: true,
      },
      {
        label: "Privacy",
        href: "https://alttavia-relocation.com/en/privacy-policy",
        external: true,
      },
      { label: "Service terms", href: "/en/service-terms", external: false },
    ],
  },

  /**
   * Slim CTA bands placed mid page. Without them the page runs several thousand
   * pixels between the hero button and the pricing table.
   */
  inlineCtas: {
    afterWedge: {
      text: "Both of these, handled for you, while you stay where you are.",
      cta: "See what it costs",
      href: "#pricing",
      note: `NIF in ${TIMES.nif} · 12 months of tax representation included`,
    },
    afterComparison: {
      text: "One firm, one power of attorney, both requirements off your list.",
      cta: "See what it costs",
      href: "#pricing",
      note: "Pay and upload in the same flow",
    },
  },

  /** Mobile sticky bar. */
  sticky: {
    hint: "NIF + bank account",
    cta: "Start my application",
    price: PRICES.bundle,
    href: STRIPE_LINKS.bundle,
  },
} as const;

export type BankNifContent = typeof bankNif;
