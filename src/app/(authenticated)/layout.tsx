import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth-utils";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAuth();

  if (!session.user.active) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar userRole={session.user.role} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          userName={session.user.name}
          breadcrumb="Requirement Gathering"
        />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
