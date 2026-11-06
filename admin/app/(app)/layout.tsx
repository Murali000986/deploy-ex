import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { Sidebar } from "@/components/shell/sidebar";
import { Header } from "@/components/shell/header";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="flex-1 overflow-y-auto scrollbar-thin bg-subtle">
          <div className="mx-auto w-full max-w-[1400px] px-5 py-6 md:px-7 md:py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
