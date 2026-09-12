"use client";

import { useEffect, useState } from "react";

import { ButtonLink } from "@/components/ui/button";
import { APPLY_LINKS, bankNif } from "@/content/bank-nif";
import { createClient } from "@/lib/supabase/client";

/**
 * The right hand side of the landing header, aware of the session without
 * making the page dynamic: the page stays static and this island asks the
 * browser Supabase client on mount.
 *
 * Signed out (and until the check resolves, so the server HTML and the
 * first client paint match): "Log in" and "Start my application".
 * Signed in: "Welcome back, <first name>" and "See my application", which
 * goes to the dashboard. The first name is the first word of
 * `public.users.full_name`, read with the user's own session (row level
 * security allows the own row); without one the greeting is just
 * "Welcome back".
 *
 * Copy is plain American friendly English, per the house rules in
 * src/content/bank-nif.ts (short, no dashes as punctuation).
 */

const LOGIN_PATH = "/en/login";
const DASHBOARD_PATH = "/en/dashboard";

const copy = {
  login: "Log in",
  start: bankNif.header.cta,
  welcome: (firstName: string | null) => (firstName ? `Welcome back, ${firstName}` : "Welcome back"),
  dashboard: "See my application",
} as const;

type Session = { kind: "unknown" } | { kind: "out" } | { kind: "in"; firstName: string | null };

function firstWord(fullName: unknown): string | null {
  if (typeof fullName !== "string") return null;
  const word = fullName.trim().split(/\s+/)[0] ?? "";
  return word.length > 0 ? word : null;
}

async function readSession(): Promise<Session> {
  try {
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) return { kind: "out" };
    const { data: profile } = await supabase
      .from("users")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();
    return { kind: "in", firstName: firstWord(profile?.full_name) };
  } catch {
    return { kind: "out" };
  }
}

export function HeaderAuth() {
  const [session, setSession] = useState<Session>({ kind: "unknown" });

  useEffect(() => {
    let alive = true;
    void readSession().then((next) => {
      if (alive) setSession(next);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (session.kind === "in") {
    return (
      <div className="flex items-center gap-5">
        <p className="hidden max-w-[16rem] truncate text-sm text-navy-soft md:block">{copy.welcome(session.firstName)}</p>
        <ButtonLink href={DASHBOARD_PATH} size="md">
          {copy.dashboard}
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <ButtonLink href={LOGIN_PATH} variant="outline" size="md">
        {copy.login}
      </ButtonLink>
      <ButtonLink href={APPLY_LINKS.start} size="md">
        {copy.start}
      </ButtonLink>
    </div>
  );
}
