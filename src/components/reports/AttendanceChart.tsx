import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface AttendanceChartProps {
  data: { status: string }[];
}

const STATUS_LABELS: Record<string, string> = {
  present: "حاضر",
  absent: "غائب",
  late: "متأخر",
  early_leave: "خروج مبكر",
  sick_leave: "إجازة مرضية",
};

const COLORS = [
  "hsl(142, 71%, 45%)",  // present - green
  "hsl(0, 84%, 60%)",    // absent - red
  "hsl(45, 93%, 47%)",   // late - yellow
  "hsl(200, 80%, 50%)",  // early_leave - blue
  "hsl(270, 60%, 55%)",  // sick_leave - purple
];

export default function AttendanceChart({ data }: AttendanceChartProps) {
  const chartData = useMemo(() => {
    const counts: Record<string, number> = {};
    data.forEach((r) => {
      counts[r.status] = (counts[r.status] || 0) + 1;
    });
    return Object.entries(counts).map(([status, value]) => ({
      name: STATUS_LABELS[status] || status,
      value,
    }));
  }, [data]);

  if (chartData.length === 0) return null;

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">توزيع الحضور</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={3}
              dataKey="value"
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            >
              {chartData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
