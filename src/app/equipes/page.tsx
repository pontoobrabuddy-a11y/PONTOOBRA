"use client";

import { useState, useEffect, useMemo } from "react";
import { useStore, Employee, Status, AttendanceRecord } from "@/store/useStore";
import { useDailyTeams, DailyTeam, DailyTeamStatus } from "@/store/useDailyTeams";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Users,
  Plus,
  Copy,
  Printer,
  RotateCcw,
  CheckCircle2,
  Clock,
  AlertCircle,
  MapPin,
  Pencil,
  Trash2,
  Search,
  Check,
  Calendar,
  Share2,
  HardHat,
  Briefcase
} from "lucide-react";

const TASK_PRESETS = [
  "Reboco",
  "Alvenaria",
  "Instalação Elétrica",
  "Instalação Hidráulica",
  "Pintura",
  "Armação de Aço",
  "Concretagem",
  "Assentamento de Piso / Porcelanato",
  "Limpeza / Bota-fora",
  "Impermeabilização"
];

const statusStyles: Record<DailyTeamStatus, { label: string; badge: string; border: string }> = {
  pendente: {
    label: "Pendente",
    badge: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-200",
    border: "border-l-amber-500",
  },
  em_andamento: {
    label: "Em Andamento",
    badge: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-200",
    border: "border-l-blue-500",
  },
  concluida: {
    label: "Concluída",
    badge: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200",
    border: "border-l-emerald-500",
  },
};

const getLocalDateString = (offsetDays = 0): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().split("T")[0];
};

