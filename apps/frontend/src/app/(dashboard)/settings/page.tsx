"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import { Building2, Coffee, MapPin, Clock, Bell, Shield, Save, Loader2, Printer } from "lucide-react";
import { api, getApiErrorMessage, paymentsApi, printApi } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";

export default function SettingsPage() {
  const router = useRouter();
  const branchId = useAuthStore((state) => state.user?.branchId);
  const [branchLoaded, setBranchLoaded] = useState(false);
  const [branchMessage, setBranchMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [printMessage, setPrintMessage] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [printers, setPrinters] = useState<Array<{ name: string; target: string }>>([]);
  const [testing, setTesting] = useState<string | null>(null);
  const [testJobs, setTestJobs] = useState<Record<string, { id: string; status: string; lastError?: string | null }>>({});
  const discover = async () => {
    setDetecting(true);
    try {
      const found = await printApi.discover();
      setPrinters(found);
      setPrintMessage(found.length ? "Selecciona una impresora detectada para cada estación y guarda los cambios." : "No se encontraron impresoras instaladas en el servidor. Instálalas en Windows o introduce su IP manualmente.");
    } catch (error) { setPrintMessage(getApiErrorMessage(error, "No se pudieron detectar las impresoras.")); }
    finally { setDetecting(false); }
  };
  const testPrinter = async (key: "cashierPrinter" | "kitchenPrinter" | "barPrinter") => {
    setTesting(key);
    try {
      const job = await printApi.test(printSettings[key], printSettings.width, key === "cashierPrinter" ? "CUSTOMER" : key === "kitchenPrinter" ? "KITCHEN" : "BAR");
      setTestJobs((jobs) => ({ ...jobs, [key]: job }));
    } catch (error) { setPrintMessage(getApiErrorMessage(error, "No se pudo enviar la prueba.")); }
    finally { setTesting(null); }
  };
  useEffect(() => {
    const pending = Object.entries(testJobs).filter(([, job]) => ["PENDING", "PROCESSING"].includes(job.status));
    if (!pending.length) return;
    let active = true;
    const timer = window.setTimeout(async () => {
      for (const [key, job] of pending) {
        try {
          const result = await printApi.jobStatus(job.id);
          if (active) setTestJobs((jobs) => ({ ...jobs, [key]: result }));
        } catch (error) {
          if (active) {
            setPrintMessage(getApiErrorMessage(error, "No se pudo consultar la prueba; puede seguir en cola."));
            setTestJobs((jobs) => ({ ...jobs }));
          }
        }
      }
    }, 3000);
    return () => { active = false; window.clearTimeout(timer); };
  }, [testJobs]);
  const [printSettings, setPrintSettings] = useState({
    cashierPrinter: "",
    kitchenPrinter: "",
    barPrinter: "",
    width: "80mm" as "58mm" | "80mm",
    autoKitchen: true,
    autoBar: true,
    autoCustomer: true,
    cashierMode: "BUSINESS_ONLY" as "BUSINESS_ONLY" | "CUSTOMER_AND_BUSINESS",
    confirmClose: false,
    allowReprint: true,
  });

  useEffect(() => {
    printApi.getConfig().then(setPrintSettings).catch(() => {
      setPrintMessage("No se pudo cargar la configuración de impresoras.");
    });
  }, []);

  const handlePrintSave = async () => {
    setSaving(true);
    setPrintMessage(null);
    try {
      const saved = await printApi.updateConfig(printSettings);
      setPrintSettings(saved);
      setPrintMessage("Configuración de impresoras guardada.");
    } catch {
      setPrintMessage("No se pudo guardar. Usa destinos tcp://IP:9100 o windows:///Nombre.");
    } finally {
      setSaving(false);
    }
  };

  const [branchSettings, setBranchSettings] = useState({
    name: "",
    address: "",
    phone: "",
    email: "",
    currency: "MXN",
    timezone: "America/Mexico_City",
    taxRate: "0",
  });

  useEffect(() => {
    let active = true;
    if (!branchId) return;
    api.get(`/branches/${branchId}`).then(({ data }) => {
      if (!active) return;
      const branch = data.data;
      setBranchSettings({ name: branch.name, address: branch.address ?? "", phone: branch.phone ?? "", email: branch.email ?? "", currency: branch.currency, timezone: branch.timezone, taxRate: "0" });
      setBranchLoaded(true);
    }).catch((error) => { if (active) setBranchMessage(getApiErrorMessage(error, "No se pudo cargar la sucursal.")); });
    return () => { active = false; };
  }, [branchId]);

  const handleBranchSave = async () => {
    if (!branchId || !branchLoaded) return;
    setSaving(true);
    setBranchMessage("");
    try {
      await api.patch(`/branches/${branchId}`, {
        name: branchSettings.name.trim(), address: branchSettings.address.trim(), phone: branchSettings.phone.trim(),
        email: branchSettings.email.trim() || null, currency: branchSettings.currency, timezone: branchSettings.timezone,
      });
      setBranchMessage("Información de sucursal guardada.");
    } catch (error) { setBranchMessage(getApiErrorMessage(error, "No se pudo guardar la sucursal.")); }
    finally { setSaving(false); }
  };

  const [posSettings, setPosSettings] = useState({
    requireTableForOrder: true,
    allowTakeaway: true,
    allowDelivery: false,
    printReceipt: true,
    tipEnabled: true,
    defaultTip: "10",
    tipPercentages: "10, 15, 20",
  });

  useEffect(() => {
    paymentsApi.getConfig().then((config) => {
      setPosSettings((settings) => ({
        ...settings,
        tipEnabled: config.tipEnabled,
        defaultTip: String(config.defaultTipPercentage),
        tipPercentages: config.tipPercentages.join(", "),
      }));
    }).catch(() => undefined);
  }, []);

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
    try {
      await paymentsApi.updateConfig({
        tipEnabled: posSettings.tipEnabled,
        defaultTipPercentage: Number(posSettings.defaultTip),
        tipPercentages: posSettings.tipPercentages
          .split(",")
          .map((value) => Number(value.trim()))
          .filter((value) => Number.isInteger(value)),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Tabs defaultValue="branch" className="space-y-6">
      <TabsList className="flex-wrap h-auto">
        <TabsTrigger value="branch" className="gap-2">
          <Building2 className="h-4 w-4" />
          Sucursal
        </TabsTrigger>
        <TabsTrigger value="pos" className="gap-2">
          <Coffee className="h-4 w-4" />
          POS
        </TabsTrigger>
        <TabsTrigger value="printing" className="gap-2">
          <Printer className="h-4 w-4" />
          Impresoras
        </TabsTrigger>
        <TabsTrigger value="areas" className="gap-2" onClick={() => router.push("/settings/areas")}>
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

      {/* Branch Tab */}
      <TabsContent value="branch" className="space-y-6">
        {branchMessage && <p role="status" className="rounded-lg border p-3 text-sm">{branchMessage}</p>}
        <div className="flex justify-end">
          <Button onClick={handleBranchSave} disabled={saving || !branchLoaded || !branchSettings.name.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Guardar cambios
          </Button>
        </div>

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
                <Label>Impuestos</Label>
                <p className="text-sm text-muted-foreground">El IVA se configura por producto en el catálogo.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="printing" className="space-y-6">
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={discover} disabled={detecting}>{detecting ? "Detectando…" : "Detectar impresoras"}</Button>
          <Button onClick={handlePrintSave} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Guardar impresoras
          </Button>
        </div>
        {printMessage && <div className="rounded-lg border p-3 text-sm">{printMessage}</div>}
        <Card>
          <CardHeader>
            <CardTitle>Impresión local ESC/POS</CardTitle>
            <CardDescription>Detecta las impresoras instaladas en el servidor Windows, incluidas las de red registradas allí. Las impresoras IP no instaladas se pueden agregar manualmente. La prueba usa el destino elegido sin necesidad de guardarlo.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              ["cashierPrinter", "Caja", "tcp://192.168.1.61:9100"],
              ["kitchenPrinter", "Cocina", "tcp://192.168.1.62:9100"],
              ["barPrinter", "Barra", "windows:///EPSON Barra"],
            ].map(([key, label, placeholder]) => (
              <div className="space-y-1.5" key={key}>
                <Label>{label}</Label>
                {printers.length > 0 && <Select value={printers.some((p) => p.target === printSettings[key as "cashierPrinter" | "kitchenPrinter" | "barPrinter"]) ? printSettings[key as "cashierPrinter" | "kitchenPrinter" | "barPrinter"] : ""}
                  onValueChange={(target) => setPrintSettings((settings) => ({ ...settings, [key]: target }))}>
                  <SelectTrigger><SelectValue placeholder="Elegir impresora detectada" /></SelectTrigger>
                  <SelectContent>{printers.map((printer) => <SelectItem key={`${printer.name}-${printer.target}`} value={printer.target}>{printer.name}</SelectItem>)}</SelectContent>
                </Select>}
                <Select value={printSettings[key as "cashierPrinter" | "kitchenPrinter" | "barPrinter"].startsWith("windows:///") ? "windows" : "tcp"}
                  onValueChange={(type) => setPrintSettings((settings) => ({ ...settings, [key]: type === "windows" ? "windows:///" : "tcp://" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="windows">Local / USB instalada en el servidor Windows</SelectItem><SelectItem value="tcp">Impresora por IP (red)</SelectItem></SelectContent>
                </Select>
                <Input
                  value={printSettings[key as "cashierPrinter" | "kitchenPrinter" | "barPrinter"]}
                  placeholder={placeholder}
                  onChange={(event) => setPrintSettings((settings) => ({ ...settings, [key]: event.target.value }))}
                />
                <p className="text-xs text-muted-foreground">Red: tcp://192.168.1.61:9100. Local: windows:///Nombre exacto de la impresora en el servidor. Requiere impresora compatible con ESC/POS.</p>
                <Button variant="outline" size="sm" onClick={() => testPrinter(key as "cashierPrinter" | "kitchenPrinter" | "barPrinter")}
                  disabled={testing !== null || !printSettings[key as "cashierPrinter" | "kitchenPrinter" | "barPrinter"] || ["PENDING", "PROCESSING"].includes(testJobs[key]?.status)}>
                  {testing === key ? "Enviando…" : `Probar impresión de ${label.toLowerCase()}`}
                </Button>
                {testJobs[key] && <p role="status" className="text-sm">{testJobs[key].status === "PRINTED" ? "Prueba enviada a la impresora. Confirma que salió el papel." : testJobs[key].status === "FAILED" ? `Falló la prueba: ${testJobs[key].lastError ?? "Revisa la impresora."}` : "Prueba en cola o procesándose. Mantén encendidos el servidor, el agente de impresión y la impresora."}</p>}
              </div>
            ))}
            <div className="space-y-1.5">
              <Label>Ancho del papel</Label>
              <Select value={printSettings.width} onValueChange={(width: "58mm" | "80mm") => setPrintSettings((settings) => ({ ...settings, width }))}>
                <SelectTrigger className="max-w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="80mm">80 mm</SelectItem>
                  <SelectItem value="58mm">58 mm</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3 border-t pt-4">
              <Label>Tickets en caja</Label>
              <Select value={printSettings.cashierMode} onValueChange={(cashierMode: 'BUSINESS_ONLY' | 'CUSTOMER_AND_BUSINESS') => setPrintSettings(s => ({ ...s, cashierMode }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="BUSINESS_ONLY">Solo negocio</SelectItem><SelectItem value="CUSTOMER_AND_BUSINESS">Cliente + negocio</SelectItem></SelectContent></Select>
              <div className="flex justify-between"><Label>Confirmar cierre al liquidar</Label><Switch checked={printSettings.confirmClose} onCheckedChange={confirmClose => setPrintSettings(s => ({ ...s, confirmClose }))} /></div>
              <div className="flex justify-between"><Label>Permitir reimpresion autorizada</Label><Switch checked={printSettings.allowReprint} onCheckedChange={allowReprint => setPrintSettings(s => ({ ...s, allowReprint }))} /></div>
            </div>
            <div className="space-y-4 border-t pt-4">
              <p className="text-sm font-medium">Impresión automática</p>
              {[
                ["autoKitchen", "Cocina", "Al enviar productos nuevos preparados en cocina"],
                ["autoBar", "Barra", "Al enviar productos nuevos preparados en barra"],
                ["autoCustomer", "Comprobante del negocio", "Copia negocio al liquidar; nunca imprime una precuenta automaticamente"],
              ].map(([key, label, description]) => (
                <div className="flex items-start justify-between gap-4" key={key}>
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{description}</p>
                  </div>
                  <Switch
                    checked={printSettings[key as "autoKitchen" | "autoBar" | "autoCustomer"]}
                    onCheckedChange={(checked) => setPrintSettings((settings) => ({ ...settings, [key]: checked }))}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* POS Tab */}
      <TabsContent value="pos" className="space-y-6">
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Guardar cambios
          </Button>
        </div>

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
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Propina predeterminada (%)</Label>
                  <Input type="number" min={0} max={100} value={posSettings.defaultTip}
                    onChange={(e) => setPosSettings((s) => ({ ...s, defaultTip: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Porcentajes sugeridos</Label>
                  <Input value={posSettings.tipPercentages} placeholder="10, 15, 20"
                    onChange={(e) => setPosSettings((s) => ({ ...s, tipPercentages: e.target.value }))} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Children Tab */}
      <TabsContent value="children" className="space-y-6">
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Guardar cambios
          </Button>
        </div>

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

      {/* Notifications Tab */}
      <TabsContent value="notifications" className="space-y-6">
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Guardar cambios
          </Button>
        </div>

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

      {/* Security Tab */}
      <TabsContent value="security" className="space-y-6">
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
                  { role: "WAITER", desc: "Mesas, catálogo y órdenes" },
                  { role: "COOK", desc: "Comandero y consulta de catálogo" },
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
  );
}
