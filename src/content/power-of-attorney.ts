/**
 * The two powers of attorney the client signs so the firm can act for them:
 * one for the NIF (the firm becomes tax representative and collects the
 * Finanças password), one for the bank account. Both are transcribed word
 * for word from the firm's current Word models in docs/power of attorney/
 * (MODELO - Procuracao NIF and MODELO - Procuracao Conta Bancaria, "campos
 * em branco"), including their own punctuation.
 *
 * The documents are bilingual by design: each Portuguese paragraph is
 * followed by its English counterpart. Finanças and the bank read the
 * Portuguese; the signatory reads the English. Both must stay in the file,
 * and they must stay in step: editing one side without the other produces
 * a document that says two different things.
 *
 * Nothing here is legal drafting on our part. Treat the wording as fixed and
 * send any change back to the firm. The one house choice is how a date is
 * spelled out (formatDeedDate), which the models leave free form.
 */

import { lisbonCalendarDate } from "@/lib/dates/lisbon";
import type { ApplicantGender, PoaTemplate } from "@/lib/db/types";

/**
 * The attorney the power is granted to, as written in both models. Kept as
 * a reference for tests and for anything that needs one of these values on
 * its own; the paragraphs below carry the same text verbatim.
 */
export const ATTORNEY = {
  name: "Patrícia Soares Viana",
  barNumber: "65755L",
  barCouncil: "Conselho Regional de Lisboa",
  taxNumber: "295970677",
  address: "Av. António Augusto Aguiar, 24, 1.º Direito, Escritório 3, 1050-016, Lisboa",
  phone: "+351 934 548 395",
  email: "patriciaviana-65755L@adv.oa.pt",
} as const;

/**
 * What the signatory supplies. Every field appears once in the Portuguese
 * paragraph and once in the English one, so each is written here once and
 * substituted in both places.
 *
 * Left out, a field prints the model's own bracketed placeholder, so an
 * unfilled document reads as a template rather than as a finished deed with
 * blanks in it. Dates are `YYYY-MM-DD` (spelled out by formatDeedDate); any
 * other string is printed as given.
 */
export type PrincipalDetails = {
  /** Full legal name, exactly as written in the passport. */
  fullName?: string;
  /** `f` prints nascida, her, she; `m` nascido, his, he; missing prints both. */
  gender?: ApplicantGender;
  /** City and country of birth. */
  birthPlace?: string;
  birthDate?: string;
  passportNumber?: string;
  passportIssuer?: string;
  passportIssueDate?: string;
  passportExpiryDate?: string;
  /** Full tax residence address including postal code, city and country. */
  taxAddress?: string;
};

/** Date the deed is signed. Empty parts print the model's placeholders. */
export type SigningDate = {
  day?: string;
  monthPt?: string;
  monthEn?: string;
  year?: string;
};

export type PoaBlock =
  | { kind: "title"; pt: string; en: string }
  | { kind: "paragraph"; pt: string; en: string }
  /** A granted power. `number` is the label the model uses: "1)" or "a)". */
  | { kind: "item"; number: string; pt: string; en: string }
  | { kind: "signature"; name: string };

type Lang = "pt" | "en";

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

const MONTHS_PT = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
const MONTHS_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * `2026-03-12` becomes `12 de março de 2026` in Portuguese and
 * `12 March 2026` in English. Anything that is not `YYYY-MM-DD` with a
 * month between 01 and 12 is returned as it came, so a value typed by hand
 * is never mangled.
 */
export function formatDeedDate(iso: string, lang: Lang): string {
  const match = ISO_DATE.exec(iso.trim());
  if (!match) return iso;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return iso;
  return lang === "pt"
    ? `${day} de ${MONTHS_PT[month - 1]} de ${year}`
    : `${day} ${MONTHS_EN[month - 1]} ${year}`;
}

