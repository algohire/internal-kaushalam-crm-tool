"use client";

import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function Topbar({
  userName,
  breadcrumb,
}: {
  userName: string;
  breadcrumb: string;
}) {
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    router.push("/login");
  }

  const initials = userName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="h-13 bg-card border-b flex items-center gap-4 px-6 sticky top-0 z-10">
      <div className="text-sm text-muted-foreground">{breadcrumb}</div>
      <div className="ml-auto flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-[#FBEFE3] text-[#620124] font-semibold text-xs flex items-center justify-center border border-[#E7CDB9]">
            {initials}
          </div>
          <span className="text-sm">{userName}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={handleSignOut}>
          <LogOut className="w-4 h-4" />
        </Button>
      </div>
    </header>
  );
}
