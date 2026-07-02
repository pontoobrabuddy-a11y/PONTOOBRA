"use client";

import { useState, useMemo } from "react";
import { useStore, Employee, Status, AttendanceRecord } from "@/store/useStore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { MessageSquare } from "lucide-react";

const statusConfig = {
  presence: { label: "Presença", short: "P", color: "bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-600", dot: "bg-emerald-500" },
  absence: { label: "Falta", short: "F", color: "bg-red-500 hover:bg-red-600 text-white border-red-600", dot: "bg-red-500" },
  justified_absence: { label: "Justificada", short: "FJ", color: "bg-yellow-500 hover:bg-yellow-600 text-white border-yellow-600", dot: "bg-yellow-500" },
  half_presence: { label: "Meia Pres.", short: "M", color: "bg-orange-500 hover:bg-orange-600 text-white border-orange-600", dot: "bg-orange-500" },
  suspension: { label: "Suspensão", short: "S", color: "bg-gray-800 hover:bg-gray-900 text-white border-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600", dot: "bg-gray-800 dark:bg-gray-400" },
};

export default function ApontamentoPage() {
  const { employees, attendance, draftAttendance, setDraftAttendance, saveAttendance } = useStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  // Observation Dialog
  const [obsDialogOpen, setObsDialogOpen] = useState(false);
  const [activeEmpId, setActiveEmpId] = useState<string | null>(null);
  const [tempObs, setTempObs] = useState("");

  const isWithinLast7DaysOfNotice = (emp: Employee, dateStr: string): boolean => {
    if (emp.dismissal_type !== "empresa_com" || !emp.notice_end_date) return false;
    const end = new Date(emp.notice_end_date + "T00:00:00");
    const current = new Date(dateStr + "T00:00:00");
    const start = new Date(end);
    start.setDate(end.getDate() - 6);
    return current >= start && current <= end;
  };

  const currentAttendance = useMemo(() => {
    const loaded: Record<string, AttendanceRecord> = {};
    if (attendance[date]) {
      Object.entries(attendance[date]).forEach(([id, record]) => {
        if (typeof record === 'string') {
          loaded[id] = { status: record as Status };
        } else {
          loaded[id] = record as AttendanceRecord;
        }
      });
    }

    employees.forEach(emp => {
      if (emp.status !== "inativo" && isWithinLast7DaysOfNotice(emp, date)) {
        const currentDay = new Date(date + "T00:00:00");
        const dayOfWeek = currentDay.getDay();
        const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
        
        if (!loaded[emp.id]) {
          loaded[emp.id] = { 
            status: isWeekday ? 'presence' : 'absence',
            observation: isWeekday ? "Aviso Prévio (Dispensa de Trabalho)" : "Sábado/Domingo"
          };
        }
      }
    });

    if (draftAttendance[date]) {
      Object.entries(draftAttendance[date]).forEach(([id, record]) => {
        loaded[id] = { ...loaded[id], ...record };
      });
    }
    return loaded;
  }, [date, attendance, draftAttendance, employees]);

  const handleStatusChange = (id: string, newStatus: Status) => {
    setDraftAttendance(date, { [id]: { ...(currentAttendance[id] || {}), status: newStatus } });
  };

  const markAllAs = (status: Status) => {
    const newDrafts: Record<string, AttendanceRecord> = {};
    employees.filter(emp => emp.status !== "inativo").forEach(emp => {
      newDrafts[emp.id] = { ...(currentAttendance[emp.id] || {}), status };
    });
    setDraftAttendance(date, newDrafts);
  };

  const openObsDialog = (empId: string) => {
    setActiveEmpId(empId);
    setTempObs(currentAttendance[empId]?.observation || "");
    setObsDialogOpen(true);
  };

  const saveObservation = () => {
    if (activeEmpId) {
      setDraftAttendance(date, {
        [activeEmpId]: { ...(currentAttendance[activeEmpId] || { status: null }), observation: tempObs }
      });
    }
    setObsDialogOpen(false);
  };

  const handleSave = () => {
    const activeEmployees = employees.filter(emp => emp.status !== "inativo");
    const unrecorded = activeEmployees.filter(e => !currentAttendance[e.id] || currentAttendance[e.id].status === null);
    if (unrecorded.length > 0) {
      alert(`Atenção: ${unrecorded.length} funcionários ainda não tiveram o apontamento preenchido.`);
      return;
    }
    
    saveAttendance(date, currentAttendance);
    alert("Apontamento salvo com sucesso!");
  };

  const filteredEmployees = employees.filter(emp => 
    emp.status !== "inativo" && (
      emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.team.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Apontamento Diário</h1>
          <p className="text-muted-foreground mt-2">Registre a frequência de forma rápida.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 sm:items-end w-full md:w-auto mt-4 md:mt-0">
          <div className="grid gap-1.5 w-full sm:w-auto">
            <Label htmlFor="date">Data do Apontamento</Label>
            <Input 
              id="date" 
              type="date" 
              value={date} 
              onChange={(e) => setDate(e.target.value)} 
              className="w-full sm:w-40"
            />
          </div>
          <Button onClick={handleSave} className="w-full sm:w-auto h-10 bg-primary text-primary-foreground hover:bg-primary/90">
            Salvar Apontamento
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
            <CardTitle>Lista de Funcionários</CardTitle>
            <div className="flex gap-2 items-center">
              <span className="text-sm text-muted-foreground mr-2">Ações em lote:</span>
              <Button variant="outline" size="sm" onClick={() => markAllAs('presence')} className="text-emerald-600 border-emerald-200 hover:bg-emerald-50">
                <div className="w-2 h-2 rounded-full bg-emerald-500 mr-2" />
                Todos Presentes
              </Button>
            </div>
          </div>
          <CardDescription>
            <Input 
              placeholder="Buscar por nome ou equipe..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm mt-4"
            />
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {filteredEmployees.map((employee) => {
              const record = currentAttendance[employee.id] || {};
              const hasObs = !!record.observation;
              
              return (
                <div 
                  key={employee.id} 
                  className="flex flex-col p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors gap-3"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground leading-tight">{employee.name}</span>
                      <span className="text-xs text-muted-foreground mt-0.5">{employee.role} • {employee.team}</span>
                      {hasObs && (
                        <span className="text-xs text-blue-600 mt-1 flex items-center">
                          <MessageSquare className="w-3 h-3 mr-1" />
                          {record.observation}
                        </span>
                      )}
                    </div>
                    {/* Botão de Observação no topo direito */}
                    <Button 
                      variant="outline" 
                      size="icon" 
                      onClick={() => openObsDialog(employee.id)}
                      className={`shrink-0 h-8 w-8 ${hasObs ? 'bg-blue-50 border-blue-200 text-blue-600' : 'text-slate-400'}`}
                      title="Adicionar Observação"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  {/* Grid de botões mobile-first */}
                  <div className="grid grid-cols-5 gap-1 md:gap-2 w-full">
                    {(Object.keys(statusConfig) as Status[]).map((status) => {
                      if (!status) return null;
                      const config = statusConfig[status];
                      const isSelected = record.status === status;
                      
                      return (
                        <Button
                          key={status}
                          variant={isSelected ? "default" : "outline"}
                          size="sm"
                          onClick={() => handleStatusChange(employee.id, status)}
                          className={`transition-all h-10 md:h-9 px-0 flex items-center justify-center border font-bold text-sm md:font-medium ${
                            isSelected 
                              ? config.color 
                              : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200'
                          }`}
                        >
                          {/* Exibe a sigla em telas pequenas, e texto completo em telas médias+ */}
                          <span className="md:hidden">{config.short}</span>
                          <span className="hidden md:inline-flex items-center">
                            {!isSelected && <div className={`w-2 h-2 rounded-full mr-1.5 ${config.dot}`} />}
                            {config.label}
                          </span>
                        </Button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={obsDialogOpen} onOpenChange={setObsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Adicionar Observação</DialogTitle>
            <CardDescription>
              Insira uma nota rápida sobre a ocorrência deste funcionário hoje.
            </CardDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex flex-wrap gap-2 mb-2">
              <Badge variant="outline" className="cursor-pointer hover:bg-slate-100" onClick={() => setTempObs("Saiu no almoço e voltou")}>Saiu no almoço e voltou</Badge>
              <Badge variant="outline" className="cursor-pointer hover:bg-slate-100" onClick={() => setTempObs("Saiu no almoço (não voltou)")}>Saiu no almoço (não voltou)</Badge>
              <Badge variant="outline" className="cursor-pointer hover:bg-slate-100" onClick={() => setTempObs("Chegou atrasado")}>Chegou atrasado</Badge>
              <Badge variant="outline" className="cursor-pointer hover:bg-slate-100" onClick={() => setTempObs("Saiu mais cedo")}>Saiu mais cedo</Badge>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="obs">Observação (Livre)</Label>
              <Input
                id="obs"
                value={tempObs}
                onChange={(e) => setTempObs(e.target.value)}
                placeholder="Ex: Foi ao médico às 10h"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setObsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={saveObservation}>Salvar Nota</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
