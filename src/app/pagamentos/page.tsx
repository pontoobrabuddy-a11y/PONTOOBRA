"use client";

import { useState, useEffect, useMemo } from "react";
import { useStore } from "@/store/useStore";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle, Clock, AlertCircle, Plus, Wallet, Trash2 } from "lucide-react";

// ─── Types locais (compatíveis com o que o useStore deve exportar) ────────────

interface Employee {
  id: string;
  name: string;
  cpf?: string;
  phone?: string;
  role?: string;
  admission_date?: string;
  status: string;
  team?: string;
  // campos novos
  employee_number?: string;
  salary?: number;
  pagador?: "BUDDY" | "CASANA";
  employment_type?: "CLT" | "PJ" | "MEI" | "Avulso";
  pix_key?: string;
  pix_type?: string;
}

interface Payment {
  id: string;
  employee_id: string;
  month: number;
  year: number;
  quinzena?: 1 | 2;
  type: "casana_q1" | "casana_q2" | "buddy_mensal";
  valor_base: number;
  valor_contabilidade?: number;
  desconto?: number;
  valor_pago?: number;
  paid_at?: string;
  status: "pendente" | "pago";
}

interface Tax {
  id: string;
  name: string;
  empresa: "BUDDY" | "CASANA" | "AMBAS";
  valor: number;
  vencimento: string;
  paid_at?: string;
  competencia_mes: number;
  competencia_ano: number;
  status: "pago" | "vencido" | "a_vencer" | "pendente";
  isVirtual?: boolean;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const ANOS = [2024, 2025, 2026, 2027];

const BUDDY_EMPRESA = "GENECY CONSTRUCOES E SERVICOS LTDA";
const BUDDY_CNPJ = "45.689.000/0001-89";
const CASANA_EMPRESA = "BUDDY & GENECY CONSTRUTORA LTDA";
const CASANA_CNPJ = "50.251.097/0001-83";

const PREDEFINED_TAXES = [
  "GFD - Guia do FGTS Digital",
  "Guia do INSS DARF",
  "Guia do SIMPLES NACIONAL DASN"
];

const IMPOSTOS_SUGERIDOS = [
  ...PREDEFINED_TAXES,
  "GFD - Guia FGTS Digital",
  "DARF INSS",
  "Simples Nacional",
  "DARF CSLL",
  "DARF IRPJ",
  "ISS",
];

function formatMoney(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function getTodayISO() {
  return new Date().toISOString().split("T")[0];
}

function getTaxStatus(tax: Tax & { isVirtual?: boolean }): "pago" | "vencido" | "a_vencer" | "pendente" {
  if (tax.isVirtual) return "pendente";
  if (tax.paid_at) return "pago";
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const venc = new Date(tax.vencimento + "T12:00:00Z");
  if (venc < hoje) return "vencido";
  return "a_vencer";
}

// ─── Dialog de confirmação de pagamento ──────────────────────────────────────

interface PagarDialogProps {
  open: boolean;
  onClose: () => void;
  titulo: string;
  descricao: string;
  onConfirm: (dataPagamento: string) => void;
}

function PagarDialog({ open, onClose, titulo, descricao, onConfirm }: PagarDialogProps) {
  const [dataPagamento, setDataPagamento] = useState(getTodayISO());

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{descricao}</p>
        <div className="space-y-2">
          <Label htmlFor="data-pagamento">Data do Pagamento</Label>
          <Input
            id="data-pagamento"
            type="date"
            value={dataPagamento}
            onChange={(e) => setDataPagamento(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              onConfirm(dataPagamento);
              onClose();
            }}
          >
            <CheckCircle className="size-4" />
            Confirmar Pagamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PagamentosPage() {
  const { 
    employees: rawEmployees,
    payments: storePayments,
    taxes: storeTaxes,
    attendance,
    addPayment,
    updatePayment,
    deletePayment,
    addTax,
    updateTax,
    deleteTax
  } = useStore();
  const employees = rawEmployees as Employee[];

  const hoje = new Date();
  const [mesSelecionado, setMesSelecionado] = useState(hoje.getMonth() + 1);
  const [anoSelecionado, setAnoSelecionado] = useState(hoje.getFullYear());

  const getDaysWorked = (employeeId: string, month: number, year: number, startDay: number, endDay: number) => {
    let days = 0;
    const prefix = `${year}-${String(month).padStart(2, "0")}-`;
    Object.keys(attendance || {}).forEach(date => {
      if (date.startsWith(prefix)) {
        const day = parseInt(date.split("-")[2], 10);
        if (day >= startDay && day <= endDay) {
          const record = attendance[date]?.[employeeId];
          const status = typeof record === "object" ? record?.status : record;
          if (status === "presence") {
            days += 1;
          } else if (status === "half_presence") {
            days += 0.5;
          }
        }
      }
    });
    return days;
  };

  // ── Estado de pagamentos (conectado ao Supabase) ───────────────────────────
  const pagamentos = useMemo<Payment[]>(() => {
    return storePayments.map(sp => ({
      id: sp.id,
      employee_id: sp.employee_id,
      month: sp.period_month,
      year: sp.period_year,
      type: sp.payment_type === "quinzena1" ? "casana_q1" : sp.payment_type === "quinzena2" ? "casana_q2" : "buddy_mensal",
      valor_base: sp.net_amount,
      status: sp.paid ? "pago" : "pendente",
      paid_at: sp.paid_at ? sp.paid_at.split("T")[0] : undefined,
      comprovante_url: sp.receipt_url,
    }));
  }, [storePayments]);

  const impostos = useMemo<Tax[]>(() => {
    return storeTaxes.map(st => {
      const isPaid = !!st.paid_at;
      const today = new Date().toISOString().split("T")[0];
      const isVencido = !isPaid && st.due_date < today;
      const status = isPaid ? "pago" : isVencido ? "vencido" : "a_vencer";
      
      return {
        id: st.id,
        name: st.name,
        empresa: st.company === "BUDDY" ? "BUDDY" : "CASANA",
        valor: st.amount,
        vencimento: st.due_date,
        paid_at: st.paid_at ? st.paid_at.split("T")[0] : undefined,
        competencia_mes: st.competence_month,
        competencia_ano: st.competence_year,
        status,
      };
    });
  }, [storeTaxes]);

  // ── Liquidez contabilidade por employee (Q2) ───────────────────────────────
  const [liquidoContab, setLiquidoContab] = useState<Record<string, string>>({});
  
  useEffect(() => {
    const key = `liquido_contab_${mesSelecionado}_${anoSelecionado}`;
    const saved = localStorage.getItem(key);
    const localData = saved ? JSON.parse(saved) : {};
    
    const dbData: Record<string, string> = {};
    storePayments.forEach((p) => {
      if (
        p.payment_type === "quinzena2" &&
        p.period_month === mesSelecionado &&
        p.period_year === anoSelecionado
      ) {
        dbData[p.employee_id] = String(p.gross_amount);
      }
    });
    
    setLiquidoContab({ ...localData, ...dbData });
  }, [mesSelecionado, anoSelecionado, storePayments]);

  const updateLiquidoContab = (employeeId: string, val: string) => {
    setLiquidoContab(prev => {
      const updated = { ...prev, [employeeId]: val };
      const key = `liquido_contab_${mesSelecionado}_${anoSelecionado}`;
      localStorage.setItem(key, JSON.stringify(updated));
      return updated;
    });
  };

  // ── Descontos BUDDY por employee ───────────────────────────────────────────
  const [descontoBuddy, setDescontoBuddy] = useState<Record<string, string>>({});

  useEffect(() => {
    const key = `desconto_buddy_${mesSelecionado}_${anoSelecionado}`;
    const saved = localStorage.getItem(key);
    const localData = saved ? JSON.parse(saved) : {};
    
    const dbData: Record<string, string> = {};
    storePayments.forEach((p) => {
      if (
        p.payment_type === "mensal" &&
        p.period_month === mesSelecionado &&
        p.period_year === anoSelecionado
      ) {
        const emp = employees.find(e => e.id === p.employee_id);
        if (emp && emp.salary !== undefined) {
          const discountVal = emp.salary - p.net_amount;
          if (discountVal > 0) {
            dbData[p.employee_id] = String(discountVal);
          }
        }
      }
    });

    setDescontoBuddy({ ...localData, ...dbData });
  }, [mesSelecionado, anoSelecionado, storePayments, employees]);

  const updateDescontoBuddy = (employeeId: string, val: string) => {
    setDescontoBuddy(prev => {
      const updated = { ...prev, [employeeId]: val };
      const key = `desconto_buddy_${mesSelecionado}_${anoSelecionado}`;
      localStorage.setItem(key, JSON.stringify(updated));
      return updated;
    });
  };

  // ── Dialog state ───────────────────────────────────────────────────────────
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogConfig, setDialogConfig] = useState<{
    titulo: string;
    descricao: string;
    onConfirm: (data: string) => void;
  } | null>(null);

  // ── Dialog de Imposto ──────────────────────────────────────────────────────
  const [novoImpostoOpen, setNovoImpostoOpen] = useState(false);
  const [novoImposto, setNovoImposto] = useState({
    name: "",
    empresa: "BUDDY" as "BUDDY" | "CASANA" | "AMBAS",
    valor: "",
    vencimento: "",
    competencia_mes: mesSelecionado,
    competencia_ano: anoSelecionado,
    pago_em: "",
  });

  // ── Filtros ────────────────────────────────────────────────────────────────
  const casanaEmployees = useMemo(
    () => employees.filter((e) => e.status === "ativo" && e.pagador === "CASANA"),
    [employees]
  );
  const buddyEmployees = useMemo(
    () => employees.filter((e) => e.status === "ativo" && e.pagador === "BUDDY"),
    [employees]
  );

  const impostosFiltrados = useMemo(() => {
    const actual = impostos.filter(
      (t) =>
        t.competencia_mes === mesSelecionado && t.competencia_ano === anoSelecionado
    );
    const results = [...actual];
    PREDEFINED_TAXES.forEach(name => {
      const exists = actual.some(t => t.name === name);
      if (!exists) {
        results.push({
          id: `virtual-${name}`,
          name,
          empresa: 'BUDDY', // Default empresa
          valor: 0,
          vencimento: '',
          competencia_mes: mesSelecionado,
          competencia_ano: anoSelecionado,
          isVirtual: true,
          status: 'a_vencer'
        } as any);
      }
    });
    return results;
  }, [impostos, mesSelecionado, anoSelecionado]);

  // ── Helpers de pagamento ───────────────────────────────────────────────────
  function getPagamento(employeeId: string, type: Payment["type"]): Payment | undefined {
    return pagamentos.find(
      (p) =>
        p.employee_id === employeeId &&
        p.type === type &&
        p.month === mesSelecionado &&
        p.year === anoSelecionado
    );
  }

  async function marcarComoPago(
    employeeId: string,
    type: Payment["type"],
    valorBase: number,
    dataPagamento: string,
    extra?: Partial<Payment>
  ) {
    const mappedType = type === "casana_q1" ? "quinzena1" : type === "casana_q2" ? "quinzena2" : "mensal";
    const existing = storePayments.find(
      (sp) =>
        sp.employee_id === employeeId &&
        sp.payment_type === mappedType &&
        sp.period_month === mesSelecionado &&
        sp.period_year === anoSelecionado
    );
    
    const storeExtra: any = {};
    if (extra?.valor_contabilidade !== undefined) {
      storeExtra.gross_amount = extra.valor_contabilidade;
    }

    if (existing) {
      await updatePayment(existing.id, {
        paid: true,
        paid_at: dataPagamento,
        net_amount: valorBase,
        ...storeExtra
      });
    } else {
      await addPayment({
        employee_id: employeeId,
        period_month: mesSelecionado,
        period_year: anoSelecionado,
        payment_type: mappedType,
        gross_amount: storeExtra.gross_amount !== undefined ? storeExtra.gross_amount : valorBase,
        net_amount: valorBase,
        paid: true,
        paid_at: dataPagamento,
      });
    }
  }

  function abrirDialog(config: typeof dialogConfig) {
    setDialogConfig(config);
    setDialogOpen(true);
  }

  // ── Totais ─────────────────────────────────────────────────────────────────
  const totalQ1 = useMemo(() => {
    return casanaEmployees.reduce((acc, e) => {
      const isAvulso = e.employment_type === "Avulso";
      const diasQ1 = getDaysWorked(e.id, mesSelecionado, anoSelecionado, 1, 15);
      const valorQ1 = isAvulso ? (e.salary || 0) * diasQ1 : (e.salary || 0) / 2;
      return acc + valorQ1;
    }, 0);
  }, [casanaEmployees, mesSelecionado, anoSelecionado, attendance]);

  const totalQ2 = useMemo(() => {
    return casanaEmployees.reduce((acc, e) => {
      const isAvulso = e.employment_type === "Avulso";
      const diasQ2 = getDaysWorked(e.id, mesSelecionado, anoSelecionado, 16, 31);
      if (isAvulso) {
        return acc + (e.salary || 0) * diasQ2;
      }
      const liquido = parseFloat((liquidoContab[e.id] || "").replace(",", ".")) || 0;
      const q1Valor = (e.salary || 0) / 2;
      return acc + Math.max(0, liquido - q1Valor);
    }, 0);
  }, [casanaEmployees, liquidoContab, pagamentos, mesSelecionado, anoSelecionado, attendance]);

  const totalBuddy = useMemo(() => {
    return buddyEmployees.reduce((acc, e) => {
      const isAvulso = e.employment_type === "Avulso";
      const diasMes = getDaysWorked(e.id, mesSelecionado, anoSelecionado, 1, 31);
      const gross = isAvulso ? (e.salary || 0) * diasMes : (e.salary || 0);
      const desconto = parseFloat(descontoBuddy[e.id] || "0") || 0;
      return acc + Math.max(0, gross - desconto);
    }, 0);
  }, [buddyEmployees, descontoBuddy, mesSelecionado, anoSelecionado, attendance]);

  // ── Adicionar Imposto ──────────────────────────────────────────────────────
  async function adicionarImposto() {
    const valor = parseFloat(novoImposto.valor.replace(",", ".")) || 0;
    if (!novoImposto.name || !valor || !novoImposto.vencimento) return;

    await addTax({
      name: novoImposto.name,
      company: novoImposto.empresa === "AMBAS" ? "BUDDY" : novoImposto.empresa,
      amount: valor,
      due_date: novoImposto.vencimento,
      competence_month: mesSelecionado,
      competence_year: anoSelecionado,
      paid_at: novoImposto.pago_em || undefined,
    });
    setNovoImpostoOpen(false);
    setNovoImposto({
      name: "",
      empresa: "BUDDY",
      valor: "",
      vencimento: "",
      competencia_mes: mesSelecionado,
      competencia_ano: anoSelecionado,
      pago_em: "",
    });
  }

  async function marcarImpostoPago(taxId: string, dataPagamento: string) {
    await updateTax(taxId, {
      paid_at: dataPagamento,
    });
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-primary flex items-center gap-2">
            <Wallet className="size-7" />
            Pagamentos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie quinzenas, mensais e impostos
          </p>
        </div>

        {/* Seletor de Mês/Ano */}
        <div className="flex items-center gap-2">
          <Select
            value={String(mesSelecionado)}
            onValueChange={(v) => setMesSelecionado(Number(v))}
          >
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Mês" />
            </SelectTrigger>
            <SelectContent>
              {MESES.map((m, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={String(anoSelecionado)}
            onValueChange={(v) => setAnoSelecionado(Number(v))}
          >
            <SelectTrigger className="w-24">
              <SelectValue placeholder="Ano" />
            </SelectTrigger>
            <SelectContent>
              {ANOS.map((a) => (
                <SelectItem key={a} value={String(a)}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabs Principais */}
      <Tabs defaultValue="casana">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="casana">🏗️ Quinzenas CASANA</TabsTrigger>
          <TabsTrigger value="buddy">🏢 Mensal BUDDY</TabsTrigger>
          <TabsTrigger value="impostos">📋 Impostos</TabsTrigger>
        </TabsList>

        {/* ══════════ ABA 1: QUINZENAS CASANA ══════════ */}
        <TabsContent value="casana" className="mt-4">
          {/* Badge empresa */}
          <div className="mb-4 inline-flex items-center gap-2 rounded-lg bg-blue-50 dark:bg-blue-950 px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            <span className="font-bold">Empresa Pagante:</span>
            {CASANA_EMPRESA} — CNPJ {CASANA_CNPJ}
          </div>

          {/* Cards de totais */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <Card className="border-blue-200 dark:border-blue-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-blue-700 dark:text-blue-300">
                  Total 1ª Quinzena
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                  {formatMoney(totalQ1)}
                </p>
                <p className="text-xs text-muted-foreground">Pagar até dia 15</p>
              </CardContent>
            </Card>
            <Card className="border-blue-200 dark:border-blue-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-blue-700 dark:text-blue-300">
                  Total 2ª Quinzena
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                  {formatMoney(totalQ2)}
                </p>
                <p className="text-xs text-muted-foreground">Pagar até dia 30/31</p>
              </CardContent>
            </Card>
          </div>

          {/* Sub-tabs: 1ª e 2ª Quinzena */}
          <Tabs defaultValue="q1">
            <TabsList>
              <TabsTrigger value="q1">1ª Quinzena (até dia 15)</TabsTrigger>
              <TabsTrigger value="q2">2ª Quinzena (até dia 30/31)</TabsTrigger>
            </TabsList>

            {/* ── Sub-aba 1ª Quinzena ── */}
            <TabsContent value="q1" className="mt-3">
              {casanaEmployees.length === 0 ? (
                <Card>
                  <CardContent className="py-10 text-center text-muted-foreground">
                    Nenhum funcionário CASANA ativo cadastrado.
                  </CardContent>
                </Card>
              ) : (
                <div className="rounded-lg border overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Nº</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Nome</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground hidden md:table-cell">Vínculo</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground hidden lg:table-cell">Chave PIX</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground hidden lg:table-cell">Tipo PIX</th>
                        <th className="text-right px-3 py-2 font-medium text-muted-foreground">Valor 1ª Qz.</th>
                        <th className="text-center px-3 py-2 font-medium text-muted-foreground">Status</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {casanaEmployees.map((emp, idx) => {
                        const isAvulso = emp.employment_type === "Avulso";
                        const diasQ1 = getDaysWorked(emp.id, mesSelecionado, anoSelecionado, 1, 15);
                        const valorQ1 = isAvulso ? (emp.salary || 0) * diasQ1 : (emp.salary || 0) / 2;
                        const pag = getPagamento(emp.id, "casana_q1");
                        const pago = pag?.status === "pago";
                        return (
                          <tr key={emp.id} className="border-t hover:bg-muted/30 transition-colors">
                            <td className="px-3 py-2 text-muted-foreground">
                              {isAvulso ? "—" : (emp.employee_number || String(idx + 1).padStart(3, "0"))}
                            </td>
                            <td className="px-3 py-2 font-medium">{emp.name}</td>
                            <td className="px-3 py-2 hidden md:table-cell">
                              <Badge variant="outline" className="text-xs">
                                {emp.employment_type || "—"}
                              </Badge>
                            </td>
                            <td className="px-3 py-2 hidden lg:table-cell font-mono text-xs text-muted-foreground">
                              {emp.pix_key || "—"}
                            </td>
                            <td className="px-3 py-2 hidden lg:table-cell text-xs text-muted-foreground">
                              {emp.pix_type || "—"}
                            </td>
                            <td className="px-3 py-2 text-right font-semibold text-blue-700 dark:text-blue-300">
                              <div>{formatMoney(valorQ1)}</div>
                              {isAvulso && (
                                <div className="text-xs text-muted-foreground font-normal">
                                  {diasQ1} {diasQ1 === 1 ? "diária" : "diárias"}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {pago ? (
                                <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200">
                                  <CheckCircle className="size-3" />
                                  Pago
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-amber-600 border-amber-300">
                                  <Clock className="size-3" />
                                  Pendente
                                </Badge>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {!pago && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs"
                                  onClick={() =>
                                    abrirDialog({
                                      titulo: "Confirmar Pagamento — 1ª Quinzena",
                                      descricao: `Marcar ${emp.name} como pago: ${formatMoney(valorQ1)}`,
                                      onConfirm: (data) =>
                                        marcarComoPago(emp.id, "casana_q1", valorQ1, data),
                                    })
                                  }
                                >
                                  <CheckCircle className="size-3" />
                                  Marcar Pago
                                </Button>
                              )}
                              {pago && (
                                <div className="flex items-center gap-1.5 justify-end">
                                  <span className="text-xs text-muted-foreground">
                                    em {pag?.paid_at ? new Date(pag.paid_at + "T12:00:00Z").toLocaleDateString("pt-BR") : ""}
                                  </span>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                                    title="Excluir Pagamento (Estornar)"
                                    onClick={async () => {
                                      if (confirm(`Deseja estornar (excluir) o pagamento de ${emp.name}?`)) {
                                        if (pag?.id) await deletePayment(pag.id);
                                      }
                                    }}
                                  >
                                    <Trash2 className="size-3.5" />
                                  </Button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-muted/30">
                      <tr>
                        <td colSpan={5} className="px-3 py-2 text-right font-medium text-sm">
                          Total:
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-blue-700 dark:text-blue-300">
                          {formatMoney(totalQ1)}
                        </td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </TabsContent>

            {/* ── Sub-aba 2ª Quinzena ── */}
            <TabsContent value="q2" className="mt-3">
              {casanaEmployees.length === 0 ? (
                <Card>
                  <CardContent className="py-10 text-center text-muted-foreground">
                    Nenhum funcionário CASANA ativo cadastrado.
                  </CardContent>
                </Card>
              ) : (
                <div className="rounded-lg border overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Nº</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Nome</th>
                        <th className="text-right px-3 py-2 font-medium text-muted-foreground">1ª Qz. Paga</th>
                        <th className="text-center px-3 py-2 font-medium text-muted-foreground">Líquido Contab.</th>
                        <th className="text-right px-3 py-2 font-medium text-muted-foreground">Valor a Pagar</th>
                        <th className="text-center px-3 py-2 font-medium text-muted-foreground">Status</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {casanaEmployees.map((emp, idx) => {
                        const isAvulso = emp.employment_type === "Avulso";
                        const diasQ1 = getDaysWorked(emp.id, mesSelecionado, anoSelecionado, 1, 15);
                        const diasQ2 = getDaysWorked(emp.id, mesSelecionado, anoSelecionado, 16, 31);

                        const q1Valor = isAvulso ? (emp.salary || 0) * diasQ1 : (emp.salary || 0) / 2;
                        const q1Pag = getPagamento(emp.id, "casana_q1");
                        const q1Pago = q1Pag?.status === "pago";
                        const liquidoStr = liquidoContab[emp.id] || "";
                        const liquido = parseFloat(liquidoStr.replace(",", ".")) || 0;
                        const valorQ2 = isAvulso 
                          ? (emp.salary || 0) * diasQ2
                          : (liquido > 0 ? Math.max(0, liquido - q1Valor) : 0);
                        const pag = getPagamento(emp.id, "casana_q2");
                        const pago = pag?.status === "pago";

                        return (
                          <tr key={emp.id} className="border-t hover:bg-muted/30 transition-colors">
                            <td className="px-3 py-2 text-muted-foreground">
                              {isAvulso ? "—" : (emp.employee_number || String(idx + 1).padStart(3, "0"))}
                            </td>
                            <td className="px-3 py-2 font-medium">{emp.name}</td>
                            <td className="px-3 py-2 text-right text-muted-foreground">
                              {q1Pago ? formatMoney(q1Valor) : <span className="text-amber-500 text-xs">Não paga</span>}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {isAvulso ? (
                                <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200">
                                  Avulso ({diasQ2} {diasQ2 === 1 ? "dia" : "dias"})
                                </Badge>
                              ) : (
                                <Input
                                  type="text"
                                  placeholder="Aguardando folha"
                                  value={liquidoStr}
                                  onChange={(e) => updateLiquidoContab(emp.id, e.target.value)}
                                  className="w-32 text-right mx-auto"
                                  disabled={pago}
                                />
                              )}
                            </td>
                            <td className="px-3 py-2 text-right font-semibold text-blue-700 dark:text-blue-300">
                              {isAvulso ? (
                                <div>{formatMoney(valorQ2)}</div>
                              ) : (
                                liquido > 0 ? formatMoney(valorQ2) : (
                                  <span className="text-xs text-muted-foreground italic">Aguardando folha</span>
                                )
                              )}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {pago ? (
                                <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200">
                                  <CheckCircle className="size-3" />
                                  Pago
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-amber-600 border-amber-300">
                                  <Clock className="size-3" />
                                  Pendente
                                </Badge>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {!pago && (isAvulso ? valorQ2 > 0 : liquido > 0) && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs"
                                  onClick={() =>
                                    abrirDialog({
                                      titulo: "Confirmar Pagamento — 2ª Quinzena",
                                      descricao: `Marcar ${emp.name} como pago: ${formatMoney(valorQ2)}`,
                                      onConfirm: (data) =>
                                        marcarComoPago(emp.id, "casana_q2", valorQ2, data, {
                                          valor_contabilidade: isAvulso ? valorQ2 : liquido,
                                        }),
                                    })
                                  }
                                >
                                  <CheckCircle className="size-3" />
                                  Marcar Pago
                                </Button>
                              )}
                              {pago && (
                                <div className="flex items-center gap-1.5 justify-end">
                                  <span className="text-xs text-muted-foreground">
                                    em {pag?.paid_at ? new Date(pag.paid_at + "T12:00:00Z").toLocaleDateString("pt-BR") : ""}
                                  </span>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                                    title="Excluir Pagamento (Estornar)"
                                    onClick={async () => {
                                      if (confirm(`Deseja estornar (excluir) o pagamento de ${emp.name}?`)) {
                                        if (pag?.id) await deletePayment(pag.id);
                                      }
                                    }}
                                  >
                                    <Trash2 className="size-3.5" />
                                  </Button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-muted/30">
                      <tr>
                        <td colSpan={4} className="px-3 py-2 text-right font-medium text-sm">
                          Total estimado:
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-blue-700 dark:text-blue-300">
                          {formatMoney(totalQ2)}
                        </td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* ══════════ ABA 2: MENSAL BUDDY ══════════ */}
        <TabsContent value="buddy" className="mt-4">
          {/* Badge empresa */}
          <div className="mb-4 inline-flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <span className="font-bold">Empresa Pagante:</span>
            {BUDDY_EMPRESA} — CNPJ {BUDDY_CNPJ}
            <span className="text-muted-foreground">(CLT/MEI/Avulso)</span>
            &nbsp;|&nbsp;
            <span className="font-bold">{CASANA_EMPRESA}</span> — CNPJ {CASANA_CNPJ}
            <span className="text-muted-foreground">(PJ com NF)</span>
          </div>

          {/* Card de total */}
          <div className="grid grid-cols-1 gap-3 mb-4 sm:grid-cols-2">
            <Card className="border-emerald-200 dark:border-emerald-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-emerald-700 dark:text-emerald-300">
                  Total Mensal BUDDY
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                  {formatMoney(totalBuddy)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {MESES[mesSelecionado - 1]}/{anoSelecionado}
                </p>
              </CardContent>
            </Card>
          </div>

          {buddyEmployees.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                Nenhum funcionário BUDDY ativo cadastrado.
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Nº</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Nome</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground hidden md:table-cell">Vínculo</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground hidden lg:table-cell">Empresa Pagante</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">Salário</th>
                    <th className="text-center px-3 py-2 font-medium text-muted-foreground">Desconto</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">Valor Final</th>
                    <th className="text-center px-3 py-2 font-medium text-muted-foreground">Status</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                   {buddyEmployees.map((emp, idx) => {
                     const isAvulso = emp.employment_type === "Avulso";
                     const diasMes = getDaysWorked(emp.id, mesSelecionado, anoSelecionado, 1, 31);
                     const gross = isAvulso ? (emp.salary || 0) * diasMes : (emp.salary || 0);
                     const desconto = parseFloat(descontoBuddy[emp.id] || "0") || 0;
                     const valorFinal = Math.max(0, gross - desconto);
                     const pag = getPagamento(emp.id, "buddy_mensal");
                     const pago = pag?.status === "pago";
                     // PJ recebe da CASANA empresa
                     const empresaPagante = emp.employment_type === "PJ"
                       ? `${CASANA_EMPRESA} (${CASANA_CNPJ})`
                       : `${BUDDY_EMPRESA} (${BUDDY_CNPJ})`;

                     return (
                       <tr key={emp.id} className="border-t hover:bg-muted/30 transition-colors">
                         <td className="px-3 py-2 text-muted-foreground">
                           {isAvulso ? "—" : (emp.employee_number || String(idx + 1).padStart(3, "0"))}
                         </td>
                         <td className="px-3 py-2 font-medium">{emp.name}</td>
                         <td className="px-3 py-2 hidden md:table-cell">
                           <Badge variant="outline" className="text-xs">
                             {emp.employment_type || "—"}
                           </Badge>
                         </td>
                         <td className="px-3 py-2 hidden lg:table-cell text-xs text-muted-foreground max-w-48 truncate">
                           {empresaPagante}
                         </td>
                         <td className="px-3 py-2 text-right text-muted-foreground">
                           {isAvulso ? (
                             <div>
                               <div>{formatMoney(emp.salary || 0)} <span className="text-xs text-muted-foreground font-normal">/ diária</span></div>
                               <div className="text-xs text-muted-foreground font-normal">{diasMes} {diasMes === 1 ? "dia" : "dias"}</div>
                             </div>
                           ) : (
                             formatMoney(emp.salary || 0)
                           )}
                         </td>
                        <td className="px-3 py-2 text-center">
                          <Input
                            type="text"
                            placeholder="0,00"
                            value={descontoBuddy[emp.id] || ""}
                            onChange={(e) => updateDescontoBuddy(emp.id, e.target.value)}
                            className="w-24 text-right mx-auto"
                            disabled={pago}
                          />
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-emerald-700 dark:text-emerald-300">
                          {formatMoney(valorFinal)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {pago ? (
                            <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200">
                              <CheckCircle className="size-3" />
                              Pago
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-amber-600 border-amber-300">
                              <Clock className="size-3" />
                              Pendente
                            </Badge>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {!pago && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs"
                              onClick={() =>
                                abrirDialog({
                                  titulo: "Confirmar Pagamento Mensal",
                                  descricao: `Marcar ${emp.name} como pago: ${formatMoney(valorFinal)}`,
                                  onConfirm: (data) =>
                                    marcarComoPago(emp.id, "buddy_mensal", valorFinal, data, {
                                      desconto,
                                    }),
                                })
                              }
                            >
                              <CheckCircle className="size-3" />
                              Marcar Pago
                            </Button>
                          )}
                          {pago && (
                            <div className="flex items-center gap-1.5 justify-end">
                              <span className="text-xs text-muted-foreground">
                                em {pag?.paid_at ? new Date(pag.paid_at + "T12:00:00Z").toLocaleDateString("pt-BR") : ""}
                              </span>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                                title="Excluir Pagamento (Estornar)"
                                onClick={async () => {
                                  if (confirm(`Deseja estornar (excluir) o pagamento de ${emp.name}?`)) {
                                    if (pag?.id) await deletePayment(pag.id);
                                  }
                                }}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-muted/30">
                  <tr>
                    <td colSpan={6} className="px-3 py-2 text-right font-medium text-sm">
                      Total:
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-emerald-700 dark:text-emerald-300">
                      {formatMoney(totalBuddy)}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </TabsContent>

        {/* ══════════ ABA 3: IMPOSTOS ══════════ */}
        <TabsContent value="impostos" className="mt-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
            <div>
              <h2 className="font-semibold text-base">
                Impostos — {MESES[mesSelecionado - 1]}/{anoSelecionado}
              </h2>
              <p className="text-xs text-muted-foreground">
                GFD, DARF INSS, Simples Nacional e outros
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => {
                setNovoImposto((prev) => ({
                  ...prev,
                  competencia_mes: mesSelecionado,
                  competencia_ano: anoSelecionado,
                }));
                setNovoImpostoOpen(true);
              }}
            >
              <Plus className="size-4" />
              Adicionar Imposto
            </Button>
          </div>

          {/* Cards de resumo */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <Card className="border-emerald-200 dark:border-emerald-800">
              <CardContent className="py-3">
                <p className="text-xs text-muted-foreground">Pagos</p>
                <p className="text-xl font-bold text-emerald-600">
                  {impostosFiltrados.filter((t) => getTaxStatus(t) === "pago").length}
                </p>
              </CardContent>
            </Card>
            <Card className="border-amber-200 dark:border-amber-800">
              <CardContent className="py-3">
                <p className="text-xs text-muted-foreground">A Vencer</p>
                <p className="text-xl font-bold text-amber-600">
                  {impostosFiltrados.filter((t) => getTaxStatus(t) === "a_vencer").length}
                </p>
              </CardContent>
            </Card>
            <Card className="border-red-200 dark:border-red-800">
              <CardContent className="py-3">
                <p className="text-xs text-muted-foreground">Vencidos</p>
                <p className="text-xl font-bold text-red-600">
                  {impostosFiltrados.filter((t) => getTaxStatus(t) === "vencido").length}
                </p>
              </CardContent>
            </Card>
          </div>

          {impostosFiltrados.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                <AlertCircle className="size-8 mx-auto mb-2 opacity-40" />
                Nenhum imposto registrado para {MESES[mesSelecionado - 1]}/{anoSelecionado}.
                <br />
                <span className="text-xs">Clique em &quot;Adicionar Imposto&quot; para registrar.</span>
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Imposto</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground hidden md:table-cell">Empresa</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground hidden md:table-cell">Competência</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">Valor</th>
                    <th className="text-center px-3 py-2 font-medium text-muted-foreground">Vencimento</th>
                    <th className="text-center px-3 py-2 font-medium text-muted-foreground hidden lg:table-cell">Pago em</th>
                    <th className="text-center px-3 py-2 font-medium text-muted-foreground">Status</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {impostosFiltrados.map((tax) => {
                    const statusReal = getTaxStatus(tax);
                    return (
                      <tr key={tax.id} className="border-t hover:bg-muted/30 transition-colors">
                        <td className="px-3 py-2 font-medium">{tax.name}</td>
                        <td className="px-3 py-2 hidden md:table-cell">
                          {tax.isVirtual ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <Badge
                              variant="outline"
                              className={
                                tax.empresa === "BUDDY"
                                  ? "text-emerald-700 border-emerald-300"
                                  : tax.empresa === "CASANA"
                                  ? "text-blue-700 border-blue-300"
                                  : "text-purple-700 border-purple-300"
                              }
                            >
                              {tax.empresa}
                            </Badge>
                          )}
                        </td>
                        <td className="px-3 py-2 hidden md:table-cell text-muted-foreground">
                          {MESES[tax.competencia_mes - 1]?.substring(0, 3)}/{tax.competencia_ano}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold">
                          {tax.isVirtual ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            formatMoney(tax.valor)
                          )}
                        </td>
                        <td className="px-3 py-2 text-center text-muted-foreground">
                          {tax.isVirtual || !tax.vencimento ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            new Date(tax.vencimento + "T12:00:00Z").toLocaleDateString("pt-BR")
                          )}
                        </td>
                        <td className="px-3 py-2 text-center text-muted-foreground hidden lg:table-cell">
                          {tax.paid_at
                            ? new Date(tax.paid_at + "T12:00:00Z").toLocaleDateString("pt-BR")
                            : "—"}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {statusReal === "pago" && (
                            <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200">
                              <CheckCircle className="size-3" />
                              Pago
                            </Badge>
                          )}
                          {statusReal === "vencido" && (
                            <Badge className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-200">
                              <AlertCircle className="size-3" />
                              Vencido
                            </Badge>
                          )}
                          {statusReal === "a_vencer" && (
                            <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200">
                              <Clock className="size-3" />
                              A Vencer
                            </Badge>
                          )}
                          {statusReal === "pendente" && (
                            <Badge className="bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-200">
                              <AlertCircle className="size-3" />
                              Pendente
                            </Badge>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {tax.isVirtual ? (
                            <Button
                              size="sm"
                              className="text-xs bg-primary hover:bg-primary/90 text-white"
                              onClick={() => {
                                setNovoImposto({
                                  name: tax.name,
                                  empresa: "BUDDY",
                                  valor: "",
                                  vencimento: "",
                                  competencia_mes: mesSelecionado,
                                  competencia_ano: anoSelecionado,
                                  pago_em: "",
                                });
                                setNovoImpostoOpen(true);
                              }}
                            >
                              <Plus className="size-3" />
                              Registrar / Pagar
                            </Button>
                          ) : (
                            <div className="flex items-center justify-end">
                              {statusReal !== "pago" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs"
                                  onClick={() =>
                                    abrirDialog({
                                      titulo: "Confirmar Pagamento de Imposto",
                                      descricao: `Marcar "${tax.name}" como pago: ${formatMoney(tax.valor)}`,
                                      onConfirm: (data) => marcarImpostoPago(tax.id, data),
                                    })
                                  }
                                >
                                  <CheckCircle className="size-3" />
                                  Marcar Pago
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 ml-2 inline-flex items-center justify-center"
                                title="Excluir Imposto"
                                onClick={async () => {
                                  if (confirm(`Deseja excluir o imposto "${tax.name}"?`)) {
                                    await deleteTax(tax.id);
                                  }
                                }}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Dialog de Confirmação de Pagamento ─────────────────────────────── */}
      {dialogConfig && (
        <PagarDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          titulo={dialogConfig.titulo}
          descricao={dialogConfig.descricao}
          onConfirm={dialogConfig.onConfirm}
        />
      )}

      {/* ── Dialog de Novo Imposto ──────────────────────────────────────────── */}
      <Dialog
        open={novoImpostoOpen}
        onOpenChange={(o) => setNovoImpostoOpen(o)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Imposto</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {/* Nome do imposto */}
            <div className="space-y-1">
              <Label>Nome do Imposto</Label>
              <Select
                value={novoImposto.name}
                onValueChange={(v) => setNovoImposto((p) => ({ ...p, name: v ?? '' }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione ou escolha abaixo" />
                </SelectTrigger>
                <SelectContent>
                  {IMPOSTOS_SUGERIDOS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Ou digite o nome do imposto"
                value={novoImposto.name}
                onChange={(e) => setNovoImposto((p) => ({ ...p, name: e.target.value }))}
              />
            </div>

            {/* Empresa */}
            <div className="space-y-1">
              <Label>Empresa</Label>
              <Select
                value={novoImposto.empresa}
                onValueChange={(v) =>
                  setNovoImposto((p) => ({
                    ...p,
                    empresa: v as "BUDDY" | "CASANA" | "AMBAS",
                  }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BUDDY">BUDDY (GENECY CONSTRUCOES)</SelectItem>
                  <SelectItem value="CASANA">CASANA (BUDDY & GENECY CONSTRUTORA)</SelectItem>
                  <SelectItem value="AMBAS">AMBAS</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Valor e Vencimento */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Valor (R$)</Label>
                <Input
                  type="text"
                  placeholder="0,00"
                  value={novoImposto.valor}
                  onChange={(e) => setNovoImposto((p) => ({ ...p, valor: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Vencimento</Label>
                <Input
                  type="date"
                  value={novoImposto.vencimento}
                  onChange={(e) =>
                    setNovoImposto((p) => ({ ...p, vencimento: e.target.value }))
                  }
                />
              </div>
            </div>

            {/* Competência */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Mês Competência</Label>
                <Select
                  value={String(novoImposto.competencia_mes)}
                  onValueChange={(v) =>
                    setNovoImposto((p) => ({ ...p, competencia_mes: Number(v) }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MESES.map((m, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Ano</Label>
                <Select
                  value={String(novoImposto.competencia_ano)}
                  onValueChange={(v) =>
                    setNovoImposto((p) => ({ ...p, competencia_ano: Number(v) }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ANOS.map((a) => (
                      <SelectItem key={a} value={String(a)}>
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Pago em (opcional) */}
            <div className="space-y-1">
              <Label>Pago em (Data de Pagamento - Opcional)</Label>
              <Input
                type="date"
                value={novoImposto.pago_em}
                onChange={(e) =>
                  setNovoImposto((p) => ({ ...p, pago_em: e.target.value }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setNovoImpostoOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={adicionarImposto}>
              <Plus className="size-4" />
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
