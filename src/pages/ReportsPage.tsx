import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";

export default function ReportsPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">التقارير والإحصائيات</h1>
        <p className="text-muted-foreground">تقارير الحضور والدرجات</p>
      </div>

      <Card className="shadow-card">
        <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <BarChart3 className="h-16 w-16 mb-4 opacity-30" />
          <h3 className="text-lg font-medium mb-2">قريبًا</h3>
          <p className="text-sm text-center max-w-md">
            سيتم إضافة تقارير الحضور اليومية والأسبوعية والشهرية مع إمكانية التصدير بصيغة PDF و Excel
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
