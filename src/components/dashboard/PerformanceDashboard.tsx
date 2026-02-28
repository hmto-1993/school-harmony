import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ScatterChart, Scatter, ZAxis, Cell,
} from "recharts";
import { Trophy, Users, TrendingUp, TrendingDown, Star, AlertTriangle } from "lucide-react";

interface ClassInfo { id: string; name: string; }
interface StudentInfo { id: string; full_name: string; class_id: string | null; }
interface GradeRecord { score: number | null; category_id: string; student_id: string; }
interface CategoryInfo { id: string; name: string; max_score: number; class_id: string | null; }

interface StudentRow {
  name: string;
  score: number;
  diff: number;
  maxScore: number;
}

interface ScatterPoint {
  name: string;
  score: number;
  index: number;
}

const COLORS_BAR = [
  "hsl(199, 89%, 48%)",
  "hsl(142, 71%, 45%)",
  "hsl(43, 96%, 56%)",
  "hsl(0, 72%, 51%)",
  "hsl(270, 60%, 55%)",
  "hsl(200, 80%, 50%)",
];

function getPerformanceColor(diff: number) {
  if (diff >= 5) return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (diff > 0) return "bg-green-50 text-green-600 border-green-200";
  if (diff === 0) return "bg-muted text-muted-foreground border-border";
  if (diff > -5) return "bg-orange-50 text-orange-600 border-orange-200";
  return "bg-red-50 text-red-600 border-red-200";
}

function getScatterColor(score: number, avg: number) {
  const diff = score - avg;
  if (diff >= 5) return "hsl(142, 71%, 45%)";
  if (diff > 0) return "hsl(142, 71%, 60%)";
  if (diff > -5) return "hsl(43, 96%, 56%)";
  return "hsl(0, 72%, 51%)";
}

