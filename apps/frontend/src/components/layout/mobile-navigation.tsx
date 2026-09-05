"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Baby,
  BarChart3,
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  Menu,
  Package,
  Settings,
  ShoppingCart,
  Table2,
  Tags,
  UserCog,
  WalletCards,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getAllowedNavigationItems } from "@/lib/permissions";
import { useAuthStore } from "@/store/auth.store";

const navIcons = {
  dashboard: LayoutDashboard,
  pos: ShoppingCart,
  cash: WalletCards,
  products: Tags,
  tables: Table2,
  orders: ClipboardList,
  "child-access": Baby,
  reservations: CalendarDays,
  inventory: Package,
  reports: BarChart3,
  users: UserCog,
  settings: Settings,
};

export function MobileNavigation() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const user = useAuthStore((state) => state.user);
  const navItems = getAllowedNavigationItems(user);
  const primaryHrefs = ["/", "/pos", "/tables", "/orders", "/cash"];
  const primaryItems = primaryHrefs
    .map((href) => navItems.find((item) => item.href === href))
    .filter((item): item is (typeof navItems)[number] => Boolean(item));
  const visiblePrimaryItems = primaryItems.slice(0, 4);
  const moreItems = navItems.filter(
    (item) => !visiblePrimaryItems.some((primary) => primary.href === item.href),
  );

  useEffect(() => setMoreOpen(false), [pathname]);

  const renderLink = ({ href, label, icon }: (typeof navItems)[number], compact = true) => {
    const Icon = navIcons[icon as keyof typeof navIcons];
    const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);

    return (
      <Link
        key={href}
        href={href}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          compact
            ? "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[11px] font-medium"
            : "flex min-h-14 items-center gap-3 rounded-xl border px-4 text-sm font-semibold",
          isActive ? "border-blue-200 bg-blue-50 text-blue-700" : "text-muted-foreground active:bg-muted",
        )}
      >
        <Icon className={compact ? "h-5 w-5" : "h-6 w-6"} />
        <span className={compact ? "w-full truncate text-center" : undefined}>{label}</span>
      </Link>
    );
  };

  return (
    <>
      {moreOpen && (
        <div className="fixed inset-0 z-40 bg-black/35 lg:hidden" onClick={() => setMoreOpen(false)}>
          <section
            aria-label="Más secciones"
            className="absolute inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] max-h-[70dvh] overflow-y-auto rounded-t-2xl bg-background p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Más secciones</h2>
              <button aria-label="Cerrar menú" className="flex h-11 w-11 items-center justify-center rounded-full bg-muted" onClick={() => setMoreOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">{moreItems.map((item) => renderLink(item, false))}</div>
          </section>
        </div>
      )}
      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden"
      >
        <div className="flex h-16 items-stretch px-1">
          {visiblePrimaryItems.map((item) => renderLink(item))}
          <button
            type="button"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((open) => !open)}
            className={cn(
              "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[11px] font-medium",
              moreOpen || moreItems.some((item) => item.href !== "/" && pathname.startsWith(item.href))
                ? "bg-blue-50 text-blue-700"
                : "text-muted-foreground active:bg-muted",
            )}
          >
            <Menu className="h-5 w-5" />
            <span>Más</span>
          </button>
        </div>
      </nav>
    </>
  );
}
