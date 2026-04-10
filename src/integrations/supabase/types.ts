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
      active_sessions: {
        Row: {
          created_at: string
          device_info: string | null
          id: string
          ip_address: string | null
          last_active_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_info?: string | null
          id?: string
          ip_address?: string | null
          last_active_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_info?: string | null
          id?: string
          ip_address?: string | null
          last_active_at?: string
          user_id?: string
        }
        Relationships: []
      }
      archived_reports: {
        Row: {
          ai_confidence: number | null
          ai_extracted_data: Json | null
          client_id: string | null
          client_name_ar: string | null
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          is_indexed: boolean | null
          mime_type: string | null
          notes: string | null
          organization_id: string
          property_address_ar: string | null
          property_city_ar: string | null
          property_district_ar: string | null
          property_type: string | null
          report_date: string | null
          report_number: string | null
          report_title_ar: string | null
          report_title_en: string | null
          report_type: string | null
          tags: string[] | null
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          ai_confidence?: number | null
          ai_extracted_data?: Json | null
          client_id?: string | null
          client_name_ar?: string | null
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          is_indexed?: boolean | null
          mime_type?: string | null
          notes?: string | null
          organization_id: string
          property_address_ar?: string | null
          property_city_ar?: string | null
          property_district_ar?: string | null
          property_type?: string | null
          report_date?: string | null
          report_number?: string | null
          report_title_ar?: string | null
          report_title_en?: string | null
          report_type?: string | null
          tags?: string[] | null
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          ai_confidence?: number | null
          ai_extracted_data?: Json | null
          client_id?: string | null
          client_name_ar?: string | null
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          is_indexed?: boolean | null
          mime_type?: string | null
          notes?: string | null
          organization_id?: string
          property_address_ar?: string | null
          property_city_ar?: string | null
          property_district_ar?: string | null
          property_type?: string | null
          report_date?: string | null
          report_number?: string | null
          report_title_ar?: string | null
          report_title_en?: string | null
          report_type?: string | null
          tags?: string[] | null
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "archived_reports_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "archived_reports_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_edit_logs: {
        Row: {
          action: string
          asset_id: string
          created_at: string
          field_name: string | null
          id: string
          job_id: string
          new_value: string | null
          old_value: string | null
          user_id: string
        }
        Insert: {
          action: string
          asset_id: string
          created_at?: string
          field_name?: string | null
          id?: string
          job_id: string
          new_value?: string | null
          old_value?: string | null
          user_id: string
        }
        Update: {
          action?: string
          asset_id?: string
          created_at?: string
          field_name?: string | null
          id?: string
          job_id?: string
          new_value?: string | null
          old_value?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_edit_logs_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "extracted_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_edit_logs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "processing_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
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
          client_id: string | null
          created_at: string
          description: string | null
          entity_type: string | null
          id: string
          ip_address: string | null
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string
          user_agent: string | null
          user_id: string | null
          user_name: string | null
          user_role: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          assignment_id?: string | null
          client_id?: string | null
          created_at?: string
          description?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name: string
          user_agent?: string | null
          user_id?: string | null
          user_name?: string | null
          user_role?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          assignment_id?: string | null
          client_id?: string | null
          created_at?: string
          description?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string
          user_agent?: string | null
          user_id?: string | null
          user_name?: string | null
          user_role?: string | null
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
          {
            foreignKeyName: "audit_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
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
      client_chat_feedback: {
        Row: {
          created_at: string
          id: string
          message_id: string
          rating: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id: string
          rating: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string
          rating?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_chat_feedback_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "client_chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      client_chat_messages: {
        Row: {
          assignment_id: string | null
          content: string
          created_at: string
          id: string
          metadata: Json | null
          request_id: string | null
          role: string
          session_id: string
          user_id: string
        }
        Insert: {
          assignment_id?: string | null
          content: string
          created_at?: string
          id?: string
          metadata?: Json | null
          request_id?: string | null
          role: string
          session_id: string
          user_id: string
        }
        Update: {
          assignment_id?: string | null
          content?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          request_id?: string | null
          role?: string
          session_id?: string
          user_id?: string
        }
        Relationships: []
      }
      client_engagement_scores: {
        Row: {
          activity_status: string | null
          avg_response_time_hours: number | null
          churn_risk_score: number | null
          client_id: string
          client_user_id: string | null
          created_at: string
          engagement_score: number | null
          id: string
          interests: string[] | null
          last_interaction_at: string | null
          last_request_at: string | null
          lifecycle_stage: string | null
          next_action_date: string | null
          next_recommended_action: string | null
          preferred_channel: string | null
          preferred_contact_time: string | null
          total_requests: number | null
          total_revenue: number | null
          updated_at: string
        }
        Insert: {
          activity_status?: string | null
          avg_response_time_hours?: number | null
          churn_risk_score?: number | null
          client_id: string
          client_user_id?: string | null
          created_at?: string
          engagement_score?: number | null
          id?: string
          interests?: string[] | null
          last_interaction_at?: string | null
          last_request_at?: string | null
          lifecycle_stage?: string | null
          next_action_date?: string | null
          next_recommended_action?: string | null
          preferred_channel?: string | null
          preferred_contact_time?: string | null
          total_requests?: number | null
          total_revenue?: number | null
          updated_at?: string
        }
        Update: {
          activity_status?: string | null
          avg_response_time_hours?: number | null
          churn_risk_score?: number | null
          client_id?: string
          client_user_id?: string | null
          created_at?: string
          engagement_score?: number | null
          id?: string
          interests?: string[] | null
          last_interaction_at?: string | null
          last_request_at?: string | null
          lifecycle_stage?: string | null
          next_action_date?: string | null
          next_recommended_action?: string | null
          preferred_channel?: string | null
          preferred_contact_time?: string | null
          total_requests?: number | null
          total_revenue?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_engagement_scores_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_merge_log: {
        Row: {
          confidence_score: number | null
          created_at: string
          id: string
          match_field: string | null
          match_value: string | null
          merged_by: string | null
          reason: string | null
          source_client_id: string
          source_client_name: string | null
          target_client_id: string
          target_client_name: string | null
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string
          id?: string
          match_field?: string | null
          match_value?: string | null
          merged_by?: string | null
          reason?: string | null
          source_client_id: string
          source_client_name?: string | null
          target_client_id: string
          target_client_name?: string | null
        }
        Update: {
          confidence_score?: number | null
          created_at?: string
          id?: string
          match_field?: string | null
          match_value?: string | null
          merged_by?: string | null
          reason?: string | null
          source_client_id?: string
          source_client_name?: string | null
          target_client_id?: string
          target_client_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_merge_log_target_client_id_fkey"
            columns: ["target_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address_ar: string | null
          address_en: string | null
          city_ar: string | null
          city_en: string | null
          client_status: string
          client_type: string
          contact_person_ar: string | null
          contact_person_en: string | null
          cr_number: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
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
          portal_user_id: string | null
          updated_at: string
        }
        Insert: {
          address_ar?: string | null
          address_en?: string | null
          city_ar?: string | null
          city_en?: string | null
          client_status?: string
          client_type?: string
          contact_person_ar?: string | null
          contact_person_en?: string | null
          cr_number?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
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
          portal_user_id?: string | null
          updated_at?: string
        }
        Update: {
          address_ar?: string | null
          address_en?: string | null
          city_ar?: string | null
          city_en?: string | null
          client_status?: string
          client_type?: string
          contact_person_ar?: string | null
          contact_person_en?: string | null
          cr_number?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
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
          portal_user_id?: string | null
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
      commercial_settings: {
        Row: {
          allow_partial_payment: boolean
          default_payment_terms_ar: string | null
          default_validity_days: number
          id: number
          report_release_policy: string
          updated_at: string
          vat_percentage: number
        }
        Insert: {
          allow_partial_payment?: boolean
          default_payment_terms_ar?: string | null
          default_validity_days?: number
          id?: number
          report_release_policy?: string
          updated_at?: string
          vat_percentage?: number
        }
        Update: {
          allow_partial_payment?: boolean
          default_payment_terms_ar?: string | null
          default_validity_days?: number
          id?: number
          report_release_policy?: string
          updated_at?: string
          vat_percentage?: number
        }
        Relationships: []
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
      compliance_check_results: {
        Row: {
          assignment_id: string
          checked_at: string
          checked_by: string | null
          id: string
          passed: boolean
          rule_id: string
          stage: string
          violation_message: string | null
        }
        Insert: {
          assignment_id: string
          checked_at?: string
          checked_by?: string | null
          id?: string
          passed?: boolean
          rule_id: string
          stage: string
          violation_message?: string | null
        }
        Update: {
          assignment_id?: string
          checked_at?: string
          checked_by?: string | null
          id?: string
          passed?: boolean
          rule_id?: string
          stage?: string
          violation_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compliance_check_results_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "v_recent_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_check_results_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "valuation_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_check_results_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "raqeem_rules"
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
      discount_codes: {
        Row: {
          applicable_services: string[] | null
          client_id: string | null
          code: string
          created_at: string
          created_by: string | null
          current_uses: number
          description: string | null
          discount_percentage: number
          discount_type: string
          expires_at: string | null
          first_time_only: boolean | null
          fixed_amount: number | null
          id: string
          is_active: boolean
          max_uses: number | null
          max_uses_per_client: number | null
          min_order_amount: number | null
          updated_at: string
        }
        Insert: {
          applicable_services?: string[] | null
          client_id?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          current_uses?: number
          description?: string | null
          discount_percentage: number
          discount_type?: string
          expires_at?: string | null
          first_time_only?: boolean | null
          fixed_amount?: number | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          max_uses_per_client?: number | null
          min_order_amount?: number | null
          updated_at?: string
        }
        Update: {
          applicable_services?: string[] | null
          client_id?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          current_uses?: number
          description?: string | null
          discount_percentage?: number
          discount_type?: string
          expires_at?: string | null
          first_time_only?: boolean | null
          fixed_amount?: number | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          max_uses_per_client?: number | null
          min_order_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "discount_codes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_usage_log: {
        Row: {
          assignment_id: string | null
          client_id: string | null
          discount_applied: number
          discount_code_id: string
          id: string
          used_at: string
        }
        Insert: {
          assignment_id?: string | null
          client_id?: string | null
          discount_applied?: number
          discount_code_id: string
          id?: string
          used_at?: string
        }
        Update: {
          assignment_id?: string | null
          client_id?: string | null
          discount_applied?: number
          discount_code_id?: string
          id?: string
          used_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "discount_usage_log_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "v_recent_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discount_usage_log_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "valuation_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discount_usage_log_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discount_usage_log_discount_code_id_fkey"
            columns: ["discount_code_id"]
            isOneToOne: false
            referencedRelation: "discount_codes"
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
      document_analyses: {
        Row: {
          accounting_standards: string | null
          ai_model_used: string | null
          analyzed_by: string | null
          anomalies: Json | null
          assignment_id: string | null
          compliance_status: Json | null
          confidence_score: number | null
          consistency_passed: boolean | null
          created_at: string
          error_message: string | null
          executive_brief: Json | null
          extracted_metrics: Json | null
          file_classifications: Json | null
          gap_impact_summary: string | null
          id: string
          identified_gaps: Json | null
          ivs_alignment: string | null
          key_metrics: Json | null
          methodology_justification: string | null
          methodology_mapping: Json | null
          organization_id: string | null
          pipeline_version: string | null
          processing_duration_ms: number | null
          recommendations: Json | null
          recommended_methodology: string | null
          request_id: string | null
          required_decision: string | null
          source_files: Json
          status: string | null
          taqeem_alignment: string | null
          updated_at: string
          validation_results: Json | null
        }
        Insert: {
          accounting_standards?: string | null
          ai_model_used?: string | null
          analyzed_by?: string | null
          anomalies?: Json | null
          assignment_id?: string | null
          compliance_status?: Json | null
          confidence_score?: number | null
          consistency_passed?: boolean | null
          created_at?: string
          error_message?: string | null
          executive_brief?: Json | null
          extracted_metrics?: Json | null
          file_classifications?: Json | null
          gap_impact_summary?: string | null
          id?: string
          identified_gaps?: Json | null
          ivs_alignment?: string | null
          key_metrics?: Json | null
          methodology_justification?: string | null
          methodology_mapping?: Json | null
          organization_id?: string | null
          pipeline_version?: string | null
          processing_duration_ms?: number | null
          recommendations?: Json | null
          recommended_methodology?: string | null
          request_id?: string | null
          required_decision?: string | null
          source_files?: Json
          status?: string | null
          taqeem_alignment?: string | null
          updated_at?: string
          validation_results?: Json | null
        }
        Update: {
          accounting_standards?: string | null
          ai_model_used?: string | null
          analyzed_by?: string | null
          anomalies?: Json | null
          assignment_id?: string | null
          compliance_status?: Json | null
          confidence_score?: number | null
          consistency_passed?: boolean | null
          created_at?: string
          error_message?: string | null
          executive_brief?: Json | null
          extracted_metrics?: Json | null
          file_classifications?: Json | null
          gap_impact_summary?: string | null
          id?: string
          identified_gaps?: Json | null
          ivs_alignment?: string | null
          key_metrics?: Json | null
          methodology_justification?: string | null
          methodology_mapping?: Json | null
          organization_id?: string | null
          pipeline_version?: string | null
          processing_duration_ms?: number | null
          recommendations?: Json | null
          recommended_methodology?: string | null
          request_id?: string | null
          required_decision?: string | null
          source_files?: Json
          status?: string | null
          taqeem_alignment?: string | null
          updated_at?: string
          validation_results?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "document_analyses_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "v_recent_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_analyses_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "valuation_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_analyses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_analyses_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "valuation_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      engagement_campaigns: {
        Row: {
          campaign_name_ar: string
          campaign_type: string
          channel: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean | null
          message_template_ar: string
          message_template_en: string | null
          priority: string | null
          schedule_cron: string | null
          stats: Json | null
          target_segment: string | null
          trigger_config: Json | null
          trigger_type: string
          updated_at: string
        }
        Insert: {
          campaign_name_ar: string
          campaign_type?: string
          channel?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          message_template_ar: string
          message_template_en?: string | null
          priority?: string | null
          schedule_cron?: string | null
          stats?: Json | null
          target_segment?: string | null
          trigger_config?: Json | null
          trigger_type?: string
          updated_at?: string
        }
        Update: {
          campaign_name_ar?: string
          campaign_type?: string
          channel?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          message_template_ar?: string
          message_template_en?: string | null
          priority?: string | null
          schedule_cron?: string | null
          stats?: Json | null
          target_segment?: string | null
          trigger_config?: Json | null
          trigger_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      engagement_logs: {
        Row: {
          campaign_id: string | null
          campaign_type: string
          channel: string
          client_id: string | null
          client_user_id: string | null
          conversion_value: number | null
          created_at: string
          delivery_status: string | null
          discount_code: string | null
          id: string
          message_ar: string
          opened_at: string | null
          responded_at: string | null
          response_type: string | null
        }
        Insert: {
          campaign_id?: string | null
          campaign_type: string
          channel?: string
          client_id?: string | null
          client_user_id?: string | null
          conversion_value?: number | null
          created_at?: string
          delivery_status?: string | null
          discount_code?: string | null
          id?: string
          message_ar: string
          opened_at?: string | null
          responded_at?: string | null
          response_type?: string | null
        }
        Update: {
          campaign_id?: string | null
          campaign_type?: string
          channel?: string
          client_id?: string | null
          client_user_id?: string | null
          conversion_value?: number | null
          created_at?: string
          delivery_status?: string | null
          discount_code?: string | null
          id?: string
          message_ar?: string
          opened_at?: string | null
          responded_at?: string | null
          response_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "engagement_logs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "engagement_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      executive_memory_profiles: {
        Row: {
          behavior_directives: string[]
          communication_style: Json
          context_rules: string[]
          created_at: string
          display_name_ar: string | null
          display_name_en: string | null
          domain_context: string | null
          id: string
          is_active: boolean
          preferred_language: string
          role_title_ar: string | null
          role_title_en: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          behavior_directives?: string[]
          communication_style?: Json
          context_rules?: string[]
          created_at?: string
          display_name_ar?: string | null
          display_name_en?: string | null
          domain_context?: string | null
          id?: string
          is_active?: boolean
          preferred_language?: string
          role_title_ar?: string | null
          role_title_en?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          behavior_directives?: string[]
          communication_style?: Json
          context_rules?: string[]
          created_at?: string
          display_name_ar?: string | null
          display_name_en?: string | null
          domain_context?: string | null
          id?: string
          is_active?: boolean
          preferred_language?: string
          role_title_ar?: string | null
          role_title_en?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      extracted_assets: {
        Row: {
          asset_data: Json
          asset_index: number
          asset_type: string
          category: string | null
          condition: string | null
          confidence: number
          created_at: string
          description: string | null
          duplicate_group: string | null
          duplicate_status: string | null
          id: string
          job_id: string
          missing_fields: string[] | null
          name: string
          quantity: number
          review_notes: string | null
          review_status: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_evidence: string | null
          source_files: Json | null
          subcategory: string | null
          updated_at: string
        }
        Insert: {
          asset_data?: Json
          asset_index?: number
          asset_type?: string
          category?: string | null
          condition?: string | null
          confidence?: number
          created_at?: string
          description?: string | null
          duplicate_group?: string | null
          duplicate_status?: string | null
          id?: string
          job_id: string
          missing_fields?: string[] | null
          name: string
          quantity?: number
          review_notes?: string | null
          review_status?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_evidence?: string | null
          source_files?: Json | null
          subcategory?: string | null
          updated_at?: string
        }
        Update: {
          asset_data?: Json
          asset_index?: number
          asset_type?: string
          category?: string | null
          condition?: string | null
          confidence?: number
          created_at?: string
          description?: string | null
          duplicate_group?: string | null
          duplicate_status?: string | null
          id?: string
          job_id?: string
          missing_fields?: string[] | null
          name?: string
          quantity?: number
          review_notes?: string | null
          review_status?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_evidence?: string | null
          source_files?: Json | null
          subcategory?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "extracted_assets_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "processing_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      file_classifications: {
        Row: {
          confidence: number | null
          contains_assets: boolean | null
          created_at: string
          document_category: string
          document_purpose: string | null
          error_message: string | null
          extracted_info: string | null
          file_name: string
          file_path: string | null
          file_size: number | null
          id: string
          job_id: string
          language: string | null
          mime_type: string | null
          processing_status: string | null
          relevance: string | null
        }
        Insert: {
          confidence?: number | null
          contains_assets?: boolean | null
          created_at?: string
          document_category?: string
          document_purpose?: string | null
          error_message?: string | null
          extracted_info?: string | null
          file_name: string
          file_path?: string | null
          file_size?: number | null
          id?: string
          job_id: string
          language?: string | null
          mime_type?: string | null
          processing_status?: string | null
          relevance?: string | null
        }
        Update: {
          confidence?: number | null
          contains_assets?: boolean | null
          created_at?: string
          document_category?: string
          document_purpose?: string | null
          error_message?: string | null
          extracted_info?: string | null
          file_name?: string
          file_path?: string | null
          file_size?: number | null
          id?: string
          job_id?: string
          language?: string | null
          mime_type?: string | null
          processing_status?: string | null
          relevance?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "file_classifications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "processing_jobs"
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
      inspection_analysis: {
        Row: {
          adjustment_factors: Json | null
          ai_confidence: number | null
          ai_model_used: string | null
          ai_reasoning_ar: string | null
          ai_reasoning_en: string | null
          assignment_id: string
          checklist_summary: Json | null
          condition_adjustment_pct: number | null
          condition_rating: string | null
          condition_score: number | null
          created_at: string
          environment_quality: string | null
          external_obsolescence_pct: number | null
          finishing_level: string | null
          functional_obsolescence_pct: number | null
          id: string
          inspection_id: string
          inspector_notes_summary: string | null
          is_overridden: boolean | null
          maintenance_level: string | null
          original_ai_data: Json | null
          override_at: string | null
          override_by: string | null
          override_notes: string | null
          photo_analysis: Json | null
          physical_depreciation_pct: number | null
          processed_at: string | null
          quality_score: number | null
          risk_flags: Json | null
          status: string
          updated_at: string
          visible_defects: Json | null
        }
        Insert: {
          adjustment_factors?: Json | null
          ai_confidence?: number | null
          ai_model_used?: string | null
          ai_reasoning_ar?: string | null
          ai_reasoning_en?: string | null
          assignment_id: string
          checklist_summary?: Json | null
          condition_adjustment_pct?: number | null
          condition_rating?: string | null
          condition_score?: number | null
          created_at?: string
          environment_quality?: string | null
          external_obsolescence_pct?: number | null
          finishing_level?: string | null
          functional_obsolescence_pct?: number | null
          id?: string
          inspection_id: string
          inspector_notes_summary?: string | null
          is_overridden?: boolean | null
          maintenance_level?: string | null
          original_ai_data?: Json | null
          override_at?: string | null
          override_by?: string | null
          override_notes?: string | null
          photo_analysis?: Json | null
          physical_depreciation_pct?: number | null
          processed_at?: string | null
          quality_score?: number | null
          risk_flags?: Json | null
          status?: string
          updated_at?: string
          visible_defects?: Json | null
        }
        Update: {
          adjustment_factors?: Json | null
          ai_confidence?: number | null
          ai_model_used?: string | null
          ai_reasoning_ar?: string | null
          ai_reasoning_en?: string | null
          assignment_id?: string
          checklist_summary?: Json | null
          condition_adjustment_pct?: number | null
          condition_rating?: string | null
          condition_score?: number | null
          created_at?: string
          environment_quality?: string | null
          external_obsolescence_pct?: number | null
          finishing_level?: string | null
          functional_obsolescence_pct?: number | null
          id?: string
          inspection_id?: string
          inspector_notes_summary?: string | null
          is_overridden?: boolean | null
          maintenance_level?: string | null
          original_ai_data?: Json | null
          override_at?: string | null
          override_by?: string | null
          override_notes?: string | null
          photo_analysis?: Json | null
          physical_depreciation_pct?: number | null
          processed_at?: string | null
          quality_score?: number | null
          risk_flags?: Json | null
          status?: string
          updated_at?: string
          visible_defects?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "inspection_analysis_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "v_recent_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_analysis_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "valuation_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_analysis_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: true
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          },
        ]
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
      inspector_evaluations: {
        Row: {
          assignment_id: string | null
          completion_score: number | null
          created_at: string
          evaluation_type: string
          evaluator_id: string | null
          id: string
          inspector_user_id: string
          notes: string | null
          quality_score: number | null
          rating: number
          satisfaction_score: number | null
          speed_score: number | null
        }
        Insert: {
          assignment_id?: string | null
          completion_score?: number | null
          created_at?: string
          evaluation_type?: string
          evaluator_id?: string | null
          id?: string
          inspector_user_id: string
          notes?: string | null
          quality_score?: number | null
          rating?: number
          satisfaction_score?: number | null
          speed_score?: number | null
        }
        Update: {
          assignment_id?: string | null
          completion_score?: number | null
          created_at?: string
          evaluation_type?: string
          evaluator_id?: string | null
          id?: string
          inspector_user_id?: string
          notes?: string | null
          quality_score?: number | null
          rating?: number
          satisfaction_score?: number | null
          speed_score?: number | null
        }
        Relationships: []
      }
      inspector_profiles: {
        Row: {
          approved_count: number | null
          availability_status: string
          avg_completion_hours: number | null
          avg_rating: number | null
          avg_response_hours: number | null
          branch: string | null
          certifications: string[] | null
          cities_ar: string[] | null
          cities_en: string[] | null
          complaints_count: number | null
          corrections_count: number | null
          created_at: string
          current_workload: number | null
          customer_satisfaction: number | null
          department: string | null
          employment_type: string | null
          home_latitude: number | null
          home_longitude: number | null
          id: string
          inspector_category: string | null
          is_active: boolean
          management_notes: string | null
          max_concurrent_tasks: number | null
          nationality: string | null
          notes: string | null
          organization_id: string | null
          overall_score: number | null
          phone: string | null
          quality_score: number | null
          regions_ar: string[] | null
          regions_en: string[] | null
          rejected_count: number | null
          specializations: string[] | null
          total_completed: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_count?: number | null
          availability_status?: string
          avg_completion_hours?: number | null
          avg_rating?: number | null
          avg_response_hours?: number | null
          branch?: string | null
          certifications?: string[] | null
          cities_ar?: string[] | null
          cities_en?: string[] | null
          complaints_count?: number | null
          corrections_count?: number | null
          created_at?: string
          current_workload?: number | null
          customer_satisfaction?: number | null
          department?: string | null
          employment_type?: string | null
          home_latitude?: number | null
          home_longitude?: number | null
          id?: string
          inspector_category?: string | null
          is_active?: boolean
          management_notes?: string | null
          max_concurrent_tasks?: number | null
          nationality?: string | null
          notes?: string | null
          organization_id?: string | null
          overall_score?: number | null
          phone?: string | null
          quality_score?: number | null
          regions_ar?: string[] | null
          regions_en?: string[] | null
          rejected_count?: number | null
          specializations?: string[] | null
          total_completed?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_count?: number | null
          availability_status?: string
          avg_completion_hours?: number | null
          avg_rating?: number | null
          avg_response_hours?: number | null
          branch?: string | null
          certifications?: string[] | null
          cities_ar?: string[] | null
          cities_en?: string[] | null
          complaints_count?: number | null
          corrections_count?: number | null
          created_at?: string
          current_workload?: number | null
          customer_satisfaction?: number | null
          department?: string | null
          employment_type?: string | null
          home_latitude?: number | null
          home_longitude?: number | null
          id?: string
          inspector_category?: string | null
          is_active?: boolean
          management_notes?: string | null
          max_concurrent_tasks?: number | null
          nationality?: string | null
          notes?: string | null
          organization_id?: string | null
          overall_score?: number | null
          phone?: string | null
          quality_score?: number | null
          regions_ar?: string[] | null
          regions_en?: string[] | null
          rejected_count?: number | null
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
      intelligence_source_links: {
        Row: {
          asset_type: string
          auto_linked: boolean
          created_at: string
          id: string
          is_active: boolean
          linked_by: string | null
          source_id: string
          source_name_ar: string
          source_type: string
          valuation_method: string
        }
        Insert: {
          asset_type?: string
          auto_linked?: boolean
          created_at?: string
          id?: string
          is_active?: boolean
          linked_by?: string | null
          source_id: string
          source_name_ar: string
          source_type: string
          valuation_method: string
        }
        Update: {
          asset_type?: string
          auto_linked?: boolean
          created_at?: string
          id?: string
          is_active?: boolean
          linked_by?: string | null
          source_id?: string
          source_name_ar?: string
          source_type?: string
          valuation_method?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          assignment_id: string | null
          client_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          discount_amount: number
          discount_code_id: string | null
          due_date: string | null
          id: string
          invoice_number: string | null
          is_test: boolean
          notes_ar: string | null
          notes_en: string | null
          organization_id: string | null
          paid_at: string | null
          payment_mode: string
          payment_status: string
          sent_at: string | null
          subtotal: number
          total_amount: number
          updated_at: string
          vat_amount: number
          vat_percentage: number
        }
        Insert: {
          assignment_id?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          discount_amount?: number
          discount_code_id?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string | null
          is_test?: boolean
          notes_ar?: string | null
          notes_en?: string | null
          organization_id?: string | null
          paid_at?: string | null
          payment_mode?: string
          payment_status?: string
          sent_at?: string | null
          subtotal?: number
          total_amount?: number
          updated_at?: string
          vat_amount?: number
          vat_percentage?: number
        }
        Update: {
          assignment_id?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          discount_amount?: number
          discount_code_id?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string | null
          is_test?: boolean
          notes_ar?: string | null
          notes_en?: string | null
          organization_id?: string | null
          paid_at?: string | null
          payment_mode?: string
          payment_status?: string
          sent_at?: string | null
          subtotal?: number
          total_amount?: number
          updated_at?: string
          vat_amount?: number
          vat_percentage?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "v_recent_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "valuation_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_discount_code_id_fkey"
            columns: ["discount_code_id"]
            isOneToOne: false
            referencedRelation: "discount_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_rebuild_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string
          critical_rules: number
          duplicates_removed: number
          error_message: string | null
          id: string
          processed_documents: number
          started_at: string | null
          status: string
          total_documents: number
          total_rules_extracted: number
          total_rules_inserted: number
          warning_rules: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string
          critical_rules?: number
          duplicates_removed?: number
          error_message?: string | null
          id?: string
          processed_documents?: number
          started_at?: string | null
          status?: string
          total_documents?: number
          total_rules_extracted?: number
          total_rules_inserted?: number
          warning_rules?: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string
          critical_rules?: number
          duplicates_removed?: number
          error_message?: string | null
          id?: string
          processed_documents?: number
          started_at?: string | null
          status?: string
          total_documents?: number
          total_rules_extracted?: number
          total_rules_inserted?: number
          warning_rules?: number
        }
        Relationships: []
      }
      login_attempts: {
        Row: {
          created_at: string
          email: string
          failure_reason: string | null
          id: string
          ip_address: string | null
          success: boolean
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          failure_reason?: string | null
          id?: string
          ip_address?: string | null
          success?: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          failure_reason?: string | null
          id?: string
          ip_address?: string | null
          success?: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      loyalty_rewards: {
        Row: {
          applicable_services: string[] | null
          auto_apply: boolean | null
          created_at: string
          discount_percentage: number | null
          fixed_amount: number | null
          id: string
          is_active: boolean | null
          min_requests: number | null
          min_revenue: number | null
          reward_name_ar: string
          reward_type: string
          trigger_condition: Json | null
          updated_at: string
          validity_days: number | null
        }
        Insert: {
          applicable_services?: string[] | null
          auto_apply?: boolean | null
          created_at?: string
          discount_percentage?: number | null
          fixed_amount?: number | null
          id?: string
          is_active?: boolean | null
          min_requests?: number | null
          min_revenue?: number | null
          reward_name_ar: string
          reward_type?: string
          trigger_condition?: Json | null
          updated_at?: string
          validity_days?: number | null
        }
        Update: {
          applicable_services?: string[] | null
          auto_apply?: boolean | null
          created_at?: string
          discount_percentage?: number | null
          fixed_amount?: number | null
          id?: string
          is_active?: boolean | null
          min_requests?: number | null
          min_revenue?: number | null
          reward_name_ar?: string
          reward_type?: string
          trigger_condition?: Json | null
          updated_at?: string
          validity_days?: number | null
        }
        Relationships: []
      }
      machinery_valuations: {
        Row: {
          approach: string
          assignment_id: string
          audit_trail: Json | null
          concluded_value: number | null
          created_at: string
          economic_obsolescence_pct: number | null
          final_value: number | null
          functional_obsolescence_pct: number | null
          id: string
          income_value: number | null
          market_comparable_value: number | null
          notes: string | null
          physical_depreciation_pct: number | null
          replacement_cost_new: number | null
          subject_machinery_id: string
          updated_at: string
          weight_cost: number | null
          weight_income: number | null
          weight_market: number | null
        }
        Insert: {
          approach?: string
          assignment_id: string
          audit_trail?: Json | null
          concluded_value?: number | null
          created_at?: string
          economic_obsolescence_pct?: number | null
          final_value?: number | null
          functional_obsolescence_pct?: number | null
          id?: string
          income_value?: number | null
          market_comparable_value?: number | null
          notes?: string | null
          physical_depreciation_pct?: number | null
          replacement_cost_new?: number | null
          subject_machinery_id: string
          updated_at?: string
          weight_cost?: number | null
          weight_income?: number | null
          weight_market?: number | null
        }
        Update: {
          approach?: string
          assignment_id?: string
          audit_trail?: Json | null
          concluded_value?: number | null
          created_at?: string
          economic_obsolescence_pct?: number | null
          final_value?: number | null
          functional_obsolescence_pct?: number | null
          id?: string
          income_value?: number | null
          market_comparable_value?: number | null
          notes?: string | null
          physical_depreciation_pct?: number | null
          replacement_cost_new?: number | null
          subject_machinery_id?: string
          updated_at?: string
          weight_cost?: number | null
          weight_income?: number | null
          weight_market?: number | null
        }
        Relationships: []
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
      notification_delivery_log: {
        Row: {
          channel: string
          created_at: string
          error_message: string | null
          id: string
          notification_id: string | null
          sent_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          channel: string
          created_at?: string
          error_message?: string | null
          id?: string
          notification_id?: string | null
          sent_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          error_message?: string | null
          id?: string
          notification_id?: string | null
          sent_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_delivery_log_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          category: string
          created_at: string
          email_enabled: boolean
          id: string
          in_app_enabled: boolean
          notification_type: string
          sms_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          email_enabled?: boolean
          id?: string
          in_app_enabled?: boolean
          notification_type: string
          sms_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          email_enabled?: boolean
          id?: string
          in_app_enabled?: boolean
          notification_type?: string
          sms_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          action_url: string | null
          body_ar: string | null
          body_en: string | null
          category: string
          channel: string | null
          created_at: string
          delivery_error: string | null
          delivery_status: string | null
          id: string
          is_read: boolean
          notification_type: string | null
          priority: string
          related_assignment_id: string | null
          related_request_id: string | null
          title_ar: string
          title_en: string | null
          user_id: string
        }
        Insert: {
          action_url?: string | null
          body_ar?: string | null
          body_en?: string | null
          category?: string
          channel?: string | null
          created_at?: string
          delivery_error?: string | null
          delivery_status?: string | null
          id?: string
          is_read?: boolean
          notification_type?: string | null
          priority?: string
          related_assignment_id?: string | null
          related_request_id?: string | null
          title_ar: string
          title_en?: string | null
          user_id: string
        }
        Update: {
          action_url?: string | null
          body_ar?: string | null
          body_en?: string | null
          category?: string
          channel?: string | null
          created_at?: string
          delivery_error?: string | null
          delivery_status?: string | null
          id?: string
          is_read?: boolean
          notification_type?: string | null
          priority?: string
          related_assignment_id?: string | null
          related_request_id?: string | null
          title_ar?: string
          title_en?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_related_assignment_id_fkey"
            columns: ["related_assignment_id"]
            isOneToOne: false
            referencedRelation: "v_recent_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_related_assignment_id_fkey"
            columns: ["related_assignment_id"]
            isOneToOne: false
            referencedRelation: "valuation_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_related_request_id_fkey"
            columns: ["related_request_id"]
            isOneToOne: false
            referencedRelation: "valuation_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      occasion_templates: {
        Row: {
          created_at: string
          default_message_ar: string
          gregorian_day: number | null
          gregorian_month: number | null
          hijri_day: number | null
          hijri_month: number | null
          id: string
          include_offer: boolean | null
          is_active: boolean | null
          occasion_key: string
          occasion_name_ar: string
          offer_discount_pct: number | null
          offer_validity_days: number | null
          send_days_before: number | null
        }
        Insert: {
          created_at?: string
          default_message_ar: string
          gregorian_day?: number | null
          gregorian_month?: number | null
          hijri_day?: number | null
          hijri_month?: number | null
          id?: string
          include_offer?: boolean | null
          is_active?: boolean | null
          occasion_key: string
          occasion_name_ar: string
          offer_discount_pct?: number | null
          offer_validity_days?: number | null
          send_days_before?: number | null
        }
        Update: {
          created_at?: string
          default_message_ar?: string
          gregorian_day?: number | null
          gregorian_month?: number | null
          hijri_day?: number | null
          hijri_month?: number | null
          id?: string
          include_offer?: boolean | null
          is_active?: boolean | null
          occasion_key?: string
          occasion_name_ar?: string
          offer_discount_pct?: number | null
          offer_validity_days?: number | null
          send_days_before?: number | null
        }
        Relationships: []
      }
      organization_settings: {
        Row: {
          category: string
          id: string
          organization_id: string
          settings: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category: string
          id?: string
          organization_id: string
          settings?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: string
          id?: string
          organization_id?: string
          settings?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_settings_organization_id_fkey"
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
          vat_number: string | null
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
          vat_number?: string | null
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
          vat_number?: string | null
          website?: string | null
        }
        Relationships: []
      }
      otp_supported_countries: {
        Row: {
          country_code: string
          country_name_ar: string
          country_name_en: string | null
          created_at: string
          dial_code: string
          id: string
          otp_enabled: boolean
          updated_at: string
        }
        Insert: {
          country_code: string
          country_name_ar: string
          country_name_en?: string | null
          created_at?: string
          dial_code: string
          id?: string
          otp_enabled?: boolean
          updated_at?: string
        }
        Update: {
          country_code?: string
          country_name_ar?: string
          country_name_en?: string | null
          created_at?: string
          dial_code?: string
          id?: string
          otp_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      payment_gateway_settings: {
        Row: {
          access_token: string | null
          callback_url: string | null
          configuration: Json | null
          created_at: string
          enabled_methods: string[]
          entity_id: string | null
          entity_id_applepay: string | null
          entity_id_mada: string | null
          environment: string
          failure_url: string | null
          id: string
          is_active: boolean
          provider: string
          return_url: string | null
          updated_at: string
          webhook_secret: string | null
        }
        Insert: {
          access_token?: string | null
          callback_url?: string | null
          configuration?: Json | null
          created_at?: string
          enabled_methods?: string[]
          entity_id?: string | null
          entity_id_applepay?: string | null
          entity_id_mada?: string | null
          environment?: string
          failure_url?: string | null
          id?: string
          is_active?: boolean
          provider?: string
          return_url?: string | null
          updated_at?: string
          webhook_secret?: string | null
        }
        Update: {
          access_token?: string | null
          callback_url?: string | null
          configuration?: Json | null
          created_at?: string
          enabled_methods?: string[]
          entity_id?: string | null
          entity_id_applepay?: string | null
          entity_id_mada?: string | null
          environment?: string
          failure_url?: string | null
          id?: string
          is_active?: boolean
          provider?: string
          return_url?: string | null
          updated_at?: string
          webhook_secret?: string | null
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
          bank_transfer_ref: string | null
          callback_url: string | null
          checkout_url: string | null
          client_notes: string | null
          created_at: string
          created_by: string | null
          currency: string
          gateway_name: string
          gateway_response_json: Json | null
          hyperpay_checkout_id: string | null
          id: string
          is_mock: boolean
          notes: string | null
          paid_at: string | null
          payment_method: string | null
          payment_proof_path: string | null
          payment_reference: string | null
          payment_stage: string
          payment_status: string
          payment_type: string
          request_id: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          assignment_id?: string | null
          bank_transfer_ref?: string | null
          callback_url?: string | null
          checkout_url?: string | null
          client_notes?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          gateway_name?: string
          gateway_response_json?: Json | null
          hyperpay_checkout_id?: string | null
          id?: string
          is_mock?: boolean
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_proof_path?: string | null
          payment_reference?: string | null
          payment_stage?: string
          payment_status?: string
          payment_type?: string
          request_id: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          assignment_id?: string | null
          bank_transfer_ref?: string | null
          callback_url?: string | null
          checkout_url?: string | null
          client_notes?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          gateway_name?: string
          gateway_response_json?: Json | null
          hyperpay_checkout_id?: string | null
          id?: string
          is_mock?: boolean
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_proof_path?: string | null
          payment_reference?: string | null
          payment_stage?: string
          payment_status?: string
          payment_type?: string
          request_id?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
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
      portfolio_assets: {
        Row: {
          address_ar: string | null
          address_en: string | null
          ai_confidence: number | null
          ai_extracted: boolean | null
          asset_category: string
          asset_name_ar: string
          asset_name_en: string | null
          asset_type: string
          assignment_id: string | null
          attributes: Json | null
          building_area: number | null
          city_ar: string | null
          city_en: string | null
          created_at: string
          description_ar: string | null
          description_en: string | null
          district_ar: string | null
          district_en: string | null
          id: string
          land_area: number | null
          request_id: string
          sort_order: number | null
          status: string | null
          updated_at: string
        }
        Insert: {
          address_ar?: string | null
          address_en?: string | null
          ai_confidence?: number | null
          ai_extracted?: boolean | null
          asset_category?: string
          asset_name_ar: string
          asset_name_en?: string | null
          asset_type?: string
          assignment_id?: string | null
          attributes?: Json | null
          building_area?: number | null
          city_ar?: string | null
          city_en?: string | null
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          district_ar?: string | null
          district_en?: string | null
          id?: string
          land_area?: number | null
          request_id: string
          sort_order?: number | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          address_ar?: string | null
          address_en?: string | null
          ai_confidence?: number | null
          ai_extracted?: boolean | null
          asset_category?: string
          asset_name_ar?: string
          asset_name_en?: string | null
          asset_type?: string
          assignment_id?: string | null
          attributes?: Json | null
          building_area?: number | null
          city_ar?: string | null
          city_en?: string | null
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          district_ar?: string | null
          district_en?: string | null
          id?: string
          land_area?: number | null
          request_id?: string
          sort_order?: number | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_assets_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "valuation_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      price_overrides: {
        Row: {
          assignment_id: string
          created_at: string
          id: string
          original_amount: number
          override_amount: number
          override_by: string
          reason_ar: string | null
        }
        Insert: {
          assignment_id: string
          created_at?: string
          id?: string
          original_amount: number
          override_amount: number
          override_by: string
          reason_ar?: string | null
        }
        Update: {
          assignment_id?: string
          created_at?: string
          id?: string
          original_amount?: number
          override_amount?: number
          override_by?: string
          reason_ar?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "price_overrides_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "v_recent_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_overrides_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "valuation_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_rules: {
        Row: {
          auto_discount_percentage: number | null
          base_fee: number
          complexity_multiplier: number
          created_at: string
          description_ar: string | null
          id: string
          income_analysis_fee: number
          inspection_fee: number
          is_active: boolean
          label_ar: string
          label_en: string | null
          per_unit_fee: number | null
          service_type: string
          sort_order: number | null
          subcategory: string | null
          surcharge_percentage: number | null
          tier_label_ar: string | null
          tier_max_units: number | null
          tier_min_units: number | null
          updated_at: string
        }
        Insert: {
          auto_discount_percentage?: number | null
          base_fee?: number
          complexity_multiplier?: number
          created_at?: string
          description_ar?: string | null
          id?: string
          income_analysis_fee?: number
          inspection_fee?: number
          is_active?: boolean
          label_ar: string
          label_en?: string | null
          per_unit_fee?: number | null
          service_type: string
          sort_order?: number | null
          subcategory?: string | null
          surcharge_percentage?: number | null
          tier_label_ar?: string | null
          tier_max_units?: number | null
          tier_min_units?: number | null
          updated_at?: string
        }
        Update: {
          auto_discount_percentage?: number | null
          base_fee?: number
          complexity_multiplier?: number
          created_at?: string
          description_ar?: string | null
          id?: string
          income_analysis_fee?: number
          inspection_fee?: number
          is_active?: boolean
          label_ar?: string
          label_en?: string | null
          per_unit_fee?: number | null
          service_type?: string
          sort_order?: number | null
          subcategory?: string | null
          surcharge_percentage?: number | null
          tier_label_ar?: string | null
          tier_max_units?: number | null
          tier_min_units?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      processing_jobs: {
        Row: {
          ai_summary: Json | null
          completed_at: string | null
          created_at: string
          current_message: string | null
          description: string | null
          discipline: string | null
          duplicates_found: number
          error_message: string | null
          file_manifest: Json | null
          id: string
          low_confidence_count: number
          missing_fields_count: number
          processed_files: number
          processing_log: Json | null
          request_id: string | null
          started_at: string | null
          status: string
          total_assets_found: number
          total_files: number
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_summary?: Json | null
          completed_at?: string | null
          created_at?: string
          current_message?: string | null
          description?: string | null
          discipline?: string | null
          duplicates_found?: number
          error_message?: string | null
          file_manifest?: Json | null
          id?: string
          low_confidence_count?: number
          missing_fields_count?: number
          processed_files?: number
          processing_log?: Json | null
          request_id?: string | null
          started_at?: string | null
          status?: string
          total_assets_found?: number
          total_files?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_summary?: Json | null
          completed_at?: string | null
          created_at?: string
          current_message?: string | null
          description?: string | null
          discipline?: string | null
          duplicates_found?: number
          error_message?: string | null
          file_manifest?: Json | null
          id?: string
          low_confidence_count?: number
          missing_fields_count?: number
          processed_files?: number
          processing_log?: Json | null
          request_id?: string | null
          started_at?: string | null
          status?: string
          total_assets_found?: number
          total_files?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_status: string
          avatar_url: string | null
          client_category: string | null
          client_category_manual: boolean | null
          client_value_score: number | null
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
          taqeem_membership_machinery: string | null
          title_ar: string | null
          title_en: string | null
          updated_at: string
          user_id: string
          user_type: string
        }
        Insert: {
          account_status?: string
          avatar_url?: string | null
          client_category?: string | null
          client_category_manual?: boolean | null
          client_value_score?: number | null
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
          taqeem_membership_machinery?: string | null
          title_ar?: string | null
          title_en?: string | null
          updated_at?: string
          user_id: string
          user_type?: string
        }
        Update: {
          account_status?: string
          avatar_url?: string | null
          client_category?: string | null
          client_category_manual?: boolean | null
          client_value_score?: number | null
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
          taqeem_membership_machinery?: string | null
          title_ar?: string | null
          title_en?: string | null
          updated_at?: string
          user_id?: string
          user_type?: string
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
      quality_gate_results: {
        Row: {
          assignment_id: string
          blocked_reasons: Json | null
          can_issue: boolean
          checks: Json
          created_at: string
          enhancement_suggestions: Json | null
          failed_enhancement: number
          failed_mandatory: number
          failed_quality: number
          has_warnings: boolean
          id: string
          overall_passed: boolean
          passed_checks: number
          run_by: string
          score: number
          total_checks: number
          warning_reasons: Json | null
        }
        Insert: {
          assignment_id: string
          blocked_reasons?: Json | null
          can_issue?: boolean
          checks?: Json
          created_at?: string
          enhancement_suggestions?: Json | null
          failed_enhancement?: number
          failed_mandatory?: number
          failed_quality?: number
          has_warnings?: boolean
          id?: string
          overall_passed?: boolean
          passed_checks?: number
          run_by: string
          score?: number
          total_checks?: number
          warning_reasons?: Json | null
        }
        Update: {
          assignment_id?: string
          blocked_reasons?: Json | null
          can_issue?: boolean
          checks?: Json
          created_at?: string
          enhancement_suggestions?: Json | null
          failed_enhancement?: number
          failed_mandatory?: number
          failed_quality?: number
          has_warnings?: boolean
          id?: string
          overall_passed?: boolean
          passed_checks?: number
          run_by?: string
          score?: number
          total_checks?: number
          warning_reasons?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "quality_gate_results_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "v_recent_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_gate_results_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "valuation_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      raqeem_agent_context: {
        Row: {
          assignment_id: string
          chat_history: Json | null
          confidence_score: number | null
          context_data: Json
          conversation_summary: string | null
          created_at: string
          id: string
          last_insight: string | null
          next_action: string | null
          observations: string[] | null
          pending_actions: string[] | null
          risk_flags: string[] | null
          stage: string
          summary: string | null
          updated_at: string
        }
        Insert: {
          assignment_id: string
          chat_history?: Json | null
          confidence_score?: number | null
          context_data?: Json
          conversation_summary?: string | null
          created_at?: string
          id?: string
          last_insight?: string | null
          next_action?: string | null
          observations?: string[] | null
          pending_actions?: string[] | null
          risk_flags?: string[] | null
          stage?: string
          summary?: string | null
          updated_at?: string
        }
        Update: {
          assignment_id?: string
          chat_history?: Json | null
          confidence_score?: number | null
          context_data?: Json
          conversation_summary?: string | null
          created_at?: string
          id?: string
          last_insight?: string | null
          next_action?: string | null
          observations?: string[] | null
          pending_actions?: string[] | null
          risk_flags?: string[] | null
          stage?: string
          summary?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      raqeem_audit_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string
          entity_type: string
          id: string
          performed_by: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id: string
          entity_type: string
          id?: string
          performed_by: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string
          entity_type?: string
          id?: string
          performed_by?: string
        }
        Relationships: []
      }
      raqeem_client_memory: {
        Row: {
          ai_notes: string | null
          avg_response_satisfaction: number | null
          client_user_id: string
          communication_style: string | null
          completed_requests: number | null
          created_at: string
          frequent_questions: string[] | null
          id: string
          last_interaction_summary: string | null
          preferred_cities: string[] | null
          preferred_property_types: string[] | null
          topics_of_interest: string[] | null
          total_requests: number | null
          updated_at: string
        }
        Insert: {
          ai_notes?: string | null
          avg_response_satisfaction?: number | null
          client_user_id: string
          communication_style?: string | null
          completed_requests?: number | null
          created_at?: string
          frequent_questions?: string[] | null
          id?: string
          last_interaction_summary?: string | null
          preferred_cities?: string[] | null
          preferred_property_types?: string[] | null
          topics_of_interest?: string[] | null
          total_requests?: number | null
          updated_at?: string
        }
        Update: {
          ai_notes?: string | null
          avg_response_satisfaction?: number | null
          client_user_id?: string
          communication_style?: string | null
          completed_requests?: number | null
          created_at?: string
          frequent_questions?: string[] | null
          id?: string
          last_interaction_summary?: string | null
          preferred_cities?: string[] | null
          preferred_property_types?: string[] | null
          topics_of_interest?: string[] | null
          total_requests?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      raqeem_corrections: {
        Row: {
          category: string | null
          corrected_answer: string
          corrected_by: string
          correction_reason: string | null
          correction_type: string | null
          created_at: string
          id: string
          is_active: boolean
          original_answer: string
          original_question: string
        }
        Insert: {
          category?: string | null
          corrected_answer: string
          corrected_by: string
          correction_reason?: string | null
          correction_type?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          original_answer: string
          original_question: string
        }
        Update: {
          category?: string | null
          corrected_answer?: string
          corrected_by?: string
          correction_reason?: string | null
          correction_type?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          original_answer?: string
          original_question?: string
        }
        Relationships: []
      }
      raqeem_expert_findings: {
        Row: {
          code_snippet: string | null
          created_at: string
          description_ar: string
          difficulty: string | null
          file_path: string | null
          fix_suggestion_ar: string | null
          id: string
          metadata: Json | null
          pillar: string
          scan_batch_id: string | null
          severity: string
          status: string
          title_ar: string
          updated_at: string
        }
        Insert: {
          code_snippet?: string | null
          created_at?: string
          description_ar: string
          difficulty?: string | null
          file_path?: string | null
          fix_suggestion_ar?: string | null
          id?: string
          metadata?: Json | null
          pillar: string
          scan_batch_id?: string | null
          severity: string
          status?: string
          title_ar: string
          updated_at?: string
        }
        Update: {
          code_snippet?: string | null
          created_at?: string
          description_ar?: string
          difficulty?: string | null
          file_path?: string | null
          fix_suggestion_ar?: string | null
          id?: string
          metadata?: Json | null
          pillar?: string
          scan_batch_id?: string | null
          severity?: string
          status?: string
          title_ar?: string
          updated_at?: string
        }
        Relationships: []
      }
      raqeem_expert_scans: {
        Row: {
          created_at: string
          critical_count: number | null
          duration_ms: number | null
          health_score: number | null
          healthy_count: number | null
          id: string
          info_count: number | null
          pillar_scores: Json | null
          scan_type: string
          summary_ar: string | null
          total_findings: number | null
          triggered_by: string | null
          warning_count: number | null
        }
        Insert: {
          created_at?: string
          critical_count?: number | null
          duration_ms?: number | null
          health_score?: number | null
          healthy_count?: number | null
          id?: string
          info_count?: number | null
          pillar_scores?: Json | null
          scan_type?: string
          summary_ar?: string | null
          total_findings?: number | null
          triggered_by?: string | null
          warning_count?: number | null
        }
        Update: {
          created_at?: string
          critical_count?: number | null
          duration_ms?: number | null
          health_score?: number | null
          healthy_count?: number | null
          id?: string
          info_count?: number | null
          pillar_scores?: Json | null
          scan_type?: string
          summary_ar?: string | null
          total_findings?: number | null
          triggered_by?: string | null
          warning_count?: number | null
        }
        Relationships: []
      }
      raqeem_knowledge: {
        Row: {
          category: string
          content: string
          created_at: string
          file_name: string | null
          file_path: string | null
          file_size: number | null
          id: string
          is_active: boolean
          mime_type: string | null
          priority: number
          source_type: string
          title_ar: string
          title_en: string | null
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          category?: string
          content: string
          created_at?: string
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          is_active?: boolean
          mime_type?: string | null
          priority?: number
          source_type?: string
          title_ar: string
          title_en?: string | null
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          is_active?: boolean
          mime_type?: string | null
          priority?: number
          source_type?: string
          title_ar?: string
          title_en?: string | null
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: []
      }
      raqeem_performance_snapshots: {
        Row: {
          avg_accuracy: number
          created_at: string
          id: string
          recorded_by: string
          snapshot_date: string
          total_corrections: number
          total_knowledge_docs: number
          total_rules: number
          total_tests: number
        }
        Insert: {
          avg_accuracy?: number
          created_at?: string
          id?: string
          recorded_by: string
          snapshot_date?: string
          total_corrections?: number
          total_knowledge_docs?: number
          total_rules?: number
          total_tests?: number
        }
        Update: {
          avg_accuracy?: number
          created_at?: string
          id?: string
          recorded_by?: string
          snapshot_date?: string
          total_corrections?: number
          total_knowledge_docs?: number
          total_rules?: number
          total_tests?: number
        }
        Relationships: []
      }
      raqeem_rules: {
        Row: {
          applicable_asset_type: string
          category: string
          condition_text: string | null
          created_at: string
          created_by: string
          enforcement_stage: string[]
          id: string
          impact_type: string
          is_active: boolean
          priority: number
          requirement_text: string | null
          rule_content: string
          rule_title_ar: string
          rule_title_en: string | null
          rule_type: string
          severity: string
          source_document_id: string | null
          updated_at: string
        }
        Insert: {
          applicable_asset_type?: string
          category?: string
          condition_text?: string | null
          created_at?: string
          created_by: string
          enforcement_stage?: string[]
          id?: string
          impact_type?: string
          is_active?: boolean
          priority?: number
          requirement_text?: string | null
          rule_content: string
          rule_title_ar: string
          rule_title_en?: string | null
          rule_type?: string
          severity?: string
          source_document_id?: string | null
          updated_at?: string
        }
        Update: {
          applicable_asset_type?: string
          category?: string
          condition_text?: string | null
          created_at?: string
          created_by?: string
          enforcement_stage?: string[]
          id?: string
          impact_type?: string
          is_active?: boolean
          priority?: number
          requirement_text?: string | null
          rule_content?: string
          rule_title_ar?: string
          rule_title_en?: string | null
          rule_type?: string
          severity?: string
          source_document_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "raqeem_rules_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: false
            referencedRelation: "raqeem_knowledge"
            referencedColumns: ["id"]
          },
        ]
      }
      raqeem_system_metrics: {
        Row: {
          id: string
          metadata: Json | null
          metric_name: string
          metric_type: string
          metric_value: number | null
          recorded_at: string
          unit: string | null
        }
        Insert: {
          id?: string
          metadata?: Json | null
          metric_name: string
          metric_type: string
          metric_value?: number | null
          recorded_at?: string
          unit?: string | null
        }
        Update: {
          id?: string
          metadata?: Json | null
          metric_name?: string
          metric_type?: string
          metric_value?: number | null
          recorded_at?: string
          unit?: string | null
        }
        Relationships: []
      }
      raqeem_tech_findings: {
        Row: {
          auto_resolved: boolean | null
          category: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          metadata: Json | null
          recommendation: string | null
          resolved_at: string | null
          resolved_by: string | null
          scan_type: string
          severity: string
          title: string
          updated_at: string
        }
        Insert: {
          auto_resolved?: boolean | null
          category: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          recommendation?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          scan_type?: string
          severity?: string
          title: string
          updated_at?: string
        }
        Update: {
          auto_resolved?: boolean | null
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          recommendation?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          scan_type?: string
          severity?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      raqeem_test_sessions: {
        Row: {
          accuracy_score: number
          correct_answers: number
          created_at: string
          id: string
          notes: string | null
          questions: Json
          results: Json
          test_name: string
          test_type: string
          tested_by: string
          total_questions: number
        }
        Insert: {
          accuracy_score?: number
          correct_answers?: number
          created_at?: string
          id?: string
          notes?: string | null
          questions?: Json
          results?: Json
          test_name: string
          test_type?: string
          tested_by: string
          total_questions?: number
        }
        Update: {
          accuracy_score?: number
          correct_answers?: number
          created_at?: string
          id?: string
          notes?: string | null
          questions?: Json
          results?: Json
          test_name?: string
          test_type?: string
          tested_by?: string
          total_questions?: number
        }
        Relationships: []
      }
      raqeem_watchdog_findings: {
        Row: {
          auto_resolved: boolean | null
          category: Database["public"]["Enums"]["watchdog_category"]
          created_at: string
          description: string
          details: Json | null
          detection_count: number
          fingerprint: string
          first_detected_at: string
          id: string
          last_detected_at: string
          recommendation: string | null
          related_entity_id: string | null
          related_entity_type: string | null
          related_user_id: string | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: Database["public"]["Enums"]["watchdog_severity"]
          status: Database["public"]["Enums"]["watchdog_finding_status"]
          title: string
          updated_at: string
        }
        Insert: {
          auto_resolved?: boolean | null
          category: Database["public"]["Enums"]["watchdog_category"]
          created_at?: string
          description: string
          details?: Json | null
          detection_count?: number
          fingerprint: string
          first_detected_at?: string
          id?: string
          last_detected_at?: string
          recommendation?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          related_user_id?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["watchdog_severity"]
          status?: Database["public"]["Enums"]["watchdog_finding_status"]
          title: string
          updated_at?: string
        }
        Update: {
          auto_resolved?: boolean | null
          category?: Database["public"]["Enums"]["watchdog_category"]
          created_at?: string
          description?: string
          details?: Json | null
          detection_count?: number
          fingerprint?: string
          first_detected_at?: string
          id?: string
          last_detected_at?: string
          recommendation?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          related_user_id?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["watchdog_severity"]
          status?: Database["public"]["Enums"]["watchdog_finding_status"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      raqeem_watchdog_scans: {
        Row: {
          categories_scanned: string[] | null
          completed_at: string | null
          duration_ms: number | null
          errors: Json | null
          findings_auto_resolved: number | null
          findings_created: number | null
          findings_updated: number | null
          id: string
          metadata: Json | null
          scan_type: string
          started_at: string
        }
        Insert: {
          categories_scanned?: string[] | null
          completed_at?: string | null
          duration_ms?: number | null
          errors?: Json | null
          findings_auto_resolved?: number | null
          findings_created?: number | null
          findings_updated?: number | null
          id?: string
          metadata?: Json | null
          scan_type?: string
          started_at?: string
        }
        Update: {
          categories_scanned?: string[] | null
          completed_at?: string | null
          duration_ms?: number | null
          errors?: Json | null
          findings_auto_resolved?: number | null
          findings_created?: number | null
          findings_updated?: number | null
          id?: string
          metadata?: Json | null
          scan_type?: string
          started_at?: string
        }
        Relationships: []
      }
      raqeem_watchdog_settings: {
        Row: {
          alert_severity_threshold:
            | Database["public"]["Enums"]["watchdog_severity"]
            | null
          categories_enabled:
            | Database["public"]["Enums"]["watchdog_category"][]
            | null
          daily_digest_enabled: boolean | null
          id: number
          instant_alerts_enabled: boolean | null
          scan_interval_minutes: number | null
          updated_at: string
        }
        Insert: {
          alert_severity_threshold?:
            | Database["public"]["Enums"]["watchdog_severity"]
            | null
          categories_enabled?:
            | Database["public"]["Enums"]["watchdog_category"][]
            | null
          daily_digest_enabled?: boolean | null
          id?: number
          instant_alerts_enabled?: boolean | null
          scan_interval_minutes?: number | null
          updated_at?: string
        }
        Update: {
          alert_severity_threshold?:
            | Database["public"]["Enums"]["watchdog_severity"]
            | null
          categories_enabled?:
            | Database["public"]["Enums"]["watchdog_category"][]
            | null
          daily_digest_enabled?: boolean | null
          id?: number
          instant_alerts_enabled?: boolean | null
          scan_interval_minutes?: number | null
          updated_at?: string
        }
        Relationships: []
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
      report_drafts: {
        Row: {
          ai_model: string | null
          archived_at: string | null
          client_approved_at: string | null
          client_comments: string | null
          created_at: string
          generated_by: string | null
          generation_mode: string | null
          id: string
          issued_at: string | null
          notes: string | null
          raw_content: string | null
          report_number: string | null
          request_id: string
          retention_until: string | null
          sections: Json
          status: string
          updated_at: string
          verification_code: string | null
          version: number
        }
        Insert: {
          ai_model?: string | null
          archived_at?: string | null
          client_approved_at?: string | null
          client_comments?: string | null
          created_at?: string
          generated_by?: string | null
          generation_mode?: string | null
          id?: string
          issued_at?: string | null
          notes?: string | null
          raw_content?: string | null
          report_number?: string | null
          request_id: string
          retention_until?: string | null
          sections?: Json
          status?: string
          updated_at?: string
          verification_code?: string | null
          version?: number
        }
        Update: {
          ai_model?: string | null
          archived_at?: string | null
          client_approved_at?: string | null
          client_comments?: string | null
          created_at?: string
          generated_by?: string | null
          generation_mode?: string | null
          id?: string
          issued_at?: string | null
          notes?: string | null
          raw_content?: string | null
          report_number?: string | null
          request_id?: string
          retention_until?: string | null
          sections?: Json
          status?: string
          updated_at?: string
          verification_code?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "report_drafts_request_id_fkey"
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
          signature_hash: string | null
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
          signature_hash?: string | null
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
          signature_hash?: string | null
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
      report_templates: {
        Row: {
          asset_type: string
          created_at: string
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name_ar: string
          name_en: string | null
          organization_id: string | null
          template_sections: Json
          updated_at: string
        }
        Insert: {
          asset_type?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name_ar: string
          name_en?: string | null
          organization_id?: string | null
          template_sections?: Json
          updated_at?: string
        }
        Update: {
          asset_type?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name_ar?: string
          name_en?: string | null
          organization_id?: string | null
          template_sections?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      report_verification_log: {
        Row: {
          id: string
          ip_address: string | null
          report_id: string
          result: string
          user_agent: string | null
          verified_at: string
        }
        Insert: {
          id?: string
          ip_address?: string | null
          report_id: string
          result?: string
          user_agent?: string | null
          verified_at?: string
        }
        Update: {
          id?: string
          ip_address?: string | null
          report_id?: string
          result?: string
          user_agent?: string | null
          verified_at?: string
        }
        Relationships: []
      }
      report_versions: {
        Row: {
          change_summary: string | null
          content_snapshot: Json
          created_at: string
          created_by: string | null
          id: string
          reason_ar: string | null
          reason_en: string | null
          report_id: string
          version_number: number
          version_type: string | null
        }
        Insert: {
          change_summary?: string | null
          content_snapshot: Json
          created_at?: string
          created_by?: string | null
          id?: string
          reason_ar?: string | null
          reason_en?: string | null
          report_id: string
          version_number: number
          version_type?: string | null
        }
        Update: {
          change_summary?: string | null
          content_snapshot?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          reason_ar?: string | null
          reason_en?: string | null
          report_id?: string
          version_number?: number
          version_type?: string | null
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
          expired_at: string | null
          expiry_date: string | null
          generated_by: string | null
          id: string
          is_final: boolean | null
          is_locked: boolean | null
          issue_date: string | null
          language: Database["public"]["Enums"]["report_language"]
          locked_at: string | null
          locked_by: string | null
          pdf_url: string | null
          pdf_url_bilingual: string | null
          pdf_url_en: string | null
          previous_version_id: string | null
          report_type: Database["public"]["Enums"]["report_type"]
          signature_hash: string | null
          status: string | null
          superseded_by: string | null
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
          expired_at?: string | null
          expiry_date?: string | null
          generated_by?: string | null
          id?: string
          is_final?: boolean | null
          is_locked?: boolean | null
          issue_date?: string | null
          language?: Database["public"]["Enums"]["report_language"]
          locked_at?: string | null
          locked_by?: string | null
          pdf_url?: string | null
          pdf_url_bilingual?: string | null
          pdf_url_en?: string | null
          previous_version_id?: string | null
          report_type?: Database["public"]["Enums"]["report_type"]
          signature_hash?: string | null
          status?: string | null
          superseded_by?: string | null
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
          expired_at?: string | null
          expiry_date?: string | null
          generated_by?: string | null
          id?: string
          is_final?: boolean | null
          is_locked?: boolean | null
          issue_date?: string | null
          language?: Database["public"]["Enums"]["report_language"]
          locked_at?: string | null
          locked_by?: string | null
          pdf_url?: string | null
          pdf_url_bilingual?: string | null
          pdf_url_en?: string | null
          previous_version_id?: string | null
          report_type?: Database["public"]["Enums"]["report_type"]
          signature_hash?: string | null
          status?: string | null
          superseded_by?: string | null
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
      request_audit_log: {
        Row: {
          action_type: string
          assignment_id: string | null
          created_at: string
          id: string
          metadata: Json | null
          new_status: string
          old_status: string
          reason: string | null
          request_id: string | null
          user_id: string | null
        }
        Insert: {
          action_type?: string
          assignment_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          new_status: string
          old_status: string
          reason?: string | null
          request_id?: string | null
          user_id?: string | null
        }
        Update: {
          action_type?: string
          assignment_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          new_status?: string
          old_status?: string
          reason?: string | null
          request_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "request_audit_log_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "v_recent_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_audit_log_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "valuation_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_audit_log_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "valuation_requests"
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
      role_change_log: {
        Row: {
          changed_by: string
          created_at: string
          id: string
          new_role: string
          old_role: string | null
          reason: string | null
          user_id: string
        }
        Insert: {
          changed_by: string
          created_at?: string
          id?: string
          new_role: string
          old_role?: string | null
          reason?: string | null
          user_id: string
        }
        Update: {
          changed_by?: string
          created_at?: string
          id?: string
          new_role?: string
          old_role?: string | null
          reason?: string | null
          user_id?: string
        }
        Relationships: []
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
      secure_download_tokens: {
        Row: {
          created_at: string
          download_count: number
          expires_at: string
          file_path: string | null
          id: string
          is_revoked: boolean
          max_downloads: number
          metadata: Json | null
          report_id: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          download_count?: number
          expires_at: string
          file_path?: string | null
          id?: string
          is_revoked?: boolean
          max_downloads?: number
          metadata?: Json | null
          report_id: string
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          download_count?: number
          expires_at?: string
          file_path?: string | null
          id?: string
          is_revoked?: boolean
          max_downloads?: number
          metadata?: Json | null
          report_id?: string
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      security_alerts: {
        Row: {
          alert_type: string
          created_at: string
          description: string | null
          id: string
          is_read: boolean
          metadata: Json | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          title: string
          user_id: string | null
        }
        Insert: {
          alert_type: string
          created_at?: string
          description?: string | null
          id?: string
          is_read?: boolean
          metadata?: Json | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          title: string
          user_id?: string | null
        }
        Update: {
          alert_type?: string
          created_at?: string
          description?: string | null
          id?: string
          is_read?: boolean
          metadata?: Json | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          title?: string
          user_id?: string | null
        }
        Relationships: []
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
      subjects_machinery: {
        Row: {
          asset_category: string
          asset_name_ar: string
          asset_name_en: string | null
          assignment_id: string
          capacity: string | null
          condition: string | null
          condition_score: number | null
          created_at: string
          depreciation_method: string | null
          description_ar: string | null
          description_en: string | null
          id: string
          is_operational: boolean | null
          location_ar: string | null
          location_en: string | null
          manufacturer: string | null
          model: string | null
          notes: string | null
          original_cost: number | null
          photo_urls: string[] | null
          remaining_useful_life: number | null
          replacement_cost: number | null
          serial_number: string | null
          sort_order: number | null
          specifications: Json | null
          total_useful_life: number | null
          updated_at: string
          year_installed: number | null
          year_manufactured: number | null
        }
        Insert: {
          asset_category?: string
          asset_name_ar: string
          asset_name_en?: string | null
          assignment_id: string
          capacity?: string | null
          condition?: string | null
          condition_score?: number | null
          created_at?: string
          depreciation_method?: string | null
          description_ar?: string | null
          description_en?: string | null
          id?: string
          is_operational?: boolean | null
          location_ar?: string | null
          location_en?: string | null
          manufacturer?: string | null
          model?: string | null
          notes?: string | null
          original_cost?: number | null
          photo_urls?: string[] | null
          remaining_useful_life?: number | null
          replacement_cost?: number | null
          serial_number?: string | null
          sort_order?: number | null
          specifications?: Json | null
          total_useful_life?: number | null
          updated_at?: string
          year_installed?: number | null
          year_manufactured?: number | null
        }
        Update: {
          asset_category?: string
          asset_name_ar?: string
          asset_name_en?: string | null
          assignment_id?: string
          capacity?: string | null
          condition?: string | null
          condition_score?: number | null
          created_at?: string
          depreciation_method?: string | null
          description_ar?: string | null
          description_en?: string | null
          id?: string
          is_operational?: boolean | null
          location_ar?: string | null
          location_en?: string | null
          manufacturer?: string | null
          model?: string | null
          notes?: string | null
          original_cost?: number | null
          photo_urls?: string[] | null
          remaining_useful_life?: number | null
          replacement_cost?: number | null
          serial_number?: string | null
          sort_order?: number | null
          specifications?: Json | null
          total_useful_life?: number | null
          updated_at?: string
          year_installed?: number | null
          year_manufactured?: number | null
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      system_events: {
        Row: {
          category: string
          created_at: string
          description: string | null
          event_type: string
          id: string
          metadata: Json | null
          related_entity_id: string | null
          related_entity_type: string | null
          resolved: boolean | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          title: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          title: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          title?: string
        }
        Relationships: []
      }
      system_health_checks: {
        Row: {
          check_type: string
          checked_at: string
          details: Json | null
          id: string
          response_time_ms: number | null
          status: string
        }
        Insert: {
          check_type: string
          checked_at?: string
          details?: Json | null
          id?: string
          response_time_ms?: number | null
          status?: string
        }
        Update: {
          check_type?: string
          checked_at?: string
          details?: Json | null
          id?: string
          response_time_ms?: number | null
          status?: string
        }
        Relationships: []
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
          role?: Database["public"]["Enums"]["app_role"]
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
          actual_inspection_completed_at: string | null
          actual_report_completed_at: string | null
          assigned_inspector_id: string | null
          assigned_reviewer_id: string | null
          assigned_valuer_id: string | null
          assignment_type: string
          basis_of_value: Database["public"]["Enums"]["basis_of_value"]
          client_id: string
          created_at: string
          created_by: string
          deleted_at: string | null
          desktop_evidence_notes: string | null
          engagement_date: string
          fee_amount: number | null
          fee_currency: string | null
          id: string
          intended_use_ar: string | null
          intended_use_en: string | null
          intended_users_ar: string | null
          intended_users_en: string | null
          is_locked: boolean
          is_retrospective: boolean | null
          issue_date: string | null
          locked_at: string | null
          locked_by: string | null
          notes: string | null
          organization_id: string
          previous_assignment_id: string | null
          priority: string | null
          property_type: Database["public"]["Enums"]["property_type"]
          purpose: Database["public"]["Enums"]["valuation_purpose"]
          qr_verification_code: string | null
          reference_number: string
          report_date: string | null
          report_language: Database["public"]["Enums"]["report_language"]
          retrospective_note_ar: string | null
          retrospective_note_en: string | null
          sequential_number: number
          sla_inspection_hours: number | null
          sla_report_hours: number | null
          sla_status: string | null
          sla_total_days: number | null
          status: Database["public"]["Enums"]["assignment_status"]
          updated_at: string
          valuation_date: string | null
          valuation_mode: string
          valuation_type: Database["public"]["Enums"]["valuation_type"]
        }
        Insert: {
          actual_inspection_completed_at?: string | null
          actual_report_completed_at?: string | null
          assigned_inspector_id?: string | null
          assigned_reviewer_id?: string | null
          assigned_valuer_id?: string | null
          assignment_type?: string
          basis_of_value?: Database["public"]["Enums"]["basis_of_value"]
          client_id: string
          created_at?: string
          created_by: string
          deleted_at?: string | null
          desktop_evidence_notes?: string | null
          engagement_date?: string
          fee_amount?: number | null
          fee_currency?: string | null
          id?: string
          intended_use_ar?: string | null
          intended_use_en?: string | null
          intended_users_ar?: string | null
          intended_users_en?: string | null
          is_locked?: boolean
          is_retrospective?: boolean | null
          issue_date?: string | null
          locked_at?: string | null
          locked_by?: string | null
          notes?: string | null
          organization_id: string
          previous_assignment_id?: string | null
          priority?: string | null
          property_type: Database["public"]["Enums"]["property_type"]
          purpose: Database["public"]["Enums"]["valuation_purpose"]
          qr_verification_code?: string | null
          reference_number: string
          report_date?: string | null
          report_language?: Database["public"]["Enums"]["report_language"]
          retrospective_note_ar?: string | null
          retrospective_note_en?: string | null
          sequential_number: number
          sla_inspection_hours?: number | null
          sla_report_hours?: number | null
          sla_status?: string | null
          sla_total_days?: number | null
          status?: Database["public"]["Enums"]["assignment_status"]
          updated_at?: string
          valuation_date?: string | null
          valuation_mode?: string
          valuation_type?: Database["public"]["Enums"]["valuation_type"]
        }
        Update: {
          actual_inspection_completed_at?: string | null
          actual_report_completed_at?: string | null
          assigned_inspector_id?: string | null
          assigned_reviewer_id?: string | null
          assigned_valuer_id?: string | null
          assignment_type?: string
          basis_of_value?: Database["public"]["Enums"]["basis_of_value"]
          client_id?: string
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          desktop_evidence_notes?: string | null
          engagement_date?: string
          fee_amount?: number | null
          fee_currency?: string | null
          id?: string
          intended_use_ar?: string | null
          intended_use_en?: string | null
          intended_users_ar?: string | null
          intended_users_en?: string | null
          is_locked?: boolean
          is_retrospective?: boolean | null
          issue_date?: string | null
          locked_at?: string | null
          locked_by?: string | null
          notes?: string | null
          organization_id?: string
          previous_assignment_id?: string | null
          priority?: string | null
          property_type?: Database["public"]["Enums"]["property_type"]
          purpose?: Database["public"]["Enums"]["valuation_purpose"]
          qr_verification_code?: string | null
          reference_number?: string
          report_date?: string | null
          report_language?: Database["public"]["Enums"]["report_language"]
          retrospective_note_ar?: string | null
          retrospective_note_en?: string | null
          sequential_number?: number
          sla_inspection_hours?: number | null
          sla_report_hours?: number | null
          sla_status?: string | null
          sla_total_days?: number | null
          status?: Database["public"]["Enums"]["assignment_status"]
          updated_at?: string
          valuation_date?: string | null
          valuation_mode?: string
          valuation_type?: Database["public"]["Enums"]["valuation_type"]
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
          asset_data: Json | null
          assignment_id: string | null
          basis_of_value: Database["public"]["Enums"]["basis_of_value"] | null
          building_area: number | null
          client_email: string | null
          client_id: string | null
          client_id_number: string | null
          client_name_ar: string | null
          client_phone: string | null
          client_user_id: string
          completed_at: string | null
          conflict_of_interest_checked: boolean | null
          conflict_of_interest_result: string | null
          created_at: string
          delivered_at: string | null
          desktop_disclaimer_accepted: boolean | null
          discipline: string | null
          draft_report_url: string | null
          fees_breakdown: Json | null
          final_report_url: string | null
          first_payment_amount: number | null
          first_payment_percentage: number | null
          id: string
          inspection_type: string | null
          intended_use_ar: string | null
          intended_use_en: string | null
          intended_user_ar: string | null
          intended_users_ar: string | null
          intended_users_en: string | null
          is_locked: boolean | null
          is_portfolio: boolean | null
          issued_at: string | null
          land_area: number | null
          organization_id: string | null
          payment_mode: string
          payment_status: string | null
          payment_structure: string | null
          portfolio_asset_count: number | null
          portfolio_discount_pct: number | null
          portfolio_scope_ar: string | null
          portfolio_scope_confirmed: boolean | null
          portfolio_scope_en: string | null
          production_started_at: string | null
          professional_judgment: Json | null
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
          purpose_ar: string | null
          quotation_amount: number | null
          quotation_approved_at: string | null
          quotation_currency: string | null
          quotation_notes_ar: string | null
          quotation_notes_en: string | null
          quotation_response_at: string | null
          quotation_sent_at: string | null
          reference_number: string | null
          report_number: string | null
          scope_of_work_ar: string | null
          scope_of_work_en: string | null
          sow_assumptions_ar: string | null
          sow_signed_at: string | null
          sow_special_assumptions_ar: string | null
          status: Database["public"]["Enums"]["request_status"]
          submitted_at: string | null
          terms_ar: string | null
          terms_en: string | null
          total_fees: number | null
          updated_at: string
          valuation_date: string | null
          valuation_mode: string
          valuation_type: Database["public"]["Enums"]["valuation_type"] | null
          value_basis_ar: string | null
          verification_code: string | null
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
          asset_data?: Json | null
          assignment_id?: string | null
          basis_of_value?: Database["public"]["Enums"]["basis_of_value"] | null
          building_area?: number | null
          client_email?: string | null
          client_id?: string | null
          client_id_number?: string | null
          client_name_ar?: string | null
          client_phone?: string | null
          client_user_id: string
          completed_at?: string | null
          conflict_of_interest_checked?: boolean | null
          conflict_of_interest_result?: string | null
          created_at?: string
          delivered_at?: string | null
          desktop_disclaimer_accepted?: boolean | null
          discipline?: string | null
          draft_report_url?: string | null
          fees_breakdown?: Json | null
          final_report_url?: string | null
          first_payment_amount?: number | null
          first_payment_percentage?: number | null
          id?: string
          inspection_type?: string | null
          intended_use_ar?: string | null
          intended_use_en?: string | null
          intended_user_ar?: string | null
          intended_users_ar?: string | null
          intended_users_en?: string | null
          is_locked?: boolean | null
          is_portfolio?: boolean | null
          issued_at?: string | null
          land_area?: number | null
          organization_id?: string | null
          payment_mode?: string
          payment_status?: string | null
          payment_structure?: string | null
          portfolio_asset_count?: number | null
          portfolio_discount_pct?: number | null
          portfolio_scope_ar?: string | null
          portfolio_scope_confirmed?: boolean | null
          portfolio_scope_en?: string | null
          production_started_at?: string | null
          professional_judgment?: Json | null
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
          purpose_ar?: string | null
          quotation_amount?: number | null
          quotation_approved_at?: string | null
          quotation_currency?: string | null
          quotation_notes_ar?: string | null
          quotation_notes_en?: string | null
          quotation_response_at?: string | null
          quotation_sent_at?: string | null
          reference_number?: string | null
          report_number?: string | null
          scope_of_work_ar?: string | null
          scope_of_work_en?: string | null
          sow_assumptions_ar?: string | null
          sow_signed_at?: string | null
          sow_special_assumptions_ar?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          submitted_at?: string | null
          terms_ar?: string | null
          terms_en?: string | null
          total_fees?: number | null
          updated_at?: string
          valuation_date?: string | null
          valuation_mode?: string
          valuation_type?: Database["public"]["Enums"]["valuation_type"] | null
          value_basis_ar?: string | null
          verification_code?: string | null
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
          asset_data?: Json | null
          assignment_id?: string | null
          basis_of_value?: Database["public"]["Enums"]["basis_of_value"] | null
          building_area?: number | null
          client_email?: string | null
          client_id?: string | null
          client_id_number?: string | null
          client_name_ar?: string | null
          client_phone?: string | null
          client_user_id?: string
          completed_at?: string | null
          conflict_of_interest_checked?: boolean | null
          conflict_of_interest_result?: string | null
          created_at?: string
          delivered_at?: string | null
          desktop_disclaimer_accepted?: boolean | null
          discipline?: string | null
          draft_report_url?: string | null
          fees_breakdown?: Json | null
          final_report_url?: string | null
          first_payment_amount?: number | null
          first_payment_percentage?: number | null
          id?: string
          inspection_type?: string | null
          intended_use_ar?: string | null
          intended_use_en?: string | null
          intended_user_ar?: string | null
          intended_users_ar?: string | null
          intended_users_en?: string | null
          is_locked?: boolean | null
          is_portfolio?: boolean | null
          issued_at?: string | null
          land_area?: number | null
          organization_id?: string | null
          payment_mode?: string
          payment_status?: string | null
          payment_structure?: string | null
          portfolio_asset_count?: number | null
          portfolio_discount_pct?: number | null
          portfolio_scope_ar?: string | null
          portfolio_scope_confirmed?: boolean | null
          portfolio_scope_en?: string | null
          production_started_at?: string | null
          professional_judgment?: Json | null
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
          purpose_ar?: string | null
          quotation_amount?: number | null
          quotation_approved_at?: string | null
          quotation_currency?: string | null
          quotation_notes_ar?: string | null
          quotation_notes_en?: string | null
          quotation_response_at?: string | null
          quotation_sent_at?: string | null
          reference_number?: string | null
          report_number?: string | null
          scope_of_work_ar?: string | null
          scope_of_work_en?: string | null
          sow_assumptions_ar?: string | null
          sow_signed_at?: string | null
          sow_special_assumptions_ar?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          submitted_at?: string | null
          terms_ar?: string | null
          terms_en?: string | null
          total_fees?: number | null
          updated_at?: string
          valuation_date?: string | null
          valuation_mode?: string
          valuation_type?: Database["public"]["Enums"]["valuation_type"] | null
          value_basis_ar?: string | null
          verification_code?: string | null
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
            foreignKeyName: "valuation_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
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
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      find_duplicate_clients: {
        Args: { _org_id: string }
        Returns: {
          client_id_1: string
          client_id_2: string
          match_field: string
          match_value: string
        }[]
      }
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
      link_portal_user_to_client: {
        Args: {
          _email?: string
          _name_ar?: string
          _org_id?: string
          _phone?: string
          _user_id: string
        }
        Returns: string
      }
      match_client_record: {
        Args: {
          _cr_number?: string
          _email?: string
          _name_ar?: string
          _org_id?: string
          _phone?: string
        }
        Returns: string
      }
      match_client_with_confidence: {
        Args: {
          _cr_number?: string
          _email?: string
          _name_ar?: string
          _org_id?: string
          _phone?: string
        }
        Returns: {
          confidence: number
          match_field: string
          matched_id: string
        }[]
      }
      merge_client_records:
        | { Args: { _source_id: string; _target_id: string }; Returns: boolean }
        | {
            Args: {
              _merged_by?: string
              _reason?: string
              _source_id: string
              _target_id: string
            }
            Returns: boolean
          }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      update_request_status: {
        Args: {
          _action_type?: string
          _assignment_id: string
          _bypass_justification?: string
          _new_status: string
          _reason?: string
          _user_id?: string
        }
        Returns: Json
      }
      validate_discount_code: {
        Args: {
          _client_id?: string
          _code: string
          _order_amount?: number
          _service_type?: string
        }
        Returns: {
          calculated_discount: number
          discount_id: string
          discount_type: string
          discount_value: number
          is_valid: boolean
          rejection_reason: string
        }[]
      }
      validate_download_token: {
        Args: { _token: string }
        Returns: {
          file_path: string
          is_valid: boolean
          rejection_reason: string
          report_id: string
          user_id: string
        }[]
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
        | "owner"
        | "financial_manager"
        | "admin_coordinator"
        | "inspector"
        | "client"
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
        | "submitted"
        | "scope_generated"
        | "scope_approved"
        | "first_payment_confirmed"
        | "data_collection_complete"
        | "data_validated"
        | "inspection_pending"
        | "inspection_completed"
        | "analysis_complete"
        | "professional_review"
        | "client_review"
        | "draft_approved"
        | "final_payment_confirmed"
        | "data_collection_open"
      assignment_type: "new" | "revaluation"
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
        | "upload"
        | "merge"
        | "link"
        | "generate"
        | "override"
        | "payment_confirm_blocked"
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
        | "sow_generated"
        | "sow_sent"
        | "sow_approved"
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
      valuation_type: "real_estate" | "machinery" | "mixed"
      watchdog_category:
        | "technical"
        | "security"
        | "workflow"
        | "legal"
        | "financial"
        | "user_behavior"
        | "performance"
      watchdog_finding_status:
        | "open"
        | "acknowledged"
        | "resolved"
        | "ignored"
        | "escalated"
      watchdog_severity: "critical" | "high" | "medium" | "low" | "info"
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
        "owner",
        "financial_manager",
        "admin_coordinator",
        "inspector",
        "client",
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
        "submitted",
        "scope_generated",
        "scope_approved",
        "first_payment_confirmed",
        "data_collection_complete",
        "data_validated",
        "inspection_pending",
        "inspection_completed",
        "analysis_complete",
        "professional_review",
        "client_review",
        "draft_approved",
        "final_payment_confirmed",
        "data_collection_open",
      ],
      assignment_type: ["new", "revaluation"],
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
        "upload",
        "merge",
        "link",
        "generate",
        "override",
        "payment_confirm_blocked",
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
        "sow_generated",
        "sow_sent",
        "sow_approved",
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
      valuation_type: ["real_estate", "machinery", "mixed"],
      watchdog_category: [
        "technical",
        "security",
        "workflow",
        "legal",
        "financial",
        "user_behavior",
        "performance",
      ],
      watchdog_finding_status: [
        "open",
        "acknowledged",
        "resolved",
        "ignored",
        "escalated",
      ],
      watchdog_severity: ["critical", "high", "medium", "low", "info"],
    },
  },
} as const
