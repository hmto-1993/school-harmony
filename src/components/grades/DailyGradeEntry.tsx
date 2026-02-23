import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Save } from "lucide-react";

interface GradeCategory {
  id: string;
  name: string;
  weight: number;
  max_score: number;
}

interface StudentGrade {
  student_id: string;
  full_name: string;
  grades: Record<string, number | null>;
  grade_ids: Record<string, string>;
}

export default function DailyGradeEntry() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [categories, setCategories] = useState<GradeCategory[]>([]);
  const [studentGrades, setStudentGrades] = useState<StudentGrade[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("classes").select("id, name").order("name").then(({ data }) => setClasses(data || []));
  }, []);

  useEffect(() => {
    if (!selectedClass) return;
    loadData();
  }, [selectedClass]);

  const loadData = async () => {
    const { data: cats } = await supabase
      .from("grade_categories")
      .select("*")
      .eq("class_id", selectedClass)
      .order("sort_order");

    const { data: students } = await supabase
      .from("students")
      .select("id, full_name")
      .eq("class_id", selectedClass)
      .order("full_name");

    const { data: grades } = await supabase
      .from("grades")
      .select("id, student_id, category_id, score")
      .in("student_id", (students || []).map((s) => s.id));

    const gradesMap = new Map<string, Map<string, { score: number | null; id: string }>>();
    grades?.forEach((g) => {
      if (!gradesMap.has(g.student_id)) gradesMap.set(g.student_id, new Map());
      gradesMap.get(g.student_id)!.set(g.category_id, { score: g.score ? Number(g.score) : null, id: g.id });
    });

    setCategories((cats as GradeCategory[]) || []);
    setStudentGrades(
      (students || []).map((s) => {
        const studentGradesMap = gradesMap.get(s.id) || new Map();
        const gradeValues: Record<string, number | null> = {};
        const gradeIds: Record<string, string> = {};
        (cats || []).forEach((c: any) => {
          const g = studentGradesMap.get(c.id);
          gradeValues[c.id] = g?.score ?? null;
          if (g?.id) gradeIds[c.id] = g.id;
        });
        return { student_id: s.id, full_name: s.full_name, grades: gradeValues, grade_ids: gradeIds };
      })
    );
  };

  const updateGrade = (studentId: string, categoryId: string, value: string) => {
    const numValue = value === "" ? null : Math.min(100, Math.max(0, Number(value)));
    setStudentGrades((prev) =>
      prev.map((sg) =>
        sg.student_id === studentId
          ? { ...sg, grades: { ...sg.grades, [categoryId]: numValue } }
          : sg
      )
    );
  };

  const calcTotal = (grades: Record<string, number | null>) => {
    let total = 0;
    let totalWeight = 0;
    categories.forEach((cat) => {
      const score = grades[cat.id];
      if (score !== null && score !== undefined) {
        const weight = Number(cat.weight);
        total += (score / Number(cat.max_score)) * weight;
        totalWeight += weight;
      }
    });
    return totalWeight > 0 ? ((total / totalWeight) * 100).toFixed(1) : "—";
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    for (const sg of studentGrades) {
      for (const cat of categories) {
        const score = sg.grades[cat.id];
        const existingId = sg.grade_ids[cat.id];

        if (score !== null && score !== undefined) {
          if (existingId) {
            await supabase.from("grades").update({ score }).eq("id", existingId);
          } else {
            await supabase.from("grades").insert({
              student_id: sg.student_id,
              category_id: cat.id,
              score,
              recorded_by: user.id,
            });
          }
        }
      }
    }

    toast({ title: "تم الحفظ", description: "تم حفظ الدرجات بنجاح" });
    setSaving(false);
    loadData();
  };

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <CardTitle className="text-lg">إدخال الدرجات اليومية</CardTitle>
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
        {!selectedClass ? (
          <p className="text-center py-12 text-muted-foreground">اختر شعبة لعرض الدرجات</p>
        ) : categories.length === 0 ? (
          <p className="text-center py-12 text-muted-foreground">لم يتم إعداد فئات التقييم لهذه الشعبة بعد</p>
        ) : (
          <>
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-right sticky right-0 bg-muted/50">#</TableHead>
                    <TableHead className="text-right sticky right-10 bg-muted/50 min-w-[180px]">الطالب</TableHead>
                    {categories.map((cat) => (
                      <TableHead key={cat.id} className="text-center min-w-[100px]">
                        <div>{cat.name}</div>
                        <div className="text-xs text-muted-foreground font-normal">
                          ({Number(cat.weight)}%) من {Number(cat.max_score)}
                        </div>
                      </TableHead>
                    ))}
                    <TableHead className="text-center min-w-[80px]">المجموع %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studentGrades.map((sg, i) => (
                    <TableRow key={sg.student_id}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium">{sg.full_name}</TableCell>
                      {categories.map((cat) => (
                        <TableCell key={cat.id} className="text-center">
                          <Input
                            type="number"
                            min={0}
                            max={Number(cat.max_score)}
                            value={sg.grades[cat.id] ?? ""}
                            onChange={(e) => updateGrade(sg.student_id, cat.id, e.target.value)}
                            className="w-20 mx-auto text-center h-8"
                            dir="ltr"
                          />
                        </TableCell>
                      ))}
                      <TableCell className="text-center font-bold">
                        {calcTotal(sg.grades)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex justify-end mt-4">
              <Button onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4 ml-2" />
                {saving ? "جارٍ الحفظ..." : "حفظ الدرجات"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
