"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { personalNavigationItems } from "@/components/layout/navigation";
import { cn } from "@/lib/utils";

type SidebarProps = {
  userName?: string | null;
  userEmail?: string | null;
  movementCount?: number;
};

const getInitials = (value?: string | null): string => {
  if (!value) {
    return "FM";
  }

  const parts = value
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (!parts.length) {
    return "FM";
  }

  return parts.map((part) => part.charAt(0).toUpperCase()).join("");
};

export function Sidebar({ userName, userEmail, movementCount = 0 }: SidebarProps) {
  const pathname = usePathname();
  const personalIsActive = pathname !== "/household";
  const initials = getInitials(userName);

  return (
    <aside className="flex h-full min-h-[calc(100vh-2rem)] flex-col bg-[linear-gradient(180deg,rgba(15,22,35,0.98),rgba(11,17,28,0.98))] px-4 py-5 lg:min-h-screen lg:border-r lg:border-r-white/7 lg:px-5 lg:py-6">
      <Link className="block px-2" href="/dashboard">
        <Image
          alt="Finanzas M"
          className="h-auto w-full max-w-[190px]"
          height={61}
          priority
          src="/brand/logo-white-text.svg"
          width={244}
        />
      </Link>

      <div className="mt-7 rounded-[18px] border border-[rgba(124,145,181,0.14)] bg-[rgba(17,24,36,0.74)] p-1">
        <div className="grid grid-cols-2 gap-1">
          <Link
            className={cn(
              "inline-flex min-h-10 items-center justify-center rounded-[14px] px-4 text-sm font-semibold transition-all",
              personalIsActive
                ? "bg-[rgba(34,49,76,0.98)] text-[var(--fm-warm-paper)] shadow-[inset_0_1px_0_rgb(255_255_255/0.03)]"
                : "text-[#8da0bd] hover:bg-white/4 hover:text-[var(--fm-warm-paper)]",
            )}
            href="/dashboard"
          >
            Personal
          </Link>
          <Link
            className={cn(
              "inline-flex min-h-10 items-center justify-center rounded-[14px] px-4 text-sm font-semibold transition-all",
              !personalIsActive
                ? "bg-[rgba(34,49,76,0.98)] text-[var(--fm-warm-paper)] shadow-[inset_0_1px_0_rgb(255_255_255/0.03)]"
                : "text-[#8da0bd] hover:bg-white/4 hover:text-[var(--fm-warm-paper)]",
            )}
            href="/household"
          >
            Hogar
          </Link>
        </div>
      </div>

      <div className="mt-10 px-2">
        <p className="text-[11px] uppercase tracking-[0.26em] text-[#6f809b]">Menú</p>
      </div>

      <nav aria-label="Personal" className="mt-5 flex flex-col gap-1">
        {personalNavigationItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "group flex min-h-[46px] items-center gap-3 rounded-[16px] px-4 text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fm-transfer)]",
                isActive
                  ? "bg-[rgba(31,45,69,0.96)] text-[var(--fm-warm-paper)] shadow-[inset_0_1px_0_rgb(255_255_255/0.025)]"
                  : "text-[#91a2bb] hover:bg-white/4 hover:text-[var(--fm-warm-paper)]",
              )}
              data-nav-item
              href={item.href}
            >
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center transition-colors",
                  isActive ? "text-[var(--fm-pending)]" : "text-[#788aa6] group-hover:text-[#96a8c0]",
                )}
              >
                <Icon className="h-[18px] w-[18px] stroke-[1.8]" />
              </span>
              <span className={cn("flex-1", isActive ? "font-semibold" : "font-medium")}>
                {item.label}
              </span>
              {item.href === "/movements" ? (
                <span className="inline-flex min-w-7 items-center justify-center rounded-full bg-[rgba(36,50,74,0.95)] px-2 py-0.5 text-[11px] font-semibold text-[#c4d3e7]">
                  {movementCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-white/7 px-2 pt-5">
        <div className="flex items-center gap-3 py-1">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[linear-gradient(180deg,rgba(76,95,128,0.96),rgba(46,58,82,0.96))] text-sm font-semibold text-[var(--fm-warm-paper)]">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--fm-warm-paper)]">
              {userName || "Sesion activa"}
            </p>
            <p className="truncate text-xs text-[#7385a0]">{userEmail || "Google Auth"}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
