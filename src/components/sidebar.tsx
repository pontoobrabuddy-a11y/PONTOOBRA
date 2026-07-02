"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Users, HardHat, CheckSquare, BarChart3, Settings, LogOut, TrendingUp, Wallet, Mail, Menu } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/", icon: BarChart3, adminOnly: false },
  { name: "Controle de Diárias", href: "/apontamento", icon: CheckSquare, adminOnly: false },
  { name: "RH & Financeiro", href: "/rh-financeiro", icon: TrendingUp, adminOnly: true },
  { name: "Funcionários", href: "/funcionarios", icon: Users, adminOnly: true },
  { name: "Pagamentos", href: "/pagamentos", icon: Wallet, adminOnly: true },
  { name: "Gerador de E-mails", href: "/emails", icon: Mail, adminOnly: true },
  { name: "Relatórios", href: "/relatorios", icon: Settings, adminOnly: true },
];

const mobileNames: Record<string, string> = {
  "Dashboard": "Início",
  "Controle de Diárias": "Diárias",
  "RH & Financeiro": "RH & Fin.",
  "Funcionários": "Func.",
  "Pagamentos": "Pagamentos",
  "Gerador de E-mails": "E-mails",
  "Relatórios": "Relatórios",
};

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [isMoreOpen, setIsMoreOpen] = useState(false);

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
      <div className="hidden border-r bg-sidebar md:flex md:flex-col w-64 h-screen sticky top-0 shrink-0">
        <div className="flex h-full flex-col gap-2">
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

      {/* Mobile bottom nav drawer overlay */}
      {isMoreOpen && (
        <div 
          className="md:hidden fixed inset-0 z-30 bg-black/60 backdrop-blur-sm transition-opacity"
          onClick={() => setIsMoreOpen(false)}
        >
          <div 
            className="absolute bottom-20 left-4 right-4 bg-background border rounded-2xl p-4 shadow-2xl flex flex-col gap-1 animate-in slide-in-from-bottom-5 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-xs font-semibold text-muted-foreground px-3 pb-2 border-b mb-1">
              Mais opções
            </div>
            {filteredNavigation.slice(4).map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setIsMoreOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors text-sm font-medium",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Link>
              );
            })}
            <button
              onClick={() => {
                setIsMoreOpen(false);
                handleLogout();
              }}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors text-destructive hover:bg-destructive/10 mt-1"
            >
              <LogOut className="h-4 w-4" />
              Sair do Sistema
            </button>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation */}
      <div
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur border-t flex items-center justify-around shadow-[0_-5px_15px_-10px_rgba(0,0,0,0.1)] h-16"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {filteredNavigation.length <= 4 ? (
          <>
            {filteredNavigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center justify-center w-full pt-1 transition-colors",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <item.icon className={cn("h-5 w-5 mb-0.5", isActive ? "stroke-[2.5px]" : "stroke-[2px]")} />
                  <span className="text-[10px] font-medium">{mobileNames[item.name] || item.name}</span>
                </Link>
              );
            })}
            <button
              onClick={handleLogout}
              className="flex flex-col items-center justify-center w-full pt-1 transition-colors text-destructive hover:text-destructive/80"
            >
              <LogOut className="h-5 w-5 mb-0.5 stroke-[2px]" />
              <span className="text-[10px] font-medium">Sair</span>
            </button>
          </>
        ) : (
          <>
            {filteredNavigation.slice(0, 4).map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center justify-center w-full pt-1 transition-colors",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <item.icon className={cn("h-5 w-5 mb-0.5", isActive ? "stroke-[2.5px]" : "stroke-[2px]")} />
                  <span className="text-[10px] font-medium">{mobileNames[item.name] || item.name}</span>
                </Link>
              );
            })}
            <button
              onClick={() => setIsMoreOpen(!isMoreOpen)}
              className={cn(
                "flex flex-col items-center justify-center w-full pt-1 transition-colors",
                isMoreOpen ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Menu className={cn("h-5 w-5 mb-0.5", isMoreOpen ? "stroke-[2.5px]" : "stroke-[2px]")} />
              <span className="text-[10px] font-medium">Mais</span>
            </button>
          </>
        )}
      </div>
    </>
  );
}
