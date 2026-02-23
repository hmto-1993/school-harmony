import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Save, CircleCheck, CircleMinus, CircleX, Star, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";

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

// Grade levels
type GradeLevel = "excellent" | "average" | "zero" | null;

const getGradeLevel = (score: number | null, maxScore: number): GradeLevel => {
  if (score === null || score === undefined) return null;
  if (score >= maxScore) return "excellent";
  if (score > 0) return "average";
  return "zero";
};

const nextLevel = (current: GradeLevel): GradeLevel => {
  if (current === null) return "excellent";
  if (current === "excellent") return "average";
  if (current === "average") return "zero";
  return null;
};

const levelToScore = (level: GradeLevel, maxScore: number): number | null => {
  if (level === "excellent") return maxScore;
  if (level === "average") return Math.round(maxScore / 2);
  if (level === "zero") return 0;
  return null;
};

const LevelIcon = ({ level, size = "h-7 w-7" }: { level: GradeLevel; size?: string }) => {
  if (level === "excellent") return <CircleCheck className={cn(size, "text-green-600")} />;
  if (level === "average") return <CircleMinus className={cn(size, "text-yellow-500")} />;
  if (level === "zero") return <CircleX className={cn(size, "text-red-500")} />;
  return <CircleMinus className={cn(size, "text-muted-foreground opacity-30")} />;
};

const NUMERIC_CATEGORIES = ["اختبار عملي", "اختبار الفترة"];
const isNumericCategory = (name: string) => NUMERIC_CATEGORIES.includes(name);

// المشاركة allow 3 additions, others 1
const getMaxAdditions = (name: string) => name === "المشاركة" ? 3 : 1;

