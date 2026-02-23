import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Save, CheckCircle2 } from "lucide-react";

type AttendanceStatus = "present" | "absent" | "late" | "early_leave" | "sick_leave";

interface StudentAttendance {
  student_id: string;
  full_name: string;
  status: AttendanceStatus;
  notes: string;
  existing_id?: string;
}

const statusOptions: { value: AttendanceStatus; label: string; color: string }[] = [
  { value: "present", label: "حاضر", color: "bg-success/10 text-success border-success/30" },
  { value: "absent", label: "غائب", color: "bg-destructive/10 text-destructive border-destructive/30" },
  { value: "late", label: "متأخر", color: "bg-warning/10 text-warning border-warning/30" },
  { value: "early_leave", label: "منصرف مبكرًا", color: "bg-muted text-muted-foreground border-border" },
  { value: "sick_leave", label: "إجازة مرضية", color: "bg-info/10 text-info border-info/30" },
];

export default function AttendancePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [records, setRecords] = useState<StudentAttendance[]>([]);
  const [saving, setSaving] = useState(false);
  const [date] = useState(() => new Date().toISOString().split("T")[0]);

  useEffect(() => {
    supabase.from("classes").select("id, name").order("name").then(({ data }) => {
      setClasses(data || []);
    });
  }, []);

  useEffect(() => {
    if (!selectedClass) return;
    loadStudents();
  }, [selectedClass]);

  const loadStudents = async () => {
    // جلب طلاب الشعبة
    const { data: students } = await supabase
      .from("students")
      .select("id, full_name")
      .eq("class_id", selectedClass)
      .order("full_name");

    // جلب سجلات الحضور لليوم
    const { data: attendance } = await supabase
      .from("attendance_records")
      .select("id, student_id, status, notes")
      .eq("class_id", selectedClass)
      .eq("date", date);

    const attendanceMap = new Map(attendance?.map((a) => [a.student_id, a]));

    setRecords(
      (students || []).map((s) => {
        const existing = attendanceMap.get(s.id);
        return {
          student_id: s.id,
          full_name: s.full_name,
          status: (existing?.status as AttendanceStatus) || "present",
          notes: existing?.notes || "",
          existing_id: existing?.id,
        };
      })
    );
  };

  const updateStatus = (studentId: string, status: AttendanceStatus) => {
    setRecords((prev) =>
      prev.map((r) => (r.student_id === studentId ? { ...r, status } : r))
    );
  };

  const updateNotes = (studentId: string, notes: string) => {
    setRecords((prev) =>
      prev.map((r) => (r.student_id === studentId ? { ...r, notes } : r))
    );
  };

  const markAllPresent = () => {
    setRecords((prev) => prev.map((r) => ({ ...r, status: "present" as AttendanceStatus })));
  };

  const handleSave = async () => {
    if (!user || !selectedClass) return;
    setSaving(true);

    // تحديث السجلات الموجودة
    const toUpdate = records.filter((r) => r.existing_id);
    const toInsert = records.filter((r) => !r.existing_id);

    for (const record of toUpdate) {
      await supabase
        .from("attendance_records")
        .update({ status: record.status, notes: record.notes })
        .eq("id", record.existing_id!);
    }

    if (toInsert.length > 0) {
      await supabase.from("attendance_records").insert(
        toInsert.map((r) => ({
          student_id: r.student_id,
          class_id: selectedClass,
          date,
          status: r.status,
          notes: r.notes,
          recorded_by: user.id,
        }))
      );
    }

    toast({ title: "تم الحفظ", description: "تم حفظ سجلات الحضور بنجاح" });
    setSaving(false);
    loadStudents(); // إعادة التحميل لتحديث المعرفات
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">تسجيل الحضور والغياب</h1>
        <p className="text-muted-foreground">تاريخ اليوم: {new Date(date).toLocaleDateString("ar-SA")}</p>
      </div>

      <Card className="shadow-card">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <CardTitle className="text-lg">اختر الشعبة</CardTitle>
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger className="w-full sm:w-64">
                <SelectValue placeholder="اختر الشعبة..." />
              </SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <p className="text-center py-12 text-muted-foreground">
              {selectedClass ? "لا يوجد طلاب في هذه الشعبة" : "اختر شعبة لبدء تسجيل الحضور"}
            </p>
          ) : (
            <>
              <div className="flex gap-2 mb-4">
                <Button variant="outline" size="sm" onClick={markAllPresent}>
                  <CheckCircle2 className="h-4 w-4 ml-1" />
                  تحديد الكل حاضر
                </Button>
              </div>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-right w-12">#</TableHead>
                      <TableHead className="text-right">الطالب</TableHead>
                      <TableHead className="text-right">الحالة</TableHead>
                      <TableHead className="text-right">ملاحظات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((record, i) => (
                      <TableRow key={record.student_id}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-medium">{record.full_name}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {statusOptions.map((opt) => (
                              <button
                                key={opt.value}
                                onClick={() => updateStatus(record.student_id, opt.value)}
                                className={`px-2.5 py-1 rounded-md text-xs border transition-all ${
                                  record.status === opt.value
                                    ? opt.color + " font-medium ring-1 ring-current/20"
                                    : "bg-background text-muted-foreground border-border hover:bg-muted"
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Textarea
                            value={record.notes}
                            onChange={(e) => updateNotes(record.student_id, e.target.value)}
                            placeholder="ملاحظات..."
                            className="min-h-[36px] h-9 resize-none text-xs"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex justify-end mt-4">
                <Button onClick={handleSave} disabled={saving}>
                  <Save className="h-4 w-4 ml-2" />
                  {saving ? "جارٍ الحفظ..." : "حفظ الحضور"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