/** The signing date for an instant, as the calendar reads in Lisbon at that moment. */
export function signingDateFor(date: Date): SigningDate {
  const { year, month, day } = lisbonCalendarDate(date);
  return {
    day: String(day),
    monthPt: MONTHS_PT[month - 1],
    monthEn: MONTHS_EN[month - 1],
    year: String(year),
  };
}

// ---------------------------------------------------------------------------
// Placeholders and gendered words
// ---------------------------------------------------------------------------

/**
 * The bracketed text the firm's models use where a value is missing, per
 * language. The English side of both models keeps the Portuguese brackets
 * for the name and the passport number, and so do we.
 */
const PLACEHOLDER = {
  fullName: { pt: "[NOME COMPLETO]", en: "[NOME COMPLETO]" },
  birthPlace: { pt: "[LOCAL DE NASCIMENTO]", en: "[PLACE OF BIRTH]" },
  birthDate: { pt: "[DATA DE NASCIMENTO]", en: "[DATE OF BIRTH]" },
  passportNumber: { pt: "[N.º DO PASSAPORTE]", en: "[N.º DO PASSAPORTE]" },
  passportIssuer: { pt: "[ENTIDADE EMISSORA DO PASSAPORTE]", en: "[PASSPORT ISSUING AUTHORITY]" },
  passportIssueDate: { pt: "[DATA DE EMISSÃO]", en: "[DATE OF ISSUE]" },
  passportExpiryDate: { pt: "[DATA DE VALIDADE]", en: "[EXPIRY DATE]" },
  taxAddress: { pt: "[MORADA FISCAL]", en: "[TAX RESIDENCE ADDRESS]" },
  day: { pt: "[DIA]", en: "[DAY]" },
  month: { pt: "[MÊS]", en: "[MONTH]" },
  year: { pt: "[ANO]", en: "[YEAR]" },
} as const;

type TextField = Exclude<keyof PrincipalDetails, "gender">;
const DATE_FIELDS: ReadonlySet<TextField> = new Set(["birthDate", "passportIssueDate", "passportExpiryDate"]);

/** How each model refers to the principal, by gender; the third column is the model's own bracket resolved for an unknown gender. */
const GENDERED = {
  born: { f: "nascida", m: "nascido", unknown: "nascido(a)" },
  his: { f: "her", m: "his", unknown: "his/her" },
  he: { f: "she", m: "he", unknown: "he/she" },
} as const;

type Fields = {
  text: (key: TextField, lang: Lang) => string;
  born: string;
  his: string;
  he: string;
  day: (lang: Lang) => string;
  month: (lang: Lang) => string;
  year: (lang: Lang) => string;
};

function fieldsFor(principal: PrincipalDetails, signedOn: SigningDate): Fields {
  const gender = principal.gender === "f" || principal.gender === "m" ? principal.gender : "unknown";
  const present = (value: string | undefined) => {
    const trimmed = value?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : undefined;
  };
  return {
    text: (key, lang) => {
      const value = present(principal[key]);
      if (value === undefined) return PLACEHOLDER[key][lang];
      return DATE_FIELDS.has(key) ? formatDeedDate(value, lang) : value;
    },
    born: GENDERED.born[gender],
    his: GENDERED.his[gender],
    he: GENDERED.he[gender],
    day: (lang) => present(signedOn.day) ?? PLACEHOLDER.day[lang],
    month: (lang) => present(lang === "pt" ? signedOn.monthPt : signedOn.monthEn) ?? PLACEHOLDER.month[lang],
    year: (lang) => present(signedOn.year) ?? PLACEHOLDER.year[lang],
  };
}

// ---------------------------------------------------------------------------
// The deeds
// ---------------------------------------------------------------------------

