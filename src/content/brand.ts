// Brand data shared across all locales. Only strings that don't need translation live here.
export const brand = {
  name: "Alttavia Relocation",
  shortName: "Alttavia",
  legalEntity: "Viana Consultancy",
  email: "enquiries@vianaconsultancy.com",
  phone: "+351 969 009 629",
  phoneDigits: "351969009629",
  whatsapp: "https://wa.me/351969009629",
  instagram: "#",
  facebook: "#",
  address: {
    street: "Av. António Augusto Aguiar 24, 1º direito",
    zip: "1050-016",
  },
  map: {
    embed:
      "https://www.google.com/maps?q=Av.%20Ant%C3%B3nio%20Augusto%20Aguiar%2024%2C%20Lisboa&output=embed",
    link: "https://www.google.com/maps/search/?api=1&query=Av.%20Ant%C3%B3nio%20Augusto%20Aguiar%2024%2C%20Lisboa",
  },
} as const;

export type Brand = typeof brand;
