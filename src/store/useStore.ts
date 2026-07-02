import { create } from 'zustand';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

export type EmployeeStatus = 'ativo' | 'inativo' | 'aviso_previo';

export interface Employee {
  id: string;
  name: string;
  cpf: string;
  phone: string;
  role: string;
  admission_date: string;
  status: EmployeeStatus;
  team: string;
  // Novos campos — todos opcionais
  employee_number?: string;
  nickname?: string;
  salary?: number;
  pagador?: 'BUDDY' | 'CASANA';
  employment_type?: 'CLT' | 'PJ' | 'MEI' | 'Avulso';
  pix_type?: 'CPF' | 'CNPJ' | 'Telefone' | 'Email' | 'Aleatoria';
  pix_key?: string;
  dismissal_date?: string;
  notice_start_date?: string;
  notice_end_date?: string;
  last_work_date?: string;
  dismissal_type?: 'pedido_com' | 'pedido_sem' | 'empresa_com' | 'empresa_sem';
  salary_family?: boolean;
  photo_url?: string;
}

export type Status = "presence" | "absence" | "justified_absence" | "half_presence" | "suspension" | null;

export interface AttendanceRecord {
  status: Status;
  observation?: string;
}

export interface Payment {
  id: string;
  employee_id: string;
  period_month: number;
  period_year: number;
  payment_type: 'quinzena1' | 'quinzena2' | 'mensal';
  gross_amount: number;
  net_amount: number;
  paid: boolean;
  paid_at?: string;
  receipt_url?: string;
  created_at?: string;
}

export interface Tax {
  id: string;
  name: string;
  company: 'BUDDY' | 'CASANA';
  amount: number;
  due_date: string;
  paid_at?: string;
  competence_month: number;
  competence_year: number;
  created_at?: string;
}

export interface SalaryHistory {
  id: string;
  employee_id: string;
  old_salary: number;
  new_salary: number;
  effective_date: string;
  notes?: string;
  created_at?: string;
}

interface AppState {
  employees: Employee[];
  attendance: Record<string, Record<string, AttendanceRecord | Status>>;
  draftAttendance: Record<string, Record<string, AttendanceRecord>>;
  isLoading: boolean;
  payments: Payment[];
  taxes: Tax[];
  salaryHistory: SalaryHistory[];

  fetchData: () => Promise<void>;
  addEmployee: (emp: Omit<Employee, 'id'>) => Promise<void>;
  updateEmployee: (id: string, data: Partial<Employee>) => Promise<void>;
  deleteEmployee: (id: string) => Promise<void>;
  saveAttendance: (date: string, data: Record<string, AttendanceRecord>) => Promise<void>;
  setDraftAttendance: (date: string, data: Record<string, AttendanceRecord>) => void;

  fetchPayments: () => Promise<void>;
  addPayment: (p: Omit<Payment, 'id' | 'created_at'>) => Promise<void>;
  updatePayment: (id: string, data: Partial<Payment>) => Promise<void>;
  deletePayment: (id: string) => Promise<void>;

  fetchTaxes: () => Promise<void>;
  addTax: (t: Omit<Tax, 'id' | 'created_at'>) => Promise<void>;
  updateTax: (id: string, data: Partial<Tax>) => Promise<void>;
  deleteTax: (id: string) => Promise<void>;

  addSalaryHistory: (s: Omit<SalaryHistory, 'id' | 'created_at'>) => Promise<void>;
}

export const useStore = create<AppState>()((set, get) => ({
  employees: [],
  attendance: {},
  draftAttendance: {},
  isLoading: true,
  payments: [],
  taxes: [],
  salaryHistory: [],

  fetchData: async () => {
    set({ isLoading: true });

    // Fetch employees
    const { data: empData, error: empError } = await supabase.from('employees').select('*').order('employee_number', { ascending: true, nullsFirst: false });
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
      draftAttendance: { ...state.draftAttendance, [date]: {} }
    }));
  },

  setDraftAttendance: (date, data) => set((state) => ({
    draftAttendance: { ...state.draftAttendance, [date]: { ...state.draftAttendance[date], ...data } }
  })),

  // ─── Payments ───────────────────────────────

  fetchPayments: async () => {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .order('period_year', { ascending: false })
      .order('period_month', { ascending: false });
    if (error) {
      console.error("Error fetching payments:", error);
      return;
    }
    set({ payments: data || [] });
  },

  addPayment: async (p) => {
    const { data, error } = await supabase.from('payments').insert([p]).select().single();
    if (error) {
      console.error("Error adding payment:", error);
      return;
    }
    if (data) {
      set((state) => ({ payments: [data, ...state.payments] }));
    }
  },

  updatePayment: async (id, data) => {
    const { error } = await supabase.from('payments').update(data).eq('id', id);
    if (error) {
      console.error("Error updating payment:", error);
      return;
    }
    set((state) => ({
      payments: state.payments.map(p => p.id === id ? { ...p, ...data } : p)
    }));
  },

  deletePayment: async (id) => {
    const { error } = await supabase.from('payments').delete().eq('id', id);
    if (error) {
      console.error("Error deleting payment:", error);
      return;
    }
    set((state) => ({
      payments: state.payments.filter(p => p.id !== id)
    }));
  },

  // ─── Taxes ──────────────────────────────────

  fetchTaxes: async () => {
    const { data, error } = await supabase
      .from('taxes')
      .select('*')
      .order('due_date', { ascending: false });
    if (error) {
      console.error("Error fetching taxes:", error);
      return;
    }
    set({ taxes: data || [] });
  },

  addTax: async (t) => {
    const { data, error } = await supabase.from('taxes').insert([t]).select().single();
    if (error) {
      console.error("Error adding tax:", error);
      return;
    }
    if (data) {
      set((state) => ({ taxes: [data, ...state.taxes] }));
    }
  },

  updateTax: async (id, data) => {
    const { error } = await supabase.from('taxes').update(data).eq('id', id);
    if (error) {
      console.error("Error updating tax:", error);
      return;
    }
    set((state) => ({
      taxes: state.taxes.map(t => t.id === id ? { ...t, ...data } : t)
    }));
  },

  deleteTax: async (id) => {
    const { error } = await supabase.from('taxes').delete().eq('id', id);
    if (error) {
      console.error("Error deleting tax:", error);
      return;
    }
    set((state) => ({
      taxes: state.taxes.filter(t => t.id !== id)
    }));
  },

  // ─── Salary History ─────────────────────────

  addSalaryHistory: async (s) => {
    const { data, error } = await supabase.from('salary_history').insert([s]).select().single();
    if (error) {
      console.error("Error adding salary history:", error);
      return;
    }
    if (data) {
      set((state) => ({ salaryHistory: [data, ...state.salaryHistory] }));
    }
  },
}));
