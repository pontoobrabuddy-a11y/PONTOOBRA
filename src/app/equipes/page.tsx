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
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
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
  Briefcase,
  LayoutGrid,
  List,
  FileSpreadsheet,
  Eye,
  EyeOff,
  GitFork,
  Layers,
  Network
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
  "Impermeabilização",
  "Compras / Suprimentos",
  "Almoxarifado / Carga"
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
    toggleTeamHidden,
  } = useDailyTeams();

  const [date, setDate] = useState<string>(() => getLocalDateString(0));
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [showHidden, setShowHidden] = useState<boolean>(false);
  const [groupByHierarchy, setGroupByHierarchy] = useState<boolean>(false);
  const [copiedFeedback, setCopiedFeedback] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // View Mode: Cards vs Lista
  const [viewMode, setViewMode] = useState<"cards" | "lista">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("ponto_teams_view_mode") as "cards" | "lista") || "cards";
    }
    return "cards";
  });

  const changeViewMode = (mode: "cards" | "lista") => {
    setViewMode(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem("ponto_teams_view_mode", mode);
    }
  };

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
  const [isHidden, setIsHidden] = useState<boolean>(false);
  const [engineerName, setEngineerName] = useState("");
  const [supervisorName, setSupervisorName] = useState("");
  const [parentTeamId, setParentTeamId] = useState("");
  const [empModalSearch, setEmpModalSearch] = useState("");

  // Load teams when date changes
  useEffect(() => {
    fetchTeamsForDate(date);
  }, [date, fetchTeamsForDate]);

  // Active employees
  const activeEmployees = useMemo(() => {
    return employees.filter((e) => e.status === "ativo");
  }, [employees]);

  // Listas estruturadas de Encarregados e Engenheiros a partir dos funcionários cadastrados
  const encarregadosList = useMemo(() => {
    const isEncarregado = (r: string) => {
      const lower = (r || "").toLowerCase();
      return lower.includes("encarr") || lower.includes("mestre") || lower.includes("líder") || lower.includes("lider");
    };
    const prioritarios = activeEmployees.filter((e) => isEncarregado(e.role));
    const outros = activeEmployees.filter((e) => !isEncarregado(e.role));
    return { prioritarios, outros };
  }, [activeEmployees]);

  const engenheirosList = useMemo(() => {
    const isEng = (r: string) => (r || "").toLowerCase().includes("eng");
    return activeEmployees.filter((e) => isEng(e.role));
  }, [activeEmployees]);

  // Suggested Engineers and Supervisors from active employees & previous teams
  const engineerSuggestions = useMemo(() => {
    const list = new Set<string>();
    employees.forEach((e) => {
      if (e.role && e.role.toLowerCase().includes("eng")) {
        list.add(e.name);
      }
    });
    teams.forEach((t) => {
      if (t.engineer_name?.trim()) list.add(t.engineer_name.trim());
    });
    if (list.size === 0) {
      list.add("Engenheiro 01");
      list.add("Engenheiro 02");
    }
    return Array.from(list);
  }, [employees, teams]);

  const supervisorSuggestions = useMemo(() => {
    const list = new Set<string>();
    employees.forEach((e) => {
      const r = (e.role || "").toLowerCase();
      if (r.includes("encarr") || r.includes("mestre") || r.includes("líder") || r.includes("lider")) {
        list.add(e.name);
      }
    });
    teams.forEach((t) => {
      if (t.supervisor_name?.trim()) list.add(t.supervisor_name.trim());
    });
    if (list.size === 0) {
      list.add("Encarregado 01");
      list.add("Encarregado 02");
    }
    return Array.from(list);
  }, [employees, teams]);

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

  // Employees already assigned to any team on this date (excluding hidden teams from count if hidden not shown)
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
  const hiddenTeamsCount = teams.filter((t) => t.is_hidden).length;
  const visibleTeamsCount = teams.filter((t) => !t.is_hidden).length;
  const totalAllocated = assignedEmpIds.size;
  const completedCount = teams.filter((t) => t.status === "concluida").length;
  const pendingOrProgressCount = totalTeams - completedCount;

  // Filtered teams list
  const filteredTeams = useMemo(() => {
    return teams.filter((team) => {
      // Ocultar equipes se showHidden for false
      if (!showHidden && team.is_hidden) return false;

      if (statusFilter !== "todos" && team.status !== statusFilter) return false;
      if (!searchTerm) return true;
      const lower = searchTerm.toLowerCase();

      // Match team name
      if (team.name.toLowerCase().includes(lower)) return true;
      // Match task
      if (team.task_description.toLowerCase().includes(lower)) return true;
      // Match location
      if (team.location?.toLowerCase().includes(lower)) return true;
      // Match engineer or supervisor
      if (team.engineer_name?.toLowerCase().includes(lower)) return true;
      if (team.supervisor_name?.toLowerCase().includes(lower)) return true;
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
  }, [teams, showHidden, statusFilter, searchTerm, employees]);

  // Grouped by Hierarchy (Engenheiro ➔ Encarregado)
  const groupedHierarchy = useMemo(() => {
    const groups: Record<
      string,
      {
        key: string;
        engineer: string;
        supervisor: string;
        teams: DailyTeam[];
        totalWorkers: number;
      }
    > = {};

    filteredTeams.forEach((t) => {
      const eng = t.engineer_name?.trim() || "Sem Engenheiro Atribuído";
      const sup = t.supervisor_name?.trim() || "Sem Encarregado Atribuído";
      const key = `${eng} — ${sup}`;

      if (!groups[key]) {
        groups[key] = {
          key,
          engineer: eng,
          supervisor: sup,
          teams: [],
          totalWorkers: 0,
        };
      }
      groups[key].teams.push(t);
      groups[key].totalWorkers += t.employee_ids.length;
    });

    return Object.values(groups);
  }, [filteredTeams]);

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
    setIsHidden(false);
    setEngineerName("");
    setSupervisorName("");
    setParentTeamId("");
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
    setIsHidden(Boolean(team.is_hidden));
    setEngineerName(team.engineer_name || "");
    setSupervisorName(team.supervisor_name || "");
    setParentTeamId(team.parent_team_id || "");
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
        is_hidden: isHidden,
        engineer_name: engineerName,
        supervisor_name: supervisorName,
        parent_team_id: parentTeamId,
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
        is_hidden: isHidden,
        engineer_name: engineerName,
        supervisor_name: supervisorName,
        parent_team_id: parentTeamId,
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
    if (filteredTeams.length === 0) {
      alert("Nenhuma equipe encontrada para esta data com os filtros atuais.");
      return;
    }

    const [y, m, d] = date.split("-");
    const formattedDate = `${d}/${m}/${y}`;

    let text = `📋 *ESCALA DE EQUIPES & TAREFAS - ${formattedDate}*\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

    if (groupByHierarchy) {
      groupedHierarchy.forEach((group) => {
        text += `🏗️ *${group.engineer}*  ➔  👷 *${group.supervisor}*\n`;
        text += `────────────────────\n`;

        group.teams.forEach((team) => {
          const memberNames = team.employee_ids
            .map((id) => {
              const emp = employees.find((e) => e.id === id);
              return emp ? `${emp.name} (${emp.role})` : null;
            })
            .filter(Boolean)
            .join(" | ");

          const statusEmoji =
            team.status === "concluida" ? "✅ Concluída" : team.status === "pendente" ? "⏳ Pendente" : "⚡ Em Andamento";

          text += `  🔨 *${team.name}* ${team.is_hidden ? "*(Rotina)*" : ""}\n`;
          text += `  👥 Integrantes: ${memberNames || "Nenhum"}\n`;
          text += `  📋 Tarefa: ${team.task_description || "Não especificada"}\n`;
          if (team.location) text += `  📍 Frente: ${team.location}\n`;
          text += `  📌 Status: ${statusEmoji}\n`;
          if (team.notes) text += `  💬 Obs: ${team.notes}\n`;
          text += `\n`;
        });
      });
    } else {
      filteredTeams.forEach((team) => {
        const memberNames = team.employee_ids
          .map((id) => {
            const emp = employees.find((e) => e.id === id);
            return emp ? `${emp.name} (${emp.role})` : null;
          })
          .filter(Boolean)
          .join(" | ");

        const statusEmoji =
          team.status === "concluida" ? "✅ Concluída" : team.status === "pendente" ? "⏳ Pendente" : "⚡ Em Andamento";

        text += `🔨 *${team.name}* ${team.is_hidden ? "*(Rotina)*" : ""}\n`;
        if (team.engineer_name || team.supervisor_name) {
          text += `🔗 *Comando:* ${team.engineer_name || "-"} ➔ ${team.supervisor_name || "-"}\n`;
        }
        text += `👥 *Integrantes:* ${memberNames || "Nenhum"}\n`;
        text += `📋 *Tarefa:* ${team.task_description || "Não especificada"}\n`;
        if (team.location) text += `📍 *Frente / Local:* ${team.location}\n`;
        text += `📌 *Status:* ${statusEmoji}\n`;
        if (team.notes) text += `💬 *Obs:* ${team.notes}\n`;
        text += `\n`;
      });
    }

    text += `━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `👷 *Resumo:* ${filteredTeams.length} equipe(s) | ${totalAllocated} trabalhador(es) alocado(s)\n`;

    navigator.clipboard.writeText(text).then(() => {
      setCopiedFeedback(true);
      setTimeout(() => setCopiedFeedback(false), 3000);
    });
  };

  const handleExportExcel = async () => {
    if (filteredTeams.length === 0) {
      alert("Nenhuma equipe encontrada nesta data para exportar.");
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Escala de Equipes");

    // Configuração de Colunas
    worksheet.columns = [
      { key: "num", width: 6 },
      { key: "status", width: 16 },
      { key: "team", width: 28 },
      { key: "hierarchy", width: 30 },
      { key: "members", width: 36 },
      { key: "roles", width: 26 },
      { key: "presence", width: 22 },
      { key: "task", width: 38 },
      { key: "location", width: 26 },
      { key: "notes", width: 26 },
      { key: "hidden", width: 16 },
    ];

    // Linha 1: Título Principal
    const titleRow = worksheet.addRow(["RELATÓRIO DIÁRIO DE EQUIPES, TAREFAS & RESPONSÁVEIS"]);
    worksheet.mergeCells("A1:K1");
    titleRow.font = { name: "Arial", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
    titleRow.alignment = { horizontal: "center", vertical: "middle" };
    titleRow.height = 32;
    titleRow.getCell(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0F172A" }, // Slate-900
    };

    // Linha 2: Subtítulo com Data
    const [y, m, d] = date.split("-");
    const formattedDate = `${d}/${m}/${y}`;
    const nowTime = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const subRow = worksheet.addRow([
      `Data da Escala: ${formattedDate} (${formattedDateTitle})  |  Gerado em: ${new Date().toLocaleDateString("pt-BR")} às ${nowTime} ${showHidden ? "(Incluindo Equipes de Rotina/Ocultas)" : ""}`,
    ]);
    worksheet.mergeCells("A2:K2");
    subRow.font = { name: "Arial", size: 10, italic: true, color: { argb: "FF475569" } };
    subRow.alignment = { horizontal: "center", vertical: "middle" };
    subRow.height = 20;

    // Linha 3: Resumo KPIs
    const kpiRow = worksheet.addRow([
      `Resumo Geral:  ${filteredTeams.length} equipe(s) listadas  |  ${totalAllocated} trabalhador(es) alocados  |  ${completedCount} concluída(s)  |  ${pendingOrProgressCount} em andamento/pendentes`,
    ]);
    worksheet.mergeCells("A3:K3");
    kpiRow.font = { name: "Arial", size: 10, bold: true, color: { argb: "FF1E293B" } };
    kpiRow.alignment = { horizontal: "center", vertical: "middle" };
    kpiRow.height = 22;
    kpiRow.getCell(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF1F5F9" }, // Slate-100
    };

    worksheet.addRow([]); // Espaço em branco

    // Linha 5: Cabeçalho das Colunas
    const headerRow = worksheet.addRow([
      "Nº",
      "Status",
      "Nome da Equipe",
      "Caminho de Comando (Eng. ➔ Encarregado)",
      "Integrantes",
      "Cargos / Funções",
      "Presença Ponto",
      "Tarefa do Dia",
      "Frente / Local",
      "Observações",
      "Tipo de Equipe",
    ]);
    headerRow.height = 25;
    headerRow.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.alignment = { horizontal: "center", vertical: "middle" };

    for (let c = 1; c <= 11; c++) {
      const cell = headerRow.getCell(c);
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF334155" }, // Slate-700
      };
      cell.border = {
        top: { style: "thin", color: { argb: "FF94A3B8" } },
        bottom: { style: "medium", color: { argb: "FF0F172A" } },
        left: { style: "thin", color: { argb: "FF94A3B8" } },
        right: { style: "thin", color: { argb: "FF94A3B8" } },
      };
    }

    // Linhas de Dados
    filteredTeams.forEach((team, index) => {
      const memberNames: string[] = [];
      const memberRoles: string[] = [];
      const memberPresence: string[] = [];

      team.employee_ids.forEach((id) => {
        const emp = employees.find((e) => e.id === id);
        if (emp) {
          memberNames.push(emp.nickname ? `${emp.name} (${emp.nickname})` : emp.name);
          memberRoles.push(emp.role);
          const att = getEmpAttendanceInfo(emp.id);
          memberPresence.push(att.label);
        }
      });

      const statusLabel =
        team.status === "concluida"
          ? "Concluída"
          : team.status === "pendente"
          ? "Pendente"
          : "Em Andamento";

      const hierarchyStr =
        team.engineer_name || team.supervisor_name
          ? `${team.engineer_name || "-"} ➔ ${team.supervisor_name || "-"}`
          : "-";

      const row = worksheet.addRow([
        index + 1,
        statusLabel,
        team.name,
        hierarchyStr,
        memberNames.join("\n"),
        memberRoles.join("\n"),
        memberPresence.join("\n"),
        team.task_description,
        team.location || "-",
        team.notes || "-",
        team.is_hidden ? "Rotina / Oculta" : "Diária",
      ]);

      row.alignment = { vertical: "middle", wrapText: true };
      row.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
      row.getCell(2).alignment = { horizontal: "center", vertical: "middle" };
      row.getCell(11).alignment = { horizontal: "center", vertical: "middle" };

      // Cor no status
      if (team.status === "concluida") {
        row.getCell(2).font = { color: { argb: "FF059669" }, bold: true };
      } else if (team.status === "pendente") {
        row.getCell(2).font = { color: { argb: "FFD97706" }, bold: true };
      } else {
        row.getCell(2).font = { color: { argb: "FF2563EB" }, bold: true };
      }

      // Fundo zebrado
      const bg = index % 2 === 0 ? "FFFFFFFF" : "FFF8FAFC";
      for (let c = 1; c <= 11; c++) {
        const cell = row.getCell(c);
        if (!cell.fill) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: bg },
          };
        }
        cell.border = {
          top: { style: "thin", color: { argb: "FFE2E8F0" } },
          bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
          left: { style: "thin", color: { argb: "FFE2E8F0" } },
          right: { style: "thin", color: { argb: "FFE2E8F0" } },
        };
      }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    saveAs(blob, `Escala_Equipes_${date}.xlsx`);
  };

  const handlePrint = () => {
    window.print();
  };

  // Helper renderer for a single team card
  const renderTeamCard = (team: DailyTeam) => {
    const config = statusStyles[team.status] || statusStyles.em_andamento;
    const parentTeam = team.parent_team_id ? teams.find((t) => t.id === team.parent_team_id) : null;

    return (
      <Card
        key={team.id}
        className={`shadow-xs border-l-4 ${config.border} hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between ${
          team.is_hidden ? "bg-muted/15 border-dashed" : ""
        }`}
      >
        <CardHeader className="p-4 pb-2 space-y-2">
          {/* Top Bar: Name, Badges & Actions */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-bold text-base text-foreground truncate">{team.name}</h4>
                {team.is_hidden && (
                  <Badge variant="outline" className="text-[10px] bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300">
                    <EyeOff className="h-3 w-3 mr-1" />
                    Rotina / Oculta
                  </Badge>
                )}
              </div>

              {/* Location */}
              {team.location && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="font-medium">{team.location}</span>
                </p>
              )}
            </div>

            {/* Quick Status Button */}
            <button
              onClick={() => toggleTeamStatus(team.id)}
              title="Clique para alternar status (Em Andamento -> Concluída -> Pendente)"
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border transition-all cursor-pointer shrink-0 ${config.badge}`}
            >
              {config.label}
            </button>
          </div>

          {/* Hierarchy Trail (Engenheiro ➔ Encarregado) */}
          {(team.engineer_name || team.supervisor_name || parentTeam) && (
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] bg-primary/5 dark:bg-primary/10 px-2 py-1 rounded-md border border-primary/20 text-foreground">
              <GitFork className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="font-semibold text-primary">Comando:</span>
              <span>{team.engineer_name || "Eng. Responsável"}</span>
              <span className="text-muted-foreground">➔</span>
              <span className="font-semibold">{team.supervisor_name || "Encarregado"}</span>
              {parentTeam && (
                <>
                  <span className="text-muted-foreground">• Vinculada a:</span>
                  <span className="font-medium underline">{parentTeam.name}</span>
                </>
              )}
            </div>
          )}

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
                        <span className="text-muted-foreground text-[10px] ml-1.5">• {emp.role}</span>
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
              {/* Toggle Hidden Shortcut */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => toggleTeamHidden(team.id)}
                className={`h-8 w-8 ${
                  team.is_hidden ? "text-amber-600 hover:text-amber-700" : "text-muted-foreground hover:text-foreground"
                }`}
                title={team.is_hidden ? "Equipe oculta na visão diária (clique para reexibir)" : "Ocultar equipe da visão diária (rotina de compras)"}
              >
                {team.is_hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </Button>

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
          <p className="text-sm text-muted-foreground capitalize">{formattedDateTitle}</p>
        </div>

        {/* Date Selector Navigation */}
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setDate(getLocalDateString(-1))} className="text-xs">
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
          <Button variant="outline" size="sm" onClick={() => setDate(getLocalDateString(1))} className="text-xs">
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
        <h1 className="text-2xl font-bold">Relatório de Equipes, Tarefas e Responsáveis</h1>
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

        <div className="flex flex-wrap items-center gap-2">
          {/* Toggle View Mode: Cards vs Lista */}
          <div className="flex items-center border rounded-lg p-0.5 bg-muted/40">
            <button
              type="button"
              onClick={() => changeViewMode("cards")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                viewMode === "cards"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Visualização em Cards"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Cards</span>
            </button>
            <button
              type="button"
              onClick={() => changeViewMode("lista")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                viewMode === "lista"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Visualização em Lista / Tabela"
            >
              <List className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Lista</span>
            </button>
          </div>

          {/* Toggle Group by Hierarchy */}
          <Button
            variant={groupByHierarchy ? "default" : "outline"}
            size="sm"
            onClick={() => setGroupByHierarchy(!groupByHierarchy)}
            className={`gap-1.5 text-xs h-9 font-medium transition-all ${
              groupByHierarchy ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground"
            }`}
            title="Agrupar equipes pelo caminho de Engenheiro e Encarregado"
          >
            <Network className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Caminho de Comando</span>
          </Button>

          {/* Toggle Show Hidden Teams */}
          <Button
            variant={showHidden ? "default" : "outline"}
            size="sm"
            onClick={() => setShowHidden(!showHidden)}
            className={`gap-1.5 text-xs h-9 font-medium transition-all ${
              showHidden
                ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900"
                : "text-muted-foreground"
            }`}
            title="Exibir ou ocultar equipes fixas/rotineiras (ex: compras)"
          >
            {showHidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            {showHidden ? "Ocultar Rotina" : `Ver Ocultas (${hiddenTeamsCount})`}
          </Button>

          <Button
            variant="outline"
            onClick={handleExportExcel}
            className="gap-2 text-xs md:text-sm text-emerald-700 hover:text-emerald-800 border-emerald-200 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800"
            title="Exportar dados para planilha Excel (.xlsx)"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            Excel
          </Button>

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

          <Button variant="outline" onClick={handlePrint} className="gap-2 text-xs md:text-sm">
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
              <p className="text-xs font-medium text-muted-foreground">Equipes Ativas</p>
              <h3 className="text-2xl font-bold mt-1">
                {visibleTeamsCount}{" "}
                {hiddenTeamsCount > 0 && (
                  <span className="text-xs font-normal text-muted-foreground">({hiddenTeamsCount} oculta{hiddenTeamsCount > 1 ? "s" : ""})</span>
                )}
              </h3>
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
                placeholder="Buscar por funcionário, equipe, encarregado, engenheiro ou tarefa..."
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
            <div className="py-12 text-center text-muted-foreground text-sm">Carregando equipes...</div>
          ) : filteredTeams.length === 0 ? (
            <Card className="border-dashed p-8 text-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                <Users className="h-6 w-6" />
              </div>
              <h3 className="text-base font-semibold">Nenhuma equipe encontrada para os filtros atuais</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {hiddenTeamsCount > 0 && !showHidden
                  ? `Existem ${hiddenTeamsCount} equipe(s) oculta(s) nesta data. Clique em "Ver Ocultas" acima para exibi-las.`
                  : "Crie duplas ou grupos com os funcionários cadastrados e atribua a tarefa do dia."}
              </p>
              <div className="pt-2 flex justify-center gap-2">
                <Button size="sm" onClick={() => handleOpenNewDialog()}>
                  <Plus className="h-4 w-4 mr-1" />
                  Criar Primeira Equipe
                </Button>
                {hiddenTeamsCount > 0 && !showHidden && (
                  <Button size="sm" variant="outline" onClick={() => setShowHidden(true)}>
                    <Eye className="h-4 w-4 mr-1" />
                    Exibir Ocultas ({hiddenTeamsCount})
                  </Button>
                )}
              </div>
            </Card>
          ) : groupByHierarchy ? (
            /* HIERARCHY GROUPED VIEW (Engenheiro ➔ Encarregado ➔ Equipes) */
            <div className="space-y-6">
              {groupedHierarchy.map((group) => (
                <div key={group.key} className="space-y-3 border rounded-xl p-4 bg-muted/15 shadow-xs">
                  {/* Group Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <Network className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-foreground text-sm sm:text-base">
                            {group.engineer}
                          </span>
                          <span className="text-muted-foreground">➔</span>
                          <span className="font-semibold text-primary text-sm sm:text-base">
                            {group.supervisor}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {group.teams.length} equipe{group.teams.length !== 1 ? "s" : ""} vinculada{group.teams.length !== 1 ? "s" : ""} • {group.totalWorkers} trabalhadores sob este comando
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Group Teams */}
                  {viewMode === "cards" ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                      {group.teams.map((team) => renderTeamCard(team))}
                    </div>
                  ) : (
                    <div className="divide-y border rounded-lg overflow-hidden bg-background">
                      {group.teams.map((team) => {
                        const config = statusStyles[team.status] || statusStyles.em_andamento;
                        return (
                          <div key={team.id} className="p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-muted/30">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-foreground">{team.name}</span>
                                <button
                                  onClick={() => toggleTeamStatus(team.id)}
                                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border cursor-pointer ${config.badge}`}
                                >
                                  {config.label}
                                </button>
                                {team.is_hidden && (
                                  <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">Rotina</span>
                                )}
                              </div>
                              <p className="text-xs text-foreground/90 mt-1">
                                <span className="font-semibold">Tarefa:</span> {team.task_description || "-"}
                                {team.location && <span className="text-muted-foreground ml-2">📍 {team.location}</span>}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0 print:hidden">
                              <Button variant="ghost" size="icon" onClick={() => toggleTeamHidden(team.id)} className="h-7 w-7 text-muted-foreground">
                                {team.is_hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleOpenEditDialog(team)} className="h-7 w-7 text-muted-foreground">
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDelete(team.id, team.name)} className="h-7 w-7 text-destructive hover:bg-destructive/10">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : viewMode === "cards" ? (
            /* STANDARD CARDS VIEW */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredTeams.map((team) => renderTeamCard(team))}
            </div>
          ) : (
            /* STANDARD LISTA / TABELA VIEW */
            <Card className="shadow-xs overflow-hidden border">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-muted/70 border-b text-muted-foreground font-semibold">
                      <th className="py-3 px-3 w-28">Status</th>
                      <th className="py-3 px-3 w-44">Equipe</th>
                      <th className="py-3 px-3 min-w-[190px]">Caminho de Comando</th>
                      <th className="py-3 px-3 min-w-[210px]">Integrantes & Funções</th>
                      <th className="py-3 px-3 min-w-[190px]">Tarefa do Dia</th>
                      <th className="py-3 px-3 w-32">Local / Frente</th>
                      <th className="py-3 px-3 w-28 text-right print:hidden">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredTeams.map((team) => {
                      const config = statusStyles[team.status] || statusStyles.em_andamento;

                      return (
                        <tr
                          key={team.id}
                          className={`hover:bg-muted/30 transition-colors align-top ${
                            team.is_hidden ? "bg-muted/15 opacity-80" : ""
                          }`}
                        >
                          {/* Status */}
                          <td className="py-3 px-3 whitespace-nowrap">
                            <button
                              onClick={() => toggleTeamStatus(team.id)}
                              title="Clique para alternar status"
                              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border transition-all cursor-pointer ${config.badge}`}
                            >
                              {config.label}
                            </button>
                            {team.is_hidden && (
                              <div className="mt-1">
                                <span className="text-[9px] bg-slate-100 text-slate-700 px-1 py-0.5 rounded border border-slate-300">
                                  Rotina
                                </span>
                              </div>
                            )}
                          </td>

                          {/* Team Name */}
                          <td className="py-3 px-3">
                            <div className="font-bold text-foreground text-sm flex items-center gap-1.5">
                              {team.name}
                            </div>
                            <span className="text-[10px] text-muted-foreground">
                              {team.employee_ids.length} trabalhador{team.employee_ids.length !== 1 ? "es" : ""}
                            </span>
                          </td>

                          {/* Hierarchy */}
                          <td className="py-3 px-3">
                            {team.engineer_name || team.supervisor_name ? (
                              <div className="text-[11px] space-y-0.5">
                                <div className="font-medium text-foreground">
                                  {team.engineer_name || "-"}
                                </div>
                                <div className="text-muted-foreground flex items-center gap-1">
                                  <span>➔</span>
                                  <span className="font-semibold text-primary">
                                    {team.supervisor_name || "-"}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground italic">-</span>
                            )}
                          </td>

                          {/* Integrantes */}
                          <td className="py-3 px-3">
                            <div className="flex flex-col gap-1">
                              {team.employee_ids.map((id) => {
                                const emp = employees.find((e) => e.id === id);
                                if (!emp) return null;
                                const att = getEmpAttendanceInfo(emp.id);

                                return (
                                  <div
                                    key={id}
                                    className="inline-flex items-center justify-between gap-2 p-1 rounded bg-background border text-[11px]"
                                  >
                                    <div className="flex items-center gap-1.5 truncate">
                                      <span className="font-semibold text-foreground">
                                        {emp.nickname ? `${emp.name} (${emp.nickname})` : emp.name}
                                      </span>
                                      <span className="text-muted-foreground text-[10px]">• {emp.role}</span>
                                    </div>
                                    <span
                                      className={`text-[9px] font-medium px-1.5 py-0.2 rounded shrink-0 ${att.color}`}
                                      title={`Ponto: ${att.label}`}
                                    >
                                      {att.label}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </td>

                          {/* Tarefa */}
                          <td className="py-3 px-3">
                            <div className="font-medium text-foreground">
                              {team.task_description || "-"}
                            </div>
                            {team.notes && (
                              <p className="text-[10px] text-muted-foreground italic mt-0.5">
                                Obs: {team.notes}
                              </p>
                            )}
                          </td>

                          {/* Local */}
                          <td className="py-3 px-3 text-muted-foreground">
                            {team.location ? (
                              <div className="flex items-center gap-1 font-medium text-foreground">
                                <MapPin className="h-3 w-3 text-primary shrink-0" />
                                <span>{team.location}</span>
                              </div>
                            ) : (
                              <span>-</span>
                            )}
                          </td>

                          {/* Ações */}
                          <td className="py-3 px-3 text-right whitespace-nowrap print:hidden">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => toggleTeamHidden(team.id)}
                                className={`h-7 w-7 ${
                                  team.is_hidden ? "text-amber-600 hover:text-amber-700" : "text-muted-foreground hover:text-foreground"
                                }`}
                                title={team.is_hidden ? "Reexibir equipe na visão diária" : "Ocultar equipe da visão diária"}
                              >
                                {team.is_hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenEditDialog(team)}
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                title="Editar"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(team.id, team.name)}
                                className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                title="Excluir"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
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

            {/* Hierarchy & Responsibility Chain (Engenheiro & Encarregado) */}
            <div className="p-3 rounded-lg border bg-muted/20 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <GitFork className="h-4 w-4 text-primary" />
                Caminho de Responsáveis (Cadeia de Comando)
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Engenheiro Responsável (Select) */}
                <div className="space-y-1">
                  <Label htmlFor="engSelect" className="text-[11px] font-medium text-muted-foreground">
                    Engenheiro Responsável
                  </Label>
                  <select
                    id="engSelect"
                    value={engineerName}
                    onChange={(e) => setEngineerName(e.target.value)}
                    className="w-full h-8 px-2.5 rounded-md border border-input bg-background text-xs font-medium focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
                  >
                    <option value="">Selecione o Engenheiro...</option>
                    {engenheirosList.length > 0 && (
                      <optgroup label="Engenheiros Cadastrados">
                        {engenheirosList.map((emp) => {
                          const label = emp.nickname ? `${emp.name} (${emp.nickname})` : emp.name;
                          return (
                            <option key={emp.id} value={label}>
                              {label} — {emp.role}
                            </option>
                          );
                        })}
                      </optgroup>
                    )}
                    <optgroup label="Padrão / Frentes">
                      <option value="Engenheiro 01">Engenheiro 01</option>
                      <option value="Engenheiro 02">Engenheiro 02</option>
                      <option value="Engenheiro 03">Engenheiro 03</option>
                    </optgroup>
                    <optgroup label="Outros Funcionários">
                      {activeEmployees
                        .filter((e) => !(e.role || "").toLowerCase().includes("eng"))
                        .map((emp) => {
                          const label = emp.nickname ? `${emp.name} (${emp.nickname})` : emp.name;
                          return (
                            <option key={emp.id} value={label}>
                              {label} — {emp.role}
                            </option>
                          );
                        })}
                    </optgroup>
                    {engineerName &&
                      !["Engenheiro 01", "Engenheiro 02", "Engenheiro 03"].includes(engineerName) &&
                      !activeEmployees.some(
                        (e) => (e.nickname ? `${e.name} (${e.nickname})` : e.name) === engineerName || e.name === engineerName
                      ) && (
                        <option value={engineerName}>{engineerName} (Personalizado)</option>
                      )}
                  </select>
                </div>

                {/* Encarregado / Mestre Responsável (Select) */}
                <div className="space-y-1">
                  <Label htmlFor="supSelect" className="text-[11px] font-medium text-muted-foreground">
                    Encarregado / Mestre Responsável
                  </Label>
                  <select
                    id="supSelect"
                    value={supervisorName}
                    onChange={(e) => setSupervisorName(e.target.value)}
                    className="w-full h-8 px-2.5 rounded-md border border-input bg-background text-xs font-medium focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
                  >
                    <option value="">Selecione o Encarregado...</option>
                    {encarregadosList.prioritarios.length > 0 && (
                      <optgroup label="Encarregados & Mestres">
                        {encarregadosList.prioritarios.map((emp) => {
                          const label = emp.nickname ? `${emp.name} (${emp.nickname})` : emp.name;
                          return (
                            <option key={emp.id} value={label}>
                              {label} — {emp.role}
                            </option>
                          );
                        })}
                      </optgroup>
                    )}
                    <optgroup label="Padrão / Frentes">
                      <option value="Encarregado 01">Encarregado 01</option>
                      <option value="Encarregado 02">Encarregado 02</option>
                      <option value="Encarregado 03">Encarregado 03</option>
                    </optgroup>
                    <optgroup label="Todos os Funcionários">
                      {encarregadosList.outros.map((emp) => {
                        const label = emp.nickname ? `${emp.name} (${emp.nickname})` : emp.name;
                        return (
                          <option key={emp.id} value={label}>
                            {label} — {emp.role}
                          </option>
                        );
                      })}
                    </optgroup>
                    {supervisorName &&
                      !["Encarregado 01", "Encarregado 02", "Encarregado 03"].includes(supervisorName) &&
                      !activeEmployees.some(
                        (e) => (e.nickname ? `${e.name} (${e.nickname})` : e.name) === supervisorName || e.name === supervisorName
                      ) && (
                        <option value={supervisorName}>{supervisorName} (Personalizado)</option>
                      )}
                  </select>
                </div>
              </div>

              {/* Equipe Pai / Vinculada (opcional) */}
              {teams.length > 0 && (
                <div className="space-y-1 pt-1 border-t border-border/40">
                  <Label htmlFor="parentTeam" className="text-[11px] font-medium text-muted-foreground">
                    Equipe Líder / Frente Superior (opcional)
                  </Label>
                  <select
                    id="parentTeam"
                    value={parentTeamId}
                    onChange={(e) => setParentTeamId(e.target.value)}
                    className="w-full h-8 px-2.5 rounded-md border border-input bg-background text-xs font-medium focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Nenhuma (Equipe independente)</option>
                    {teams
                      .filter((t) => t.id !== editingTeamId)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.task_description || "Sem tarefa"})
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </div>

            {/* Checkbox: Ocultar da visão diária */}
            <div className="flex items-start gap-2.5 p-2.5 rounded-lg border bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50">
              <input
                type="checkbox"
                id="isHiddenCheck"
                checked={isHidden}
                onChange={(e) => setIsHidden(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
              />
              <div className="flex-1 cursor-pointer" onClick={() => setIsHidden(!isHidden)}>
                <label htmlFor="isHiddenCheck" className="text-xs font-semibold text-foreground cursor-pointer flex items-center gap-1.5">
                  <EyeOff className="h-3.5 w-3.5 text-amber-600" />
                  Ocultar da visualização diária padrão
                </label>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Ideal para equipes com rotina contínua/fixa (como Compras, Almoxarifado, Transporte) que não precisam poluir a escala diária da obra.
                </p>
              </div>
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
              <div className="border rounded-lg p-2 max-h-44 overflow-y-auto space-y-1.5 bg-muted/20">
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
                            onChange={() => {}}
                            className="h-3.5 w-3.5 rounded border-gray-300 text-primary focus:ring-primary pointer-events-none"
                          />
                          <div className="truncate">
                            <span>{emp.nickname ? `${emp.name} (${emp.nickname})` : emp.name}</span>
                            <span className="text-[11px] text-muted-foreground ml-1.5 font-normal">• {emp.role}</span>
                          </div>
                        </div>

                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${att.color}`}>
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
                placeholder="Ex: Reboco do 2º pavimento, passagem de conduítes, compras de insumos..."
                className="w-full text-xs p-2.5 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />

              {/* Task Quick Presets */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="text-[10px] text-muted-foreground font-medium self-center mr-1">Atalhos:</span>
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
                placeholder="Ex: Aguardando chegada de material às 14h"
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
