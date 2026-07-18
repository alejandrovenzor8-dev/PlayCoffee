import type { User } from "@/types/auth.types";

export type UserRole = User["role"];

export type ModuleKey =
  | "dashboard"
  | "pos"
  | "orders"
  | "tables"
  | "cash"
  | "inventory"
  | "products"
  | "child-access"
  | "reservations"
  | "reports"
  | "settings"
  | "users";

export type NavigationItem = {
  module: ModuleKey;
  href: string;
  label: string;
  icon: string;
};

const ADMIN_ROLES: UserRole[] = ["SUPER_ADMIN", "ADMIN"];

const ROLE_MODULES: Record<UserRole, ModuleKey[]> = {
  SUPER_ADMIN: [
    "dashboard",
    "pos",
    "cash",
    "products",
    "tables",
    "orders",
    "child-access",
    "reservations",
    "inventory",
    "reports",
    "users",
    "settings",
  ],
  ADMIN: [
    "dashboard",
    "pos",
    "cash",
    "products",
    "tables",
    "orders",
    "child-access",
    "reservations",
    "inventory",
    "reports",
    "users",
    "settings",
  ],
  CASHIER: [
    "pos",
    "cash",
    "products",
    "tables",
    "orders",
    "child-access",
    "reservations",
    "inventory",
  ],
  WAITER: ["tables", "orders", "products"],
};

export const NAVIGATION_ITEMS: NavigationItem[] = [
  { module: "dashboard", href: "/", label: "Dashboard", icon: "dashboard" },
  { module: "pos", href: "/pos", label: "Caja / POS", icon: "pos" },
  { module: "cash", href: "/cash", label: "Corte de Caja", icon: "cash" },
  { module: "products", href: "/products", label: "Catalogo", icon: "products" },
  { module: "tables", href: "/tables", label: "Mesas", icon: "tables" },
  { module: "orders", href: "/orders", label: "Comandero", icon: "orders" },
  { module: "child-access", href: "/child-access", label: "Control Infantil", icon: "child-access" },
  { module: "reservations", href: "/reservations", label: "Reservas", icon: "reservations" },
  { module: "inventory", href: "/inventory", label: "Inventario", icon: "inventory" },
  { module: "reports", href: "/reports", label: "Reportes", icon: "reports" },
  { module: "users", href: "/users", label: "Usuarios", icon: "users" },
  { module: "settings", href: "/settings", label: "Configuracion", icon: "settings" },
];

const ROUTE_MODULES: Array<{ prefix: string; module: ModuleKey }> = [
  { prefix: "/pos", module: "pos" },
  { prefix: "/cash", module: "cash" },
  { prefix: "/products", module: "products" },
  { prefix: "/tables", module: "tables" },
  { prefix: "/orders", module: "orders" },
  { prefix: "/child-access", module: "child-access" },
  { prefix: "/children", module: "child-access" },
  { prefix: "/reservations", module: "reservations" },
  { prefix: "/inventory", module: "inventory" },
  { prefix: "/reports", module: "reports" },
  { prefix: "/users", module: "users" },
  { prefix: "/settings", module: "settings" },
];

export function hasRole(user: Pick<User, "role"> | null | undefined, roles: UserRole[]) {
  if (!user) return false;
  return roles.includes(user.role);
}

export function isAdminRole(user: Pick<User, "role"> | null | undefined) {
  return hasRole(user, ADMIN_ROLES);
}

export function canAccessModule(
  user: Pick<User, "role"> | null | undefined,
  module: ModuleKey,
) {
  if (!user) return false;
  return ROLE_MODULES[user.role]?.includes(module) ?? false;
}

export function getAllowedNavigationItems(user: Pick<User, "role"> | null | undefined) {
  return NAVIGATION_ITEMS.filter((item) => canAccessModule(user, item.module));
}

export function getModuleForPath(pathname: string): ModuleKey {
  if (pathname === "/") return "dashboard";
  const match = ROUTE_MODULES.find(
    (route) => pathname === route.prefix || pathname.startsWith(`${route.prefix}/`),
  );
  return match?.module ?? "dashboard";
}

export function getDefaultRouteForRole(user: Pick<User, "role"> | null | undefined) {
  return getAllowedNavigationItems(user)[0]?.href ?? "/login";
}