/** The identification paragraph, identical in both models. */
function opening(f: Fields): PoaBlock {
  return {
    kind: "paragraph",
    pt:
      `${f.text("fullName", "pt")}, ${f.born} em ${f.text("birthPlace", "pt")}, em ` +
      `${f.text("birthDate", "pt")}, maior de idade, titular do passaporte n.º ` +
      `${f.text("passportNumber", "pt")}, emitido por ${f.text("passportIssuer", "pt")} em ` +
      `${f.text("passportIssueDate", "pt")}, válido até ${f.text("passportExpiryDate", "pt")}, ` +
      `residente fiscal em ${f.text("taxAddress", "pt")}, constitui a sua bastante procuradora, ` +
      "com a possibilidade de substabelecer, a Exma. Senhora Dra. Patrícia Soares Viana, " +
      "advogada, inscrita na Ordem dos Advogados sob o n.º 65755L do Conselho Regional de " +
      "Lisboa, contribuinte fiscal n.º 295970677, com domicílio profissional na Av. António " +
      "Augusto Aguiar, 24, 1.º Direito, Escritório 3, 1050-016, Lisboa, telefone +351 934 548 395 " +
      "e endereço de correio eletrónico patriciaviana-65755L@adv.oa.pt, à qual confere os " +
      "poderes especiais necessários para:",
    en:
      `${f.text("fullName", "en")}, born in ${f.text("birthPlace", "en")}, on ` +
      `${f.text("birthDate", "en")}, of legal age, holder of passport no. ` +
      `${f.text("passportNumber", "en")}, issued by ${f.text("passportIssuer", "en")} on ` +
      `${f.text("passportIssueDate", "en")}, valid until ${f.text("passportExpiryDate", "en")}, ` +
      `tax resident at ${f.text("taxAddress", "en")}, hereby appoints as ${f.his} lawful attorney, ` +
      "with the power to substitute, Ms. Dra. Patrícia Soares Viana, attorney-at-law, member of " +
      "the Portuguese Bar Association under no. 65755L of the Lisbon Regional Council, taxpayer " +
      "no. 295970677, with professional address at Av. António Augusto Aguiar, 24, 1st Floor " +
      "Right, Office 3, 1050-016 Lisbon, telephone +351 934 548 395 and email " +
      `patriciaviana-65755L@adv.oa.pt, to whom ${f.he} grants, individually, the necessary, full ` +
      "and sufficient powers, including powers of substitution, to act jointly or separately on " +
      `${f.his} behalf, namely to:`,
  };
}

/** MODELO - Procuracao NIF: two numbered powers, the lapse clause, the signing line. */
function nifDeed(f: Fields): PoaBlock[] {
  return [
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
        "Request all information or documents that may be necessary, as well as the access " +
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
      pt: `Fazendo fé, a presente Procuração é assinada em Lisboa no dia ${f.day("pt")} de ${f.month("pt")} de ${f.year("pt")}.`,
      en: `In witness hereof, this Power of Attorney is signed in Lisbon, on the ${f.day("en")} of ${f.month("en")}, ${f.year("en")}.`,
    },
  ];
}

