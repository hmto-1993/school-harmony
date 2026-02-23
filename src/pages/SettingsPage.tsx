import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Settings as SettingsIcon,
  Plus,
  Trash2,
  Save,
  GraduationCap,
  Users,
  Eye,
  UserCircle,
  KeyRound,
  Printer,
  Upload,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ClassRow {
  id: string;
  name: string;
  grade: string;
  section: string;
  academic_year: string;
  created_at: string;
  studentCount?: number;
}

interface GradeCategory {
  id: string;
  name: string;
  weight: number;
  max_score: number;
  sort_order: number;
  class_id: string | null;
  class_name?: string;
}

export default function SettingsPage() {
  const { role, user } = useAuth();
  const isAdmin = role === "admin";

  // Profile state
  const [profileName, setProfileName] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileNationalId, setProfileNationalId] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Teacher password management
  const [teachers, setTeachers] = useState<{ user_id: string; email: string; full_name: string }[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // New teacher form
  const [newTeacherName, setNewTeacherName] = useState("");
  const [newTeacherEmail, setNewTeacherEmail] = useState("");
  const [newTeacherPassword, setNewTeacherPassword] = useState("");
  const [newTeacherNationalId, setNewTeacherNationalId] = useState("");
  const [creatingTeacher, setCreatingTeacher] = useState(false);

  // Letterhead
  const [letterheadUrl, setLetterheadUrl] = useState("");
  const [uploadingLetterhead, setUploadingLetterhead] = useState(false);

  // Change own password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newOwnPassword, setNewOwnPassword] = useState("");
  const [confirmOwnPassword, setConfirmOwnPassword] = useState("");
  const [changingOwnPassword, setChangingOwnPassword] = useState(false);

  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [categories, setCategories] = useState<GradeCategory[]>([]);
  const [loading, setLoading] = useState(true);

  // New class form
  const [newClassName, setNewClassName] = useState("");
  const [newSection, setNewSection] = useState("");
  const [newGrade, setNewGrade] = useState("الأول الثانوي");
  const [newYear, setNewYear] = useState("1446-1447");

  // Edit category
  const [editingCats, setEditingCats] = useState<Record<string, { weight: number; max_score: number }>>({});
  const [savingCats, setSavingCats] = useState(false);

  // New category form
  const [newCatClassId, setNewCatClassId] = useState("");
  const [newCatName, setNewCatName] = useState("");
  const [newCatWeight, setNewCatWeight] = useState(10);
  const [newCatMaxScore, setNewCatMaxScore] = useState(100);

  const fetchData = async () => {
    setLoading(true);
    const [classesRes, catsRes, studentsRes] = await Promise.all([
      supabase.from("classes").select("*").order("name"),
      supabase.from("grade_categories").select("*, classes(name)").order("sort_order"),
      supabase.from("students").select("id, class_id"),
    ]);

    const classData = (classesRes.data || []) as ClassRow[];
    const studentCounts: Record<string, number> = {};
    (studentsRes.data || []).forEach((s: any) => {
      if (s.class_id) studentCounts[s.class_id] = (studentCounts[s.class_id] || 0) + 1;
    });
    classData.forEach((c) => (c.studentCount = studentCounts[c.id] || 0));

    setClasses(classData);

    const catData = (catsRes.data || []).map((c: any) => ({
      ...c,
      class_name: c.classes?.name || "—",
    }));
    setCategories(catData);

    // Init editing state
    const edits: Record<string, { weight: number; max_score: number }> = {};
    catData.forEach((c: GradeCategory) => {
      edits[c.id] = { weight: c.weight, max_score: c.max_score };
    });
    setEditingCats(edits);

    // Fetch profile
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, phone, national_id")
        .eq("user_id", user.id)
        .single();
      if (profile) {
        setProfileName(profile.full_name || "");
        setProfilePhone(profile.phone || "");
        setProfileNationalId(profile.national_id || "");
      }
    }

    // Fetch teachers list for admin
    if (user && isAdmin) {
      const { data: teachersData } = await supabase.functions.invoke("manage-users", {
        body: { action: "list_teachers" },
      });
      if (teachersData?.teachers) {
        setTeachers(teachersData.teachers);
      }
    }

    // Fetch letterhead URL
    const { data: lhSetting } = await supabase
      .from("site_settings")
      .select("value")
      .eq("id", "print_letterhead_url")
      .single();
    if (lhSetting?.value) setLetterheadUrl(lhSetting.value);

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: profileName,
        phone: profilePhone,
        national_id: profileNationalId || null,
      })
      .eq("user_id", user.id);
    setSavingProfile(false);
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "تم الحفظ", description: "تم تحديث الملف الشخصي بنجاح" });
    }
  };

  const handleChangeOwnPassword = async () => {
    if (!newOwnPassword.trim() || !currentPassword.trim()) return;
    if (newOwnPassword !== confirmOwnPassword) {
      toast({ title: "خطأ", description: "كلمة المرور الجديدة غير متطابقة", variant: "destructive" });
      return;
    }
    setChangingOwnPassword(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user?.email || "",
      password: currentPassword,
    });
    if (signInError) {
      toast({ title: "خطأ", description: "كلمة المرور الحالية غير صحيحة", variant: "destructive" });
      setChangingOwnPassword(false);
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newOwnPassword });
    setChangingOwnPassword(false);
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "تم التغيير", description: "تم تغيير كلمة المرور بنجاح" });
      setCurrentPassword("");
      setNewOwnPassword("");
      setConfirmOwnPassword("");
    }
  };

  const handleChangePassword = async () => {
    if (!selectedTeacher || !newPassword.trim()) return;
    const teacher = teachers.find((t) => t.user_id === selectedTeacher);
    if (!teacher) return;

    setChangingPassword(true);
    const { data, error } = await supabase.functions.invoke("manage-users", {
      body: { action: "change_password", email: teacher.email, password: newPassword },
    });
    setChangingPassword(false);

    if (error || data?.error) {
      toast({ title: "خطأ", description: data?.error || "فشل في تغيير كلمة المرور", variant: "destructive" });
    } else {
      toast({ title: "تم التغيير", description: `تم تغيير كلمة المرور لـ ${teacher.full_name}` });
      setNewPassword("");
      setSelectedTeacher("");
    }
  };

  const handleCreateTeacher = async () => {
    if (!newTeacherName.trim() || !newTeacherEmail.trim() || !newTeacherPassword.trim()) return;
    setCreatingTeacher(true);

    const { data, error } = await supabase.functions.invoke("manage-users", {
      body: {
        action: "create_user",
        email: newTeacherEmail,
        password: newTeacherPassword,
        full_name: newTeacherName,
        role: "teacher",
      },
    });

    if (error || data?.error) {
      toast({ title: "خطأ", description: data?.error || "فشل في إنشاء الحساب", variant: "destructive" });
      setCreatingTeacher(false);
      return;
    }

    if (newTeacherNationalId.trim() && data?.user_id) {
      await supabase
        .from("profiles")
        .update({ national_id: newTeacherNationalId })
        .eq("user_id", data.user_id);
    }

    toast({ title: "تم الإنشاء", description: `تم إنشاء حساب ${newTeacherName} بنجاح` });
    setNewTeacherName("");
    setNewTeacherEmail("");
    setNewTeacherPassword("");
    setNewTeacherNationalId("");
    setCreatingTeacher(false);
    fetchData();
  };

  const handleUploadLetterhead = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLetterhead(true);

    const formData = new FormData();
    formData.append("file", file);

    const { data, error } = await supabase.functions.invoke("upload-letterhead", {
      body: formData,
    });

    setUploadingLetterhead(false);
    if (error || data?.error) {
      toast({ title: "خطأ", description: data?.error || "فشل رفع الملف", variant: "destructive" });
    } else {
      setLetterheadUrl(data.url);
      toast({ title: "تم الرفع", description: "تم تحديث ورقة الطباعة بنجاح" });
    }
  };

  const handleAddClass = async () => {
    if (!newClassName.trim() || !newSection.trim()) return;
    const { error } = await supabase.from("classes").insert({
      name: newClassName,
      section: newSection,
      grade: newGrade,
      academic_year: newYear,
    });
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "تمت الإضافة", description: `تمت إضافة الشعبة ${newClassName}` });
      setNewClassName("");
      setNewSection("");
      fetchData();
    }
  };

  const handleDeleteClass = async (id: string) => {
    const { error } = await supabase.from("classes").delete().eq("id", id);
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "تم الحذف" });
      fetchData();
    }
  };

  const handleSaveCategories = async () => {
    setSavingCats(true);
    const updates = Object.entries(editingCats).map(([id, vals]) =>
      supabase
        .from("grade_categories")
        .update({ weight: vals.weight, max_score: vals.max_score })
        .eq("id", id)
    );
    const results = await Promise.all(updates);
    const hasError = results.some((r) => r.error);
    if (hasError) {
      toast({ title: "خطأ في الحفظ", variant: "destructive" });
    } else {
      toast({ title: "تم الحفظ", description: "تم تحديث أوزان التقييم بنجاح" });
      fetchData();
    }
    setSavingCats(false);
  };

  const handleAddCategory = async () => {
    if (!newCatName.trim() || !newCatClassId) return;
    const classCats = categories.filter((c) => c.class_id === newCatClassId);
    const maxOrder = classCats.length > 0 ? Math.max(...classCats.map((c) => c.sort_order)) : 0;
    const { error } = await supabase.from("grade_categories").insert({
      name: newCatName,
      weight: newCatWeight,
      max_score: newCatMaxScore,
      class_id: newCatClassId,
      sort_order: maxOrder + 1,
    });
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "تمت الإضافة", description: `تمت إضافة فئة "${newCatName}"` });
      setNewCatName("");
      setNewCatWeight(10);
      setNewCatMaxScore(100);
      fetchData();
    }
  };

  const handleDeleteCategory = async (id: string) => {
    const { error } = await supabase.from("grade_categories").delete().eq("id", id);
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "تم الحذف" });
      fetchData();
    }
  };

  // Filter categories by selected class
  const [catClassFilter, setCatClassFilter] = useState("all");
  const filteredCategories = catClassFilter === "all"
    ? categories
    : categories.filter((c) => c.class_id === catClassFilter);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">الإعدادات</h1>
          <p className="text-muted-foreground">
            {isAdmin ? "إدارة الشعب وفئات التقييم" : "عرض إحصائيات الشعب والتقييمات"}
          </p>
        </div>
        {!isAdmin && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
            <Eye className="h-3.5 w-3.5" />
            للاطلاع فقط
          </span>
        )}
      </div>

      <Tabs defaultValue="classes" dir="rtl">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="classes" className="gap-1.5">
            <Users className="h-4 w-4" />
            الشعب الدراسية
          </TabsTrigger>
          <TabsTrigger value="categories" className="gap-1.5">
            <GraduationCap className="h-4 w-4" />
            فئات التقييم
          </TabsTrigger>
          <TabsTrigger value="profile" className="gap-1.5">
            <UserCircle className="h-4 w-4" />
            الملف الشخصي
          </TabsTrigger>
          {isAdmin && (
            <>
              <TabsTrigger value="passwords" className="gap-1.5">
                <KeyRound className="h-4 w-4" />
                كلمات المرور
              </TabsTrigger>
              <TabsTrigger value="new-teacher" className="gap-1.5">
                <Plus className="h-4 w-4" />
                إضافة معلم
              </TabsTrigger>
              <TabsTrigger value="letterhead" className="gap-1.5">
                <Printer className="h-4 w-4" />
                ورقة الطباعة
              </TabsTrigger>
            </>
          )}
        </TabsList>

        {/* ===== الشعب ===== */}
        <TabsContent value="classes">
          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">الشعب الدراسية ({classes.length})</CardTitle>
              {isAdmin && (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-1.5">
                      <Plus className="h-4 w-4" />
                      إضافة شعبة
                    </Button>
                  </DialogTrigger>
                  <DialogContent dir="rtl">
                    <DialogHeader>
                      <DialogTitle>إضافة شعبة جديدة</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                      <div className="space-y-2">
                        <Label>اسم الشعبة</Label>
                        <Input
                          placeholder="مثال: أول/6"
                          value={newClassName}
                          onChange={(e) => setNewClassName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>رقم الشعبة</Label>
                        <Input
                          placeholder="مثال: 6"
                          value={newSection}
                          onChange={(e) => setNewSection(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>الصف</Label>
                        <Input value={newGrade} onChange={(e) => setNewGrade(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>العام الدراسي</Label>
                        <Input value={newYear} onChange={(e) => setNewYear(e.target.value)} />
                      </div>
                    </div>
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button variant="outline">إلغاء</Button>
                      </DialogClose>
                      <DialogClose asChild>
                        <Button onClick={handleAddClass}>إضافة</Button>
                      </DialogClose>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الشعبة</TableHead>
                    <TableHead className="text-right">الصف</TableHead>
                    <TableHead className="text-right">رقم الشعبة</TableHead>
                    <TableHead className="text-right">العام الدراسي</TableHead>
                    <TableHead className="text-right">عدد الطلاب</TableHead>
                    {isAdmin && <TableHead className="text-right">إجراءات</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classes.map((cls) => (
                    <TableRow key={cls.id}>
                      <TableCell className="font-medium">{cls.name}</TableCell>
                      <TableCell>{cls.grade}</TableCell>
                      <TableCell>{cls.section}</TableCell>
                      <TableCell>{cls.academic_year}</TableCell>
                      <TableCell>{cls.studentCount}</TableCell>
                      {isAdmin && (
                        <TableCell>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent dir="rtl">
                              <AlertDialogHeader>
                                <AlertDialogTitle>حذف الشعبة {cls.name}؟</AlertDialogTitle>
                                <AlertDialogDescription>
                                  سيتم حذف الشعبة وجميع البيانات المرتبطة بها. هذا الإجراء لا يمكن التراجع عنه.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={() => handleDeleteClass(cls.id)}
                                >
                                  حذف
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== فئات التقييم ===== */}
        <TabsContent value="categories">
          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-lg">فئات التقييم</CardTitle>
              {isAdmin && (
                <div className="flex gap-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline" className="gap-1.5">
                        <Plus className="h-4 w-4" />
                        إضافة فئة تقييم
                      </Button>
                    </DialogTrigger>
                    <DialogContent dir="rtl">
                      <DialogHeader>
                        <DialogTitle>إضافة فئة تقييم جديدة</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-2">
                        <div className="space-y-2">
                          <Label>الشعبة</Label>
                          <Select value={newCatClassId} onValueChange={setNewCatClassId}>
                            <SelectTrigger>
                              <SelectValue placeholder="اختر الشعبة" />
                            </SelectTrigger>
                            <SelectContent>
                              {classes.map((cls) => (
                                <SelectItem key={cls.id} value={cls.id}>
                                  {cls.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>اسم الفئة</Label>
                          <Input
                            placeholder="مثال: اختبار نهائي"
                            value={newCatName}
                            onChange={(e) => setNewCatName(e.target.value)}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>الوزن (%)</Label>
                            <Input
                              type="number"
                              value={newCatWeight}
                              onChange={(e) => setNewCatWeight(parseFloat(e.target.value) || 0)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>الدرجة القصوى</Label>
                            <Input
                              type="number"
                              value={newCatMaxScore}
                              onChange={(e) => setNewCatMaxScore(parseFloat(e.target.value) || 0)}
                            />
                          </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <DialogClose asChild>
                          <Button variant="outline">إلغاء</Button>
                        </DialogClose>
                        <DialogClose asChild>
                          <Button onClick={handleAddCategory} disabled={!newCatName.trim() || !newCatClassId}>
                            إضافة
                          </Button>
                        </DialogClose>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={handleSaveCategories}
                    disabled={savingCats}
                  >
                    <Save className="h-4 w-4" />
                    {savingCats ? "جارٍ الحفظ..." : "حفظ التغييرات"}
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Label className="whitespace-nowrap">الشعبة:</Label>
                <Select value={catClassFilter} onValueChange={setCatClassFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الشعب</SelectItem>
                    {classes.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الفئة</TableHead>
                    {catClassFilter === "all" && <TableHead className="text-right">الشعبة</TableHead>}
                    <TableHead className="text-right">الوزن (%)</TableHead>
                    <TableHead className="text-right">الدرجة القصوى</TableHead>
                    {isAdmin && <TableHead className="text-right">إجراءات</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCategories.map((cat) => (
                    <TableRow key={cat.id}>
                      <TableCell className="font-medium">{cat.name}</TableCell>
                      {catClassFilter === "all" && <TableCell>{cat.class_name}</TableCell>}
                      <TableCell>
                        {isAdmin ? (
                          <Input
                            type="number"
                            className="w-24"
                            value={editingCats[cat.id]?.weight ?? cat.weight}
                            onChange={(e) =>
                              setEditingCats((prev) => ({
                                ...prev,
                                [cat.id]: {
                                  ...prev[cat.id],
                                  weight: parseFloat(e.target.value) || 0,
                                },
                              }))
                            }
                          />
                        ) : (
                          <span>{cat.weight}%</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isAdmin ? (
                          <Input
                            type="number"
                            className="w-24"
                            value={editingCats[cat.id]?.max_score ?? cat.max_score}
                            onChange={(e) =>
                              setEditingCats((prev) => ({
                                ...prev,
                                [cat.id]: {
                                  ...prev[cat.id],
                                  max_score: parseFloat(e.target.value) || 0,
                                },
                              }))
                            }
                          />
                        ) : (
                          <span>{cat.max_score}</span>
                        )}
                      </TableCell>
                      {isAdmin && (
                        <TableCell>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent dir="rtl">
                              <AlertDialogHeader>
                                <AlertDialogTitle>حذف فئة "{cat.name}"؟</AlertDialogTitle>
                                <AlertDialogDescription>
                                  سيتم حذف هذه الفئة وجميع الدرجات المرتبطة بها. هذا الإجراء لا يمكن التراجع عنه.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={() => handleDeleteCategory(cat.id)}
                                >
                                  حذف
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {/* Total weight per class */}
              {catClassFilter !== "all" && (
                <div className="text-xs text-muted-foreground text-left">
                  مجموع الأوزان:{" "}
                  <span
                    className={
                      filteredCategories.reduce((sum, c) => sum + (editingCats[c.id]?.weight ?? c.weight), 0) === 100
                        ? "text-green-600 font-bold"
                        : "text-destructive font-bold"
                    }
                  >
                    {filteredCategories.reduce((sum, c) => sum + (editingCats[c.id]?.weight ?? c.weight), 0)}%
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        {/* ===== الملف الشخصي ===== */}
        <TabsContent value="profile">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-lg">الملف الشخصي</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 max-w-md">
              <div className="space-y-2">
                <Label>الاسم الكامل</Label>
                <Input
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="الاسم الكامل"
                />
              </div>
              <div className="space-y-2">
                <Label>رقم الجوال</Label>
                <Input
                  value={profilePhone}
                  onChange={(e) => setProfilePhone(e.target.value)}
                  placeholder="05XXXXXXXX"
                  dir="ltr"
                  className="text-right"
                />
              </div>
              <div className="space-y-2">
                <Label>رقم الهوية الوطنية</Label>
                <Input
                  value={profileNationalId}
                  onChange={(e) => setProfileNationalId(e.target.value)}
                  placeholder="1XXXXXXXXX"
                  dir="ltr"
                  className="text-right"
                  inputMode="numeric"
                />
                <p className="text-xs text-muted-foreground">
                  يُستخدم لتسجيل الدخول بدلاً من البريد الإلكتروني
                </p>
              </div>
              <Button onClick={handleSaveProfile} disabled={savingProfile} className="gap-1.5">
                <Save className="h-4 w-4" />
                {savingProfile ? "جارٍ الحفظ..." : "حفظ التغييرات"}
              </Button>

              <div className="border-t pt-4 mt-4 space-y-4">
                <h3 className="text-base font-semibold">تغيير كلمة المرور</h3>
                <div className="space-y-2">
                  <Label>كلمة المرور الحالية</Label>
                  <Input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="أدخل كلمة المرور الحالية"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2">
                  <Label>كلمة المرور الجديدة</Label>
                  <Input
                    type="password"
                    value={newOwnPassword}
                    onChange={(e) => setNewOwnPassword(e.target.value)}
                    placeholder="أدخل كلمة المرور الجديدة"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2">
                  <Label>تأكيد كلمة المرور الجديدة</Label>
                  <Input
                    type="password"
                    value={confirmOwnPassword}
                    onChange={(e) => setConfirmOwnPassword(e.target.value)}
                    placeholder="أعد إدخال كلمة المرور الجديدة"
                    dir="ltr"
                  />
                </div>
                <Button
                  onClick={handleChangeOwnPassword}
                  disabled={changingOwnPassword || !currentPassword.trim() || !newOwnPassword.trim() || !confirmOwnPassword.trim()}
                  className="gap-1.5"
                >
                  <KeyRound className="h-4 w-4" />
                  {changingOwnPassword ? "جارٍ التغيير..." : "تغيير كلمة المرور"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        {/* ===== كلمات المرور ===== */}
        {isAdmin && (
          <>
            <TabsContent value="passwords">
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle className="text-lg">تغيير كلمة مرور المعلم</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 max-w-md">
                  <div className="space-y-2">
                    <Label>اختر المعلم</Label>
                    <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
                      <SelectTrigger>
                        <SelectValue placeholder="اختر المعلم" />
                      </SelectTrigger>
                      <SelectContent>
                        {teachers.map((t) => (
                          <SelectItem key={t.user_id} value={t.user_id}>
                            {t.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>كلمة المرور الجديدة</Label>
                    <Input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="أدخل كلمة المرور الجديدة"
                      dir="ltr"
                    />
                  </div>
                  <Button
                    onClick={handleChangePassword}
                    disabled={changingPassword || !selectedTeacher || !newPassword.trim()}
                    className="gap-1.5"
                  >
                    <KeyRound className="h-4 w-4" />
                    {changingPassword ? "جارٍ التغيير..." : "تغيير كلمة المرور"}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="new-teacher">
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle className="text-lg">إنشاء حساب معلم جديد</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 max-w-md">
                  <div className="space-y-2">
                    <Label>الاسم الكامل</Label>
                    <Input
                      value={newTeacherName}
                      onChange={(e) => setNewTeacherName(e.target.value)}
                      placeholder="اسم المعلم"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>البريد الإلكتروني</Label>
                    <Input
                      type="email"
                      value={newTeacherEmail}
                      onChange={(e) => setNewTeacherEmail(e.target.value)}
                      placeholder="teacher@school.edu.sa"
                      dir="ltr"
                      className="text-right"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>رقم الهوية الوطنية</Label>
                    <Input
                      value={newTeacherNationalId}
                      onChange={(e) => setNewTeacherNationalId(e.target.value)}
                      placeholder="1XXXXXXXXX"
                      dir="ltr"
                      className="text-right"
                      inputMode="numeric"
                    />
                    <p className="text-xs text-muted-foreground">يُستخدم لتسجيل الدخول</p>
                  </div>
                  <div className="space-y-2">
                    <Label>كلمة المرور</Label>
                    <Input
                      type="password"
                      value={newTeacherPassword}
                      onChange={(e) => setNewTeacherPassword(e.target.value)}
                      placeholder="كلمة المرور"
                      dir="ltr"
                    />
                  </div>
                  <Button
                    onClick={handleCreateTeacher}
                    disabled={creatingTeacher || !newTeacherName.trim() || !newTeacherEmail.trim() || !newTeacherPassword.trim()}
                    className="gap-1.5"
                  >
                    <Plus className="h-4 w-4" />
                    {creatingTeacher ? "جارٍ الإنشاء..." : "إنشاء الحساب"}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="letterhead">
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle className="text-lg">ورقة الطباعة للتقارير</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 max-w-lg">
                  <p className="text-sm text-muted-foreground">
                    ارفع صورة ترويسة (شعار + بيانات المدرسة) لاستخدامها في طباعة التقارير
                  </p>
                  {letterheadUrl && (
                    <div className="rounded-lg border p-2">
                      <img
                        src={letterheadUrl}
                        alt="ورقة الطباعة الحالية"
                        className="w-full max-h-48 object-contain"
                      />
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      className="gap-1.5"
                      disabled={uploadingLetterhead}
                      onClick={() => document.getElementById("letterhead-input")?.click()}
                    >
                      <Upload className="h-4 w-4" />
                      {uploadingLetterhead ? "جارٍ الرفع..." : letterheadUrl ? "تغيير الصورة" : "رفع صورة"}
                    </Button>
                    <input
                      id="letterhead-input"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleUploadLetterhead}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}
