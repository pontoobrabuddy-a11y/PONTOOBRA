import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

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
  attendance: Record<string, Record<string, AttendanceRecord | Status>>;
  draftAttendance: Record<string, Record<string, AttendanceRecord>>;
  isLoading: boolean;
  fetchData: () => Promise<void>;
  addEmployee: (emp: Omit<Employee, 'id'>) => Promise<void>;
  updateEmployee: (id: string, data: Partial<Employee>) => Promise<void>;
  deleteEmployee: (id: string) => Promise<void>;
  saveAttendance: (date: string, data: Record<string, AttendanceRecord>) => Promise<void>;
  setDraftAttendance: (date: string, data: Record<string, AttendanceRecord>) => void;
}

export const useStore = create<AppState>()((set, get) => ({
  employees: [],
  attendance: {},
  draftAttendance: {},
  isLoading: true,

  fetchData: async () => {
    set({ isLoading: true });
    
    // Fetch employees
    const { data: empData, error: empError } = await supabase.from('employees').select('*');
    if (empError) console.error("Error fetching employees:", empError);
    
    // Fetch attendance
    const { data: attData, error: attError } = await supabase.from('attendance').select('*');
    if (attError) console.error("Error fetching attendance:", attError);

    // Transform attendance data
    const attendanceRecord: Record<string, Record<string, AttendanceRecord>> = {};
    if (attData) {
      attData.forEach(item => {
        if (!attendanceRecord[item.date]) {
          attendanceRecord[item.date] = {};
        }
        attendanceRecord[item.date][item.employee_id] = {
          status: item.status as Status,
          observation: item.observation || undefined
        };
      });
    }

    set({ 
      employees: empData || [], 
      attendance: attendanceRecord,
      isLoading: false 
    });
  },

  addEmployee: async (emp) => {
    const { data, error } = await supabase.from('employees').insert([emp]).select().single();
    if (error) {
      console.error("Error adding employee:", error);
      return;
    }
    if (data) {
      set((state) => ({ employees: [...state.employees, data] }));
    }
  },

  updateEmployee: async (id, data) => {
    const { error } = await supabase.from('employees').update(data).eq('id', id);
    if (error) {
      console.error("Error updating employee:", error);
      return;
    }
    set((state) => ({
      employees: state.employees.map(e => e.id === id ? { ...e, ...data } : e)
    }));
  },

  deleteEmployee: async (id) => {
    const { error } = await supabase.from('employees').delete().eq('id', id);
    if (error) {
      console.error("Error deleting employee:", error);
      return;
    }
    set((state) => ({
      employees: state.employees.filter(e => e.id !== id)
    }));
  },

  saveAttendance: async (date, data) => {
    const upserts = Object.keys(data).map(employeeId => ({
      date,
      employee_id: employeeId,
      status: data[employeeId].status,
      observation: data[employeeId].observation || null
    }));

    if (upserts.length === 0) return;

    const { error } = await supabase
      .from('attendance')
      .upsert(upserts, { onConflict: 'date,employee_id' });

    if (error) {
      console.error("Error saving attendance:", error);
      return;
    }

    set((state) => ({
      attendance: { ...state.attendance, [date]: { ...state.attendance[date], ...data } },
      draftAttendance: { ...state.draftAttendance, [date]: {} } // limpa o rascunho após salvar
    }));
  },

  setDraftAttendance: (date, data) => set((state) => ({
    draftAttendance: { ...state.draftAttendance, [date]: { ...state.draftAttendance[date], ...data } }
  })),
}));
