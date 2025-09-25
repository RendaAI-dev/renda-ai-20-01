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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      poupeja_asaas_customers: {
        Row: {
          asaas_customer_id: string
          cpf: string | null
          created_at: string | null
          email: string
          id: string
          name: string | null
          phone: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          asaas_customer_id: string
          cpf?: string | null
          created_at?: string | null
          email: string
          id?: string
          name?: string | null
          phone?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          asaas_customer_id?: string
          cpf?: string | null
          created_at?: string | null
          email?: string
          id?: string
          name?: string | null
          phone?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poupeja_asaas_customers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "poupeja_users"
            referencedColumns: ["id"]
          },
        ]
      }
      poupeja_asaas_payments: {
        Row: {
          amount: number
          asaas_customer_id: string
          asaas_payment_id: string
          bank_slip_url: string | null
          confirmed_date: string | null
          created_at: string | null
          description: string | null
          due_date: string
          external_reference: string | null
          id: string
          invoice_url: string | null
          method: string | null
          payment_date: string | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount: number
          asaas_customer_id: string
          asaas_payment_id: string
          bank_slip_url?: string | null
          confirmed_date?: string | null
          created_at?: string | null
          description?: string | null
          due_date: string
          external_reference?: string | null
          id?: string
          invoice_url?: string | null
          method?: string | null
          payment_date?: string | null
          status: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          asaas_customer_id?: string
          asaas_payment_id?: string
          bank_slip_url?: string | null
          confirmed_date?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string
          external_reference?: string | null
          id?: string
          invoice_url?: string | null
          method?: string | null
          payment_date?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poupeja_asaas_payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "poupeja_users"
            referencedColumns: ["id"]
          },
        ]
      }
      poupeja_categories: {
        Row: {
          color: string
          created_at: string | null
          icon: string | null
          id: string
          is_default: boolean | null
          name: string
          type: string
          user_id: string | null
        }
        Insert: {
          color?: string
          created_at?: string | null
          icon?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          type: string
          user_id?: string | null
        }
        Update: {
          color?: string
          created_at?: string | null
          icon?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      poupeja_customers: {
        Row: {
          created_at: string | null
          email: string
          id: string
          stripe_customer_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          stripe_customer_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          stripe_customer_id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      poupeja_device_tokens: {
        Row: {
          created_at: string
          id: string
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      poupeja_goals: {
        Row: {
          color: string | null
          created_at: string | null
          current_amount: number | null
          deadline: string | null
          end_date: string | null
          id: string
          name: string
          start_date: string
          target_amount: number
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          current_amount?: number | null
          deadline?: string | null
          end_date?: string | null
          id?: string
          name: string
          start_date: string
          target_amount: number
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          current_amount?: number | null
          deadline?: string | null
          end_date?: string | null
          id?: string
          name?: string
          start_date?: string
          target_amount?: number
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      poupeja_notification_logs: {
        Row: {
          body: string
          created_at: string
          data: Json | null
          id: string
          results: Json | null
          sent_at: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          data?: Json | null
          id?: string
          results?: Json | null
          sent_at?: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          data?: Json | null
          id?: string
          results?: Json | null
          sent_at?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      poupeja_notifications: {
        Row: {
          category: string | null
          created_at: string
          data: Json | null
          expires_at: string | null
          id: string
          is_read: boolean
          message: string
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          data?: Json | null
          expires_at?: string | null
          id?: string
          is_read?: boolean
          message: string
          read_at?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          data?: Json | null
          expires_at?: string | null
          id?: string
          is_read?: boolean
          message?: string
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      poupeja_payment_redirects: {
        Row: {
          asaas_payment_id: string
          checkout_id: string | null
          created_at: string
          expires_at: string
          id: string
          invoice_url: string
          processed: boolean | null
          user_id: string
        }
        Insert: {
          asaas_payment_id: string
          checkout_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          invoice_url: string
          processed?: boolean | null
          user_id: string
        }
        Update: {
          asaas_payment_id?: string
          checkout_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          invoice_url?: string
          processed?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      poupeja_plan_change_requests: {
        Row: {
          asaas_payment_id: string | null
          created_at: string
          current_plan_type: string
          expires_at: string
          id: string
          new_plan_type: string
          new_plan_value: number
          payment_url: string | null
          status: string
          subscription_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          asaas_payment_id?: string | null
          created_at?: string
          current_plan_type: string
          expires_at?: string
          id?: string
          new_plan_type: string
          new_plan_value: number
          payment_url?: string | null
          status?: string
          subscription_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          asaas_payment_id?: string | null
          created_at?: string
          current_plan_type?: string
          expires_at?: string
          id?: string
          new_plan_type?: string
          new_plan_value?: number
          payment_url?: string | null
          status?: string
          subscription_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      poupeja_plans: {
        Row: {
          asaas_price_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          features: Json | null
          id: string
          is_active: boolean | null
          is_popular: boolean | null
          limitations: Json | null
          max_users: number | null
          metadata: Json | null
          name: string
          plan_period: Database["public"]["Enums"]["plan_period"]
          price: number
          price_original: number | null
          slug: string
          sort_order: number | null
          trial_days: number | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          asaas_price_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          is_popular?: boolean | null
          limitations?: Json | null
          max_users?: number | null
          metadata?: Json | null
          name: string
          plan_period?: Database["public"]["Enums"]["plan_period"]
          price?: number
          price_original?: number | null
          slug: string
          sort_order?: number | null
          trial_days?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          asaas_price_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          is_popular?: boolean | null
          limitations?: Json | null
          max_users?: number | null
          metadata?: Json | null
          name?: string
          plan_period?: Database["public"]["Enums"]["plan_period"]
          price?: number
          price_original?: number | null
          slug?: string
          sort_order?: number | null
          trial_days?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      poupeja_scheduled_transactions: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string | null
          description: string | null
          goal_id: string | null
          id: string
          last_execution_date: string | null
          next_execution_date: string | null
          paid_amount: number | null
          paid_date: string | null
          recurrence: string | null
          scheduled_date: string
          status: string | null
          type: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          goal_id?: string | null
          id?: string
          last_execution_date?: string | null
          next_execution_date?: string | null
          paid_amount?: number | null
          paid_date?: string | null
          recurrence?: string | null
          scheduled_date: string
          status?: string | null
          type: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          goal_id?: string | null
          id?: string
          last_execution_date?: string | null
          next_execution_date?: string | null
          paid_amount?: number | null
          paid_date?: string | null
          recurrence?: string | null
          scheduled_date?: string
          status?: string | null
          type?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "poupeja_scheduled_transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "poupeja_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poupeja_scheduled_transactions_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "poupeja_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      poupeja_settings: {
        Row: {
          category: string
          created_at: string | null
          created_by: string | null
          description: string | null
          encrypted: boolean | null
          id: string
          key: string
          updated_at: string | null
          updated_by: string | null
          value: string | null
          value_type: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          encrypted?: boolean | null
          id?: string
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value?: string | null
          value_type?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          encrypted?: boolean | null
          id?: string
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: string | null
          value_type?: string | null
        }
        Relationships: []
      }
      poupeja_settings_history: {
        Row: {
          action: string
          category: string
          changed_at: string | null
          changed_by: string | null
          id: string
          key: string
          new_value: string | null
          old_value: string | null
          setting_id: string | null
        }
        Insert: {
          action: string
          category: string
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          key: string
          new_value?: string | null
          old_value?: string | null
          setting_id?: string | null
        }
        Update: {
          action?: string
          category?: string
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          key?: string
          new_value?: string | null
          old_value?: string | null
          setting_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "poupeja_settings_history_setting_id_fkey"
            columns: ["setting_id"]
            isOneToOne: false
            referencedRelation: "poupeja_settings"
            referencedColumns: ["id"]
          },
        ]
      }
      poupeja_subscriptions: {
        Row: {
          asaas_customer_id: string | null
          asaas_subscription_id: string | null
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          grace_period_end: string | null
          id: string
          payment_processor: string | null
          plan_type: string
          status: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          grace_period_end?: string | null
          id?: string
          payment_processor?: string | null
          plan_type: string
          status: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          grace_period_end?: string | null
          id?: string
          payment_processor?: string | null
          plan_type?: string
          status?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_poupeja_subscriptions_user_id"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "poupeja_users"
            referencedColumns: ["id"]
          },
        ]
      }
      poupeja_tokenized_cards: {
        Row: {
          asaas_customer_id: string
          created_at: string
          credit_card_brand: string
          credit_card_last_four: string
          credit_card_number: string
          credit_card_token: string
          expires_at: string | null
          holder_name: string
          id: string
          is_active: boolean | null
          is_default: boolean | null
          last_used_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          asaas_customer_id: string
          created_at?: string
          credit_card_brand: string
          credit_card_last_four: string
          credit_card_number: string
          credit_card_token: string
          expires_at?: string | null
          holder_name: string
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          last_used_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          asaas_customer_id?: string
          created_at?: string
          credit_card_brand?: string
          credit_card_last_four?: string
          credit_card_number?: string
          credit_card_token?: string
          expires_at?: string | null
          holder_name?: string
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          last_used_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      poupeja_transactions: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string | null
          date: string
          description: string | null
          goal_id: string | null
          id: string
          type: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string | null
          date: string
          description?: string | null
          goal_id?: string | null
          id?: string
          type: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string | null
          date?: string
          description?: string | null
          goal_id?: string | null
          id?: string
          type?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "poupeja_transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "poupeja_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poupeja_transactions_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "poupeja_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      poupeja_uploads: {
        Row: {
          created_at: string | null
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          purpose: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          purpose?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          purpose?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "poupeja_uploads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "poupeja_users"
            referencedColumns: ["id"]
          },
        ]
      }
      poupeja_user_preferences: {
        Row: {
          created_at: string
          id: string
          notification_preferences: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notification_preferences?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notification_preferences?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_poupeja_user_preferences_user_id"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "poupeja_users"
            referencedColumns: ["id"]
          },
        ]
      }
      poupeja_users: {
        Row: {
          birth_date: string | null
          cep: string | null
          city: string | null
          complement: string | null
          cpf: string | null
          created_at: string | null
          ddd: string | null
          email: string
          ibge: string | null
          id: string
          last_activity_at: string | null
          name: string | null
          neighborhood: string | null
          number: string | null
          phone: string | null
          profile_image: string | null
          state: string | null
          street: string | null
          updated_at: string | null
        }
        Insert: {
          birth_date?: string | null
          cep?: string | null
          city?: string | null
          complement?: string | null
          cpf?: string | null
          created_at?: string | null
          ddd?: string | null
          email: string
          ibge?: string | null
          id: string
          last_activity_at?: string | null
          name?: string | null
          neighborhood?: string | null
          number?: string | null
          phone?: string | null
          profile_image?: string | null
          state?: string | null
          street?: string | null
          updated_at?: string | null
        }
        Update: {
          birth_date?: string | null
          cep?: string | null
          city?: string | null
          complement?: string | null
          cpf?: string | null
          created_at?: string | null
          ddd?: string | null
          email?: string
          ibge?: string | null
          id?: string
          last_activity_at?: string | null
          name?: string | null
          neighborhood?: string | null
          number?: string | null
          phone?: string | null
          profile_image?: string | null
          state?: string | null
          street?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      poupeja_web_push_subscriptions: {
        Row: {
          created_at: string
          id: string
          subscription: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          subscription: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          subscription?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_user_roles_poupeja_users"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "poupeja_users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      buscar_cadastro_por_email: {
        Args: { p_email: string }
        Returns: {
          current_period_end: string
          email: string
          plan_type: string
          subscription_status: string
          user_id: string
        }[]
      }
      buscar_cadastro_por_email_phone: {
        Args: { p_email?: string; p_phone?: string }
        Returns: {
          current_period_end: string
          email: string
          phone: string
          plan_type: string
          subscription_status: string
          user_id: string
        }[]
      }
      calculate_discount_percentage: {
        Args: { discounted_price: number; original_price: number }
        Returns: number
      }
      check_user_role: {
        Args: {
          target_role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Returns: boolean
      }
      confirm_user_email: {
        Args: { user_email: string }
        Returns: boolean
      }
      create_default_categories_for_user: {
        Args: { user_id: string }
        Returns: undefined
      }
      create_initial_admin_user: {
        Args: { admin_email?: string }
        Returns: undefined
      }
      create_notification: {
        Args: {
          p_category?: string
          p_data?: Json
          p_message: string
          p_title: string
          p_type?: string
          p_user_id: string
        }
        Returns: string
      }
      create_update_goal_amount_function: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      decrypt_setting_value: {
        Args: { p_encrypted_value: string }
        Returns: string
      }
      encrypt_setting_value: {
        Args: { p_value: string }
        Returns: string
      }
      ensure_user_preferences: {
        Args: { user_id: string }
        Returns: string
      }
      generate_upload_path: {
        Args: { file_extension: string; user_id: string }
        Returns: string
      }
      get_file_public_url: {
        Args: { file_path: string }
        Returns: string
      }
      get_setting: {
        Args: { p_category: string; p_key: string }
        Returns: string
      }
      get_settings_by_category: {
        Args: { p_category: string }
        Returns: {
          description: string
          encrypted: boolean
          key: string
          value: string
          value_type: string
        }[]
      }
      get_unread_notifications_count: {
        Args: { p_user_id?: string }
        Returns: number
      }
      get_user_subscription_status: {
        Args: { p_user_id?: string }
        Returns: {
          current_period_end: string
          is_active: boolean
          plan_type: string
          status: string
          subscription_id: string
        }[]
      }
      grant_admin_access_to_user: {
        Args: { target_email: string }
        Returns: boolean
      }
      grant_admin_role: {
        Args: { target_email: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: {
        Args: { user_id?: string }
        Returns: boolean
      }
      mark_all_notifications_read: {
        Args: { p_user_id?: string }
        Returns: number
      }
      mark_notification_read: {
        Args: { notification_id: string }
        Returns: boolean
      }
      migrate_existing_auth_users: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      recover_missing_users: {
        Args: Record<PropertyKey, never>
        Returns: {
          recovered_count: number
        }[]
      }
      register_upload: {
        Args: {
          p_file_name: string
          p_file_path: string
          p_file_size?: number
          p_mime_type?: string
          p_purpose?: string
        }
        Returns: string
      }
      test_trigger_system: {
        Args: Record<PropertyKey, never>
        Returns: {
          details: string
          status: string
          test_name: string
        }[]
      }
      test_user_creation_system: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      update_goal_amount: {
        Args: { p_amount_change: number; p_goal_id: string }
        Returns: number
      }
      update_subscription_status: {
        Args: {
          p_cancel_at_period_end?: boolean
          p_current_period_end?: string
          p_current_period_start?: string
          p_status: string
          p_stripe_subscription_id: string
        }
        Returns: string
      }
      upsert_setting: {
        Args: {
          p_category: string
          p_description?: string
          p_encrypted?: boolean
          p_key: string
          p_value: string
          p_value_type?: string
        }
        Returns: string
      }
      validate_file_type: {
        Args: { allowed_extensions?: string[]; file_name: string }
        Returns: boolean
      }
      verify_installation: {
        Args: Record<PropertyKey, never>
        Returns: {
          component: string
          details: string
          status: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user"
      plan_period: "monthly" | "quarterly" | "semiannual" | "annual"
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
      app_role: ["admin", "user"],
      plan_period: ["monthly", "quarterly", "semiannual", "annual"],
    },
  },
} as const
