"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Users, HardHat, CheckSquare, BarChart3, Settings, LogOut, TrendingUp, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/", icon: BarChart3, adminOnly: false },
  { name: "Controle de Diárias", href: "/apontamento", icon: CheckSquare, adminOnly: false },
  { name: "RH & Financeiro", href: "/rh-financeiro", icon: TrendingUp, adminOnly: true },
  { name: "Funcionários", href: "/funcionarios", icon: Users, adminOnly: true },
  { name: "Pagamentos", href: "/pagamentos", icon: Wallet, adminOnly: true },
  { name: "Relatórios", href: "/relatorios", icon: Settings, adminOnly: true },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    const fetchRole = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        if (data) setRole(data.role);
      }
    };
    fetchRole();
  }, []);

  if (pathname === '/login') return null;

  const filteredNavigation = navigation.filter(item => {
    if (role === 'apontador' && item.adminOnly) {
      return false;
    }
    return true;
  });

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden border-r bg-sidebar md:block w-64 min-h-screen shrink-0">
        <div className="flex h-full max-h-screen flex-col gap-2">
          <div className="flex h-14 items-center border-b border-sidebar-border px-4 lg:h-[60px] lg:px-6">
            <Link href="/" className="flex items-center gap-2 font-semibold text-sidebar-foreground">
              <HardHat className="h-6 w-6 text-sidebar-ring" />
              <span className="">PontoObra</span>
            </Link>
          </div>
          <div className="flex-1">
            <nav className="grid items-start px-2 text-sm font-medium lg:px-4 gap-1 mt-4">
              {filteredNavigation.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-sidebar-foreground",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="mt-auto p-4 border-t border-sidebar-border">
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:bg-destructive/10 text-destructive hover:text-destructive"
            >
              <LogOut className="h-4 w-4" />
              Sair do Sistema
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <div
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur border-t flex items-center justify-around shadow-[0_-5px_15px_-10px_rgba(0,0,0,0.1)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {filteredNavigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center w-full pt-3 pb-2 transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className={cn("h-5 w-5 mb-1", isActive ? "stroke-[2.5px]" : "stroke-[2px]")} />
              <span className="text-[10px] font-medium">{item.name}</span>
            </Link>
          );
        })}
        <button
          onClick={handleLogout}
          className="flex flex-col items-center justify-center w-full pt-3 pb-2 transition-colors text-destructive hover:text-destructive/80"
        >
          <LogOut className="h-5 w-5 mb-1 stroke-[2px]" />
          <span className="text-[10px] font-medium">Sair</span>
        </button>
      </div>
    </>
  );
}
