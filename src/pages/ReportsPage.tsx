import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import {
  BarChart3,
  FileDown,
  FileSpreadsheet,
  ClipboardCheck,
  GraduationCap,
  Calendar,
  Users,
} from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

// ============ Types ============

interface ClassOption {
  id: string;
  name: string;
}

interface AttendanceRow {
  student_name: string;
  date: string;
  status: string;
  notes: string | null;
}

interface GradeRow {
  student_name: string;
  categories: Record<string, number | null>;
  total: number;
}

const STATUS_LABELS: Record<string, string> = {
  present: "حاضر",
  absent: "غائب",
  late: "متأخر",
  early_leave: "خروج مبكر",
  sick_leave: "إجازة مرضية",
};

// ============ Component ============

export default function ReportsPage() {
  const { role, user } = useAuth();
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [dateFrom, setDateFrom] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [reportType, setReportType] = useState<"daily" | "periodic">("daily");

  // Attendance data
  const [attendanceData, setAttendanceData] = useState<AttendanceRow[]>([]);
  const [loadingAttendance, setLoadingAttendance] = useState(false);

  // Grades data
  const [gradeData, setGradeData] = useState<GradeRow[]>([]);
  const [categoryNames, setCategoryNames] = useState<string[]>([]);
  const [loadingGrades, setLoadingGrades] = useState(false);

  // Fetch classes
  useEffect(() => {
    const fetchClasses = async () => {
      if (role === "teacher" && user) {
        const { data: tc } = await supabase
          .from("teacher_classes")
          .select("class_id, classes(id, name)")
          .eq("teacher_id", user.id);
        const cls = (tc || []).map((t: any) => t.classes).filter(Boolean);
        setClasses(cls);
        if (cls.length > 0) setSelectedClass(cls[0].id);
      } else {
        const { data } = await supabase.from("classes").select("id, name").order("name");
        setClasses(data || []);
        if (data && data.length > 0) setSelectedClass(data[0].id);
      }
    };
    fetchClasses();
  }, [role, user]);

  // ============ Attendance Report ============

  const fetchAttendance = async () => {
    if (!selectedClass) return;
    setLoadingAttendance(true);
    const { data, error } = await supabase
      .from("attendance_records")
      .select("status, notes, date, students(full_name)")
      .eq("class_id", selectedClass)
      .gte("date", dateFrom)
      .lte("date", dateTo)
      .order("date", { ascending: false });

    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } else {
      const rows: AttendanceRow[] = (data || []).map((r: any) => ({
        student_name: r.students?.full_name || "—",
        date: r.date,
        status: r.status,
        notes: r.notes,
      }));
      setAttendanceData(rows);
    }
    setLoadingAttendance(false);
  };

  // Attendance summary stats
  const attendanceSummary = useMemo(() => {
    const total = attendanceData.length;
    const present = attendanceData.filter((r) => r.status === "present").length;
    const absent = attendanceData.filter((r) => r.status === "absent").length;
    const late = attendanceData.filter((r) => r.status === "late").length;
    return { total, present, absent, late };
  }, [attendanceData]);

  // ============ Grades Report ============

  const fetchGrades = async () => {
    if (!selectedClass) return;
    setLoadingGrades(true);

    // Fetch categories for this class
    const { data: cats } = await supabase
      .from("grade_categories")
      .select("id, name, weight, max_score")
      .eq("class_id", selectedClass)
      .order("sort_order");

    const categories = cats || [];
    setCategoryNames(categories.map((c) => c.name));

    // Fetch students in class
    const { data: students } = await supabase
      .from("students")
      .select("id, full_name")
      .eq("class_id", selectedClass)
      .order("full_name");

    if (!students || students.length === 0) {
      setGradeData([]);
      setLoadingGrades(false);
      return;
    }

    // Fetch grades filtered by date range
    const studentIds = students.map((s) => s.id);
    let gradesQuery = supabase
      .from("grades")
      .select("student_id, category_id, score, created_at")
      .in("student_id", studentIds)
      .gte("created_at", `${dateFrom}T00:00:00`)
      .lte("created_at", `${dateTo}T23:59:59`);

    const { data: grades } = await gradesQuery;

    // Build lookup
    const gradeMap: Record<string, Record<string, number | null>> = {};
    (grades || []).forEach((g: any) => {
      if (!gradeMap[g.student_id]) gradeMap[g.student_id] = {};
      gradeMap[g.student_id][g.category_id] = g.score;
    });

    const rows: GradeRow[] = students.map((s) => {
      const catScores: Record<string, number | null> = {};
      let total = 0;
      categories.forEach((cat) => {
        const score = gradeMap[s.id]?.[cat.id] ?? null;
        catScores[cat.name] = score;
        if (score !== null) {
          total += (score / cat.max_score) * cat.weight;
        }
      });
      return { student_name: s.full_name, categories: catScores, total: Math.round(total * 100) / 100 };
    });

    setGradeData(rows);
    setLoadingGrades(false);
  };

  // ============ Export Functions ============

  const exportAttendanceExcel = async () => {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.json_to_sheet(
      attendanceData.map((r) => ({
        "اسم الطالب": r.student_name,
        التاريخ: r.date,
        الحالة: STATUS_LABELS[r.status] || r.status,
        ملاحظات: r.notes || "",
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "تقرير الحضور");
    XLSX.writeFile(wb, `تقرير_الحضور_${dateFrom}_${dateTo}.xlsx`);
  };

  const exportGradesExcel = async () => {
    const XLSX = await import("xlsx");
    const rows = gradeData.map((r) => {
      const row: Record<string, any> = { "اسم الطالب": r.student_name };
      categoryNames.forEach((name) => {
        row[name] = r.categories[name] ?? "—";
      });
      row["المجموع"] = r.total;
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "تقرير الدرجات");
    XLSX.writeFile(wb, `تقرير_الدرجات.xlsx`);
  };

  const exportAttendancePDF = async () => {
    const jsPDF = (await import("jspdf")).default;
    await import("jspdf-autotable");

    const doc = new jsPDF({ orientation: "landscape" });
    // Use built-in font (no Arabic shaping in basic jsPDF, but functional)
    doc.setFont("helvetica");
    doc.setFontSize(16);
    doc.text("Attendance Report", 14, 20);
    doc.setFontSize(10);
    doc.text(`From: ${dateFrom}  To: ${dateTo}`, 14, 28);

    const tableData = attendanceData.map((r) => [
      r.student_name,
      r.date,
      STATUS_LABELS[r.status] || r.status,
      r.notes || "",
    ]);

    (doc as any).autoTable({
      startY: 35,
      head: [["Student", "Date", "Status", "Notes"]],
      body: tableData,
      styles: { fontSize: 9, halign: "left" },
      headStyles: { fillColor: [30, 64, 175] },
    });

    doc.save(`attendance_${dateFrom}_${dateTo}.pdf`);
  };

  const exportGradesPDF = async () => {
    const jsPDF = (await import("jspdf")).default;
    await import("jspdf-autotable");

    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFont("helvetica");
    doc.setFontSize(16);
    doc.text("Grades Report", 14, 20);

    const head = ["Student", ...categoryNames, "Total"];
    const body = gradeData.map((r) => [
      r.student_name,
      ...categoryNames.map((n) => (r.categories[n] !== null ? String(r.categories[n]) : "—")),
      String(r.total),
    ]);

    (doc as any).autoTable({
      startY: 30,
      head: [head],
      body,
      styles: { fontSize: 9, halign: "center" },
      headStyles: { fillColor: [30, 64, 175] },
      columnStyles: { 0: { halign: "left" } },
    });

    doc.save("grades_report.pdf");
  };

  // ============ Render ============

  const className = classes.find((c) => c.id === selectedClass)?.name || "";

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">التقارير والإحصائيات</h1>
        <p className="text-muted-foreground">تقارير يومية وفترية للحضور والدرجات مع إمكانية التصدير</p>
      </div>

      {/* Filters */}
      <Card className="shadow-card">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1.5 min-w-[180px]">
              <Label className="text-xs">الشعبة</Label>
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر الشعبة" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">نوع التقرير</Label>
              <Select value={reportType} onValueChange={(v: "daily" | "periodic") => {
                setReportType(v);
                if (v === "daily") {
                  setDateTo(dateFrom);
                }
              }}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">يومي</SelectItem>
                  <SelectItem value="periodic">فتري</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{reportType === "daily" ? "التاريخ" : "من تاريخ"}</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  if (reportType === "daily") setDateTo(e.target.value);
                }}
                className="w-40"
              />
            </div>
            {reportType === "periodic" && (
              <div className="space-y-1.5">
                <Label className="text-xs">إلى تاريخ</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-40"
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="attendance" dir="rtl">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="attendance" className="gap-1.5">
            <ClipboardCheck className="h-4 w-4" />
            تقرير الحضور
          </TabsTrigger>
          <TabsTrigger value="grades" className="gap-1.5">
            <GraduationCap className="h-4 w-4" />
            تقرير الدرجات
          </TabsTrigger>
        </TabsList>

        {/* ===== Attendance Report ===== */}
        <TabsContent value="attendance" className="space-y-4">
          <div className="flex items-center gap-2">
            <Button onClick={fetchAttendance} disabled={loadingAttendance || !selectedClass}>
              <BarChart3 className="h-4 w-4 ml-1.5" />
              {loadingAttendance ? "جارٍ التحميل..." : "عرض التقرير"}
            </Button>
            {attendanceData.length > 0 && (
              <>
                <Button variant="outline" size="sm" onClick={exportAttendanceExcel} className="gap-1.5">
                  <FileSpreadsheet className="h-4 w-4" />
                  Excel
                </Button>
                <Button variant="outline" size="sm" onClick={exportAttendancePDF} className="gap-1.5">
                  <FileDown className="h-4 w-4" />
                  PDF
                </Button>
              </>
            )}
          </div>

          {attendanceData.length > 0 && (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold">{attendanceSummary.total}</p>
                    <p className="text-xs text-muted-foreground">إجمالي السجلات</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-green-600">{attendanceSummary.present}</p>
                    <p className="text-xs text-muted-foreground">حاضر</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-destructive">{attendanceSummary.absent}</p>
                    <p className="text-xs text-muted-foreground">غائب</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-yellow-600">{attendanceSummary.late}</p>
                    <p className="text-xs text-muted-foreground">متأخر</p>
                  </CardContent>
                </Card>
              </div>

              {/* Data Table */}
              <Card className="shadow-card">
                <CardContent className="pt-4">
                  <div className="max-h-[400px] overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">اسم الطالب</TableHead>
                          <TableHead className="text-right">التاريخ</TableHead>
                          <TableHead className="text-right">الحالة</TableHead>
                          <TableHead className="text-right">ملاحظات</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {attendanceData.map((row, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{row.student_name}</TableCell>
                            <TableCell>{row.date}</TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  row.status === "present"
                                    ? "default"
                                    : row.status === "absent"
                                    ? "destructive"
                                    : "secondary"
                                }
                              >
                                {STATUS_LABELS[row.status] || row.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {row.notes || "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {!loadingAttendance && attendanceData.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Calendar className="h-12 w-12 mb-3 opacity-30" />
                <p className="text-sm">اختر الشعبة والتواريخ ثم اضغط "عرض التقرير"</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ===== Grades Report ===== */}
        <TabsContent value="grades" className="space-y-4">
          <div className="flex items-center gap-2">
            <Button onClick={fetchGrades} disabled={loadingGrades || !selectedClass}>
              <BarChart3 className="h-4 w-4 ml-1.5" />
              {loadingGrades ? "جارٍ التحميل..." : "عرض التقرير"}
            </Button>
            {gradeData.length > 0 && (
              <>
                <Button variant="outline" size="sm" onClick={exportGradesExcel} className="gap-1.5">
                  <FileSpreadsheet className="h-4 w-4" />
                  Excel
                </Button>
                <Button variant="outline" size="sm" onClick={exportGradesPDF} className="gap-1.5">
                  <FileDown className="h-4 w-4" />
                  PDF
                </Button>
              </>
            )}
          </div>

          {gradeData.length > 0 && (
            <Card className="shadow-card">
              <CardContent className="pt-4">
                <div className="max-h-[400px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">اسم الطالب</TableHead>
                        {categoryNames.map((name) => (
                          <TableHead key={name} className="text-center">
                            {name}
                          </TableHead>
                        ))}
                        <TableHead className="text-center">المجموع</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {gradeData.map((row, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{row.student_name}</TableCell>
                          {categoryNames.map((name) => (
                            <TableCell key={name} className="text-center">
                              {row.categories[name] !== null ? row.categories[name] : "—"}
                            </TableCell>
                          ))}
                          <TableCell className="text-center font-bold">{row.total}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {!loadingGrades && gradeData.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mb-3 opacity-30" />
                <p className="text-sm">اختر الشعبة ثم اضغط "عرض التقرير"</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
