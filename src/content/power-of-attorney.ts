/**
 * The power of attorney the client signs so the firm can request a NIF on
 * their behalf, transcribed from the firm's Word model (MODELO Procuracao para
 * atribuicao de NIF).
 *
 * The document is bilingual by design: each Portuguese paragraph is followed
 * by its English counterpart. Finanças reads the Portuguese; the signatory
 * reads the English. Both must stay in the file, and they must stay in step:
 * editing one side without the other produces a document that says two
 * different things.
 *
 * Nothing here is legal drafting on our part. Treat the wording as fixed and
 * send any change back to the firm.
 */

/** The attorney the power is granted to. Confirmed against the firm's model. */
export const ATTORNEY = {
  name: "Patrícia Soares Viana",
  barCard: "65755L",
  barCouncil: "Conselho Regional de Lisboa da Ordem dos Advogados",
  barCouncilEn: "Lisbon Regional Council of the Portuguese Bar Association",
  taxNumber: "295970677",
  address: "Av. Elias Garcia, 123-A, 1050-098, Lisboa, Portugal",
  phone: "960174940",
  email: "patriciaviana-65755L@adv.oa.pt",
} as const;

/**
 * What the signatory has to supply. Every one of these appears in both the
 * Portuguese and the English paragraph, so each is written once here and
 * substituted in both places.
 *
 * Left empty, the generator prints the model's own bracketed placeholder, so
 * an unfilled document reads as a template rather than as a finished deed with
 * blanks in it.
 */
export type PrincipalDetails = {
  /** Full legal name, exactly as written in the passport. */
  fullName?: string;
  nationality?: string;
  /** City and country of birth. */
  birthPlace?: string;
  birthDate?: string;
  passportNumber?: string;
  passportIssuer?: string;
  passportIssueDate?: string;
  passportExpiryDate?: string;
  /** Full address including postal code, city and country. */
  address?: string;
};

/** Date the deed is signed. Empty parts print the model's placeholders. */
export type SigningDate = {
  day?: string;
  monthPt?: string;
  monthEn?: string;
  year?: string;
};

/** The bracketed text the firm's model uses where a value is missing. */
const FALLBACK: Record<string, { pt: string; en: string }> = {
  fullName: { pt: "[NOME COMPLETO DO(A) MANDANTE]", en: "[FULL NAME OF THE PRINCIPAL]" },
  nationality: { pt: "[nacionalidade]", en: "[nationality]" },
  birthPlace: { pt: "[localidade e país de nascimento]", en: "[city and country of birth]" },
  birthDate: { pt: "[data de nascimento]", en: "[date of birth]" },
  passportNumber: { pt: "[número do passaporte]", en: "[passport number]" },
  passportIssuer: { pt: "[entidade emissora]", en: "[issuing authority]" },
  passportIssueDate: { pt: "[data de emissão]", en: "[date of issue]" },
  passportExpiryDate: { pt: "[data de validade]", en: "[expiry date]" },
  address: {
    pt: "[morada completa, código postal, localidade e país]",
    en: "[full address, postal code, city and country]",
  },
  day: { pt: "[dia]", en: "[day]" },
  month: { pt: "[mês]", en: "[month]" },
  year: { pt: "[ano]", en: "[year]" },
};

function value(key: string, supplied: string | undefined, lang: "pt" | "en"): string {
  const trimmed = supplied?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : FALLBACK[key][lang];
}

export type PoaBlock =
  | { kind: "title"; pt: string; en: string }
  | { kind: "paragraph"; pt: string; en: string }
  | { kind: "item"; number: string; pt: string; en: string }
  | { kind: "signature"; name: string };

/**
 * Builds the document, paragraph by paragraph, in the order the model uses.
 * Portuguese first, English second, always as a pair.
 */
