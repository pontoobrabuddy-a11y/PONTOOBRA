import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type EmployeeStatus = 'ativo' | 'inativo';

export interface Employee {
  id: string;
  name: string;
  cpf: string;
  phone: string;
  role: string;
  admission_date: string;
  status: EmployeeStatus;
  team: string;
}

export type Status = "presence" | "absence" | "justified_absence" | "half_presence" | "suspension" | null;

export interface AttendanceRecord {
  status: Status;
  observation?: string;
}

interface AppState {
  employees: Employee[];
  attendance: Record<string, Record<string, AttendanceRecord | Status>>; // date -> employeeId -> record
  addEmployee: (emp: Omit<Employee, 'id'>) => void;
  updateEmployee: (id: string, data: Partial<Employee>) => void;
  deleteEmployee: (id: string) => void;
  saveAttendance: (date: string, data: Record<string, AttendanceRecord>) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      employees: [
        { id: "1", name: "LUAN HENRIQUE LIMA DE VASCONCELOS", cpf: "111.111.111-11", phone: "(11) 99999-9999", role: "Pedreiro", admission_date: "2026-01-10", status: "ativo", team: "Alvenaria" },
        { id: "2", name: "VICTOR WAGNER ROCHA DO NASCIMENTO", cpf: "222.222.222-22", phone: "(11) 88888-8888", role: "Ajudante", admission_date: "2026-02-15", status: "ativo", team: "Alvenaria" },
        { id: "3", name: "FELIPE MOURA DA COSTA", cpf: "333.333.333-33", phone: "", role: "Eletricista", admission_date: "2026-03-01", status: "ativo", team: "Elétrica" },
        { id: "4", name: "FCO WENDERSON MARTINS DO SANTOS", cpf: "444.444.444-44", phone: "", role: "Encanador", admission_date: "2026-01-20", status: "ativo", team: "Hidráulica" },
      ],
      attendance: {},
      addEmployee: (emp) => set((state) => ({ 
        employees: [...state.employees, { ...emp, id: Date.now().toString() }] 
      })),
      updateEmployee: (id, data) => set((state) => ({
        employees: state.employees.map(emp => emp.id === id ? { ...emp, ...data } : emp)
      })),
      deleteEmployee: (id) => set((state) => ({
        employees: state.employees.filter(emp => emp.id !== id)
      })),
      saveAttendance: (date, data) => set((state) => ({
        attendance: { ...state.attendance, [date]: { ...state.attendance[date], ...data } }
      })),
    }),
    {
      name: 'ponto-obra-storage',
    }
  )
);
