import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Save, CircleCheck, CircleMinus, CircleX } from "lucide-react";
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

type GradeLevel = "excellent" | "average" | "zero";

const gradeLevelConfig: Record<GradeLevel, { label: string; icon: typeof CircleCheck; colorClass: string }> = {
  excellent: { label: "ممتاز", icon: CircleCheck, colorClass: "text-green-500" },
  average: { label: "متوسط", icon: CircleMinus, colorClass: "text-yellow-500" },
  zero: { label: "صفر", icon: CircleX, colorClass: "text-red-500" },
};

const getGradeLevel = (score: number | null, maxScore: number): GradeLevel | null => {
  if (score === null || score === undefined) return null;
  const pct = (score / maxScore) * 100;
  if (pct >= 70) return "excellent";
  if (pct > 0) return "average";
  return "zero";
};

const getLevelScore = (level: GradeLevel, maxScore: number): number => {
  switch (level) {
    case "excellent": return maxScore;
    case "average": return Math.round(maxScore / 2);
    case "zero": return 0;
  }
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

  const setGradeByLevel = (studentId: string, categoryId: string, level: GradeLevel, maxScore: number) => {
    const score = getLevelScore(level, maxScore);
    setStudentGrades((prev) =>
      prev.map((sg) =>
        sg.student_id === studentId
          ? { ...sg, grades: { ...sg.grades, [categoryId]: score } }
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

  const calcPercentage = (score: number | null, maxScore: number) => {
    if (score === null || score === undefined) return "—";
    return `${Math.round((score / maxScore) * 100)}%`;
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
              {(Object.entries(gradeLevelConfig) as [GradeLevel, typeof gradeLevelConfig.excellent][]).map(([key, cfg]) => {
                const Icon = cfg.icon;
                return (
                  <div key={key} className="flex items-center gap-1.5">
                    <Icon className={cn("h-5 w-5", cfg.colorClass)} />
                    <span>{cfg.label}</span>
                  </div>
                );
              })}
            </div>

            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-right sticky right-0 bg-muted/50">#</TableHead>
                    <TableHead className="text-right sticky right-10 bg-muted/50 min-w-[180px]">الطالب</TableHead>
                    {visibleCategories.map((cat) => (
                      <TableHead key={cat.id} className="text-center min-w-[160px]">
                        <div>{cat.name}</div>
                        <div className="text-xs text-muted-foreground font-normal">
                          ({Number(cat.weight)}%)
                        </div>
                      </TableHead>
                    ))}
                    {!isSingleCategory && <TableHead className="text-center min-w-[80px]">المجموع %</TableHead>}
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
                        const currentLevel = getGradeLevel(currentScore, maxScore);

                        return (
                          <TableCell key={cat.id} className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              {(Object.entries(gradeLevelConfig) as [GradeLevel, typeof gradeLevelConfig.excellent][]).map(([level, cfg]) => {
                                const Icon = cfg.icon;
                                const isActive = currentLevel === level;
                                return (
                                  <button
                                    key={level}
                                    type="button"
                                    onClick={() => setGradeByLevel(sg.student_id, cat.id, level as GradeLevel, maxScore)}
                                    className={cn(
                                      "p-1 rounded-md transition-all hover:scale-110",
                                      isActive ? "ring-2 ring-offset-1 ring-current" : "opacity-30 hover:opacity-70"
                                    )}
                                    title={cfg.label}
                                  >
                                    <Icon className={cn("h-6 w-6", cfg.colorClass)} />
                                  </button>
                                );
                              })}
                              <span className={cn(
                                "mr-2 text-sm font-semibold min-w-[36px]",
                                currentLevel === "excellent" ? "text-green-600" :
                                currentLevel === "average" ? "text-yellow-600" :
                                currentLevel === "zero" ? "text-red-600" : "text-muted-foreground"
                              )}>
                                {calcPercentage(currentScore, maxScore)}
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
