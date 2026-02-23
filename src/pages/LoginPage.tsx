import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import schoolLogo from "@/assets/school-logo.jpg";
import loginBg from "@/assets/login-bg.jpg";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(false);
  const [schoolName, setSchoolName] = useState("ثانوية الفيصلية");
  const [schoolSubtitle, setSchoolSubtitle] = useState("نظام إدارة المدرسة");
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    supabase.from("site_settings").select("id, value").then(({ data }) => {
      data?.forEach((row) => {
        if (row.id === "school_name") setSchoolName(row.value);
        if (row.id === "school_subtitle") setSchoolSubtitle(row.value);
      });
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);

    if (error) {
      toast({
        title: "خطأ في تسجيل الدخول",
        description: "البريد الإلكتروني أو كلمة المرور غير صحيحة",
        variant: "destructive",
      });
    } else {
      navigate("/dashboard");
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${loginBg})`, filter: "brightness(0.35)" }}
      />
      <div className="relative z-10 w-full max-w-md animate-fade-in">
        <Card className="shadow-card border-border/50 bg-background/90 backdrop-blur-sm">
          <CardHeader className="flex flex-col items-center gap-4 pb-2">
            <img
              src={schoolLogo}
              alt="شعار المدرسة"
              className="h-24 w-auto"
            />
            <div className="text-center">
              <h1 className="text-2xl font-bold text-foreground">{schoolName}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{schoolSubtitle}</p>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">البريد الإلكتروني</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="example@school.edu.sa"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="text-right"
                  dir="ltr"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">كلمة المرور</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  dir="ltr"
                  required
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="remember"
                  checked={remember}
                  onCheckedChange={(c) => setRemember(c === true)}
                />
                <Label htmlFor="remember" className="text-sm text-muted-foreground cursor-pointer">
                  تذكرني
                </Label>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "جارٍ الدخول..." : "تسجيل الدخول"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
