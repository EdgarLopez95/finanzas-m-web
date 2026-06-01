import { TopBar } from "@/components/layout/top-bar";
import { Sidebar } from "@/components/layout/sidebar";

type AppShellProps = {
  title: string;
  children: React.ReactNode;
};

export function AppShell({ title, children }: AppShellProps) {
  return (
    <main className="mx-auto grid min-h-screen w-full max-w-6xl gap-4 p-4 md:grid-cols-[220px_1fr] md:p-6">
      <Sidebar />
      <div className="space-y-4">
        <TopBar title={title} />
        {children}
      </div>
    </main>
  );
}
