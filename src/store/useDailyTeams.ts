import { create } from 'zustand';
import { createClient } from '@/lib/supabase/client';

export type DailyTeamStatus = 'pendente' | 'em_andamento' | 'concluida';

export interface DailyTeam {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
  employee_ids: string[];
  task_description: string;
  location?: string;
  status: DailyTeamStatus;
  notes?: string;
  is_hidden?: boolean; // Ocultar da visão diária padrão (equipes fixas/rotineiras como compras)
  engineer_name?: string; // Engenheiro Responsável
  supervisor_name?: string; // Encarregado / Mestre Responsável
  parent_team_id?: string; // Equipe Líder / Frente Vinculada (opcional)
  created_at?: string;
  updated_at?: string;
}

interface DailyTeamsState {
  teams: DailyTeam[];
  isLoading: boolean;
  error: string | null;
  fetchTeamsForDate: (date: string) => Promise<DailyTeam[]>;
  createTeam: (team: Omit<DailyTeam, 'id' | 'created_at' | 'updated_at'>) => Promise<DailyTeam>;
  updateTeam: (id: string, updates: Partial<DailyTeam>) => Promise<void>;
  deleteTeam: (id: string) => Promise<void>;
  cloneTeamsFromDate: (sourceDate: string, targetDate: string) => Promise<number>;
  toggleTeamStatus: (id: string) => Promise<void>;
  toggleTeamHidden: (id: string) => Promise<void>;
}

const LOCAL_STORAGE_KEY = 'ponto_daily_teams_cache_v1';

const getLocalTeams = (): DailyTeam[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveLocalTeams = (teams: DailyTeam[]) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(teams));
  } catch (e) {
    console.error('Erro ao salvar equipes no localStorage:', e);
  }
};

