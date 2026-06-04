"use client";

import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Coffee, MapPin, Clock, Bell, Shield } from "lucide-react";

export default function AreasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  return (
    <div className="flex flex-col h-full space-y-6 p-6">
      <PageHeader
        title="Configuración"
        description="Ajusta los parámetros del sistema"
      />

      <Tabs value="areas" onValueChange={(value) => {
        if (value !== "areas") {
          router.push("/settings");
        }
      }}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="branch" className="gap-2">
            <Building2 className="h-4 w-4" />
            Sucursal
          </TabsTrigger>
          <TabsTrigger value="pos" className="gap-2">
            <Coffee className="h-4 w-4" />
            POS
          </TabsTrigger>
          <TabsTrigger value="areas" className="gap-2">
            <MapPin className="h-4 w-4" />
            Áreas
          </TabsTrigger>
          <TabsTrigger value="children" className="gap-2">
            <Clock className="h-4 w-4" />
            Control Infantil
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            Notificaciones
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Shield className="h-4 w-4" />
            Seguridad
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">{children}</div>
      </Tabs>
    </div>
  );
}
