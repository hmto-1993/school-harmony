import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const username = Deno.env.get("MSEGAT_USERNAME");
    const apiKey = Deno.env.get("MSEGAT_API_KEY");
    const sender = Deno.env.get("MSEGAT_SENDER_NAME");

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

    // MSEGAT returns code "1" for success
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
