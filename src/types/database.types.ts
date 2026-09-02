/**
 * Hand-written to match supabase/migrations/. Replace with the real thing:
 *
 *   npm run db:types
 *
 * Do not edit by hand once you have run that -- the generator overwrites it.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = 'seller' | 'administration' | 'maintenance' | 'super_admin';
/**
 * 'bank_transfer' is retained because Postgres cannot remove an enum value, but
 * the app no longer offers it -- the spec names Cash, MoMo and Orange Money
 * (A-FR-6.3), and no row anywhere uses it.
 */
export type PaymentMethod =
  | 'cash'
  | 'mobile_money'
  | 'orange_money'
  | 'bank_transfer';
export type StockMovementKind =
  | 'intake'
  | 'sale'
  | 'return'
  | 'adjustment'
  | 'collection'
  | 'production'
  /** The outgoing half of an exchange: leaves stock, but is not a sale. */
  | 'exchange';
export type AlterationStatus =
  | 'received'
  | 'in_progress'
  | 'ready'
  | 'returned'
  | 'cancelled';
export type ReturnKind = 'return' | 'exchange';
/** Declared by the seller, never assessed by the system (A-FR-8.9). */
export type GarmentCondition = 'unworn' | 'worn';
export type ReturnDirection = 'in' | 'out';
export type OrderStatus =
  | 'ordered'
  | 'in_production'
  | 'ready'
  | 'collected'
  | 'cancelled';

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          role: UserRole;
          is_active: boolean;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string;
          role?: UserRole;
          is_active?: boolean;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          role?: UserRole;
          is_active?: boolean;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          data: Json;
          link: string | null;
          is_read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: string;
          data?: Json;
          link?: string | null;
          is_read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: string;
          data?: Json;
          link?: string | null;
          is_read?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      audit_log: {
        Row: {
          id: string;
          actor_id: string | null;
          actor_name: string | null;
          action: string;
          entity: string | null;
          ip: string | null;
          target_table: string | null;
          target_id: string | null;
          previous_value: Json | null;
          new_value: Json | null;
          meta: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id?: string | null;
          actor_name?: string | null;
          action: string;
          entity?: string | null;
          ip?: string | null;
          target_table?: string | null;
          target_id?: string | null;
          previous_value?: Json | null;
          new_value?: Json | null;
          meta?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          actor_id?: string | null;
          action?: string;
          entity?: string | null;
          ip?: string | null;
          meta?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      product_prices_history: {
        Row: {
          id: string;
          product_id: string;
          old_price: number | null;
          new_price: number;
          changed_by: string | null;
          note: string | null;
          changed_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          old_price?: number | null;
          new_price: number;
          changed_by?: string | null;
          note?: string | null;
          changed_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          old_price?: number | null;
          new_price?: number;
          changed_by?: string | null;
          note?: string | null;
          changed_at?: string;
        };
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          sku: string;
          name_en: string;
          name_fr: string;
          category: string;
          size: string | null;
          unit_price: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          sku: string;
          name_en: string;
          name_fr: string;
          category?: string;
          size?: string | null;
          unit_price: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          sku?: string;
          name_en?: string;
          name_fr?: string;
          category?: string;
          size?: string | null;
          unit_price?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      sales: {
        Row: {
          id: string;
          receipt_no: string;
          sold_at: string;
          customer_name: string;
          student_name: string | null;
          class_level: string | null;
          phone: string | null;
          payment_method: PaymentMethod;
          subtotal: number;
          discount: number;
          total: number;
          notes: string | null;
          discount_reason: string | null;
          signature_url: string | null;
          seller_id: string;
          recorded_by: string | null;
          received_by: string | null;
          payment_reference: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          cancel_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          receipt_no?: string;
          sold_at?: string;
          customer_name: string;
          student_name?: string | null;
          class_level?: string | null;
          phone?: string | null;
          payment_method?: PaymentMethod;
          subtotal: number;
          discount?: number;
          total: number;
          notes?: string | null;
          discount_reason?: string | null;
          signature_url?: string | null;
          seller_id: string;
          recorded_by?: string | null;
          received_by?: string | null;
          payment_reference?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          cancel_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          receipt_no?: string;
          sold_at?: string;
          customer_name?: string;
          student_name?: string | null;
          class_level?: string | null;
          phone?: string | null;
          payment_method?: PaymentMethod;
          subtotal?: number;
          discount?: number;
          total?: number;
          notes?: string | null;
          discount_reason?: string | null;
          signature_url?: string | null;
          seller_id?: string;
          recorded_by?: string | null;
          received_by?: string | null;
          payment_reference?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          cancel_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'sales_recorded_by_fkey';
            columns: ['recorded_by'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'sales_received_by_fkey';
            columns: ['received_by'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'sales_cancelled_by_fkey';
            columns: ['cancelled_by'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'sales_seller_id_fkey';
            columns: ['seller_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      sale_items: {
        Row: {
          id: string;
          sale_id: string;
          product_id: string;
          description: string;
          size: string | null;
          unit_price: number;
          quantity: number;
          line_total: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          sale_id: string;
          product_id: string;
          description: string;
          size?: string | null;
          unit_price: number;
          quantity: number;
          line_total: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          sale_id?: string;
          product_id?: string | null;
          description?: string;
          size?: string | null;
          unit_price?: number;
          quantity?: number;
          line_total?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'sale_items_sale_id_fkey';
            columns: ['sale_id'];
            referencedRelation: 'sales';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'sale_items_product_id_fkey';
            columns: ['product_id'];
            referencedRelation: 'products';
            referencedColumns: ['id'];
          }
        ];
      };
      stock_levels: {
        Row: {
          product_id: string;
          quantity: number;
          reorder_level: number;
          updated_at: string;
        };
        Insert: {
          product_id: string;
          quantity?: number;
          reorder_level?: number;
          updated_at?: string;
        };
        Update: {
          product_id?: string;
          quantity?: number;
          reorder_level?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'stock_levels_product_id_fkey';
            columns: ['product_id'];
            referencedRelation: 'products';
            referencedColumns: ['id'];
          }
        ];
      };
      stock_movements: {
        Row: {
          id: string;
          product_id: string;
          kind: StockMovementKind;
          quantity: number;
          sale_id: string | null;
          collection_id: string | null;
          return_id: string | null;
          note: string | null;
          occurred_on: string | null;
          tailor_name: string | null;
          batch_id: string | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          kind: StockMovementKind;
          quantity: number;
          sale_id?: string | null;
          collection_id?: string | null;
          return_id?: string | null;
          note?: string | null;
          occurred_on?: string | null;
          tailor_name?: string | null;
          batch_id?: string | null;
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          kind?: StockMovementKind;
          quantity?: number;
          sale_id?: string | null;
          collection_id?: string | null;
          return_id?: string | null;
          note?: string | null;
          occurred_on?: string | null;
          tailor_name?: string | null;
          batch_id?: string | null;
          created_by?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'stock_movements_product_id_fkey';
            columns: ['product_id'];
            referencedRelation: 'products';
            referencedColumns: ['id'];
          }
        ];
      };
      orders: {
        Row: {
          id: string;
          order_no: string;
          ordered_at: string;
          expected_ready_date: string | null;
          customer_name: string;
          student_name: string | null;
          class_level: string | null;
          phone: string | null;
          payment_method: PaymentMethod;
          subtotal: number;
          discount: number;
          total: number;
          measurements: string | null;
          notes: string | null;
          seller_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_no?: string;
          ordered_at?: string;
          expected_ready_date?: string | null;
          customer_name: string;
          student_name?: string | null;
          class_level?: string | null;
          phone?: string | null;
          payment_method?: PaymentMethod;
          subtotal: number;
          discount?: number;
          total: number;
          measurements?: string | null;
          notes?: string | null;
          seller_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          order_no?: string;
          ordered_at?: string;
          expected_ready_date?: string | null;
          customer_name?: string;
          student_name?: string | null;
          class_level?: string | null;
          phone?: string | null;
          payment_method?: PaymentMethod;
          subtotal?: number;
          discount?: number;
          total?: number;
          measurements?: string | null;
          notes?: string | null;
          seller_id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'orders_seller_id_fkey';
            columns: ['seller_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          product_id: string | null;
          description: string;
          size: string | null;
          unit_price: number;
          quantity: number;
          line_total: number;
          created_at: string;
          status: OrderStatus | null;
          status_reason: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          refund_method: PaymentMethod | null;
        };
        Insert: {
          id?: string;
          order_id: string;
          product_id?: string | null;
          description: string;
          size?: string | null;
          unit_price: number;
          quantity: number;
          line_total: number;
          created_at?: string;
          status?: OrderStatus | null;
          status_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          refund_method?: PaymentMethod | null;
        };
        Update: {
          id?: string;
          order_id?: string;
          product_id?: string | null;
          description?: string;
          size?: string | null;
          unit_price?: number;
          quantity?: number;
          line_total?: number;
          created_at?: string;
          status?: OrderStatus | null;
          status_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          refund_method?: PaymentMethod | null;
        };
        Relationships: [
          {
            foreignKeyName: 'order_items_order_id_fkey';
            columns: ['order_id'];
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'order_items_cancelled_by_fkey';
            columns: ['cancelled_by'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'order_items_product_id_fkey';
            columns: ['product_id'];
            referencedRelation: 'products';
            referencedColumns: ['id'];
          }
        ];
      };
      alterations: {
        Row: {
          id: string;
          alteration_no: string;
          received_at: string;
          expected_ready_date: string | null;
          status: AlterationStatus;
          status_reason: string | null;
          customer_name: string;
          student_name: string | null;
          class_level: string | null;
          phone: string | null;
          garment: string;
          size: string | null;
          work_required: string;
          charge: number;
          payment_method: PaymentMethod | null;
          paid_at: string | null;
          notes: string | null;
          received_by: string;
          returned_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          alteration_no?: string;
          received_at?: string;
          expected_ready_date?: string | null;
          status?: AlterationStatus;
          status_reason?: string | null;
          customer_name: string;
          student_name?: string | null;
          class_level?: string | null;
          phone?: string | null;
          garment: string;
          size?: string | null;
          work_required: string;
          charge?: number;
          payment_method?: PaymentMethod | null;
          paid_at?: string | null;
          notes?: string | null;
          received_by: string;
          returned_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          alteration_no?: string;
          received_at?: string;
          expected_ready_date?: string | null;
          status?: AlterationStatus;
          status_reason?: string | null;
          customer_name?: string;
          student_name?: string | null;
          class_level?: string | null;
          phone?: string | null;
          garment?: string;
          size?: string | null;
          work_required?: string;
          charge?: number;
          payment_method?: PaymentMethod | null;
          paid_at?: string | null;
          notes?: string | null;
          received_by?: string;
          returned_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'alterations_received_by_fkey';
            columns: ['received_by'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      bug_reports: {
        Row: {
          id: string;
          reported_at: string;
          reporter_id: string | null;
          reporter_name: string | null;
          description: string;
          page_url: string | null;
          user_agent: string | null;
          screenshot: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          reported_at?: string;
          reporter_id?: string | null;
          reporter_name?: string | null;
          description: string;
          page_url?: string | null;
          user_agent?: string | null;
          screenshot?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          reported_at?: string;
          reporter_id?: string | null;
          reporter_name?: string | null;
          description?: string;
          page_url?: string | null;
          user_agent?: string | null;
          screenshot?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'bug_reports_reporter_id_fkey';
            columns: ['reporter_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      collections: {
        Row: {
          id: string;
          col_no: string;
          order_id: string;
          collected_at: string;
          collector_name: string;
          handed_over_by: string;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          col_no?: string;
          order_id: string;
          collected_at?: string;
          collector_name: string;
          handed_over_by: string;
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          col_no?: string;
          order_id?: string;
          collected_at?: string;
          collector_name?: string;
          handed_over_by?: string;
          created_by?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'collections_order_id_fkey';
            columns: ['order_id'];
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'collections_handed_over_by_fkey';
            columns: ['handed_over_by'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      collection_items: {
        Row: {
          id: string;
          collection_id: string;
          order_item_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          collection_id: string;
          order_item_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          collection_id?: string;
          order_item_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'collection_items_collection_id_fkey';
            columns: ['collection_id'];
            referencedRelation: 'collections';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'collection_items_order_item_id_fkey';
            columns: ['order_item_id'];
            referencedRelation: 'order_items';
            referencedColumns: ['id'];
          }
        ];
      };
      reference_counters: {
        Row: { prefix: string; year: number; last_value: number };
        Insert: { prefix: string; year: number; last_value?: number };
        Update: { prefix?: string; year?: number; last_value?: number };
        Relationships: [];
      };
      returns: {
        Row: {
          id: string;
          return_no: string;
          kind: ReturnKind;
          sale_id: string;
          reason: string;
          condition: GarmentCondition;
          refund_amount: number;
          refund_method: PaymentMethod | null;
          collected_amount: number;
          collected_method: PaymentMethod | null;
          returned_at: string;
          /** Stamped at record time, never recomputed: the windows are editable. */
          elapsed_days: number | null;
          policy_window_days: number | null;
          within_policy: boolean | null;
          override_reason: string | null;
          notes: string | null;
          signature_url: string | null;
          seller_id: string;
          recorded_by: string | null;
          received_by: string | null;
          created_at: string;
          updated_at: string;
        };
        /**
         * Insert exists for completeness only, and Update is deliberately
         * empty. Nothing writes here from the client: record_return() is
         * security definer and does all the writing, and RLS grants select
         * alone. A return is a correction, and a correction that can itself be
         * rewritten corrects nothing (A-FR-8.6).
         */
        Insert: {
          id?: string;
          return_no?: string;
          kind: ReturnKind;
          sale_id: string;
          reason: string;
          condition: GarmentCondition;
          refund_amount?: number;
          refund_method?: PaymentMethod | null;
          collected_amount?: number;
          collected_method?: PaymentMethod | null;
          returned_at?: string;
          notes?: string | null;
          signature_url?: string | null;
          seller_id: string;
          recorded_by?: string | null;
          received_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Record<never, never>;
        Relationships: [
          {
            foreignKeyName: 'returns_sale_id_fkey';
            columns: ['sale_id'];
            referencedRelation: 'sales';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'returns_seller_id_fkey';
            columns: ['seller_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'returns_recorded_by_fkey';
            columns: ['recorded_by'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'returns_received_by_fkey';
            columns: ['received_by'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      return_items: {
        Row: {
          id: string;
          return_id: string;
          direction: ReturnDirection;
          /** Set on the way in, null on the way out. */
          sale_item_id: string | null;
          product_id: string;
          description: string;
          size: string | null;
          unit_price: number;
          quantity: number;
          line_total: number;
        };
        Insert: {
          id?: string;
          return_id: string;
          direction: ReturnDirection;
          sale_item_id?: string | null;
          product_id: string;
          description: string;
          size?: string | null;
          unit_price: number;
          quantity: number;
          line_total: number;
        };
        Update: Record<never, never>;
        Relationships: [
          {
            foreignKeyName: 'return_items_return_id_fkey';
            columns: ['return_id'];
            referencedRelation: 'returns';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'return_items_sale_item_id_fkey';
            columns: ['sale_item_id'];
            referencedRelation: 'sale_items';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'return_items_product_id_fkey';
            columns: ['product_id'];
            referencedRelation: 'products';
            referencedColumns: ['id'];
          }
        ];
      };
      return_policy: {
        Row: {
          kind: ReturnKind;
          condition: GarmentCondition;
          /** null means never within policy -- distinct from 0, "same day only". */
          window_days: number | null;
          updated_at: string;
          updated_by: string | null;
        };
        /** Insert and delete are refused by a trigger: the four rows are fixed. */
        Insert: Record<never, never>;
        Update: {
          window_days?: number | null;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'return_policy_updated_by_fkey';
            columns: ['updated_by'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
    };
    Views: Record<never, never>;
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean };
      is_super_admin: { Args: Record<string, never>; Returns: boolean };
      is_maintenance: { Args: Record<string, never>; Returns: boolean };
      can_oversee: { Args: Record<string, never>; Returns: boolean };
      can_operate: { Args: Record<string, never>; Returns: boolean };
      current_user_role: { Args: Record<string, never>; Returns: UserRole };
      count_active_users: { Args: Record<string, never>; Returns: number };
      next_reference: { Args: { p_prefix: string }; Returns: string };
      search_transactions: {
        Args: {
          p_term: string | null;
          p_kinds?: string[] | null;
          p_stage?: string | null;
          p_from?: string | null;
          p_to?: string | null;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: {
          kind: string;
          id: string;
          reference: string;
          occurred_at: string;
          customer_name: string;
          student_name: string | null;
          phone: string | null;
          status: string | null;
          amount: number;
          match_rank: number;
          total_count: number;
        }[];
      };
      order_status_rank: { Args: { s: OrderStatus }; Returns: number };
      alteration_status_rank: { Args: { s: AlterationStatus }; Returns: number };
      collect_order_lines: {
        Args: {
          p_order_id: string;
          p_line_ids: string[];
          p_collector_name: string;
          p_handed_over_by: string;
        };
        Returns: string;
      };
      record_return: {
        Args: {
          p_sale_id: string;
          p_kind: ReturnKind;
          p_reason: string;
          p_condition: GarmentCondition;
          p_in_items: Json;
          p_out_items: Json;
          /**
           * Nullable: which one is needed depends on which way the money moved,
           * and only the server knows that -- it prices the lines. It raises if
           * the one it needs is missing.
           */
          p_refund_method: PaymentMethod | null;
          p_collected_method: PaymentMethod | null;
          p_received_by: string | null;
          p_notes: string | null;
          p_signature_url: string | null;
          /**
           * Required only when the verdict is out of policy (A-FR-8.11). The
           * function raises if it is missing then, and ignores it otherwise.
           */
          p_override_reason: string | null;
        };
        Returns: {
          id: string;
          return_no: string;
          refund_amount: number;
          collected_amount: number;
          within_policy: boolean;
          elapsed_days: number;
        }[];
      };
      /** The policy verdict, shared by the banner and by record_return. */
      return_policy_verdict: {
        Args: {
          p_sold_at: string;
          p_kind: ReturnKind;
          p_condition: GarmentCondition;
        };
        Returns: {
          elapsed_days: number;
          /** null means the combination is never within policy. */
          window_days: number | null;
          within_policy: boolean;
        }[];
      };
      /** The document ledger: all five reference series in one list. */
      list_documents: {
        Args: {
          /** null or empty means all five kinds. */
          p_kinds: string[] | null;
          p_from: string | null;
          p_to: string | null;
          p_limit: number;
          p_offset: number;
        };
        Returns: {
          kind: string;
          id: string;
          reference: string;
          issued_at: string;
          customer_name: string;
          amount: number;
          reprint_count: number;
          total_count: number;
        }[];
      };
      record_production_batch: {
        Args: {
          p_lines: Json;
          p_occurred_on: string;
          p_tailor_name: string | null;
          p_note: string | null;
        };
        Returns: string;
      };
      record_sale: {
        Args: {
          p_customer_name: string;
          p_student_name: string | null;
          p_class_level: string | null;
          p_phone: string | null;
          p_payment_method: PaymentMethod;
          p_discount: number;
          p_notes: string | null;
          p_signature_url: string | null;
          p_items: Json;
        };
        Returns: { id: string; receipt_no: string }[];
      };
      record_order: {
        Args: {
          p_customer_name: string;
          p_student_name: string | null;
          p_class_level: string | null;
          p_phone: string | null;
          p_payment_method: PaymentMethod;
          p_discount: number;
          p_expected_ready_date: string | null;
          p_measurements: string | null;
          p_notes: string | null;
          p_items: Json;
        };
        Returns: { id: string; order_no: string }[];
      };
      cancel_sale: {
        Args: { p_sale_id: string; p_reason: string };
        Returns: { id: string; receipt_no: string }[];
      };
    };
    Enums: {
      user_role: UserRole;
      payment_method: PaymentMethod;
      stock_movement_kind: StockMovementKind;
      order_status: OrderStatus;
      alteration_status: AlterationStatus;
      return_kind: ReturnKind;
      garment_condition: GarmentCondition;
      return_direction: ReturnDirection;
    };
    CompositeTypes: Record<never, never>;
  };
};

/** Convenience aliases so app code doesn't spell out the generic soup. */
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];

export type Profile = Tables<'profiles'>;
export type Product = Tables<'products'>;
export type Sale = Tables<'sales'>;
export type SaleItem = Tables<'sale_items'>;
export type StockLevel = Tables<'stock_levels'>;
export type StockMovement = Tables<'stock_movements'>;
export type Order = Tables<'orders'>;
export type OrderItem = Tables<'order_items'>;
export type Alteration = Tables<'alterations'>;
export type BugReport = Tables<'bug_reports'>;
export type Collection = Tables<'collections'>;
export type Return = Tables<'returns'>;
export type ReturnItem = Tables<'return_items'>;
export type ReturnPolicy = Tables<'return_policy'>;
export type CollectionItem = Tables<'collection_items'>;
