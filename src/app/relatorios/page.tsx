"use client";

import { useState, useMemo } from "react";
import { useStore } from "@/store/useStore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, FileText, Search, LayoutGrid, List, ArrowUpDown } from "lucide-react";
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

export default function RelatoriosPage() {
  const { employees, attendance, payments } = useStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [companyFilter, setCompanyFilter] = useState<'TODOS' | 'BUDDY' | 'CASANA'>('TODOS');
  const [sortBy, setSortBy] = useState<'number' | 'name'>('number');

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

  // Calculate aggregated data for the selected month
  const reportData = useMemo(() => {
    const activeEmployees = employees.filter(emp => emp.status !== 'inativo');
    return activeEmployees.map(emp => {
      let presences = 0;
      let half_presences = 0;
      let absences = 0;
      let justified = 0;
      let suspensions = 0;

      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const record = attendance[dateStr]?.[emp.id];
        const status = typeof record === 'string' ? record : record?.status;
        
        if (status === 'presence') presences++;
        if (status === 'half_presence') half_presences++;
        if (status === 'absence') absences++;
        if (status === 'justified_absence') justified++;
        if (status === 'suspension') suspensions++;
      }

      return {
        ...emp,
        presences,
        half_presences,
        absences,
        justified,
        suspensions
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
      { header: "", key: "vr", width: 10 },
      { header: "", key: "bruto", width: 15 },
      { header: "", key: "liquido", width: 15 },
      { header: "", key: "pago", width: 15 },
    ];
    
    days.forEach(date => {
      columns.push({ header: "", key: `day_${date.getDate()}`, width: 5.5 });
    });
    
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
      { cell: headerRow2.getCell(5), label: "Bruto Mês" },
      { cell: headerRow2.getCell(6), label: "Líquido Mês" },
      { cell: headerRow2.getCell(7), label: "Pago Mês" }
    ].forEach(({ cell, label }) => {
      cell.value = label;
      cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, name: 'Calibri' };
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

    // Rows Data
    let rowIdx = 1;
    filteredData.forEach((emp) => {
      const empPayments = payments.filter(p => p.employee_id === emp.id && p.period_month === month + 1 && p.period_year === year);
      const brutoMes = empPayments.reduce((acc, p) => acc + p.gross_amount, 0);
      const liquidoMes = empPayments.reduce((acc, p) => acc + p.net_amount, 0);
      const pagoMes = empPayments.filter(p => p.paid).reduce((acc, p) => acc + p.net_amount, 0);

      const empNum = emp.employee_number != null && String(emp.employee_number).trim() !== "" ? emp.employee_number : rowIdx++;
      const row = worksheet.addRow({ 
        n: empNum, 
        name: emp.name,
        role: emp.role || "-",
        vr: emp.recebe_vr ? "Sim" : "Não",
        bruto: brutoMes > 0 ? brutoMes : "-",
        liquido: liquidoMes > 0 ? liquidoMes : "-",
        pago: pagoMes > 0 ? pagoMes : "-"
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
      
      days.forEach((date, dateIndex) => {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        const record = attendance[dateStr]?.[emp.id];
        const status = typeof record === 'string' ? record : record?.status;
        const obs = typeof record === 'object' ? record?.observation : null;
        
        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
        const cell = row.getCell(dateIndex + 3);
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        
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
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE699' } }; // yellow
            cell.font = { color: { argb: 'FFC65911' }, name: 'Calibri', size: 10 };
          } else if (status === 'suspension') {
            cell.value = 'S';
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
            cell.font = { color: { argb: 'FF000000' }, name: 'Calibri', size: 10 };
          }
        }
      });
    });

    const footerRow = worksheet.addRow({});
    footerRow.height = 20;
    worksheet.mergeCells(`A${footerRow.number}:G${footerRow.number}`);
    const footerTitle = footerRow.getCell(1);
    footerTitle.value = "TOTAL GERAL DE FALTAS (Não Justificadas)";
    footerTitle.font = { bold: true, name: 'Calibri', size: 10 };
    footerTitle.alignment = { horizontal: 'right', vertical: 'middle', indent: 1 };
    
    worksheet.mergeCells(`H${footerRow.number}:${footerRow.getCell(days.length + 7).address}`);
    const footerValue = footerRow.getCell(8);
    const totalFaltas = filteredData.reduce((acc, item) => acc + item.absences, 0);
    const totalMeias = filteredData.reduce((acc, item) => acc + item.half_presences, 0);
    footerValue.value = `${totalFaltas} Faltas inteiras e ${totalMeias} Meias-faltas`;
    footerValue.font = { bold: true, color: { argb: 'FFC00000' }, name: 'Calibri', size: 10 };
    footerValue.alignment = { vertical: 'middle', indent: 1 };

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `relatorio_presenca_${monthStr}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Relatórios e Fechamento</h1>
          <p className="text-muted-foreground mt-2">Resumo de frequência mensal para a folha de pagamento.</p>
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
                    <TableHead className="text-right font-bold text-primary">Dias Trabalhados</TableHead>
                  </TableRow>
                ) : (
                  <TableRow>
                    <TableHead className="sticky left-0 z-20 bg-slate-50 dark:bg-slate-900 min-w-[200px] border-r">Funcionário</TableHead>
                    <TableHead className="bg-slate-50 dark:bg-slate-900 min-w-[120px] border-r text-center">Cargo</TableHead>
                    <TableHead className="bg-slate-50 dark:bg-slate-900 min-w-[80px] border-r text-center">VR</TableHead>
                    <TableHead className="bg-slate-50 dark:bg-slate-900 min-w-[100px] border-r text-center">Bruto Mês</TableHead>
                    <TableHead className="bg-slate-50 dark:bg-slate-900 min-w-[100px] border-r text-center">Líquido Mês</TableHead>
                    <TableHead className="bg-slate-50 dark:bg-slate-900 min-w-[100px] border-r text-center">Pago Mês</TableHead>
                    {days.map(date => (
                      <TableHead key={date.toISOString()} className="text-center w-12 border-r px-1 last:border-0">
                        <div className="flex flex-col items-center">
                          <span className="text-xs font-bold leading-none">{date.getDate()}</span>
                          <span className="text-[10px] text-muted-foreground mt-1">{dayNames[date.getDay()]}</span>
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                )}
              </TableHeader>
              <TableBody>
                {filteredData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={viewMode === 'resumo' ? 7 : days.length + 1} className="text-center py-6 text-muted-foreground">
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
                          <TableCell className="text-right font-bold text-primary">
                            {diasTrabalhados.toFixed(1).replace('.0', '')}
                          </TableCell>
                        </TableRow>
                      );
                    } else {
                      const empPayments = payments.filter(p => p.employee_id === item.id && p.period_month === month + 1 && p.period_year === year);
                      const brutoMes = empPayments.reduce((acc, p) => acc + p.gross_amount, 0);
                      const liquidoMes = empPayments.reduce((acc, p) => acc + p.net_amount, 0);
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
                            {brutoMes > 0 ? `R$ ${brutoMes.toFixed(2)}` : "—"}
                          </TableCell>
                          <TableCell className="border-r text-center font-mono text-xs">
                            {liquidoMes > 0 ? `R$ ${liquidoMes.toFixed(2)}` : "—"}
                          </TableCell>
                          <TableCell className="border-r text-center font-mono text-xs">
                            {pagoMes > 0 ? (
                              <span className={pagoMes >= liquidoMes && liquidoMes > 0 ? "text-emerald-600 font-bold" : "text-orange-600"}>
                                R$ {pagoMes.toFixed(2)}
                              </span>
                            ) : "—"}
                          </TableCell>
                          {days.map(date => {
                            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                            const record = attendance[dateStr]?.[item.id];
                            const status = typeof record === 'string' ? record : record?.status;
                            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                            
                            let bg = isWeekend ? 'bg-muted/50' : '';
                            let text = '';
                            let textClass = '';

                            if (status === 'presence') { bg = 'bg-emerald-100 dark:bg-emerald-900/30'; text = 'P'; textClass = 'text-emerald-700 dark:text-emerald-400'; }
                            else if (status === 'absence') { bg = 'bg-red-100 dark:bg-red-900/30'; text = 'F'; textClass = 'text-red-700 dark:text-red-400'; }
                            else if (status === 'justified_absence') { bg = 'bg-yellow-100 dark:bg-yellow-900/30'; text = 'FJ'; textClass = 'text-yellow-700 dark:text-yellow-400'; }
                            else if (status === 'half_presence') { bg = 'bg-orange-100 dark:bg-orange-900/30'; text = 'M'; textClass = 'text-orange-700 dark:text-orange-400'; }
                            else if (status === 'suspension') { bg = 'bg-gray-200 dark:bg-gray-800'; text = 'S'; textClass = 'text-gray-700 dark:text-gray-300'; }
                            
                            return (
                              <TableCell key={date.toISOString()} className={`text-center p-1 border-r last:border-0 ${bg}`}>
                                {text ? (
                                  <div className={`w-7 h-7 flex items-center justify-center font-bold text-xs mx-auto rounded ${textClass}`}>
                                    {text}
                                  </div>
                                ) : (
                                  <div className="w-7 h-7 mx-auto" />
                                )}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      );
                    }
                  })
                )}
                {viewMode === 'espelho' && filteredData.length > 0 && (
                  <TableRow className="bg-slate-100 dark:bg-slate-800 font-bold hover:bg-slate-100 dark:hover:bg-slate-800">
                    <TableCell colSpan={6} className="sticky left-0 z-20 bg-slate-100 dark:bg-slate-800 text-right border-r px-4 py-3">
                      TOTAL GERAL DE FALTAS (Não Justificadas)
                    </TableCell>
                    <TableCell colSpan={days.length} className="text-left px-4 text-red-600 dark:text-red-400">
                      {filteredData.reduce((acc, item) => acc + item.absences, 0)} Faltas inteiras e {filteredData.reduce((acc, item) => acc + item.half_presences, 0)} Meias-faltas
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