export const useDailyTeams = create<DailyTeamsState>()((set, get) => ({
  teams: [],
  isLoading: false,
  error: null,

  fetchTeamsForDate: async (date: string) => {
    set({ isLoading: true, error: null });
    const localTeams = getLocalTeams();
    const currentCached = localTeams.filter(t => t.date === date);

    // Initial local cache hydration
    set({ teams: currentCached, isLoading: true });

    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('daily_teams')
        .select('*')
        .eq('date', date)
        .order('created_at', { ascending: true });

      if (error) {
        // Table might not exist yet in Supabase or connection issue; fallback to local
        console.warn('daily_teams Supabase aviso/fallback:', error.message);
        set({ teams: currentCached, isLoading: false });
        return currentCached;
      }

      const formatted: DailyTeam[] = (data || []).map((row: any) => ({
        id: row.id,
        date: row.date,
        name: row.name,
        employee_ids: Array.isArray(row.employee_ids) ? row.employee_ids : [],
        task_description: row.task_description || '',
        location: row.location || '',
        status: (row.status as DailyTeamStatus) || 'em_andamento',
        notes: row.notes || '',
        is_hidden: Boolean(row.is_hidden),
        engineer_name: row.engineer_name || '',
        supervisor_name: row.supervisor_name || '',
        parent_team_id: row.parent_team_id || '',
        created_at: row.created_at,
        updated_at: row.updated_at,
      }));

      // Merge into local storage for this date
      const others = localTeams.filter(t => t.date !== date);
      saveLocalTeams([...others, ...formatted]);

      set({ teams: formatted, isLoading: false });
      return formatted;
    } catch (err: any) {
      console.warn('Erro ao consultar Supabase daily_teams, usando local:', err);
      set({ teams: currentCached, isLoading: false });
      return currentCached;
    }
  },

  createTeam: async (teamData) => {
    const tempId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `team_${Date.now()}`;
    const now = new Date().toISOString();
    const newTeam: DailyTeam = {
      ...teamData,
      id: tempId,
      is_hidden: Boolean(teamData.is_hidden),
      engineer_name: teamData.engineer_name || '',
      supervisor_name: teamData.supervisor_name || '',
      parent_team_id: teamData.parent_team_id || '',
      created_at: now,
      updated_at: now,
    };

    // Update state & local storage immediately
    const current = get().teams;
    const updated = [...current, newTeam];
    set({ teams: updated });

    const allLocal = getLocalTeams();
    saveLocalTeams([...allLocal.filter(t => t.id !== newTeam.id), newTeam]);

    // Try Supabase insert
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('daily_teams')
        .insert([{
          id: tempId,
          date: teamData.date,
          name: teamData.name,
          employee_ids: teamData.employee_ids,
          task_description: teamData.task_description,
          location: teamData.location || '',
          status: teamData.status || 'em_andamento',
          notes: teamData.notes || '',
          is_hidden: Boolean(teamData.is_hidden),
          engineer_name: teamData.engineer_name || '',
          supervisor_name: teamData.supervisor_name || '',
          parent_team_id: teamData.parent_team_id || '',
        }])
        .select()
        .single();

      if (!error && data) {
        const syncedTeam: DailyTeam = {
          id: data.id,
          date: data.date,
          name: data.name,
          employee_ids: Array.isArray(data.employee_ids) ? data.employee_ids : [],
          task_description: data.task_description || '',
          location: data.location || '',
          status: (data.status as DailyTeamStatus) || 'em_andamento',
          notes: data.notes || '',
          is_hidden: Boolean(data.is_hidden),
          engineer_name: data.engineer_name || '',
          supervisor_name: data.supervisor_name || '',
          parent_team_id: data.parent_team_id || '',
          created_at: data.created_at,
          updated_at: data.updated_at,
        };
        const syncedList = get().teams.map(t => t.id === tempId ? syncedTeam : t);
        set({ teams: syncedList });
        const currentAll = getLocalTeams().map(t => t.id === tempId ? syncedTeam : t);
        saveLocalTeams(currentAll);
        return syncedTeam;
      }
    } catch (err) {
      console.warn('Erro ao salvar equipe no Supabase, mantido em cache local:', err);
    }

    return newTeam;
  },

  updateTeam: async (id: string, updates: Partial<DailyTeam>) => {
    const current = get().teams;
    const now = new Date().toISOString();
    const updated = current.map(t => t.id === id ? { ...t, ...updates, updated_at: now } : t);
    set({ teams: updated });

    const allLocal = getLocalTeams();
    saveLocalTeams(allLocal.map(t => t.id === id ? { ...t, ...updates, updated_at: now } : t));

    try {
      const supabase = createClient();
      const payload: any = { updated_at: now };
      if (updates.name !== undefined) payload.name = updates.name;
      if (updates.employee_ids !== undefined) payload.employee_ids = updates.employee_ids;
      if (updates.task_description !== undefined) payload.task_description = updates.task_description;
      if (updates.location !== undefined) payload.location = updates.location;
      if (updates.status !== undefined) payload.status = updates.status;
      if (updates.notes !== undefined) payload.notes = updates.notes;
      if (updates.is_hidden !== undefined) payload.is_hidden = updates.is_hidden;
      if (updates.engineer_name !== undefined) payload.engineer_name = updates.engineer_name;
      if (updates.supervisor_name !== undefined) payload.supervisor_name = updates.supervisor_name;
      if (updates.parent_team_id !== undefined) payload.parent_team_id = updates.parent_team_id;

      await supabase.from('daily_teams').update(payload).eq('id', id);
    } catch (err) {
      console.warn('Erro ao atualizar equipe no Supabase, mantido local:', err);
    }
  },

  deleteTeam: async (id: string) => {
    const current = get().teams;
    set({ teams: current.filter(t => t.id !== id) });

    const allLocal = getLocalTeams();
    saveLocalTeams(allLocal.filter(t => t.id !== id));

    try {
      const supabase = createClient();
      await supabase.from('daily_teams').delete().eq('id', id);
    } catch (err) {
      console.warn('Erro ao remover equipe no Supabase:', err);
    }
  },

  cloneTeamsFromDate: async (sourceDate: string, targetDate: string) => {
    let sourceTeams: DailyTeam[] = [];
    try {
      const supabase = createClient();
      const { data } = await supabase.from('daily_teams').select('*').eq('date', sourceDate);
      if (data && data.length > 0) {
        sourceTeams = data.map((r: any) => ({
          id: r.id,
          date: r.date,
          name: r.name,
          employee_ids: Array.isArray(r.employee_ids) ? r.employee_ids : [],
          task_description: r.task_description || '',
          location: r.location || '',
          status: 'em_andamento' as DailyTeamStatus,
          notes: r.notes || '',
          is_hidden: Boolean(r.is_hidden),
          engineer_name: r.engineer_name || '',
          supervisor_name: r.supervisor_name || '',
          parent_team_id: r.parent_team_id || '',
        }));
      }
    } catch {
      // fallback to local
    }

    if (sourceTeams.length === 0) {
      const allLocal = getLocalTeams();
      sourceTeams = allLocal.filter(t => t.date === sourceDate);
    }

    if (sourceTeams.length === 0) {
      return 0;
    }

    let clonedCount = 0;
    for (const st of sourceTeams) {
      await get().createTeam({
        date: targetDate,
        name: st.name,
        employee_ids: [...st.employee_ids],
        task_description: st.task_description,
        location: st.location || '',
        status: 'em_andamento',
        notes: st.notes || '',
        is_hidden: Boolean(st.is_hidden),
        engineer_name: st.engineer_name || '',
        supervisor_name: st.supervisor_name || '',
        parent_team_id: st.parent_team_id || '',
      });
      clonedCount++;
    }

    return clonedCount;
  },

  toggleTeamStatus: async (id: string) => {
    const team = get().teams.find(t => t.id === id);
    if (!team) return;

    let nextStatus: DailyTeamStatus = 'em_andamento';
    if (team.status === 'em_andamento') nextStatus = 'concluida';
    else if (team.status === 'concluida') nextStatus = 'pendente';
    else if (team.status === 'pendente') nextStatus = 'em_andamento';

    await get().updateTeam(id, { status: nextStatus });
  },

  toggleTeamHidden: async (id: string) => {
    const team = get().teams.find(t => t.id === id);
    if (!team) return;
    await get().updateTeam(id, { is_hidden: !team.is_hidden });
  },
}));
