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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      bank_accounts: {
        Row: {
          account_number: string | null
          agency: string | null
          bank_name: string
          company_id: string
          created_at: string
          current_balance: number
          id: string
          updated_at: string
        }
        Insert: {
          account_number?: string | null
          agency?: string | null
          bank_name: string
          company_id: string
          created_at?: string
          current_balance?: number
          id?: string
          updated_at?: string
        }
        Update: {
          account_number?: string | null
          agency?: string | null
          bank_name?: string
          company_id?: string
          created_at?: string
          current_balance?: number
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_reconciliation_entries: {
        Row: {
          amount: number
          bank_account_id: string
          company_id: string
          created_at: string
          date: string
          external_description: string
          id: string
          status: string
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          bank_account_id: string
          company_id: string
          created_at?: string
          date: string
          external_description: string
          id?: string
          status?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          bank_account_id?: string
          company_id?: string
          created_at?: string
          date?: string
          external_description?: string
          id?: string
          status?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_reconciliation_entries_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_reconciliation_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_reconciliation_entries_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "financial_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          city: string | null
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          state: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          state?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          state?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      campanhas: {
        Row: {
          bonus_percent: number
          company_id: string
          created_at: string
          created_by: string | null
          data_fim: string | null
          data_inicio: string
          descricao: string | null
          id: string
          meta: number
          nome: string
          status: string
          updated_at: string
        }
        Insert: {
          bonus_percent?: number
          company_id: string
          created_at?: string
          created_by?: string | null
          data_fim?: string | null
          data_inicio?: string
          descricao?: string | null
          id?: string
          meta?: number
          nome: string
          status?: string
          updated_at?: string
        }
        Update: {
          bonus_percent?: number
          company_id?: string
          created_at?: string
          created_by?: string | null
          data_fim?: string | null
          data_inicio?: string
          descricao?: string | null
          id?: string
          meta?: number
          nome?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campanhas_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      cobrancas: {
        Row: {
          acordo: boolean
          acordo_desconto: number | null
          acordo_parcelas: number | null
          cliente_nome: string
          company_id: string
          created_at: string
          created_by: string | null
          dias_atraso: number
          faixa: string | null
          faturamento_id: string | null
          id: string
          observacao: string | null
          pessoa_id: string | null
          status: string
          ultima_cobranca: string | null
          updated_at: string
          valor: number
          vencimento: string
        }
        Insert: {
          acordo?: boolean
          acordo_desconto?: number | null
          acordo_parcelas?: number | null
          cliente_nome: string
          company_id: string
          created_at?: string
          created_by?: string | null
          dias_atraso?: number
          faixa?: string | null
          faturamento_id?: string | null
          id?: string
          observacao?: string | null
          pessoa_id?: string | null
          status?: string
          ultima_cobranca?: string | null
          updated_at?: string
          valor?: number
          vencimento: string
        }
        Update: {
          acordo?: boolean
          acordo_desconto?: number | null
          acordo_parcelas?: number | null
          cliente_nome?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          dias_atraso?: number
          faixa?: string | null
          faturamento_id?: string | null
          id?: string
          observacao?: string | null
          pessoa_id?: string | null
          status?: string
          ultima_cobranca?: string | null
          updated_at?: string
          valor?: number
          vencimento?: string
        }
        Relationships: [
          {
            foreignKeyName: "cobrancas_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobrancas_faturamento_id_fkey"
            columns: ["faturamento_id"]
            isOneToOne: false
            referencedRelation: "faturamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobrancas_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
        ]
      }
      colaboradores: {
        Row: {
          admissao: string | null
          agencia: string | null
          banco: string | null
          cargo: string
          chave_pix: string | null
          comissao_percent: number
          comissao_tipo: string
          company_id: string
          conta: string | null
          contrato: string
          cpf: string | null
          created_at: string
          created_by: string | null
          id: string
          nome: string
          salario_base: number
          status: string
          tipo_conta: string | null
          tipo_remuneracao: string
          updated_at: string
        }
        Insert: {
          admissao?: string | null
          agencia?: string | null
          banco?: string | null
          cargo?: string
          chave_pix?: string | null
          comissao_percent?: number
          comissao_tipo?: string
          company_id: string
          conta?: string | null
          contrato?: string
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          nome: string
          salario_base?: number
          status?: string
          tipo_conta?: string | null
          tipo_remuneracao?: string
          updated_at?: string
        }
        Update: {
          admissao?: string | null
          agencia?: string | null
          banco?: string | null
          cargo?: string
          chave_pix?: string | null
          comissao_percent?: number
          comissao_tipo?: string
          company_id?: string
          conta?: string | null
          contrato?: string
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          nome?: string
          salario_base?: number
          status?: string
          tipo_conta?: string | null
          tipo_remuneracao?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "colaboradores_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      comissoes_folha: {
        Row: {
          cliente: string
          colaborador_id: string
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          periodo: string
          status: string
          updated_at: string
          valor: number
        }
        Insert: {
          cliente?: string
          colaborador_id: string
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          periodo?: string
          status?: string
          updated_at?: string
          valor?: number
        }
        Update: {
          cliente?: string
          colaborador_id?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          periodo?: string
          status?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "comissoes_folha_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_folha_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          accent_color: string | null
          created_at: string
          id: string
          initials: string
          logo_dark_url: string | null
          logo_url: string | null
          name: string
          primary_color: string | null
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          created_at?: string
          id?: string
          initials: string
          logo_dark_url?: string | null
          logo_url?: string | null
          name: string
          primary_color?: string | null
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          created_at?: string
          id?: string
          initials?: string
          logo_dark_url?: string | null
          logo_url?: string | null
          name?: string
          primary_color?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      company_modules: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_enabled: boolean
          module_name: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          module_name: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          module_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_modules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      descontos_folha: {
        Row: {
          colaborador_id: string
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          referencia: string
          tipo: string
          updated_at: string
          valor: number
        }
        Insert: {
          colaborador_id: string
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          referencia?: string
          tipo?: string
          updated_at?: string
          valor?: number
        }
        Update: {
          colaborador_id?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          referencia?: string
          tipo?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "descontos_folha_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "descontos_folha_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          classificacao: string | null
          color: string | null
          company_id: string
          created_at: string
          grupo: string | null
          icon: string | null
          id: string
          name: string
          parent_id: string | null
          type: string
        }
        Insert: {
          classificacao?: string | null
          color?: string | null
          company_id: string
          created_at?: string
          grupo?: string | null
          icon?: string | null
          id?: string
          name: string
          parent_id?: string | null
          type?: string
        }
        Update: {
          classificacao?: string | null
          color?: string | null
          company_id?: string
          created_at?: string
          grupo?: string | null
          icon?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      faturamentos: {
        Row: {
          categoria: string | null
          cliente_nome: string
          company_id: string
          consultor: string | null
          created_at: string
          created_by: string | null
          data_emissao: string
          descricao: string | null
          id: string
          nf_emitida: boolean
          pessoa_id: string | null
          status: string
          tipo: string
          updated_at: string
          valor: number
          vencimento: string | null
        }
        Insert: {
          categoria?: string | null
          cliente_nome: string
          company_id: string
          consultor?: string | null
          created_at?: string
          created_by?: string | null
          data_emissao?: string
          descricao?: string | null
          id?: string
          nf_emitida?: boolean
          pessoa_id?: string | null
          status?: string
          tipo?: string
          updated_at?: string
          valor?: number
          vencimento?: string | null
        }
        Update: {
          categoria?: string | null
          cliente_nome?: string
          company_id?: string
          consultor?: string | null
          created_at?: string
          created_by?: string | null
          data_emissao?: string
          descricao?: string | null
          id?: string
          nf_emitida?: boolean
          pessoa_id?: string | null
          status?: string
          tipo?: string
          updated_at?: string
          valor?: number
          vencimento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "faturamentos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faturamentos_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_transactions: {
        Row: {
          amount: number
          category_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          date: string
          description: string
          entity_name: string | null
          id: string
          payment_date: string | null
          payment_method: string | null
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          date?: string
          description: string
          entity_name?: string | null
          id?: string
          payment_date?: string | null
          payment_method?: string | null
          status?: string
          type: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string
          entity_name?: string | null
          id?: string
          payment_date?: string | null
          payment_method?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      pessoas: {
        Row: {
          agencia: string | null
          banco: string | null
          company_id: string
          condicao_pagamento: string | null
          conta: string | null
          cpf_cnpj: string | null
          created_at: string
          created_by: string | null
          email: string | null
          forma_pagamento: string | null
          id: string
          municipio: string | null
          razao_social: string
          responsavel: string | null
          telefone: string | null
          tipo: string
          tipo_servico: string | null
          uf: string | null
          updated_at: string
        }
        Insert: {
          agencia?: string | null
          banco?: string | null
          company_id: string
          condicao_pagamento?: string | null
          conta?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          forma_pagamento?: string | null
          id?: string
          municipio?: string | null
          razao_social: string
          responsavel?: string | null
          telefone?: string | null
          tipo?: string
          tipo_servico?: string | null
          uf?: string | null
          updated_at?: string
        }
        Update: {
          agencia?: string | null
          banco?: string | null
          company_id?: string
          condicao_pagamento?: string | null
          conta?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          forma_pagamento?: string | null
          id?: string
          municipio?: string | null
          razao_social?: string
          responsavel?: string | null
          telefone?: string | null
          tipo?: string
          tipo_servico?: string | null
          uf?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pessoas_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_company_access: {
        Row: {
          company_id: string
          created_at: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_company_access_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_company_role: {
        Args: {
          _company_id: string
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_financial_access: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      is_company_member: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      is_master_user: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "master" | "franqueado" | "financeiro" | "leitura"
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
      app_role: ["master", "franqueado", "financeiro", "leitura"],
    },
  },
} as const
