"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Building2, Coffee, Clock, Bell, Shield, Palette, Save, Loader2 } from "lucide-react";

export default function SettingsPage() {
  const [saving, setSaving] = useState(false);

  const [branchSettings, setBranchSettings] = useState({
    name: "Play Coffee - Sucursal Centro",
    address: "Av. Principal 123, Col. Centro",
    phone: "555-0000",
    email: "centro@playcoffee.mx",
    currency: "MXN",
    timezone: "America/Mexico_City",
    taxRate: "0",
  });

  const [posSettings, setPosSettings] = useState({
    requireTableForOrder: true,
    allowTakeaway: true,
    allowDelivery: false,
    printReceipt: true,
    tipEnabled: true,
    defaultTip: "10",
  });

  const [childSettings, setChildSettings] = useState({
    maxDefaultMinutes: "120",
    warningAtPercent: "85",
    requireBracelet: false,
    autoNotifyGuardian: true,
  });

  const [notifSettings, setNotifSettings] = useState({
    lowStockAlerts: true,
    orderAlerts: true,
    reservationReminders: true,
    childOvertimeAlerts: true,
    emailNotifications: false,
  });

  const handleSave = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 800));
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configuración"
        description="Ajusta los parámetros del sistema"
        actions={
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Guardar cambios
          </Button>
        }
      />

      <Tabs defaultValue="branch">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="branch" className="gap-2"><Building2 className="h-4 w-4" />Sucursal</TabsTrigger>
          <TabsTrigger value="pos" className="gap-2"><Coffee className="h-4 w-4" />POS</TabsTrigger>
          <TabsTrigger value="children" className="gap-2"><Clock className="h-4 w-4" />Control Infantil</TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2"><Bell className="h-4 w-4" />Notificaciones</TabsTrigger>
          <TabsTrigger value="security" className="gap-2"><Shield className="h-4 w-4" />Seguridad</TabsTrigger>
        </TabsList>

        {/* Branch */}
        <TabsContent value="branch" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Información de la Sucursal</CardTitle>
              <CardDescription>Datos generales y configuración regional</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Nombre de la sucursal</Label>
                  <Input value={branchSettings.name}
                    onChange={(e) => setBranchSettings((s) => ({ ...s, name: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Teléfono</Label>
                  <Input value={branchSettings.phone}
                    onChange={(e) => setBranchSettings((s) => ({ ...s, phone: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Dirección</Label>
                <Input value={branchSettings.address}
                  onChange={(e) => setBranchSettings((s) => ({ ...s, address: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Correo electrónico</Label>
                <Input type="email" value={branchSettings.email}
                  onChange={(e) => setBranchSettings((s) => ({ ...s, email: e.target.value }))} />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Moneda</Label>
                  <Select value={branchSettings.currency}
                    onValueChange={(v) => setBranchSettings((s) => ({ ...s, currency: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MXN">MXN — Peso Mexicano</SelectItem>
                      <SelectItem value="USD">USD — Dólar</SelectItem>
                      <SelectItem value="EUR">EUR — Euro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Zona horaria</Label>
                  <Select value={branchSettings.timezone}
                    onValueChange={(v) => setBranchSettings((s) => ({ ...s, timezone: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="America/Mexico_City">CDMX (UTC-6)</SelectItem>
                      <SelectItem value="America/Monterrey">Monterrey (UTC-6)</SelectItem>
                      <SelectItem value="America/Tijuana">Tijuana (UTC-8)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Tasa de IVA (%)</Label>
                  <Input type="number" min={0} max={100} step={0.1} value={branchSettings.taxRate}
                    onChange={(e) => setBranchSettings((s) => ({ ...s, taxRate: e.target.value }))} />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* POS */}
        <TabsContent value="pos" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Configuración del Punto de Venta</CardTitle>
              <CardDescription>Comportamiento del POS y caja</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {[
                { key: "requireTableForOrder", label: "Requerir mesa al crear orden", desc: "Solo permite crear órdenes con mesa asignada" },
                { key: "allowTakeaway", label: "Permitir órdenes para llevar", desc: "Órdenes sin mesa asignada" },
                { key: "allowDelivery", label: "Permitir entregas a domicilio", desc: "Habilitar modo delivery en el POS" },
                { key: "printReceipt", label: "Imprimir ticket automáticamente", desc: "Al completar cada pago" },
                { key: "tipEnabled", label: "Propina habilitada", desc: "Mostrar opción de propina en pantalla de pago" },
              ].map(({ key, label, desc }) => (
                <div key={key} className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-sm">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                  <Switch
                    checked={posSettings[key as keyof typeof posSettings] as boolean}
                    onCheckedChange={(v) => setPosSettings((s) => ({ ...s, [key]: v }))}
                  />
                </div>
              ))}
              {posSettings.tipEnabled && (
                <div className="space-y-1.5">
                  <Label>Propina predeterminada (%)</Label>
                  <Input type="number" className="max-w-32" min={0} max={100} value={posSettings.defaultTip}
                    onChange={(e) => setPosSettings((s) => ({ ...s, defaultTip: e.target.value }))} />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Children */}
        <TabsContent value="children" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Control de Área Infantil</CardTitle>
              <CardDescription>Tiempos y alertas de permanencia</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Tiempo máximo predeterminado (min)</Label>
                  <Input type="number" min={30} value={childSettings.maxDefaultMinutes}
                    onChange={(e) => setChildSettings((s) => ({ ...s, maxDefaultMinutes: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Advertencia al alcanzar (%)</Label>
                  <Input type="number" min={50} max={99} value={childSettings.warningAtPercent}
                    onChange={(e) => setChildSettings((s) => ({ ...s, warningAtPercent: e.target.value }))} />
                  <p className="text-xs text-muted-foreground">% del tiempo máximo al cual se muestra alerta amarilla</p>
                </div>
              </div>
              {[
                { key: "requireBracelet", label: "Requerir pulsera de identificación", desc: "Obliga capturar ID de pulsera al registrar ingreso" },
                { key: "autoNotifyGuardian", label: "Notificar al tutor automáticamente", desc: "Alertar cuando el tiempo esté por vencer" },
              ].map(({ key, label, desc }) => (
                <div key={key} className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-sm">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                  <Switch
                    checked={childSettings[key as keyof typeof childSettings] as boolean}
                    onCheckedChange={(v) => setChildSettings((s) => ({ ...s, [key]: v }))}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Notificaciones</CardTitle>
              <CardDescription>Alertas del sistema en tiempo real</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {[
                { key: "lowStockAlerts", label: "Alertas de stock bajo", desc: "Cuando un artículo llegue al mínimo de inventario" },
                { key: "orderAlerts", label: "Alertas de órdenes", desc: "Nuevas órdenes y cambios de estado" },
                { key: "reservationReminders", label: "Recordatorios de reservación", desc: "30 minutos antes de cada reservación" },
                { key: "childOvertimeAlerts", label: "Alertas de tiempo infantil", desc: "Cuando un niño supere el tiempo permitido" },
                { key: "emailNotifications", label: "Notificaciones por correo", desc: "Resumen diario enviado por email" },
              ].map(({ key, label, desc }) => (
                <div key={key} className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-sm">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                  <Switch
                    checked={notifSettings[key as keyof typeof notifSettings]}
                    onCheckedChange={(v) => setNotifSettings((s) => ({ ...s, [key]: v }))}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security */}
        <TabsContent value="security" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Seguridad y Acceso</CardTitle>
              <CardDescription>Roles, PIN y autenticación</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-muted p-4 space-y-3">
                <p className="text-sm font-medium">Roles del sistema</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { role: "ADMIN", desc: "Acceso total" },
                    { role: "MANAGER", desc: "Reportes y configuración" },
                    { role: "CASHIER", desc: "POS y pagos" },
                    { role: "WAITER", desc: "Mesas y órdenes" },
                    { role: "KITCHEN", desc: "Comandero de cocina" },
                  ].map(({ role, desc }) => (
                    <div key={role} className="flex items-center gap-2 rounded-md bg-background px-3 py-2 border">
                      <Badge variant="secondary" className="text-xs font-mono">{role}</Badge>
                      <span className="text-xs text-muted-foreground">{desc}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border p-4 space-y-2">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  Autenticación PIN
                </p>
                <p className="text-xs text-muted-foreground">
                  Los cajeros y meseros pueden ingresar con un PIN de 4 dígitos desde la pantalla de login.
                  Los PINs se almacenan hasheados con bcrypt.
                </p>
              </div>
              <div className="rounded-lg border p-4 space-y-2">
                <p className="text-sm font-medium">Sesión JWT</p>
                <p className="text-xs text-muted-foreground">
                  Access token: 15 minutos · Refresh token: 7 días
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
