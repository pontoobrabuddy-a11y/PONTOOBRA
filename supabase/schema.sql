-- Schema for Construction Attendance App

-- Enum for employee status
CREATE TYPE public.employee_status AS ENUM ('ativo', 'inativo');

-- Enum for attendance status
CREATE TYPE public.attendance_status AS ENUM ('presence', 'absence', 'justified_absence', 'half_presence', 'suspension');

-- Teams
CREATE TABLE public.teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Employees
CREATE TABLE public.employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    cpf TEXT UNIQUE,
    phone TEXT,
    role TEXT NOT NULL,
    admission_date DATE NOT NULL,
    status public.employee_status DEFAULT 'ativo' NOT NULL,
    team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Attendance Records
CREATE TABLE public.attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,
    status public.attendance_status NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(employee_id, date)
);

-- Enable Row Level Security
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Simplified RLS Policies for development (Authenticated users have full access)
CREATE POLICY "Allow all authenticated users to read teams" ON public.teams FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow all authenticated users to insert teams" ON public.teams FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow all authenticated users to update teams" ON public.teams FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow all authenticated users to delete teams" ON public.teams FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow all authenticated users to read employees" ON public.employees FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow all authenticated users to insert employees" ON public.employees FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow all authenticated users to update employees" ON public.employees FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow all authenticated users to read attendance" ON public.attendance FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow all authenticated users to insert attendance" ON public.attendance FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow all authenticated users to update attendance" ON public.attendance FOR UPDATE TO authenticated USING (true);
