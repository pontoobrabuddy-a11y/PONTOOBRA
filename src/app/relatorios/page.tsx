"use client";

import { useState, useMemo, useEffect } from "react";
import { useStore } from "@/store/useStore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, FileText, Search, LayoutGrid, List, ArrowUpDown, MessageSquare } from "lucide-react";
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

interface HoveredCellInfo {
  empName: string;
  dateFormatted: string;
  statusLabel: string;
  statusShort: string;
  observation: string;
  x: number;
  y: number;
}

export default function RelatoriosPage() {
  const { employees, attendance, payments } = useStore();
  const [salaryMappings, setSalaryMappings] = useState<{liquid: number, gross: number}[]>([]);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("salary_mappings");
      if (saved) setSalaryMappings(JSON.parse(saved));
    } catch(e) {}
  }, []);
  const [searchTerm, setSearchTerm] = useState("");
  const [companyFilter, setCompanyFilter] = useState<'TODOS' | 'BUDDY' | 'CASANA'>('TODOS');
  const [sortBy, setSortBy] = useState<'number' | 'name'>('number');
  const [hoveredCell, setHoveredCell] = useState<HoveredCellInfo | null>(null);

  const [monthStr, setMonthStr] = useState<string>(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  });
  const [viewMode, setViewMode] = useState<'resumo' | 'espelho'>('resumo');

  const [yearStr, mStr] = monthStr.split('-');
  const year = parseInt(yearStr);
  const month = parseInt(mStr) - 1; // 0-indexed
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1));
  const dayNames = ["dom.", "seg.", "ter.", "qua.", "qui.", "sex.", "sáb."];

  const getStatusMeta = (status?: string | null) => {
    if (status === 'presence') return { label: 'Presença', short: 'P' };
    if (status === 'absence') return { label: 'Falta', short: 'F' };
    if (status === 'justified_absence') return { label: 'Falta Justificada', short: 'FJ' };
    if (status === 'half_presence') return { label: 'Meia Presença', short: 'M' };
    if (status === 'suspension') return { label: 'Suspensão', short: 'S' };
    return { label: 'Sem registro', short: '' };
  };

  // Calculate aggregated data for the selected month
  const reportData = useMemo(() => {
    const activeEmployees = employees.filter(emp => emp.status !== 'inativo');
    return activeEmployees.map(emp => {
      let presences = 0;
      let half_presences = 0;
      let absences = 0;
      let justified = 0;
      let suspensions = 0;
      const monthObservations: Array<{
        dateStr: string;
        day: number;
        status: string;
        statusLabel: string;
        statusShort: string;
        observation: string;
      }> = [];

      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const record = attendance[dateStr]?.[emp.id];
        const status = typeof record === 'string' ? record : record?.status;
        const obs = typeof record === 'object' && record?.observation ? record.observation.trim() : '';
        
        if (status === 'presence') presences++;
        if (status === 'half_presence') half_presences++;
        if (status === 'absence') absences++;
        if (status === 'justified_absence') justified++;
        if (status === 'suspension') suspensions++;

        if (obs) {
          const meta = getStatusMeta(status);
          monthObservations.push({
            dateStr,
            day,
            status: status || '',
            statusLabel: meta.label,
            statusShort: meta.short || '-',
            observation: obs,
          });
        }
      }

      return {
        ...emp,
        presences,
        half_presences,
        absences,
        justified,
        suspensions,
        monthObservations,
      };
    });
  }, [employees, attendance, monthStr, daysInMonth, year, month]);

  const filteredData = useMemo(() => {
    const filtered = reportData.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCompany = companyFilter === 'TODOS' || item.pagador === companyFilter;
      return matchesSearch && matchesCompany;
    });

    if (sortBy === 'name') {
      return [...filtered].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    }

    return [...filtered].sort((a, b) => {
      const numA = parseInt(a.employee_number != null ? String(a.employee_number) : "", 10);
      const numB = parseInt(b.employee_number != null ? String(b.employee_number) : "", 10);
      const isNumA = !isNaN(numA);
      const isNumB = !isNaN(numB);
      
      if (isNumA && isNumB) return numA - numB;
      if (isNumA) return -1;
      if (isNumB) return 1;
      return (a.employee_number != null ? String(a.employee_number) : "").localeCompare(
        b.employee_number != null ? String(b.employee_number) : "",
        'pt-BR'
      );
    });
  }, [reportData, searchTerm, companyFilter, sortBy]);

  const exportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Fechamento");

    // Setup Columns
    const columns = [
      { header: "", key: "n", width: 5 },
      { header: "", key: "name", width: 40 },
      { header: "", key: "role", width: 20 },
      { header: "", key: "vr", width: 8 },
      { header: "", key: "liq_contratual", width: 16 },
      { header: "", key: "liq_pago", width: 16 },
      { header: "", key: "bruto", width: 16 },
    ];
    
    days.forEach(date => {
      columns.push({ header: "", key: `day_${date.getDate()}`, width: 5.5 });
    });

    columns.push({ header: "", key: "faltas", width: 12 });
    columns.push({ header: "", key: "observacoes", width: 45 });
    
    worksheet.columns = columns as any;

    // Row 1: Headers (Dates)
    const headerRow1 = worksheet.getRow(1);
    headerRow1.height = 20;
    worksheet.mergeCells('A1:G1');
    const titleCell = headerRow1.getCell(1);
    titleCell.value = "TRABALHADORES GERAIS DA OBRA";
    titleCell.font = { color: { argb: 'FFFFFFFF' }, bold: true, name: 'Calibri' };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    days.forEach((date, index) => {
      const cell = headerRow1.getCell(index + 8);
      const shortMonth = date.toLocaleString('pt-BR', { month: 'short' }).replace('.', '');
      cell.value = `${date.getDate()}-${shortMonth}.`;
      cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 9, name: 'Calibri' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFFFFFFF' } },
        left: { style: 'thin', color: { argb: 'FFFFFFFF' } },
        bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } },
        right: { style: 'thin', color: { argb: 'FFFFFFFF' } }
      };
    });

    const faltasHeader1 = headerRow1.getCell(days.length + 8);
    faltasHeader1.value = "TOTAL";
    faltasHeader1.font = { color: { argb: 'FFFFFFFF' }, bold: true, name: 'Calibri' };
    faltasHeader1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } };
    faltasHeader1.alignment = { horizontal: 'center', vertical: 'middle' };

    const obsHeader1 = headerRow1.getCell(days.length + 9);
    obsHeader1.value = "HISTÓRICO";
    obsHeader1.font = { color: { argb: 'FFFFFFFF' }, bold: true, name: 'Calibri' };
    obsHeader1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } };
    obsHeader1.alignment = { horizontal: 'center', vertical: 'middle' };

    // Row 2: Headers (Day of week)
    const headerRow2 = worksheet.getRow(2);
    headerRow2.height = 20;
    
    const nCell = headerRow2.getCell(1);
    nCell.value = "Nº";
    nCell.font = { color: { argb: 'FFFFFFFF' }, bold: true, name: 'Calibri' };
    nCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } };
    nCell.alignment = { horizontal: 'center', vertical: 'middle' };
    
    const nameCell = headerRow2.getCell(2);
    nameCell.value = "Funcionários";
    nameCell.font = { color: { argb: 'FFFFFFFF' }, bold: true, name: 'Calibri' };
    nameCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } };
    nameCell.alignment = { horizontal: 'center', vertical: 'middle' };
    
    [
      { cell: headerRow2.getCell(3), label: "Cargo" },
      { cell: headerRow2.getCell(4), label: "VR" },
      { cell: headerRow2.getCell(5), label: "Líquido Contratual" },
      { cell: headerRow2.getCell(6), label: "Líquido Pago Mês" },
      { cell: headerRow2.getCell(7), label: "Salário Bruto" }
    ].forEach(({ cell, label }) => {
      cell.value = label;
      cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 9, name: 'Calibri' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    days.forEach((date, index) => {
      const cell = headerRow2.getCell(index + 8);
      cell.value = dayNames[date.getDay()];
      cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 9, name: 'Calibri' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFFFFFFF' } },
        left: { style: 'thin', color: { argb: 'FFFFFFFF' } },
        bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } },
        right: { style: 'thin', color: { argb: 'FFFFFFFF' } }
      };
    });

    const faltasHeader2 = headerRow2.getCell(days.length + 8);
    faltasHeader2.value = "Faltas";
    faltasHeader2.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 9, name: 'Calibri' };
    faltasHeader2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } };
    faltasHeader2.alignment = { horizontal: 'center', vertical: 'middle' };

    const obsHeader2 = headerRow2.getCell(days.length + 9);
    obsHeader2.value = "Observações / Motivos";
    obsHeader2.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 9, name: 'Calibri' };
    obsHeader2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } };
    obsHeader2.alignment = { horizontal: 'center', vertical: 'middle' };

    // Rows Data
    let rowIdx = 1;
    const allMonthObsRows: Array<{
      dateFormatted: string;
      empNum: string | number;
      empName: string;
      role: string;
      statusLabel: string;
      observation: string;
    }> = [];

    filteredData.forEach((emp) => {
      const liquidoContratual = emp.salary || 0;
      const mapping = salaryMappings.find(m => Math.abs(m.liquid - liquidoContratual) < 0.01);
      const salarioBruto = mapping ? mapping.gross : liquidoContratual * 1.084;
      
      const empPayments = payments.filter(p => p.employee_id === emp.id && p.period_month === month + 1 && p.period_year === year);
      const liquidoPagoMes = empPayments.filter(p => p.paid).reduce((acc, p) => acc + p.net_amount, 0);

      const empNum = emp.employee_number != null && String(emp.employee_number).trim() !== "" ? emp.employee_number : rowIdx++;
      
      const totalFaltasCalc = emp.absences + (emp.half_presences * 0.5);
      const faltasStr = totalFaltasCalc > 0 ? `${totalFaltasCalc.toString().replace('.', ',')} faltas` : "-";

      const obsSummaryStr = emp.monthObservations.length > 0
        ? emp.monthObservations
            .map(o => `${String(o.day).padStart(2, '0')}/${String(month + 1).padStart(2, '0')} (${o.statusShort}): ${o.observation}`)
            .join(" | ")
        : "-";

      emp.monthObservations.forEach(o => {
        allMonthObsRows.push({
          dateFormatted: `${String(o.day).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}/${year}`,
          empNum,
          empName: emp.name,
          role: emp.role || "-",
          statusLabel: `${o.statusLabel} (${o.statusShort})`,
          observation: o.observation,
        });
      });

      const row = worksheet.addRow({ 
        n: empNum, 
        name: emp.name,
        role: emp.role || "-",
        vr: emp.recebe_vr ? "Sim" : "Não",
        liq_contratual: liquidoContratual > 0 ? liquidoContratual : "-",
        liq_pago: liquidoPagoMes > 0 ? liquidoPagoMes : "-",
        bruto: salarioBruto > 0 ? salarioBruto : "-",
        faltas: faltasStr,
        observacoes: obsSummaryStr
      });
      row.height = 18;

      const styleCell = (c: any) => {
        c.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        c.alignment = { vertical: 'middle', horizontal: 'center' };
      };
      
      styleCell(row.getCell(1));
      
      const nameCellRow = row.getCell(2);
      nameCellRow.font = { bold: true, name: 'Calibri', size: 10 };
      nameCellRow.alignment = { vertical: 'middle', indent: 1 };
      nameCellRow.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      
      [3, 4, 5, 6, 7].forEach(idx => styleCell(row.getCell(idx)));
      
      row.getCell(5).numFmt = '"R$ "#,##0.00';
      row.getCell(6).numFmt = '"R$ "#,##0.00';
      row.getCell(7).numFmt = '"R$ "#,##0.00';

      days.forEach((date, index) => {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        const record = attendance[dateStr]?.[emp.id];
        const status = typeof record === 'string' ? record : record?.status;
        const obs = typeof record === 'object' && record?.observation ? record.observation.trim() : '';
        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
        
        const cell = row.getCell(index + 8);
        cell.alignment = { horizontal: 'center', vertical: 'middle' };

        if (obs) {
          const meta = getStatusMeta(status);
          cell.note = `${emp.name} - ${String(date.getDate()).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}/${year} (${meta.label}):\nMotivo/Obs: ${obs}`;
        }
        
        if (isWeekend) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF595959' } };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FF404040' } },
            left: { style: 'thin', color: { argb: 'FF404040' } },
            bottom: { style: 'thin', color: { argb: 'FF404040' } },
            right: { style: 'thin', color: { argb: 'FF404040' } }
          };
        } else {
          cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
          
          if (!status) {
            // Em branco se não preenchido
          } else if (status === 'presence') {
            cell.value = 1;
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } }; 
            cell.font = { color: { argb: 'FF385D22' }, name: 'Calibri', size: 10 };
          } else if (status === 'absence') {
            cell.value = 0;
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4B084' } };
            cell.font = { color: { argb: 'FFC00000' }, name: 'Calibri', size: 10 };
          } else if (status === 'justified_absence') {
            cell.value = '1J';
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFA9D08E' } };
            cell.font = { color: { argb: 'FF385D22' }, name: 'Calibri', size: 10 };
          } else if (status === 'half_presence') {
            cell.value = 0.5;
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE699' } }; 
            cell.font = { color: { argb: 'FFC65911' }, name: 'Calibri', size: 10 };
          } else if (status === 'suspension') {
            cell.value = 'S';
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
            cell.font = { color: { argb: 'FF000000' }, name: 'Calibri', size: 10 };
          }
        }
      });
      
      const faltasCell = row.getCell(days.length + 8);
      styleCell(faltasCell);
      faltasCell.font = { bold: true, color: { argb: 'FFC00000' }, name: 'Calibri', size: 10 };

      const obsCell = row.getCell(days.length + 9);
      obsCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      obsCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      obsCell.font = { name: 'Calibri', size: 9, color: { argb: 'FF334155' } };
    });

    // Segunda Aba: Detalhamento de Observações e Motivos de Faltas
    if (allMonthObsRows.length > 0) {
      const obsSheet = workbook.addWorksheet("Observações e Motivos");
      obsSheet.columns = [
        { header: "Data", key: "dateFormatted", width: 14 },
        { header: "Nº", key: "empNum", width: 8 },
        { header: "Funcionário", key: "empName", width: 35 },
        { header: "Cargo", key: "role", width: 22 },
        { header: "Status no Ponto", key: "statusLabel", width: 24 },
        { header: "Motivo / Observação Registrada", key: "observation", width: 55 },
      ];

      const obsHeader = obsSheet.getRow(1);
      obsHeader.height = 22;
      obsHeader.font = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Calibri', size: 10 };
      for (let c = 1; c <= 6; c++) {
        obsHeader.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
        obsHeader.getCell(c).alignment = { vertical: 'middle', horizontal: 'center' };
      }

      allMonthObsRows.forEach((item) => {
        const r = obsSheet.addRow(item);
        r.height = 19;
        for (let c = 1; c <= 6; c++) {
          r.getCell(c).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
          r.getCell(c).alignment = { vertical: 'middle', horizontal: c === 3 || c === 6 ? 'left' : 'center' };
        }
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `relatorio_presenca_${monthStr}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Relatórios e Fechamento</h1>
          <p className="text-muted-foreground mt-2">
            Resumo de frequência mensal para a folha de pagamento. Passe o mouse sobre o status (F, FJ, M, P, S) no Espelho de Ponto para ver a observação/motivo.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => alert("Gerando PDF...")}>
            <FileText className="mr-2 h-4 w-4" />
            Exportar PDF
          </Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={exportExcel}>
            <Download className="mr-2 h-4 w-4" />
            Exportar Excel
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
            <div>
              <CardTitle>Filtros e Visualização</CardTitle>
              <CardDescription>Filtre por período, equipe ou mude o modo de visão.</CardDescription>
            </div>
            <div className="flex bg-muted p-1 rounded-lg">
              <Button 
                variant={viewMode === 'resumo' ? 'default' : 'ghost'} 
                size="sm" 
                onClick={() => setViewMode('resumo')}
                className="w-32"
              >
                <List className="h-4 w-4 mr-2" />
                Resumo
              </Button>
              <Button 
                variant={viewMode === 'espelho' ? 'default' : 'ghost'} 
                size="sm" 
                onClick={() => setViewMode('espelho')}
                className="w-32"
              >
                <LayoutGrid className="h-4 w-4 mr-2" />
                Espelho Ponto
              </Button>
            </div>
          </div>
          <div className="flex flex-col md:flex-row gap-4 pt-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar funcionário..."
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="w-full md:w-[200px]">
              <Select
                value={sortBy}
                onValueChange={(v) => setSortBy(v as 'number' | 'name')}
              >
                <SelectTrigger className="w-full">
                  <ArrowUpDown className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="Ordenação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="number">Ordenar por Nº</SelectItem>
                  <SelectItem value="name">Ordem Alfabética (Nome)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="w-full md:w-[200px]">
              <Select
                value={companyFilter}
                onValueChange={(v) => setCompanyFilter(v as 'TODOS' | 'BUDDY' | 'CASANA')}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Filtrar por Empresa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todas as Empresas</SelectItem>
                  <SelectItem value="BUDDY">Somente BUDDY</SelectItem>
                  <SelectItem value="CASANA">Somente CASANA</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="w-full md:w-[200px]">
              <Input 
                type="month" 
                value={monthStr}
                onChange={(e) => setMonthStr(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table className={viewMode === 'espelho' ? 'w-max min-w-full' : ''}>
              <TableHeader className="bg-slate-50 dark:bg-slate-900">
                {viewMode === 'resumo' ? (
                  <TableRow>
                    <TableHead>Funcionário</TableHead>
                    <TableHead className="text-center">Presenças</TableHead>
                    <TableHead className="text-center">Meias Pres.</TableHead>
                    <TableHead className="text-center text-red-500">Faltas</TableHead>
                    <TableHead className="text-center text-yellow-600">Justificadas</TableHead>
                    <TableHead className="text-center">Suspensões</TableHead>
                    <TableHead>Observações / Motivos no Mês</TableHead>
                    <TableHead className="text-right font-bold text-primary">Dias Trabalhados</TableHead>
                  </TableRow>
                ) : (
                  <TableRow>
                    <TableHead className="sticky left-0 z-20 bg-slate-50 dark:bg-slate-900 min-w-[200px] border-r">Funcionário</TableHead>
                    <TableHead className="bg-slate-50 dark:bg-slate-900 min-w-[120px] border-r text-center">Cargo</TableHead>
                    <TableHead className="bg-slate-50 dark:bg-slate-900 min-w-[80px] border-r text-center">VR</TableHead>
                    <TableHead className="bg-slate-50 dark:bg-slate-900 min-w-[120px] border-r text-center">Líquido Contratual</TableHead>
                    <TableHead className="bg-slate-50 dark:bg-slate-900 min-w-[120px] border-r text-center">Líquido Pago Mês</TableHead>
                    <TableHead className="bg-slate-50 dark:bg-slate-900 min-w-[120px] border-r text-center">Salário Bruto</TableHead>
                    {days.map(date => (
                      <TableHead key={date.toISOString()} className="text-center w-12 border-r px-1 last:border-0">
                        <div className="flex flex-col items-center">
                          <span className="text-xs font-bold leading-none">{date.getDate()}</span>
                          <span className="text-[10px] text-muted-foreground mt-1">{dayNames[date.getDay()]}</span>
                        </div>
                      </TableHead>
                    ))}
                    <TableHead className="bg-slate-50 dark:bg-slate-900 min-w-[80px] border-l text-center font-bold text-red-500">Faltas</TableHead>
                  </TableRow>
                )}
              </TableHeader>
              <TableBody>
                {filteredData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={viewMode === 'resumo' ? 8 : days.length + 7} className="text-center py-6 text-muted-foreground">
                      Nenhum dado encontrado para o período.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredData.map((item) => {
                    const diasTrabalhados = item.presences + (item.half_presences * 0.5) + item.justified;
                    
                    if (viewMode === 'resumo') {
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell className="text-center">{item.presences}</TableCell>
                          <TableCell className="text-center">{item.half_presences}</TableCell>
                          <TableCell className="text-center text-red-500 font-medium">{item.absences}</TableCell>
                          <TableCell className="text-center text-yellow-600 font-medium">{item.justified}</TableCell>
                          <TableCell className="text-center">{item.suspensions}</TableCell>
                          <TableCell className="max-w-[320px]">
                            {item.monthObservations.length === 0 ? (
                              <span className="text-xs text-muted-foreground">—</span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {item.monthObservations.map((o) => (
                                  <span
                                    key={o.dateStr}
                                    title={`${String(o.day).padStart(2, '0')}/${String(month + 1).padStart(2, '0')} (${o.statusLabel}): ${o.observation}`}
                                    className="inline-flex items-center gap-1 text-[11px] bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded-md"
                                  >
                                    <MessageSquare className="h-3 w-3 shrink-0 text-blue-600" />
                                    <strong>Dia {String(o.day).padStart(2, '0')} ({o.statusShort}):</strong>
                                    <span className="truncate max-w-[180px]">{o.observation}</span>
                                  </span>
                                ))}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-bold text-primary">
                            {diasTrabalhados.toFixed(1).replace('.0', '')}
                          </TableCell>
                        </TableRow>
                      );
                    } else {
                      const empPayments = payments.filter(p => p.employee_id === item.id && p.period_month === month + 1 && p.period_year === year);
                      const liquidoContratual = item.salary || 0;
                      const mapping = salaryMappings.find(m => Math.abs(m.liquid - liquidoContratual) < 0.01);
                      const salarioBruto = mapping ? mapping.gross : liquidoContratual * 1.084;
                      const pagoMes = empPayments.filter(p => p.paid).reduce((acc, p) => acc + p.net_amount, 0);

                      return (
                        <TableRow key={item.id}>
                          <TableCell className="sticky left-0 z-20 bg-background font-medium border-r truncate max-w-[250px]" title={item.name}>
                            {item.name}
                          </TableCell>
                          <TableCell className="border-r text-center text-xs truncate max-w-[120px]" title={item.role || "—"}>
                            {item.role || "—"}
                          </TableCell>
                          <TableCell className="border-r text-center font-medium text-xs">
                            {item.recebe_vr ? <span className="text-emerald-600">Sim</span> : <span className="text-muted-foreground">Não</span>}
                          </TableCell>
                          <TableCell className="border-r text-center font-mono text-xs">
                            {liquidoContratual > 0 ? `R$ ${liquidoContratual.toFixed(2)}` : "—"}
                          </TableCell>
                          <TableCell className="border-r text-center font-mono text-xs">
                            {pagoMes > 0 ? (
                              <span className={pagoMes >= liquidoContratual && liquidoContratual > 0 ? "text-emerald-600 font-bold" : "text-orange-600"}>
                                R$ {pagoMes.toFixed(2)}
                              </span>
                            ) : "—"}
                          </TableCell>
                          <TableCell className="border-r text-center font-mono text-xs">
                            {salarioBruto > 0 ? `R$ ${salarioBruto.toFixed(2)}` : "—"}
                          </TableCell>
                          {days.map(date => {
                            const dayNum = String(date.getDate()).padStart(2, '0');
                            const monthNum = String(month + 1).padStart(2, '0');
                            const dateStr = `${year}-${monthNum}-${dayNum}`;
                            const dateBr = `${dayNum}/${monthNum}/${year} (${dayNames[date.getDay()]})`;
                            const record = attendance[dateStr]?.[item.id];
                            const status = typeof record === 'string' ? record : record?.status;
                            const observation = typeof record === 'object' && record?.observation ? record.observation.trim() : '';
                            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                            
                            let bg = isWeekend ? 'bg-muted/50' : '';
                            let text = '';
                            let textClass = '';
                            let statusLabel = '';

                            if (status === 'presence') {
                              bg = 'bg-emerald-100 dark:bg-emerald-900/30';
                              text = 'P';
                              textClass = 'text-emerald-700 dark:text-emerald-400';
                              statusLabel = 'Presença';
                            } else if (status === 'absence') {
                              bg = 'bg-red-100 dark:bg-red-900/30';
                              text = 'F';
                              textClass = 'text-red-700 dark:text-red-400';
                              statusLabel = 'Falta';
                            } else if (status === 'justified_absence') {
                              bg = 'bg-yellow-100 dark:bg-yellow-900/30';
                              text = 'FJ';
                              textClass = 'text-yellow-700 dark:text-yellow-400';
                              statusLabel = 'Falta Justificada';
                            } else if (status === 'half_presence') {
                              bg = 'bg-orange-100 dark:bg-orange-900/30';
                              text = 'M';
                              textClass = 'text-orange-700 dark:text-orange-400';
                              statusLabel = 'Meia Presença';
                            } else if (status === 'suspension') {
                              bg = 'bg-gray-200 dark:bg-gray-800';
                              text = 'S';
                              textClass = 'text-gray-700 dark:text-gray-300';
                              statusLabel = 'Suspensão';
                            }

                            const shouldShowHover = Boolean(observation) || (Boolean(text) && text !== 'P');
                            const nativeTooltip = observation
                              ? `${item.name} • ${dateBr}\nStatus: ${statusLabel} (${text})\nMotivo/Observação: ${observation}`
                              : text
                              ? `${item.name} • ${dateBr}\nStatus: ${statusLabel} (${text})${text !== 'P' ? '\n(Sem observação registrada)' : ''}`
                              : undefined;
                            
                            return (
                              <TableCell
                                key={date.toISOString()}
                                title={nativeTooltip}
                                onMouseEnter={(e) => {
                                  if (!shouldShowHover) return;
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setHoveredCell({
                                    empName: item.name,
                                    dateFormatted: dateBr,
                                    statusLabel,
                                    statusShort: text,
                                    observation,
                                    x: rect.left + rect.width / 2,
                                    y: rect.top,
                                  });
                                }}
                                onMouseLeave={() => setHoveredCell(null)}
                                className={`text-center p-1 border-r last:border-0 relative ${bg} ${
                                  shouldShowHover ? 'cursor-help' : ''
                                }`}
                              >
                                {text ? (
                                  <div className={`w-7 h-7 flex items-center justify-center font-bold text-xs mx-auto rounded relative ${textClass}`}>
                                    {text}
                                    {observation && (
                                      <span
                                        className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-blue-600 ring-1 ring-white dark:ring-slate-900"
                                        aria-label="Possui observação"
                                      />
                                    )}
                                  </div>
                                ) : (
                                  <div className="w-7 h-7 mx-auto" />
                                )}
                              </TableCell>
                            );
                          })}
                          <TableCell className="border-l text-center font-bold text-red-500 text-xs">
                            {(() => {
                              const totalF = item.absences + (item.half_presences * 0.5);
                              return totalF > 0 ? `${totalF.toString().replace('.', ',')} faltas` : "—";
                            })()}
                          </TableCell>
                        </TableRow>
                      );
                    }
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Floating Instant Tooltip when hovering over F / FJ / M / S or any cell with observation */}
      {hoveredCell && (
        <div
          style={{
            left: `${Math.min(Math.max(hoveredCell.x, 150), typeof window !== 'undefined' ? window.innerWidth - 150 : hoveredCell.x)}px`,
            top: `${hoveredCell.y}px`,
          }}
          className="fixed z-50 pointer-events-none -translate-x-1/2 -translate-y-full -mt-2 w-72 rounded-xl bg-slate-900 text-white p-3 shadow-2xl border border-slate-700 text-xs space-y-1.5 animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-700/80 pb-1.5">
            <span className="font-bold text-white truncate">{hoveredCell.empName}</span>
            <span className="text-[10px] text-slate-300 shrink-0">{hoveredCell.dateFormatted}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Status:</span>
            <span
              className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                hoveredCell.statusShort === 'F'
                  ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                  : hoveredCell.statusShort === 'FJ'
                  ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40'
                  : hoveredCell.statusShort === 'M'
                  ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
                  : hoveredCell.statusShort === 'S'
                  ? 'bg-slate-600 text-slate-200'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              }`}
            >
              {hoveredCell.statusLabel} ({hoveredCell.statusShort})
            </span>
          </div>

          <div className="pt-0.5">
            <span className="text-slate-400 font-medium block mb-0.5">Motivo / Observação:</span>
            {hoveredCell.observation ? (
              <div className="bg-slate-800/90 border border-slate-700 rounded-lg p-2 text-amber-200 font-medium leading-relaxed break-words">
                “{hoveredCell.observation}”
              </div>
            ) : (
              <div className="text-slate-400 italic text-[11px]">
                Nenhum motivo/observação foi informado no apontamento deste dia.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
