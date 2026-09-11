import { Sidebar, TopBar } from "./sidebar";

/**
 * The frame every client area page sits in: navigation on the left from
 * `lg` up, a top bar below that, and a narrow reading column on the paper
 * background. Server component; the navigation inside is the client island.
 */
export function DashboardShell({ email, children }: { email: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col bg-paper lg:flex-row">
      <Sidebar email={email} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar email={email} />
        <main className="flex-1 px-5 py-10 sm:px-8 lg:px-16 lg:py-16">
          <div className="mx-auto w-full max-w-3xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