/** MODELO - Procuracao Conta Bancaria: five lettered powers, the declaration, the lapse clause, the signing line. */
function bankDeed(f: Fields): PoaBlock[] {
  return [
    {
      kind: "item",
      number: "a)",
      pt:
        "Em seu nome e representação, requerer e proceder à abertura de conta bancária junto de " +
        "qualquer instituição bancária em Portugal, mediante a apresentação do presente instrumento " +
        "e dos elementos e informações exigidos, com poderes para assinar contratos de abertura de " +
        "conta, subscrever pedidos de emissão de cartões multibanco e/ou cartões de crédito, aderir " +
        "a serviços de banca direta, canais digitais e produtos financeiros associados, assinar " +
        "contratos de adesão, prestar informações complementares relativas a despesas regulares e " +
        "situação financeira, preencher e assinar formulários bancários, incluindo formulários FIN " +
        "e quaisquer outros documentos necessários à instrução e conclusão do processo de abertura " +
        "de conta, bem como praticar todos os atos necessários à sua emissão, ativação e " +
        "operacionalização; com poderes ainda para movimentar e consultar contas bancárias, " +
        "solicitar e receber cartões matriz, códigos de acesso e credenciais de segurança " +
        "associados às contas abertas por via da presente procuração, e, bem assim, contratar " +
        "seguros bancários em nome do outorgante;",
      en:
        `In ${f.his} name and on ${f.his} behalf, apply for and proceed with the opening of a bank ` +
        "account with any banking institution in Portugal, upon presentation of this instrument " +
        "and of the required elements and information, with powers to sign account opening " +
        "agreements, submit requests for issuance of debit and/or credit cards, subscribe to " +
        "online banking services, direct channels and associated financial products, sign " +
        "adhesion agreements, provide additional information regarding regular expenses and " +
        "financial situation, complete and sign banking forms, including FIN forms and any other " +
        "documents necessary for the instruction and completion of the account opening process, " +
        "as well as perform all acts necessary for its issuance, activation and operationalization; " +
        "with further powers to operate and consult bank accounts, request and receive matrix " +
        "cards, access codes and security credentials related to accounts opened under this power " +
        "of attorney, and, furthermore, to contract insurance products in the name of the principal;",
    },
    {
      kind: "item",
      number: "b)",
      pt:
        "Requerer, obter e levantar junto de qualquer instituição bancária em território português " +
        "quaisquer declarações bancárias, extratos, certificados ou documentos comprovativos, " +
        "designadamente para efeitos de apresentação junto das autoridades de imigração, Consulados " +
        "de Portugal, Agência para a Integração, Migrações e Asilo (AIMA), no âmbito de processos " +
        "de autorização de residência temporária ou permanente, incluindo todos os elementos " +
        "necessários à boa execução do presente mandato e/ou à instrução de pedidos " +
        "administrativos conexos, podendo igualmente solicitar quaisquer declarações adicionais " +
        "que se revelem necessárias;",
      en:
        "To request, obtain and collect from any banking institution in Portuguese territory any " +
        "bank statements, extracts, certificates or supporting documents, namely for the purpose of " +
        "submission before immigration authorities, Portuguese Consulates, and the Agency for " +
        "Integration, Migration and Asylum (AIMA), within the scope of temporary or permanent " +
        "residence permit proceedings, including all elements necessary for the proper execution " +
        "of this mandate and/or for the preparation of related administrative applications, and to " +
        "request any additional declarations that may be deemed necessary;",
    },
    {
      kind: "item",
      number: "c)",
      pt:
        "Abrir, movimentar e encerrar contas bancárias em seu nome, incluindo contas de depósito à " +
        "ordem, contas de títulos, contas de dossier de títulos e contas escrow, junto de quaisquer " +
        "instituições financeiras, sem limitação de natureza ou montante, podendo autorizar débitos " +
        "relativos a despesas, encargos ou comissões decorrentes da movimentação das referidas " +
        "contas, bem como solicitar a emissão de declarações bancárias relativas às operações " +
        "realizadas, autorizar a cobrança de comissões devidas e praticar todos os atos necessários " +
        "à gestão integral das referidas contas;",
      en:
        `To open, operate and close bank accounts in ${f.his} name, including current accounts, ` +
        "securities accounts, custody accounts and escrow accounts, with any banking institution " +
        "and without any limitations, accepting the debit therein of any expenses arising from the " +
        "movement of the same, and/or to request the issuance of any bank statements relating to " +
        "transactions made in such accounts, authorizing the acceptance of the debit of commissions " +
        "due for that purpose;",
    },
    {
      kind: "item",
      number: "d)",
      pt:
        "Proceder à abertura de conta bancária individual do tipo 01, isto é, conta de titular " +
        "único, com poderes para a sua movimentação, gestão e operação nos termos legais e " +
        "contratuais aplicáveis;",
      en:
        "To proceed with the opening of a type 01 bank account, that is, a single-signature " +
        "account, and to operate it accordingly;",
    },
    {
      kind: "item",
      number: "e)",
      pt:
        "Assinar, em nome do outorgante, todos os formulários, declarações e documentos necessários " +
        "ao cumprimento de obrigações legais e regulamentares, incluindo, mas sem limitar, os " +
        "formulários fiscais aplicáveis (designadamente W-9, quando exigível) e documentos " +
        "relacionados com a proteção de dados pessoais, nomeadamente no âmbito do Regulamento Geral " +
        "sobre a Proteção de Dados (RGPD).",
      en:
        "To sign, on behalf of the Principal, all forms, declarations and documents necessary to " +
        "comply with legal and regulatory obligations, including, but not limited to, applicable " +
        "tax forms (namely Form W-9, where required) and documents related to the protection of " +
        "personal data, in particular within the framework of the General Data Protection " +
        "Regulation (GDPR).",
    },
    {
      kind: "paragraph",
      pt:
        "Declara o Mandante, de forma expressa, que a presente procuradora não atuará como gestora " +
        "de bens ou direitos do outorgante, não assumindo, por qualquer forma, funções de " +
        "administração, disposição ou gestão patrimonial. Mais declara que os poderes conferidos " +
        "pela presente procuração se destinam exclusivamente à prática de atos administrativos, " +
        "preparatórios e técnicos necessários à abertura, formalização e ativação de conta " +
        "bancária, não podendo a procuradora, designadamente, efetuar levantamentos, " +
        "transferências, pagamentos ou quaisquer outras operações financeiras, utilizar cartões " +
        "bancários, ainda que emitidos ao abrigo da presente procuração, ordenar ou autorizar " +
        "movimentos de fundos, nem contratar produtos financeiros, crédito ou instrumentos de " +
        "investimento em nome do outorgante.",
      en:
        "The Principal expressly declares that the Attorney-in-fact shall not act as a manager of " +
        "the Principal’s assets or rights, and shall not, in any way, assume functions of " +
        "administration, disposal or asset management. The Principal further declares that the " +
        "powers granted under this power of attorney are strictly limited to the performance of " +
        "administrative, preparatory and technical acts necessary for the opening, formalization " +
        "and activation of a bank account. Accordingly, the Attorney-in-fact is expressly " +
        "prohibited from carrying out withdrawals, transfers, payments or any other financial " +
        "transactions, from using bank cards, even if issued under this power of attorney, from " +
        "ordering or authorizing movements of funds, or from entering financial products, credit " +
        "agreements or investment instruments on behalf of the Principal.",
    },
    {
      kind: "paragraph",
      pt: "A presente Procuração caduca com a plena realização do seu objecto ou até ser expressamente revogada.",
      en: "This Power of Attorney shall lapse upon the full completion of its purpose or upon express revocation.",
    },
    {
      kind: "paragraph",
      pt: `Fazendo fé, a presente Procuração é assinada em Lisboa no dia ${f.day("pt")} de ${f.month("pt")} de ${f.year("pt")}.`,
      en: `In witness whereof, this Power of Attorney is executed in Lisbon on the ${f.day("en")} of ${f.month("en")}, ${f.year("en")}.`,
    },
  ];
}

/**
 * Builds one deed, paragraph by paragraph, in the order its model uses.
 * Portuguese first, English second, always as a pair. Called with no
 * principal and no date it yields the blank template.
 */
export function buildPowerOfAttorney(
  kind: PoaTemplate,
  principal: PrincipalDetails = {},
  signedOn: SigningDate = {},
): PoaBlock[] {
  const f = fieldsFor(principal, signedOn);
  return [
    { kind: "title", pt: "Procuração", en: "Power of Attorney" },
    opening(f),
    ...(kind === "poa_bank" ? bankDeed(f) : nifDeed(f)),
    { kind: "signature", name: f.text("fullName", "pt") },
  ];
}
