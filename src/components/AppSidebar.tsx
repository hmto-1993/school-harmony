import { useLocation, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import schoolLogo from "@/assets/school-logo.jpg";
import {
  LayoutDashboard,
  Users,
  ClipboardCheck,
  GraduationCap,
  BarChart3,
  Bell,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const adminLinks = [
  { to: "/dashboard", label: "لوحة التحكم", icon: LayoutDashboard },
  { to: "/students", label: "الطلاب", icon: Users },
  { to: "/attendance", label: "الحضور والغياب", icon: ClipboardCheck },
  { to: "/grades", label: "الدرجات", icon: GraduationCap },
  { to: "/reports", label: "التقارير", icon: BarChart3 },
  { to: "/notifications", label: "الإشعارات", icon: Bell },
  { to: "/settings", label: "الإعدادات", icon: Settings },
];

const teacherLinks = [
  { to: "/dashboard", label: "لوحة التحكم", icon: LayoutDashboard },
  { to: "/attendance", label: "الحضور والغياب", icon: ClipboardCheck },
  { to: "/grades", label: "الدرجات", icon: GraduationCap },
  { to: "/notifications", label: "الإشعارات", icon: Bell },
];

export default function AppSidebar() {
  const { role, signOut } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const links = role === "admin" ? adminLinks : teacherLinks;

  return (
    <aside
      className={cn(
        "gradient-sidebar flex flex-col text-sidebar-foreground transition-all duration-300 min-h-screen sticky top-0",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* الشعار */}
      <div className="flex items-center gap-3 p-4 border-b border-sidebar-border">
        <img src={schoolLogo} alt="الشعار" className="h-10 w-10 rounded-lg object-contain bg-white/10 p-1" />
        {!collapsed && (
          <div className="min-w-0">
            <h2 className="text-sm font-bold truncate">ثانوية الفيصلية</h2>
            <p className="text-xs text-sidebar-foreground/60">نظام الإدارة</p>
          </div>
        )}
      </div>

      {/* الروابط */}
      <nav className="flex-1 p-2 space-y-1">
        {links.map((link) => {
          const isActive = location.pathname === link.to;
          return (
            <Link
              key={link.to}
              to={link.to}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary font-medium"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <link.icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{link.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* الأسفل */}
      <div className="p-2 border-t border-sidebar-border space-y-1">
        <button
          onClick={signOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/70 hover:bg-destructive/20 hover:text-destructive transition-colors"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!collapsed && <span>تسجيل الخروج</span>}
        </button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className="w-full justify-center text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
        >
          {collapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
      </div>
    </aside>
  );
}
