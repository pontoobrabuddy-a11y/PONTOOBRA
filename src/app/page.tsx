"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserCheck, UserX, AlertTriangle, UserMinus } from "lucide-react";
import { useStore } from "@/store/useStore";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function Dashboard() {
  const { employees, attendance } = useStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const today = new Date().toISOString().split('T')[0];
  let displayDate = today;
  if ((!attendance[today] || Object.keys(attendance[today]).length === 0) && Object.keys(attendance).length > 0) {
    displayDate = Object.keys(attendance).sort().reverse()[0];
  }
  const todayAttendance = attendance[displayDate] || {};

  const activeEmployees = employees.filter(e => e.status === "ativo");
  const totalActive = activeEmployees.length;

  let present = 0;
  let absent = 0;
  let justified = 0;
  let suspended = 0;

  activeEmployees.forEach(emp => {
    const record = todayAttendance[emp.id];
    const status = typeof record === 'string' ? record : record?.status;
    if (status === 'presence' || status === 'half_presence') present++;
    else if (status === 'absence') absent++;
    else if (status === 'justified_absence') justified++;
    else if (status === 'suspension') suspended++;
  });

  const presenceRate = totalActive > 0 ? Math.round((present / totalActive) * 100) : 0;

  // Group by team for the right-side summary
  const teamStats = activeEmployees.reduce((acc, emp) => {
    if (!acc[emp.team]) {
      acc[emp.team] = { total: 0, present: 0 };
    }
    acc[emp.team].total += 1;
    const record = todayAttendance[emp.id];
    const status = typeof record === 'string' ? record : record?.status;
    if (status === 'presence' || status === 'half_presence') {
      acc[emp.team].present += 1;
    }
    return acc;
  }, {} as Record<string, { total: number, present: number }>);

  // Generate chart data for the last 7 days
  const chartData = useMemo(() => {
    const data: Array<{name: string, Presentes: number, Faltas: number}> = [];
    const dates = Object.keys(attendance).sort();
    const last7 = dates.slice(-7);
    
    last7.forEach(dateStr => {
      const records = attendance[dateStr];
      let pres = 0;
      let abs = 0;
      Object.values(records).forEach(record => {
         const status = typeof record === 'string' ? record : record?.status;
         if (status === 'presence' || status === 'half_presence') pres++;
         if (status === 'absence') abs++;
      });
      const shortDate = new Date(dateStr + 'T12:00:00Z').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      data.push({ name: shortDate, Presentes: pres, Faltas: abs });
    });
    return data;
  }, [attendance]);

  // Prevent hydration mismatch
  if (!mounted) return null;

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-primary">Dashboard</h1>
        <p className="text-sm md:text-base text-muted-foreground mt-1">
          Visão geral da obra atual. Exibindo dados de: <strong className="text-foreground">{new Date(displayDate + 'T12:00:00Z').toLocaleDateString('pt-BR')}</strong>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-5">
        <Card className="col-span-2 lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Funcionários Ativos</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalActive}</div>
            <p className="text-xs text-muted-foreground">Registrados na obra</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Presentes</CardTitle>
            <UserCheck className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{present}</div>
            <p className="text-xs text-muted-foreground">{presenceRate}% da equipe</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Faltas</CardTitle>
            <UserX className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{absent}</div>
            <p className="text-xs text-muted-foreground">Não compareceram</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Justificadas</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{justified}</div>
            <p className="text-xs text-muted-foreground">Faltas com atestado</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Suspensões</CardTitle>
            <UserMinus className="h-4 w-4 text-gray-800 dark:text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{suspended}</div>
            <p className="text-xs text-muted-foreground">Afastados</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Presença Recente (Últimos 7 dias)</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[300px] w-full">
              {chartData.length === 0 ? (
                <div className="h-full w-full bg-slate-50 dark:bg-slate-900 rounded-lg flex items-center justify-center text-muted-foreground border-2 border-dashed">
                  Nenhum apontamento registrado
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, right: 30, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} allowDecimals={false} />
                    <Tooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
                    <Bar dataKey="Presentes" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    <Bar dataKey="Faltas" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Equipes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              {Object.entries(teamStats).length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma equipe ativa.</p>
              ) : (
                Object.entries(teamStats).map(([teamName, stats]) => (
                  <div key={teamName} className="flex items-center">
                    <div className="ml-4 space-y-1">
                      <p className="text-sm font-medium leading-none">{teamName}</p>
                      <p className="text-sm text-muted-foreground">{stats.total} ativos</p>
                    </div>
                    <div className="ml-auto font-medium text-emerald-500">
                      {stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0}% pres.
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
