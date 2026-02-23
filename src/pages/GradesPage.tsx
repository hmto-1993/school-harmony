import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClipboardList, BarChart3, UserCheck } from "lucide-react";
import DailyGradeEntry from "@/components/grades/DailyGradeEntry";
import GradesSummary from "@/components/grades/GradesSummary";
import BehaviorEntry from "@/components/grades/BehaviorEntry";

export default function GradesPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">الدرجات والتقييمات</h1>
        <p className="text-muted-foreground">إدخال وعرض درجات الطلاب حسب فئات التقييم</p>
      </div>

      <Tabs defaultValue="daily" dir="rtl">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="daily" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            إدخال يومي
          </TabsTrigger>
          <TabsTrigger value="behavior" className="gap-2">
            <UserCheck className="h-4 w-4" />
            السلوك
          </TabsTrigger>
          <TabsTrigger value="summary" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            خلاصة التقييمات
          </TabsTrigger>
        </TabsList>

        <TabsContent value="daily">
          <DailyGradeEntry />
        </TabsContent>

        <TabsContent value="behavior">
          <BehaviorEntry />
        </TabsContent>

        <TabsContent value="summary">
          <GradesSummary />
        </TabsContent>
      </Tabs>
    </div>
  );
}
