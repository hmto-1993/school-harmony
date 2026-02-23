import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface GradeRow {
  student_name: string;
  categories: Record<string, number | null>;
  total: number;
}

interface GradesChartProps {
  data: GradeRow[];
  categoryNames: string[];
}

const COLORS = [
  "hsl(217, 91%, 60%)",
  "hsl(142, 71%, 45%)",
  "hsl(45, 93%, 47%)",
  "hsl(0, 84%, 60%)",
  "hsl(270, 60%, 55%)",
  "hsl(200, 80%, 50%)",
];

export default function GradesChart({ data, categoryNames }: GradesChartProps) {
  if (data.length === 0) return null;

  const chartData = data.map((row) => {
    const entry: Record<string, any> = { name: row.student_name.split(" ").slice(0, 2).join(" ") };
    categoryNames.forEach((cat) => {
      entry[cat] = row.categories[cat] ?? 0;
    });
    entry["المجموع"] = row.total;
    return entry;
  });

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">مقارنة درجات الطلاب</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={60} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            {categoryNames.map((cat, i) => (
              <Bar key={cat} dataKey={cat} fill={COLORS[i % COLORS.length]} radius={[2, 2, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
