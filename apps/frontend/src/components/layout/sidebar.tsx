"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { getAllowedNavigationItems } from "@/lib/permissions";
import { useAuthStore } from "@/store/auth.store";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Baby,
  BarChart3,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  Coffee,
  LayoutDashboard,
  LogOut,
  Package,
  Settings,
  ShoppingCart,
  Table2,
  Tags,
  UserCog,
  WalletCards,
} from "lucide-react";

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

export function Sidebar() {
  const pathname = usePathname();
  const { user, clearAuth } = useAuthStore();
  const navItems = getAllowedNavigationItems(user);

  const initials = user
    ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`
    : "?";

  return (
    <aside
      className="flex h-screen w-64 flex-col border-r"
      style={{
        background: "hsl(var(--sidebar-background))",
        borderColor: "hsl(var(--sidebar-border))",
        color: "hsl(var(--sidebar-foreground))",
      }}
    >
      <div
        className="flex h-16 items-center gap-3 border-b px-5"
        style={{ borderColor: "hsl(var(--sidebar-border))" }}
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600">
          <Coffee className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold leading-none text-white">PlayCoffee</p>
          <p className="mt-0.5 text-xs opacity-60">Management OS</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-4">
        <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider opacity-40">
          Menu Principal
        </p>
        {navItems.map(({ href, label, icon }) => {
          const Icon = navIcons[icon as keyof typeof navIcons];
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
                isActive
                  ? "bg-blue-600 text-white shadow-sm"
                  : "opacity-70 hover:bg-white/10 hover:opacity-100",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{label}</span>
              {isActive && <ChevronRight className="h-3.5 w-3.5 opacity-60" />}
            </Link>
          );
        })}
      </nav>

      <div
        className="border-t p-3"
        style={{ borderColor: "hsl(var(--sidebar-border))" }}
      >
        <div className="flex items-center gap-3 rounded-lg p-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user?.avatarUrl} />
            <AvatarFallback className="bg-blue-600 text-xs font-bold text-white">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">
              {user ? `${user.firstName} ${user.lastName}` : "Usuario"}
            </p>
            <Badge
              variant="secondary"
              className="mt-0.5 h-4 border-0 bg-white/10 px-1.5 py-0 text-xs text-white/70"
            >
              {user?.role ?? "-"}
            </Badge>
          </div>
          <button
            onClick={clearAuth}
            className="rounded p-1.5 opacity-50 transition-opacity hover:bg-white/10 hover:opacity-100"
            title="Cerrar sesion"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
