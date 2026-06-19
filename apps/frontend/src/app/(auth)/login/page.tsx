"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import { authApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Coffee, Loader2, Eye, EyeOff, Delete } from "lucide-react";
import { cn } from "@/lib/utils";

function PINPad({ onSubmit, isLoading }: { onSubmit: (pin: string) => void; isLoading: boolean }) {
  const [pin, setPin] = useState("");
  const [email, setEmail] = useState("");

  const appendDigit = (d: string) => {
    if (pin.length < 4) setPin((p) => p + d);
  };

  const handleSubmit = () => {
    if (pin.length === 4 && email) onSubmit(`${email}:${pin}`);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Correo o usuario</Label>
        <Input
          placeholder="usuario@ejemplo.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      {/* PIN display */}
      <div className="flex justify-center gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-12 w-12 rounded-xl border-2 flex items-center justify-center transition-all",
              pin.length > i ? "border-primary bg-primary/10" : "border-border bg-muted"
            )}
          >
            {pin.length > i && <span className="text-xl text-primary">●</span>}
          </div>
        ))}
      </div>

      {/* Numpad */}
      <div className="grid grid-cols-3 gap-2">
        {["1","2","3","4","5","6","7","8","9"].map((d) => (
          <Button
            key={d}
            variant="outline"
            className="h-14 text-xl font-semibold"
            onClick={() => appendDigit(d)}
            disabled={pin.length >= 4}
          >
            {d}
          </Button>
        ))}
        <Button variant="ghost" className="h-14" onClick={() => setPin("")}>
          <span className="text-sm text-muted-foreground">Borrar</span>
        </Button>
        <Button
          variant="outline"
          className="h-14 text-xl font-semibold"
          onClick={() => appendDigit("0")}
          disabled={pin.length >= 4}
        >
          0
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-14"
          onClick={() => setPin((p) => p.slice(0, -1))}
        >
          <Delete className="h-5 w-5" />
        </Button>
      </div>

      <Button
        className="w-full h-12 text-base"
        disabled={pin.length < 4 || !email || isLoading}
        onClick={handleSubmit}
      >
        {isLoading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
        Entrar con PIN
      </Button>
    </div>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuth, isAuthenticated } = useAuthStore();
  const nextPath = searchParams.get("next") || "/";
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailForm, setEmailForm] = useState({ email: "", password: "" });

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const data = await authApi.login(emailForm.email, emailForm.password);
      setAuth(data.user, data.accessToken, data.refreshToken);
      router.push(nextPath);
    } catch (err: unknown) {
      setError("Credenciales incorrectas. Verifica tu correo y contraseña.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePINLogin = async (pinData: string) => {
    const [email, pin] = pinData.split(":");
    setError("");
    setIsLoading(true);
    try {
      const data = await authApi.loginPin(email, pin);
      setAuth(data.user, data.accessToken, data.refreshToken);
      router.push(nextPath);
    } catch {
      setError("PIN incorrecto o usuario no encontrado.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      router.replace(nextPath);
    }
  }, [isAuthenticated, nextPath, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-lg mb-4">
            <Coffee className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-white">Play Coffee OS</h1>
          <p className="text-slate-400 text-sm mt-1">Sistema de gestión café</p>
        </div>

        <Card className="shadow-2xl border-slate-700 bg-slate-800/80 backdrop-blur">
          <CardHeader className="pb-4">
            <CardTitle className="text-white text-xl">Iniciar sesión</CardTitle>
            <CardDescription className="text-slate-400">
              Ingresa tus credenciales para acceder al sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <Tabs defaultValue="email">
              <TabsList className="w-full mb-6 bg-slate-700/50">
                <TabsTrigger value="email" className="flex-1 data-[state=active]:bg-slate-600">
                  Correo y contraseña
                </TabsTrigger>
                <TabsTrigger value="pin" className="flex-1 data-[state=active]:bg-slate-600">
                  PIN rápido
                </TabsTrigger>
              </TabsList>

              <TabsContent value="email">
                <form onSubmit={handleEmailLogin} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-slate-300">Correo electrónico</Label>
                    <Input
                      type="email"
                      placeholder="correo@playcoffee.mx"
                      required
                      value={emailForm.email}
                      onChange={(e) => setEmailForm((f) => ({ ...f, email: e.target.value }))}
                      className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-slate-300">Contraseña</Label>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        required
                        value={emailForm.password}
                        onChange={(e) => setEmailForm((f) => ({ ...f, password: e.target.value }))}
                        className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <Button type="submit" className="w-full h-11" disabled={isLoading}>
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Iniciar sesión
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="pin">
                <PINPad onSubmit={handlePINLogin} isLoading={isLoading} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-slate-500 mt-6">
          Play Coffee OS · v1.0.0
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-900" />}>
      <LoginContent />
    </Suspense>
  );
}
