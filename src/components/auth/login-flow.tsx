"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { CodeStep } from "@/components/auth/code-step";
import { EmailStep } from "@/components/auth/email-step";

/**
 * The client island of /en/login: email screen, then code screen, then away.
 * `next` is already validated by the page (starts with /en/, never the login
 * page itself), so it is used as is.
 *
 * After a successful verify the browser holds the session cookies, but the
 * router's cache still has the pages it rendered for a signed out visitor.
 * `push` moves to the destination and `refresh` makes the server render it
 * again with the new cookies, so the guard in src/proxy.ts sees a user.
 */
export function LoginFlow({ next }: { next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);

  if (email === null) {
    return <EmailStep onSent={setEmail} />;
  }

  return (
    <CodeStep
      email={email}
      onVerified={() => {
        router.push(next);
        router.refresh();
      }}
      onChangeEmail={() => setEmail(null)}
    />
  );
}