export default function EquipesPage() {
  const { employees, attendance } = useStore();
  const {
    teams,
    isLoading,
    fetchTeamsForDate,
    createTeam,
    updateTeam,
    deleteTeam,
    cloneTeamsFromDate,
    toggleTeamStatus,
  } = useDailyTeams();

  const [date, setDate] = useState<string>(() => getLocalDateString(0));
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [copiedFeedback, setCopiedFeedback] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Dialog State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState("");
  const [isCustomName, setIsCustomName] = useState(false);
  const [selectedEmpIds, setSelectedEmpIds] = useState<string[]>([]);
  const [taskDescription, setTaskDescription] = useState("");
  const [location, setLocation] = useState("");
  const [teamStatus, setTeamStatus] = useState<DailyTeamStatus>("em_andamento");
  const [notes, setNotes] = useState("");
  const [empModalSearch, setEmpModalSearch] = useState("");

  // Load teams when date changes
  useEffect(() => {
    fetchTeamsForDate(date);
  }, [date, fetchTeamsForDate]);

  // Active employees
  const activeEmployees = useMemo(() => {
    return employees.filter((e) => e.status === "ativo");
  }, [employees]);

  // Attendance for current selected date
  const todayAttendance = useMemo(() => {
    return attendance[date] || {};
  }, [attendance, date]);

  // Helper to get attendance label and color
  const getEmpAttendanceInfo = (empId: string) => {
    const record = todayAttendance[empId];
    const status: Status = typeof record === "string" ? record : record?.status || null;

    if (status === "presence") return { label: "Presente", color: "bg-emerald-500 text-white" };
    if (status === "half_presence") return { label: "1/2 Presença", color: "bg-orange-500 text-white" };
    if (status === "absence") return { label: "Falta", color: "bg-red-500 text-white" };
    if (status === "justified_absence") return { label: "Justificada", color: "bg-yellow-500 text-white" };
    if (status === "suspension") return { label: "Suspensão", color: "bg-slate-700 text-white" };
    return { label: "Sem registro", color: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300" };
  };

  // Employees already assigned to any team on this date
  const assignedEmpIds = useMemo(() => {
    const ids = new Set<string>();
    teams.forEach((t) => {
      t.employee_ids.forEach((id) => ids.add(id));
    });
    return ids;
  }, [teams]);

  // Unassigned employees
  const unassignedEmployees = useMemo(() => {
    return activeEmployees.filter((e) => !assignedEmpIds.has(e.id));
  }, [activeEmployees, assignedEmpIds]);

  // Metrics
  const totalTeams = teams.length;
  const totalAllocated = assignedEmpIds.size;
  const completedCount = teams.filter((t) => t.status === "concluida").length;
  const pendingOrProgressCount = totalTeams - completedCount;

  // Filtered teams list
  const filteredTeams = useMemo(() => {
    return teams.filter((team) => {
      if (statusFilter !== "todos" && team.status !== statusFilter) return false;
      if (!searchTerm) return true;
      const lower = searchTerm.toLowerCase();

      // Match team name
      if (team.name.toLowerCase().includes(lower)) return true;
      // Match task
      if (team.task_description.toLowerCase().includes(lower)) return true;
      // Match location
      if (team.location?.toLowerCase().includes(lower)) return true;
      // Match member names
      const hasMember = team.employee_ids.some((id) => {
        const emp = employees.find((e) => e.id === id);
        return (
          emp?.name.toLowerCase().includes(lower) ||
          emp?.nickname?.toLowerCase().includes(lower) ||
          emp?.role.toLowerCase().includes(lower)
        );
      });
      return hasMember;
    });
  }, [teams, statusFilter, searchTerm, employees]);

  // Format Brazilian date string
  const formattedDateTitle = useMemo(() => {
    if (!date) return "";
    const [year, month, day] = date.split("-").map(Number);
    const d = new Date(year, month - 1, day);
    return d.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  }, [date]);

  // Auto-generate team name when selecting employees if not manually customized
  const handleToggleEmp = (empId: string) => {
    const isSelected = selectedEmpIds.includes(empId);
    let newSelected: string[];
    if (isSelected) {
      newSelected = selectedEmpIds.filter((id) => id !== empId);
    } else {
      newSelected = [...selectedEmpIds, empId];
    }
    setSelectedEmpIds(newSelected);

    if (!isCustomName) {
      const names = newSelected
        .map((id) => {
          const emp = employees.find((e) => e.id === id);
          return emp ? (emp.nickname || emp.name.split(" ")[0]) : "";
        })
        .filter(Boolean);
      setTeamName(names.join(" - "));
    }
  };

  const handleOpenNewDialog = (presetEmpId?: string) => {
    setEditingTeamId(null);
    setIsCustomName(false);
    setTaskDescription("");
    setLocation("");
    setTeamStatus("em_andamento");
    setNotes("");
    setEmpModalSearch("");

    if (presetEmpId) {
      setSelectedEmpIds([presetEmpId]);
      const emp = employees.find((e) => e.id === presetEmpId);
      setTeamName(emp ? (emp.nickname || emp.name.split(" ")[0]) : "");
    } else {
      setSelectedEmpIds([]);
      setTeamName("");
    }
    setDialogOpen(true);
  };

  const handleOpenEditDialog = (team: DailyTeam) => {
    setEditingTeamId(team.id);
    setTeamName(team.name);
    setIsCustomName(true);
    setSelectedEmpIds([...team.employee_ids]);
    setTaskDescription(team.task_description);
    setLocation(team.location || "");
    setTeamStatus(team.status);
    setNotes(team.notes || "");
    setEmpModalSearch("");
    setDialogOpen(true);
  };

  const handleSaveTeam = async () => {
    if (selectedEmpIds.length === 0) {
      alert("Selecione pelo menos um funcionário para a equipe.");
      return;
    }

    const finalName = teamName.trim() || "Equipe sem nome";

    if (editingTeamId) {
      await updateTeam(editingTeamId, {
        name: finalName,
        employee_ids: selectedEmpIds,
        task_description: taskDescription,
        location,
        status: teamStatus,
        notes,
      });
    } else {
      await createTeam({
        date,
        name: finalName,
        employee_ids: selectedEmpIds,
        task_description: taskDescription,
        location,
        status: teamStatus,
        notes,
      });
    }
    setDialogOpen(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Tem certeza que deseja excluir a equipe "${name}"?`)) {
      await deleteTeam(id);
    }
  };

  const handleCloneYesterday = async () => {
    const yesterday = getLocalDateString(-1);
    const count = await cloneTeamsFromDate(yesterday, date);
    if (count > 0) {
      setFeedbackMsg(`${count} equipe(s) clonada(s) do dia anterior!`);
      setTimeout(() => setFeedbackMsg(null), 4000);
    } else {
      alert("Nenhuma equipe encontrada no dia anterior para clonar.");
    }
  };

  const handleCopyToWhatsApp = () => {
    if (teams.length === 0) {
      alert("Nenhuma equipe cadastrada para esta data.");
      return;
    }

    const [y, m, d] = date.split("-");
    const formattedDate = `${d}/${m}/${y}`;

    let text = `📋 *ESCALA DE EQUIPES & TAREFAS - ${formattedDate}*\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

    teams.forEach((team, idx) => {
      const memberNames = team.employee_ids
        .map((id) => {
          const emp = employees.find((e) => e.id === id);
          return emp ? `${emp.name} (${emp.role})` : null;
        })
        .filter(Boolean)
        .join(" | ");

      const statusEmoji =
        team.status === "concluida" ? "✅ Concluída" : team.status === "pendente" ? "⏳ Pendente" : "⚡ Em Andamento";

      text += `🔨 *${team.name}*\n`;
      text += `👥 *Integrantes:* ${memberNames || "Nenhum"}\n`;
      text += `📋 *Tarefa:* ${team.task_description || "Não especificada"}\n`;
      if (team.location) {
        text += `📍 *Frente / Local:* ${team.location}\n`;
      }
      text += `📌 *Status:* ${statusEmoji}\n`;
      if (team.notes) {
        text += `💬 *Obs:* ${team.notes}\n`;
      }
      text += `\n`;
    });

    text += `━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `👷 *Resumo:* ${teams.length} equipe(s) | ${assignedEmpIds.size} trabalhador(es) alocado(s)\n`;

    navigator.clipboard.writeText(text).then(() => {
      setCopiedFeedback(true);
      setTimeout(() => setCopiedFeedback(false), 3000);
    });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto print:p-0 print:space-y-4">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <HardHat className="h-7 w-7 text-primary" />
            Equipes & Tarefas Diárias
          </h1>
          <p className="text-sm text-muted-foreground capitalize">
            {formattedDateTitle}
          </p>
        </div>

        {/* Date Selector Navigation */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDate(getLocalDateString(-1))}
            className="text-xs"
          >
            Ontem
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDate(getLocalDateString(0))}
            className="text-xs font-semibold"
          >
            Hoje
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDate(getLocalDateString(1))}
            className="text-xs"
          >
            Amanhã
          </Button>
          <div className="relative">
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-auto h-9 text-xs font-medium cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Print-Only Header */}
      <div className="hidden print:block border-b pb-4 mb-4">
        <h1 className="text-2xl font-bold">Relatório de Equipes e Tarefas Diárias</h1>
        <p className="text-sm text-gray-600 capitalize">{formattedDateTitle}</p>
      </div>

      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => handleOpenNewDialog()}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm gap-2"
          >
            <Plus className="h-4 w-4" />
            Nova Equipe / Dupla
          </Button>
          <Button
            variant="outline"
            onClick={handleCloneYesterday}
            className="gap-2 text-xs md:text-sm"
            title="Copiar todas as equipes formadas no dia anterior para hoje"
          >
            <RotateCcw className="h-4 w-4 text-muted-foreground" />
            Repetir de Ontem
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleCopyToWhatsApp}
            className={`gap-2 text-xs md:text-sm transition-colors ${
              copiedFeedback ? "bg-emerald-50 text-emerald-700 border-emerald-300" : ""
            }`}
          >
            {copiedFeedback ? (
              <>
                <Check className="h-4 w-4 text-emerald-600" />
                Copiado p/ WhatsApp!
              </>
            ) : (
              <>
                <Share2 className="h-4 w-4 text-emerald-600" />
                WhatsApp
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={handlePrint}
            className="gap-2 text-xs md:text-sm"
          >
            <Printer className="h-4 w-4 text-muted-foreground" />
            Imprimir
          </Button>
        </div>
      </div>

      {feedbackMsg && (
        <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-4 py-2.5 rounded-lg text-sm font-medium animate-in fade-in duration-200 flex items-center justify-between">
          <span>{feedbackMsg}</span>
          <button onClick={() => setFeedbackMsg(null)} className="text-emerald-700 hover:text-emerald-900 font-bold">
            ×
          </button>
        </div>
      )}

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4 print:grid-cols-4">
        <Card className="shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Equipes Formadas</p>
              <h3 className="text-2xl font-bold mt-1">{totalTeams}</h3>
            </div>
            <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <Users className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Alocados em Equipe</p>
              <h3 className="text-2xl font-bold mt-1 text-emerald-600">{totalAllocated}</h3>
            </div>
            <div className="h-10 w-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <HardHat className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Em Andamento</p>
              <h3 className="text-2xl font-bold mt-1 text-blue-600">{pendingOrProgressCount}</h3>
            </div>
            <div className="h-10 w-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Sem Equipe (Disp.)</p>
              <h3 className="text-2xl font-bold mt-1 text-amber-600">{unassignedEmployees.length}</h3>
            </div>
            <div className="h-10 w-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
              <AlertCircle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid: Teams on Left, Available on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Teams List (2 cols on lg) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center gap-3 print:hidden">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por funcionário, equipe ou tarefa..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 px-3 rounded-lg border border-input bg-background text-xs font-medium focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="todos">Todos os Status</option>
                <option value="em_andamento">Em Andamento</option>
                <option value="concluida">Concluída</option>
                <option value="pendente">Pendente</option>
              </select>
            </div>
          </div>

          {/* Teams Display */}
          {isLoading && teams.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              Carregando equipes...
            </div>
          ) : filteredTeams.length === 0 ? (
            <Card className="border-dashed p-8 text-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                <Users className="h-6 w-6" />
              </div>
              <h3 className="text-base font-semibold">Nenhuma equipe formada para este dia</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Crie duplas ou grupos com os funcionários cadastrados e atribua a tarefa do dia.
              </p>
              <div className="pt-2 flex justify-center gap-2">
                <Button size="sm" onClick={() => handleOpenNewDialog()}>
                  <Plus className="h-4 w-4 mr-1" />
                  Criar Primeira Equipe
                </Button>
                <Button size="sm" variant="outline" onClick={handleCloneYesterday}>
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Repetir de Ontem
                </Button>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredTeams.map((team) => {
                const config = statusStyles[team.status] || statusStyles.em_andamento;

                return (
                  <Card
                    key={team.id}
                    className={`shadow-xs border-l-4 ${config.border} hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between`}
                  >
                    <CardHeader className="p-4 pb-2 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <h4 className="font-bold text-base text-foreground flex items-center gap-2">
                            {team.name}
                          </h4>
                          {team.location && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                              <span className="font-medium">{team.location}</span>
                            </p>
                          )}
                        </div>

                        {/* Status Toggle Button */}
                        <button
                          onClick={() => toggleTeamStatus(team.id)}
                          title="Clique para alternar status (Em Andamento -> Concluída -> Pendente)"
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border transition-all cursor-pointer ${config.badge}`}
                        >
                          {config.label}
                        </button>
                      </div>

                      {/* Task Box */}
                      <div className="bg-muted/40 p-2.5 rounded-lg border border-border/50 text-xs">
                        <div className="flex items-start gap-2">
                          <Briefcase className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <span className="font-semibold text-foreground">Tarefa: </span>
                            <span className="text-foreground/90">
                              {team.task_description || "Sem descrição de tarefa informada."}
                            </span>
                          </div>
                        </div>
                        {team.notes && (
                          <p className="text-[11px] text-muted-foreground mt-1.5 pl-6 italic">
                            Obs: {team.notes}
                          </p>
                        )}
                      </div>
                    </CardHeader>

                    <CardContent className="p-4 pt-1 space-y-3">
                      {/* Members List */}
                      <div>
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          Integrantes ({team.employee_ids.length})
                        </p>
                        <div className="space-y-1.5">
                          {team.employee_ids.map((id) => {
                            const emp = employees.find((e) => e.id === id);
                            if (!emp) return null;
                            const att = getEmpAttendanceInfo(emp.id);

                            return (
                              <div
                                key={id}
                                className="flex items-center justify-between p-1.5 rounded-md bg-background border text-xs"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="h-6 w-6 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-[10px] shrink-0">
                                    {(emp.nickname || emp.name).charAt(0).toUpperCase()}
                                  </div>
                                  <div className="truncate">
                                    <span className="font-semibold text-foreground">
                                      {emp.nickname ? `${emp.name} (${emp.nickname})` : emp.name}
                                    </span>
                                    <span className="text-muted-foreground text-[10px] ml-1.5">
                                      • {emp.role}
                                    </span>
                                  </div>
                                </div>

                                <span
                                  className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${att.color}`}
                                  title={`Status de ponto em ${date}: ${att.label}`}
                                >
                                  {att.label}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Card Footer Actions */}
                      <div className="flex items-center justify-between pt-2 border-t border-border/40 print:hidden">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleTeamStatus(team.id)}
                          className="h-8 text-xs font-medium text-muted-foreground hover:text-foreground gap-1.5"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {team.status === "concluida" ? "Reabrir" : "Concluir"}
                        </Button>

                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenEditDialog(team)}
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            title="Editar equipe ou tarefa"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(team.id, team.name)}
                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            title="Excluir equipe"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Available Employees (Sem Equipe Hoje) */}
        <div className="space-y-4 print:hidden">
          <Card className="shadow-xs sticky top-20">
            <CardHeader className="p-4 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    Disponíveis Hoje
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Funcionários sem equipe alocada nesta data
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="font-bold text-xs">
                  {unassignedEmployees.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {unassignedEmployees.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground bg-emerald-50/50 dark:bg-emerald-950/20 rounded-lg border border-dashed border-emerald-200 p-4">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600 mx-auto mb-1.5" />
                  <p className="font-semibold text-emerald-800 dark:text-emerald-300">
                    Todos os trabalhadores alocados!
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Nenhum funcionário ativo está sem equipe hoje.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                  {unassignedEmployees.map((emp) => {
                    const att = getEmpAttendanceInfo(emp.id);

                    return (
                      <div
                        key={emp.id}
                        className="flex items-center justify-between p-2 rounded-lg border bg-card hover:bg-muted/50 transition-colors text-xs"
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <div className="font-medium text-foreground truncate">
                            {emp.nickname ? `${emp.name} (${emp.nickname})` : emp.name}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                            <span>{emp.role}</span>
                            <span>•</span>
                            <span className={`px-1 rounded ${att.color}`}>{att.label}</span>
                          </div>
                        </div>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleOpenNewDialog(emp.id)}
                          className="h-7 text-[11px] px-2 font-semibold text-primary hover:text-primary hover:bg-primary/10 shrink-0"
                          title="Criar equipe com este funcionário"
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Alocar
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal Dialog: Criar / Editar Equipe */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <HardHat className="h-5 w-5 text-primary" />
              {editingTeamId ? "Editar Equipe & Tarefa" : "Nova Equipe & Tarefa"}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-1 space-y-4 py-2">
            {/* Team Name */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="teamName" className="text-xs font-semibold">
                  Nome da Equipe / Dupla *
                </Label>
                <span className="text-[10px] text-muted-foreground">
                  {isCustomName ? "Nome personalizado" : "Gerado automaticamente pelos nomes"}
                </span>
              </div>
              <Input
                id="teamName"
                value={teamName}
                onChange={(e) => {
                  setTeamName(e.target.value);
                  setIsCustomName(true);
                }}
                placeholder="Ex: Edjunior - Felipe Lucas ou Dupla Elétrica"
                className="h-9 text-xs"
              />
            </div>

            {/* Employee Selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">
                  Selecione os Funcionários da Equipe * ({selectedEmpIds.length} selecionado
                  {selectedEmpIds.length !== 1 ? "s" : ""})
                </Label>
              </div>

              {/* Search employees */}
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Filtrar por nome ou função..."
                  value={empModalSearch}
                  onChange={(e) => setEmpModalSearch(e.target.value)}
                  className="pl-8 h-8 text-xs"
                />
              </div>

              {/* Employee Selection Grid */}
              <div className="border rounded-lg p-2 max-h-48 overflow-y-auto space-y-1.5 bg-muted/20">
                {activeEmployees
                  .filter((emp) => {
                    if (!empModalSearch) return true;
                    const low = empModalSearch.toLowerCase();
                    return (
                      emp.name.toLowerCase().includes(low) ||
                      emp.nickname?.toLowerCase().includes(low) ||
                      emp.role.toLowerCase().includes(low)
                    );
                  })
                  .map((emp) => {
                    const isChecked = selectedEmpIds.includes(emp.id);
                    const att = getEmpAttendanceInfo(emp.id);

                    return (
                      <div
                        key={emp.id}
                        onClick={() => handleToggleEmp(emp.id)}
                        className={`flex items-center justify-between p-2 rounded-md cursor-pointer border transition-colors text-xs ${
                          isChecked
                            ? "bg-primary/10 border-primary text-foreground font-semibold"
                            : "bg-background border-border hover:bg-muted/60"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}} // Handled by div click
                            className="h-3.5 w-3.5 rounded border-gray-300 text-primary focus:ring-primary pointer-events-none"
                          />
                          <div className="truncate">
                            <span>{emp.nickname ? `${emp.name} (${emp.nickname})` : emp.name}</span>
                            <span className="text-[11px] text-muted-foreground ml-1.5 font-normal">
                              • {emp.role}
                            </span>
                          </div>
                        </div>

                        <span
                          className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${att.color}`}
                        >
                          {att.label}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Task Description */}
            <div className="space-y-1.5">
              <Label htmlFor="taskDesc" className="text-xs font-semibold">
                Tarefa do Dia *
              </Label>
              <textarea
                id="taskDesc"
                rows={2}
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                placeholder="Ex: Reboco do 2º pavimento, passagem de conduítes, assentamento de blocos..."
                className="w-full text-xs p-2.5 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />

              {/* Task Quick Presets */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="text-[10px] text-muted-foreground font-medium self-center mr-1">
                  Atalhos:
                </span>
                {TASK_PRESETS.map((preset) => (
                  <Badge
                    key={preset}
                    variant="outline"
                    onClick={() => {
                      if (!taskDescription) {
                        setTaskDescription(preset);
                      } else {
                        setTaskDescription((prev) => `${prev}, ${preset}`);
                      }
                    }}
                    className="text-[10px] cursor-pointer hover:bg-primary/10 hover:text-primary transition-colors py-0.5 px-2"
                  >
                    + {preset}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Location & Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="location" className="text-xs font-semibold">
                  Frente / Local da Obra (opcional)
                </Label>
                <Input
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Ex: Bloco A - Apto 302 / Fachada"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="statusSelect" className="text-xs font-semibold">
                  Status Inicial
                </Label>
                <select
                  id="statusSelect"
                  value={teamStatus}
                  onChange={(e) => setTeamStatus(e.target.value as DailyTeamStatus)}
                  className="w-full h-9 px-3 rounded-md border border-input bg-background text-xs font-medium focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="em_andamento">Em Andamento</option>
                  <option value="pendente">Pendente</option>
                  <option value="concluida">Concluída</option>
                </select>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="notes" className="text-xs font-semibold">
                Observações Adicionais (opcional)
              </Label>
              <Input
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Aguardando chegada de argamassa às 14h"
                className="h-9 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="pt-3 border-t">
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSaveTeam} className="font-semibold">
              {editingTeamId ? "Salvar Alterações" : "Criar Equipe"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
