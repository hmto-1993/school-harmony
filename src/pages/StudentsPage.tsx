import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Trash2, Edit } from "lucide-react";

interface Student {
  id: string;
  full_name: string;
  academic_number: string | null;
  national_id: string | null;
  class_id: string | null;
  parent_phone: string | null;
  classes: { name: string } | null;
}

export default function StudentsPage() {
  const { role } = useAuth();
  const { toast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    academic_number: "",
    national_id: "",
    class_id: "",
    parent_phone: "",
  });

  useEffect(() => {
    fetchStudents();
    supabase.from("classes").select("id, name").order("name").then(({ data }) => setClasses(data || []));
  }, []);

  const fetchStudents = async () => {
    const { data } = await supabase
      .from("students")
      .select("id, full_name, academic_number, national_id, class_id, parent_phone, classes(name)")
      .order("full_name");
    setStudents((data as Student[]) || []);
  };

  const handleAdd = async () => {
    if (!form.full_name.trim()) return;
    const { error } = await supabase.from("students").insert({
      full_name: form.full_name,
      academic_number: form.academic_number || null,
      national_id: form.national_id || null,
      class_id: form.class_id || null,
      parent_phone: form.parent_phone || null,
    });
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "تم", description: "تمت إضافة الطالب بنجاح" });
      setDialogOpen(false);
      setForm({ full_name: "", academic_number: "", national_id: "", class_id: "", parent_phone: "" });
      fetchStudents();
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from("students").delete().eq("id", id);
    toast({ title: "تم", description: "تم حذف الطالب" });
    fetchStudents();
  };

  const filtered = students.filter((s) => {
    const matchSearch = !search.trim() || s.full_name.includes(search) || s.academic_number?.includes(search);
    const matchClass = classFilter === "all" || s.class_id === classFilter;
    return matchSearch && matchClass;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">إدارة الطلاب</h1>
          <p className="text-muted-foreground">عرض وإدارة بيانات الطلاب</p>
        </div>
        {role === "admin" && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 ml-2" />إضافة طالب</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>إضافة طالب جديد</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>الاسم الكامل *</Label>
                  <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>الرقم الأكاديمي</Label>
                  <Input value={form.academic_number} onChange={(e) => setForm({ ...form, academic_number: e.target.value })} dir="ltr" />
                </div>
                <div className="space-y-2">
                  <Label>الرقم الوطني</Label>
                  <Input value={form.national_id} onChange={(e) => setForm({ ...form, national_id: e.target.value })} dir="ltr" />
                </div>
                <div className="space-y-2">
                  <Label>الشعبة</Label>
                  <Select value={form.class_id} onValueChange={(v) => setForm({ ...form, class_id: v })}>
                    <SelectTrigger><SelectValue placeholder="اختر الشعبة" /></SelectTrigger>
                    <SelectContent>
                      {classes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>رقم جوال ولي الأمر</Label>
                  <Input value={form.parent_phone} onChange={(e) => setForm({ ...form, parent_phone: e.target.value })} dir="ltr" />
                </div>
                <Button onClick={handleAdd} className="w-full">إضافة</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card className="shadow-card">
        <CardContent className="p-5">
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="بحث بالاسم أو الرقم الأكاديمي..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-10" />
            </div>
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="جميع الشُعب" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الشُعب</SelectItem>
                {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-right">#</TableHead>
                  <TableHead className="text-right">الاسم الكامل</TableHead>
                  <TableHead className="text-right">الرقم الأكاديمي</TableHead>
                  <TableHead className="text-right">الشعبة</TableHead>
                  <TableHead className="text-right">جوال ولي الأمر</TableHead>
                  {role === "admin" && <TableHead className="text-right">إجراءات</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">لا توجد نتائج</TableCell></TableRow>
                ) : filtered.map((s, i) => (
                  <TableRow key={s.id} className="hover:bg-muted/30">
                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-medium">{s.full_name}</TableCell>
                    <TableCell className="text-muted-foreground">{s.academic_number || "—"}</TableCell>
                    <TableCell>{s.classes?.name || "—"}</TableCell>
                    <TableCell dir="ltr" className="text-muted-foreground">{s.parent_phone || "—"}</TableCell>
                    {role === "admin" && (
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(s.id)} className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
