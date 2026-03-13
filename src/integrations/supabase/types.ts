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
      bot_responses: {
        Row: {
          id: string
          include_menu_link: boolean | null
          is_active: boolean | null
          response_text: string
          sort_order: number | null
          trigger_key: string
          trigger_label: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          include_menu_link?: boolean | null
          is_active?: boolean | null
          response_text?: string
          sort_order?: number | null
          trigger_key: string
          trigger_label: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          include_menu_link?: boolean | null
          is_active?: boolean | null
          response_text?: string
          sort_order?: number | null
          trigger_key?: string
          trigger_label?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          slug: string
          sort_order: number | null
        }
        Insert: {
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          slug: string
          sort_order?: number | null
        }
        Update: {
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          slug?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          created_at: string | null
          id: string
          last_order_at: string | null
          name: string
          phone: string
          total_orders: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_order_at?: string | null
          name: string
          phone: string
          total_orders?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          last_order_at?: string | null
          name?: string
          phone?: string
          total_orders?: number | null
        }
        Relationships: []
      }
      delivery_fees: {
        Row: {
          fee: number
          id: string
          max_km: number
          sort_order: number | null
        }
        Insert: {
          fee: number
          id?: string
          max_km: number
          sort_order?: number | null
        }
        Update: {
          fee?: number
          id?: string
          max_km?: number
          sort_order?: number | null
        }
        Relationships: []
      }
      delivery_persons: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          phone: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          phone: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          phone?: string
        }
        Relationships: []
      }
      delivery_regions: {
        Row: {
          fee: number
          id: string
          is_active: boolean | null
          name: string
          sort_order: number | null
        }
        Insert: {
          fee?: number
          id?: string
          is_active?: boolean | null
          name: string
          sort_order?: number | null
        }
        Update: {
          fee?: number
          id?: string
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      extra_groups: {
        Row: {
          applies_to_categories: string[] | null
          description: string | null
          id: string
          is_active: boolean | null
          is_required: boolean
          max_select: number
          name: string
          sort_order: number | null
        }
        Insert: {
          applies_to_categories?: string[] | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_required?: boolean
          max_select?: number
          name: string
          sort_order?: number | null
        }
        Update: {
          applies_to_categories?: string[] | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_required?: boolean
          max_select?: number
          name?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string | null
          extras: Json | null
          id: string
          observation: string | null
          order_id: string
          product_name: string
          product_price: number
          quantity: number
        }
        Insert: {
          created_at?: string | null
          extras?: Json | null
          id?: string
          observation?: string | null
          order_id: string
          product_name: string
          product_price: number
          quantity?: number
        }
        Update: {
          created_at?: string | null
          extras?: Json | null
          id?: string
          observation?: string | null
          order_id?: string
          product_name?: string
          product_price?: number
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          change_for: number | null
          created_at: string | null
          customer_name: string
          customer_phone: string
          delivery_fee: number
          delivery_lat: number | null
          delivery_lng: number | null
          delivery_person_id: string | null
          id: string
          observation: string | null
          order_number: number
          order_type: Database["public"]["Enums"]["order_type"]
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          reference: string | null
          service_charge: number
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          table_number: number | null
          total: number
          updated_at: string | null
        }
        Insert: {
          change_for?: number | null
          created_at?: string | null
          customer_name: string
          customer_phone: string
          delivery_fee?: number
          delivery_lat?: number | null
          delivery_lng?: number | null
          delivery_person_id?: string | null
          id?: string
          observation?: string | null
          order_number?: number
          order_type?: Database["public"]["Enums"]["order_type"]
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          reference?: string | null
          service_charge?: number
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          table_number?: number | null
          total?: number
          updated_at?: string | null
        }
        Update: {
          change_for?: number | null
          created_at?: string | null
          customer_name?: string
          customer_phone?: string
          delivery_fee?: number
          delivery_lat?: number | null
          delivery_lng?: number | null
          delivery_person_id?: string | null
          id?: string
          observation?: string | null
          order_number?: number
          order_type?: Database["public"]["Enums"]["order_type"]
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          reference?: string | null
          service_charge?: number
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          table_number?: number | null
          total?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      product_extras: {
        Row: {
          description: string | null
          group_id: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          max_quantity: number | null
          name: string
          price: number
          sort_order: number | null
        }
        Insert: {
          description?: string | null
          group_id?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          max_quantity?: number | null
          name: string
          price: number
          sort_order?: number | null
        }
        Update: {
          description?: string | null
          group_id?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          max_quantity?: number | null
          name?: string
          price?: number
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_extras_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "extra_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          available_days: number[] | null
          available_end_time: string | null
          available_start_time: string | null
          badges: string[] | null
          category: string
          combo_items: Json | null
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          is_combo: boolean | null
          name: string
          price: number
          sort_order: number | null
          updated_at: string | null
          visibility_channels: string[] | null
        }
        Insert: {
          available_days?: number[] | null
          available_end_time?: string | null
          available_start_time?: string | null
          badges?: string[] | null
          category: string
          combo_items?: Json | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_combo?: boolean | null
          name: string
          price: number
          sort_order?: number | null
          updated_at?: string | null
          visibility_channels?: string[] | null
        }
        Update: {
          available_days?: number[] | null
          available_end_time?: string | null
          available_start_time?: string | null
          badges?: string[] | null
          category?: string
          combo_items?: Json | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_combo?: boolean | null
          name?: string
          price?: number
          sort_order?: number | null
          updated_at?: string | null
          visibility_channels?: string[] | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          display_name: string | null
          id: string
          phone: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          display_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          display_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      promotions: {
        Row: {
          code: string | null
          created_at: string | null
          ends_at: string | null
          id: string
          is_active: boolean | null
          is_percentage: boolean | null
          min_order: number | null
          name: string
          starts_at: string | null
          type: string
          updated_at: string | null
          value: number
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean | null
          is_percentage?: boolean | null
          min_order?: number | null
          name: string
          starts_at?: string | null
          type: string
          updated_at?: string | null
          value: number
        }
        Update: {
          code?: string | null
          created_at?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean | null
          is_percentage?: boolean | null
          min_order?: number | null
          name?: string
          starts_at?: string | null
          type?: string
          updated_at?: string | null
          value?: number
        }
        Relationships: []
      }
      report_settings: {
        Row: {
          id: string
          pin_hash: string
          recovery_email: string
        }
        Insert: {
          id?: string
          pin_hash: string
          recovery_email: string
        }
        Update: {
          id?: string
          pin_hash?: string
          recovery_email?: string
        }
        Relationships: []
      }
      salon_tables: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          qr_code_url: string | null
          seats: number | null
          table_number: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          qr_code_url?: string | null
          seats?: number | null
          table_number: number
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          qr_code_url?: string | null
          seats?: number | null
          table_number?: number
        }
        Relationships: []
      }
      store_schedule: {
        Row: {
          close_time: string
          day_of_week: number
          id: string
          is_open: boolean | null
          open_time: string
        }
        Insert: {
          close_time?: string
          day_of_week: number
          id?: string
          is_open?: boolean | null
          open_time?: string
        }
        Update: {
          close_time?: string
          day_of_week?: number
          id?: string
          is_open?: boolean | null
          open_time?: string
        }
        Relationships: []
      }
      store_settings: {
        Row: {
          id: string
          key: string
          value: string
        }
        Insert: {
          id?: string
          key: string
          value: string
        }
        Update: {
          id?: string
          key?: string
          value?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      waiters: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          phone: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          phone?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          phone?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "staff" | "waiter" | "delivery"
      order_status:
        | "pending"
        | "production"
        | "ready"
        | "out_for_delivery"
        | "delivered"
        | "cancelled"
      order_type: "delivery" | "pickup" | "dine_in"
      payment_method: "pix" | "credit_card" | "debit_card" | "cash"
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
      app_role: ["admin", "staff", "waiter", "delivery"],
      order_status: [
        "pending",
        "production",
        "ready",
        "out_for_delivery",
        "delivered",
        "cancelled",
      ],
      order_type: ["delivery", "pickup", "dine_in"],
      payment_method: ["pix", "credit_card", "debit_card", "cash"],
    },
  },
} as const
