import type { Metadata } from "next";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { MobileNavigation } from "@/components/layout/mobile-navigation";
import { CashClosingReminder } from "@/components/layout/cash-closing-reminder";

export const metadata: Metadata = {
  title: "PlayCoffee OS",
  description: "Professional POS + Café Management System",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <div className="flex h-dvh overflow-hidden bg-background">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Header />
          <CashClosingReminder />
          <main className="flex-1 overflow-y-auto px-3 py-4 pb-24 sm:px-5 sm:pt-5 lg:p-6">
            {children}
          </main>
        </div>
        <MobileNavigation />
      </div>
    </AuthGuard>
  );
}
