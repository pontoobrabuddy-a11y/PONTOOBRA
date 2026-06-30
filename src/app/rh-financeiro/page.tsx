"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/store/useStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  UserCheck,
  UserX,
  AlertTriangle,
  TrendingUp,
  Clock,
  CalendarPlus,
  CalendarMinus,
  Building2,
  ChevronRight,
  Send,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────
// Extended Employee type with RH fields (all optional so page
// compiles before useStore is updated by the other agent)
// ─────────────────────────────────────────────────────────────
type EmployeeRH = {
  id: string;
  name: string;
  role?: string;
  status: string;
  admission_date?: string | null;
  // RH-specific fields (added by migration / useStore update)
  dismissal_date?: string | null;
  notice_start_date?: string | null;
  notice_end_date?: string | null;
  last_work_date?: string | null;
  notice_type?: string | null; // 'empresa' | 'funcionario'
  pagador?: string | null; // 'CASANA' | 'BUDDY'
  employment_type?: string | null; // 'CLT' | 'PJ' | 'MEI' | 'Avulso'
};

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "\u2014";
  const d = new Date(dateStr + "T12:00:00Z");
  return d.toLocaleDateString("pt-BR");
}

type NoticeStatus = "vencido" | "urgente" | "ok" | "normal";

function getNoticeStatus(emp: EmployeeRH): NoticeStatus {
  if (!emp.last_work_date) return "normal";
  const lastDay = new Date(emp.last_work_date + "T12:00:00Z");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil(
    (lastDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays < 0) return "vencido";
  if (diffDays <= 7) return "urgente";
  return "ok";
}

function getDaysRemaining(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr + "T12:00:00Z");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

const noticeTypeLabel: Record<string, string> = {
  empresa: "Aviso Previo Empresa",
  funcionario: "Pedido de Demissao",
};

const pagadorLabel: Record<string, string> = {
  CASANA: "CASANA",
  BUDDY: "BUDDY",
};

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────
function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  gradient,
  iconColor,
}: {
  title: string;
  value: number;
  subtitle: string;
  icon: React.ElementType;
  gradient: string;
  iconColor: string;
}) {
  return (
    <Card className={"relative overflow-hidden border-0 shadow-md " + gradient}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-semibold text-white/90">{title}</CardTitle>
        <div className="rounded-full p-2 bg-white/20">
          <Icon className={"h-4 w-4 " + iconColor} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-white">{value}</div>
        <p className="text-xs text-white/70 mt-1">{subtitle}</p>
      </CardContent>
      <div className="absolute -bottom-4 -right-4 h-20 w-20 rounded-full bg-white/10" />
    </Card>
  );
}

function StatusBadge({ status }: { status: NoticeStatus }) {
  if (status === "vencido") {
    return (
      <Badge className="bg-red-100 text-red-700 border-red-300 border font-semibold text-xs">
        Vencido
      </Badge>
    );
  }
  if (status === "urgente") {
    return (
      <Badge className="bg-amber-100 text-amber-700 border-amber-300 border font-semibold text-xs">
        Urgente
      </Badge>
    );
  }
  return (
    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300 border font-semibold text-xs">
      No prazo
    </Badge>
  );
}

function noticeBorderColor(status: NoticeStatus): string {
  if (status === "vencido") return "border-l-4 border-l-red-500";
  if (status === "urgente") return "border-l-4 border-l-amber-500";
  return "border-l-4 border-l-emerald-500";
}

