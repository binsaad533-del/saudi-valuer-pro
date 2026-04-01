import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { request_id } = await req.json();
    if (!request_id) {
      return new Response(
        JSON.stringify({ error: "request_id مطلوب" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Fetch valuation request with all details
    const { data: request, error: reqError } = await supabase
      .from("valuation_requests")
      .select("*")
      .eq("id", request_id)
      .single();

    if (reqError || !request) {
      return new Response(
        JSON.stringify({ error: "لم يتم العثور على الطلب", details: reqError?.message }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Fetch client profile
    let clientProfile = null;
    if (request.client_user_id) {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", request.client_user_id)
        .single();
      clientProfile = data;
    }

    // 3. Fetch client record from clients table (via assignment)
    let clientRecord = null;

    // 4. Fetch assignment linked to this request
    let assignment = null;
    if (request.assignment_id) {
      const { data } = await supabase
        .from("valuation_assignments")
        .select("*")
        .eq("id", request.assignment_id)
        .single();
      assignment = data;
    }
    // Fallback: search by request reference
    if (!assignment) {
      const { data } = await supabase
        .from("valuation_assignments")
        .select("*")
        .eq("organization_id", request.organization_id)
        .order("created_at", { ascending: false })
        .limit(1);
      if (data?.length) assignment = data[0];
    }

    const assignmentId = assignment?.id;

    // If we have a client_id on the assignment, fetch the client record
    if (assignment?.client_id) {
      const { data } = await supabase
        .from("clients")
        .select("*")
        .eq("id", assignment.client_id)
        .single();
      clientRecord = data;
    }

    // 5. Fetch subject property details
    let subject = null;
    if (assignmentId) {
      const { data } = await supabase
        .from("subjects")
        .select("*")
        .eq("assignment_id", assignmentId)
        .single();
      subject = data;
    }

    // 6. Fetch inspection data
    let inspection = null;
    let inspectionAnalysis = null;
    let inspectionPhotos: any[] = [];
    let checklistItems: any[] = [];
    if (assignmentId) {
      const { data: inspData } = await supabase
        .from("inspections")
        .select("*")
        .eq("assignment_id", assignmentId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (inspData?.length) {
        inspection = inspData[0];

        // Fetch analysis
        const { data: analysis } = await supabase
          .from("inspection_analysis")
          .select("*")
          .eq("inspection_id", inspection.id)
          .single();
        inspectionAnalysis = analysis;

        // Fetch photos
        const { data: photos } = await supabase
          .from("inspection_photos")
          .select("id, category, caption_ar, caption_en, file_path")
          .eq("inspection_id", inspection.id);
        inspectionPhotos = photos || [];

        // Fetch checklist
        const { data: checklist } = await supabase
          .from("inspection_checklist_items")
          .select("*")
          .eq("inspection_id", inspection.id)
          .order("sort_order");
        checklistItems = checklist || [];
      }
    }

    // 7. Fetch market comparables
    let comparables: any[] = [];
    let comparableAdjustments: any[] = [];
    if (assignmentId) {
      const { data: assignComps } = await supabase
        .from("assignment_comparables")
        .select(`
          id, rank, weight, notes,
          comparable_id
        `)
        .eq("assignment_id", assignmentId)
        .order("rank");

      if (assignComps?.length) {
        const compIds = assignComps.map((ac) => ac.comparable_id);
        const { data: compData } = await supabase
          .from("comparables")
          .select("*")
          .in("id", compIds);

        comparables = assignComps.map((ac) => ({
          ...ac,
          comparable: compData?.find((c) => c.id === ac.comparable_id) || null,
        }));

        // Fetch adjustments for all assignment_comparables
        const acIds = assignComps.map((ac) => ac.id);
        const { data: adjData } = await supabase
          .from("comparable_adjustments")
          .select("*")
          .in("assignment_comparable_id", acIds)
          .order("sort_order");
        comparableAdjustments = adjData || [];
      }
    }

    // 8. Fetch document extractions (attachments with extracted_data)
    let documentExtractions: any[] = [];
    if (assignmentId) {
      const { data } = await supabase
        .from("attachments")
        .select("id, file_name, category, extracted_data, mime_type")
        .eq("assignment_id", assignmentId)
        .not("extracted_data", "is", null);
      documentExtractions = data || [];
    }

    // 9. Fetch assumptions
    let assumptions: any[] = [];
    if (assignmentId) {
      const { data } = await supabase
        .from("assumptions")
        .select("*")
        .eq("assignment_id", assignmentId)
        .order("sort_order");
      assumptions = data || [];
    }

    // 10. Fetch reconciliation results
    let reconciliation = null;
    if (assignmentId) {
      const { data } = await supabase
        .from("reconciliation_results")
        .select("*")
        .eq("assignment_id", assignmentId)
        .single();
      reconciliation = data;
    }

    // 11. Fetch compliance checks
    let complianceChecks: any[] = [];
    if (assignmentId) {
      const { data } = await supabase
        .from("compliance_checks")
        .select("*")
        .eq("assignment_id", assignmentId)
        .order("category");
      complianceChecks = data || [];
    }

    // 12. Fetch portfolio assets (if portfolio request)
    let portfolioAssets: any[] = [];
    if (request.is_portfolio) {
      const { data } = await supabase
        .from("portfolio_assets")
        .select("*")
        .eq("request_id", request_id)
        .order("sort_order");
      portfolioAssets = data || [];
    }

    // 13. Fetch assigned valuer & reviewer profiles
    let valuerProfile = null;
    let reviewerProfile = null;
    if (assignment?.assigned_valuer_id) {
      const { data } = await supabase
        .from("profiles")
        .select("full_name_ar, full_name_en, title_ar, title_en, license_number, taqeem_membership, specialization, signature_url")
        .eq("user_id", assignment.assigned_valuer_id)
        .single();
      valuerProfile = data;
    }
    if (assignment?.assigned_reviewer_id) {
      const { data } = await supabase
        .from("profiles")
        .select("full_name_ar, full_name_en, title_ar, title_en, license_number, taqeem_membership")
        .eq("user_id", assignment.assigned_reviewer_id)
        .single();
      reviewerProfile = data;
    }

    // 14. Fetch organization info
    let organization = null;
    if (request.organization_id) {
      const { data } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", request.organization_id)
        .single();
      organization = data;
    }

    // Build aggregated response
    const aggregatedData = {
      request: {
        id: request.id,
        reference_number: request.reference_number,
        property_type: request.property_type,
        property_description_ar: request.property_description_ar,
        property_description_en: request.property_description_en,
        property_address_ar: request.property_address_ar,
        property_address_en: request.property_address_en,
        property_city_ar: request.property_city_ar,
        property_city_en: request.property_city_en,
        property_district_ar: request.property_district_ar,
        property_district_en: request.property_district_en,
        land_area: request.land_area,
        building_area: request.building_area,
        purpose: request.purpose,
        basis_of_value: request.basis_of_value,
        intended_use_ar: request.intended_use_ar,
        intended_use_en: request.intended_use_en,
        intended_users_ar: request.intended_users_ar,
        intended_users_en: request.intended_users_en,
        valuation_type: request.valuation_type,
        is_portfolio: request.is_portfolio,
        scope_of_work_ar: request.scope_of_work_ar,
        scope_of_work_en: request.scope_of_work_en,
        quotation_amount: request.quotation_amount,
        total_fees: request.total_fees,
        status: request.status,
        ai_intake_summary: request.ai_intake_summary,
      },
      client: {
        profile: clientProfile
          ? {
              full_name_ar: clientProfile.full_name_ar,
              full_name_en: clientProfile.full_name_en,
              phone: clientProfile.phone,
              email: clientProfile.email,
            }
          : null,
        record: clientRecord
          ? {
              name_ar: clientRecord.name_ar,
              name_en: clientRecord.name_en,
              client_type: clientRecord.client_type,
              id_type: clientRecord.id_type,
              id_number: clientRecord.id_number,
              cr_number: clientRecord.cr_number,
              phone: clientRecord.phone,
              email: clientRecord.email,
              address_ar: clientRecord.address_ar,
              city_ar: clientRecord.city_ar,
            }
          : null,
      },
      assignment: assignment
        ? {
            id: assignment.id,
            reference_number: assignment.reference_number,
            status: assignment.status,
            property_type: assignment.property_type,
            purpose: assignment.purpose,
            basis_of_value: assignment.basis_of_value,
            valuation_date: assignment.valuation_date,
            report_date: assignment.report_date,
            engagement_date: assignment.engagement_date,
            priority: assignment.priority,
            qr_verification_code: assignment.qr_verification_code,
            valuation_type: assignment.valuation_type,
            is_retrospective: assignment.is_retrospective,
          }
        : null,
      subject,
      inspection: inspection
        ? {
            id: inspection.id,
            inspection_date: inspection.inspection_date,
            status: inspection.status,
            findings_ar: inspection.findings_ar,
            findings_en: inspection.findings_en,
            notes_ar: inspection.notes_ar,
            notes_en: inspection.notes_en,
            weather_conditions: inspection.weather_conditions,
            duration_minutes: inspection.duration_minutes,
            gps_verified: inspection.gps_verified,
            latitude: inspection.latitude,
            longitude: inspection.longitude,
            completed: inspection.completed,
          }
        : null,
      inspection_analysis: inspectionAnalysis
        ? {
            condition_rating: inspectionAnalysis.condition_rating,
            condition_score: inspectionAnalysis.condition_score,
            quality_score: inspectionAnalysis.quality_score,
            finishing_level: inspectionAnalysis.finishing_level,
            maintenance_level: inspectionAnalysis.maintenance_level,
            environment_quality: inspectionAnalysis.environment_quality,
            physical_depreciation_pct: inspectionAnalysis.physical_depreciation_pct,
            functional_obsolescence_pct: inspectionAnalysis.functional_obsolescence_pct,
            external_obsolescence_pct: inspectionAnalysis.external_obsolescence_pct,
            condition_adjustment_pct: inspectionAnalysis.condition_adjustment_pct,
            visible_defects: inspectionAnalysis.visible_defects,
            risk_flags: inspectionAnalysis.risk_flags,
            ai_reasoning_ar: inspectionAnalysis.ai_reasoning_ar,
            ai_confidence: inspectionAnalysis.ai_confidence,
          }
        : null,
      inspection_photos: inspectionPhotos,
      inspection_checklist: checklistItems,
      comparables: comparables.map((ac) => ({
        rank: ac.rank,
        weight: ac.weight,
        notes: ac.notes,
        comparable: ac.comparable
          ? {
              property_type: ac.comparable.property_type,
              address_ar: ac.comparable.address_ar,
              city_ar: ac.comparable.city_ar,
              district_ar: ac.comparable.district_ar,
              land_area: ac.comparable.land_area,
              building_area: ac.comparable.building_area,
              price: ac.comparable.price,
              price_per_sqm: ac.comparable.price_per_sqm,
              transaction_date: ac.comparable.transaction_date,
              transaction_type: ac.comparable.transaction_type,
              year_built: ac.comparable.year_built,
              condition: ac.comparable.condition,
              confidence_score: ac.comparable.confidence_score,
              is_verified: ac.comparable.is_verified,
            }
          : null,
        adjustments: comparableAdjustments
          .filter((adj) => adj.assignment_comparable_id === ac.id)
          .map((adj) => ({
            label_ar: adj.label_ar,
            label_en: adj.label_en,
            adjustment_type: adj.adjustment_type,
            adjustment_percentage: adj.adjustment_percentage,
            adjustment_amount: adj.adjustment_amount,
            subject_value: adj.subject_value,
            comparable_value: adj.comparable_value,
            justification_ar: adj.justification_ar,
          })),
      })),
      document_extractions: documentExtractions.map((d) => ({
        file_name: d.file_name,
        category: d.category,
        extracted_data: d.extracted_data,
      })),
      assumptions,
      reconciliation,
      compliance_checks: complianceChecks,
      portfolio_assets: portfolioAssets,
      valuer: valuerProfile,
      reviewer: reviewerProfile,
      organization: organization
        ? {
            name_ar: organization.name_ar,
            name_en: organization.name_en,
            license_number: organization.license_number,
            taqeem_registration: organization.taqeem_registration,
            cr_number: organization.cr_number,
            address_ar: organization.address_ar,
            city_ar: organization.city_ar,
            phone: organization.phone,
            email: organization.email,
            logo_url: organization.logo_url,
          }
        : null,
    };

    return new Response(JSON.stringify(aggregatedData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    console.error("generate-report error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "خطأ غير معروف" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
