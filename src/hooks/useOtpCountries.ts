import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface OtpCountry {
  country_code: string;
  country_name_ar: string;
  country_name_en: string | null;
  dial_code: string;
  otp_enabled: boolean;
}

const FALLBACK: OtpCountry[] = [
  { country_code: "SA", country_name_ar: "المملكة العربية السعودية", country_name_en: "Saudi Arabia", dial_code: "+966", otp_enabled: true },
];

export function useOtpCountries() {
  const [countries, setCountries] = useState<OtpCountry[]>(FALLBACK);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from("otp_supported_countries")
          .select("country_code, country_name_ar, country_name_en, dial_code, otp_enabled")
          .order("otp_enabled", { ascending: false })
          .order("country_name_ar");
        if (!error && data?.length) setCountries(data);
      } catch (err) {
        console.error("Error fetching OTP countries:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return { countries, loading };
}
