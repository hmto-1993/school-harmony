import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus, CalendarDays, CalendarRange } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line,
} from "recharts";
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths, eachDayOfInterval } from "date-fns";
import { ar } from "date-fns/locale";

interface PeriodStats {
  present: number;
  absent: number;
  late: number;
  total: number;
  rate: number;
  behaviorPositive: number;
  behaviorNegative: number;
}

interface DailyTrend {
  day: string;
  حاضر: number;
  غائب: number;
  متأخر: number;
}

function TrendBadge({ current, previous, label }: { current: number; previous: number; label: string }) {
  const diff = previous > 0 ? Math.round(((current - previous) / previous) * 100) : 0;
  const isUp = diff > 0;
  const isDown = diff < 0;

  return (
    <div className="flex flex-col items-center gap-1 p-3 rounded-lg bg-muted/40">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold">{current}</p>
      {previous > 0 && (
        <div className={`flex items-center gap-1 text-xs font-medium ${
          isUp ? "text-green-600" : isDown ? "text-destructive" : "text-muted-foreground"
        }`}>
          {isUp ? <TrendingUp className="h-3 w-3" /> : isDown ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
          <span>{Math.abs(diff)}%</span>
        </div>
      )}
    </div>
  );
}

function RateBadge({ current, previous, label }: { current: number; previous: number; label: string }) {
  const diff = current - previous;
  const isUp = diff > 0;
  const isDown = diff < 0;

  return (
    <div className="flex flex-col items-center gap-1 p-3 rounded-lg bg-muted/40">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold ${current >= 80 ? "text-green-600" : current >= 50 ? "text-yellow-600" : "text-destructive"}`}>
        {current}%
      </p>
      {previous > 0 && (
        <div className={`flex items-center gap-1 text-xs font-medium ${
          isUp ? "text-green-600" : isDown ? "text-destructive" : "text-muted-foreground"
        }`}>
          {isUp ? <TrendingUp className="h-3 w-3" /> : isDown ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
          <span>{Math.abs(diff)} نقطة</span>
        </div>
      )}
    </div>
  );
}

async function fetchPeriodData(from: string, to: string, totalStudents: number): Promise<PeriodStats> {
  const [{ data: att }, { data: beh }] = await Promise.all([
    supabase.from("attendance_records").select("status").gte("date", from).lte("date", to),
    supabase.from("behavior_records").select("type").gte("date", from).lte("date", to),
  ]);

  const attendance = att || [];
  const behavior = beh || [];
  const present = attendance.filter((r) => r.status === "present").length;
  const absent = attendance.filter((r) => r.status === "absent").length;
  const late = attendance.filter((r) => r.status === "late").length;

  // Calculate working days in range (approximate)
  const days = eachDayOfInterval({ start: new Date(from), end: new Date(to) });
  const workingDays = days.filter(d => d.getDay() !== 5 && d.getDay() !== 6).length;
  const expectedTotal = totalStudents * workingDays;
  const rate = expectedTotal > 0 ? Math.round((present / expectedTotal) * 100) : 0;

  return {
    present,
    absent,
    late,
    total: attendance.length,
    rate,
    behaviorPositive: behavior.filter((b) => b.type === "positive").length,
    behaviorNegative: behavior.filter((b) => b.type === "negative").length,
  };
}

export default function PeriodComparison() {
  const [totalStudents, setTotalStudents] = useState(0);
  const [weekCurrent, setWeekCurrent] = useState<PeriodStats | null>(null);
  const [weekPrevious, setWeekPrevious] = useState<PeriodStats | null>(null);
  const [monthCurrent, setMonthCurrent] = useState<PeriodStats | null>(null);
  const [monthPrevious, setMonthPrevious] = useState<PeriodStats | null>(null);
  const [dailyTrend, setDailyTrend] = useState<DailyTrend[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: students } = await supabase.from("students").select("id");
    const count = students?.length || 0;
    setTotalStudents(count);

    const now = new Date();
    const thisWeekStart = format(startOfWeek(now, { weekStartsOn: 0 }), "yyyy-MM-dd");
    const thisWeekEnd = format(endOfWeek(now, { weekStartsOn: 0 }), "yyyy-MM-dd");
    const lastWeekStart = format(startOfWeek(subWeeks(now, 1), { weekStartsOn: 0 }), "yyyy-MM-dd");
    const lastWeekEnd = format(endOfWeek(subWeeks(now, 1), { weekStartsOn: 0 }), "yyyy-MM-dd");

    const thisMonthStart = format(startOfMonth(now), "yyyy-MM-dd");
    const thisMonthEnd = format(endOfMonth(now), "yyyy-MM-dd");
    const lastMonthStart = format(startOfMonth(subMonths(now, 1)), "yyyy-MM-dd");
    const lastMonthEnd = format(endOfMonth(subMonths(now, 1)), "yyyy-MM-dd");

    const [wc, wp, mc, mp] = await Promise.all([
      fetchPeriodData(thisWeekStart, thisWeekEnd, count),
      fetchPeriodData(lastWeekStart, lastWeekEnd, count),
      fetchPeriodData(thisMonthStart, thisMonthEnd, count),
      fetchPeriodData(lastMonthStart, lastMonthEnd, count),
    ]);

    setWeekCurrent(wc);
    setWeekPrevious(wp);
    setMonthCurrent(mc);
    setMonthPrevious(mp);

    // Daily trend for last 7 days
    const last7 = Array.from({ length: 7 }, (_, i) => {
      const d = subDays(now, 6 - i);
      return format(d, "yyyy-MM-dd");
    });

    const { data: trendData } = await supabase
      .from("attendance_records")
      .select("date, status")
      .gte("date", last7[0])
      .lte("date", last7[6]);

    const trend: DailyTrend[] = last7.map((date) => {
      const dayRecords = (trendData || []).filter((r) => r.date === date);
      return {
        day: format(new Date(date), "EEE", { locale: ar }),
        حاضر: dayRecords.filter((r) => r.status === "present").length,
        غائب: dayRecords.filter((r) => r.status === "absent").length,
        متأخر: dayRecords.filter((r) => r.status === "late").length,
      };
    });
    setDailyTrend(trend);
  };

  if (!weekCurrent || !monthCurrent) return null;

  return (
    <div className="space-y-4">
      {/* Weekly Comparison */}
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            مقارنة أسبوعية
            <span className="text-xs text-muted-foreground font-normal">(هذا الأسبوع مقابل الأسبوع الماضي)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <RateBadge current={weekCurrent.rate} previous={weekPrevious?.rate || 0} label="نسبة الحضور" />
            <TrendBadge current={weekCurrent.present} previous={weekPrevious?.present || 0} label="حاضر" />
            <TrendBadge current={weekCurrent.absent} previous={weekPrevious?.absent || 0} label="غائب" />
            <TrendBadge current={weekCurrent.late} previous={weekPrevious?.late || 0} label="متأخر" />
            <TrendBadge current={weekCurrent.behaviorNegative} previous={weekPrevious?.behaviorNegative || 0} label="سلوك سلبي" />
          </div>
        </CardContent>
      </Card>

      {/* Monthly Comparison */}
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarRange className="h-4 w-4" />
            مقارنة شهرية
            <span className="text-xs text-muted-foreground font-normal">(هذا الشهر مقابل الشهر الماضي)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <RateBadge current={monthCurrent.rate} previous={monthPrevious?.rate || 0} label="نسبة الحضور" />
            <TrendBadge current={monthCurrent.present} previous={monthPrevious?.present || 0} label="حاضر" />
            <TrendBadge current={monthCurrent.absent} previous={monthPrevious?.absent || 0} label="غائب" />
            <TrendBadge current={monthCurrent.late} previous={monthPrevious?.late || 0} label="متأخر" />
            <TrendBadge current={monthCurrent.behaviorNegative} previous={monthPrevious?.behaviorNegative || 0} label="سلوك سلبي" />
          </div>
        </CardContent>
      </Card>

      {/* Daily Trend Line Chart */}
      {dailyTrend.length > 0 && (
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              اتجاه الحضور — آخر ٧ أيام
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={dailyTrend} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="حاضر" stroke="hsl(142, 71%, 45%)" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="غائب" stroke="hsl(0, 84%, 60%)" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="متأخر" stroke="hsl(45, 93%, 47%)" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
