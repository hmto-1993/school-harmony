import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Notification {
  id: string;
  type: string;
  message: string;
  is_read: boolean;
  created_at: string;
  students: { full_name: string } | null;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    const { data } = await supabase
      .from("notifications")
      .select("id, type, message, is_read, created_at, students(full_name)")
      .order("created_at", { ascending: false })
      .limit(100);
    setNotifications((data as Notification[]) || []);
  };

  const markAsRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    fetchNotifications();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">الإشعارات</h1>
        <p className="text-muted-foreground">إشعارات الحضور والغياب</p>
      </div>

      <div className="space-y-3">
        {notifications.length === 0 ? (
          <Card className="shadow-card">
            <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Bell className="h-12 w-12 mb-3 opacity-30" />
              <p>لا توجد إشعارات</p>
            </CardContent>
          </Card>
        ) : (
          notifications.map((n) => (
            <Card
              key={n.id}
              className={`shadow-card transition-colors ${!n.is_read ? "border-primary/30 bg-primary/5" : ""}`}
            >
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    n.type === "absent" ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"
                  }`}>
                    <Bell className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium">{n.students?.full_name}</p>
                    <p className="text-sm text-muted-foreground">{n.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(n.created_at).toLocaleDateString("ar-SA")} - {new Date(n.created_at).toLocaleTimeString("ar-SA")}
                    </p>
                  </div>
                </div>
                {!n.is_read && (
                  <Button variant="ghost" size="sm" onClick={() => markAsRead(n.id)}>
                    <CheckCircle className="h-4 w-4" />
                  </Button>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
