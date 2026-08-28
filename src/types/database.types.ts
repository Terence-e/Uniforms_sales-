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
export type PaymentMethod = 'cash' | 'mobile_money' | 'bank_transfer';
export type StockMovementKind = 'intake' | 'sale' | 'return' | 'adjustment';

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
          signature_url: string | null;
          seller_id: string;
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
          signature_url?: string | null;
          seller_id: string;
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
          signature_url?: string | null;
          seller_id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
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
          product_id: string | null;
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
          product_id?: string | null;
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
          note: string | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          kind: StockMovementKind;
          quantity: number;
          sale_id?: string | null;
          note?: string | null;
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          kind?: StockMovementKind;
          quantity?: number;
          sale_id?: string | null;
          note?: string | null;
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
    };
    Views: Record<never, never>;
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean };
      is_super_admin: { Args: Record<string, never>; Returns: boolean };
      can_oversee: { Args: Record<string, never>; Returns: boolean };
      can_operate: { Args: Record<string, never>; Returns: boolean };
      current_user_role: { Args: Record<string, never>; Returns: UserRole };
      next_receipt_no: { Args: Record<string, never>; Returns: string };
    };
    Enums: {
      user_role: UserRole;
      payment_method: PaymentMethod;
      stock_movement_kind: StockMovementKind;
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
