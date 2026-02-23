
-- Create behavior_records table
CREATE TABLE public.behavior_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  type TEXT NOT NULL CHECK (type IN ('positive', 'negative', 'neutral')),
  note TEXT,
  notified BOOLEAN NOT NULL DEFAULT false,
  recorded_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.behavior_records ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can view behavior records"
  ON public.behavior_records FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert behavior records"
  ON public.behavior_records FOR INSERT
  WITH CHECK (auth.uid() = recorded_by);

CREATE POLICY "Authenticated users can update their behavior records"
  ON public.behavior_records FOR UPDATE
  USING (auth.uid() = recorded_by);

CREATE POLICY "Authenticated users can delete their behavior records"
  ON public.behavior_records FOR DELETE
  USING (auth.uid() = recorded_by);

-- Index for quick lookups
CREATE INDEX idx_behavior_records_student_date ON public.behavior_records(student_id, date);
CREATE INDEX idx_behavior_records_class_date ON public.behavior_records(class_id, date);
