// Brand data shared across all locales. Only strings that don't need translation live here.
export const brand = {
  name: "Alttavia Relocation",
  shortName: "Alttavia",
  // The company behind NIPC 518 856 984, as the firm's service agreement models
  // name it (src/content/contracts/models.generated.ts) and as /en/privacy and
  // /en/service-terms print it. Shown in the footer and the JSON-LD legalName.
  legalEntity: "ALTTAVIA RELOCATION, Unipessoal Lda.",
  email: "enquiries@vianaconsultancy.com",
  phone: "+351 969 009 629",
  phoneDigits: "351969009629",
  whatsapp: "https://wa.me/351969009629",
  instagram: "#",
  facebook: "#",
  // The registered office in Portuguese, with the office number the powers of
  // attorney and the service agreements give. The JSON-LD reads it; the
  // footer prints the English line, REGISTERED_OFFICE in src/content/bank-nif.ts.
  address: {
    street: "Av. António Augusto Aguiar 24, 1º direito, Escritório 3",
    zip: "1050-016",
  },
  map: {
    embed:
      "https://www.google.com/maps?q=Av.%20Ant%C3%B3nio%20Augusto%20Aguiar%2024%2C%20Lisboa&output=embed",
    link: "https://www.google.com/maps/search/?api=1&query=Av.%20Ant%C3%B3nio%20Augusto%20Aguiar%2024%2C%20Lisboa",
  },
} as const;

export type Brand = typeof brand;
