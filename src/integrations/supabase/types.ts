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
      chat_messages: {
        Row: {
          created_at: string | null
          direction: string
          id: string
          message: string
          session_id: string
        }
        Insert: {
          created_at?: string | null
          direction?: string
          id?: string
          message: string
          session_id: string
        }
        Update: {
          created_at?: string | null
          direction?: string
          id?: string
          message?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          cart: Json
          created_at: string | null
          customer_name: string | null
          delivery_address: string | null
          delivery_lat: number | null
          delivery_lng: number | null
          id: string
          is_active: boolean
          last_message_at: string | null
          order_id: string | null
          payment_method: string | null
          phone: string
          selected_category: string | null
          state: string
          updated_at: string | null
        }
        Insert: {
          cart?: Json
          created_at?: string | null
          customer_name?: string | null
          delivery_address?: string | null
          delivery_lat?: number | null
          delivery_lng?: number | null
          id?: string
          is_active?: boolean
          last_message_at?: string | null
          order_id?: string | null
          payment_method?: string | null
          phone: string
          selected_category?: string | null
          state?: string
          updated_at?: string | null
        }
        Update: {
          cart?: Json
          created_at?: string | null
          customer_name?: string | null
          delivery_address?: string | null
          delivery_lat?: number | null
          delivery_lng?: number | null
          id?: string
          is_active?: boolean
          last_message_at?: string | null
          order_id?: string | null
          payment_method?: string | null
          phone?: string
          selected_category?: string | null
          state?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_sessions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
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
      delivery_history: {
        Row: {
          actual_time_min: number | null
          created_at: string | null
          delay_min: number | null
          distance_km: number | null
          driver_id: string | null
          estimated_time_min: number | null
          id: string
          neighborhood: string | null
          order_id: string | null
          region: string | null
          route_id: string | null
        }
        Insert: {
          actual_time_min?: number | null
          created_at?: string | null
          delay_min?: number | null
          distance_km?: number | null
          driver_id?: string | null
          estimated_time_min?: number | null
          id?: string
          neighborhood?: string | null
          order_id?: string | null
          region?: string | null
          route_id?: string | null
        }
        Update: {
          actual_time_min?: number | null
          created_at?: string | null
          delay_min?: number | null
          distance_km?: number | null
          driver_id?: string | null
          estimated_time_min?: number | null
          id?: string
          neighborhood?: string | null
          order_id?: string | null
          region?: string | null
          route_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_history_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "delivery_persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_history_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_issues: {
        Row: {
          created_at: string | null
          delivery_person_id: string
          id: string
          issue_type: string
          notes: string | null
          order_id: string
        }
        Insert: {
          created_at?: string | null
          delivery_person_id: string
          id?: string
          issue_type: string
          notes?: string | null
          order_id: string
        }
        Update: {
          created_at?: string | null
          delivery_person_id?: string
          id?: string
          issue_type?: string
          notes?: string | null
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_issues_delivery_person_id_fkey"
            columns: ["delivery_person_id"]
            isOneToOne: false
            referencedRelation: "delivery_persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_issues_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_persons: {
        Row: {
          avg_capacity_per_hour: number | null
          avg_delay_rate: number | null
          avg_speed_kmh: number | null
          created_at: string | null
          current_lat: number | null
          current_lng: number | null
          current_route_id: string | null
          id: string
          is_active: boolean | null
          is_online: boolean | null
          location_updated_at: string | null
          name: string
          phone: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          avg_capacity_per_hour?: number | null
          avg_delay_rate?: number | null
          avg_speed_kmh?: number | null
          created_at?: string | null
          current_lat?: number | null
          current_lng?: number | null
          current_route_id?: string | null
          id?: string
          is_active?: boolean | null
          is_online?: boolean | null
          location_updated_at?: string | null
          name: string
          phone: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          avg_capacity_per_hour?: number | null
          avg_delay_rate?: number | null
          avg_speed_kmh?: number | null
          created_at?: string | null
          current_lat?: number | null
          current_lng?: number | null
          current_route_id?: string | null
          id?: string
          is_active?: boolean | null
          is_online?: boolean | null
          location_updated_at?: string | null
          name?: string
          phone?: string
          status?: string | null
          updated_at?: string | null
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
      delivery_tracking: {
        Row: {
          created_at: string | null
          current_lat: number | null
          current_lng: number | null
          delivery_person_id: string | null
          id: string
          is_active: boolean
          order_id: string
          tracking_token: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_lat?: number | null
          current_lng?: number | null
          delivery_person_id?: string | null
          id?: string
          is_active?: boolean
          order_id: string
          tracking_token?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_lat?: number | null
          current_lng?: number | null
          delivery_person_id?: string | null
          id?: string
          is_active?: boolean
          order_id?: string
          tracking_token?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_tracking_delivery_person_id_fkey"
            columns: ["delivery_person_id"]
            isOneToOne: false
            referencedRelation: "delivery_persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_tracking_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_locations: {
        Row: {
          driver_id: string
          id: string
          latitude: number
          longitude: number
          recorded_at: string
        }
        Insert: {
          driver_id: string
          id?: string
          latitude: number
          longitude: number
          recorded_at?: string
        }
        Update: {
          driver_id?: string
          id?: string
          latitude?: number
          longitude?: number
          recorded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_locations_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "delivery_persons"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_messages: {
        Row: {
          created_at: string
          driver_id: string
          id: string
          is_emergency: boolean
          message: string
          order_id: string | null
          read_by_admin: boolean
          read_by_driver: boolean
          sender: string
        }
        Insert: {
          created_at?: string
          driver_id: string
          id?: string
          is_emergency?: boolean
          message: string
          order_id?: string | null
          read_by_admin?: boolean
          read_by_driver?: boolean
          sender?: string
        }
        Update: {
          created_at?: string
          driver_id?: string
          id?: string
          is_emergency?: boolean
          message?: string
          order_id?: string | null
          read_by_admin?: boolean
          read_by_driver?: boolean
          sender?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_messages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      extra_groups: {
        Row: {
          applies_to_categories: string[] | null
          applies_to_products: string[] | null
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
          applies_to_products?: string[] | null
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
          applies_to_products?: string[] | null
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
      ifood_events_log: {
        Row: {
          created_at: string | null
          event_id: string
          event_type: string | null
          id: string
          order_id: string | null
          processed: boolean | null
        }
        Insert: {
          created_at?: string | null
          event_id: string
          event_type?: string | null
          id?: string
          order_id?: string | null
          processed?: boolean | null
        }
        Update: {
          created_at?: string | null
          event_id?: string
          event_type?: string | null
          id?: string
          order_id?: string | null
          processed?: boolean | null
        }
        Relationships: []
      }
      ifood_reviews: {
        Row: {
          comment: string | null
          created_at: string | null
          customer_name: string | null
          id: string
          merchant_id: string
          order_id: string | null
          rating: number | null
          responded_at: string | null
          response_sent: boolean | null
          response_text: string | null
          review_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          customer_name?: string | null
          id?: string
          merchant_id: string
          order_id?: string | null
          rating?: number | null
          responded_at?: string | null
          response_sent?: boolean | null
          response_text?: string | null
          review_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          customer_name?: string | null
          id?: string
          merchant_id?: string
          order_id?: string | null
          rating?: number | null
          responded_at?: string | null
          response_sent?: boolean | null
          response_text?: string | null
          review_id?: string
        }
        Relationships: []
      }
      ifood_tokens: {
        Row: {
          access_token: string
          created_at: string | null
          expires_at: string
          id: string
        }
        Insert: {
          access_token: string
          created_at?: string | null
          expires_at: string
          id?: string
        }
        Update: {
          access_token?: string
          created_at?: string | null
          expires_at?: string
          id?: string
        }
        Relationships: []
      }
      kitchen_alerts: {
        Row: {
          acknowledged: boolean
          created_at: string | null
          id: string
          message: string
          order_id: string | null
          table_number: number | null
          waiter_name: string
        }
        Insert: {
          acknowledged?: boolean
          created_at?: string | null
          id?: string
          message?: string
          order_id?: string | null
          table_number?: number | null
          waiter_name?: string
        }
        Update: {
          acknowledged?: boolean
          created_at?: string | null
          id?: string
          message?: string
          order_id?: string | null
          table_number?: number | null
          waiter_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "kitchen_alerts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_demand_history: {
        Row: {
          created_at: string | null
          date: string
          hour: number
          id: string
          neighborhood: string | null
          order_count: number | null
          source: string | null
        }
        Insert: {
          created_at?: string | null
          date: string
          hour: number
          id?: string
          neighborhood?: string | null
          order_count?: number | null
          source?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string
          hour?: number
          id?: string
          neighborhood?: string | null
          order_count?: number | null
          source?: string | null
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
          arrived_at_destination: boolean | null
          change_for: number | null
          checklist_confirmed: boolean | null
          created_at: string | null
          customer_name: string
          customer_phone: string
          delay_notified: boolean | null
          delay_risk: boolean | null
          delivery_code: string | null
          delivery_fee: number
          delivery_lat: number | null
          delivery_lng: number | null
          delivery_person_id: string | null
          estimated_delivery_minutes: number | null
          estimated_prep_minutes: number | null
          id: string
          observation: string | null
          order_number: number
          order_source: string | null
          order_type: Database["public"]["Enums"]["order_type"]
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          predicted_eta: string | null
          ready_at: string | null
          reference: string | null
          route_id: string | null
          route_position: number | null
          service_charge: number
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          table_number: number | null
          total: number
          updated_at: string | null
        }
        Insert: {
          arrived_at_destination?: boolean | null
          change_for?: number | null
          checklist_confirmed?: boolean | null
          created_at?: string | null
          customer_name: string
          customer_phone: string
          delay_notified?: boolean | null
          delay_risk?: boolean | null
          delivery_code?: string | null
          delivery_fee?: number
          delivery_lat?: number | null
          delivery_lng?: number | null
          delivery_person_id?: string | null
          estimated_delivery_minutes?: number | null
          estimated_prep_minutes?: number | null
          id?: string
          observation?: string | null
          order_number?: number
          order_source?: string | null
          order_type?: Database["public"]["Enums"]["order_type"]
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          predicted_eta?: string | null
          ready_at?: string | null
          reference?: string | null
          route_id?: string | null
          route_position?: number | null
          service_charge?: number
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          table_number?: number | null
          total?: number
          updated_at?: string | null
        }
        Update: {
          arrived_at_destination?: boolean | null
          change_for?: number | null
          checklist_confirmed?: boolean | null
          created_at?: string | null
          customer_name?: string
          customer_phone?: string
          delay_notified?: boolean | null
          delay_risk?: boolean | null
          delivery_code?: string | null
          delivery_fee?: number
          delivery_lat?: number | null
          delivery_lng?: number | null
          delivery_person_id?: string | null
          estimated_delivery_minutes?: number | null
          estimated_prep_minutes?: number | null
          id?: string
          observation?: string | null
          order_number?: number
          order_source?: string | null
          order_type?: Database["public"]["Enums"]["order_type"]
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          predicted_eta?: string | null
          ready_at?: string | null
          reference?: string | null
          route_id?: string | null
          route_position?: number | null
          service_charge?: number
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          table_number?: number | null
          total?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      print_queue: {
        Row: {
          content: string
          created_at: string | null
          id: string
          order_id: string | null
          printed: boolean
          type: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          order_id?: string | null
          printed?: boolean
          type?: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          order_id?: string | null
          printed?: boolean
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "print_queue_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
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
      route_orders: {
        Row: {
          created_at: string | null
          id: string
          order_id: string
          predicted_eta: string | null
          route_id: string
          stop_distance_km: number | null
          stop_duration_min: number | null
          stop_order: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          order_id: string
          predicted_eta?: string | null
          route_id: string
          stop_distance_km?: number | null
          stop_duration_min?: number | null
          stop_order?: number
        }
        Update: {
          created_at?: string | null
          id?: string
          order_id?: string
          predicted_eta?: string | null
          route_id?: string
          stop_distance_km?: number | null
          stop_duration_min?: number | null
          stop_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "route_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_orders_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      routes: {
        Row: {
          auto_assigned: boolean | null
          code: string
          created_at: string | null
          driver_id: string | null
          estimated_duration_min: number | null
          id: string
          optimized_sequence: Json | null
          origin_lat: number
          origin_lng: number
          predicted_real_duration_min: number | null
          status: string
          total_distance_km: number | null
          updated_at: string | null
        }
        Insert: {
          auto_assigned?: boolean | null
          code?: string
          created_at?: string | null
          driver_id?: string | null
          estimated_duration_min?: number | null
          id?: string
          optimized_sequence?: Json | null
          origin_lat?: number
          origin_lng?: number
          predicted_real_duration_min?: number | null
          status?: string
          total_distance_km?: number | null
          updated_at?: string | null
        }
        Update: {
          auto_assigned?: boolean | null
          code?: string
          created_at?: string | null
          driver_id?: string | null
          estimated_duration_min?: number | null
          id?: string
          optimized_sequence?: Json | null
          origin_lat?: number
          origin_lng?: number
          predicted_real_duration_min?: number | null
          status?: string
          total_distance_km?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "routes_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "delivery_persons"
            referencedColumns: ["id"]
          },
        ]
      }
      routing_config: {
        Row: {
          id: string
          key: string
          label: string | null
          updated_at: string | null
          value: string
        }
        Insert: {
          id?: string
          key: string
          label?: string | null
          updated_at?: string | null
          value: string
        }
        Update: {
          id?: string
          key?: string
          label?: string | null
          updated_at?: string | null
          value?: string
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
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          phone: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          phone?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          phone?: string | null
          user_id?: string | null
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
      driver_status: "available" | "on_route" | "paused" | "offline"
      order_status:
        | "pending"
        | "production"
        | "ready"
        | "out_for_delivery"
        | "delivered"
        | "cancelled"
      order_type: "delivery" | "pickup" | "dine_in"
      payment_method: "pix" | "credit_card" | "debit_card" | "cash"
      route_status:
        | "created"
        | "awaiting_driver"
        | "assigned"
        | "in_delivery"
        | "completed"
        | "cancelled"
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
      driver_status: ["available", "on_route", "paused", "offline"],
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
      route_status: [
        "created",
        "awaiting_driver",
        "assigned",
        "in_delivery",
        "completed",
        "cancelled",
      ],
    },
  },
} as const
