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
      addresses: {
        Row: {
          city: string
          country: string
          created_at: string
          destination_code: string | null
          id: string
          is_default: boolean
          line1: string
          line2: string | null
          phone: string
          postal_code: string
          province: string
          recipient: string
          updated_at: string
          user_id: string
        }
        Insert: {
          city: string
          country?: string
          created_at?: string
          destination_code?: string | null
          id?: string
          is_default?: boolean
          line1: string
          line2?: string | null
          phone: string
          postal_code: string
          province: string
          recipient: string
          updated_at?: string
          user_id: string
        }
        Update: {
          city?: string
          country?: string
          created_at?: string
          destination_code?: string | null
          id?: string
          is_default?: boolean
          line1?: string
          line2?: string | null
          phone?: string
          postal_code?: string
          province?: string
          recipient?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_action_logs: {
        Row: {
          action: string
          after: Json | null
          before: Json | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          note: string | null
          operator_id: string | null
          operator_name: string | null
        }
        Insert: {
          action: string
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          note?: string | null
          operator_id?: string | null
          operator_name?: string | null
        }
        Update: {
          action?: string
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          note?: string | null
          operator_id?: string | null
          operator_name?: string | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      batches: {
        Row: {
          batch_no: string | null
          cargo_type: string | null
          closed_at: string | null
          created_at: string
          created_by: string | null
          destination_code: string | null
          eta_date: string | null
          fee_breakdown: Json | null
          grand_total_cny: number
          id: string
          notes: string | null
          planned_ship_date: string
          sequence_no: number | null
          shipping_method: Database["public"]["Enums"]["batch_method"]
          status: Database["public"]["Enums"]["batch_status"]
          total_cny: number | null
          total_volume_cm3: number | null
          total_weight_kg: number | null
          updated_at: string
          vessel_no: string | null
          waybill_count: number | null
        }
        Insert: {
          batch_no?: string | null
          cargo_type?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          destination_code?: string | null
          eta_date?: string | null
          fee_breakdown?: Json | null
          grand_total_cny?: number
          id?: string
          notes?: string | null
          planned_ship_date: string
          sequence_no?: number | null
          shipping_method: Database["public"]["Enums"]["batch_method"]
          status?: Database["public"]["Enums"]["batch_status"]
          total_cny?: number | null
          total_volume_cm3?: number | null
          total_weight_kg?: number | null
          updated_at?: string
          vessel_no?: string | null
          waybill_count?: number | null
        }
        Update: {
          batch_no?: string | null
          cargo_type?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          destination_code?: string | null
          eta_date?: string | null
          fee_breakdown?: Json | null
          grand_total_cny?: number
          id?: string
          notes?: string | null
          planned_ship_date?: string
          sequence_no?: number | null
          shipping_method?: Database["public"]["Enums"]["batch_method"]
          status?: Database["public"]["Enums"]["batch_status"]
          total_cny?: number | null
          total_volume_cm3?: number | null
          total_weight_kg?: number | null
          updated_at?: string
          vessel_no?: string | null
          waybill_count?: number | null
        }
        Relationships: []
      }
      cargo_types: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          name_en: string | null
          name_zh: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          name_en?: string | null
          name_zh: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          name_en?: string | null
          name_zh?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      cartons: {
        Row: {
          batch_id: string | null
          carton_no: string | null
          closed_at: string | null
          created_at: string
          created_by: string | null
          customer_code: string | null
          customer_user_id: string | null
          destination_code: string | null
          height_cm: number | null
          id: string
          length_cm: number | null
          notes: string | null
          pallet_id: string | null
          pickup_warehouse: string | null
          route_code: string | null
          route_id: string | null
          self_freight_cad: number
          self_freight_cny: number
          self_height_cm: number | null
          self_length_cm: number | null
          self_volume_m3: number | null
          self_weight_kg: number | null
          self_width_cm: number | null
          sequence_no: number | null
          status: string
          unlocked: boolean
          updated_at: string
          weight_kg: number | null
          width_cm: number | null
        }
        Insert: {
          batch_id?: string | null
          carton_no?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_code?: string | null
          customer_user_id?: string | null
          destination_code?: string | null
          height_cm?: number | null
          id?: string
          length_cm?: number | null
          notes?: string | null
          pallet_id?: string | null
          pickup_warehouse?: string | null
          route_code?: string | null
          route_id?: string | null
          self_freight_cad?: number
          self_freight_cny?: number
          self_height_cm?: number | null
          self_length_cm?: number | null
          self_volume_m3?: number | null
          self_weight_kg?: number | null
          self_width_cm?: number | null
          sequence_no?: number | null
          status?: string
          unlocked?: boolean
          updated_at?: string
          weight_kg?: number | null
          width_cm?: number | null
        }
        Update: {
          batch_id?: string | null
          carton_no?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_code?: string | null
          customer_user_id?: string | null
          destination_code?: string | null
          height_cm?: number | null
          id?: string
          length_cm?: number | null
          notes?: string | null
          pallet_id?: string | null
          pickup_warehouse?: string | null
          route_code?: string | null
          route_id?: string | null
          self_freight_cad?: number
          self_freight_cny?: number
          self_height_cm?: number | null
          self_length_cm?: number | null
          self_volume_m3?: number | null
          self_weight_kg?: number | null
          self_width_cm?: number | null
          sequence_no?: number | null
          status?: string
          unlocked?: boolean
          updated_at?: string
          weight_kg?: number | null
          width_cm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cartons_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cartons_pallet_id_fkey"
            columns: ["pallet_id"]
            isOneToOne: false
            referencedRelation: "pallets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cartons_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "shipping_routes"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_articles: {
        Row: {
          author_id: string | null
          content_md: string | null
          cover_url: string | null
          created_at: string
          excerpt: string | null
          id: string
          published_at: string | null
          slug: string
          status: Database["public"]["Enums"]["cms_status"]
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          content_md?: string | null
          cover_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          published_at?: string | null
          slug: string
          status?: Database["public"]["Enums"]["cms_status"]
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          content_md?: string | null
          cover_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          published_at?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["cms_status"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      cms_banners: {
        Row: {
          created_at: string
          ends_at: string | null
          id: string
          image_url: string
          is_active: boolean
          link_url: string | null
          position: string
          sort_order: number
          starts_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ends_at?: string | null
          id?: string
          image_url: string
          is_active?: boolean
          link_url?: string | null
          position?: string
          sort_order?: number
          starts_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ends_at?: string | null
          id?: string
          image_url?: string
          is_active?: boolean
          link_url?: string | null
          position?: string
          sort_order?: number
          starts_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string
          name: string
          phone: string | null
          status: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          phone?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          phone?: string | null
          status?: string
        }
        Relationships: []
      }
      coupon_redemptions: {
        Row: {
          coupon_id: string
          id: string
          order_id: string | null
          redeemed_at: string
          user_id: string
        }
        Insert: {
          coupon_id: string
          id?: string
          order_id?: string | null
          redeemed_at?: string
          user_id: string
        }
        Update: {
          coupon_id?: string
          id?: string
          order_id?: string | null
          redeemed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          code: string
          created_at: string
          ends_at: string | null
          id: string
          is_active: boolean
          min_order_cny: number
          name: string | null
          starts_at: string | null
          type: Database["public"]["Enums"]["coupon_type"]
          updated_at: string
          usage_limit: number | null
          used_count: number
          value: number
        }
        Insert: {
          code: string
          created_at?: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          min_order_cny?: number
          name?: string | null
          starts_at?: string | null
          type?: Database["public"]["Enums"]["coupon_type"]
          updated_at?: string
          usage_limit?: number | null
          used_count?: number
          value?: number
        }
        Update: {
          code?: string
          created_at?: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          min_order_cny?: number
          name?: string | null
          starts_at?: string | null
          type?: Database["public"]["Enums"]["coupon_type"]
          updated_at?: string
          usage_limit?: number | null
          used_count?: number
          value?: number
        }
        Relationships: []
      }
      customs_rules: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          note: string | null
          rate_pct: number
          route_id: string
          threshold_cad: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          note?: string | null
          rate_pct?: number
          route_id: string
          threshold_cad?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          note?: string | null
          rate_pct?: number
          route_id?: string
          threshold_cad?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customs_rules_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: true
            referencedRelation: "shipping_routes"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_queue: {
        Row: {
          added_by: string | null
          code: string
          created_at: string
          customer_code: string | null
          customer_user_id: string | null
          dispatched_at: string | null
          id: string
          kind: string
          notes: string | null
          ref_id: string
          source_batch_id: string | null
          source_receiving_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          added_by?: string | null
          code: string
          created_at?: string
          customer_code?: string | null
          customer_user_id?: string | null
          dispatched_at?: string | null
          id?: string
          kind: string
          notes?: string | null
          ref_id: string
          source_batch_id?: string | null
          source_receiving_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          added_by?: string | null
          code?: string
          created_at?: string
          customer_code?: string | null
          customer_user_id?: string | null
          dispatched_at?: string | null
          id?: string
          kind?: string
          notes?: string | null
          ref_id?: string
          source_batch_id?: string | null
          source_receiving_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_queue_source_batch_id_fkey"
            columns: ["source_batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_queue_source_receiving_id_fkey"
            columns: ["source_receiving_id"]
            isOneToOne: false
            referencedRelation: "receivings"
            referencedColumns: ["id"]
          },
        ]
      }
      destinations: {
        Row: {
          active: boolean
          code: string
          country: string | null
          created_at: string
          id: string
          name_en: string | null
          name_zh: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          country?: string | null
          created_at?: string
          id?: string
          name_en?: string | null
          name_zh: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          country?: string | null
          created_at?: string
          id?: string
          name_en?: string | null
          name_zh?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      detained_packages: {
        Row: {
          created_at: string
          created_by: string | null
          customer_code: string | null
          domestic_tracking_no: string
          id: string
          intake_parent_id: string | null
          intake_parent_kind: string | null
          intake_waybill_ids: string[] | null
          note: string | null
          released_at: string | null
          released_by: string | null
          status: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_code?: string | null
          domestic_tracking_no: string
          id?: string
          intake_parent_id?: string | null
          intake_parent_kind?: string | null
          intake_waybill_ids?: string[] | null
          note?: string | null
          released_at?: string | null
          released_by?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_code?: string | null
          domestic_tracking_no?: string
          id?: string
          intake_parent_id?: string | null
          intake_parent_kind?: string | null
          intake_waybill_ids?: string[] | null
          note?: string | null
          released_at?: string | null
          released_by?: string | null
          status?: string
        }
        Relationships: []
      }
      forwarding_items: {
        Row: {
          created_at: string
          extras: Json
          forwarding_id: string
          hs_code: string | null
          id: string
          name: string
          quantity: number
          unit_price_cad: number
          unit_price_cny: number
        }
        Insert: {
          created_at?: string
          extras?: Json
          forwarding_id: string
          hs_code?: string | null
          id?: string
          name: string
          quantity?: number
          unit_price_cad?: number
          unit_price_cny?: number
        }
        Update: {
          created_at?: string
          extras?: Json
          forwarding_id?: string
          hs_code?: string | null
          id?: string
          name?: string
          quantity?: number
          unit_price_cad?: number
          unit_price_cny?: number
        }
        Relationships: [
          {
            foreignKeyName: "forwarding_items_forwarding_id_fkey"
            columns: ["forwarding_id"]
            isOneToOne: false
            referencedRelation: "forwarding_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      forwarding_orders: {
        Row: {
          actual_weight_kg: number | null
          address_id: string | null
          aliases: string[]
          batch_no: string | null
          box_count: number
          box_no: string | null
          carton_id: string | null
          company_code: string | null
          created_at: string
          customer_code: string | null
          customs_cny: number
          declared_value_cad: number | null
          destination_code: string | null
          domestic_tracking_no: string | null
          eta: string | null
          eta_label: string | null
          fee_cny: number | null
          freight_snapshot: Json | null
          height_cm: number | null
          id: string
          insurance_cny: number
          insured: boolean
          intake_at: string | null
          intake_by: string | null
          intl_tracking_no: string | null
          items_desc: string | null
          length_cm: number | null
          note: string | null
          pallet_id: string | null
          pallet_no: string | null
          payment_status: string
          request_no: string | null
          route_code: string | null
          route_id: string | null
          shipping_method: string
          status: string
          tracking_no: string | null
          updated_at: string
          user_id: string
          warehouse: string
          weight_kg: number | null
          width_cm: number | null
        }
        Insert: {
          actual_weight_kg?: number | null
          address_id?: string | null
          aliases?: string[]
          batch_no?: string | null
          box_count?: number
          box_no?: string | null
          carton_id?: string | null
          company_code?: string | null
          created_at?: string
          customer_code?: string | null
          customs_cny?: number
          declared_value_cad?: number | null
          destination_code?: string | null
          domestic_tracking_no?: string | null
          eta?: string | null
          eta_label?: string | null
          fee_cny?: number | null
          freight_snapshot?: Json | null
          height_cm?: number | null
          id?: string
          insurance_cny?: number
          insured?: boolean
          intake_at?: string | null
          intake_by?: string | null
          intl_tracking_no?: string | null
          items_desc?: string | null
          length_cm?: number | null
          note?: string | null
          pallet_id?: string | null
          pallet_no?: string | null
          payment_status?: string
          request_no?: string | null
          route_code?: string | null
          route_id?: string | null
          shipping_method: string
          status?: string
          tracking_no?: string | null
          updated_at?: string
          user_id: string
          warehouse: string
          weight_kg?: number | null
          width_cm?: number | null
        }
        Update: {
          actual_weight_kg?: number | null
          address_id?: string | null
          aliases?: string[]
          batch_no?: string | null
          box_count?: number
          box_no?: string | null
          carton_id?: string | null
          company_code?: string | null
          created_at?: string
          customer_code?: string | null
          customs_cny?: number
          declared_value_cad?: number | null
          destination_code?: string | null
          domestic_tracking_no?: string | null
          eta?: string | null
          eta_label?: string | null
          fee_cny?: number | null
          freight_snapshot?: Json | null
          height_cm?: number | null
          id?: string
          insurance_cny?: number
          insured?: boolean
          intake_at?: string | null
          intake_by?: string | null
          intl_tracking_no?: string | null
          items_desc?: string | null
          length_cm?: number | null
          note?: string | null
          pallet_id?: string | null
          pallet_no?: string | null
          payment_status?: string
          request_no?: string | null
          route_code?: string | null
          route_id?: string | null
          shipping_method?: string
          status?: string
          tracking_no?: string | null
          updated_at?: string
          user_id?: string
          warehouse?: string
          weight_kg?: number | null
          width_cm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "forwarding_orders_address_id_fkey"
            columns: ["address_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forwarding_orders_carton_id_fkey"
            columns: ["carton_id"]
            isOneToOne: false
            referencedRelation: "cartons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forwarding_orders_pallet_id_fkey"
            columns: ["pallet_id"]
            isOneToOne: false
            referencedRelation: "pallets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forwarding_orders_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "shipping_routes"
            referencedColumns: ["id"]
          },
        ]
      }
      freight_rules: {
        Row: {
          clearance_fee_cad: number
          clearance_fee_level: string
          created_at: string
          direction: string
          effective_from: string | null
          effective_to: string | null
          extra_fee_cny: number
          id: string
          insurance_rate_pct: number
          is_active: boolean
          min_charge_cad: number
          min_charge_cny: number
          min_charge_level: string
          note: string | null
          pallet_max_height_cm: number | null
          pallet_max_length_cm: number | null
          pallet_max_weight_kg: number | null
          pallet_max_width_cm: number | null
          pallet_overflow_factor: number
          pallet_unit_price_cad: number
          pricing_mode: string
          route_id: string
          unit_price_cad: number
          unit_price_cny: number
          updated_at: string
          volumetric_divisor: number
          weight_mode: string
        }
        Insert: {
          clearance_fee_cad?: number
          clearance_fee_level?: string
          created_at?: string
          direction?: string
          effective_from?: string | null
          effective_to?: string | null
          extra_fee_cny?: number
          id?: string
          insurance_rate_pct?: number
          is_active?: boolean
          min_charge_cad?: number
          min_charge_cny?: number
          min_charge_level?: string
          note?: string | null
          pallet_max_height_cm?: number | null
          pallet_max_length_cm?: number | null
          pallet_max_weight_kg?: number | null
          pallet_max_width_cm?: number | null
          pallet_overflow_factor?: number
          pallet_unit_price_cad?: number
          pricing_mode?: string
          route_id: string
          unit_price_cad?: number
          unit_price_cny?: number
          updated_at?: string
          volumetric_divisor?: number
          weight_mode?: string
        }
        Update: {
          clearance_fee_cad?: number
          clearance_fee_level?: string
          created_at?: string
          direction?: string
          effective_from?: string | null
          effective_to?: string | null
          extra_fee_cny?: number
          id?: string
          insurance_rate_pct?: number
          is_active?: boolean
          min_charge_cad?: number
          min_charge_cny?: number
          min_charge_level?: string
          note?: string | null
          pallet_max_height_cm?: number | null
          pallet_max_length_cm?: number | null
          pallet_max_weight_kg?: number | null
          pallet_max_width_cm?: number | null
          pallet_overflow_factor?: number
          pallet_unit_price_cad?: number
          pricing_mode?: string
          route_id?: string
          unit_price_cad?: number
          unit_price_cny?: number
          updated_at?: string
          volumetric_divisor?: number
          weight_mode?: string
        }
        Relationships: [
          {
            foreignKeyName: "freight_rules_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "shipping_routes"
            referencedColumns: ["id"]
          },
        ]
      }
      hs_codes: {
        Row: {
          aliases: string[]
          anti_dumping_note: string | null
          anti_dumping_rate: number | null
          chapter: string | null
          created_at: string
          gst_rate: number | null
          hs_code: string
          id: string
          is_active: boolean
          mfn_rate: number | null
          name_en: string | null
          name_zh: string
          note: string | null
          sima_involved: boolean
          unit: string | null
          updated_at: string
        }
        Insert: {
          aliases?: string[]
          anti_dumping_note?: string | null
          anti_dumping_rate?: number | null
          chapter?: string | null
          created_at?: string
          gst_rate?: number | null
          hs_code: string
          id?: string
          is_active?: boolean
          mfn_rate?: number | null
          name_en?: string | null
          name_zh: string
          note?: string | null
          sima_involved?: boolean
          unit?: string | null
          updated_at?: string
        }
        Update: {
          aliases?: string[]
          anti_dumping_note?: string | null
          anti_dumping_rate?: number | null
          chapter?: string | null
          created_at?: string
          gst_rate?: number | null
          hs_code?: string
          id?: string
          is_active?: boolean
          mfn_rate?: number | null
          name_en?: string | null
          name_zh?: string
          note?: string | null
          sima_involved?: boolean
          unit?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      inventory_movements: {
        Row: {
          created_at: string
          id: string
          note: string | null
          operator_id: string | null
          qty_delta: number
          reason: Database["public"]["Enums"]["inv_reason"]
          ref_id: string | null
          ref_type: string | null
          variant_id: string
          warehouse_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          operator_id?: string | null
          qty_delta: number
          reason: Database["public"]["Enums"]["inv_reason"]
          ref_id?: string | null
          ref_type?: string | null
          variant_id: string
          warehouse_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          operator_id?: string | null
          qty_delta?: number
          reason?: Database["public"]["Enums"]["inv_reason"]
          ref_id?: string | null
          ref_type?: string | null
          variant_id?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          amount_cny: number
          created_at: string
          customs_cny: number
          description: string
          forwarding_id: string | null
          freight_cny: number
          id: string
          insurance_cny: number
          invoice_id: string
          meta: Json | null
          order_id: string | null
          other_cny: number
          waybill_id: string | null
        }
        Insert: {
          amount_cny?: number
          created_at?: string
          customs_cny?: number
          description: string
          forwarding_id?: string | null
          freight_cny?: number
          id?: string
          insurance_cny?: number
          invoice_id: string
          meta?: Json | null
          order_id?: string | null
          other_cny?: number
          waybill_id?: string | null
        }
        Update: {
          amount_cny?: number
          created_at?: string
          customs_cny?: number
          description?: string
          forwarding_id?: string | null
          freight_cny?: number
          id?: string
          insurance_cny?: number
          invoice_id?: string
          meta?: Json | null
          order_id?: string | null
          other_cny?: number
          waybill_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_forwarding_id_fkey"
            columns: ["forwarding_id"]
            isOneToOne: false
            referencedRelation: "forwarding_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_waybill_id_fkey"
            columns: ["waybill_id"]
            isOneToOne: false
            referencedRelation: "waybills"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          batch_no: string | null
          created_at: string
          created_by: string | null
          currency: string
          customs_cny: number
          due_date: string | null
          freight_cny: number
          fx_rate: number
          id: string
          insurance_cny: number
          invoice_no: string
          note: string | null
          other_cny: number
          paid_at: string | null
          paid_cad: number
          paid_cny: number
          period_end: string | null
          period_start: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal_cny: number
          total_cny: number
          type: Database["public"]["Enums"]["invoice_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          batch_no?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          customs_cny?: number
          due_date?: string | null
          freight_cny?: number
          fx_rate?: number
          id?: string
          insurance_cny?: number
          invoice_no: string
          note?: string | null
          other_cny?: number
          paid_at?: string | null
          paid_cad?: number
          paid_cny?: number
          period_end?: string | null
          period_start?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal_cny?: number
          total_cny?: number
          type?: Database["public"]["Enums"]["invoice_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          batch_no?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          customs_cny?: number
          due_date?: string | null
          freight_cny?: number
          fx_rate?: number
          id?: string
          insurance_cny?: number
          invoice_no?: string
          note?: string | null
          other_cny?: number
          paid_at?: string | null
          paid_cad?: number
          paid_cny?: number
          period_end?: string | null
          period_start?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal_cny?: number
          total_cny?: number
          type?: Database["public"]["Enums"]["invoice_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      my_items: {
        Row: {
          created_at: string
          declared_value_cad: number
          gst_rate: number
          hs_code: string
          id: string
          inner_qty: number | null
          mfn_rate: number
          name: string
          sima_involved: boolean
          sku: string | null
          unit: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          declared_value_cad?: number
          gst_rate?: number
          hs_code: string
          id?: string
          inner_qty?: number | null
          mfn_rate?: number
          name: string
          sima_involved?: boolean
          sku?: string | null
          unit?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          declared_value_cad?: number
          gst_rate?: number
          hs_code?: string
          id?: string
          inner_qty?: number | null
          mfn_rate?: number
          name?: string
          sima_involved?: boolean
          sku?: string | null
          unit?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      offline_payments: {
        Row: {
          amount_cad: number
          attachment_url: string | null
          created_at: string
          id: string
          invoice_id: string
          method: string
          note: string | null
          paid_at: string
          recorded_by: string | null
          reference: string | null
        }
        Insert: {
          amount_cad: number
          attachment_url?: string | null
          created_at?: string
          id?: string
          invoice_id: string
          method: string
          note?: string | null
          paid_at?: string
          recorded_by?: string | null
          reference?: string | null
        }
        Update: {
          amount_cad?: number
          attachment_url?: string | null
          created_at?: string
          id?: string
          invoice_id?: string
          method?: string
          note?: string | null
          paid_at?: string
          recorded_by?: string | null
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "offline_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      order_attachments: {
        Row: {
          content_type: string | null
          created_at: string
          file_name: string
          file_path: string
          file_size: number
          id: string
          owner_id: string
          owner_kind: string
          user_id: string
        }
        Insert: {
          content_type?: string | null
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number
          id?: string
          owner_id: string
          owner_kind: string
          user_id: string
        }
        Update: {
          content_type?: string | null
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          owner_id?: string
          owner_kind?: string
          user_id?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          attrs_snapshot: Json | null
          created_at: string
          id: string
          image_url: string | null
          name_en: string | null
          name_zh: string
          order_id: string
          paid: boolean
          product_id: string | null
          product_slug: string
          purchase_type: string
          quantity: number
          sku: string | null
          subtotal_cny: number
          unit_price_cny: number
          variant_id: string | null
          waybill_id: string | null
        }
        Insert: {
          attrs_snapshot?: Json | null
          created_at?: string
          id?: string
          image_url?: string | null
          name_en?: string | null
          name_zh: string
          order_id: string
          paid?: boolean
          product_id?: string | null
          product_slug: string
          purchase_type?: string
          quantity: number
          sku?: string | null
          subtotal_cny?: number
          unit_price_cny: number
          variant_id?: string | null
          waybill_id?: string | null
        }
        Update: {
          attrs_snapshot?: Json | null
          created_at?: string
          id?: string
          image_url?: string | null
          name_en?: string | null
          name_zh?: string
          order_id?: string
          paid?: boolean
          product_id?: string | null
          product_slug?: string
          purchase_type?: string
          quantity?: number
          sku?: string | null
          subtotal_cny?: number
          unit_price_cny?: number
          variant_id?: string | null
          waybill_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_waybill_id_fkey"
            columns: ["waybill_id"]
            isOneToOne: false
            referencedRelation: "waybills"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address_snapshot: Json | null
          aliases: string[]
          batch_no: string | null
          box_count: number
          box_no: string | null
          buyer_note: string | null
          carton_id: string | null
          company_code: string | null
          completed_at: string | null
          coupon_id: string | null
          created_at: string
          customer_code: string | null
          customs_cny: number
          destination_code: string | null
          discount_cny: number
          display_currency: string
          domestic_tracking_no: string | null
          eta: string | null
          freight_recalc_at: string | null
          freight_recalc_by: string | null
          freight_snapshot: Json | null
          fx_rate: number
          id: string
          insurance_cny: number
          insured: boolean
          intl_tracking_no: string | null
          note: string | null
          order_no: string
          paid_at: string | null
          pallet_id: string | null
          pallet_no: string | null
          payment_method: string | null
          payment_status: string
          route_code: string | null
          route_id: string | null
          shipped_at: string | null
          shipping_cny: number
          shipping_method: string
          source: string
          status: Database["public"]["Enums"]["order_status"]
          subtotal_cny: number
          total_cny: number
          tracking_no: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address_snapshot?: Json | null
          aliases?: string[]
          batch_no?: string | null
          box_count?: number
          box_no?: string | null
          buyer_note?: string | null
          carton_id?: string | null
          company_code?: string | null
          completed_at?: string | null
          coupon_id?: string | null
          created_at?: string
          customer_code?: string | null
          customs_cny?: number
          destination_code?: string | null
          discount_cny?: number
          display_currency?: string
          domestic_tracking_no?: string | null
          eta?: string | null
          freight_recalc_at?: string | null
          freight_recalc_by?: string | null
          freight_snapshot?: Json | null
          fx_rate?: number
          id?: string
          insurance_cny?: number
          insured?: boolean
          intl_tracking_no?: string | null
          note?: string | null
          order_no: string
          paid_at?: string | null
          pallet_id?: string | null
          pallet_no?: string | null
          payment_method?: string | null
          payment_status?: string
          route_code?: string | null
          route_id?: string | null
          shipped_at?: string | null
          shipping_cny?: number
          shipping_method?: string
          source?: string
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_cny?: number
          total_cny?: number
          tracking_no?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address_snapshot?: Json | null
          aliases?: string[]
          batch_no?: string | null
          box_count?: number
          box_no?: string | null
          buyer_note?: string | null
          carton_id?: string | null
          company_code?: string | null
          completed_at?: string | null
          coupon_id?: string | null
          created_at?: string
          customer_code?: string | null
          customs_cny?: number
          destination_code?: string | null
          discount_cny?: number
          display_currency?: string
          domestic_tracking_no?: string | null
          eta?: string | null
          freight_recalc_at?: string | null
          freight_recalc_by?: string | null
          freight_snapshot?: Json | null
          fx_rate?: number
          id?: string
          insurance_cny?: number
          insured?: boolean
          intl_tracking_no?: string | null
          note?: string | null
          order_no?: string
          paid_at?: string | null
          pallet_id?: string | null
          pallet_no?: string | null
          payment_method?: string | null
          payment_status?: string
          route_code?: string | null
          route_id?: string | null
          shipped_at?: string | null
          shipping_cny?: number
          shipping_method?: string
          source?: string
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_cny?: number
          total_cny?: number
          tracking_no?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_carton_id_fkey"
            columns: ["carton_id"]
            isOneToOne: false
            referencedRelation: "cartons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_pallet_id_fkey"
            columns: ["pallet_id"]
            isOneToOne: false
            referencedRelation: "pallets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "shipping_routes"
            referencedColumns: ["id"]
          },
        ]
      }
      oversize_rules: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          max_girth_cm: number | null
          max_height_cm: number | null
          max_length_cm: number | null
          max_single_side_cm: number | null
          max_volume_m3: number | null
          max_weight_kg: number | null
          max_width_cm: number | null
          name: string
          notes: string | null
          route_id: string | null
          shipping_method: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          max_girth_cm?: number | null
          max_height_cm?: number | null
          max_length_cm?: number | null
          max_single_side_cm?: number | null
          max_volume_m3?: number | null
          max_weight_kg?: number | null
          max_width_cm?: number | null
          name: string
          notes?: string | null
          route_id?: string | null
          shipping_method?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          max_girth_cm?: number | null
          max_height_cm?: number | null
          max_length_cm?: number | null
          max_single_side_cm?: number | null
          max_volume_m3?: number | null
          max_weight_kg?: number | null
          max_width_cm?: number | null
          name?: string
          notes?: string | null
          route_id?: string | null
          shipping_method?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "oversize_rules_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "shipping_routes"
            referencedColumns: ["id"]
          },
        ]
      }
      pallets: {
        Row: {
          batch_id: string | null
          closed_at: string | null
          created_at: string
          created_by: string | null
          customer_code: string | null
          customer_user_id: string | null
          destination_code: string | null
          height_cm: number | null
          id: string
          length_cm: number | null
          notes: string | null
          pallet_no: string | null
          pickup_warehouse: string | null
          route_code: string | null
          route_id: string | null
          self_freight_cad: number
          self_freight_cny: number
          self_height_cm: number | null
          self_length_cm: number | null
          self_volume_m3: number | null
          self_weight_kg: number | null
          self_width_cm: number | null
          sequence_no: number | null
          status: string
          unlocked: boolean
          updated_at: string
          weight_kg: number | null
          width_cm: number | null
        }
        Insert: {
          batch_id?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_code?: string | null
          customer_user_id?: string | null
          destination_code?: string | null
          height_cm?: number | null
          id?: string
          length_cm?: number | null
          notes?: string | null
          pallet_no?: string | null
          pickup_warehouse?: string | null
          route_code?: string | null
          route_id?: string | null
          self_freight_cad?: number
          self_freight_cny?: number
          self_height_cm?: number | null
          self_length_cm?: number | null
          self_volume_m3?: number | null
          self_weight_kg?: number | null
          self_width_cm?: number | null
          sequence_no?: number | null
          status?: string
          unlocked?: boolean
          updated_at?: string
          weight_kg?: number | null
          width_cm?: number | null
        }
        Update: {
          batch_id?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_code?: string | null
          customer_user_id?: string | null
          destination_code?: string | null
          height_cm?: number | null
          id?: string
          length_cm?: number | null
          notes?: string | null
          pallet_no?: string | null
          pickup_warehouse?: string | null
          route_code?: string | null
          route_id?: string | null
          self_freight_cad?: number
          self_freight_cny?: number
          self_height_cm?: number | null
          self_length_cm?: number | null
          self_volume_m3?: number | null
          self_weight_kg?: number | null
          self_width_cm?: number | null
          sequence_no?: number | null
          status?: string
          unlocked?: boolean
          updated_at?: string
          weight_kg?: number | null
          width_cm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pallets_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pallets_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "shipping_routes"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          cover_url: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          name_en: string | null
          parent_id: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          name_en?: string | null
          parent_id?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          name_en?: string | null
          parent_id?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          attrs: Json
          barcode: string | null
          created_at: string
          id: string
          is_active: boolean
          price_cny: number
          product_id: string
          sku: string
          stock: number
          updated_at: string
        }
        Insert: {
          attrs?: Json
          barcode?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          price_cny?: number
          product_id: string
          sku: string
          stock?: number
          updated_at?: string
        }
        Update: {
          attrs?: Json
          barcode?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          price_cny?: number
          product_id?: string
          sku?: string
          stock?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          allow_business: boolean
          allow_personal: boolean
          available_route_codes: string[]
          brand: string | null
          business_air_route_code: string | null
          business_sea_route_code: string | null
          cargo_type: string
          category_id: string | null
          compare_price_cad: number | null
          compare_price_cny: number | null
          cover_url: string | null
          created_at: string
          customs_antidumping_rate: number
          customs_gst_rate: number
          customs_mfn_rate: number
          description: string | null
          description_en: string | null
          detail_blocks: Json
          freight_cny: number
          height_cm: number | null
          hs_code: string | null
          id: string
          images: Json
          length_cm: number | null
          manufacturer: string | null
          moq: number
          name: string
          name_en: string | null
          pack_height_cm: number | null
          pack_length_cm: number | null
          pack_qty: number
          pack_volume_m3: number | null
          pack_weight_kg: number | null
          pack_width_cm: number | null
          personal_air_route_code: string | null
          personal_freight_mode: string
          personal_per_unit_freight_air_cny: number
          personal_per_unit_freight_cny: number
          personal_per_unit_freight_sea_cny: number
          personal_sea_route_code: string | null
          price_cny: number
          purchase_type: Database["public"]["Enums"]["product_purchase_type"]
          sku: string
          slug: string
          sold_count: number
          status: Database["public"]["Enums"]["product_status"]
          subtitle: string | null
          subtitle_en: string | null
          tags: string[]
          total_stock: number
          updated_at: string
          weight_kg: number | null
          width_cm: number | null
        }
        Insert: {
          allow_business?: boolean
          allow_personal?: boolean
          available_route_codes?: string[]
          brand?: string | null
          business_air_route_code?: string | null
          business_sea_route_code?: string | null
          cargo_type?: string
          category_id?: string | null
          compare_price_cad?: number | null
          compare_price_cny?: number | null
          cover_url?: string | null
          created_at?: string
          customs_antidumping_rate?: number
          customs_gst_rate?: number
          customs_mfn_rate?: number
          description?: string | null
          description_en?: string | null
          detail_blocks?: Json
          freight_cny?: number
          height_cm?: number | null
          hs_code?: string | null
          id?: string
          images?: Json
          length_cm?: number | null
          manufacturer?: string | null
          moq?: number
          name: string
          name_en?: string | null
          pack_height_cm?: number | null
          pack_length_cm?: number | null
          pack_qty?: number
          pack_volume_m3?: number | null
          pack_weight_kg?: number | null
          pack_width_cm?: number | null
          personal_air_route_code?: string | null
          personal_freight_mode?: string
          personal_per_unit_freight_air_cny?: number
          personal_per_unit_freight_cny?: number
          personal_per_unit_freight_sea_cny?: number
          personal_sea_route_code?: string | null
          price_cny?: number
          purchase_type?: Database["public"]["Enums"]["product_purchase_type"]
          sku: string
          slug: string
          sold_count?: number
          status?: Database["public"]["Enums"]["product_status"]
          subtitle?: string | null
          subtitle_en?: string | null
          tags?: string[]
          total_stock?: number
          updated_at?: string
          weight_kg?: number | null
          width_cm?: number | null
        }
        Update: {
          allow_business?: boolean
          allow_personal?: boolean
          available_route_codes?: string[]
          brand?: string | null
          business_air_route_code?: string | null
          business_sea_route_code?: string | null
          cargo_type?: string
          category_id?: string | null
          compare_price_cad?: number | null
          compare_price_cny?: number | null
          cover_url?: string | null
          created_at?: string
          customs_antidumping_rate?: number
          customs_gst_rate?: number
          customs_mfn_rate?: number
          description?: string | null
          description_en?: string | null
          detail_blocks?: Json
          freight_cny?: number
          height_cm?: number | null
          hs_code?: string | null
          id?: string
          images?: Json
          length_cm?: number | null
          manufacturer?: string | null
          moq?: number
          name?: string
          name_en?: string | null
          pack_height_cm?: number | null
          pack_length_cm?: number | null
          pack_qty?: number
          pack_volume_m3?: number | null
          pack_weight_kg?: number | null
          pack_width_cm?: number | null
          personal_air_route_code?: string | null
          personal_freight_mode?: string
          personal_per_unit_freight_air_cny?: number
          personal_per_unit_freight_cny?: number
          personal_per_unit_freight_sea_cny?: number
          personal_sea_route_code?: string | null
          price_cny?: number
          purchase_type?: Database["public"]["Enums"]["product_purchase_type"]
          sku?: string
          slug?: string
          sold_count?: number
          status?: Database["public"]["Enums"]["product_status"]
          subtitle?: string | null
          subtitle_en?: string | null
          tags?: string[]
          total_stock?: number
          updated_at?: string
          weight_kg?: number | null
          width_cm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          blacklist_reason: string | null
          created_at: string
          customer_code: string | null
          email: string | null
          fee_scheme_preference: Database["public"]["Enums"]["fee_scheme_preference"]
          full_name: string | null
          id: string
          is_blacklisted: boolean
          phone: string | null
          points: number
          preferred_currency: string
          preferred_lang: string
          reg_address: string | null
          reg_city: string | null
          reg_country: string | null
          reg_phone: string | null
          reg_postal_code: string | null
          reg_province: string | null
          updated_at: string
          username: string | null
          vip_level: Database["public"]["Enums"]["vip_level"]
        }
        Insert: {
          avatar_url?: string | null
          blacklist_reason?: string | null
          created_at?: string
          customer_code?: string | null
          email?: string | null
          fee_scheme_preference?: Database["public"]["Enums"]["fee_scheme_preference"]
          full_name?: string | null
          id: string
          is_blacklisted?: boolean
          phone?: string | null
          points?: number
          preferred_currency?: string
          preferred_lang?: string
          reg_address?: string | null
          reg_city?: string | null
          reg_country?: string | null
          reg_phone?: string | null
          reg_postal_code?: string | null
          reg_province?: string | null
          updated_at?: string
          username?: string | null
          vip_level?: Database["public"]["Enums"]["vip_level"]
        }
        Update: {
          avatar_url?: string | null
          blacklist_reason?: string | null
          created_at?: string
          customer_code?: string | null
          email?: string | null
          fee_scheme_preference?: Database["public"]["Enums"]["fee_scheme_preference"]
          full_name?: string | null
          id?: string
          is_blacklisted?: boolean
          phone?: string | null
          points?: number
          preferred_currency?: string
          preferred_lang?: string
          reg_address?: string | null
          reg_city?: string | null
          reg_country?: string | null
          reg_phone?: string | null
          reg_postal_code?: string | null
          reg_province?: string | null
          updated_at?: string
          username?: string | null
          vip_level?: Database["public"]["Enums"]["vip_level"]
        }
        Relationships: []
      }
      promotions: {
        Row: {
          created_at: string
          ends_at: string | null
          id: string
          is_active: boolean
          name: string
          rules: Json
          starts_at: string | null
          type: Database["public"]["Enums"]["promo_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          rules?: Json
          starts_at?: string | null
          type?: Database["public"]["Enums"]["promo_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          rules?: Json
          starts_at?: string | null
          type?: Database["public"]["Enums"]["promo_type"]
          updated_at?: string
        }
        Relationships: []
      }
      receiving_scans: {
        Row: {
          code: string
          id: string
          kind: string
          note: string | null
          operator_id: string | null
          receiving_id: string
          ref_id: string
          scanned_at: string
        }
        Insert: {
          code: string
          id?: string
          kind: string
          note?: string | null
          operator_id?: string | null
          receiving_id: string
          ref_id: string
          scanned_at?: string
        }
        Update: {
          code?: string
          id?: string
          kind?: string
          note?: string | null
          operator_id?: string | null
          receiving_id?: string
          ref_id?: string
          scanned_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "receiving_scans_receiving_id_fkey"
            columns: ["receiving_id"]
            isOneToOne: false
            referencedRelation: "receivings"
            referencedColumns: ["id"]
          },
        ]
      }
      receivings: {
        Row: {
          batch_id: string | null
          confirmed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          receiving_no: string
          status: string
          updated_at: string
          warehouse_code: string | null
        }
        Insert: {
          batch_id?: string | null
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          receiving_no: string
          status?: string
          updated_at?: string
          warehouse_code?: string | null
        }
        Update: {
          batch_id?: string | null
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          receiving_no?: string
          status?: string
          updated_at?: string
          warehouse_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receivings_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          carrier: string | null
          created_at: string
          current_location: string | null
          eta: string | null
          id: string
          order_id: string | null
          shipping_method: string
          status: string
          tracking_no: string
          updated_at: string
        }
        Insert: {
          carrier?: string | null
          created_at?: string
          current_location?: string | null
          eta?: string | null
          id?: string
          order_id?: string | null
          shipping_method?: string
          status?: string
          tracking_no: string
          updated_at?: string
        }
        Update: {
          carrier?: string | null
          created_at?: string
          current_location?: string | null
          eta?: string | null
          id?: string
          order_id?: string | null
          shipping_method?: string
          status?: string
          tracking_no?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_routes: {
        Row: {
          blacklist_customer_codes: string[]
          blacklist_vip_levels: Database["public"]["Enums"]["vip_level"][]
          cargo_type: string
          code: string
          created_at: string
          destination_code: string | null
          destination_warehouse_id: string | null
          id: string
          is_active: boolean
          is_bidirectional: boolean
          item_field_required: Json
          item_fields: string[]
          last_mile_fee_cad: number
          last_mile_formula: string | null
          last_mile_rate_cad: number
          last_mile_step_kg: number
          last_mile_threshold_kg: number
          name_en: string | null
          name_zh: string
          note: string | null
          origin_warehouse_id: string | null
          sales_tax_enabled: boolean
          sales_tax_rate_pct: number
          shipping_method: string
          sort_order: number
          transit_days_max: number | null
          transit_days_min: number | null
          updated_at: string
          usage_scope: string
          visible_customer_codes: string[]
          visible_vip_levels: Database["public"]["Enums"]["vip_level"][]
        }
        Insert: {
          blacklist_customer_codes?: string[]
          blacklist_vip_levels?: Database["public"]["Enums"]["vip_level"][]
          cargo_type?: string
          code: string
          created_at?: string
          destination_code?: string | null
          destination_warehouse_id?: string | null
          id?: string
          is_active?: boolean
          is_bidirectional?: boolean
          item_field_required?: Json
          item_fields?: string[]
          last_mile_fee_cad?: number
          last_mile_formula?: string | null
          last_mile_rate_cad?: number
          last_mile_step_kg?: number
          last_mile_threshold_kg?: number
          name_en?: string | null
          name_zh: string
          note?: string | null
          origin_warehouse_id?: string | null
          sales_tax_enabled?: boolean
          sales_tax_rate_pct?: number
          shipping_method: string
          sort_order?: number
          transit_days_max?: number | null
          transit_days_min?: number | null
          updated_at?: string
          usage_scope?: string
          visible_customer_codes?: string[]
          visible_vip_levels?: Database["public"]["Enums"]["vip_level"][]
        }
        Update: {
          blacklist_customer_codes?: string[]
          blacklist_vip_levels?: Database["public"]["Enums"]["vip_level"][]
          cargo_type?: string
          code?: string
          created_at?: string
          destination_code?: string | null
          destination_warehouse_id?: string | null
          id?: string
          is_active?: boolean
          is_bidirectional?: boolean
          item_field_required?: Json
          item_fields?: string[]
          last_mile_fee_cad?: number
          last_mile_formula?: string | null
          last_mile_rate_cad?: number
          last_mile_step_kg?: number
          last_mile_threshold_kg?: number
          name_en?: string | null
          name_zh?: string
          note?: string | null
          origin_warehouse_id?: string | null
          sales_tax_enabled?: boolean
          sales_tax_rate_pct?: number
          shipping_method?: string
          sort_order?: number
          transit_days_max?: number | null
          transit_days_min?: number | null
          updated_at?: string
          usage_scope?: string
          visible_customer_codes?: string[]
          visible_vip_levels?: Database["public"]["Enums"]["vip_level"][]
        }
        Relationships: [
          {
            foreignKeyName: "shipping_routes_destination_warehouse_id_fkey"
            columns: ["destination_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_routes_origin_warehouse_id_fkey"
            columns: ["origin_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_refunds: {
        Row: {
          amount_cny: number
          created_at: string
          id: string
          operator_id: string | null
          order_id: string
          processed_at: string | null
          reason: string | null
          status: string
        }
        Insert: {
          amount_cny?: number
          created_at?: string
          id?: string
          operator_id?: string | null
          order_id: string
          processed_at?: string | null
          reason?: string | null
          status?: string
        }
        Update: {
          amount_cny?: number
          created_at?: string
          id?: string
          operator_id?: string | null
          order_id?: string
          processed_at?: string | null
          reason?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_refunds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      surcharges: {
        Row: {
          amount_cny: number
          batch_id: string | null
          carton_id: string | null
          created_at: string
          created_by: string | null
          customer_code: string | null
          forwarding_id: string | null
          id: string
          note: string
          pallet_id: string | null
          scope: Database["public"]["Enums"]["surcharge_scope"]
          updated_at: string
          waybill_id: string | null
        }
        Insert: {
          amount_cny?: number
          batch_id?: string | null
          carton_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_code?: string | null
          forwarding_id?: string | null
          id?: string
          note?: string
          pallet_id?: string | null
          scope: Database["public"]["Enums"]["surcharge_scope"]
          updated_at?: string
          waybill_id?: string | null
        }
        Update: {
          amount_cny?: number
          batch_id?: string | null
          carton_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_code?: string | null
          forwarding_id?: string | null
          id?: string
          note?: string
          pallet_id?: string | null
          scope?: Database["public"]["Enums"]["surcharge_scope"]
          updated_at?: string
          waybill_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "surcharges_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "surcharges_carton_id_fkey"
            columns: ["carton_id"]
            isOneToOne: false
            referencedRelation: "cartons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "surcharges_forwarding_id_fkey"
            columns: ["forwarding_id"]
            isOneToOne: false
            referencedRelation: "forwarding_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "surcharges_pallet_id_fkey"
            columns: ["pallet_id"]
            isOneToOne: false
            referencedRelation: "pallets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "surcharges_waybill_id_fkey"
            columns: ["waybill_id"]
            isOneToOne: false
            referencedRelation: "waybills"
            referencedColumns: ["id"]
          },
        ]
      }
      tracking_event_presets: {
        Row: {
          code: string
          created_at: string
          default_location_en: string | null
          default_location_zh: string | null
          id: string
          is_active: boolean
          label_en: string | null
          label_zh: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          default_location_en?: string | null
          default_location_zh?: string | null
          id?: string
          is_active?: boolean
          label_en?: string | null
          label_zh: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          default_location_en?: string | null
          default_location_zh?: string | null
          id?: string
          is_active?: boolean
          label_en?: string | null
          label_zh?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      tracking_events: {
        Row: {
          created_at: string
          event_time: string
          id: string
          location_en: string | null
          location_zh: string | null
          shipment_id: string
          source: string
          source_ref: string | null
          status_en: string
          status_zh: string
        }
        Insert: {
          created_at?: string
          event_time?: string
          id?: string
          location_en?: string | null
          location_zh?: string | null
          shipment_id: string
          source?: string
          source_ref?: string | null
          status_en: string
          status_zh: string
        }
        Update: {
          created_at?: string
          event_time?: string
          id?: string
          location_en?: string | null
          location_zh?: string | null
          shipment_id?: string
          source?: string
          source_ref?: string | null
          status_en?: string
          status_zh?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracking_events_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      variant_stocks: {
        Row: {
          created_at: string
          id: string
          stock: number
          updated_at: string
          variant_id: string
          warehouse_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          stock?: number
          updated_at?: string
          variant_id: string
          warehouse_id: string
        }
        Update: {
          created_at?: string
          id?: string
          stock?: number
          updated_at?: string
          variant_id?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "variant_stocks_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variant_stocks_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_transactions: {
        Row: {
          amount_cad: number
          amount_cny: number | null
          channel: string | null
          created_at: string
          fx_rate_cny_to_cad: number | null
          id: string
          note: string | null
          ref_no: string | null
          related_order_id: string | null
          status: string
          type: string
          user_id: string
        }
        Insert: {
          amount_cad: number
          amount_cny?: number | null
          channel?: string | null
          created_at?: string
          fx_rate_cny_to_cad?: number | null
          id?: string
          note?: string | null
          ref_no?: string | null
          related_order_id?: string | null
          status?: string
          type: string
          user_id: string
        }
        Update: {
          amount_cad?: number
          amount_cny?: number | null
          channel?: string | null
          created_at?: string
          fx_rate_cny_to_cad?: number | null
          id?: string
          note?: string | null
          ref_no?: string | null
          related_order_id?: string | null
          status?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          balance_cad: number
          balance_cny: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance_cad?: number
          balance_cny?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance_cad?: number
          balance_cny?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      warehouses: {
        Row: {
          address: string | null
          business_hours: string | null
          can_destination: boolean
          can_inventory: boolean
          can_origin: boolean
          code: string
          contact: string | null
          country: string
          created_at: string
          id: string
          inout_fee_cad_per_cbm: number
          is_active: boolean
          name_en: string | null
          name_zh: string
          note: string | null
          phone: string | null
          sort_order: number
          storage_fee_cad_per_cbm_day: number
          storage_free_days: number
          type: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          business_hours?: string | null
          can_destination?: boolean
          can_inventory?: boolean
          can_origin?: boolean
          code: string
          contact?: string | null
          country: string
          created_at?: string
          id?: string
          inout_fee_cad_per_cbm?: number
          is_active?: boolean
          name_en?: string | null
          name_zh: string
          note?: string | null
          phone?: string | null
          sort_order?: number
          storage_fee_cad_per_cbm_day?: number
          storage_free_days?: number
          type?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          business_hours?: string | null
          can_destination?: boolean
          can_inventory?: boolean
          can_origin?: boolean
          code?: string
          contact?: string | null
          country?: string
          created_at?: string
          id?: string
          inout_fee_cad_per_cbm?: number
          is_active?: boolean
          name_en?: string | null
          name_zh?: string
          note?: string | null
          phone?: string | null
          sort_order?: number
          storage_fee_cad_per_cbm_day?: number
          storage_free_days?: number
          type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      waybills: {
        Row: {
          aliases: string[]
          assigned_batch_id: string | null
          batch_no: string | null
          box_no: string | null
          carton_id: string | null
          clearance_cad: number
          created_at: string
          duty_cad: number
          eta: string | null
          forwarding_id: string | null
          freight_cad: number
          height_cm: number | null
          id: string
          insurance_cad: number
          intl_tracking_no: string | null
          items_summary: Json
          length_cm: number | null
          mark_no: string | null
          note: string | null
          order_id: string | null
          pallet_id: string | null
          pallet_no: string | null
          payment_status: string
          shipping_method: string | null
          status: Database["public"]["Enums"]["waybill_status"]
          surcharge_cad: number
          updated_at: string
          user_id: string
          waybill_no: string
          weight_kg: number | null
          weight_snapshot: Json | null
          width_cm: number | null
        }
        Insert: {
          aliases?: string[]
          assigned_batch_id?: string | null
          batch_no?: string | null
          box_no?: string | null
          carton_id?: string | null
          clearance_cad?: number
          created_at?: string
          duty_cad?: number
          eta?: string | null
          forwarding_id?: string | null
          freight_cad?: number
          height_cm?: number | null
          id?: string
          insurance_cad?: number
          intl_tracking_no?: string | null
          items_summary?: Json
          length_cm?: number | null
          mark_no?: string | null
          note?: string | null
          order_id?: string | null
          pallet_id?: string | null
          pallet_no?: string | null
          payment_status?: string
          shipping_method?: string | null
          status?: Database["public"]["Enums"]["waybill_status"]
          surcharge_cad?: number
          updated_at?: string
          user_id: string
          waybill_no: string
          weight_kg?: number | null
          weight_snapshot?: Json | null
          width_cm?: number | null
        }
        Update: {
          aliases?: string[]
          assigned_batch_id?: string | null
          batch_no?: string | null
          box_no?: string | null
          carton_id?: string | null
          clearance_cad?: number
          created_at?: string
          duty_cad?: number
          eta?: string | null
          forwarding_id?: string | null
          freight_cad?: number
          height_cm?: number | null
          id?: string
          insurance_cad?: number
          intl_tracking_no?: string | null
          items_summary?: Json
          length_cm?: number | null
          mark_no?: string | null
          note?: string | null
          order_id?: string | null
          pallet_id?: string | null
          pallet_no?: string | null
          payment_status?: string
          shipping_method?: string | null
          status?: Database["public"]["Enums"]["waybill_status"]
          surcharge_cad?: number
          updated_at?: string
          user_id?: string
          waybill_no?: string
          weight_kg?: number | null
          weight_snapshot?: Json | null
          width_cm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "waybills_assigned_batch_id_fkey"
            columns: ["assigned_batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waybills_carton_id_fkey"
            columns: ["carton_id"]
            isOneToOne: false
            referencedRelation: "cartons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waybills_forwarding_id_fkey"
            columns: ["forwarding_id"]
            isOneToOne: false
            referencedRelation: "forwarding_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waybills_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waybills_pallet_id_fkey"
            columns: ["pallet_id"]
            isOneToOne: false
            referencedRelation: "pallets"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _compute_line_quote:
        | {
            Args: {
              _customs: Database["public"]["Tables"]["customs_rules"]["Row"]
              _product: Database["public"]["Tables"]["products"]["Row"]
              _qty: number
              _route: Database["public"]["Tables"]["shipping_routes"]["Row"]
              _rule: Database["public"]["Tables"]["freight_rules"]["Row"]
            }
            Returns: Json
          }
        | {
            Args: {
              _customs: Database["public"]["Tables"]["customs_rules"]["Row"]
              _mode?: string
              _product: Database["public"]["Tables"]["products"]["Row"]
              _qty: number
              _route: Database["public"]["Tables"]["shipping_routes"]["Row"]
              _rule: Database["public"]["Tables"]["freight_rules"]["Row"]
            }
            Returns: Json
          }
      _product_route_code: {
        Args: {
          _method: string
          _mode: string
          _p: Database["public"]["Tables"]["products"]["Row"]
        }
        Returns: string
      }
      check_username_available: {
        Args: { p_username: string }
        Returns: boolean
      }
      check_email_available: {
        Args: { p_email: string }
        Returns: boolean
      }
      check_phone_available: {
        Args: { p_phone: string }
        Returns: boolean
      }
      normalize_phone: {
        Args: { p_phone: string }
        Returns: string
      }
      resolve_login_email: {
        Args: { p_identifier: string }
        Returns: string
      }
      admin_change_route: {
        Args: {
          _entity_id: string
          _entity_type: string
          _new_route_code: string
          _note?: string
          _operator_id?: string
        }
        Returns: Json
      }
      admin_ship_shop_order: { Args: { _order_id: string }; Returns: Json }
      batch_payment_status: { Args: { _batch_id: string }; Returns: string }
      resolve_hs_code_rates: {
        Args: {
          p_gst_rate: number
          p_hs_code: string
          p_mfn_rate: number
          p_name_zh: string
          p_sima_involved: boolean
          p_unit: string
        }
        Returns: Json
      }
      carton_payment_status: { Args: { _carton_id: string }; Returns: string }
      find_by_any_no: { Args: { _input: string }; Returns: Json }
      gen_customer_code: { Args: never; Returns: string }
      gen_waybill_no: {
        Args: {
          _customer_code: string
          _destination_code?: string
          _route_code?: string
          _shipping_method?: string
        }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      lookup_shipment: { Args: { _tracking_no: string }; Returns: Json }
      track_by_any_no: { Args: { _input: string }; Returns: Json }
      mark_invoices_overdue: { Args: never; Returns: number }
      normalize_no: { Args: { _input: string }; Returns: string }
      pallet_payment_status: { Args: { _pallet_id: string }; Returns: string }
      pay_batch: { Args: { _batch_no: string }; Returns: Json }
      pay_invoice: { Args: { _invoice_id: string }; Returns: Json }
      pay_order_items: { Args: { _item_ids: string[] }; Returns: Json }
      place_forwarding: { Args: { _payload: Json }; Returns: Json }
      place_shop_order: { Args: { _payload: Json }; Returns: Json }
      quote_shop_order: { Args: { _payload: Json }; Returns: Json }
      recompute_mark_nos_for_parent: {
        Args: { _forwarding_id: string; _order_id: string }
        Returns: undefined
      }
      recompute_waybill_items_summary: {
        Args: { _waybill_id: string }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      unpaid_batches_summary: {
        Args: never
        Returns: {
          batch_no: string
          shipping_method: string
          total_cny: number
        }[]
      }
      validate_coupon: {
        Args: { _code: string; _subtotal_cny: number }
        Returns: Json
      }
      waybill_status_rank: {
        Args: { _s: Database["public"]["Enums"]["waybill_status"] }
        Returns: number
      }
    }
    Enums: {
      app_role:
        | "owner"
        | "manager"
        | "warehouse_cn"
        | "warehouse_ca"
        | "driver"
        | "pickup_point"
        | "sales"
        | "support"
        | "customer"
      batch_method: "air" | "sea" | "express"
      batch_status: "draft" | "locked" | "shipped" | "arrived" | "closed"
      cms_status: "draft" | "published" | "archived"
      coupon_type: "fixed" | "percent"
      fee_scheme_preference: "merged" | "split"
      inv_reason: "in" | "out" | "adjust" | "sale" | "return"
      invoice_status: "unpaid" | "paid" | "overdue" | "void"
      invoice_type: "waybill" | "batch" | "monthly" | "manual" | "shop"
      order_status:
        | "pending"
        | "paid"
        | "procurement"
        | "received"
        | "packed"
        | "in_transit"
        | "ready_pickup"
        | "processing"
        | "shipped"
        | "delivered"
        | "cancelled"
        | "storage"
        | "arrived"
      product_purchase_type: "personal" | "business"
      product_status: "draft" | "active" | "archived"
      promo_type: "discount" | "bundle" | "flash"
      surcharge_scope: "waybill" | "carton" | "pallet" | "batch" | "forwarding"
      vip_level: "normal" | "silver" | "gold" | "diamond"
      waybill_status:
        | "pending"
        | "received"
        | "packed"
        | "shipped"
        | "in_transit"
        | "ready_pickup"
        | "delivered"
        | "cancelled"
        | "procurement"
        | "storage"
        | "arrived"
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
      app_role: [
        "owner",
        "manager",
        "warehouse_cn",
        "warehouse_ca",
        "driver",
        "pickup_point",
        "sales",
        "support",
        "customer",
      ],
      batch_method: ["air", "sea", "express"],
      batch_status: ["draft", "locked", "shipped", "arrived", "closed"],
      cms_status: ["draft", "published", "archived"],
      coupon_type: ["fixed", "percent"],
      fee_scheme_preference: ["merged", "split"],
      inv_reason: ["in", "out", "adjust", "sale", "return"],
      invoice_status: ["unpaid", "paid", "overdue", "void"],
      invoice_type: ["waybill", "batch", "monthly", "manual", "shop"],
      order_status: [
        "pending",
        "paid",
        "procurement",
        "received",
        "packed",
        "in_transit",
        "ready_pickup",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
        "storage",
        "arrived",
      ],
      product_purchase_type: ["personal", "business"],
      product_status: ["draft", "active", "archived"],
      promo_type: ["discount", "bundle", "flash"],
      surcharge_scope: ["waybill", "carton", "pallet", "batch", "forwarding"],
      vip_level: ["normal", "silver", "gold", "diamond"],
      waybill_status: [
        "pending",
        "received",
        "packed",
        "shipped",
        "in_transit",
        "ready_pickup",
        "delivered",
        "cancelled",
        "procurement",
        "storage",
        "arrived",
      ],
    },
  },
} as const
