"use client";

import { useState, useEffect, useMemo } from "react";
import { useStore, Employee, SalaryHistory } from "@/store/useStore";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Plus, Search, Edit2, Trash2, User, UserX, UserCheck, DollarSign,
  ClipboardList, Mail, ArrowUpDown, Hash, Copy, Check, Printer
} from "lucide-react";

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatCpfCnpj(value: string): string {
  const clean = value.replace(/\D/g, "").slice(0, 14);
  if (clean.length <= 11) {
    return clean
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  } else {
    return clean
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
  }
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("pt-BR");
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function subtractDays(dateStr: string, days: number): string {
  return addDays(dateStr, -days);
}

function calcLastWorkDate(emp: Employee): string {
  if (emp.dismissal_type === "empresa_com" && emp.notice_end_date) {
    return subtractDays(emp.notice_end_date, 7);
  }
  if (emp.dismissal_type === "pedido_com" && emp.notice_start_date) {
    return addDays(emp.notice_start_date, 30);
  }
  if ((emp.dismissal_type === "pedido_sem" || emp.dismissal_type === "empresa_sem") && emp.dismissal_date) {
    return emp.dismissal_date;
  }
  return "";
}

function calcWorkedTime(admission: string, end?: string): string {
  if (!admission) return "-";
  const start = new Date(admission + "T00:00:00");
  const finish = end ? new Date(end + "T00:00:00") : new Date();
  const diffMs = finish.getTime() - start.getTime();
  if (diffMs < 0) return "-";
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  const remDays = days % 30;
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} ano${years > 1 ? "s" : ""}`);
  if (months > 0) parts.push(`${months} mês${months > 1 ? "es" : ""}`);
  if (remDays > 0 || parts.length === 0) parts.push(`${remDays} dia${remDays !== 1 ? "s" : ""}`);
  return parts.join(", ");
}

function formatCurrency(val: number | undefined): string {
  if (val === undefined || val === null) return "-";
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const PAGADOR_INFO = {
  BUDDY: { cnpj: "45.689.000/0001-89", nome: "GENECY CONSTRUCOES E SERVICOS LTDA" },
  CASANA: { cnpj: "50.251.097/0001-83", nome: "BUDDY & GENECY CONSTRUTORA LTDA" },
};

// ─── Form State Type ─────────────────────────────────────────────────────────

type FormState = {
  employee_number: string;
  name: string;
  nickname: string;
  cpf: string;
  phone: string;
  role: string;
  team: string;
  admission_date: string;
  employment_type: string;
  pagador: string;
  salary: string;
  pix_type: string;
  pix_key: string;
  salary_family: boolean;
  status: string;
  dismissal_type: string;
  notice_start_date: string;
  notice_end_date: string;
  dismissal_date: string;
  photo_url: string;
};

const defaultForm: FormState = {
  employee_number: "",
  name: "",
  nickname: "",
  cpf: "",
  phone: "",
  role: "",
  team: "Geral",
  admission_date: "",
  employment_type: "",
  pagador: "",
  salary: "",
  pix_type: "",
  pix_key: "",
  salary_family: false,
  status: "ativo",
  dismissal_type: "",
  notice_start_date: "",
  notice_end_date: "",
  dismissal_date: "",
  photo_url: "",
};

const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 200;
        const MAX_HEIGHT = 200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);
        
        const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
        resolve(dataUrl);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

// ─── Main Component ──────────────────────────────────────────────────────────

export default function FuncionariosPage() {
  const { employees, addEmployee, updateEmployee, deleteEmployee, addSalaryHistory } = useStore();

  // ── List state ──
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"number" | "name">("number");
  const [onlyActive, setOnlyActive] = useState(true);

  // ── Main dialog ──
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormState>(defaultForm);
  const [isNewTeam, setIsNewTeam] = useState(false);
  const [isNewRole, setIsNewRole] = useState(false);
  const [activeTab, setActiveTab] = useState<string | number>("pessoal");
  const [isSaving, setIsSaving] = useState(false);

  // ── Salary history modal ──
  const [salaryEmp, setSalaryEmp] = useState<Employee | null>(null);
  const [salaryHistory, setSalaryHistory] = useState<SalaryHistory[]>([]);
  const [salaryForm, setSalaryForm] = useState({ effective_date: "", new_salary: "", notes: "" });
  const [isSalaryLoading, setIsSalaryLoading] = useState(false);
  const [isSalaryDialogOpen, setIsSalaryDialogOpen] = useState(false);

  // ── Checklist modal ──
  const [checklistEmp, setChecklistEmp] = useState<Employee | null>(null);
  const [isChecklistOpen, setIsChecklistOpen] = useState(false);
  const [checklistChecked, setChecklistChecked] = useState<Record<string, boolean>>({});
  const [copySuccess, setCopySuccess] = useState(false);

  // ── Email modal ──
  const [emailEmp, setEmailEmp] = useState<Employee | null>(null);
  const [emailType, setEmailType] = useState<"admissao" | "demissao">("admissao");
  const [isEmailOpen, setIsEmailOpen] = useState(false);
  const [emailText, setEmailText] = useState("");
  const [emailCopySuccess, setEmailCopySuccess] = useState(false);
  const [selectedSignature, setSelectedSignature] = useState<string>("Felipe Moura | Coordenador de Compras e Administrativo");

  // ─── Derived computed values ─────────────────────────────────────────────

  const lastWorkDateCalc = useMemo((): string => {
    const emp = {
      dismissal_type: formData.dismissal_type as Employee["dismissal_type"],
      notice_end_date: formData.notice_end_date,
      notice_start_date: formData.notice_start_date,
      dismissal_date: formData.dismissal_date,
    } as Employee;
    return calcLastWorkDate(emp);
  }, [formData.dismissal_type, formData.notice_end_date, formData.notice_start_date, formData.dismissal_date]);

  const workedTimeCalc = useMemo((): string => {
    if (!formData.admission_date) return "-";
    const endDate = formData.dismissal_date || undefined;
    return calcWorkedTime(formData.admission_date, endDate);
  }, [formData.admission_date, formData.dismissal_date]);

  // ─── Filter & sort ───────────────────────────────────────────────────────

  const filteredEmployees = useMemo(() => {
    const q = searchTerm.toLowerCase();
    const filtered = employees.filter(
      (emp) =>
        (onlyActive ? emp.status !== "inativo" : emp.status === "inativo") && (
          emp.name.toLowerCase().includes(q) ||
          (emp.cpf || "").includes(q) ||
          (emp.role || "").toLowerCase().includes(q)
        )
    );
    if (sortBy === "name") {
      return [...filtered].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    }
    return [...filtered].sort((a, b) => {
      const numA = parseInt(a.employee_number || "", 10);
      const numB = parseInt(b.employee_number || "", 10);
      const isNumA = !isNaN(numA);
      const isNumB = !isNaN(numB);
      
      if (isNumA && isNumB) return numA - numB;
      if (isNumA) return -1;
      if (isNumB) return 1;
      return (a.employee_number || "").localeCompare(b.employee_number || "");
    });
  }, [employees, searchTerm, sortBy, onlyActive]);

  // ─── Dialog helpers ──────────────────────────────────────────────────────

  const defaultTeams = ["Alvenaria", "Elétrica", "Hidráulica", "Acabamento", "Geral"];
  const uniqueTeams = Array.from(new Set([...defaultTeams, ...employees.map((e) => e.team)])).filter(Boolean);

  const defaultRoles = [
    "Ajudante de pedreiro",
    "Pedreiro",
    "Eletricista",
    "Meio profissional",
    "Bomb. Hidráulico (encanador)",
    "Pintor",
    "Carpinteiro",
    "Encarregado de obras",
    "Mestre de obras"
  ];
  const uniqueRoles = Array.from(new Set([...defaultRoles, ...employees.map((e) => e.role)])).filter(Boolean);

  const openAddDialog = () => {
    setEditingId(null);
    setFormData(defaultForm);
    setIsNewTeam(false);
    setIsNewRole(false);
    setActiveTab("pessoal");
    setIsDialogOpen(true);
  };

  const openEditDialog = (emp: Employee) => {
    setEditingId(emp.id);
    setFormData({
      employee_number: emp.employee_number !== undefined ? String(emp.employee_number) : "",
      name: emp.name || "",
      nickname: emp.nickname || "",
      cpf: emp.cpf || "",
      phone: emp.phone || "",
      role: emp.role || "",
      team: emp.team || "",
      admission_date: emp.admission_date ? emp.admission_date.slice(0, 10) : "",
      employment_type: emp.employment_type || "",
      pagador: emp.pagador || "",
      salary: emp.salary !== undefined ? String(emp.salary) : "",
      pix_type: emp.pix_type || "",
      pix_key: emp.pix_key || "",
      salary_family: emp.salary_family || false,
      status: emp.status || "ativo",
      dismissal_type: emp.dismissal_type || "",
      notice_start_date: emp.notice_start_date || "",
      notice_end_date: emp.notice_end_date || "",
      dismissal_date: emp.dismissal_date || "",
      photo_url: emp.photo_url || "",
    });
    setIsNewTeam(false);
    setIsNewRole(false);
    setActiveTab("pessoal");
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.role) {
      alert("Preencha os campos obrigatórios: Nome e Cargo.");
      return;
    }
    setIsSaving(true);

    const payload: Omit<Employee, "id"> = {
      name: formData.name,
      nickname: formData.nickname || undefined,
      cpf: formData.cpf || "",
      phone: formData.phone || "",
      role: formData.role,
      team: formData.team || "Geral",
      admission_date: formData.admission_date || "",
      status: (formData.status as Employee["status"]) || "ativo",
      employee_number: formData.employee_number || undefined,
      employment_type: (formData.employment_type as Employee["employment_type"]) || undefined,
      pagador: (formData.pagador as Employee["pagador"]) || undefined,
      salary: formData.salary ? Number(formData.salary) : undefined,
      pix_type: (formData.pix_type as Employee["pix_type"]) || undefined,
      pix_key: formData.pix_key || undefined,
      salary_family: formData.salary_family,
      dismissal_type: (formData.dismissal_type as Employee["dismissal_type"]) || undefined,
      notice_start_date: formData.notice_start_date || undefined,
      notice_end_date: formData.notice_end_date || undefined,
      last_work_date: lastWorkDateCalc || undefined,
      dismissal_date: formData.dismissal_date || undefined,
      photo_url: formData.photo_url || undefined,
    };

    if (editingId) {
      await updateEmployee(editingId, payload);
    } else {
      await addEmployee(payload);
    }
    setIsSaving(false);
    setIsDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    if (
      confirm(
        "Tem certeza que deseja apagar o registro deste funcionário? ATENÇÃO: Isso também apagará todo o histórico de presenças. Prefira usar 'Demitir' para manter o histórico."
      )
    ) {
      deleteEmployee(id);
    }
  };

  const handleFire = (emp: Employee) => {
    openEditDialog(emp);
    setActiveTab("desligamento");
  };

  // ─── Status badge ────────────────────────────────────────────────────────

  function StatusBadge({ status }: { status: string }) {
    if (status === "ativo") {
      return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-transparent">Ativo</Badge>;
    }
    if (status === "aviso_previo") {
      return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white border-transparent">Aviso Prévio</Badge>;
    }
    return <Badge className="bg-orange-500 hover:bg-orange-600 text-white border-transparent">Demitido</Badge>;
  }

  // ─── Salary History ──────────────────────────────────────────────────────

  const openSalaryDialog = async (emp: Employee) => {
    setSalaryEmp(emp);
    setSalaryForm({ effective_date: "", new_salary: "", notes: "" });
    setIsSalaryLoading(true);
    setIsSalaryDialogOpen(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("salary_history")
      .select("*")
      .eq("employee_id", emp.id)
      .order("effective_date", { ascending: false });
    if (error) console.error("Error fetching salary history:", error);
    setSalaryHistory(data || []);
    setIsSalaryLoading(false);
  };

  const handleAddSalary = async () => {
    if (!salaryEmp || !salaryForm.effective_date || !salaryForm.new_salary) {
      alert("Preencha a data efetiva e o novo salário.");
      return;
    }
    const newSal = Number(salaryForm.new_salary);
    const oldSal = salaryEmp.salary || 0;
    await addSalaryHistory({
      employee_id: salaryEmp.id,
      old_salary: oldSal,
      new_salary: newSal,
      effective_date: salaryForm.effective_date,
      notes: salaryForm.notes || undefined,
    });
    await updateEmployee(salaryEmp.id, { salary: newSal });
    setSalaryEmp({ ...salaryEmp, salary: newSal });
    setSalaryForm({ effective_date: "", new_salary: "", notes: "" });
    // Refresh list
    const supabase = createClient();
    const { data } = await supabase
      .from("salary_history")
      .select("*")
      .eq("employee_id", salaryEmp.id)
      .order("effective_date", { ascending: false });
    setSalaryHistory(data || []);
  };

  // ─── Checklist ───────────────────────────────────────────────────────────

  const DOCS_ADMISSAO = [
    { k: "id", t: "IDENTIDADE (RG)", obs: "" },
    { k: "cpf", t: "CPF", obs: "" },
    { k: "reservista", t: "RESERVISTA", obs: "SE TIVER" },
    { k: "titulo", t: "TÍTULO ELEITORAL", obs: "" },
    { k: "ctps", t: "CARTEIRA DE TRABALHO", obs: "FÍSICA OU DIGITAL EM PDF" },
    { k: "certidao", t: "CERTIDÃO DE NASCIMENTO OU CASAMENTO", obs: "" },
    { k: "residencia", t: "COMPROVANTE DE RESIDÊNCIA", obs: "" },
    { k: "filhos", t: "CERTIDÃO DE NASCIMENTO DOS FILHOS ATÉ 14 ANOS", obs: "SALÁRIO-FAMÍLIA — SOMENTE AJUDANTES" }
  ];

  const openChecklist = (emp: Employee) => {
    setChecklistEmp(emp);
    const saved = localStorage.getItem(`checklist_docs_${emp.id}`);
    if (saved) {
      try {
        setChecklistChecked(JSON.parse(saved));
      } catch (e) {
        setChecklistChecked({});
      }
    } else {
      setChecklistChecked({});
    }
    setCopySuccess(false);
    setIsChecklistOpen(true);
  };

  const toggleDoc = (k: string, checked: boolean) => {
    if (!checklistEmp) return;
    const newChecked = { ...checklistChecked, [k]: checked };
    setChecklistChecked(newChecked);
    localStorage.setItem(`checklist_docs_${checklistEmp.id}`, JSON.stringify(newChecked));
  };

  const printChecklist = () => {
    if (!checklistEmp) return;
    const ehAjudante = (checklistEmp.role || "").toLowerCase().includes("ajudante") || !!checklistEmp.salary_family;
    const items = DOCS_ADMISSAO.filter(d => d.k !== "filhos" || ehAjudante);
    
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`
      <html>
        <head>
          <title>Checklist - ${checklistEmp.name}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 30px; color: #111; }
            h2 { margin: 0 0 10px 0; }
            p { margin: 0 0 20px 0; color: #555; }
            ul { list-style: none; padding: 0; }
            li { margin: 12px 0; font-size: 16px; display: flex; align-items: center; gap: 10px; }
            small { color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <h2>Checklist de Documentação — Admissão</h2>
          <p><b>${checklistEmp.name}</b>${checklistEmp.role ? ` · ${checklistEmp.role}` : ""}</p>
          <ul>
            ${items.map(d => `<li>⬜ ${d.t} ${d.obs ? `<small>(${d.obs})</small>` : ""}</li>`).join("")}
          </ul>
        </body>
      </html>
    `);
    w.document.close();
    w.print();
  };

  const generateWhatsappMessage = async () => {
    if (!checklistEmp) return;
    const ehAjudante = (checklistEmp.role || "").toLowerCase().includes("ajudante") || !!checklistEmp.salary_family;
    const items = DOCS_ADMISSAO.filter(d => d.k !== "filhos" || ehAjudante)
      .map(d => `• ${d.t}${d.obs ? ` (${d.obs})` : ""}`)
      .join("\n");
    const nicknamePart = checklistEmp.nickname ? `, ${checklistEmp.nickname}` : "";
    const msg = `Olá${nicknamePart}! Seja bem-vindo(a) à equipe. 🙌\n\nPara concluir sua admissão, precisamos dos seguintes documentos (foto legível ou PDF):\n\n${items}\n\nPode nos enviar por aqui assim que possível. Qualquer dúvida, estamos à disposição!`;
    
    await navigator.clipboard.writeText(msg);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  // ─── Email generator ─────────────────────────────────────────────────────

  function buildAdmissaoEmail(emp: Employee, signature: string): string {
    const pagadorInfo = emp.pagador ? PAGADOR_INFO[emp.pagador] : null;
    return `Assunto: Solicitação de Admissão - ${emp.name}

Prezados,

Solicitamos a admissão do(a) Sr(a). ${emp.name}
Cargo: ${emp.role || ""}
Data de Admissão: ${formatDate(emp.admission_date)}
Salário: ${formatCurrency(emp.salary)}
Tipo de Contrato: ${emp.employment_type || ""}

Observações:
[CAMPO LIVRE]

Atenciosamente,
${signature}
${pagadorInfo ? pagadorInfo.nome : ""}
CNPJ: ${pagadorInfo ? pagadorInfo.cnpj : ""}`;
  }

  function buildDemissaoEmail(emp: Employee, signature: string): string {
    const lastWork = calcLastWorkDate(emp);
    const situacaoMap: Record<string, string> = {
      pedido_com: "Pedido de demissão — com aviso",
      pedido_sem: "Pedido de demissão — sem aviso",
      empresa_com: "Demissão pela empresa — com aviso",
      empresa_sem: "Demissão pela empresa — sem aviso (indenizado)",
    };
    const isNotice = emp.dismissal_type === "pedido_com" || emp.dismissal_type === "empresa_com";
    return `Assunto: Solicitação de ${isNotice ? "Aviso Prévio" : "Demissão"} - ${emp.name}

Prezados,

Comunicamos o desligamento do(a) Sr(a). ${emp.name}
Cargo: ${emp.role || ""}
Situação: ${emp.dismissal_type ? situacaoMap[emp.dismissal_type] || "" : ""}
Data do Aviso: ${formatDate(emp.notice_start_date)}
Último Dia de Aviso: ${formatDate(emp.notice_end_date)}
Último Dia de Trabalho: ${formatDate(lastWork)}

Relatório de Presença:
[CAMPO LIVRE]

Descontos/Valores já pagos:
[CAMPO LIVRE]

Observações:
[CAMPO LIVRE]

Atenciosamente,
${signature}`;
  }

  const openEmailDialog = (emp: Employee, type: "admissao" | "demissao") => {
    setEmailEmp(emp);
    setEmailType(type);
    setEmailText(type === "admissao" ? buildAdmissaoEmail(emp, selectedSignature) : buildDemissaoEmail(emp, selectedSignature));
    setEmailCopySuccess(false);
    setIsEmailOpen(true);
  };

  const copyEmail = async () => {
    await navigator.clipboard.writeText(emailText);
    setEmailCopySuccess(true);
    setTimeout(() => setEmailCopySuccess(false), 2000);
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Funcionários</h1>
          <p className="text-muted-foreground mt-1">Gerencie os trabalhadores da obra.</p>
        </div>
        <Button onClick={openAddDialog} className="bg-primary hover:bg-primary/90 text-white">
          <Plus className="mr-2 h-4 w-4" /> Novo Funcionário
        </Button>
      </div>

      {/* Tabs for Ativos vs Demitidos */}
      <Tabs defaultValue="ativos" value={onlyActive ? "ativos" : "demitidos"} onValueChange={(v) => setOnlyActive(v === "ativos")} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="ativos" className="font-semibold">Funcionários Ativos</TabsTrigger>
          <TabsTrigger value="demitidos" className="font-semibold">Funcionários Demitidos</TabsTrigger>
        </TabsList>

        {/* List Card */}
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>
              {onlyActive ? "Lista de Funcionários Ativos" : "Lista de Funcionários Demitidos"}
            </CardTitle>
            <div className="flex flex-col sm:flex-row gap-3 pt-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, CPF/CNPJ ou cargo..."
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortBy(sortBy === "number" ? "name" : "number")}
                className="whitespace-nowrap"
              >
                <ArrowUpDown className="mr-2 h-4 w-4" />
                {sortBy === "number" ? "Ordenar por Nome" : "Ordenar por Nº"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50 dark:bg-slate-900">
                  <TableRow>
                    <TableHead className="w-12"><Hash className="h-4 w-4" /></TableHead>
                    <TableHead>Nome</TableHead>
                  <TableHead className="hidden lg:table-cell">Cargo</TableHead>
                  <TableHead className="hidden xl:table-cell">Pagador</TableHead>
                  <TableHead className="hidden xl:table-cell">Tipo</TableHead>
                  <TableHead className="hidden lg:table-cell">Salário</TableHead>
                  <TableHead className="hidden md:table-cell">Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      Nenhum funcionário encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEmployees.map((emp) => (
                    <TableRow key={emp.id} className={emp.status === "inativo" ? "opacity-60" : ""}>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {emp.employee_number ?? "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="relative size-10 rounded-full border bg-muted flex items-center justify-center overflow-hidden shrink-0">
                            {emp.photo_url ? (
                              <img src={emp.photo_url} alt={emp.name} className="size-full object-cover" />
                            ) : (
                              <User className="size-5 text-muted-foreground" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium">{emp.name}</p>
                            {emp.nickname && <p className="text-xs text-muted-foreground">{emp.nickname}</p>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm">{emp.role || "-"}</TableCell>
                      <TableCell className="hidden xl:table-cell">
                        {emp.pagador ? (
                          <Badge
                            className={
                              emp.pagador === "BUDDY"
                                ? "bg-blue-500 hover:bg-blue-600 text-white border-transparent"
                                : "bg-emerald-600 hover:bg-emerald-700 text-white border-transparent"
                            }
                          >
                            {emp.pagador}
                          </Badge>
                        ) : "-"}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell text-sm">{emp.employment_type || "-"}</TableCell>
                      <TableCell className="hidden lg:table-cell text-sm">{formatCurrency(emp.salary)}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        <StatusBadge status={emp.status || "ativo"} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-0.5 flex-wrap">
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(emp)} title="Editar">
                            <Edit2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openSalaryDialog(emp)}
                            title="Histórico Salarial"
                          >
                            <DollarSign className="h-4 w-4 text-emerald-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openChecklist(emp)}
                            title="Checklist de Documentos"
                          >
                            <ClipboardList className="h-4 w-4 text-blue-500" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEmailDialog(emp, emp.status === "inativo" || emp.status === "aviso_previo" ? "demissao" : "admissao")}
                            title="Gerar E-mail"
                          >
                            <Mail className="h-4 w-4 text-purple-500" />
                          </Button>
                          {emp.status === "ativo" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleFire(emp)}
                              title="Demitir / Aviso Prévio"
                            >
                              <UserX className="h-4 w-4 text-orange-500" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      </Tabs>

      {/* ── Main Add/Edit Dialog ── */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[620px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Funcionário" : "Novo Funcionário"}</DialogTitle>
          </DialogHeader>

          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v)}
          >
            <TabsList className="w-full">
              <TabsTrigger value="pessoal" className="flex-1">Dados Pessoais</TabsTrigger>
              <TabsTrigger value="financeiro" className="flex-1">Financeiro</TabsTrigger>
              {editingId && (
                <TabsTrigger value="desligamento" className="flex-1">Desligamento</TabsTrigger>
              )}
            </TabsList>

            {/* ── Aba 1: Dados Pessoais ── */}
            <TabsContent value="pessoal">
              <div className="grid gap-4 py-4">
                {/* Foto */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right text-sm">Foto</Label>
                  <div className="col-span-3 flex items-center gap-4">
                    <div className="relative size-16 rounded-full border bg-muted flex items-center justify-center overflow-hidden">
                      {formData.photo_url ? (
                        <img src={formData.photo_url} alt="Foto Preview" className="size-full object-cover" />
                      ) : (
                        <span className="text-xs text-muted-foreground">Sem foto</span>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Input
                        type="file"
                        accept="image/*"
                        className="text-xs max-w-xs cursor-pointer"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            try {
                              const base64 = await compressImage(file);
                              setFormData({ ...formData, photo_url: base64 });
                            } catch (err) {
                              console.error(err);
                              alert("Erro ao processar imagem.");
                            }
                          }
                        }}
                      />
                      {formData.photo_url && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 w-fit text-xs text-red-500 hover:text-red-600 hover:bg-red-50 p-0"
                          onClick={() => setFormData({ ...formData, photo_url: "" })}
                        >
                          Remover foto
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                {/* Nº Contabilidade */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right text-sm">Nº Contab.</Label>
                  <Input
                    type="text"
                    className="col-span-3"
                    placeholder="Ex: 42, S/N ou 0"
                    value={formData.employee_number}
                    onChange={(e) => setFormData({ ...formData, employee_number: e.target.value })}
                  />
                </div>
                {/* Nome */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right text-sm">Nome *</Label>
                  <Input
                    className="col-span-3"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                {/* Apelido */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right text-sm">Apelido</Label>
                  <Input
                    className="col-span-3"
                    value={formData.nickname}
                    onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                  />
                </div>
                {/* CPF / CNPJ */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right text-sm">CPF/CNPJ *</Label>
                  <Input
                    className="col-span-3"
                    placeholder="000.000.000-00 ou 00.000.000/0000-00"
                    value={formData.cpf}
                    onChange={(e) => setFormData({ ...formData, cpf: formatCpfCnpj(e.target.value) })}
                  />
                </div>
                {/* Telefone */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right text-sm">Telefone</Label>
                  <Input
                    className="col-span-3"
                    placeholder="(00) 00000-0000"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                {/* Cargo */}
                <div className="grid grid-cols-4 items-start gap-4">
                  <Label className="text-right text-sm pt-2">Cargo *</Label>
                  <div className="col-span-3 space-y-2">
                    <Select
                      value={isNewRole ? "novo_cargo" : formData.role}
                      onValueChange={(v) => {
                        if (v === "novo_cargo") {
                          setIsNewRole(true);
                          setFormData({ ...formData, role: "" });
                        } else {
                          setIsNewRole(false);
                          setFormData({ ...formData, role: v || "" });
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o cargo" />
                      </SelectTrigger>
                      <SelectContent>
                        {uniqueRoles.map((r) => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                        <SelectItem value="novo_cargo" className="text-emerald-600 font-medium">
                          + Adicionar novo cargo
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    {isNewRole && (
                      <Input
                        placeholder="Digite o nome do novo cargo"
                        value={formData.role}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                        autoFocus
                      />
                    )}
                  </div>
                </div>

                {/* Data de Admissão */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right text-sm">Admissão</Label>
                  <Input
                    type="date"
                    className="col-span-3"
                    value={formData.admission_date}
                    onChange={(e) => setFormData({ ...formData, admission_date: e.target.value })}
                  />
                </div>
              </div>
            </TabsContent>

            {/* ── Aba 2: Financeiro ── */}
            <TabsContent value="financeiro">
              <div className="grid gap-4 py-4">
                {/* Tipo de Vínculo */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right text-sm">Vínculo</Label>
                  <Select
                    value={formData.employment_type}
                    onValueChange={(v) => {
                      const newType = v || "";
                      const defaultNum = (newType === "Avulso" || newType === "PJ") ? "S/N" : formData.employee_number;
                      setFormData({
                        ...formData,
                        employment_type: newType,
                        employee_number: defaultNum,
                        ...(newType === "PJ" ? { salary_family: false } : {}),
                      });
                    }}
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Tipo de contrato" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CLT">CLT</SelectItem>
                      <SelectItem value="PJ">PJ (Pessoa Jurídica)</SelectItem>
                      <SelectItem value="Avulso">Avulso</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {/* Pagador */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right text-sm">Pagador</Label>
                  <Select
                    value={formData.pagador}
                    onValueChange={(v) => setFormData({ ...formData, pagador: v || "" })}
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Selecione o pagador" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BUDDY">
                        BUDDY — GENECY CONSTRUCOES (CNPJ 45.689.000/0001-89)
                      </SelectItem>
                      <SelectItem value="CASANA">
                        CASANA — BUDDY &amp; GENECY CONSTRUTORA (CNPJ 50.251.097/0001-83)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                 {/* Salário / Diária */}
                 <div className="grid grid-cols-4 items-center gap-4">
                   <Label className="text-right text-sm">
                     {formData.employment_type === "Avulso" ? "Diária (R$)" : "Salário (R$)"}
                   </Label>
                   <Input
                     type="number"
                     step="0.01"
                     className="col-span-3"
                     placeholder={formData.employment_type === "Avulso" ? "Valor da diária" : "0,00"}
                     value={formData.salary}
                     onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                   />
                 </div>
                 {/* Tipo de Chave PIX */}
                 <div className="grid grid-cols-4 items-center gap-4">
                   <Label className="text-right text-sm">Tipo PIX</Label>
                   <Select
                     value={formData.pix_type}
                     onValueChange={(v) => setFormData({ ...formData, pix_type: v || "" })}
                   >
                     <SelectTrigger className="col-span-3">
                       <SelectValue placeholder="Tipo de chave PIX" />
                     </SelectTrigger>
                     <SelectContent>
                       <SelectItem value="CPF">CPF</SelectItem>
                       <SelectItem value="CNPJ">CNPJ</SelectItem>
                       <SelectItem value="Telefone">Telefone</SelectItem>
                       <SelectItem value="Email">E-mail</SelectItem>
                       <SelectItem value="Aleatoria">Chave Aleatória</SelectItem>
                     </SelectContent>
                   </Select>
                 </div>
                 {/* Chave PIX */}
                 <div className="grid grid-cols-4 items-center gap-4">
                   <Label className="text-right text-sm">Chave PIX</Label>
                   <Input
                     className="col-span-3"
                     placeholder="Informe a chave PIX"
                     value={formData.pix_key}
                     onChange={(e) => setFormData({ ...formData, pix_key: e.target.value })}
                   />
                 </div>
                 {/* Salário Família */}
                 {formData.employment_type !== "PJ" && (
                   <div className="grid grid-cols-4 items-center gap-4">
                     <Label className="text-right text-sm">Salário Família</Label>
                     <div className="col-span-3 flex items-center gap-2">
                       <input
                         type="checkbox"
                         id="salary_family"
                         className="h-4 w-4 rounded"
                         checked={formData.salary_family}
                         onChange={(e) => setFormData({ ...formData, salary_family: e.target.checked })}
                       />
                       <Label htmlFor="salary_family" className="text-sm cursor-pointer">
                         Recebe Salário Família (somente ajudantes)
                       </Label>
                     </div>
                   </div>
                 )}
               </div>
             </TabsContent>

            {/* ── Aba 3: Desligamento (só no modo edição) ── */}
            {editingId && (
              <TabsContent value="desligamento">
                <div className="grid gap-4 py-4">
                  {/* Status */}
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right text-sm">Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(v) => setFormData({ ...formData, status: v || "ativo" })}
                    >
                      <SelectTrigger className="col-span-3 flex justify-between items-center text-left">
                        <span>
                          {formData.status === "ativo" && "Ativo"}
                          {formData.status === "aviso_previo" && "Em Aviso Prévio"}
                          {formData.status === "inativo" && (formData.employment_type === "Avulso" ? "Inativo" : "Demitido")}
                          {!formData.status && "Status do funcionário"}
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ativo">Ativo</SelectItem>
                        {formData.employment_type !== "Avulso" && (
                          <SelectItem value="aviso_previo">Em Aviso Prévio</SelectItem>
                        )}
                        <SelectItem value="inativo">
                          {formData.employment_type === "Avulso" ? "Inativo" : "Demitido"}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.employment_type !== "Avulso" && (
                    <>
                      {/* Tipo de Demissão */}
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right text-sm">Tipo</Label>
                        <Select
                          value={formData.dismissal_type}
                          onValueChange={(v) => setFormData({ ...formData, dismissal_type: v || "" })}
                        >
                          <SelectTrigger className="col-span-3 flex justify-between items-center text-left">
                            <span>
                              {formData.dismissal_type === "pedido_com" && "Pedido de demissão — com aviso"}
                              {formData.dismissal_type === "pedido_sem" && "Pedido de demissão — sem aviso"}
                              {formData.dismissal_type === "empresa_com" && "Demissão pela empresa — com aviso"}
                              {formData.dismissal_type === "empresa_sem" && "Demissão pela empresa — sem aviso (indenizado)"}
                              {!formData.dismissal_type && "Tipo de demissão"}
                            </span>
                          </SelectTrigger>
                          <SelectContent className="w-fit max-w-lg">
                            <SelectItem value="pedido_com">Pedido de demissão — com aviso</SelectItem>
                            <SelectItem value="pedido_sem">Pedido de demissão — sem aviso</SelectItem>
                            <SelectItem value="empresa_com">Demissão pela empresa — com aviso</SelectItem>
                            <SelectItem value="empresa_sem">Demissão pela empresa — sem aviso (indenizado)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {/* Data início e fim aviso (se com aviso) */}
                      {(formData.dismissal_type === "pedido_com" || formData.dismissal_type === "empresa_com") && (
                        <>
                          <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right text-sm">Início Aviso</Label>
                            <Input
                              type="date"
                              className="col-span-3"
                              value={formData.notice_start_date}
                              onChange={(e) => setFormData({ ...formData, notice_start_date: e.target.value })}
                            />
                          </div>
                          <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right text-sm">Fim Aviso</Label>
                            <Input
                              type="date"
                              className="col-span-3"
                              value={formData.notice_end_date}
                              onChange={(e) => setFormData({ ...formData, notice_end_date: e.target.value })}
                            />
                          </div>
                        </>
                      )}
                      {/* Último Dia de Trabalho (calculado) */}
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right text-sm text-muted-foreground">Últ. Dia Trab.</Label>
                        <div className="col-span-3">
                          <Input
                            readOnly
                            value={lastWorkDateCalc ? formatDate(lastWorkDateCalc) : "—"}
                            className="bg-muted cursor-not-allowed text-muted-foreground"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            {formData.dismissal_type === "empresa_com" && "Fim do aviso − 7 dias corridos"}
                            {formData.dismissal_type === "pedido_com" && "Início do aviso + 30 dias corridos"}
                            {(formData.dismissal_type === "pedido_sem" || formData.dismissal_type === "empresa_sem") && "Igual à data de demissão direta"}
                          </p>
                        </div>
                      </div>
                      {/* Data de demissão direta (sem aviso) */}
                      {(formData.dismissal_type === "pedido_sem" || formData.dismissal_type === "empresa_sem") && (
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label className="text-right text-sm">Data Demissão</Label>
                          <Input
                            type="date"
                            className="col-span-3"
                            value={formData.dismissal_date}
                            onChange={(e) => setFormData({ ...formData, dismissal_date: e.target.value })}
                          />
                        </div>
                      )}
                      {/* Tempo trabalhado */}
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right text-sm text-muted-foreground">Tempo Trab.</Label>
                        <div className="col-span-3">
                          <Input
                            readOnly
                            value={workedTimeCalc}
                            className="bg-muted cursor-not-allowed text-muted-foreground"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Calculado desde a admissão até hoje (ou data de demissão).
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </TabsContent>
            )}
          </Tabs>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Salary History Dialog ── */}
      <Dialog open={isSalaryDialogOpen} onOpenChange={setIsSalaryDialogOpen}>
        <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Histórico Salarial — {salaryEmp?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Salário atual */}
            <div className="rounded-lg bg-muted p-3 text-sm">
              Salário atual:{" "}
              <span className="font-semibold">{formatCurrency(salaryEmp?.salary)}</span>
            </div>

            {/* Lista de histórico */}
            {isSalaryLoading ? (
              <p className="text-sm text-muted-foreground">Carregando histórico...</p>
            ) : salaryHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum aumento registrado ainda.</p>
            ) : (
              <div className="rounded-md border divide-y">
                {salaryHistory.map((h) => (
                  <div key={h.id} className="flex justify-between items-start p-3 text-sm">
                    <div>
                      <p className="font-medium">{formatDate(h.effective_date)}</p>
                      {h.notes && <p className="text-xs text-muted-foreground mt-0.5">{h.notes}</p>}
                    </div>
                    <div className="text-right">
                      <p className="text-muted-foreground line-through text-xs">
                        {formatCurrency(h.old_salary)}
                      </p>
                      <p className="font-semibold text-emerald-600">{formatCurrency(h.new_salary)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Formulário novo aumento */}
            <div className="rounded-lg border p-4 space-y-3">
              <h4 className="text-sm font-semibold">Registrar Novo Salário</h4>
              <div className="grid gap-3">
                <div>
                  <Label className="text-xs">Data Efetiva *</Label>
                  <Input
                    type="date"
                    value={salaryForm.effective_date}
                    onChange={(e) => setSalaryForm({ ...salaryForm, effective_date: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Novo Salário (R$) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={salaryForm.new_salary}
                    onChange={(e) => setSalaryForm({ ...salaryForm, new_salary: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Observações</Label>
                  <Input
                    placeholder="Ex: Aumento por mérito"
                    value={salaryForm.notes}
                    onChange={(e) => setSalaryForm({ ...salaryForm, notes: e.target.value })}
                  />
                </div>
              </div>
              <Button onClick={handleAddSalary} size="sm" className="w-full">
                Registrar Aumento
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSalaryDialogOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Checklist Dialog ── */}
      <Dialog open={isChecklistOpen} onOpenChange={setIsChecklistOpen}>
        <DialogContent className="sm:max-w-4xl p-6">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-xl font-bold">
              Documentação — {checklistEmp?.name}
            </DialogTitle>
          </DialogHeader>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-3">
            {/* Coluna Esquerda: Checklist */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold tracking-wider uppercase text-blue-600 dark:text-blue-500">
                Checklist de documentos para admissão
              </h3>
              <div className="flex flex-col gap-2">
                {checklistEmp && DOCS_ADMISSAO.filter(d => d.k !== "filhos" || (checklistEmp.role || "").toLowerCase().includes("ajudante") || !!checklistEmp.salary_family).map((doc) => {
                  const isChecked = !!checklistChecked[doc.k];
                  return (
                    <label
                      key={doc.k}
                      className={`flex items-start gap-3 py-2 px-3 border rounded-lg cursor-pointer transition-colors ${
                        isChecked 
                          ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-300" 
                          : "bg-slate-50 dark:bg-slate-900/45 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-300 hover:border-slate-350 dark:hover:border-slate-700"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 mt-0.5 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-emerald-600 focus:ring-emerald-500 focus:ring-offset-slate-900"
                        checked={isChecked}
                        onChange={(e) => toggleDoc(doc.k, e.target.checked)}
                      />
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold tracking-wide">{doc.t}</span>
                        {doc.obs && <span className="text-[11px] opacity-75 mt-0.5 leading-snug">{doc.obs}</span>}
                      </div>
                    </label>
                  );
                })}
              </div>
              
              <div className="flex gap-2 pt-2">
                <Button 
                  onClick={generateWhatsappMessage} 
                  className="bg-blue-600 hover:bg-blue-700 text-white flex-1 font-semibold"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  {copySuccess ? "Copiado!" : "Gerar MSG WhatsApp"}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={printChecklist}
                  className="border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold"
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Imprimir / PDF
                </Button>
              </div>
            </div>
            
            {/* Coluna Direita: Fluxo */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold tracking-wider uppercase text-blue-600 dark:text-blue-500">
                Fluxo de Admissão (RH)
              </h3>
              <div className="space-y-2.5">
                {[
                  "Captação de funcionários pelo Mestre de Obras.",
                  "Leitura e assinatura do Regimento Interno da empresa pelo funcionário na própria obra.",
                  "Contato inicial com o funcionário e envio do checklist de documentos necessários.",
                  "Recebimento de documentos, digitalização e anexação na pasta correspondente no Google Drive.",
                  "Cadastro do funcionário no sistema (este aplicativo).",
                  "Geração e envio do e-mail de admissão para a contabilidade.",
                  "Recebimento dos documentos da contabilidade, download, arquivamento no Drive e impressão.",
                  "Coleta de assinaturas do funcionário e do empregador, digitalização e arquivamento dos documentos assinados no Drive.",
                  "Envio de retorno à contabilidade respondendo ao mesmo e-mail com as cópias assinadas. Funcionário admitido com sucesso!"
                ].map((step, idx) => (
                  <div key={idx} className="flex gap-3 items-start border-b border-dashed border-slate-150 dark:border-slate-800 pb-2.5 last:border-0">
                    <span className="flex items-center justify-center h-5.5 w-5.5 rounded-full bg-blue-600 dark:bg-blue-700 text-white text-xs font-bold shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <p className="text-[13px] text-slate-700 dark:text-slate-350 leading-relaxed font-medium">{step}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setIsChecklistOpen(false)} className="border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold">
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Email Generator Dialog ── */}
      <Dialog open={isEmailOpen} onOpenChange={setIsEmailOpen}>
        <DialogContent className="sm:max-w-[620px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {emailType === "admissao" ? "E-mail de Admissão" : "E-mail de Demissão"} — {emailEmp?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            {emailEmp && (
              <div className="flex flex-col sm:flex-row gap-3 items-center">
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={emailType === "admissao" ? "default" : "outline"}
                    onClick={() => {
                      setEmailType("admissao");
                      setEmailText(buildAdmissaoEmail(emailEmp, selectedSignature));
                    }}
                  >
                    E-mail Admissão
                  </Button>
                  <Button
                    size="sm"
                    variant={emailType === "demissao" ? "default" : "outline"}
                    onClick={() => {
                      setEmailType("demissao");
                      setEmailText(buildDemissaoEmail(emailEmp, selectedSignature));
                    }}
                  >
                    E-mail Demissão
                  </Button>
                </div>
                <div className="flex-1 w-full">
                   <Select
                    value={selectedSignature}
                    onValueChange={(v) => {
                      const sig = v || "";
                      setSelectedSignature(sig);
                      setEmailText(
                        emailType === "admissao"
                          ? buildAdmissaoEmail(emailEmp, sig)
                          : buildDemissaoEmail(emailEmp, sig)
                      );
                    }}
                  >
                    <SelectTrigger className="w-full flex justify-between items-center text-left text-xs h-9">
                      <span>
                        {selectedSignature === "Felipe Moura | Coordenador de Compras e Administrativo" && "Assinatura: Felipe Moura"}
                        {selectedSignature === "Iana Raissa | Analista de RH e Financeiro" && "Assinatura: Iana Raissa"}
                        {!selectedSignature && "Selecione a assinatura"}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Felipe Moura | Coordenador de Compras e Administrativo">
                        Felipe Moura | Coordenador de Compras e Administrativo
                      </SelectItem>
                      <SelectItem value="Iana Raissa | Analista de RH e Financeiro">
                        Iana Raissa | Analista de RH e Financeiro
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <textarea
              className="w-full h-64 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-ring"
              value={emailText}
              onChange={(e) => setEmailText(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Edite o template acima antes de copiar. Preencha os campos marcados com [CAMPO LIVRE].
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button onClick={copyEmail} className="gap-2">
              {emailCopySuccess ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {emailCopySuccess ? "Copiado!" : "Copiar E-mail"}
            </Button>
            <Button variant="outline" onClick={() => setIsEmailOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
