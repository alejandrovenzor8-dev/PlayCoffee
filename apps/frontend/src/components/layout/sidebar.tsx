"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard,
  ShoppingCart,
  Table2,
  ClipboardList,
  Baby,
  CalendarDays,
  Package,
  BarChart3,
  Settings,
  Coffee,
  WalletCards,
  LogOut,
  ChevronRight,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/pos", label: "Caja / POS", icon: ShoppingCart },
  { href: "/cash", label: "Corte de Caja", icon: WalletCards },
  { href: "/tables", label: "Mesas", icon: Table2 },
  { href: "/orders", label: "Comandero", icon: ClipboardList },
  { href: "/children", label: "Control Infantil", icon: Baby },
  { href: "/reservations", label: "Reservas", icon: CalendarDays },
  { href: "/inventory", label: "Inventario", icon: Package },
  { href: "/reports", label: "Reportes", icon: BarChart3 },
  { href: "/settings", label: "Configuración", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, clearAuth } = useAuthStore();

  const initials = user
    ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`
    : "?";

  return (
    <aside className="flex h-screen w-64 flex-col border-r"
      style={{
        background: "hsl(var(--sidebar-background))",
        borderColor: "hsl(var(--sidebar-border))",
        color: "hsl(var(--sidebar-foreground))",
      }}
    >
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-5 border-b" style={{ borderColor: "hsl(var(--sidebar-border))" }}>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600">
          <Coffee className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-white leading-none">PlayCoffee</p>
          <p className="text-xs opacity-60 mt-0.5">Management OS</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2">
        <p className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider opacity-40">
          Menú Principal
        </p>
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 mb-0.5",
                isActive
                  ? "bg-blue-600 text-white shadow-sm"
                  : "opacity-70 hover:opacity-100 hover:bg-white/10"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{label}</span>
              {isActive && <ChevronRight className="h-3.5 w-3.5 opacity-60" />}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="border-t p-3" style={{ borderColor: "hsl(var(--sidebar-border))" }}>
        <div className="flex items-center gap-3 rounded-lg p-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user?.avatarUrl} />
            <AvatarFallback className="bg-blue-600 text-white text-xs font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {user ? `${user.firstName} ${user.lastName}` : "Usuario"}
            </p>
            <Badge variant="secondary" className="text-xs px-1.5 py-0 h-4 mt-0.5 bg-white/10 text-white/70 border-0">
              {user?.role ?? "—"}
            </Badge>
          </div>
          <button
            onClick={clearAuth}
            className="rounded p-1.5 opacity-50 hover:opacity-100 hover:bg-white/10 transition-opacity"
            title="Cerrar sesión"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
