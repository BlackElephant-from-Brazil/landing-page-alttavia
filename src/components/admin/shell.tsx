import { AdminSidebar, AdminTopBar } from "./sidebar";

/**
 * The frame every admin page sits in: the navy navigation on the left from
 * `lg` up, a navy top bar below that, and a wide working column on the
 * paper background (the overview and the orders table need the width the
 * client's reading column does not). Server component; the navigation
 * inside is the client island.
 */
export function AdminShell({ email, children }: { email: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col bg-paper lg:flex-row">
      <AdminSidebar email={email} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopBar email={email} />
        <main className="flex-1 px-5 py-10 sm:px-8 lg:px-12 lg:py-12">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
