import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Save, Pencil, X, Search } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ClassInfo {
  id: string;
  name: string;
}

interface CategoryInfo {
  id: string;
  name: string;
  weight: number;
  max_score: number;
  class_id: string;
}

interface SummaryRow {
  student_id: string;
  full_name: string;
  class_name: string;
  class_id: string;
  grades: Record<string, number | null>;
  grade_ids: Record<string, string>;
  total: string;
}

export default function GradesSummary() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [allCategories, setAllCategories] = useState<CategoryInfo[]>([]);
  const [summaryRows, setSummaryRows] = useState<SummaryRow[]>([]);
  const [editingStudent, setEditingStudent] = useState<string | null>(null);
  const [editedGrades, setEditedGrades] = useState<Record<string, number | null>>({});
  const [saving, setSaving] = useState(false);
  const [searchName, setSearchName] = useState("");
  const [filterClass, setFilterClass] = useState("all");

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);

    const [{ data: classesData }, { data: studentsData }, { data: catsData }] = await Promise.all([
      supabase.from("classes").select("id, name").order("name"),
      supabase.from("students").select("id, full_name, class_id").order("full_name"),
      supabase.from("grade_categories").select("*").order("sort_order"),
    ]);

    const cls = classesData || [];
    const students = studentsData || [];
    const cats = (catsData || []) as CategoryInfo[];

    // Fetch all grades
    const studentIds = students.map((s) => s.id);
    let allGrades: any[] = [];
    if (studentIds.length > 0) {
      const { data: gradesData } = await supabase
        .from("grades")
        .select("id, student_id, category_id, score")
        .in("student_id", studentIds);
      allGrades = gradesData || [];
    }

    const gradesMap = new Map<string, Map<string, { score: number | null; id: string }>>();
    allGrades.forEach((g) => {
      if (!gradesMap.has(g.student_id)) gradesMap.set(g.student_id, new Map());
      gradesMap.get(g.student_id)!.set(g.category_id, { score: g.score != null ? Number(g.score) : null, id: g.id });
    });

    const classMap = new Map(cls.map((c) => [c.id, c.name]));

    const rows: SummaryRow[] = students
      .filter((s) => s.class_id)
      .map((s) => {
        const classCats = cats.filter((c) => c.class_id === s.class_id);
        const studentGradesMap = gradesMap.get(s.id) || new Map();
        const grades: Record<string, number | null> = {};
        const gradeIds: Record<string, string> = {};

        classCats.forEach((c) => {
          const g = studentGradesMap.get(c.id);
          grades[c.id] = g?.score ?? null;
          if (g?.id) gradeIds[c.id] = g.id;
        });

        // calc total
        let total = 0;
        let totalWeight = 0;
        classCats.forEach((cat) => {
          const score = grades[cat.id];
          if (score !== null && score !== undefined) {
            const weight = Number(cat.weight);
            total += (score / Number(cat.max_score)) * weight;
            totalWeight += weight;
          }
        });
        const totalStr = totalWeight > 0 ? ((total / totalWeight) * 100).toFixed(1) : "—";

        return {
          student_id: s.id,
          full_name: s.full_name,
          class_name: classMap.get(s.class_id!) || "",
          class_id: s.class_id!,
          grades,
          grade_ids: gradeIds,
          total: totalStr,
        };
      });

    setClasses(cls);
    setAllCategories(cats);
    setSummaryRows(rows);
    setLoading(false);
  };

  const startEdit = (studentId: string) => {
    const row = summaryRows.find((r) => r.student_id === studentId);
    if (row) {
      setEditingStudent(studentId);
      setEditedGrades({ ...row.grades });
    }
  };

  const cancelEdit = () => {
    setEditingStudent(null);
    setEditedGrades({});
  };

  const handleEditGrade = (categoryId: string, value: string) => {
    const numValue = value === "" ? null : Math.min(100, Math.max(0, Number(value)));
    setEditedGrades((prev) => ({ ...prev, [categoryId]: numValue }));
  };

  const saveEdit = async () => {
    if (!user || !editingStudent) return;
    setSaving(true);

    const row = summaryRows.find((r) => r.student_id === editingStudent);
    if (!row) return;

    const classCats = allCategories.filter((c) => c.class_id === row.class_id);

    for (const cat of classCats) {
      const score = editedGrades[cat.id];
      const existingId = row.grade_ids[cat.id];

      if (score !== null && score !== undefined) {
        if (existingId) {
          await supabase.from("grades").update({ score }).eq("id", existingId);
        } else {
          await supabase.from("grades").insert({
            student_id: editingStudent,
            category_id: cat.id,
            score,
            recorded_by: user.id,
          });
        }
      }
    }

    toast({ title: "تم الحفظ", description: "تم تعديل الدرجات بنجاح" });
    setSaving(false);
    setEditingStudent(null);
    setEditedGrades({});
    loadAllData();
  };

  // Filter and group by class
  const filteredRows = summaryRows.filter((r) => {
    const matchesName = !searchName || r.full_name.includes(searchName);
    const matchesClass = filterClass === "all" || r.class_id === filterClass;
    return matchesName && matchesClass;
  });

  const groupedByClass = classes
    .map((cls) => ({
      ...cls,
      students: filteredRows.filter((r) => r.class_id === cls.id),
      categories: allCategories.filter((c) => c.class_id === cls.id),
    }))
    .filter((g) => g.students.length > 0);

  if (loading) {
    return <p className="text-center py-12 text-muted-foreground">جارٍ تحميل الخلاصة...</p>;
  }

  if (groupedByClass.length === 0) {
    return <p className="text-center py-12 text-muted-foreground">لا توجد بيانات درجات بعد</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="بحث باسم الطالب..."
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            className="pr-9"
          />
        </div>
        <Select value={filterClass} onValueChange={setFilterClass}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder="جميع الشعب" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع الشعب</SelectItem>
            {classes.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {groupedByClass.length === 0 ? (
        <p className="text-center py-12 text-muted-foreground">لا توجد نتائج مطابقة</p>
      ) : groupedByClass.map((group) => (
        <Card key={group.id} className="shadow-card">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">{group.name}</CardTitle>
              <Badge variant="secondary">{group.students.length} طالب</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-right">#</TableHead>
                    <TableHead className="text-right min-w-[180px]">الطالب</TableHead>
                    {group.categories.map((cat) => (
                      <TableHead key={cat.id} className="text-center min-w-[100px]">
                        <div>{cat.name}</div>
                        <div className="text-xs text-muted-foreground font-normal">
                          ({Number(cat.weight)}%) من {Number(cat.max_score)}
                        </div>
                      </TableHead>
                    ))}
                    <TableHead className="text-center min-w-[80px]">المجموع %</TableHead>
                    <TableHead className="text-center w-[80px]">تعديل</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.students.map((sg, i) => {
                    const isEditing = editingStudent === sg.student_id;
                    return (
                      <TableRow key={sg.student_id}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-medium">{sg.full_name}</TableCell>
                        {group.categories.map((cat) => (
                          <TableCell key={cat.id} className="text-center">
                            {isEditing ? (
                              <Input
                                type="number"
                                min={0}
                                max={Number(cat.max_score)}
                                value={editedGrades[cat.id] ?? ""}
                                onChange={(e) => handleEditGrade(cat.id, e.target.value)}
                                className="w-20 mx-auto text-center h-8"
                                dir="ltr"
                              />
                            ) : (
                              <span className={sg.grades[cat.id] == null ? "text-muted-foreground" : ""}>
                                {sg.grades[cat.id] ?? "—"}
                              </span>
                            )}
                          </TableCell>
                        ))}
                        <TableCell className="text-center font-bold">
                          {isEditing ? "..." : sg.total}
                        </TableCell>
                        <TableCell className="text-center">
                          {isEditing ? (
                            <div className="flex gap-1 justify-center">
                              <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={saving}>
                                <X className="h-4 w-4" />
                              </Button>
                              <Button size="sm" onClick={saveEdit} disabled={saving}>
                                <Save className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => startEdit(sg.student_id)}
                              disabled={!!editingStudent}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
