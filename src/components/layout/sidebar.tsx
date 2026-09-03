"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  CalendarDays,
  Globe,
  ArrowRightLeft,
  LayoutDashboard,
  Users,
} from "lucide-react";

const callerNav = [
  { href: "/today", label: "My Day", icon: CalendarDays },
  { href: "/universe", label: "Universe", icon: Globe },
  { href: "/handed-over", label: "Handed Over", icon: ArrowRightLeft },
];

const adminNav = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
];

export function Sidebar({ userRole }: { userRole: string }) {
  const pathname = usePathname();

  return (
    <aside className="w-60 flex-none bg-[#620124] text-[#F6E7DC] flex flex-col h-screen sticky top-0">
      <div className="p-4 border-b border-white/15">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center">
            <span className="text-[#620124] font-bold text-sm">K</span>
          </div>
          <div>
            <div className="font-semibold text-white text-sm">Kaushalam</div>
            <div className="text-[11px] opacity-75">Employer Outreach CRM</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 py-2">
        <div className="px-3 py-2">
          <div className="text-[11px] uppercase tracking-wider opacity-60 px-2 mb-1">
            Requirement Gathering
          </div>
          {callerNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors",
                pathname === item.href || pathname.startsWith(item.href + "/")
                  ? "bg-white text-[#620124] font-semibold"
                  : "hover:bg-white/10"
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          ))}
        </div>

        {userRole === "admin" && (
          <div className="px-3 py-2 mt-2 border-t border-white/15">
            <div className="text-[11px] uppercase tracking-wider opacity-60 px-2 mb-1 mt-2">
              Admin
            </div>
            {adminNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors",
                  pathname.startsWith(item.href)
                    ? "bg-white text-[#620124] font-semibold"
                    : "hover:bg-white/10"
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            ))}
          </div>
        )}
      </nav>

      <div className="p-3 border-t border-white/15 text-[11px] opacity-60">
        Kaushalam · Dept of ITE&C, AP
      </div>
    </aside>
  );
}
