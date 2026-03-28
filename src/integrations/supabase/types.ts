export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      assignment_comparables: {
        Row: {
          assignment_id: string
          comparable_id: string
          id: string
          notes: string | null
          rank: number | null
          weight: number | null
        }
        Insert: {
          assignment_id: string
          comparable_id: string
          id?: string
          notes?: string | null
          rank?: number | null
          weight?: number | null
        }
        Update: {
          assignment_id?: string
          comparable_id?: string
          id?: string
          notes?: string | null
          rank?: number | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assignment_comparables_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "v_recent_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_comparables_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "valuation_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_comparables_comparable_id_fkey"
            columns: ["comparable_id"]
            isOneToOne: false
            referencedRelation: "comparables"
            referencedColumns: ["id"]
          },
        ]
      }
      assumptions: {
        Row: {
          assignment_id: string
          assumption_ar: string
          assumption_en: string | null
          created_at: string
          id: string
          is_special: boolean
          justification_ar: string | null
          justification_en: string | null
          sort_order: number | null
        }
        Insert: {
          assignment_id: string
          assumption_ar: string
          assumption_en?: string | null
          created_at?: string
          id?: string
          is_special?: boolean
          justification_ar?: string | null
          justification_en?: string | null
          sort_order?: number | null
        }
        Update: {
          assignment_id?: string
          assumption_ar?: string
          assumption_en?: string | null
          created_at?: string
          id?: string
          is_special?: boolean
          justification_ar?: string | null
          justification_en?: string | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assumptions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "v_recent_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assumptions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "valuation_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      attachments: {
        Row: {
          assignment_id: string | null
          category: Database["public"]["Enums"]["attachment_category"]
          comparable_id: string | null
          created_at: string
          description_ar: string | null
          description_en: string | null
          extracted_data: Json | null
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          inspection_id: string | null
          mime_type: string | null
          subject_id: string | null
          uploaded_by: string | null
        }
        Insert: {
          assignment_id?: string | null
          category?: Database["public"]["Enums"]["attachment_category"]
          comparable_id?: string | null
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          extracted_data?: Json | null
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          inspection_id?: string | null
          mime_type?: string | null
          subject_id?: string | null
          uploaded_by?: string | null
        }
        Update: {
          assignment_id?: string | null
          category?: Database["public"]["Enums"]["attachment_category"]
          comparable_id?: string | null
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          extracted_data?: Json | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          inspection_id?: string | null
          mime_type?: string | null
          subject_id?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attachments_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "v_recent_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "valuation_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_comparable_id_fkey"
            columns: ["comparable_id"]
            isOneToOne: false
            referencedRelation: "comparables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          assignment_id: string | null
          created_at: string
          description: string | null
          id: string
          ip_address: string | null
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          assignment_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          assignment_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "v_recent_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "valuation_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      cities: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          latitude: number | null
          longitude: number | null
          name_ar: string
          name_en: string | null
          region_ar: string | null
          region_en: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          name_ar: string
          name_en?: string | null
          region_ar?: string | null
          region_en?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          name_ar?: string
          name_en?: string | null
          region_ar?: string | null
          region_en?: string | null
        }
        Relationships: []
      }
      clients: {
        Row: {
          address_ar: string | null
          address_en: string | null
          city_ar: string | null
          city_en: string | null
          client_type: string
          contact_person_ar: string | null
          contact_person_en: string | null
          cr_number: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          id_number: string | null
          id_type: string | null
          is_active: boolean
          name_ar: string
          name_en: string | null
          notes: string | null
          organization_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address_ar?: string | null
          address_en?: string | null
          city_ar?: string | null
          city_en?: string | null
          client_type?: string
          contact_person_ar?: string | null
          contact_person_en?: string | null
          cr_number?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          id_number?: string | null
          id_type?: string | null
          is_active?: boolean
          name_ar: string
          name_en?: string | null
          notes?: string | null
          organization_id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address_ar?: string | null
          address_en?: string | null
          city_ar?: string | null
          city_en?: string | null
          client_type?: string
          contact_person_ar?: string | null
          contact_person_en?: string | null
          cr_number?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          id_number?: string | null
          id_type?: string | null
          is_active?: boolean
          name_ar?: string
          name_en?: string | null
          notes?: string | null
          organization_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      comparable_adjustments: {
        Row: {
          adjustment_amount: number | null
          adjustment_percentage: number | null
          adjustment_type: Database["public"]["Enums"]["adjustment_type"]
          assignment_comparable_id: string
          comparable_value: string | null
          created_at: string
          id: string
          justification_ar: string | null
          justification_en: string | null
          label_ar: string
          label_en: string | null
          sort_order: number | null
          subject_value: string | null
        }
        Insert: {
          adjustment_amount?: number | null
          adjustment_percentage?: number | null
          adjustment_type: Database["public"]["Enums"]["adjustment_type"]
          assignment_comparable_id: string
          comparable_value?: string | null
          created_at?: string
          id?: string
          justification_ar?: string | null
          justification_en?: string | null
          label_ar: string
          label_en?: string | null
          sort_order?: number | null
          subject_value?: string | null
        }
        Update: {
          adjustment_amount?: number | null
          adjustment_percentage?: number | null
          adjustment_type?: Database["public"]["Enums"]["adjustment_type"]
          assignment_comparable_id?: string
          comparable_value?: string | null
          created_at?: string
          id?: string
          justification_ar?: string | null
          justification_en?: string | null
          label_ar?: string
          label_en?: string | null
          sort_order?: number | null
          subject_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comparable_adjustments_assignment_comparable_id_fkey"
            columns: ["assignment_comparable_id"]
            isOneToOne: false
            referencedRelation: "assignment_comparables"
            referencedColumns: ["id"]
          },
        ]
      }
      comparable_sources: {
        Row: {
          comparable_id: string
          created_at: string
          id: string
          notes: string | null
          reference_number: string | null
          source_date: string | null
          source_name_ar: string | null
          source_name_en: string | null
          source_type: string
          url: string | null
        }
        Insert: {
          comparable_id: string
          created_at?: string
          id?: string
          notes?: string | null
          reference_number?: string | null
          source_date?: string | null
          source_name_ar?: string | null
          source_name_en?: string | null
          source_type: string
          url?: string | null
        }
        Update: {
          comparable_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          reference_number?: string | null
          source_date?: string | null
          source_name_ar?: string | null
          source_name_en?: string | null
          source_type?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comparable_sources_comparable_id_fkey"
            columns: ["comparable_id"]
            isOneToOne: false
            referencedRelation: "comparables"
            referencedColumns: ["id"]
          },
        ]
      }
      comparable_verifications: {
        Row: {
          comparable_id: string
          created_at: string
          id: string
          method: string | null
          notes: string | null
          result: string | null
          verification_date: string
          verified_by: string
        }
        Insert: {
          comparable_id: string
          created_at?: string
          id?: string
          method?: string | null
          notes?: string | null
          result?: string | null
          verification_date?: string
          verified_by: string
        }
        Update: {
          comparable_id?: string
          created_at?: string
          id?: string
          method?: string | null
          notes?: string | null
          result?: string | null
          verification_date?: string
          verified_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "comparable_verifications_comparable_id_fkey"
            columns: ["comparable_id"]
            isOneToOne: false
            referencedRelation: "comparables"
            referencedColumns: ["id"]
          },
        ]
      }
      comparables: {
        Row: {
          address_ar: string | null
          address_en: string | null
          building_area: number | null
          city_ar: string | null
          city_en: string | null
          condition: string | null
          confidence_score: number | null
          created_at: string
          created_by: string | null
          currency: string | null
          description_ar: string | null
          description_en: string | null
          district_ar: string | null
          district_en: string | null
          id: string
          is_verified: boolean | null
          land_area: number | null
          latitude: number | null
          longitude: number | null
          market_zone_id: string | null
          number_of_floors: number | null
          number_of_units: number | null
          organization_id: string
          price: number | null
          price_per_sqm: number | null
          property_type: Database["public"]["Enums"]["property_type"]
          transaction_date: string | null
          transaction_type: string | null
          updated_at: string
          year_built: number | null
          zoning_ar: string | null
          zoning_en: string | null
        }
        Insert: {
          address_ar?: string | null
          address_en?: string | null
          building_area?: number | null
          city_ar?: string | null
          city_en?: string | null
          condition?: string | null
          confidence_score?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          description_ar?: string | null
          description_en?: string | null
          district_ar?: string | null
          district_en?: string | null
          id?: string
          is_verified?: boolean | null
          land_area?: number | null
          latitude?: number | null
          longitude?: number | null
          market_zone_id?: string | null
          number_of_floors?: number | null
          number_of_units?: number | null
          organization_id: string
          price?: number | null
          price_per_sqm?: number | null
          property_type: Database["public"]["Enums"]["property_type"]
          transaction_date?: string | null
          transaction_type?: string | null
          updated_at?: string
          year_built?: number | null
          zoning_ar?: string | null
          zoning_en?: string | null
        }
        Update: {
          address_ar?: string | null
          address_en?: string | null
          building_area?: number | null
          city_ar?: string | null
          city_en?: string | null
          condition?: string | null
          confidence_score?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          description_ar?: string | null
          description_en?: string | null
          district_ar?: string | null
          district_en?: string | null
          id?: string
          is_verified?: boolean | null
          land_area?: number | null
          latitude?: number | null
          longitude?: number | null
          market_zone_id?: string | null
          number_of_floors?: number | null
          number_of_units?: number | null
          organization_id?: string
          price?: number | null
          price_per_sqm?: number | null
          property_type?: Database["public"]["Enums"]["property_type"]
          transaction_date?: string | null
          transaction_type?: string | null
          updated_at?: string
          year_built?: number | null
          zoning_ar?: string | null
          zoning_en?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comparables_market_zone_id_fkey"
            columns: ["market_zone_id"]
            isOneToOne: false
            referencedRelation: "market_zones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comparables_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_checks: {
        Row: {
          assignment_id: string
          auto_checked: boolean | null
          category: string
          check_code: string
          check_name_ar: string
          check_name_en: string | null
          checked_at: string | null
          checked_by: string | null
          created_at: string
          id: string
          is_mandatory: boolean | null
          is_passed: boolean | null
          notes: string | null
          updated_at: string
        }
        Insert: {
          assignment_id: string
          auto_checked?: boolean | null
          category: string
          check_code: string
          check_name_ar: string
          check_name_en?: string | null
          checked_at?: string | null
          checked_by?: string | null
          created_at?: string
          id?: string
          is_mandatory?: boolean | null
          is_passed?: boolean | null
          notes?: string | null
          updated_at?: string
        }
        Update: {
          assignment_id?: string
          auto_checked?: boolean | null
          category?: string
          check_code?: string
          check_name_ar?: string
          check_name_en?: string | null
          checked_at?: string | null
          checked_by?: string | null
          created_at?: string
          id?: string
          is_mandatory?: boolean | null
          is_passed?: boolean | null
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_checks_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "v_recent_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_checks_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "valuation_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      districts: {
        Row: {
          city_id: string
          created_at: string
          id: string
          is_active: boolean
          latitude: number | null
          longitude: number | null
          name_ar: string
          name_en: string | null
        }
        Insert: {
          city_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          name_ar: string
          name_en?: string | null
        }
        Update: {
          city_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          name_ar?: string
          name_en?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "districts_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      glossary_terms: {
        Row: {
          category: string | null
          created_at: string
          definition_ar: string
          definition_en: string | null
          id: string
          sort_order: number | null
          source: string | null
          term_ar: string
          term_en: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          definition_ar: string
          definition_en?: string | null
          id?: string
          sort_order?: number | null
          source?: string | null
          term_ar: string
          term_en: string
        }
        Update: {
          category?: string | null
          created_at?: string
          definition_ar?: string
          definition_en?: string | null
          id?: string
          sort_order?: number | null
          source?: string | null
          term_ar?: string
          term_en?: string
        }
        Relationships: []
      }
      inspection_checklist_items: {
        Row: {
          category: string
          created_at: string
          id: string
          inspection_id: string
          is_checked: boolean | null
          is_required: boolean | null
          label_ar: string
          label_en: string | null
          notes: string | null
          sort_order: number | null
          value: string | null
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          inspection_id: string
          is_checked?: boolean | null
          is_required?: boolean | null
          label_ar: string
          label_en?: string | null
          notes?: string | null
          sort_order?: number | null
          value?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          inspection_id?: string
          is_checked?: boolean | null
          is_required?: boolean | null
          label_ar?: string
          label_en?: string | null
          notes?: string | null
          sort_order?: number | null
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inspection_checklist_items_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_photos: {
        Row: {
          caption_ar: string | null
          caption_en: string | null
          category: string
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          inspection_id: string
          latitude: number | null
          longitude: number | null
          mime_type: string | null
          taken_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          caption_ar?: string | null
          caption_en?: string | null
          category: string
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          inspection_id: string
          latitude?: number | null
          longitude?: number | null
          mime_type?: string | null
          taken_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          caption_ar?: string | null
          caption_en?: string | null
          category?: string
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          inspection_id?: string
          latitude?: number | null
          longitude?: number | null
          mime_type?: string | null
          taken_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inspection_photos_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          },
        ]
      }
      inspections: {
        Row: {
          access_granted: boolean | null
          assignment_id: string
          auto_saved_data: Json | null
          completed: boolean | null
          created_at: string
          duration_minutes: number | null
          findings_ar: string | null
          findings_en: string | null
          gps_verified: boolean | null
          id: string
          inspection_date: string
          inspection_time: string | null
          inspector_id: string
          latitude: number | null
          longitude: number | null
          notes_ar: string | null
          notes_en: string | null
          reviewed_at: string | null
          started_at: string | null
          status: string
          submitted_at: string | null
          type: string | null
          updated_at: string
          weather_conditions: string | null
        }
        Insert: {
          access_granted?: boolean | null
          assignment_id: string
          auto_saved_data?: Json | null
          completed?: boolean | null
          created_at?: string
          duration_minutes?: number | null
          findings_ar?: string | null
          findings_en?: string | null
          gps_verified?: boolean | null
          id?: string
          inspection_date: string
          inspection_time?: string | null
          inspector_id: string
          latitude?: number | null
          longitude?: number | null
          notes_ar?: string | null
          notes_en?: string | null
          reviewed_at?: string | null
          started_at?: string | null
          status?: string
          submitted_at?: string | null
          type?: string | null
          updated_at?: string
          weather_conditions?: string | null
        }
        Update: {
          access_granted?: boolean | null
          assignment_id?: string
          auto_saved_data?: Json | null
          completed?: boolean | null
          created_at?: string
          duration_minutes?: number | null
          findings_ar?: string | null
          findings_en?: string | null
          gps_verified?: boolean | null
          id?: string
          inspection_date?: string
          inspection_time?: string | null
          inspector_id?: string
          latitude?: number | null
          longitude?: number | null
          notes_ar?: string | null
          notes_en?: string | null
          reviewed_at?: string | null
          started_at?: string | null
          status?: string
          submitted_at?: string | null
          type?: string | null
          updated_at?: string
          weather_conditions?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inspections_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "v_recent_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "valuation_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      inspector_coverage_areas: {
        Row: {
          city_id: string
          coverage_radius_km: number | null
          created_at: string
          district_id: string | null
          id: string
          inspector_profile_id: string
          is_primary: boolean | null
        }
        Insert: {
          city_id: string
          coverage_radius_km?: number | null
          created_at?: string
          district_id?: string | null
          id?: string
          inspector_profile_id: string
          is_primary?: boolean | null
        }
        Update: {
          city_id?: string
          coverage_radius_km?: number | null
          created_at?: string
          district_id?: string | null
          id?: string
          inspector_profile_id?: string
          is_primary?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "inspector_coverage_areas_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspector_coverage_areas_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspector_coverage_areas_inspector_profile_id_fkey"
            columns: ["inspector_profile_id"]
            isOneToOne: false
            referencedRelation: "inspector_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inspector_profiles: {
        Row: {
          availability_status: string
          avg_completion_hours: number | null
          avg_response_hours: number | null
          cities_ar: string[] | null
          cities_en: string[] | null
          created_at: string
          current_workload: number | null
          home_latitude: number | null
          home_longitude: number | null
          id: string
          is_active: boolean
          max_concurrent_tasks: number | null
          notes: string | null
          organization_id: string | null
          phone: string | null
          quality_score: number | null
          regions_ar: string[] | null
          regions_en: string[] | null
          specializations: string[] | null
          total_completed: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          availability_status?: string
          avg_completion_hours?: number | null
          avg_response_hours?: number | null
          cities_ar?: string[] | null
          cities_en?: string[] | null
          created_at?: string
          current_workload?: number | null
          home_latitude?: number | null
          home_longitude?: number | null
          id?: string
          is_active?: boolean
          max_concurrent_tasks?: number | null
          notes?: string | null
          organization_id?: string | null
          phone?: string | null
          quality_score?: number | null
          regions_ar?: string[] | null
          regions_en?: string[] | null
          specializations?: string[] | null
          total_completed?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          availability_status?: string
          avg_completion_hours?: number | null
          avg_response_hours?: number | null
          cities_ar?: string[] | null
          cities_en?: string[] | null
          created_at?: string
          current_workload?: number | null
          home_latitude?: number | null
          home_longitude?: number | null
          id?: string
          is_active?: boolean
          max_concurrent_tasks?: number | null
          notes?: string | null
          organization_id?: string | null
          phone?: string | null
          quality_score?: number | null
          regions_ar?: string[] | null
          regions_en?: string[] | null
          specializations?: string[] | null
          total_completed?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspector_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      inspector_reassignment_log: {
        Row: {
          assignment_id: string
          created_at: string
          id: string
          inspection_was_started: boolean | null
          new_inspector_id: string
          previous_inspector_id: string | null
          reason: string | null
          reassigned_by: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          id?: string
          inspection_was_started?: boolean | null
          new_inspector_id: string
          previous_inspector_id?: string | null
          reason?: string | null
          reassigned_by: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          id?: string
          inspection_was_started?: boolean | null
          new_inspector_id?: string
          previous_inspector_id?: string | null
          reason?: string | null
          reassigned_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspector_reassignment_log_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "v_recent_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspector_reassignment_log_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "valuation_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      market_zones: {
        Row: {
          avg_price_per_sqm: number | null
          boundary_geojson: Json | null
          city_ar: string | null
          city_en: string | null
          created_at: string
          description_ar: string | null
          description_en: string | null
          id: string
          last_updated: string | null
          name_ar: string
          name_en: string | null
          organization_id: string
          region_ar: string | null
          region_en: string | null
          trend: string | null
          updated_at: string
          zone_type: string | null
        }
        Insert: {
          avg_price_per_sqm?: number | null
          boundary_geojson?: Json | null
          city_ar?: string | null
          city_en?: string | null
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          id?: string
          last_updated?: string | null
          name_ar: string
          name_en?: string | null
          organization_id: string
          region_ar?: string | null
          region_en?: string | null
          trend?: string | null
          updated_at?: string
          zone_type?: string | null
        }
        Update: {
          avg_price_per_sqm?: number | null
          boundary_geojson?: Json | null
          city_ar?: string | null
          city_en?: string | null
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          id?: string
          last_updated?: string | null
          name_ar?: string
          name_en?: string | null
          organization_id?: string
          region_ar?: string | null
          region_en?: string | null
          trend?: string | null
          updated_at?: string
          zone_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "market_zones_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address_ar: string | null
          address_en: string | null
          city_ar: string | null
          city_en: string | null
          cr_number: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          license_number: string | null
          logo_url: string | null
          name_ar: string
          name_en: string | null
          phone: string | null
          taqeem_registration: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address_ar?: string | null
          address_en?: string | null
          city_ar?: string | null
          city_en?: string | null
          cr_number?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          license_number?: string | null
          logo_url?: string | null
          name_ar: string
          name_en?: string | null
          phone?: string | null
          taqeem_registration?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address_ar?: string | null
          address_en?: string | null
          city_ar?: string | null
          city_en?: string | null
          cr_number?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          license_number?: string | null
          logo_url?: string | null
          name_ar?: string
          name_en?: string | null
          phone?: string | null
          taqeem_registration?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      payment_receipts: {
        Row: {
          amount: number
          created_at: string
          currency: string | null
          file_name: string
          file_path: string
          id: string
          payment_type: string | null
          request_id: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          uploaded_by: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string | null
          file_name: string
          file_path: string
          id?: string
          payment_type?: string | null
          request_id: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          uploaded_by: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string | null
          file_name?: string
          file_path?: string
          id?: string
          payment_type?: string | null
          request_id?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_receipts_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "valuation_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_webhook_logs: {
        Row: {
          created_at: string
          event_type: string
          id: string
          ip_address: string | null
          payment_id: string | null
          processed: boolean
          processing_result: string | null
          raw_payload: Json
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          ip_address?: string | null
          payment_id?: string | null
          processed?: boolean
          processing_result?: string | null
          raw_payload: Json
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          ip_address?: string | null
          payment_id?: string | null
          processed?: boolean
          processing_result?: string | null
          raw_payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "payment_webhook_logs_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          assignment_id: string | null
          callback_url: string | null
          checkout_url: string | null
          created_at: string
          created_by: string | null
          currency: string
          gateway_name: string
          gateway_response_json: Json | null
          id: string
          is_mock: boolean
          notes: string | null
          paid_at: string | null
          payment_method: string | null
          payment_reference: string | null
          payment_stage: string
          payment_status: string
          request_id: string
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          assignment_id?: string | null
          callback_url?: string | null
          checkout_url?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          gateway_name?: string
          gateway_response_json?: Json | null
          id?: string
          is_mock?: boolean
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          payment_stage?: string
          payment_status?: string
          request_id: string
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          assignment_id?: string | null
          callback_url?: string | null
          checkout_url?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          gateway_name?: string
          gateway_response_json?: Json | null
          id?: string
          is_mock?: boolean
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          payment_stage?: string
          payment_status?: string
          request_id?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "v_recent_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "valuation_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "valuation_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name_ar: string
          full_name_en: string | null
          id: string
          is_active: boolean
          license_number: string | null
          organization_id: string | null
          phone: string | null
          preferred_language: string
          signature_url: string | null
          specialization: string | null
          taqeem_membership: string | null
          title_ar: string | null
          title_en: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name_ar: string
          full_name_en?: string | null
          id?: string
          is_active?: boolean
          license_number?: string | null
          organization_id?: string | null
          phone?: string | null
          preferred_language?: string
          signature_url?: string | null
          specialization?: string | null
          taqeem_membership?: string | null
          title_ar?: string | null
          title_en?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name_ar?: string
          full_name_en?: string | null
          id?: string
          is_active?: boolean
          license_number?: string | null
          organization_id?: string | null
          phone?: string | null
          preferred_language?: string
          signature_url?: string | null
          specialization?: string | null
          taqeem_membership?: string | null
          title_ar?: string | null
          title_en?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      reconciliation_results: {
        Row: {
          assignment_id: string
          confidence_level: string | null
          created_at: string
          currency: string | null
          final_value: number
          final_value_text_ar: string | null
          final_value_text_en: string | null
          highest_best_use_ar: string | null
          highest_best_use_en: string | null
          id: string
          reasoning_ar: string
          reasoning_en: string | null
          updated_at: string
          value_range_high: number | null
          value_range_low: number | null
        }
        Insert: {
          assignment_id: string
          confidence_level?: string | null
          created_at?: string
          currency?: string | null
          final_value: number
          final_value_text_ar?: string | null
          final_value_text_en?: string | null
          highest_best_use_ar?: string | null
          highest_best_use_en?: string | null
          id?: string
          reasoning_ar: string
          reasoning_en?: string | null
          updated_at?: string
          value_range_high?: number | null
          value_range_low?: number | null
        }
        Update: {
          assignment_id?: string
          confidence_level?: string | null
          created_at?: string
          currency?: string | null
          final_value?: number
          final_value_text_ar?: string | null
          final_value_text_en?: string | null
          highest_best_use_ar?: string | null
          highest_best_use_en?: string | null
          id?: string
          reasoning_ar?: string
          reasoning_en?: string | null
          updated_at?: string
          value_range_high?: number | null
          value_range_low?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reconciliation_results_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: true
            referencedRelation: "v_recent_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_results_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: true
            referencedRelation: "valuation_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      report_change_log: {
        Row: {
          change_summary_ar: string | null
          change_summary_en: string | null
          change_type: string
          changed_by: string | null
          created_at: string
          id: string
          related_comment_id: string | null
          report_id: string
          version_from: number
          version_to: number
        }
        Insert: {
          change_summary_ar?: string | null
          change_summary_en?: string | null
          change_type?: string
          changed_by?: string | null
          created_at?: string
          id?: string
          related_comment_id?: string | null
          report_id: string
          version_from: number
          version_to: number
        }
        Update: {
          change_summary_ar?: string | null
          change_summary_en?: string | null
          change_type?: string
          changed_by?: string | null
          created_at?: string
          id?: string
          related_comment_id?: string | null
          report_id?: string
          version_from?: number
          version_to?: number
        }
        Relationships: [
          {
            foreignKeyName: "report_change_log_related_comment_id_fkey"
            columns: ["related_comment_id"]
            isOneToOne: false
            referencedRelation: "report_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_change_log_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      report_comments: {
        Row: {
          assignment_id: string | null
          author_id: string | null
          author_type: string
          comment_text: string
          created_at: string
          id: string
          report_id: string
          report_version: number | null
          request_id: string | null
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          section_key: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assignment_id?: string | null
          author_id?: string | null
          author_type?: string
          comment_text: string
          created_at?: string
          id?: string
          report_id: string
          report_version?: number | null
          request_id?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          section_key?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assignment_id?: string | null
          author_id?: string | null
          author_type?: string
          comment_text?: string
          created_at?: string
          id?: string
          report_id?: string
          report_version?: number | null
          request_id?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          section_key?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_comments_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "v_recent_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_comments_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "valuation_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_comments_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_comments_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "valuation_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      report_signatures: {
        Row: {
          id: string
          ip_address: string | null
          is_valid: boolean | null
          report_id: string
          signature_image_url: string | null
          signed_at: string
          signer_id: string
          signer_license: string | null
          signer_name_ar: string
          signer_name_en: string
          signer_title_ar: string | null
          signer_title_en: string | null
        }
        Insert: {
          id?: string
          ip_address?: string | null
          is_valid?: boolean | null
          report_id: string
          signature_image_url?: string | null
          signed_at?: string
          signer_id: string
          signer_license?: string | null
          signer_name_ar?: string
          signer_name_en?: string
          signer_title_ar?: string | null
          signer_title_en?: string | null
        }
        Update: {
          id?: string
          ip_address?: string | null
          is_valid?: boolean | null
          report_id?: string
          signature_image_url?: string | null
          signed_at?: string
          signer_id?: string
          signer_license?: string | null
          signer_name_ar?: string
          signer_name_en?: string
          signer_title_ar?: string | null
          signer_title_en?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_signatures_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      report_versions: {
        Row: {
          change_summary: string | null
          content_snapshot: Json
          created_at: string
          created_by: string | null
          id: string
          report_id: string
          version_number: number
        }
        Insert: {
          change_summary?: string | null
          content_snapshot: Json
          created_at?: string
          created_by?: string | null
          id?: string
          report_id: string
          version_number: number
        }
        Update: {
          change_summary?: string | null
          content_snapshot?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          report_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "report_versions_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          assignment_id: string
          content_ar: Json | null
          content_en: Json | null
          cover_page: Json | null
          created_at: string
          created_by: string | null
          generated_by: string | null
          id: string
          is_final: boolean | null
          language: Database["public"]["Enums"]["report_language"]
          pdf_url: string | null
          pdf_url_bilingual: string | null
          pdf_url_en: string | null
          report_type: Database["public"]["Enums"]["report_type"]
          status: string | null
          title_ar: string | null
          title_en: string | null
          updated_at: string
          version: number
        }
        Insert: {
          assignment_id: string
          content_ar?: Json | null
          content_en?: Json | null
          cover_page?: Json | null
          created_at?: string
          created_by?: string | null
          generated_by?: string | null
          id?: string
          is_final?: boolean | null
          language?: Database["public"]["Enums"]["report_language"]
          pdf_url?: string | null
          pdf_url_bilingual?: string | null
          pdf_url_en?: string | null
          report_type?: Database["public"]["Enums"]["report_type"]
          status?: string | null
          title_ar?: string | null
          title_en?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          assignment_id?: string
          content_ar?: Json | null
          content_en?: Json | null
          cover_page?: Json | null
          created_at?: string
          created_by?: string | null
          generated_by?: string | null
          id?: string
          is_final?: boolean | null
          language?: Database["public"]["Enums"]["report_language"]
          pdf_url?: string | null
          pdf_url_bilingual?: string | null
          pdf_url_en?: string | null
          report_type?: Database["public"]["Enums"]["report_type"]
          status?: string | null
          title_ar?: string | null
          title_en?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "reports_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "v_recent_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "valuation_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      request_documents: {
        Row: {
          ai_category: string | null
          ai_classification_confidence: number | null
          ai_extracted_data: Json | null
          ai_is_relevant: boolean | null
          ai_notes: string | null
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          manual_category: string | null
          mime_type: string | null
          request_id: string
          uploaded_by: string
        }
        Insert: {
          ai_category?: string | null
          ai_classification_confidence?: number | null
          ai_extracted_data?: Json | null
          ai_is_relevant?: boolean | null
          ai_notes?: string | null
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          manual_category?: string | null
          mime_type?: string | null
          request_id: string
          uploaded_by: string
        }
        Update: {
          ai_category?: string | null
          ai_classification_confidence?: number | null
          ai_extracted_data?: Json | null
          ai_is_relevant?: boolean | null
          ai_notes?: string | null
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          manual_category?: string | null
          mime_type?: string | null
          request_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_documents_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "valuation_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      request_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          is_read: boolean | null
          metadata: Json | null
          request_id: string
          sender_id: string | null
          sender_type: Database["public"]["Enums"]["message_sender_type"]
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          metadata?: Json | null
          request_id: string
          sender_id?: string | null
          sender_type: Database["public"]["Enums"]["message_sender_type"]
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          metadata?: Json | null
          request_id?: string
          sender_id?: string | null
          sender_type?: Database["public"]["Enums"]["message_sender_type"]
        }
        Relationships: [
          {
            foreignKeyName: "request_messages_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "valuation_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      review_findings: {
        Row: {
          assignment_id: string
          created_at: string
          description_ar: string
          description_en: string | null
          finding_type: string
          id: string
          is_resolved: boolean | null
          recommendation_ar: string | null
          recommendation_en: string | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          reviewer_id: string
          severity: Database["public"]["Enums"]["review_finding_severity"]
          title_ar: string
          title_en: string | null
          updated_at: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          description_ar: string
          description_en?: string | null
          finding_type: string
          id?: string
          is_resolved?: boolean | null
          recommendation_ar?: string | null
          recommendation_en?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          reviewer_id: string
          severity?: Database["public"]["Enums"]["review_finding_severity"]
          title_ar: string
          title_en?: string | null
          updated_at?: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          description_ar?: string
          description_en?: string | null
          finding_type?: string
          id?: string
          is_resolved?: boolean | null
          recommendation_ar?: string | null
          recommendation_en?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          reviewer_id?: string
          severity?: Database["public"]["Enums"]["review_finding_severity"]
          title_ar?: string
          title_en?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_findings_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "v_recent_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_findings_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "valuation_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      scope_of_work: {
        Row: {
          assignment_id: string
          created_at: string
          data_sources_ar: string | null
          data_sources_en: string | null
          extent_of_investigation_ar: string | null
          extent_of_investigation_en: string | null
          id: string
          limitations_ar: string | null
          limitations_en: string | null
          nature_of_information_ar: string | null
          nature_of_information_en: string | null
          reliance_on_others_ar: string | null
          reliance_on_others_en: string | null
          restrictions_ar: string | null
          restrictions_en: string | null
          scope_description_ar: string | null
          scope_description_en: string | null
          updated_at: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          data_sources_ar?: string | null
          data_sources_en?: string | null
          extent_of_investigation_ar?: string | null
          extent_of_investigation_en?: string | null
          id?: string
          limitations_ar?: string | null
          limitations_en?: string | null
          nature_of_information_ar?: string | null
          nature_of_information_en?: string | null
          reliance_on_others_ar?: string | null
          reliance_on_others_en?: string | null
          restrictions_ar?: string | null
          restrictions_en?: string | null
          scope_description_ar?: string | null
          scope_description_en?: string | null
          updated_at?: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          data_sources_ar?: string | null
          data_sources_en?: string | null
          extent_of_investigation_ar?: string | null
          extent_of_investigation_en?: string | null
          id?: string
          limitations_ar?: string | null
          limitations_en?: string | null
          nature_of_information_ar?: string | null
          nature_of_information_en?: string | null
          reliance_on_others_ar?: string | null
          reliance_on_others_en?: string | null
          restrictions_ar?: string | null
          restrictions_en?: string | null
          scope_description_ar?: string | null
          scope_description_en?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scope_of_work_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: true
            referencedRelation: "v_recent_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scope_of_work_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: true
            referencedRelation: "valuation_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      status_history: {
        Row: {
          assignment_id: string
          changed_by: string
          created_at: string
          from_status: Database["public"]["Enums"]["assignment_status"] | null
          id: string
          reason: string | null
          to_status: Database["public"]["Enums"]["assignment_status"]
        }
        Insert: {
          assignment_id: string
          changed_by: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["assignment_status"] | null
          id?: string
          reason?: string | null
          to_status: Database["public"]["Enums"]["assignment_status"]
        }
        Update: {
          assignment_id?: string
          changed_by?: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["assignment_status"] | null
          id?: string
          reason?: string | null
          to_status?: Database["public"]["Enums"]["assignment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "status_history_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "v_recent_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "status_history_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "valuation_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      subject_rights: {
        Row: {
          created_at: string
          description_ar: string | null
          description_en: string | null
          expiry_date: string | null
          holder_ar: string | null
          holder_en: string | null
          id: string
          registration_date: string | null
          registration_number: string | null
          right_type_ar: string
          right_type_en: string | null
          subject_id: string
        }
        Insert: {
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          expiry_date?: string | null
          holder_ar?: string | null
          holder_en?: string | null
          id?: string
          registration_date?: string | null
          registration_number?: string | null
          right_type_ar: string
          right_type_en?: string | null
          subject_id: string
        }
        Update: {
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          expiry_date?: string | null
          holder_ar?: string | null
          holder_en?: string | null
          id?: string
          registration_date?: string | null
          registration_number?: string | null
          right_type_ar?: string
          right_type_en?: string | null
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subject_rights_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          access_roads_ar: string | null
          access_roads_en: string | null
          address_ar: string | null
          address_en: string | null
          annual_income: number | null
          assignment_id: string
          building_area: number | null
          building_area_unit: string | null
          building_condition: string | null
          city_ar: string | null
          city_en: string | null
          created_at: string
          current_use_ar: string | null
          current_use_en: string | null
          depth: number | null
          description_ar: string | null
          description_en: string | null
          district_ar: string | null
          district_en: string | null
          frontage: number | null
          id: string
          land_area: number | null
          land_area_unit: string | null
          latitude: number | null
          legal_description_ar: string | null
          legal_description_en: string | null
          longitude: number | null
          number_of_floors: number | null
          number_of_units: number | null
          occupancy_rate: number | null
          parking_spaces: number | null
          permitted_use_ar: string | null
          permitted_use_en: string | null
          plan_number: string | null
          plot_number: string | null
          property_type: Database["public"]["Enums"]["property_type"]
          region_ar: string | null
          region_en: string | null
          shape_ar: string | null
          shape_en: string | null
          title_deed_number: string | null
          topography_ar: string | null
          topography_en: string | null
          updated_at: string
          utilities_ar: string | null
          utilities_en: string | null
          year_built: number | null
          zip_code: string | null
          zoning_ar: string | null
          zoning_en: string | null
        }
        Insert: {
          access_roads_ar?: string | null
          access_roads_en?: string | null
          address_ar?: string | null
          address_en?: string | null
          annual_income?: number | null
          assignment_id: string
          building_area?: number | null
          building_area_unit?: string | null
          building_condition?: string | null
          city_ar?: string | null
          city_en?: string | null
          created_at?: string
          current_use_ar?: string | null
          current_use_en?: string | null
          depth?: number | null
          description_ar?: string | null
          description_en?: string | null
          district_ar?: string | null
          district_en?: string | null
          frontage?: number | null
          id?: string
          land_area?: number | null
          land_area_unit?: string | null
          latitude?: number | null
          legal_description_ar?: string | null
          legal_description_en?: string | null
          longitude?: number | null
          number_of_floors?: number | null
          number_of_units?: number | null
          occupancy_rate?: number | null
          parking_spaces?: number | null
          permitted_use_ar?: string | null
          permitted_use_en?: string | null
          plan_number?: string | null
          plot_number?: string | null
          property_type: Database["public"]["Enums"]["property_type"]
          region_ar?: string | null
          region_en?: string | null
          shape_ar?: string | null
          shape_en?: string | null
          title_deed_number?: string | null
          topography_ar?: string | null
          topography_en?: string | null
          updated_at?: string
          utilities_ar?: string | null
          utilities_en?: string | null
          year_built?: number | null
          zip_code?: string | null
          zoning_ar?: string | null
          zoning_en?: string | null
        }
        Update: {
          access_roads_ar?: string | null
          access_roads_en?: string | null
          address_ar?: string | null
          address_en?: string | null
          annual_income?: number | null
          assignment_id?: string
          building_area?: number | null
          building_area_unit?: string | null
          building_condition?: string | null
          city_ar?: string | null
          city_en?: string | null
          created_at?: string
          current_use_ar?: string | null
          current_use_en?: string | null
          depth?: number | null
          description_ar?: string | null
          description_en?: string | null
          district_ar?: string | null
          district_en?: string | null
          frontage?: number | null
          id?: string
          land_area?: number | null
          land_area_unit?: string | null
          latitude?: number | null
          legal_description_ar?: string | null
          legal_description_en?: string | null
          longitude?: number | null
          number_of_floors?: number | null
          number_of_units?: number | null
          occupancy_rate?: number | null
          parking_spaces?: number | null
          permitted_use_ar?: string | null
          permitted_use_en?: string | null
          plan_number?: string | null
          plot_number?: string | null
          property_type?: Database["public"]["Enums"]["property_type"]
          region_ar?: string | null
          region_en?: string | null
          shape_ar?: string | null
          shape_en?: string | null
          title_deed_number?: string | null
          topography_ar?: string | null
          topography_en?: string | null
          updated_at?: string
          utilities_ar?: string | null
          utilities_en?: string | null
          year_built?: number | null
          zip_code?: string | null
          zoning_ar?: string | null
          zoning_en?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subjects_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "v_recent_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subjects_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "valuation_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          granted_at: string
          granted_by: string | null
          id: string
          organization_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          organization_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          organization_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      valuation_assignments: {
        Row: {
          assigned_inspector_id: string | null
          assigned_reviewer_id: string | null
          assigned_valuer_id: string | null
          basis_of_value: Database["public"]["Enums"]["basis_of_value"]
          client_id: string
          created_at: string
          created_by: string
          engagement_date: string
          fee_amount: number | null
          fee_currency: string | null
          id: string
          intended_use_ar: string | null
          intended_use_en: string | null
          intended_users_ar: string | null
          intended_users_en: string | null
          is_locked: boolean
          issue_date: string | null
          locked_at: string | null
          locked_by: string | null
          notes: string | null
          organization_id: string
          priority: string | null
          property_type: Database["public"]["Enums"]["property_type"]
          purpose: Database["public"]["Enums"]["valuation_purpose"]
          qr_verification_code: string | null
          reference_number: string
          report_date: string | null
          report_language: Database["public"]["Enums"]["report_language"]
          sequential_number: number
          status: Database["public"]["Enums"]["assignment_status"]
          updated_at: string
          valuation_date: string | null
        }
        Insert: {
          assigned_inspector_id?: string | null
          assigned_reviewer_id?: string | null
          assigned_valuer_id?: string | null
          basis_of_value?: Database["public"]["Enums"]["basis_of_value"]
          client_id: string
          created_at?: string
          created_by: string
          engagement_date?: string
          fee_amount?: number | null
          fee_currency?: string | null
          id?: string
          intended_use_ar?: string | null
          intended_use_en?: string | null
          intended_users_ar?: string | null
          intended_users_en?: string | null
          is_locked?: boolean
          issue_date?: string | null
          locked_at?: string | null
          locked_by?: string | null
          notes?: string | null
          organization_id: string
          priority?: string | null
          property_type: Database["public"]["Enums"]["property_type"]
          purpose: Database["public"]["Enums"]["valuation_purpose"]
          qr_verification_code?: string | null
          reference_number: string
          report_date?: string | null
          report_language?: Database["public"]["Enums"]["report_language"]
          sequential_number: number
          status?: Database["public"]["Enums"]["assignment_status"]
          updated_at?: string
          valuation_date?: string | null
        }
        Update: {
          assigned_inspector_id?: string | null
          assigned_reviewer_id?: string | null
          assigned_valuer_id?: string | null
          basis_of_value?: Database["public"]["Enums"]["basis_of_value"]
          client_id?: string
          created_at?: string
          created_by?: string
          engagement_date?: string
          fee_amount?: number | null
          fee_currency?: string | null
          id?: string
          intended_use_ar?: string | null
          intended_use_en?: string | null
          intended_users_ar?: string | null
          intended_users_en?: string | null
          is_locked?: boolean
          issue_date?: string | null
          locked_at?: string | null
          locked_by?: string | null
          notes?: string | null
          organization_id?: string
          priority?: string | null
          property_type?: Database["public"]["Enums"]["property_type"]
          purpose?: Database["public"]["Enums"]["valuation_purpose"]
          qr_verification_code?: string | null
          reference_number?: string
          report_date?: string | null
          report_language?: Database["public"]["Enums"]["report_language"]
          sequential_number?: number
          status?: Database["public"]["Enums"]["assignment_status"]
          updated_at?: string
          valuation_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "valuation_assignments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "valuation_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      valuation_calculations: {
        Row: {
          created_at: string
          explanation_ar: string | null
          explanation_en: string | null
          formula: string | null
          id: string
          input_data: Json | null
          label_ar: string
          label_en: string | null
          method_id: string
          result_unit: string | null
          result_value: number | null
          step_number: number
        }
        Insert: {
          created_at?: string
          explanation_ar?: string | null
          explanation_en?: string | null
          formula?: string | null
          id?: string
          input_data?: Json | null
          label_ar: string
          label_en?: string | null
          method_id: string
          result_unit?: string | null
          result_value?: number | null
          step_number: number
        }
        Update: {
          created_at?: string
          explanation_ar?: string | null
          explanation_en?: string | null
          formula?: string | null
          id?: string
          input_data?: Json | null
          label_ar?: string
          label_en?: string | null
          method_id?: string
          result_unit?: string | null
          result_value?: number | null
          step_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "valuation_calculations_method_id_fkey"
            columns: ["method_id"]
            isOneToOne: false
            referencedRelation: "valuation_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      valuation_methods: {
        Row: {
          approach: Database["public"]["Enums"]["valuation_approach"]
          assignment_id: string
          concluded_value: number | null
          created_at: string
          currency: string | null
          id: string
          is_primary: boolean | null
          is_used: boolean | null
          reason_for_rejection_ar: string | null
          reason_for_rejection_en: string | null
          reason_for_use_ar: string | null
          reason_for_use_en: string | null
          updated_at: string
          weight_in_reconciliation: number | null
        }
        Insert: {
          approach: Database["public"]["Enums"]["valuation_approach"]
          assignment_id: string
          concluded_value?: number | null
          created_at?: string
          currency?: string | null
          id?: string
          is_primary?: boolean | null
          is_used?: boolean | null
          reason_for_rejection_ar?: string | null
          reason_for_rejection_en?: string | null
          reason_for_use_ar?: string | null
          reason_for_use_en?: string | null
          updated_at?: string
          weight_in_reconciliation?: number | null
        }
        Update: {
          approach?: Database["public"]["Enums"]["valuation_approach"]
          assignment_id?: string
          concluded_value?: number | null
          created_at?: string
          currency?: string | null
          id?: string
          is_primary?: boolean | null
          is_used?: boolean | null
          reason_for_rejection_ar?: string | null
          reason_for_rejection_en?: string | null
          reason_for_use_ar?: string | null
          reason_for_use_en?: string | null
          updated_at?: string
          weight_in_reconciliation?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "valuation_methods_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "v_recent_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "valuation_methods_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "valuation_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      valuation_requests: {
        Row: {
          ai_complexity_level: string | null
          ai_intake_summary: Json | null
          ai_missing_items: Json | null
          ai_suggested_category: string | null
          ai_suggested_price: number | null
          ai_suggested_turnaround: string | null
          ai_validated: boolean | null
          amount_paid: number | null
          assignment_id: string | null
          basis_of_value: Database["public"]["Enums"]["basis_of_value"] | null
          building_area: number | null
          client_user_id: string
          completed_at: string | null
          created_at: string
          draft_report_url: string | null
          fees_breakdown: Json | null
          final_report_url: string | null
          first_payment_amount: number | null
          first_payment_percentage: number | null
          id: string
          intended_use_ar: string | null
          intended_use_en: string | null
          intended_users_ar: string | null
          intended_users_en: string | null
          is_locked: boolean | null
          land_area: number | null
          organization_id: string | null
          payment_status: string | null
          payment_structure: string | null
          production_started_at: string | null
          property_address_ar: string | null
          property_address_en: string | null
          property_city_ar: string | null
          property_city_en: string | null
          property_description_ar: string | null
          property_description_en: string | null
          property_district_ar: string | null
          property_district_en: string | null
          property_type: Database["public"]["Enums"]["property_type"] | null
          purpose: Database["public"]["Enums"]["valuation_purpose"] | null
          quotation_amount: number | null
          quotation_approved_at: string | null
          quotation_currency: string | null
          quotation_notes_ar: string | null
          quotation_notes_en: string | null
          quotation_response_at: string | null
          quotation_sent_at: string | null
          reference_number: string | null
          scope_of_work_ar: string | null
          scope_of_work_en: string | null
          status: Database["public"]["Enums"]["request_status"]
          submitted_at: string | null
          terms_ar: string | null
          terms_en: string | null
          total_fees: number | null
          updated_at: string
        }
        Insert: {
          ai_complexity_level?: string | null
          ai_intake_summary?: Json | null
          ai_missing_items?: Json | null
          ai_suggested_category?: string | null
          ai_suggested_price?: number | null
          ai_suggested_turnaround?: string | null
          ai_validated?: boolean | null
          amount_paid?: number | null
          assignment_id?: string | null
          basis_of_value?: Database["public"]["Enums"]["basis_of_value"] | null
          building_area?: number | null
          client_user_id: string
          completed_at?: string | null
          created_at?: string
          draft_report_url?: string | null
          fees_breakdown?: Json | null
          final_report_url?: string | null
          first_payment_amount?: number | null
          first_payment_percentage?: number | null
          id?: string
          intended_use_ar?: string | null
          intended_use_en?: string | null
          intended_users_ar?: string | null
          intended_users_en?: string | null
          is_locked?: boolean | null
          land_area?: number | null
          organization_id?: string | null
          payment_status?: string | null
          payment_structure?: string | null
          production_started_at?: string | null
          property_address_ar?: string | null
          property_address_en?: string | null
          property_city_ar?: string | null
          property_city_en?: string | null
          property_description_ar?: string | null
          property_description_en?: string | null
          property_district_ar?: string | null
          property_district_en?: string | null
          property_type?: Database["public"]["Enums"]["property_type"] | null
          purpose?: Database["public"]["Enums"]["valuation_purpose"] | null
          quotation_amount?: number | null
          quotation_approved_at?: string | null
          quotation_currency?: string | null
          quotation_notes_ar?: string | null
          quotation_notes_en?: string | null
          quotation_response_at?: string | null
          quotation_sent_at?: string | null
          reference_number?: string | null
          scope_of_work_ar?: string | null
          scope_of_work_en?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          submitted_at?: string | null
          terms_ar?: string | null
          terms_en?: string | null
          total_fees?: number | null
          updated_at?: string
        }
        Update: {
          ai_complexity_level?: string | null
          ai_intake_summary?: Json | null
          ai_missing_items?: Json | null
          ai_suggested_category?: string | null
          ai_suggested_price?: number | null
          ai_suggested_turnaround?: string | null
          ai_validated?: boolean | null
          amount_paid?: number | null
          assignment_id?: string | null
          basis_of_value?: Database["public"]["Enums"]["basis_of_value"] | null
          building_area?: number | null
          client_user_id?: string
          completed_at?: string | null
          created_at?: string
          draft_report_url?: string | null
          fees_breakdown?: Json | null
          final_report_url?: string | null
          first_payment_amount?: number | null
          first_payment_percentage?: number | null
          id?: string
          intended_use_ar?: string | null
          intended_use_en?: string | null
          intended_users_ar?: string | null
          intended_users_en?: string | null
          is_locked?: boolean | null
          land_area?: number | null
          organization_id?: string | null
          payment_status?: string | null
          payment_structure?: string | null
          production_started_at?: string | null
          property_address_ar?: string | null
          property_address_en?: string | null
          property_city_ar?: string | null
          property_city_en?: string | null
          property_description_ar?: string | null
          property_description_en?: string | null
          property_district_ar?: string | null
          property_district_en?: string | null
          property_type?: Database["public"]["Enums"]["property_type"] | null
          purpose?: Database["public"]["Enums"]["valuation_purpose"] | null
          quotation_amount?: number | null
          quotation_approved_at?: string | null
          quotation_currency?: string | null
          quotation_notes_ar?: string | null
          quotation_notes_en?: string | null
          quotation_response_at?: string | null
          quotation_sent_at?: string | null
          reference_number?: string | null
          scope_of_work_ar?: string | null
          scope_of_work_en?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          submitted_at?: string | null
          terms_ar?: string | null
          terms_en?: string | null
          total_fees?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "valuation_requests_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "v_recent_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "valuation_requests_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "valuation_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "valuation_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_assignment_pipeline: {
        Row: {
          count: number | null
          status: Database["public"]["Enums"]["assignment_status"] | null
          urgent_count: number | null
        }
        Relationships: []
      }
      v_compliance_summary: {
        Row: {
          assignment_id: string | null
          mandatory_failures: number | null
          passed: number | null
          ready_for_issuance: boolean | null
          total_checks: number | null
        }
        Relationships: [
          {
            foreignKeyName: "compliance_checks_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "v_recent_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_checks_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "valuation_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      v_recent_assignments: {
        Row: {
          client_name_ar: string | null
          client_name_en: string | null
          created_at: string | null
          final_value: number | null
          id: string | null
          is_locked: boolean | null
          land_area: number | null
          priority: string | null
          property_city: string | null
          property_district: string | null
          property_type: Database["public"]["Enums"]["property_type"] | null
          purpose: Database["public"]["Enums"]["valuation_purpose"] | null
          reference_number: string | null
          reviewer_name_ar: string | null
          status: Database["public"]["Enums"]["assignment_status"] | null
          valuation_date: string | null
          valuer_name_ar: string | null
        }
        Relationships: []
      }
      v_review_summary: {
        Row: {
          assignment_id: string | null
          open_critical: number | null
          open_major: number | null
          resolved: number | null
          review_clear: boolean | null
          total_findings: number | null
        }
        Relationships: [
          {
            foreignKeyName: "review_findings_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "v_recent_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_findings_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "valuation_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      get_user_org_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      haversine_distance: {
        Args: { lat1: number; lat2: number; lon1: number; lon2: number }
        Returns: number
      }
    }
    Enums: {
      adjustment_type:
        | "location"
        | "area"
        | "age"
        | "condition"
        | "quality"
        | "floor_level"
        | "view"
        | "parking"
        | "date"
        | "zoning"
        | "access"
        | "shape"
        | "frontage"
        | "services"
        | "other"
      app_role:
        | "super_admin"
        | "firm_admin"
        | "valuer"
        | "reviewer"
        | "client"
        | "auditor"
      assignment_status:
        | "draft"
        | "intake"
        | "scope_definition"
        | "data_collection"
        | "inspection"
        | "analysis"
        | "valuation"
        | "reconciliation"
        | "draft_report"
        | "internal_review"
        | "revision"
        | "final_approval"
        | "issued"
        | "archived"
        | "rejected"
        | "returned"
        | "client_submitted"
        | "under_ai_review"
        | "awaiting_client_info"
        | "priced"
        | "awaiting_payment_initial"
        | "payment_received_initial"
        | "inspection_required"
        | "inspection_assigned"
        | "inspection_in_progress"
        | "inspection_submitted"
        | "valuation_in_progress"
        | "draft_report_ready"
        | "under_client_review"
        | "revision_in_progress"
        | "awaiting_final_payment"
        | "final_payment_received"
        | "report_issued"
        | "closed"
      attachment_category:
        | "title_deed"
        | "building_permit"
        | "lease_contract"
        | "photo"
        | "site_plan"
        | "map"
        | "coordinates"
        | "municipal_doc"
        | "zoning"
        | "financial_statement"
        | "comparable_evidence"
        | "inspection_report"
        | "identity_doc"
        | "other"
      audit_action:
        | "create"
        | "update"
        | "delete"
        | "status_change"
        | "lock"
        | "unlock"
        | "sign"
        | "approve"
        | "reject"
        | "return"
        | "view"
        | "export"
        | "login"
        | "logout"
      basis_of_value:
        | "market_value"
        | "fair_value"
        | "investment_value"
        | "equitable_value"
        | "liquidation_value"
        | "synergistic_value"
        | "other"
      message_sender_type: "client" | "admin" | "ai" | "system"
      property_type:
        | "residential"
        | "commercial"
        | "land"
        | "income_producing"
        | "development"
        | "expropriation"
        | "mixed_use"
        | "industrial"
        | "agricultural"
        | "hospitality"
      report_language: "ar" | "en" | "bilingual"
      report_type:
        | "short_form"
        | "full_narrative"
        | "internal_draft"
        | "review_report"
        | "compliance_checklist"
      request_status:
        | "draft"
        | "ai_review"
        | "submitted"
        | "needs_clarification"
        | "under_pricing"
        | "quotation_sent"
        | "quotation_approved"
        | "quotation_rejected"
        | "awaiting_payment"
        | "payment_uploaded"
        | "payment_under_review"
        | "partially_paid"
        | "fully_paid"
        | "in_production"
        | "draft_report_sent"
        | "client_comments"
        | "final_payment_pending"
        | "final_payment_uploaded"
        | "final_payment_approved"
        | "final_report_ready"
        | "completed"
        | "archived"
        | "cancelled"
        | "client_submitted"
        | "under_ai_review"
        | "awaiting_client_info"
        | "priced"
        | "awaiting_payment_initial"
        | "payment_received_initial"
        | "inspection_required"
        | "inspection_assigned"
        | "inspection_in_progress"
        | "inspection_submitted"
        | "valuation_in_progress"
        | "draft_report_ready"
        | "under_client_review"
        | "revision_in_progress"
        | "awaiting_final_payment"
        | "final_payment_received"
        | "report_issued"
        | "closed"
      review_finding_severity: "critical" | "major" | "minor" | "observation"
      valuation_approach:
        | "sales_comparison"
        | "income"
        | "cost"
        | "residual"
        | "profits"
        | "discounted_cash_flow"
      valuation_purpose:
        | "sale_purchase"
        | "mortgage"
        | "financial_reporting"
        | "insurance"
        | "taxation"
        | "expropriation"
        | "litigation"
        | "investment"
        | "lease_renewal"
        | "internal_decision"
        | "regulatory"
        | "other"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      adjustment_type: [
        "location",
        "area",
        "age",
        "condition",
        "quality",
        "floor_level",
        "view",
        "parking",
        "date",
        "zoning",
        "access",
        "shape",
        "frontage",
        "services",
        "other",
      ],
      app_role: [
        "super_admin",
        "firm_admin",
        "valuer",
        "reviewer",
        "client",
        "auditor",
      ],
      assignment_status: [
        "draft",
        "intake",
        "scope_definition",
        "data_collection",
        "inspection",
        "analysis",
        "valuation",
        "reconciliation",
        "draft_report",
        "internal_review",
        "revision",
        "final_approval",
        "issued",
        "archived",
        "rejected",
        "returned",
        "client_submitted",
        "under_ai_review",
        "awaiting_client_info",
        "priced",
        "awaiting_payment_initial",
        "payment_received_initial",
        "inspection_required",
        "inspection_assigned",
        "inspection_in_progress",
        "inspection_submitted",
        "valuation_in_progress",
        "draft_report_ready",
        "under_client_review",
        "revision_in_progress",
        "awaiting_final_payment",
        "final_payment_received",
        "report_issued",
        "closed",
      ],
      attachment_category: [
        "title_deed",
        "building_permit",
        "lease_contract",
        "photo",
        "site_plan",
        "map",
        "coordinates",
        "municipal_doc",
        "zoning",
        "financial_statement",
        "comparable_evidence",
        "inspection_report",
        "identity_doc",
        "other",
      ],
      audit_action: [
        "create",
        "update",
        "delete",
        "status_change",
        "lock",
        "unlock",
        "sign",
        "approve",
        "reject",
        "return",
        "view",
        "export",
        "login",
        "logout",
      ],
      basis_of_value: [
        "market_value",
        "fair_value",
        "investment_value",
        "equitable_value",
        "liquidation_value",
        "synergistic_value",
        "other",
      ],
      message_sender_type: ["client", "admin", "ai", "system"],
      property_type: [
        "residential",
        "commercial",
        "land",
        "income_producing",
        "development",
        "expropriation",
        "mixed_use",
        "industrial",
        "agricultural",
        "hospitality",
      ],
      report_language: ["ar", "en", "bilingual"],
      report_type: [
        "short_form",
        "full_narrative",
        "internal_draft",
        "review_report",
        "compliance_checklist",
      ],
      request_status: [
        "draft",
        "ai_review",
        "submitted",
        "needs_clarification",
        "under_pricing",
        "quotation_sent",
        "quotation_approved",
        "quotation_rejected",
        "awaiting_payment",
        "payment_uploaded",
        "payment_under_review",
        "partially_paid",
        "fully_paid",
        "in_production",
        "draft_report_sent",
        "client_comments",
        "final_payment_pending",
        "final_payment_uploaded",
        "final_payment_approved",
        "final_report_ready",
        "completed",
        "archived",
        "cancelled",
        "client_submitted",
        "under_ai_review",
        "awaiting_client_info",
        "priced",
        "awaiting_payment_initial",
        "payment_received_initial",
        "inspection_required",
        "inspection_assigned",
        "inspection_in_progress",
        "inspection_submitted",
        "valuation_in_progress",
        "draft_report_ready",
        "under_client_review",
        "revision_in_progress",
        "awaiting_final_payment",
        "final_payment_received",
        "report_issued",
        "closed",
      ],
      review_finding_severity: ["critical", "major", "minor", "observation"],
      valuation_approach: [
        "sales_comparison",
        "income",
        "cost",
        "residual",
        "profits",
        "discounted_cash_flow",
      ],
      valuation_purpose: [
        "sale_purchase",
        "mortgage",
        "financial_reporting",
        "insurance",
        "taxation",
        "expropriation",
        "litigation",
        "investment",
        "lease_renewal",
        "internal_decision",
        "regulatory",
        "other",
      ],
    },
  },
} as const
