import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SMSRequest {
  phone: string;
  message: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Try reading provider settings from site_settings first
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: settings } = await supabase
      .from("site_settings")
      .select("id, value")
      .in("id", ["sms_provider_username", "sms_provider_api_key", "sms_provider_sender"]);

    const settingsMap: Record<string, string> = {};
    (settings || []).forEach((s: any) => { settingsMap[s.id] = s.value; });

    const username = settingsMap["sms_provider_username"] || Deno.env.get("MSEGAT_USERNAME");
    const apiKey = settingsMap["sms_provider_api_key"] || Deno.env.get("MSEGAT_API_KEY");
    const sender = settingsMap["sms_provider_sender"] || Deno.env.get("MSEGAT_SENDER_NAME");

    if (!username || !apiKey || !sender) {
      throw new Error("MSEGAT credentials not configured");
    }

    const { phone, message } = (await req.json()) as SMSRequest;

    if (!phone || !message) {
      return new Response(
        JSON.stringify({ error: "phone and message are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format phone: ensure it starts with 966
    let formattedPhone = phone.replace(/[\s\-\+]/g, "");
    if (formattedPhone.startsWith("0")) {
      formattedPhone = "966" + formattedPhone.slice(1);
    }
    if (!formattedPhone.startsWith("966")) {
      formattedPhone = "966" + formattedPhone;
    }

    const response = await fetch("https://www.msegat.com/gw/sendsms.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userName: username,
        apiKey: apiKey,
        numbers: formattedPhone,
        userSender: sender,
        msg: message,
        msgEncoding: "UTF8",
      }),
    });

    const result = await response.json();
    console.log("MSEGAT response:", JSON.stringify(result));

    if (result.code === "1" || result.code === 1) {
      return new Response(
        JSON.stringify({ success: true, message: "تم إرسال الرسالة بنجاح", result }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      return new Response(
        JSON.stringify({ success: false, error: result.message || "فشل إرسال الرسالة", result }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("SMS Error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