export function buildPowerOfAttorney(
  principal: PrincipalDetails = {},
  signedOn: SigningDate = {},
): PoaBlock[] {
  const p = (key: keyof PrincipalDetails, lang: "pt" | "en") => value(key, principal[key], lang);
  const d = (key: "day" | "year", lang: "pt" | "en") => value(key, signedOn[key], lang);
  const month = (lang: "pt" | "en") =>
    value("month", lang === "pt" ? signedOn.monthPt : signedOn.monthEn, lang);

  return [
    { kind: "title", pt: "Procuração", en: "Power of Attorney" },

    {
      kind: "paragraph",
      pt:
        `${p("fullName", "pt")}, cidadão(ã) ${p("nationality", "pt")}, nascido(a) em ` +
        `${p("birthPlace", "pt")}, em ${p("birthDate", "pt")}, maior de idade, titular do passaporte ` +
        `n.º ${p("passportNumber", "pt")}, emitido por ${p("passportIssuer", "pt")} em ` +
        `${p("passportIssueDate", "pt")}, válido até ${p("passportExpiryDate", "pt")}, residente em ` +
        `${p("address", "pt")}, constitui a sua bastante procuradora, com a possibilidade de ` +
        `substabelecer, a Exma. Senhora Dra. ${ATTORNEY.name}, advogada, portadora da Cédula ` +
        `Profissional n.º ${ATTORNEY.barCard}, do ${ATTORNEY.barCouncil}, contribuinte fiscal ` +
        `${ATTORNEY.taxNumber}, com morada profissional na ${ATTORNEY.address}, telemóvel ` +
        `${ATTORNEY.phone}, e e-mail ${ATTORNEY.email}, à qual confere os poderes especiais ` +
        `necessários para:`,
      en:
        `${p("fullName", "en")}, ${p("nationality", "en")} citizen, born in ${p("birthPlace", "en")}, ` +
        `on ${p("birthDate", "en")}, of legal age, holder of passport No. ${p("passportNumber", "en")}, ` +
        `issued by ${p("passportIssuer", "en")} on ${p("passportIssueDate", "en")}, valid until ` +
        `${p("passportExpiryDate", "en")}, residing at ${p("address", "en")}, hereby appoints as his/her ` +
        `true and lawful attorney-in-fact, with powers of substitution, Ms. ${ATTORNEY.name}, ` +
        `Attorney-at-Law, holder of Professional Bar Card No. ${ATTORNEY.barCard}, issued by the ` +
        `${ATTORNEY.barCouncilEn}, taxpayer No. ${ATTORNEY.taxNumber}, with professional address at ` +
        `${ATTORNEY.address}, mobile phone number ${ATTORNEY.phone}, and email address ` +
        `${ATTORNEY.email}, to whom he/she grants the special powers necessary to:`,
    },

    {
      kind: "item",
      number: "1)",
      pt:
        "Requerer junto da Autoridade Tributária e Aduaneira a atribuição do seu Número de " +
        "Identificação Fiscal (NIF), nomeando expressamente a presente procuradora como sua " +
        "representante fiscal, declarando que a mesma não atuará como gestora de bens ou direitos, " +
        "ou seja, não assumirá ou será incumbida, por qualquer meio, da administração dos bens do " +
        "representado em território português, não agindo, por isso, no interesse e por conta do " +
        "representado;",
      en:
        "Apply to the Tax and Customs Authority for the assignment of Tax Identification Number " +
        "(NIF), expressly appointing this attorney as tax representative, declaring that she will " +
        "not act as a manager of assets or rights, meaning she will not assume or be tasked, in any " +
        "way, with the administration of assets in Portuguese territory, and will not act, " +
        "therefore, in the interest and on behalf of the represented party;",
    },

    {
      kind: "item",
      number: "2)",
      pt:
        "Solicitar toda e qualquer informação ou documentos que se fizerem necessários, bem como a " +
        "senha de acesso ao sistema informático do “PORTAL DAS FINANÇAS”, podendo ainda, fazer o " +
        "levantamento do documento com a senha de acesso (palavra-passe), praticando e assinando " +
        "tudo o que seja necessário ao indicado fim.",
      en:
        "Request any and all information or documents that may be necessary, as well as the access " +
        "password to the “PORTAL DAS FINANÇAS” computer system and may also retrieve the document " +
        "with the access password (password), performing and signing everything necessary for the " +
        "stated purpose.",
    },

    {
      kind: "paragraph",
      pt: "A presente Procuração caduca com a plena realização do seu objecto ou até ser expressamente revogada.",
      en: "This Power of Attorney shall lapse with the full execution of its scope or until expressly revoked.",
    },

    {
      kind: "paragraph",
      pt: `Fazendo fé, a presente Procuração é assinada em Lisboa no dia ${d("day", "pt")} de ${month("pt")} de ${d("year", "pt")}.`,
      en: `In witness hereof, this Power of Attorney is signed in Lisbon, on the ${d("day", "en")} of ${month("en")}, ${d("year", "en")}.`,
    },

    { kind: "signature", name: value("fullName", principal.fullName, "pt") },
  ];
}
