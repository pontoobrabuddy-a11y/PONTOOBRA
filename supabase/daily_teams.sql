-- Tabela para o Módulo de Equipes & Tarefas Diárias (Completa)
CREATE TABLE IF NOT EXISTS public.daily_teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    name TEXT NOT NULL,
    employee_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    task_description TEXT NOT NULL DEFAULT '',
    location TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'em_andamento',
    notes TEXT DEFAULT '',
    is_hidden BOOLEAN DEFAULT false,
    engineer_name TEXT DEFAULT '',
    supervisor_name TEXT DEFAULT '',
    parent_team_id TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Se você já criou a tabela antes, rode estes comandos para adicionar os novos campos:
ALTER TABLE public.daily_teams ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT false;
ALTER TABLE public.daily_teams ADD COLUMN IF NOT EXISTS engineer_name TEXT DEFAULT '';
ALTER TABLE public.daily_teams ADD COLUMN IF NOT EXISTS supervisor_name TEXT DEFAULT '';
ALTER TABLE public.daily_teams ADD COLUMN IF NOT EXISTS parent_team_id TEXT DEFAULT '';

-- Ativar Row Level Security (RLS)
ALTER TABLE public.daily_teams ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso para o sistema
CREATE POLICY "Allow read daily_teams" ON public.daily_teams FOR SELECT USING (true);
CREATE POLICY "Allow insert daily_teams" ON public.daily_teams FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update daily_teams" ON public.daily_teams FOR UPDATE USING (true);
CREATE POLICY "Allow delete daily_teams" ON public.daily_teams FOR DELETE USING (true);
