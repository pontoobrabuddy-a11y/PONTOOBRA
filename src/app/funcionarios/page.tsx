"use client";

import { useState } from "react";
import { useStore, Employee } from "@/store/useStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit2, Trash2 } from "lucide-react";

export default function FuncionariosPage() {
  const { employees, addEmployee, updateEmployee, deleteEmployee } = useStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isNewTeam, setIsNewTeam] = useState(false);
  
  const [formData, setFormData] = useState({
    name: "", cpf: "", phone: "", role: "", team: "", admission_date: "", status: "ativo" as 'ativo' | 'inativo'
  });

  const filteredEmployees = employees.filter(emp => 
    emp.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    emp.cpf.includes(searchTerm) ||
    emp.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openAddDialog = () => {
    setEditingId(null);
    setFormData({ name: "", cpf: "", phone: "", role: "", team: "", admission_date: "", status: "ativo" });
    setIsNewTeam(false);
    setIsDialogOpen(true);
  };

  const openEditDialog = (emp: Employee) => {
    setEditingId(emp.id);
    setFormData({ ...emp });
    setIsNewTeam(false);
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (!formData.name || !formData.role || !formData.team) {
      alert("Preencha os campos obrigatórios (Nome, Cargo, Equipe).");
      return;
    }
    
    if (editingId) {
      updateEmployee(editingId, formData);
    } else {
      addEmployee(formData);
    }
    setIsDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    if (confirm("Tem certeza que deseja remover este funcionário?")) {
      deleteEmployee(id);
    }
  };

  const defaultTeams = ["Alvenaria", "Elétrica", "Hidráulica", "Acabamento", "Geral"];
  const uniqueTeams = Array.from(new Set([...defaultTeams, ...employees.map(e => e.team)])).filter(Boolean);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Funcionários</h1>
          <p className="text-muted-foreground mt-2">Gerencie os trabalhadores da obra.</p>
        </div>
        <Button onClick={openAddDialog} className="bg-primary hover:bg-primary/90 text-white">
          <Plus className="mr-2 h-4 w-4" /> Novo Funcionário
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Funcionários</CardTitle>
          <div className="pt-4">
            <div className="relative max-w-md">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, CPF ou cargo..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50 dark:bg-slate-900">
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Cargo / Equipe</TableHead>
                  <TableHead className="hidden md:table-cell">CPF</TableHead>
                  <TableHead className="hidden md:table-cell">Admissão</TableHead>
                  <TableHead className="hidden md:table-cell">Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                      Nenhum funcionário encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEmployees.map((emp) => (
                    <TableRow key={emp.id}>
                      <TableCell className="font-medium">{emp.name}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span>{emp.role}</span>
                          <span className="text-xs text-muted-foreground">{emp.team}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{emp.cpf || "-"}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        {emp.admission_date ? new Date(emp.admission_date).toLocaleDateString('pt-BR') : "-"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant={emp.status === 'ativo' ? 'default' : 'secondary'} 
                               className={emp.status === 'ativo' ? 'bg-emerald-500 hover:bg-emerald-600' : ''}>
                          {emp.status === 'ativo' ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(emp)}>
                          <Edit2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(emp.id)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Funcionário" : "Novo Funcionário"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">Nome *</Label>
              <Input id="name" className="col-span-3" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="cpf" className="text-right">CPF</Label>
              <Input id="cpf" className="col-span-3" value={formData.cpf} onChange={e => setFormData({...formData, cpf: e.target.value})} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="phone" className="text-right">Telefone</Label>
              <Input id="phone" className="col-span-3" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="role" className="text-right">Cargo *</Label>
              <Input id="role" className="col-span-3" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="team" className="text-right">Equipe *</Label>
              <div className="col-span-3 space-y-2">
                <Select value={isNewTeam ? 'nova_equipe' : formData.team} onValueChange={v => {
                  if (v === 'nova_equipe') {
                    setIsNewTeam(true);
                    setFormData({...formData, team: ''});
                  } else {
                    setIsNewTeam(false);
                    setFormData({...formData, team: v});
                  }
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a equipe" />
                  </SelectTrigger>
                  <SelectContent>
                    {uniqueTeams.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                    <SelectItem value="nova_equipe" className="text-emerald-600 font-medium">+ Adicionar nova equipe</SelectItem>
                  </SelectContent>
                </Select>
                
                {isNewTeam && (
                  <Input 
                    placeholder="Digite o nome da nova equipe" 
                    value={formData.team} 
                    onChange={e => setFormData({...formData, team: e.target.value})} 
                    autoFocus
                  />
                )}
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="date" className="text-right">Admissão</Label>
              <Input id="date" type="date" className="col-span-3" value={formData.admission_date} onChange={e => setFormData({...formData, admission_date: e.target.value})} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="status" className="text-right">Status</Label>
              <Select value={formData.status} onValueChange={v => setFormData({...formData, status: v as 'ativo'|'inativo'})}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