export default function PerformanceDashboard() {
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [students, setStudents] = useState<StudentInfo[]>([]);
  const [grades, setGrades] = useState<GradeRecord[]>([]);
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [selectedClass, setSelectedClass] = useState("all");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [{ data: cls }, { data: stu }, { data: grd }, { data: cat }] = await Promise.all([
      supabase.from("classes").select("id, name").order("name"),
      supabase.from("students").select("id, full_name, class_id"),
      supabase.from("grades").select("score, category_id, student_id"),
      supabase.from("grade_categories").select("id, name, max_score, class_id").order("sort_order"),
    ]);
    setClasses(cls || []);
    setStudents(stu || []);
    setGrades(grd || []);
    setCategories(cat || []);
  };

  // Compute total score per student (sum of all category scores)
  const studentTotals = useMemo(() => {
    const map: Record<string, { total: number; maxTotal: number; count: number }> = {};
    const catMax: Record<string, number> = {};
    categories.forEach(c => { catMax[c.id] = c.max_score; });

    grades.forEach(g => {
      if (g.score == null) return;
      if (!map[g.student_id]) map[g.student_id] = { total: 0, maxTotal: 0, count: 0 };
      map[g.student_id].total += g.score;
      map[g.student_id].maxTotal += (catMax[g.category_id] || 0);
      map[g.student_id].count++;
    });
    return map;
  }, [grades, categories]);

  // Class averages for bar chart
  const classAverages = useMemo(() => {
    return classes.map(cls => {
      const classStudents = students.filter(s => s.class_id === cls.id);
      const scores = classStudents
        .map(s => studentTotals[s.id])
        .filter(Boolean)
        .map(t => t.maxTotal > 0 ? (t.total / t.maxTotal) * 100 : 0);
      const avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) / 10 : 0;
      return { className: cls.name, classId: cls.id, average: avg, studentCount: classStudents.length };
    }).filter(c => c.studentCount > 0);
  }, [classes, students, studentTotals]);

  // Selected class student details
  const selectedClassData = useMemo(() => {
    if (selectedClass === "all") return null;
    const classStudents = students.filter(s => s.class_id === selectedClass);
    const rows: StudentRow[] = classStudents.map(s => {
      const t = studentTotals[s.id];
      const score = t ? (t.maxTotal > 0 ? Math.round((t.total / t.maxTotal) * 100 * 10) / 10 : 0) : 0;
      const maxScore = t ? t.maxTotal : 0;
      return { name: s.full_name, score, diff: 0, maxScore };
    });

    const avg = rows.length > 0 ? rows.reduce((a, b) => a + b.score, 0) / rows.length : 0;
    rows.forEach(r => { r.diff = Math.round((r.score - avg) * 10) / 10; });
    rows.sort((a, b) => b.score - a.score);

    const scatter: ScatterPoint[] = rows.map((r, i) => ({ name: r.name, score: r.score, index: i + 1 }));

    return { rows, avg: Math.round(avg * 10) / 10, scatter };
  }, [selectedClass, students, studentTotals]);

  return (
    <div className="space-y-5">
      {/* Header with class selector */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Trophy className="h-5 w-5 text-accent" />
          تحليل أداء الطلاب
        </h2>
        <Select value={selectedClass} onValueChange={setSelectedClass}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="اختر الشعبة" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع الشُعب</SelectItem>
            {classes.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Bar chart: class averages comparison */}
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            مقارنة متوسط أداء الشُعب
          </CardTitle>
        </CardHeader>
        <CardContent>
          {classAverages.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={classAverages} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="className" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value: number) => [`${value}%`, "المتوسط"]}
                  labelFormatter={(l) => `الشعبة: ${l}`}
                />
                <Bar dataKey="average" name="متوسط الأداء %" radius={[6, 6, 0, 0]}>
                  {classAverages.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={
                        entry.average >= 80 ? "hsl(142, 71%, 45%)" :
                        entry.average >= 60 ? "hsl(43, 96%, 56%)" :
                        "hsl(0, 72%, 51%)"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-10">لا توجد بيانات درجات بعد</p>
          )}
        </CardContent>
      </Card>

      {/* Class detail: student table + scatter */}
      {selectedClassData && (
        <>
          {/* Student detail table */}
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  تفاصيل الطلاب — {classes.find(c => c.id === selectedClass)?.name}
                </CardTitle>
                <span className="text-sm text-muted-foreground">
                  المتوسط: <span className="font-bold text-foreground">{selectedClassData.avg}%</span>
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-auto max-h-[400px]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0">
                    <tr className="border-b bg-muted/60">
                      <th className="text-right p-2.5 font-medium">#</th>
                      <th className="text-right p-2.5 font-medium">الطالب</th>
                      <th className="text-center p-2.5 font-medium">النسبة %</th>
                      <th className="text-center p-2.5 font-medium">الفرق عن المتوسط</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedClassData.rows.map((row, i) => (
                      <tr key={row.name} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="p-2.5 text-muted-foreground">{i + 1}</td>
                        <td className="p-2.5 font-medium flex items-center gap-2">
                          {row.diff >= 10 && <Star className="h-4 w-4 text-accent fill-accent" />}
                          {row.diff <= -10 && <AlertTriangle className="h-4 w-4 text-destructive" />}
                          {row.name}
                        </td>
                        <td className="p-2.5 text-center font-bold">{row.score}%</td>
                        <td className="p-2.5 text-center">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${getPerformanceColor(row.diff)}`}>
                            {row.diff > 0 && <TrendingUp className="h-3 w-3" />}
                            {row.diff < 0 && <TrendingDown className="h-3 w-3" />}
                            {row.diff > 0 ? "+" : ""}{row.diff}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Scatter chart: student distribution */}
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                توزيع درجات الطلاب — {classes.find(c => c.id === selectedClass)?.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis
                    dataKey="index"
                    name="ترتيب"
                    tick={{ fontSize: 11 }}
                    label={{ value: "ترتيب الطالب", position: "insideBottom", offset: -5, fontSize: 11 }}
                  />
                  <YAxis
                    dataKey="score"
                    name="النسبة"
                    domain={[0, 100]}
                    tick={{ fontSize: 11 }}
                    label={{ value: "النسبة %", angle: -90, position: "insideLeft", fontSize: 11 }}
                  />
                  <ZAxis range={[80, 80]} />
                  <Tooltip
                    formatter={(value: number, name: string) => {
                      if (name === "النسبة") return [`${value}%`, "النسبة"];
                      return [value, name];
                    }}
                    labelFormatter={() => ""}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload as ScatterPoint;
                      return (
                        <div className="bg-card border border-border rounded-lg p-2 shadow-lg text-xs">
                          <p className="font-bold">{d.name}</p>
                          <p>النسبة: {d.score}%</p>
                        </div>
                      );
                    }}
                  />
                  <Scatter data={selectedClassData.scatter} name="الطلاب">
                    {selectedClassData.scatter.map((s, i) => (
                      <Cell key={i} fill={getScatterColor(s.score, selectedClassData.avg)} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
              {/* Legend */}
              <div className="flex items-center justify-center gap-4 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full" style={{ background: "hsl(142, 71%, 45%)" }} /> متفوق</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full" style={{ background: "hsl(43, 96%, 56%)" }} /> متوسط</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full" style={{ background: "hsl(0, 72%, 51%)" }} /> يحتاج دعم</span>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
