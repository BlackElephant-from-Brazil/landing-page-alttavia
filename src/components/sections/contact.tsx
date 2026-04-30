"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, Phone, MapPin, Check } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Reveal } from "@/components/ui/reveal";
import { LiquidGlassShell } from "@/components/ui/LiquidGlass";
import { useContent } from "@/components/providers/content-provider";

const smooth = [0.22, 0.61, 0.36, 1] as const;

export function Contact() {
  const { t, brand } = useContent();
  const contact = t.contact;
  const [sent, setSent] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Placeholder submit. Replace with real endpoint when client provides it.
    setSent(true);
    e.currentTarget.reset();
    setTimeout(() => setSent(false), 4000);
  }

  const titleLines = contact.title.split("\n");

  return (
    <section
      id="contact"
      className="relative py-24 lg:py-32 bg-cream-deep/50"
    >
      <Container size="wide" className="relative z-10">
        <div className="grid gap-14 lg:gap-20 lg:grid-cols-12 items-start">
          <div className="lg:col-span-5">
            <Reveal>
              <Eyebrow align="centerOnMobile">{contact.eyebrow}</Eyebrow>
            </Reveal>
            <Reveal delay={0.1}>
              <h2 className="mt-6 font-serif text-balance text-navy">
                {titleLines.map((line, i) => (
                  <span key={i} className="block">
                    {line}
                  </span>
                ))}
              </h2>
            </Reveal>
            <Reveal delay={0.18}>
              <p className="mt-5 text-lg text-navy-soft leading-relaxed">
                {contact.desc}
              </p>
            </Reveal>

            <Reveal delay={0.3}>
              <ul className="mt-10 space-y-5">
                <li className="flex items-start gap-4">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white border border-warm-line text-gold-dark">
                    <Mail className="size-4" strokeWidth={1.5} />
                  </span>
                  <div>
                    <div className="text-xs uppercase tracking-wider text-navy-muted">
                      {contact.emailLabel}
                    </div>
                    <a
                      href={`mailto:${brand.email}`}
                      className="mt-1 block text-navy hover:text-gold-dark transition-colors"
                    >
                      {brand.email}
                    </a>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white border border-warm-line text-gold-dark">
                    <Phone className="size-4" strokeWidth={1.5} />
                  </span>
                  <div>
                    <div className="text-xs uppercase tracking-wider text-navy-muted">
                      {contact.phoneLabel}
                    </div>
                    <a
                      href={brand.whatsapp}
                      target="_blank"
                      rel="noopener"
                      className="mt-1 block text-navy hover:text-gold-dark transition-colors"
                    >
                      {brand.phone}
                    </a>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white border border-warm-line text-gold-dark">
                    <MapPin className="size-4" strokeWidth={1.5} />
                  </span>
                  <div>
                    <div className="text-xs uppercase tracking-wider text-navy-muted">
                      {contact.officeLabel}
                    </div>
                    <address className="mt-1 not-italic text-navy leading-relaxed">
                      {brand.address.street}<br />
                      {brand.address.zip} {t.cityLabel}
                    </address>
                  </div>
                </li>
              </ul>
            </Reveal>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-8% 0%" }}
            transition={{ duration: 0.85, ease: smooth }}
            className="lg:col-span-7"
          >
            <LiquidGlassShell
              lightVariant
              tintOpacity={0.50}
              borderRadius="1.5rem"
              filter="glass-distortion-soft"
            >
              <form onSubmit={handleSubmit} className="p-7 sm:p-10 lg:p-12">
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field
                    name="name"
                    label={contact.formLabels.name}
                    placeholder={contact.formPlaceholders.name}
                    required
                  />
                  <Field
                    name="email"
                    type="email"
                    label={contact.formLabels.email}
                    placeholder={contact.formPlaceholders.email}
                    required
                  />
                  <Field
                    name="phone"
                    type="tel"
                    label={contact.formLabels.phone}
                    placeholder={contact.formPlaceholders.phone}
                  />
                  <Field
                    name="country"
                    label={contact.formLabels.country}
                    placeholder={contact.formPlaceholders.country}
                    required
                  />
                  <div className="sm:col-span-2">
                    <SelectField
                      name="interest"
                      label={contact.formLabels.interest}
                      options={contact.interestOptions}
                      prompt={contact.selectPrompt}
                      required
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <TextareaField
                      name="message"
                      label={contact.formLabels.message}
                      placeholder={contact.formPlaceholders.message}
                      required
                    />
                  </div>
                </div>

                <div className="mt-7 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:justify-between">
                  <p className="text-xs text-navy-muted max-w-sm">
                    {contact.formLabels.disclaimer}
                  </p>
                  <LiquidGlassShell
                    lightVariant
                    tintOpacity={0.55}
                    borderRadius="9999px"
                    filter="glass-distortion-soft"
                    enableHover
                    className="w-full sm:w-auto shrink-0"
                    contentClassName="px-8 py-3"
                  >
                    <button
                      type="submit"
                      disabled={sent}
                      className="flex items-center gap-2 text-navy font-medium text-base whitespace-nowrap w-full justify-center"
                    >
                      {sent ? (
                        <span className="inline-flex items-center gap-2">
                          <Check className="size-4" />
                          {contact.messageSent}
                        </span>
                      ) : (
                        <>
                          {contact.formLabels.submit}
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden
                          >
                            <path d="M5 12h14" />
                            <path d="m12 5 7 7-7 7" />
                          </svg>
                        </>
                      )}
                    </button>
                  </LiquidGlassShell>
                </div>
              </form>
            </LiquidGlassShell>
          </motion.div>
        </div>
      </Container>
    </section>
  );
}

/* --- Field primitives --- */

type FieldProps = {
  name: string;
  label: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
};

function Field({ name, label, placeholder, type = "text", required }: FieldProps) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wider text-navy-muted">
        {label}
        {required && <span className="text-gold-dark"> *</span>}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="mt-2 block w-full rounded-full border border-white/40 bg-white/30 px-5 h-12 text-sm text-navy placeholder:text-navy-muted/60 focus:outline-none focus:border-gold/50 focus:bg-white/60 focus:ring-4 focus:ring-gold/15 transition-[border-color,background-color,box-shadow] duration-300"
      />
    </label>
  );
}

function TextareaField({
  name,
  label,
  placeholder,
  required,
}: Omit<FieldProps, "type">) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wider text-navy-muted">
        {label}
        {required && <span className="text-gold-dark"> *</span>}
      </span>
      <textarea
        name={name}
        required={required}
        placeholder={placeholder}
        rows={4}
        className="mt-2 block w-full rounded-2xl border border-white/40 bg-white/30 px-5 py-4 text-sm text-navy placeholder:text-navy-muted/60 focus:outline-none focus:border-gold/50 focus:bg-white/60 focus:ring-4 focus:ring-gold/15 transition-[border-color,background-color,box-shadow] duration-300 resize-none"
      />
    </label>
  );
}

function SelectField({
  name,
  label,
  options,
  prompt,
  required,
}: {
  name: string;
  label: string;
  options: readonly string[];
  prompt: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wider text-navy-muted">
        {label}
        {required && <span className="text-gold-dark"> *</span>}
      </span>
      <select
        name={name}
        required={required}
        defaultValue=""
        className="mt-2 block w-full appearance-none rounded-full border border-white/40 bg-white/30 px-5 h-12 text-sm text-navy focus:outline-none focus:border-gold/50 focus:bg-white/60 focus:ring-4 focus:ring-gold/15 transition-[border-color,background-color,box-shadow] duration-300"
      >
        <option value="" disabled>
          {prompt}
        </option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </label>
  );
}
