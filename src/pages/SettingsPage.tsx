import { Card, CardContent } from "@/components/ui/card";
import { Settings as SettingsIcon } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">الإعدادات</h1>
        <p className="text-muted-foreground">إعدادات النظام والشعب والفئات</p>
      </div>

      <Card className="shadow-card">
        <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <SettingsIcon className="h-16 w-16 mb-4 opacity-30" />
          <h3 className="text-lg font-medium mb-2">قريبًا</h3>
          <p className="text-sm text-center max-w-md">
            سيتم إضافة إعدادات إدارة الشعب وفئات التقييم وحسابات المعلمين
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
