"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, Phone, MapPin, Check, ShieldCheck, Clock } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/ui/reveal";
import { Button } from "@/components/ui/button";
import { PulseBadge } from "@/components/ui/pulse-badge";
import { useContent } from "@/components/providers/content-provider";

const smooth = [0.22, 0.61, 0.36, 1] as const;

export function Contact() {
  const { t, brand } = useContent();
  const contact = t.contact;
  const status = t.statusBadge;
  const [sent, setSent] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSent(true);
    e.currentTarget.reset();
    setTimeout(() => setSent(false), 4000);
  }

  const titleLines = contact.title.split("\n");

  return (
    <section
      id="contact"
      className="relative py-24 lg:py-32 bg-navy text-white overflow-hidden has-grain-dark isolate"
    >
      <div aria-hidden className="absolute inset-0 grid-lines-navy opacity-40 pointer-events-none" />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -left-32 h-[480px] w-[480px] rounded-full blur-3xl opacity-30"
        style={{
          background:
            "radial-gradient(circle at center, rgba(208,161,43,0.45) 0%, transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 right-0 h-[420px] w-[420px] rounded-full blur-3xl opacity-30"
        style={{
          background:
            "radial-gradient(circle at center, rgba(8,31,102,0.85) 0%, transparent 70%)",
        }}
      />

      <Container size="wide" className="relative">
        <div className="grid gap-14 lg:gap-20 lg:grid-cols-12 items-start">
          <div className="lg:col-span-5">
            <Reveal>
              <PulseBadge tone="green" className="text-[0.62rem]">
                {status.live}
              </PulseBadge>
            </Reveal>
            <Reveal delay={0.08}>
              <div className="mt-6 flex items-center gap-3 text-[0.7rem] font-medium uppercase tracking-[0.28em] text-gold-light">
                <span aria-hidden className="inline-block h-px w-8 bg-gold/70" />
                <span>{contact.eyebrow}</span>
              </div>
            </Reveal>
            <Reveal delay={0.16}>
              <h2 className="mt-6 font-serif text-balance text-white">
                {titleLines.map((line, i) => (
                  <span key={i} className="block">
                    {line}
                  </span>
                ))}
              </h2>
            </Reveal>
            <Reveal delay={0.24}>
              <p className="mt-6 text-base sm:text-lg text-white/75 leading-relaxed">
                {contact.desc}
              </p>
            </Reveal>

            {/* trust strip */}
            <Reveal delay={0.32}>
              <ul className="mt-8 grid grid-cols-1 gap-3">
                <li className="flex items-center gap-3 text-sm text-white/80">
                  <Clock className="size-4 text-gold-light" strokeWidth={1.75} />
                  {contact.replyTime}
                </li>
                <li className="flex items-center gap-3 text-sm text-white/80">
                  <ShieldCheck className="size-4 text-gold-light" strokeWidth={1.75} />
                  {contact.privilege}
                </li>
              </ul>
            </Reveal>

            {/* contact info */}
            <Reveal delay={0.4}>
              <ul className="mt-10 space-y-4 border-t border-white/10 pt-8">
                <ContactRow
                  icon={Mail}
                  label={contact.emailLabel}
                  value={brand.email}
                  href={`mailto:${brand.email}`}
                />
                <ContactRow
                  icon={Phone}
                  label={contact.phoneLabel}
                  value={brand.phone}
                  href={brand.whatsapp}
                  target="_blank"
                />
                <li className="flex items-start gap-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 border border-white/10 text-gold-light">
                    <MapPin className="size-4" strokeWidth={1.5} />
                  </span>
                  <div>
                    <div className="text-[0.62rem] uppercase tracking-[0.22em] text-white/45">
                      {contact.officeLabel}
                    </div>
                    <address className="mt-1 not-italic text-sm text-white/85 leading-relaxed">
                      {brand.address.street}<br />
                      {brand.address.zip} {t.cityLabel}
                    </address>
                  </div>
                </li>
              </ul>
            </Reveal>
          </div>

          <motion.form
            onSubmit={handleSubmit}
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-8% 0%" }}
            transition={{ duration: 0.85, ease: smooth }}
            className="lg:col-span-7 relative rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-md p-7 sm:p-10 lg:p-12"
          >
            <div
              aria-hidden
              className="absolute -top-3 left-7 inline-flex items-center gap-2 rounded-full bg-gold px-3 py-1 text-[0.6rem] font-medium uppercase tracking-[0.22em] text-navy"
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-navy" />
              Open file
            </div>

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
              <p className="text-xs text-white/55 max-w-sm">
                {contact.formLabels.disclaimer}
              </p>
              <Button
                type="submit"
                size="lg"
                variant="gold"
                withArrow
                className="w-full sm:w-auto"
                disabled={sent}
              >
                {sent ? (
                  <span className="inline-flex items-center gap-2">
                    <Check className="size-4" />
                    {contact.messageSent}
                  </span>
                ) : (
                  contact.formLabels.submit
                )}
              </Button>
            </div>
          </motion.form>
        </div>
      </Container>
    </section>
  );
}

function ContactRow({
  icon: Icon,
  label,
  value,
  href,
  target,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: string;
  href: string;
  target?: string;
}) {
  return (
    <li className="flex items-start gap-4">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 border border-white/10 text-gold-light">
        <Icon className="size-4" strokeWidth={1.5} />
      </span>
      <div>
        <div className="text-[0.62rem] uppercase tracking-[0.22em] text-white/45">{label}</div>
        <a
          href={href}
          target={target}
          rel={target ? "noopener" : undefined}
          className="mt-1 block text-sm text-white hover:text-gold-light transition-colors"
        >
          {value}
        </a>
      </div>
    </li>
  );
}

/* --- Field primitives — styled for the dark form background --- */

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
      <span className="block text-[0.62rem] uppercase tracking-[0.22em] text-white/55">
        {label}
        {required && <span className="text-gold-light"> *</span>}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="mt-2 block w-full rounded-full border border-white/10 bg-white/[0.04] px-5 h-12 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-gold focus:bg-white/[0.08] transition-colors"
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
      <span className="block text-[0.62rem] uppercase tracking-[0.22em] text-white/55">
        {label}
        {required && <span className="text-gold-light"> *</span>}
      </span>
      <textarea
        name={name}
        required={required}
        placeholder={placeholder}
        rows={4}
        className="mt-2 block w-full rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-gold focus:bg-white/[0.08] transition-colors resize-none"
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
      <span className="block text-[0.62rem] uppercase tracking-[0.22em] text-white/55">
        {label}
        {required && <span className="text-gold-light"> *</span>}
      </span>
      <select
        name={name}
        required={required}
        defaultValue=""
        className="mt-2 block w-full appearance-none rounded-full border border-white/10 bg-white/[0.04] px-5 h-12 text-sm text-white focus:outline-none focus:border-gold focus:bg-white/[0.08] transition-colors"
      >
        <option value="" disabled className="bg-navy">
          {prompt}
        </option>
        {options.map((opt) => (
          <option key={opt} value={opt} className="bg-navy">
            {opt}
          </option>
        ))}
      </select>
    </label>
  );
}
