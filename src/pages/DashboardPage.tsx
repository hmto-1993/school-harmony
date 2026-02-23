import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users, BookOpen, ClipboardCheck, AlertTriangle, Search } from "lucide-react";

interface Student {
  id: string;
  full_name: string;
  academic_number: string | null;
  national_id: string | null;
  class_id: string | null;
  classes: { name: string } | null;
}

interface StatsData {
  totalStudents: number;
  totalClasses: number;
  todayPresent: number;
  todayAbsent: number;
}

const statusLabels: Record<string, { label: string; variant: "default" | "destructive" | "outline" | "secondary" }> = {
  present: { label: "حاضر", variant: "default" },
  absent: { label: "غائب", variant: "destructive" },
  late: { label: "متأخر", variant: "secondary" },
  early_leave: { label: "منصرف مبكرًا", variant: "outline" },
  sick_leave: { label: "إجازة مرضية", variant: "outline" },
};

export default function DashboardPage() {
  const { role } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [stats, setStats] = useState<StatsData>({ totalStudents: 0, totalClasses: 0, todayPresent: 0, todayAbsent: 0 });
  const [todayAttendance, setTodayAttendance] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    // جلب الطلاب مع الشعبة
    const { data: studentsData } = await supabase
      .from("students")
      .select("id, full_name, academic_number, national_id, class_id, classes(name)")
      .order("full_name");

    // جلب الشعب
    const { data: classesData } = await supabase
      .from("classes")
      .select("id, name")
      .order("name");

    // جلب حضور اليوم
    const today = new Date().toISOString().split("T")[0];
    const { data: attendanceData } = await supabase
      .from("attendance_records")
      .select("student_id, status")
      .eq("date", today);

    const attendanceMap: Record<string, string> = {};
    attendanceData?.forEach((r) => {
      attendanceMap[r.student_id] = r.status;
    });

    setStudents((studentsData as Student[]) || []);
    setClasses(classesData || []);
    setTodayAttendance(attendanceMap);

    const totalStudents = studentsData?.length || 0;
    const totalClasses = classesData?.length || 0;
    const todayPresent = attendanceData?.filter((r) => r.status === "present").length || 0;
    const todayAbsent = attendanceData?.filter((r) => r.status === "absent").length || 0;

    setStats({ totalStudents, totalClasses, todayPresent, todayAbsent });
  };

  // بحث وتصفية
  const filtered = useMemo(() => {
    let result = students;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (s) =>
          s.full_name.toLowerCase().includes(q) ||
          s.academic_number?.toLowerCase().includes(q)
      );
    }
    if (classFilter !== "all") {
      result = result.filter((s) => s.class_id === classFilter);
    }
    return result;
  }, [students, search, classFilter]);

  const statCards = [
    { label: "إجمالي الطلاب", value: stats.totalStudents, icon: Users, color: "text-primary" },
    { label: "عدد الشُعب", value: stats.totalClasses, icon: BookOpen, color: "text-info" },
    { label: "الحضور اليوم", value: stats.todayPresent, icon: ClipboardCheck, color: "text-success" },
    { label: "الغياب اليوم", value: stats.todayAbsent, icon: AlertTriangle, color: "text-destructive" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* العنوان */}
      <div>
        <h1 className="text-2xl font-bold">لوحة التحكم</h1>
        <p className="text-muted-foreground">مرحبًا بك في نظام إدارة ثانوية الفيصلية</p>
      </div>

      {/* بطاقات الإحصائيات */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label} className="shadow-card hover:shadow-card-hover transition-shadow">
            <CardContent className="flex items-center gap-4 p-5">
              <div className={`rounded-xl p-3 bg-muted ${stat.color}`}>
                <stat.icon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* البحث والتصفية */}
      <Card className="shadow-card">
        <CardContent className="p-5">
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="بحث بالاسم أو الرقم الأكاديمي..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pr-10"
              />
            </div>
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="جميع الشُعب" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الشُعب</SelectItem>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* جدول الطلاب */}
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-right">#</TableHead>
                  <TableHead className="text-right">الاسم الكامل</TableHead>
                  <TableHead className="text-right">الرقم الأكاديمي</TableHead>
                  <TableHead className="text-right">الشعبة</TableHead>
                  <TableHead className="text-right">حالة اليوم</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      لا توجد نتائج
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((student, i) => {
                    const status = todayAttendance[student.id];
                    const statusInfo = status ? statusLabels[status] : null;
                    return (
                      <TableRow key={student.id} className="hover:bg-muted/30">
                        <TableCell className="font-medium text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-medium">{student.full_name}</TableCell>
                        <TableCell className="text-muted-foreground">{student.academic_number || "—"}</TableCell>
                        <TableCell>{student.classes?.name || "—"}</TableCell>
                        <TableCell>
                          {statusInfo ? (
                            <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">لم يُسجَّل</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
