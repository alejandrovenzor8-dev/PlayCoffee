"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, ServerOff, WifiOff } from "lucide-react";
import { getApiOrigin } from "@/lib/api";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

type ServerState = "checking" | "online" | "offline";

export function PwaRuntime() {
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [serverState, setServerState] = useState<ServerState>("checking");
  const [hasNetwork, setHasNetwork] = useState(true);

  const checkServer = useCallback(async () => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 4000);
    try {
      const response = await fetch(`${getApiOrigin()}/health`, {
        cache: "no-store",
        signal: controller.signal,
      });
      setServerState(response.ok ? "online" : "offline");
    } catch {
      setServerState("offline");
    } finally {
      window.clearTimeout(timeout);
    }
  }, []);

  useEffect(() => {
    setHasNetwork(navigator.onLine);
    void checkServer();

    const handleOnline = () => {
      setHasNetwork(true);
      void checkServer();
    };
    const handleOffline = () => {
      setHasNetwork(false);
      void checkServer();
    };
    const handleInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => setInstallPrompt(null);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("beforeinstallprompt", handleInstall);
    window.addEventListener("appinstalled", handleInstalled);
    const heartbeat = window.setInterval(() => void checkServer(), 15000);

    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      void navigator.serviceWorker.register("/sw.js", { scope: "/" });
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("beforeinstallprompt", handleInstall);
      window.removeEventListener("appinstalled", handleInstalled);
      window.clearInterval(heartbeat);
    };
  }, [checkServer]);

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  return (
    <>
      {serverState === "offline" && (
        <div
          className="fixed inset-x-0 top-0 z-[100] flex min-h-10 items-center justify-center gap-2 bg-red-700 px-4 py-2 text-center text-sm font-semibold text-white shadow-lg"
          role="alert"
        >
          <ServerOff className="h-4 w-4 shrink-0" />
          Sin conexión con el servidor local. No cierres ni recargues
          operaciones pendientes.
        </div>
      )}
      {serverState === "online" && !hasNetwork && (
        <div
          className="fixed inset-x-0 top-0 z-[100] flex min-h-10 items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-center text-sm font-semibold text-amber-950 shadow-lg"
          role="status"
        >
          <WifiOff className="h-4 w-4 shrink-0" />
          Sin internet; PlayCoffee continúa operando en la red local.
        </div>
      )}
      {installPrompt && (
        <Button
          className="fixed bottom-5 right-5 z-[90] shadow-xl"
          onClick={install}
        >
          <Download className="h-4 w-4" />
          Instalar PlayCoffee
        </Button>
      )}
    </>
  );
}
