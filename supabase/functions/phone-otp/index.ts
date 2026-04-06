import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";
const OTP_TTL_MS = 5 * 60 * 1000;

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function isValidE164(phone: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(phone.trim());
}

function normalizePhone(phone: string): string {
  const trimmed = phone.trim();
  if (trimmed.startsWith("+")) return trimmed;
  return `+966${trimmed.replace(/^0/, "")}`;
}

function toBase64Url(input: Uint8Array): string {
  let binary = "";
  input.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(input: string): Uint8Array {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = `${base64}${"=".repeat((4 - (base64.length % 4 || 4)) % 4)}`;
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function signPayload(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return toBase64Url(new Uint8Array(signature));
}

async function createVerificationToken(phone: string, otp: string, expiresAt: number, secret: string): Promise<string> {
  const payload = toBase64Url(new TextEncoder().encode(JSON.stringify({ phone, otp, expiresAt })));
  const signature = await signPayload(payload, secret);
  return `${payload}.${signature}`;
}

async function verifyVerificationToken(token: string, phone: string, otp: string, secret: string): Promise<{ valid: boolean; error?: string }> {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) {
    return { valid: false, error: "رمز التحقق غير صالح، أعد طلب رمز جديد" };
  }

  const expectedSignature = await signPayload(payload, secret);
  if (signature !== expectedSignature) {
    return { valid: false, error: "رمز التحقق غير صالح، أعد طلب رمز جديد" };
  }

  try {
    const decoded = JSON.parse(new TextDecoder().decode(fromBase64Url(payload))) as {
      phone: string;
      otp: string;
      expiresAt: number;
    };

    if (decoded.phone !== phone) {
      return { valid: false, error: "هذا الرمز مرتبط برقم جوال مختلف" };
    }

    if (Date.now() > decoded.expiresAt) {
      return { valid: false, error: "انتهت صلاحية الرمز، أعد طلب رمز جديد" };
    }

    if (decoded.otp !== otp) {
      return { valid: false, error: "رمز التحقق غير صحيح" };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: "تعذر قراءة رمز التحقق، أعد طلب رمز جديد" };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  console.log("phone-otp v2 handler invoked");

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
  const TWILIO_PHONE_NUMBER_ENV = Deno.env.get("TWILIO_PHONE_NUMBER") || "";
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const SIGNING_SECRET = SUPABASE_SERVICE_ROLE_KEY || LOVABLE_API_KEY;

  if (!LOVABLE_API_KEY || !TWILIO_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: "خدمة التحقق غير مهيأة حالياً" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { action, phone, code, from_number, verification_token, client_name } = await req.json();

    if (!phone) {
      return new Response(JSON.stringify({ error: "رقم الجوال مطلوب" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizedPhone = normalizePhone(phone);

    if (action === "send") {
      const otp = generateOtp();
      const expiresAt = Date.now() + OTP_TTL_MS;
      // Determine sender number: request param > env var > auto-discover from Twilio
      let twilioFrom = from_number || "";
      if (!twilioFrom && isValidE164(TWILIO_PHONE_NUMBER_ENV)) {
        twilioFrom = TWILIO_PHONE_NUMBER_ENV;
      }

      if (!isValidE164(twilioFrom)) {
        // Auto-discover first phone number from Twilio account
        try {
          const numRes = await fetch(`${GATEWAY_URL}/IncomingPhoneNumbers.json?PageSize=1`, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "X-Connection-Api-Key": TWILIO_API_KEY,
            },
          });
          if (numRes.ok) {
            const numData = await numRes.json();
            const numbers = numData?.incoming_phone_numbers ?? [];
            if (numbers.length > 0 && numbers[0].phone_number) {
              twilioFrom = numbers[0].phone_number;
              console.log("Auto-discovered Twilio number:", twilioFrom);
            }
          }
        } catch (e) {
          console.error("Failed to auto-discover Twilio number:", e);
        }
      }

      if (!isValidE164(twilioFrom)) {
        return new Response(JSON.stringify({
          error: "تعذر إرسال رمز التحقق لأن رقم الرسائل غير مهيأ بشكل صحيح حالياً.",
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const response = await fetch(`${GATEWAY_URL}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": TWILIO_API_KEY,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: normalizedPhone,
          From: twilioFrom,
          Body: `رمز التحقق الخاص بك في جساس: ${otp}`,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        console.error("Twilio error:", JSON.stringify(data));
        const twilioMessage = typeof data?.message === "string" ? data.message : "";
        const isInvalidFromNumber = response.status === 400 && (
          twilioMessage.includes("Invalid From Number") || Number(data?.code) === 21212
        );

        if (isInvalidFromNumber) {
          return new Response(JSON.stringify({
            error: "تعذر إرسال رمز التحقق لأن رقم الرسائل المعتمد غير صالح حالياً.",
          }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        throw new Error(`Twilio API error [${response.status}]`);
      }

      const verificationToken = await createVerificationToken(normalizedPhone, otp, expiresAt, SIGNING_SECRET);

      return new Response(JSON.stringify({
        success: true,
        message: "OTP sent",
        verification_token: verificationToken,
        expires_in_seconds: OTP_TTL_MS / 1000,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "verify") {
      if (!code) {
        return new Response(JSON.stringify({ error: "رمز التحقق مطلوب", valid: false }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!verification_token) {
        return new Response(JSON.stringify({ error: "انتهت جلسة التحقق، أعد طلب رمز جديد", valid: false }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const verification = await verifyVerificationToken(verification_token, normalizedPhone, code, SIGNING_SECRET);
      if (!verification.valid) {
        return new Response(JSON.stringify({ error: verification.error, valid: false }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_id, email")
        .eq("phone", normalizedPhone)
        .maybeSingle();

      let userEmail: string;
      let isNewAccount = false;

      if (profile?.email) {
        // Existing account — login
        userEmail = profile.email;
      } else {
        // No account — auto-create one
        isNewAccount = true;
        const generatedEmail = `phone_${normalizedPhone.replace("+", "")}@client.jsaas.local`;
        const tempPassword = crypto.randomUUID();

        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
          email: generatedEmail,
          password: tempPassword,
          email_confirm: true,
          user_metadata: {
            full_name: client_name || "عميل جديد",
            phone: normalizedPhone,
            role: "client",
          },
        });

        if (createError) {
          console.error("Auto-create user error:", createError);
          throw new Error("تعذر إنشاء الحساب تلقائياً");
        }

        const userId = newUser.user.id;

        // Create profile
        await supabase.from("profiles").insert({
          user_id: userId,
          full_name_ar: client_name || "عميل جديد",
          email: generatedEmail,
          phone: normalizedPhone,
          preferred_language: "ar",
          account_status: "active",
          user_type: "external",
        });

        // Assign client role
        await supabase.from("user_roles").insert({
          user_id: userId,
          role: "client",
        });

        // Try to link to existing client record
        try {
          await supabase.rpc("link_portal_user_to_client", {
            _user_id: userId,
            _phone: normalizedPhone,
            _email: generatedEmail,
            _name_ar: client_name || "عميل جديد",
            _org_id: null,
          });
        } catch {
          // Non-critical
        }

        userEmail = generatedEmail;
      }

      const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: "magiclink",
        email: userEmail,
      });

      if (linkError) {
        throw linkError;
      }

      return new Response(JSON.stringify({
        valid: true,
        is_new_account: isNewAccount,
        token_hash: linkData?.properties?.hashed_token,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "إجراء غير صالح" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Phone OTP error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const userMessage = errorMessage.includes("Twilio API error")
      ? "تعذر إرسال رمز التحقق حالياً. يرجى المحاولة لاحقاً أو التواصل مع الدعم."
      : errorMessage;

    return new Response(JSON.stringify({ error: userMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
