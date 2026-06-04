"use client";

import { usePathname } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // Solo mostrar header si NO estamos en una subruta específica como /settings/areas
  const isSubPage = pathname !== "/settings";

  return (
    <div className="flex flex-col h-full space-y-6 p-6">
      {!isSubPage && (
        <PageHeader
          title="Configuración"
          description="Ajusta los parámetros del sistema"
        />
      )}
      {children}
    </div>
  );
}