// ─────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────
export default function RHFinanceiroDashboard() {
  const { employees, isLoading } = useStore();
  const [noticeSortAsc] = useState(true);

  // Cast to EmployeeRH array - safe because Supabase returns all DB columns
  // even if the TypeScript interface has not been updated yet
  const emps = employees as unknown as EmployeeRH[];

  const today = new Date();
  const thisMonth = today.getMonth();
  const thisYear = today.getFullYear();

  // Computed metrics
  const activeEmployees = useMemo(
    () => emps.filter((e) => e.status === "ativo"),
    [emps]
  );

  const inNoticePeriod = useMemo(
    () => activeEmployees.filter((e) => !!e.notice_end_date),
    [activeEmployees]
  );

  const admittedThisMonth = useMemo(
    () =>
      emps.filter((e) => {
        if (!e.admission_date) return false;
        const d = new Date(e.admission_date + "T12:00:00Z");
        return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
      }),
    [emps, thisMonth, thisYear]
  );

  const dismissedThisMonth = useMemo(
    () =>
      emps.filter((e) => {
        if (!e.dismissal_date) return false;
        const d = new Date(e.dismissal_date + "T12:00:00Z");
        return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
      }),
    [emps, thisMonth, thisYear]
  );

  const sortedNotice = useMemo(
    () =>
      [...inNoticePeriod].sort((a, b) => {
        if (!a.last_work_date && !b.last_work_date) return 0;
        if (!a.last_work_date) return noticeSortAsc ? 1 : -1;
        if (!b.last_work_date) return noticeSortAsc ? -1 : 1;
        return noticeSortAsc
          ? a.last_work_date.localeCompare(b.last_work_date)
          : b.last_work_date.localeCompare(a.last_work_date);
      }),
    [inNoticePeriod, noticeSortAsc]
  );

  const totalEverAdmitted = emps.length;
  const totalEverDismissed = emps.filter(
    (e) => e.status === "inativo" || !!e.dismissal_date
  ).length;

  const monthLabel = today.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span>Carregando dados de RH...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-primary flex items-center gap-2">
          <Building2 className="h-7 w-7 text-primary" />
          RH &amp; Financeiro
        </h1>
        <p className="text-sm text-muted-foreground">
          Painel de recursos humanos &mdash;{" "}
          <span className="font-medium text-foreground capitalize">{monthLabel}</span>
        </p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <MetricCard
          title="Funcionarios Ativos"
          value={activeEmployees.length}
          subtitle="Com status Ativo"
          icon={Users}
          gradient="bg-gradient-to-br from-blue-600 to-blue-700"
          iconColor="text-white"
        />
        <MetricCard
          title="Em Aviso Previo"
          value={inNoticePeriod.length}
          subtitle="Periodo de aviso ativo"
          icon={Clock}
          gradient="bg-gradient-to-br from-amber-500 to-orange-600"
          iconColor="text-white"
        />
        <MetricCard
          title="Admitidos no Mes"
          value={admittedThisMonth.length}
          subtitle={"Entradas em " + monthLabel}
          icon={CalendarPlus}
          gradient="bg-gradient-to-br from-emerald-500 to-teal-600"
          iconColor="text-white"
        />
        <MetricCard
          title="Demitidos no Mes"
          value={dismissedThisMonth.length}
          subtitle={"Saidas em " + monthLabel}
          icon={CalendarMinus}
          gradient="bg-gradient-to-br from-rose-500 to-red-600"
          iconColor="text-white"
        />
      </div>

      {/* Notice Period Panel */}
      <Card className="shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Painel de Avisos Previos
            {inNoticePeriod.length > 0 && (
              <Badge className="bg-amber-100 text-amber-700 border-amber-300 border ml-2">
                {inNoticePeriod.length} em aviso
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sortedNotice.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
              <UserCheck className="h-10 w-10 text-emerald-400" />
              <p className="text-sm font-medium">Nenhum funcionario em aviso previo</p>
              <p className="text-xs">Tudo tranquilo por aqui.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedNotice.map((emp) => {
                const nStatus = getNoticeStatus(emp);
                const daysRemaining = getDaysRemaining(emp.last_work_date);
                const accountingAlert = getDaysRemaining(emp.notice_end_date);

                return (
                  <div
                    key={emp.id}
                    className={
                      "rounded-lg bg-slate-50 dark:bg-slate-900 p-3 md:p-4 " +
                      noticeBorderColor(nStatus)
                    }
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="font-semibold text-sm md:text-base text-foreground">
                            {emp.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {emp.role || "\u2014"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant="outline"
                          className="text-xs font-medium border-slate-300"
                        >
                          {emp.notice_type
                            ? (noticeTypeLabel[emp.notice_type] ?? emp.notice_type)
                            : "Tipo nao informado"}
                        </Badge>
                        <StatusBadge status={nStatus} />
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-muted-foreground font-medium uppercase tracking-wide text-[10px]">
                          Inicio Aviso
                        </span>
                        <span className="font-semibold text-foreground">
                          {formatDate(emp.notice_start_date)}
                        </span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-muted-foreground font-medium uppercase tracking-wide text-[10px]">
                          Fim Aviso
                        </span>
                        <span className="font-semibold text-foreground">
                          {formatDate(emp.notice_end_date)}
                        </span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-muted-foreground font-medium uppercase tracking-wide text-[10px]">
                          Ultimo Dia de Trabalho
                        </span>
                        <span
                          className={
                            "font-bold text-sm " +
                            (nStatus === "vencido"
                              ? "text-red-600"
                              : nStatus === "urgente"
                              ? "text-amber-600"
                              : "text-emerald-600")
                          }
                        >
                          {formatDate(emp.last_work_date)}
                          {daysRemaining !== null && (
                            <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                              {daysRemaining === 0
                                ? "(hoje)"
                                : daysRemaining > 0
                                ? "(" + daysRemaining + "d)"
                                : "(" + Math.abs(daysRemaining) + "d atras)"}
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-muted-foreground font-medium uppercase tracking-wide text-[10px] flex items-center gap-1">
                          <Send className="h-3 w-3" />
                          Enviar Contabilidade
                        </span>
                        <span
                          className={
                            "font-semibold text-sm flex items-center gap-1 " +
                            (accountingAlert !== null && accountingAlert <= 0
                              ? "text-red-600"
                              : accountingAlert !== null && accountingAlert <= 3
                              ? "text-amber-600"
                              : "text-foreground")
                          }
                        >
                          {formatDate(emp.notice_end_date)}
                          {accountingAlert !== null && accountingAlert <= 0 && (
                            <AlertTriangle className="h-3 w-3 text-red-500" />
                          )}
                          {accountingAlert !== null &&
                            accountingAlert > 0 &&
                            accountingAlert <= 3 && (
                              <AlertTriangle className="h-3 w-3 text-amber-500" />
                            )}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Monthly History */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Admitidos */}
        <Card className="shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <UserCheck className="h-5 w-5 text-emerald-500" />
              Admitidos no Mes
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300 border ml-auto">
                {admittedThisMonth.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {admittedThisMonth.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhuma admissao este mes.
              </p>
            ) : (
              <div className="space-y-2">
                {admittedThisMonth.map((emp) => (
                  <div
                    key={emp.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900"
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="font-semibold text-sm text-foreground truncate">
                        {emp.name}
                      </span>
                      <span className="text-xs text-muted-foreground truncate">
                        {emp.role || "\u2014"}
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-1 ml-2 shrink-0">
                      <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                        {formatDate(emp.admission_date)}
                      </span>
                      {emp.pagador && (
                        <Badge
                          variant="outline"
                          className="text-[10px] py-0 h-4 border-slate-300"
                        >
                          {pagadorLabel[emp.pagador] ?? emp.pagador}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Demitidos */}
        <Card className="shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <UserX className="h-5 w-5 text-rose-500" />
              Demitidos no Mes
              <Badge className="bg-rose-100 text-rose-700 border-rose-300 border ml-auto">
                {dismissedThisMonth.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dismissedThisMonth.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhuma demissao este mes.
              </p>
            ) : (
              <div className="space-y-2">
                {dismissedThisMonth.map((emp) => (
                  <div
                    key={emp.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900"
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="font-semibold text-sm text-foreground truncate">
                        {emp.name}
                      </span>
                      <span className="text-xs text-muted-foreground truncate">
                        {emp.role || "\u2014"}
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-1 ml-2 shrink-0">
                      <span className="text-xs font-medium text-rose-700 dark:text-rose-400">
                        {formatDate(emp.dismissal_date)}
                      </span>
                      {emp.notice_type && (
                        <Badge
                          variant="outline"
                          className="text-[10px] py-0 h-4 border-slate-300"
                        >
                          {noticeTypeLabel[emp.notice_type] ?? emp.notice_type}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Historical Totals Footer */}
      <Card className="shadow-md bg-gradient-to-r from-slate-800 to-slate-900 border-0">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-white text-base">
            <TrendingUp className="h-5 w-5 text-white/70" />
            Historico Geral da Empresa
          </CardTitle>
          <p className="text-xs text-slate-400">Desde o inicio dos registros</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wide text-slate-400 font-medium">
                Total Admitidos
              </span>
              <span className="text-3xl font-bold text-white">
                {totalEverAdmitted}
              </span>
              <span className="text-xs text-slate-500">Todos os registros</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wide text-slate-400 font-medium">
                Total Saidas
              </span>
              <span className="text-3xl font-bold text-rose-400">
                {totalEverDismissed}
              </span>
              <span className="text-xs text-slate-500">
                Demitidos + Inativos
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wide text-slate-400 font-medium">
                Taxa de Retencao
              </span>
              <span className="text-3xl font-bold text-emerald-400">
                {totalEverAdmitted > 0
                  ? Math.round(
                      (activeEmployees.length / totalEverAdmitted) * 100
                    )
                  : 0}
                %
              </span>
              <span className="text-xs text-slate-500">Ativos / Total</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wide text-slate-400 font-medium">
                Turn-over
              </span>
              <span className="text-3xl font-bold text-amber-400">
                {totalEverAdmitted > 0
                  ? Math.round(
                      (totalEverDismissed / totalEverAdmitted) * 100
                    )
                  : 0}
                %
              </span>
              <span className="text-xs text-slate-500">Saidas / Total</span>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-700 flex flex-wrap gap-4 text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-emerald-400" />
              <span>CASANA &mdash; Buddy &amp; Genecy Construtora (quinzenal)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-blue-400" />
              <span>BUDDY &mdash; Genecy Construcoes e Servicos (mensal)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Aviso Previo Rules Reference */}
      <Card className="shadow-sm border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
            <ChevronRight className="h-4 w-4" />
            Referencia &mdash; Regras de Aviso Previo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-muted-foreground">
            <div className="flex gap-2 p-2 rounded bg-slate-50 dark:bg-slate-900">
              <Building2 className="h-4 w-4 shrink-0 text-slate-400 mt-0.5" />
              <div>
                <p className="font-semibold text-foreground">Aviso Previo Empresa</p>
                <p>
                  Ultimo dia de trabalho = Fim do aviso{" "}
                  <strong className="text-foreground">menos 7 dias corridos</strong>
                </p>
              </div>
            </div>
            <div className="flex gap-2 p-2 rounded bg-slate-50 dark:bg-slate-900">
              <UserX className="h-4 w-4 shrink-0 text-slate-400 mt-0.5" />
              <div>
                <p className="font-semibold text-foreground">Pedido de Demissao</p>
                <p>
                  Funcionario deve cumprir{" "}
                  <strong className="text-foreground">30 dias corridos</strong> de
                  aviso previo
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
