
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "admins": {
                  Row: {
                    "user_id": string
                  }
                  Insert: {
                    "user_id": string
                  }
                  Update: {
                    "user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"customers": {
                  Row: {
                    "created_at": string,"first_name": string,"id": string,"last_activity_at": string,"last_name": string,"marketing_consent_until": string | null,"merged_into_id": string | null,"phone_e164": string | null
                  }
                  Insert: {
                    "created_at"?: string,"first_name": string,"id"?: string,"last_activity_at"?: string,"last_name": string,"marketing_consent_until"?: string | null,"merged_into_id"?: string | null,"phone_e164"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"first_name"?: string,"id"?: string,"last_activity_at"?: string,"last_name"?: string,"marketing_consent_until"?: string | null,"merged_into_id"?: string | null,"phone_e164"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "customers_merged_into_id_fkey"
      columns: ["merged_into_id"]
isOneToOne: false
      referencedRelation: "customer_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "customers_merged_into_id_fkey"
      columns: ["merged_into_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "customers_merged_into_id_fkey"
      columns: ["merged_into_id"]
isOneToOne: false
      referencedRelation: "duplicate_candidates"
      referencedColumns: ["a_id"]
    },{
      foreignKeyName: "customers_merged_into_id_fkey"
      columns: ["merged_into_id"]
isOneToOne: false
      referencedRelation: "duplicate_candidates"
      referencedColumns: ["b_id"]
    }
                  ]
                },"events": {
                  Row: {
                    "coupon_description": string,"coupon_title": string,"created_at": string,"ends_at": string,"id": string,"slug": string,"staff_pin_hash": string | null,"staff_token": string,"starts_at": string,"status": string,"title": string,"venue_name": string
                  }
                  Insert: {
                    "coupon_description"?: string,"coupon_title": string,"created_at"?: string,"ends_at": string,"id"?: string,"slug": string,"staff_pin_hash"?: string | null,"staff_token"?: string,"starts_at": string,"status"?: string,"title": string,"venue_name": string
                  }
                  Update: {
                    "coupon_description"?: string,"coupon_title"?: string,"created_at"?: string,"ends_at"?: string,"id"?: string,"slug"?: string,"staff_pin_hash"?: string | null,"staff_token"?: string,"starts_at"?: string,"status"?: string,"title"?: string,"venue_name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"pin_attempts": {
                  Row: {
                    "failed_count": number,"key": string,"locked_until": string | null,"scope": string
                  }
                  Insert: {
                    "failed_count"?: number,"key": string,"locked_until"?: string | null,"scope": string
                  }
                  Update: {
                    "failed_count"?: number,"key"?: string,"locked_until"?: string | null,"scope"?: string
                  }
                  Relationships: [
                    
                  ]
                },"registrations": {
                  Row: {
                    "consent_coupon_at": string,"consent_marketing": boolean,"consent_privacy_at": string,"coupon_code": string,"coupon_token": string,"created_at": string,"customer_id": string,"device_id": string | null,"event_id": string,"id": string,"ip_hash": string | null,"privacy_version": string,"redeemed_at": string | null
                  }
                  Insert: {
                    "consent_coupon_at": string,"consent_marketing": boolean,"consent_privacy_at": string,"coupon_code": string,"coupon_token"?: string,"created_at"?: string,"customer_id": string,"device_id"?: string | null,"event_id": string,"id"?: string,"ip_hash"?: string | null,"privacy_version": string,"redeemed_at"?: string | null
                  }
                  Update: {
                    "consent_coupon_at"?: string,"consent_marketing"?: boolean,"consent_privacy_at"?: string,"coupon_code"?: string,"coupon_token"?: string,"created_at"?: string,"customer_id"?: string,"device_id"?: string | null,"event_id"?: string,"id"?: string,"ip_hash"?: string | null,"privacy_version"?: string,"redeemed_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "registrations_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "customer_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "registrations_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "registrations_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "duplicate_candidates"
      referencedColumns: ["a_id"]
    },{
      foreignKeyName: "registrations_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "duplicate_candidates"
      referencedColumns: ["b_id"]
    },{
      foreignKeyName: "registrations_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "event_stats"
      referencedColumns: ["event_id"]
    },{
      foreignKeyName: "registrations_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "customer_overview": {
                  Row: {
                    "created_at": string | null,"events_count": number | null,"first_name": string | null,"id": string | null,"last_activity_at": string | null,"last_name": string | null,"marketing_consent_until": string | null,"phone_e164": string | null,"redeemed_count": number | null
                  }
                  Relationships: [
                    
                  ]
                },"duplicate_candidates": {
                  Row: {
                    "a_created_at": string | null,"a_first_name": string | null,"a_id": string | null,"a_last_name": string | null,"a_phone": string | null,"b_created_at": string | null,"b_first_name": string | null,"b_id": string | null,"b_last_name": string | null,"b_phone": string | null
                  }
                  Relationships: [
                    
                  ]
                },"event_stats": {
                  Row: {
                    "event_id": string | null,"redeemed": number | null,"registrations": number | null
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "admin_set_event_pin":
{ Args: { "p_event_id": string,"p_pin": string }; Returns: undefined
                           },
"check_pin":
{ Args: { "p_key": string,"p_pin": string,"p_pin_hash": string,"p_scope": string }; Returns: string
                           },
"gen_code":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"gen_token":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"merge_customers":
{ Args: { "p_drop_id": string,"p_keep_id": string }; Returns: undefined
                           },
"purge_inactive_customers":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"redeem_event_coupon":
{ Args: { "p_code": string,"p_session_key": string,"p_staff_token": string }; Returns: Json
                           },
"register_for_event":
{ Args: { "p_consent_coupon": boolean,"p_consent_marketing": boolean,"p_consent_privacy": boolean,"p_device_id"?: string,"p_first_name": string,"p_ip_hash"?: string,"p_last_name": string,"p_phone_e164"?: string,"p_privacy_version": string,"p_slug": string }; Returns: Json
                           },
"verify_event_pin":
{ Args: { "p_pin": string,"p_staff_token": string }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const

