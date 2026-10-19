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
  historyTeams: DailyTeam[];
  isLoading: boolean;
  isLoadingHistory: boolean;
  error: string | null;
  fetchTeamsForDate: (date: string) => Promise<DailyTeam[]>;
  fetchAllHistoryTeams: () => Promise<DailyTeam[]>;
  fetchPreviewTeamsForDate: (sourceDate: string) => Promise<DailyTeam[]>;
  findLastDateWithTeams: (beforeDate: string) => Promise<{ date: string; teams: DailyTeam[] } | null>;
  createTeam: (team: Omit<DailyTeam, 'id' | 'created_at' | 'updated_at'>) => Promise<DailyTeam>;
  updateTeam: (id: string, updates: Partial<DailyTeam>) => Promise<void>;
  deleteTeam: (id: string) => Promise<void>;
  cloneTeamsFromDate: (sourceDate: string, targetDate: string) => Promise<number>;
  cloneSelectedTeams: (sourceTeams: DailyTeam[], targetDate: string) => Promise<number>;
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

const mapRowToDailyTeam = (row: any): DailyTeam => ({
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
});

export const useDailyTeams = create<DailyTeamsState>()((set, get) => ({
  teams: [],
  historyTeams: [],
  isLoading: false,
  isLoadingHistory: false,
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
        console.warn('daily_teams Supabase aviso/fallback:', error.message);
        set({ teams: currentCached, isLoading: false });
        return currentCached;
      }

      const formatted: DailyTeam[] = (data || []).map(mapRowToDailyTeam);

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

  fetchAllHistoryTeams: async () => {
    set({ isLoadingHistory: true });
    const localTeams = getLocalTeams();

    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('daily_teams')
        .select('*')
        .order('date', { ascending: false })
        .order('created_at', { ascending: true });

      if (!error && data) {
        const remoteTeams = data.map(mapRowToDailyTeam);
        // Merge remote with any local-only teams
        const remoteIds = new Set(remoteTeams.map(t => t.id));
        const localOnly = localTeams.filter(t => !remoteIds.has(t.id));
        const merged = [...remoteTeams, ...localOnly].sort((a, b) => b.date.localeCompare(a.date));
        saveLocalTeams(merged);
        set({ historyTeams: merged, isLoadingHistory: false });
        return merged;
      }
    } catch (err) {
      console.warn('Fallback local para histórico de equipes:', err);
    }

    const sortedLocal = [...localTeams].sort((a, b) => b.date.localeCompare(a.date));
    set({ historyTeams: sortedLocal, isLoadingHistory: false });
    return sortedLocal;
  },

  fetchPreviewTeamsForDate: async (sourceDate: string) => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('daily_teams')
        .select('*')
        .eq('date', sourceDate)
        .order('created_at', { ascending: true });

      if (!error && data && data.length > 0) {
        return data.map(mapRowToDailyTeam);
      }
    } catch {
      // fallback
    }
    const localTeams = getLocalTeams();
    return localTeams.filter(t => t.date === sourceDate);
  },

  findLastDateWithTeams: async (beforeDate: string) => {
    try {
      const supabase = createClient();
      // Find the latest date strictly before `beforeDate`
      const { data: latestRow, error } = await supabase
        .from('daily_teams')
        .select('date')
        .lt('date', beforeDate)
        .order('date', { ascending: false })
        .limit(1);

      if (!error && latestRow && latestRow.length > 0) {
        const lastDate = latestRow[0].date;
        const { data: teamsData } = await supabase
          .from('daily_teams')
          .select('*')
          .eq('date', lastDate)
          .order('created_at', { ascending: true });

        if (teamsData && teamsData.length > 0) {
          return {
            date: lastDate,
            teams: teamsData.map(mapRowToDailyTeam),
          };
        }
      }
    } catch {
      // fallback to local storage
    }

    const localTeams = getLocalTeams().filter(t => t.date < beforeDate);
    if (localTeams.length === 0) return null;

    const dates = Array.from(new Set(localTeams.map(t => t.date))).sort().reverse();
    const lastDate = dates[0];
    return {
      date: lastDate,
      teams: localTeams.filter(t => t.date === lastDate),
    };
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
        const syncedTeam = mapRowToDailyTeam(data);
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
    const updatedHistory = get().historyTeams.map(t => t.id === id ? { ...t, ...updates, updated_at: now } : t);
    set({ teams: updated, historyTeams: updatedHistory });

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
    const currentHistory = get().historyTeams;
    set({
      teams: current.filter(t => t.id !== id),
      historyTeams: currentHistory.filter(t => t.id !== id),
    });

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
    const sourceTeams = await get().fetchPreviewTeamsForDate(sourceDate);
    if (sourceTeams.length === 0) return 0;
    return await get().cloneSelectedTeams(sourceTeams, targetDate);
  },

  cloneSelectedTeams: async (sourceTeams: DailyTeam[], targetDate: string) => {
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
