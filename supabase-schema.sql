-- ============================================================
-- LuminaFlow / TrafficLume Database Schema for Supabase
-- Paste this script into your Supabase SQL Editor and click RUN
-- ============================================================

-- 1. Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Profiles Table (linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  alert_email TEXT,
  product_updates BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Auto-create profile on auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (new.id, new.email, 'user')
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Projects Table
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  created_date TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  project_id TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'verified')),
  verified_at TIMESTAMPTZ,
  retention_days NUMERIC DEFAULT 90,
  archived BOOLEAN DEFAULT false
);

-- 4. Events Table (Pageviews & custom tracking events)
CREATE TABLE IF NOT EXISTS public.events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  project_id TEXT NOT NULL,
  type TEXT DEFAULT 'pageview' CHECK (type IN ('pageview', 'event')),
  name TEXT,
  url TEXT,
  path TEXT,
  referrer TEXT,
  referrer_domain TEXT,
  channel TEXT,
  visitor_id TEXT,
  session_id TEXT,
  timestamp TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  device TEXT,
  browser TEXT,
  os TEXT,
  country TEXT,
  region TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  screen_width NUMERIC,
  target TEXT,
  scroll_depth NUMERIC,
  engaged_seconds NUMERIC,
  properties JSONB DEFAULT '{}'::jsonb,
  revenue NUMERIC
);

CREATE INDEX IF NOT EXISTS idx_events_project_time ON public.events (project_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_events_type ON public.events (type);

-- 5. Sessions Table
CREATE TABLE IF NOT EXISTS public.sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  project_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  visitor_id TEXT,
  started_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  last_seen_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  duration_seconds NUMERIC DEFAULT 0,
  pageview_count NUMERIC DEFAULT 1,
  event_count NUMERIC DEFAULT 0,
  is_bounce BOOLEAN DEFAULT true,
  entry_path TEXT,
  exit_path TEXT,
  referrer_domain TEXT,
  channel TEXT,
  device TEXT,
  browser TEXT,
  os TEXT,
  country TEXT,
  region TEXT,
  utm_campaign TEXT
);

CREATE INDEX IF NOT EXISTS idx_sessions_project_time ON public.sessions (project_id, started_at DESC);

-- 6. Visitor Days Table
CREATE TABLE IF NOT EXISTS public.visitor_days (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  project_id TEXT NOT NULL,
  visitor_id TEXT NOT NULL,
  date DATE NOT NULL,
  first_seen_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(project_id, visitor_id, date)
);

CREATE INDEX IF NOT EXISTS idx_visitor_days_project_date ON public.visitor_days (project_id, date DESC);

-- 7. Monitors Table (Uptime monitoring)
CREATE TABLE IF NOT EXISTS public.monitors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  created_date TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  project_id TEXT,
  owner_email TEXT,
  alert_email TEXT,
  status TEXT DEFAULT 'up' CHECK (status IN ('up', 'down', 'paused')),
  last_checked_at TIMESTAMPTZ,
  last_status_code NUMERIC,
  last_response_ms NUMERIC,
  consecutive_failures NUMERIC DEFAULT 0
);

-- 8. Monitor Checks Table
CREATE TABLE IF NOT EXISTS public.monitor_checks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  monitor_id UUID REFERENCES public.monitors(id) ON DELETE CASCADE,
  checked_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  status TEXT DEFAULT 'up',
  status_code NUMERIC,
  response_ms NUMERIC,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_monitor_checks_monitor ON public.monitor_checks (monitor_id, checked_at DESC);

-- 9. Support Tickets Table
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  created_date TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_review', 'resolved')),
  reply TEXT
);

-- 10. Email Campaigns Table
CREATE TABLE IF NOT EXISTS public.email_campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  created_date TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  audience TEXT DEFAULT 'all' CHECK (audience IN ('all', 'admins')),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent')),
  recipient_count NUMERIC DEFAULT 0,
  sent_at TIMESTAMPTZ,
  error TEXT
);

-- 11. Launch Claims Table
CREATE TABLE IF NOT EXISTS public.launch_claims (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  email TEXT NOT NULL,
  website TEXT,
  claimed_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 12. App Config Table
CREATE TABLE IF NOT EXISTS public.app_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  created_date TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  from_name TEXT DEFAULT 'Traffic Lume',
  support_email TEXT,
  uptime_alerts_enabled BOOLEAN DEFAULT true,
  maintenance_banner TEXT
);

-- Insert default app config if not present
INSERT INTO public.app_config (from_name, uptime_alerts_enabled)
SELECT 'Traffic Lume', true
WHERE NOT EXISTS (SELECT 1 FROM public.app_config);

-- ============================================================
-- Row Level Security (RLS) Policies
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitor_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitor_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.launch_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Allow read on app_config for everyone (including anon)
CREATE POLICY "Public read app_config" ON public.app_config FOR SELECT USING (true);
CREATE POLICY "Admin manage app_config" ON public.app_config FOR ALL USING (auth.uid() IS NOT NULL);

-- Profiles policies
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR ALL USING (true);

-- Projects policies (allow authenticated users full access to projects)
CREATE POLICY "Allow all actions for authenticated users on projects" ON public.projects FOR ALL USING (auth.uid() IS NOT NULL);

-- Events policies (allow ingestion from anon for tracking, and read for authenticated)
CREATE POLICY "Allow anon insert events" ON public.events FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow read events for auth" ON public.events FOR SELECT USING (true);
CREATE POLICY "Allow delete events for auth" ON public.events FOR DELETE USING (auth.uid() IS NOT NULL);

-- Sessions policies
CREATE POLICY "Allow anon insert sessions" ON public.sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anon update sessions" ON public.sessions FOR UPDATE USING (true);
CREATE POLICY "Allow read sessions for auth" ON public.sessions FOR SELECT USING (true);
CREATE POLICY "Allow delete sessions for auth" ON public.sessions FOR DELETE USING (auth.uid() IS NOT NULL);

-- Visitor Days policies
CREATE POLICY "Allow anon insert visitor_days" ON public.visitor_days FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow read visitor_days for auth" ON public.visitor_days FOR SELECT USING (true);
CREATE POLICY "Allow delete visitor_days for auth" ON public.visitor_days FOR DELETE USING (auth.uid() IS NOT NULL);

-- Monitors policies
CREATE POLICY "Allow all actions for authenticated users on monitors" ON public.monitors FOR ALL USING (auth.uid() IS NOT NULL);

-- Monitor checks policies
CREATE POLICY "Allow all actions for authenticated users on monitor_checks" ON public.monitor_checks FOR ALL USING (true);

-- Support tickets policies
CREATE POLICY "Allow users to manage tickets" ON public.support_tickets FOR ALL USING (auth.uid() IS NOT NULL);

-- Email campaigns policies
CREATE POLICY "Allow authenticated users on email campaigns" ON public.email_campaigns FOR ALL USING (auth.uid() IS NOT NULL);

-- Launch claims policies
CREATE POLICY "Allow public insert launch claims" ON public.launch_claims FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow auth read launch claims" ON public.launch_claims FOR SELECT USING (auth.uid() IS NOT NULL);
