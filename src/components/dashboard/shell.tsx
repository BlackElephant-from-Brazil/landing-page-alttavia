import { Sidebar, TopBar } from "./sidebar";

/**
 * The frame every client area page sits in: navigation on the left from
 * `lg` up, a top bar below that, and a working column on the paper
 * background. Server component; the navigation inside is the client island.
 *
 * The column is wide enough for three service cards in a row and the
 * purchases table; a page that is one long read (a single order) narrows
 * itself with its own `max-w-3xl`.
 */
export function DashboardShell({ email, children }: { email: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col bg-paper lg:flex-row lg:items-start">
      <Sidebar email={email} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar email={email} />
        <main className="flex-1 px-5 py-10 sm:px-8 lg:px-14 lg:py-14">
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
