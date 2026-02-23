import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { action, email, password, full_name, role } = await req.json();

    if (action === "seed") {
      // إنشاء حساب admin
      const { data: adminUser, error: adminError } = await supabaseAdmin.auth.admin.createUser({
        email: "admin@faisaliah.edu.sa",
        password: "Admin@123456",
        email_confirm: true,
      });

      if (adminError && !adminError.message.includes("already been registered")) {
        throw adminError;
      }

      if (adminUser?.user) {
        await supabaseAdmin.from("profiles").upsert({
          user_id: adminUser.user.id,
          full_name: "مدير النظام",
        });
        await supabaseAdmin.from("user_roles").upsert({
          user_id: adminUser.user.id,
          role: "admin",
        });
      }

      // إنشاء حساب معلم تجريبي
      const { data: teacherUser, error: teacherError } = await supabaseAdmin.auth.admin.createUser({
        email: "teacher@faisaliah.edu.sa",
        password: "Teacher@123456",
        email_confirm: true,
      });

      if (teacherError && !teacherError.message.includes("already been registered")) {
        throw teacherError;
      }

      if (teacherUser?.user) {
        await supabaseAdmin.from("profiles").upsert({
          user_id: teacherUser.user.id,
          full_name: "أحمد المعلم",
        });
        await supabaseAdmin.from("user_roles").upsert({
          user_id: teacherUser.user.id,
          role: "teacher",
        });

        // ربط المعلم بالشعب
        const { data: classes } = await supabaseAdmin.from("classes").select("id");
        if (classes) {
          for (const cls of classes) {
            await supabaseAdmin.from("teacher_classes").upsert({
              teacher_id: teacherUser.user.id,
              class_id: cls.id,
              subject: "حاسب آلي",
            });
          }
        }
      }

      return new Response(
        JSON.stringify({ success: true, message: "تم إنشاء الحسابات التجريبية بنجاح" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "create_user") {
      // إنشاء مستخدم جديد (للأدمن فقط)
      const { data: newUser, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (error) throw error;

      if (newUser?.user) {
        await supabaseAdmin.from("profiles").insert({
          user_id: newUser.user.id,
          full_name: full_name || email,
        });
        await supabaseAdmin.from("user_roles").insert({
          user_id: newUser.user.id,
          role: role || "teacher",
        });
      }

      return new Response(
        JSON.stringify({ success: true, user_id: newUser?.user?.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
