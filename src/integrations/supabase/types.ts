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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      analyses: {
        Row: {
          address: string | null
          ai_answer: Json | null
          ai_summary: string | null
          analyzed_at: string | null
          area_size: number | null
          building_coverage_ratio: number | null
          canton: string | null
          client_name: string | null
          created_at: string
          created_by: string | null
          design_plan_required: boolean | null
          detected_zone: string | null
          development_potential: Json | null
          document_name: string | null
          document_path: string | null
          egrid: string | null
          error_message: string | null
          extracted_data: Json | null
          feasibility: string | null
          floor_area: number | null
          heritage_protected: boolean | null
          id: string
          lat: number | null
          living_area: number | null
          lng: number | null
          max_floors: number | null
          max_height: number | null
          municipality: string | null
          noise_zone: string | null
          organization_id: string
          parcel_geometry: Json | null
          parcel_number: string | null
          postal_code: string | null
          potential_level: Database["public"]["Enums"]["potential_level"] | null
          project_id: string | null
          project_manager: string | null
          project_number: string | null
          restrictions: Json | null
          risks: Json | null
          setbacks: Json | null
          special_provisions: string | null
          status: Database["public"]["Enums"]["analysis_status"]
          unit_count: number | null
          updated_at: string
          usage_type: Json | null
          utilization_ratio: number | null
          water_setbacks: string | null
          zone: string | null
          zone_override: string | null
        }
        Insert: {
          address?: string | null
          ai_answer?: Json | null
          ai_summary?: string | null
          analyzed_at?: string | null
          area_size?: number | null
          building_coverage_ratio?: number | null
          canton?: string | null
          client_name?: string | null
          created_at?: string
          created_by?: string | null
          design_plan_required?: boolean | null
          detected_zone?: string | null
          development_potential?: Json | null
          document_name?: string | null
          document_path?: string | null
          egrid?: string | null
          error_message?: string | null
          extracted_data?: Json | null
          feasibility?: string | null
          floor_area?: number | null
          heritage_protected?: boolean | null
          id?: string
          lat?: number | null
          living_area?: number | null
          lng?: number | null
          max_floors?: number | null
          max_height?: number | null
          municipality?: string | null
          noise_zone?: string | null
          organization_id: string
          parcel_geometry?: Json | null
          parcel_number?: string | null
          postal_code?: string | null
          potential_level?:
            | Database["public"]["Enums"]["potential_level"]
            | null
          project_id?: string | null
          project_manager?: string | null
          project_number?: string | null
          restrictions?: Json | null
          risks?: Json | null
          setbacks?: Json | null
          special_provisions?: string | null
          status?: Database["public"]["Enums"]["analysis_status"]
          unit_count?: number | null
          updated_at?: string
          usage_type?: Json | null
          utilization_ratio?: number | null
          water_setbacks?: string | null
          zone?: string | null
          zone_override?: string | null
        }
        Update: {
          address?: string | null
          ai_answer?: Json | null
          ai_summary?: string | null
          analyzed_at?: string | null
          area_size?: number | null
          building_coverage_ratio?: number | null
          canton?: string | null
          client_name?: string | null
          created_at?: string
          created_by?: string | null
          design_plan_required?: boolean | null
          detected_zone?: string | null
          development_potential?: Json | null
          document_name?: string | null
          document_path?: string | null
          egrid?: string | null
          error_message?: string | null
          extracted_data?: Json | null
          feasibility?: string | null
          floor_area?: number | null
          heritage_protected?: boolean | null
          id?: string
          lat?: number | null
          living_area?: number | null
          lng?: number | null
          max_floors?: number | null
          max_height?: number | null
          municipality?: string | null
          noise_zone?: string | null
          organization_id?: string
          parcel_geometry?: Json | null
          parcel_number?: string | null
          postal_code?: string | null
          potential_level?:
            | Database["public"]["Enums"]["potential_level"]
            | null
          project_id?: string | null
          project_manager?: string | null
          project_number?: string | null
          restrictions?: Json | null
          risks?: Json | null
          setbacks?: Json | null
          special_provisions?: string | null
          status?: Database["public"]["Enums"]["analysis_status"]
          unit_count?: number | null
          updated_at?: string
          usage_type?: Json | null
          utilization_ratio?: number | null
          water_setbacks?: string | null
          zone?: string | null
          zone_override?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analyses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analyses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      analysis_documents: {
        Row: {
          analysis_id: string
          created_at: string
          file_name: string
          id: string
          kind: Database["public"]["Enums"]["analysis_document_kind"]
          mime_type: string | null
          organization_id: string
          size_bytes: number | null
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          analysis_id: string
          created_at?: string
          file_name: string
          id?: string
          kind?: Database["public"]["Enums"]["analysis_document_kind"]
          mime_type?: string | null
          organization_id: string
          size_bytes?: number | null
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          analysis_id?: string
          created_at?: string
          file_name?: string
          id?: string
          kind?: Database["public"]["Enums"]["analysis_document_kind"]
          mime_type?: string | null
          organization_id?: string
          size_bytes?: number | null
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analysis_documents_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analyses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analysis_documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      analysis_easements: {
        Row: {
          ai_confidence: string | null
          amount_chf: number | null
          analysis_id: string
          beneficiary: string | null
          burdened_parcel: string | null
          created_at: string
          created_by: string | null
          description: string | null
          easement_type: string
          established_date: string | null
          id: string
          legal_basis: string | null
          notes: string | null
          organization_id: string
          rank: number | null
          reg_nr: string | null
          source: string
          source_document_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          ai_confidence?: string | null
          amount_chf?: number | null
          analysis_id: string
          beneficiary?: string | null
          burdened_parcel?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          easement_type?: string
          established_date?: string | null
          id?: string
          legal_basis?: string | null
          notes?: string | null
          organization_id: string
          rank?: number | null
          reg_nr?: string | null
          source?: string
          source_document_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          ai_confidence?: string | null
          amount_chf?: number | null
          analysis_id?: string
          beneficiary?: string | null
          burdened_parcel?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          easement_type?: string
          established_date?: string | null
          id?: string
          legal_basis?: string | null
          notes?: string | null
          organization_id?: string
          rank?: number | null
          reg_nr?: string | null
          source?: string
          source_document_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "analysis_easements_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analyses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analysis_easements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analysis_easements_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: false
            referencedRelation: "analysis_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      analysis_floors: {
        Row: {
          analysis_id: string
          created_at: string
          floor_height_m: number
          floor_index: number
          floor_label: string
          gross_area_m2: number | null
          id: string
          organization_id: string
          volume_m3: number | null
        }
        Insert: {
          analysis_id: string
          created_at?: string
          floor_height_m?: number
          floor_index: number
          floor_label: string
          gross_area_m2?: number | null
          id?: string
          organization_id: string
          volume_m3?: number | null
        }
        Update: {
          analysis_id?: string
          created_at?: string
          floor_height_m?: number
          floor_index?: number
          floor_label?: string
          gross_area_m2?: number | null
          id?: string
          organization_id?: string
          volume_m3?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "analysis_floors_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analyses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analysis_floors_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      analysis_results: {
        Row: {
          ai_answer: Json | null
          analysis_id: string
          created_at: string
          created_by: string | null
          extracted_data: Json | null
          id: string
          model: string | null
          opportunities: Json
          organization_id: string
          parcel_snapshot: Json | null
          potential_category: string | null
          potential_score: number | null
          recommendation: string | null
          risks: Json
          summary: string | null
          unit_calculation: Json | null
          updated_at: string
          version: number
        }
        Insert: {
          ai_answer?: Json | null
          analysis_id: string
          created_at?: string
          created_by?: string | null
          extracted_data?: Json | null
          id?: string
          model?: string | null
          opportunities?: Json
          organization_id: string
          parcel_snapshot?: Json | null
          potential_category?: string | null
          potential_score?: number | null
          recommendation?: string | null
          risks?: Json
          summary?: string | null
          unit_calculation?: Json | null
          updated_at?: string
          version?: number
        }
        Update: {
          ai_answer?: Json | null
          analysis_id?: string
          created_at?: string
          created_by?: string | null
          extracted_data?: Json | null
          id?: string
          model?: string | null
          opportunities?: Json
          organization_id?: string
          parcel_snapshot?: Json | null
          potential_category?: string | null
          potential_score?: number | null
          recommendation?: string | null
          risks?: Json
          summary?: string | null
          unit_calculation?: Json | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "analysis_results_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analyses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analysis_results_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      analysis_scenarios: {
        Row: {
          ai_answer: Json | null
          ai_summary: string | null
          analysis_id: string
          building_coverage_ratio: number | null
          commercial_area: number | null
          created_at: string
          created_by: string | null
          error_message: string | null
          feasibility: string | null
          floor_area: number | null
          id: string
          label: string
          living_area: number | null
          max_floors: number | null
          max_height: number | null
          organization_id: string
          potential_level: Database["public"]["Enums"]["potential_level"] | null
          risks: Json | null
          status: Database["public"]["Enums"]["analysis_status"]
          unit_count: number | null
          updated_at: string
          usage_assumption: string
          usage_types: Json | null
          utilization_ratio: number | null
          zone: string | null
        }
        Insert: {
          ai_answer?: Json | null
          ai_summary?: string | null
          analysis_id: string
          building_coverage_ratio?: number | null
          commercial_area?: number | null
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          feasibility?: string | null
          floor_area?: number | null
          id?: string
          label: string
          living_area?: number | null
          max_floors?: number | null
          max_height?: number | null
          organization_id: string
          potential_level?:
            | Database["public"]["Enums"]["potential_level"]
            | null
          risks?: Json | null
          status?: Database["public"]["Enums"]["analysis_status"]
          unit_count?: number | null
          updated_at?: string
          usage_assumption: string
          usage_types?: Json | null
          utilization_ratio?: number | null
          zone?: string | null
        }
        Update: {
          ai_answer?: Json | null
          ai_summary?: string | null
          analysis_id?: string
          building_coverage_ratio?: number | null
          commercial_area?: number | null
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          feasibility?: string | null
          floor_area?: number | null
          id?: string
          label?: string
          living_area?: number | null
          max_floors?: number | null
          max_height?: number | null
          organization_id?: string
          potential_level?:
            | Database["public"]["Enums"]["potential_level"]
            | null
          risks?: Json | null
          status?: Database["public"]["Enums"]["analysis_status"]
          unit_count?: number | null
          updated_at?: string
          usage_assumption?: string
          usage_types?: Json | null
          utilization_ratio?: number | null
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analysis_scenarios_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analyses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analysis_scenarios_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      analysis_units: {
        Row: {
          analysis_id: string
          area_m2: number
          created_at: string
          floor_index: number
          id: string
          organization_id: string
          unit_label: string
          unit_type: string
        }
        Insert: {
          analysis_id: string
          area_m2: number
          created_at?: string
          floor_index: number
          id?: string
          organization_id: string
          unit_label: string
          unit_type: string
        }
        Update: {
          analysis_id?: string
          area_m2?: number
          created_at?: string
          floor_index?: number
          id?: string
          organization_id?: string
          unit_label?: string
          unit_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "analysis_units_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analyses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analysis_units_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      background_jobs: {
        Row: {
          created_at: string
          created_by: string | null
          current_label: string | null
          done: number
          errors: Json
          failed: number
          finished_at: string | null
          id: string
          job_type: string
          last_error: string | null
          ok: number
          scope: Json
          started_at: string | null
          status: string
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          current_label?: string | null
          done?: number
          errors?: Json
          failed?: number
          finished_at?: string | null
          id?: string
          job_type: string
          last_error?: string | null
          ok?: number
          scope?: Json
          started_at?: string | null
          status?: string
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          current_label?: string | null
          done?: number
          errors?: Json
          failed?: number
          finished_at?: string | null
          id?: string
          job_type?: string
          last_error?: string | null
          ok?: number
          scope?: Json
          started_at?: string | null
          status?: string
          total?: number
          updated_at?: string
        }
        Relationships: []
      }
      cantons: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      feedback: {
        Row: {
          category: Database["public"]["Enums"]["feedback_category"]
          created_at: string
          description: string
          id: string
          organization_id: string | null
          page_url: string | null
          priority: Database["public"]["Enums"]["feedback_priority"]
          screenshot_path: string | null
          status: Database["public"]["Enums"]["feedback_status"]
          title: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["feedback_category"]
          created_at?: string
          description: string
          id?: string
          organization_id?: string | null
          page_url?: string | null
          priority?: Database["public"]["Enums"]["feedback_priority"]
          screenshot_path?: string | null
          status?: Database["public"]["Enums"]["feedback_status"]
          title: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["feedback_category"]
          created_at?: string
          description?: string
          id?: string
          organization_id?: string | null
          page_url?: string | null
          priority?: Database["public"]["Enums"]["feedback_priority"]
          screenshot_path?: string | null
          status?: Database["public"]["Enums"]["feedback_status"]
          title?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_comments: {
        Row: {
          body: string
          created_at: string
          feedback_id: string
          id: string
          is_admin: boolean
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          feedback_id: string
          id?: string
          is_admin?: boolean
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          feedback_id?: string
          id?: string
          is_admin?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_comments_feedback_id_fkey"
            columns: ["feedback_id"]
            isOneToOne: false
            referencedRelation: "feedback"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_entries: {
        Row: {
          category: string
          created_at: string
          id: string
          key: string
          municipality_id: string
          source_article: string | null
          source_document: string | null
          updated_at: string
          value: string | null
          verified: boolean
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          key: string
          municipality_id: string
          source_article?: string | null
          source_document?: string | null
          updated_at?: string
          value?: string | null
          verified?: boolean
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          key?: string
          municipality_id?: string
          source_article?: string | null
          source_document?: string | null
          updated_at?: string
          value?: string | null
          verified?: boolean
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_entries_municipality_id_fkey"
            columns: ["municipality_id"]
            isOneToOne: false
            referencedRelation: "municipalities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_entries_source_document_fkey"
            columns: ["source_document"]
            isOneToOne: false
            referencedRelation: "regulation_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      municipalities: {
        Row: {
          active: boolean
          bfs_number: number | null
          canton_id: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          bfs_number?: number | null
          canton_id: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          bfs_number?: number | null
          canton_id?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "municipalities_canton_id_fkey"
            columns: ["canton_id"]
            isOneToOne: false
            referencedRelation: "cantons"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          country: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          postal_code: string | null
          slug: string
          updated_at: string
          vat_number: string | null
          website: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          postal_code?: string | null
          slug: string
          updated_at?: string
          vat_number?: string | null
          website?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          postal_code?: string | null
          slug?: string
          updated_at?: string
          vat_number?: string | null
          website?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          first_name: string | null
          id: string
          last_name: string | null
          organization_id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          first_name?: string | null
          id: string
          last_name?: string | null
          organization_id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          organization_id?: string
          updated_at?: string
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
      projects: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          organization_id: string
          status: Database["public"]["Enums"]["project_status"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          organization_id: string
          status?: Database["public"]["Enums"]["project_status"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          organization_id?: string
          status?: Database["public"]["Enums"]["project_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      regulation_documents: {
        Row: {
          active: boolean
          created_at: string
          doc_type: Database["public"]["Enums"]["regulation_doc_type"]
          file_name: string | null
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          municipality_id: string
          notes: string | null
          title: string
          updated_at: string
          uploaded_by: string | null
          valid_from: string | null
          version: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          doc_type: Database["public"]["Enums"]["regulation_doc_type"]
          file_name?: string | null
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          municipality_id: string
          notes?: string | null
          title: string
          updated_at?: string
          uploaded_by?: string | null
          valid_from?: string | null
          version?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          doc_type?: Database["public"]["Enums"]["regulation_doc_type"]
          file_name?: string | null
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          municipality_id?: string
          notes?: string | null
          title?: string
          updated_at?: string
          uploaded_by?: string | null
          valid_from?: string | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "regulation_documents_municipality_id_fkey"
            columns: ["municipality_id"]
            isOneToOne: false
            referencedRelation: "municipalities"
            referencedColumns: ["id"]
          },
        ]
      }
      regulation_extractions: {
        Row: {
          building_coverage_ratio: number | null
          commercial_zones: Json
          created_at: string
          design_plan_required: boolean | null
          document_id: string
          error_message: string | null
          heritage_protected: boolean | null
          id: string
          max_floors: number | null
          max_height_m: number | null
          mixed_zones: Json
          noise_provisions: string | null
          processed_at: string | null
          raw_extraction: Json | null
          residential_zones: Json
          setbacks: Json | null
          special_provisions: string | null
          status: Database["public"]["Enums"]["extraction_status"]
          updated_at: string
          utilization_ratio: number | null
          water_protection: string | null
          zones: Json
        }
        Insert: {
          building_coverage_ratio?: number | null
          commercial_zones?: Json
          created_at?: string
          design_plan_required?: boolean | null
          document_id: string
          error_message?: string | null
          heritage_protected?: boolean | null
          id?: string
          max_floors?: number | null
          max_height_m?: number | null
          mixed_zones?: Json
          noise_provisions?: string | null
          processed_at?: string | null
          raw_extraction?: Json | null
          residential_zones?: Json
          setbacks?: Json | null
          special_provisions?: string | null
          status?: Database["public"]["Enums"]["extraction_status"]
          updated_at?: string
          utilization_ratio?: number | null
          water_protection?: string | null
          zones?: Json
        }
        Update: {
          building_coverage_ratio?: number | null
          commercial_zones?: Json
          created_at?: string
          design_plan_required?: boolean | null
          document_id?: string
          error_message?: string | null
          heritage_protected?: boolean | null
          id?: string
          max_floors?: number | null
          max_height_m?: number | null
          mixed_zones?: Json
          noise_provisions?: string | null
          processed_at?: string | null
          raw_extraction?: Json | null
          residential_zones?: Json
          setbacks?: Json | null
          special_provisions?: string | null
          status?: Database["public"]["Enums"]["extraction_status"]
          updated_at?: string
          utilization_ratio?: number | null
          water_protection?: string | null
          zones?: Json
        }
        Relationships: [
          {
            foreignKeyName: "regulation_extractions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: true
            referencedRelation: "regulation_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      regulation_rules: {
        Row: {
          article_reference: string | null
          created_at: string
          description: string | null
          id: string
          municipality_id: string
          rule_type: string
          source_document: string | null
          title: string
          updated_at: string
          verified: boolean
          verified_at: string | null
          verified_by: string | null
          zone: string | null
        }
        Insert: {
          article_reference?: string | null
          created_at?: string
          description?: string | null
          id?: string
          municipality_id: string
          rule_type: string
          source_document?: string | null
          title: string
          updated_at?: string
          verified?: boolean
          verified_at?: string | null
          verified_by?: string | null
          zone?: string | null
        }
        Update: {
          article_reference?: string | null
          created_at?: string
          description?: string | null
          id?: string
          municipality_id?: string
          rule_type?: string
          source_document?: string | null
          title?: string
          updated_at?: string
          verified?: boolean
          verified_at?: string | null
          verified_by?: string | null
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "regulation_rules_municipality_id_fkey"
            columns: ["municipality_id"]
            isOneToOne: false
            referencedRelation: "municipalities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regulation_rules_source_document_fkey"
            columns: ["source_document"]
            isOneToOne: false
            referencedRelation: "regulation_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          analysis_id: string
          created_at: string
          created_by: string | null
          id: string
          report_url: string
        }
        Insert: {
          analysis_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          report_url: string
        }
        Update: {
          analysis_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          report_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          organization_id: string
          plan: Database["public"]["Enums"]["subscription_plan"]
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          organization_id: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          organization_id?: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_org: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _org_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_platform_admin: { Args: { _user_id: string }; Returns: boolean }
      tick_lu_fill_job: { Args: never; Returns: undefined }
    }
    Enums: {
      analysis_document_kind:
        | "bzr"
        | "bzo"
        | "zonenplan"
        | "other"
        | "grundriss"
        | "schnitt"
        | "situation"
        | "umgebung"
        | "fassade"
        | "grundbuchauszug"
      analysis_status:
        | "pending"
        | "processing"
        | "completed"
        | "failed"
        | "draft"
      app_role: "admin" | "owner" | "member" | "platform_admin"
      extraction_status: "pending" | "processing" | "completed" | "failed"
      feedback_category: "bug" | "feature" | "question" | "other"
      feedback_priority: "low" | "medium" | "high" | "urgent"
      feedback_status:
        | "open"
        | "in_review"
        | "in_progress"
        | "resolved"
        | "closed"
        | "wont_fix"
      potential_level: "low" | "medium" | "high" | "very_high"
      project_status: "draft" | "active" | "completed" | "archived"
      regulation_doc_type:
        | "BZR"
        | "BZO"
        | "Zonenplan"
        | "Gestaltungsplan"
        | "Sondervorschriften"
        | "Sonstige"
      subscription_plan: "trial" | "starter" | "pro" | "enterprise"
      subscription_status:
        | "trialing"
        | "active"
        | "past_due"
        | "canceled"
        | "incomplete"
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
      analysis_document_kind: [
        "bzr",
        "bzo",
        "zonenplan",
        "other",
        "grundriss",
        "schnitt",
        "situation",
        "umgebung",
        "fassade",
        "grundbuchauszug",
      ],
      analysis_status: [
        "pending",
        "processing",
        "completed",
        "failed",
        "draft",
      ],
      app_role: ["admin", "owner", "member", "platform_admin"],
      extraction_status: ["pending", "processing", "completed", "failed"],
      feedback_category: ["bug", "feature", "question", "other"],
      feedback_priority: ["low", "medium", "high", "urgent"],
      feedback_status: [
        "open",
        "in_review",
        "in_progress",
        "resolved",
        "closed",
        "wont_fix",
      ],
      potential_level: ["low", "medium", "high", "very_high"],
      project_status: ["draft", "active", "completed", "archived"],
      regulation_doc_type: [
        "BZR",
        "BZO",
        "Zonenplan",
        "Gestaltungsplan",
        "Sondervorschriften",
        "Sonstige",
      ],
      subscription_plan: ["trial", "starter", "pro", "enterprise"],
      subscription_status: [
        "trialing",
        "active",
        "past_due",
        "canceled",
        "incomplete",
      ],
    },
  },
} as const
