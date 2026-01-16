-- Create vehicles table (garage) for storing user vehicles
CREATE TABLE IF NOT EXISTS public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  engine TEXT,
  vin TEXT,
  nickname TEXT,
  context_string TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for vehicles
CREATE POLICY "Users can view their own vehicles"
  ON public.vehicles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own vehicles"
  ON public.vehicles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own vehicles"
  ON public.vehicles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own vehicles"
  ON public.vehicles FOR DELETE
  USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_vehicles_user_id ON public.vehicles(user_id);
