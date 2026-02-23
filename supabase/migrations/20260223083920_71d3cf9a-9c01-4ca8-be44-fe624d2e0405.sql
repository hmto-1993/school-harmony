
-- إنشاء نوع الأدوار
CREATE TYPE public.app_role AS ENUM ('admin', 'teacher');

-- إنشاء نوع حالة الحضور
CREATE TYPE public.attendance_status AS ENUM ('present', 'absent', 'late', 'early_leave', 'sick_leave');

-- جدول الأدوار
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- دالة فحص الدور
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- سياسات الأدوار
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- جدول الملفات الشخصية
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- جدول الصفوف / الشعب
CREATE TABLE public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  grade TEXT NOT NULL,
  section TEXT NOT NULL,
  academic_year TEXT NOT NULL DEFAULT '1446-1447',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view classes" ON public.classes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage classes" ON public.classes
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- جدول ربط المعلمين بالشعب
CREATE TABLE public.teacher_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE NOT NULL,
  subject TEXT,
  UNIQUE (teacher_id, class_id)
);
ALTER TABLE public.teacher_classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view teacher_classes" ON public.teacher_classes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage teacher_classes" ON public.teacher_classes
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- جدول الطلاب
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  academic_number TEXT UNIQUE,
  national_id TEXT,
  class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  parent_phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view students" ON public.students
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage students" ON public.students
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Teachers can update students in their classes" ON public.students
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.teacher_classes tc
      WHERE tc.teacher_id = auth.uid() AND tc.class_id = students.class_id
    )
  );

-- جدول الحضور والغياب
CREATE TABLE public.attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  status attendance_status NOT NULL DEFAULT 'present',
  notes TEXT,
  recorded_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, date)
);
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view attendance" ON public.attendance_records
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage attendance" ON public.attendance_records
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Teachers can insert attendance for their classes" ON public.attendance_records
  FOR INSERT TO authenticated
  WITH CHECK (
    recorded_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.teacher_classes tc
      WHERE tc.teacher_id = auth.uid() AND tc.class_id = attendance_records.class_id
    )
  );
CREATE POLICY "Teachers can update attendance for their classes" ON public.attendance_records
  FOR UPDATE TO authenticated
  USING (
    recorded_by = auth.uid() AND
    date = CURRENT_DATE AND
    EXISTS (
      SELECT 1 FROM public.teacher_classes tc
      WHERE tc.teacher_id = auth.uid() AND tc.class_id = attendance_records.class_id
    )
  );

-- فئات التقييم
CREATE TABLE public.grade_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  weight NUMERIC(5,2) NOT NULL DEFAULT 0,
  max_score NUMERIC(5,2) NOT NULL DEFAULT 100,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.grade_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view grade_categories" ON public.grade_categories
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage grade_categories" ON public.grade_categories
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- جدول الدرجات
CREATE TABLE public.grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES public.grade_categories(id) ON DELETE CASCADE NOT NULL,
  score NUMERIC(5,2),
  recorded_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, category_id)
);
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view grades" ON public.grades
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage grades" ON public.grades
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Teachers can insert grades" ON public.grades
  FOR INSERT TO authenticated
  WITH CHECK (
    recorded_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.students s
      JOIN public.teacher_classes tc ON tc.class_id = s.class_id
      WHERE s.id = grades.student_id AND tc.teacher_id = auth.uid()
    )
  );
CREATE POLICY "Teachers can update grades" ON public.grades
  FOR UPDATE TO authenticated
  USING (
    recorded_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.students s
      JOIN public.teacher_classes tc ON tc.class_id = s.class_id
      WHERE s.id = grades.student_id AND tc.teacher_id = auth.uid()
    )
  );

-- جدول الإشعارات
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view notifications" ON public.notifications
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert notifications" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Admins can manage notifications" ON public.notifications
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- دالة تحديث التاريخ تلقائياً
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_attendance_updated_at BEFORE UPDATE ON public.attendance_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_grades_updated_at BEFORE UPDATE ON public.grades
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- دالة إنشاء إشعار تلقائي عند تسجيل غياب
CREATE OR REPLACE FUNCTION public.create_absence_notification()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('absent', 'late') THEN
    INSERT INTO public.notifications (student_id, type, message, created_by)
    VALUES (
      NEW.student_id,
      NEW.status::TEXT,
      CASE NEW.status
        WHEN 'absent' THEN 'تم تسجيل غياب الطالب'
        WHEN 'late' THEN 'تم تسجيل تأخر الطالب'
      END,
      NEW.recorded_by
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER attendance_notification_trigger
  AFTER INSERT ON public.attendance_records
  FOR EACH ROW EXECUTE FUNCTION public.create_absence_notification();
