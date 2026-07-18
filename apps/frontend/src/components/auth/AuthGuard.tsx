"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "@/store/auth.store";
import {
  canAccessModule,
  getDefaultRouteForRole,
  getModuleForPath,
} from "@/lib/permissions";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, accessToken, hasHydrated, user } = useAuthStore();

  useEffect(() => {
    if (!hasHydrated) return;
    if (!isAuthenticated || !accessToken) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }

    const routeModule = getModuleForPath(pathname);
    if (!canAccessModule(user, routeModule)) {
      router.replace(getDefaultRouteForRole(user));
    }
  }, [accessToken, hasHydrated, isAuthenticated, pathname, router, user]);

  if (!hasHydrated || !isAuthenticated || !accessToken) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!canAccessModule(user, getModuleForPath(pathname))) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Redirigiendo...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
