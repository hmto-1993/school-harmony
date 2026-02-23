import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Save, CircleCheck, Star, Undo2 } from "lucide-react";
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

// Categories that use numeric input instead of icons
const NUMERIC_CATEGORIES = ["اختبار عملي", "اختبار الفترة"];
const isNumericCategory = (name: string) => NUMERIC_CATEGORIES.includes(name);

// Config for icon-based categories: max clicks and increment per click
const getCategoryConfig = (name: string, maxScore: number) => {
  if (name === "المشاركة") return { maxClicks: 3, increment: Math.round(maxScore / 4) };
  return { maxClicks: 1, increment: Math.round(maxScore / 2) };
};

const getClickCount = (score: number | null, increment: number): number => {
  if (!score || score <= 0 || increment <= 0) return 0;
  return Math.min(Math.floor(score / increment), 10);
};

const isStarred = (score: number | null, maxScore: number): boolean => {
  return score !== null && score >= maxScore;
};

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

  const addClick = (studentId: string, categoryId: string, catName: string, maxScore: number) => {
    const config = getCategoryConfig(catName, maxScore);
    setStudentGrades((prev) =>
      prev.map((sg) => {
        if (sg.student_id !== studentId) return sg;
        const current = sg.grades[categoryId] ?? 0;
        const currentClicks = getClickCount(current, config.increment);
        if (currentClicks >= config.maxClicks) return sg;
        const starred = isStarred(current, maxScore);
        const newScore = Math.min((currentClicks + 1) * config.increment, starred ? maxScore : maxScore);
        return { ...sg, grades: { ...sg.grades, [categoryId]: newScore } };
      })
    );
  };

  const toggleStar = (studentId: string, categoryId: string, catName: string, maxScore: number) => {
    setStudentGrades((prev) =>
      prev.map((sg) => {
        if (sg.student_id !== studentId) return sg;
        const current = sg.grades[categoryId] ?? 0;
        if (isStarred(current, maxScore)) {
          // Remove star: go back to max clicks score
          const config = getCategoryConfig(catName, maxScore);
          return { ...sg, grades: { ...sg.grades, [categoryId]: config.maxClicks * config.increment } };
        }
        return { ...sg, grades: { ...sg.grades, [categoryId]: maxScore } };
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
                <CircleCheck className="h-5 w-5 text-primary" />
                <span>إضافة نقطة</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Star className="h-5 w-5 text-amber-500" />
                <span>نجمة التميز (الدرجة الكاملة)</span>
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
                      <TableHead key={cat.id} className="text-center min-w-[140px]">
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
                              <div className="flex items-center justify-center gap-2">
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

                        const config = getCategoryConfig(cat.name, maxScore);
                        const clicks = getClickCount(currentScore, config.increment);
                        const starred = isStarred(currentScore, maxScore);

                        return (
                          <TableCell key={cat.id} className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              {/* Main click icon with count */}
                              <button
                                type="button"
                                onClick={() => addClick(sg.student_id, cat.id, cat.name, maxScore)}
                                className={cn(
                                  "p-1 rounded-md transition-all hover:scale-110 relative",
                                  clicks > 0 ? "opacity-100" : "opacity-40 hover:opacity-70"
                                )}
                                title={`إضافة نقطة (${clicks}/${config.maxClicks})`}
                                disabled={clicks >= config.maxClicks}
                              >
                                <CircleCheck className={cn("h-6 w-6", clicks > 0 ? "text-primary" : "text-muted-foreground")} />
                                {clicks > 0 && (
                                  <span className="absolute -top-1 -left-1 bg-primary text-primary-foreground text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                                    {clicks}
                                  </span>
                                )}
                              </button>

                              {/* Star for excellence */}
                              <button
                                type="button"
                                onClick={() => toggleStar(sg.student_id, cat.id, cat.name, maxScore)}
                                className={cn(
                                  "p-1 rounded-md transition-all hover:scale-110",
                                  starred ? "opacity-100" : "opacity-40 hover:opacity-70"
                                )}
                                title="نجمة التميز"
                              >
                                <Star className={cn("h-6 w-6", starred ? "text-amber-500 fill-amber-500" : "text-muted-foreground")} />
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

                              {/* Score display */}
                              <span className={cn(
                                "mr-1 text-sm font-semibold min-w-[28px]",
                                starred ? "text-amber-600" :
                                clicks > 0 ? "text-primary" : "text-muted-foreground"
                              )}>
                                {currentScore !== null && currentScore !== undefined ? currentScore : "—"}
                              </span>
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
