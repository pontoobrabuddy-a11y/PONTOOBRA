"use client";

import { useState, useMemo } from "react";
import { useStore } from "@/store/useStore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, FileText, Search, LayoutGrid, List } from "lucide-react";
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

export default function RelatoriosPage() {
  const { employees, attendance } = useStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [teamFilter, setTeamFilter] = useState("all");
  const [monthStr, setMonthStr] = useState<string>("2026-06");
  const [viewMode, setViewMode] = useState<'resumo' | 'espelho'>('resumo');

  const [yearStr, mStr] = monthStr.split('-');
  const year = parseInt(yearStr);
  const month = parseInt(mStr) - 1; // 0-indexed
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1));
  const dayNames = ["dom.", "seg.", "ter.", "qua.", "qui.", "sex.", "sáb."];

  // Calculate aggregated data for the selected month
  const reportData = useMemo(() => {
    return employees.map(emp => {
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

  const filteredData = reportData.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTeam = teamFilter === "all" || item.team === teamFilter;
    return matchesSearch && matchesTeam;
  });

  const exportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Fechamento");

    // Setup Columns
    const columns = [
      { header: "", key: "n", width: 5 },
      { header: "", key: "name", width: 40 },
    ];
    
    days.forEach(date => {
      columns.push({ header: "", key: `day_${date.getDate()}`, width: 5.5 });
    });
    
    worksheet.columns = columns as any;

    // Row 1: Headers (Dates)
    const headerRow1 = worksheet.getRow(1);
    headerRow1.height = 20;
    worksheet.mergeCells('A1:B1');
    const titleCell = headerRow1.getCell(1);
    titleCell.value = "TRABALHADORES GERAIS DA OBRA";
    titleCell.font = { color: { argb: 'FFFFFFFF' }, bold: true, name: 'Calibri' };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    days.forEach((date, index) => {
      const cell = headerRow1.getCell(index + 3);
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

    days.forEach((date, index) => {
      const cell = headerRow2.getCell(index + 3);
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
      const row = worksheet.addRow({ n: rowIdx++, name: emp.name });
      row.height = 18;

      const nCellRow = row.getCell(1);
      nCellRow.alignment = { horizontal: 'center', vertical: 'middle' };
      nCellRow.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      
      const nameCellRow = row.getCell(2);
      nameCellRow.font = { bold: true, name: 'Calibri', size: 10 };
      nameCellRow.alignment = { vertical: 'middle', indent: 1 };
      nameCellRow.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      
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
              <Select value={teamFilter} onValueChange={(v) => setTeamFilter(v || '')}>
                <SelectTrigger>
                  <SelectValue placeholder="Equipe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Equipes</SelectItem>
                  <SelectItem value="Alvenaria">Alvenaria</SelectItem>
                  <SelectItem value="Elétrica">Elétrica</SelectItem>
                  <SelectItem value="Hidráulica">Hidráulica</SelectItem>
                  <SelectItem value="Acabamento">Acabamento</SelectItem>
                  <SelectItem value="Geral">Geral</SelectItem>
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
                    <TableHead>Equipe</TableHead>
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
                    <TableCell colSpan={viewMode === 'resumo' ? 8 : days.length + 1} className="text-center py-6 text-muted-foreground">
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
                          <TableCell>{item.team}</TableCell>
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
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="sticky left-0 z-20 bg-background font-medium border-r truncate max-w-[250px]" title={item.name}>
                            {item.name}
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
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