export default function DailyGradeEntry() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [categories, setCategories] = useState<GradeCategory[]>([]);
  const [studentGrades, setStudentGrades] = useState<StudentGrade[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("classes").select("id, name").order("name").then(({ data }) => setClasses(data || []));
  }, []);

  useEffect(() => {
    if (!selectedClass) return;
    setSelectedCategory("");
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

  // Cycle through: null → excellent(green) → average(yellow) → zero(red) → null
  const cycleGrade = (studentId: string, categoryId: string, maxScore: number) => {
    setStudentGrades((prev) =>
      prev.map((sg) => {
        if (sg.student_id !== studentId) return sg;
        const current = sg.grades[categoryId];
        const currentLevel = getGradeLevel(current, maxScore);
        const next = nextLevel(currentLevel);
        return { ...sg, grades: { ...sg.grades, [categoryId]: levelToScore(next, maxScore) } };
      })
    );
  };

  const clearGrade = (studentId: string, categoryId: string) => {
    setStudentGrades((prev) =>
      prev.map((sg) =>
        sg.student_id === studentId
          ? { ...sg, grades: { ...sg.grades, [categoryId]: null } }
          : sg
      )
    );
  };

  const setNumericGrade = (studentId: string, categoryId: string, value: string, maxScore: number) => {
    const num = value === "" ? null : Math.min(Math.max(0, Number(value)), maxScore);
    setStudentGrades((prev) =>
      prev.map((sg) =>
        sg.student_id === studentId
          ? { ...sg, grades: { ...sg.grades, [categoryId]: num } }
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

    const catsToSave = selectedCategory && selectedCategory !== "all"
      ? categories.filter((c) => c.id === selectedCategory)
      : categories;

    for (const sg of studentGrades) {
      for (const cat of catsToSave) {
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

  const visibleCategories = selectedCategory && selectedCategory !== "all"
    ? categories.filter((c) => c.id === selectedCategory)
    : categories;

  const isSingleCategory = selectedCategory && selectedCategory !== "all";

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <CardTitle className="text-lg">إدخال الدرجات اليومية</CardTitle>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue placeholder="اختر الشعبة..." />
              </SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {categories.length > 0 && (
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-full sm:w-56">
                  <SelectValue placeholder="جميع الفئات" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الفئات</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!selectedClass ? (
          <p className="text-center py-12 text-muted-foreground">اختر شعبة لعرض الدرجات</p>
        ) : categories.length === 0 ? (
          <p className="text-center py-12 text-muted-foreground">لم يتم إعداد فئات التقييم لهذه الشعبة بعد</p>
        ) : (
          <>
            {/* Legend */}
            <div className="flex gap-4 mb-4 text-sm flex-wrap">
              <div className="flex items-center gap-1.5">
                <CircleCheck className="h-5 w-5 text-green-600" />
                <span>ممتاز</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CircleMinus className="h-5 w-5 text-yellow-500" />
                <span>متوسط</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CircleX className="h-5 w-5 text-red-500" />
                <span>صفر</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Star className="h-5 w-5 text-amber-500" />
                <span>متميز</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Undo2 className="h-4 w-4 text-muted-foreground" />
                <span>تراجع</span>
              </div>
            </div>

            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-right sticky right-0 bg-muted/50">#</TableHead>
                    <TableHead className="text-right sticky right-10 bg-muted/50 min-w-[180px]">الطالب</TableHead>
                    {visibleCategories.map((cat) => (
                      <TableHead key={cat.id} className="text-center min-w-[100px]">
                        <div>{cat.name}</div>
                      </TableHead>
                    ))}
                    {!isSingleCategory && <TableHead className="text-center min-w-[80px]">المجموع</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studentGrades.map((sg, i) => (
                    <TableRow key={sg.student_id}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium">{sg.full_name}</TableCell>
                      {visibleCategories.map((cat) => {
                        const maxScore = Number(cat.max_score);
                        const currentScore = sg.grades[cat.id];
                        const isNumeric = isNumericCategory(cat.name);

                        if (isNumeric) {
                          return (
                            <TableCell key={cat.id} className="text-center">
                              <div className="flex items-center justify-center">
                                <Input
                                  type="number"
                                  min={0}
                                  max={maxScore}
                                  value={currentScore ?? ""}
                                  onChange={(e) => setNumericGrade(sg.student_id, cat.id, e.target.value, maxScore)}
                                  className="w-20 text-center h-8"
                                  placeholder={`/${maxScore}`}
                                />
                              </div>
                            </TableCell>
                          );
                        }

                        const level = getGradeLevel(currentScore, maxScore);
                        const starred = currentScore !== null && currentScore >= maxScore && level === "excellent";

                        return (
                          <TableCell key={cat.id} className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              {/* Single cycling icon: click to cycle green→yellow→red→clear */}
                              <button
                                type="button"
                                onClick={() => cycleGrade(sg.student_id, cat.id, maxScore)}
                                className="p-1 rounded-md transition-all hover:scale-110 cursor-pointer"
                                title="اضغط للتبديل: ممتاز → متوسط → صفر"
                              >
                                <LevelIcon level={level} />
                              </button>

                              {/* Star for excellence */}
                              <button
                                type="button"
                                onClick={() => {
                                  setStudentGrades((prev) =>
                                    prev.map((s) => {
                                      if (s.student_id !== sg.student_id) return s;
                                      const cur = s.grades[cat.id];
                                      // Toggle star: if already starred remove it, else set max
                                      const newScore = (cur !== null && cur >= maxScore) ? Math.round(maxScore / 2) : maxScore;
                                      return { ...s, grades: { ...s.grades, [cat.id]: newScore } };
                                    })
                                  );
                                }}
                                className={cn(
                                  "p-1 rounded-md transition-all hover:scale-110",
                                  starred ? "opacity-100" : "opacity-40 hover:opacity-70"
                                )}
                                title="متميز"
                              >
                                <Star className={cn("h-5 w-5", starred ? "text-amber-500 fill-amber-500" : "text-muted-foreground")} />
                              </button>

                              {/* Undo */}
                              <button
                                type="button"
                                onClick={() => clearGrade(sg.student_id, cat.id)}
                                className="p-1 rounded-md transition-all hover:scale-110 opacity-40 hover:opacity-100"
                                title="تراجع"
                              >
                                <Undo2 className="h-4 w-4 text-muted-foreground" />
                              </button>
                            </div>
                          </TableCell>
                        );
                      })}
                      {!isSingleCategory && (
                        <TableCell className="text-center font-bold">
                          {calcTotal(sg.grades)}
                        </TableCell>
                      )}
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
