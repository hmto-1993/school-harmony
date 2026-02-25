import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";

interface ClassOption {
  id: string;
  name: string;
  grade: string;
  section: string;
}

interface CategoryOption {
  id: string;
  name: string;
  max_score: number;
}

export default function NoorExportDialog() {
  const [open, setOpen] = useState(false);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      supabase.from("classes").select("id, name, grade, section").then(({ data }) => {
        setClasses(data || []);
      });
    }
  }, [open]);

  useEffect(() => {
    if (selectedClass) {
      setSelectedCategory("");
      supabase
        .from("grade_categories")
        .select("id, name, max_score")
        .eq("class_id", selectedClass)
        .order("sort_order")
        .then(({ data }) => {
          setCategories(data || []);
        });
    } else {
      setCategories([]);
    }
  }, [selectedClass]);

  const handleExport = async () => {
    if (!selectedClass || !selectedCategory) {
      toast.error("يرجى اختيار الفصل والمادة أولاً");
      return;
    }

    setLoading(true);
    try {
      // Fetch students with their grades for the selected category
      const { data: students, error: studentsError } = await supabase
        .from("students")
        .select("id, full_name, national_id")
        .eq("class_id", selectedClass)
        .order("full_name");

      if (studentsError) throw studentsError;
      if (!students || students.length === 0) {
        toast.error("لا يوجد طلاب في هذا الفصل");
        setLoading(false);
        return;
      }

      const studentIds = students.map((s) => s.id);
      const { data: grades, error: gradesError } = await supabase
        .from("grades")
        .select("student_id, score")
        .eq("category_id", selectedCategory)
        .in("student_id", studentIds);

      if (gradesError) throw gradesError;

      const gradeMap = new Map<string, number | null>();
      (grades || []).forEach((g) => gradeMap.set(g.student_id, g.score));

      const category = categories.find((c) => c.id === selectedCategory);
      const cls = classes.find((c) => c.id === selectedClass);

      // Build rows for Noor format
      const rows = students.map((s) => ({
        "رقم الهوية": s.national_id || "غير مسجل",
        "اسم الطالب": s.full_name,
        "الدرجة": gradeMap.has(s.id) ? (gradeMap.get(s.id) ?? "لم تُدخل") : "لم تُدخل",
      }));

      // Create workbook
      const ws = XLSX.utils.json_to_sheet(rows);

      // Set column widths
      ws["!cols"] = [
        { wch: 15 }, // رقم الهوية
        { wch: 30 }, // اسم الطالب
        { wch: 10 }, // الدرجة
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "درجات نور");

      const fileName = `نور_${cls?.name || "فصل"}_${category?.name || "مادة"}.xlsx`;
      XLSX.writeFile(wb, fileName, { bookType: "xlsx", type: "binary" });

      toast.success("تم تصدير الملف بنجاح");
      setOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("حدث خطأ أثناء التصدير");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          تصدير لنظام نور
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            تصدير درجات لنظام نور
          </DialogTitle>
          <DialogDescription>
            اختر الفصل والمادة لتصدير ملف Excel متوافق مع نظام نور
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>الفصل</Label>
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger>
                <SelectValue placeholder="اختر الفصل" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} - {c.grade} ({c.section})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>المادة / المعيار</Label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory} disabled={!selectedClass}>
              <SelectTrigger>
                <SelectValue placeholder={selectedClass ? "اختر المادة" : "اختر الفصل أولاً"} />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} (من {c.max_score})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleExport} disabled={loading || !selectedClass || !selectedCategory} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {loading ? "جاري التصدير..." : "تصدير"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
