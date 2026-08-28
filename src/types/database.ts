export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          avatar_url: string | null;
          is_admin: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          avatar_url?: string | null;
          is_admin?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          is_admin?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      folders: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          parent_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          parent_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          parent_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      tags: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          color: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          color?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          color?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      prompts: {
        Row: {
          id: string;
          user_id: string;
          folder_id: string | null;
          title: string;
          body: string;
          model: string | null;
          is_favorite: boolean;
          is_public: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          folder_id?: string | null;
          title: string;
          body: string;
          model?: string | null;
          is_favorite?: boolean;
          is_public?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          folder_id?: string | null;
          title?: string;
          body?: string;
          model?: string | null;
          is_favorite?: boolean;
          is_public?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      prompt_tags: {
        Row: {
          prompt_id: string;
          tag_id: string;
        };
        Insert: {
          prompt_id: string;
          tag_id: string;
        };
        Update: {
          prompt_id?: string;
          tag_id?: string;
        };
        Relationships: [];
      };
      prompt_versions: {
        Row: {
          id: string;
          prompt_id: string;
          body: string;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          prompt_id: string;
          body: string;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          prompt_id?: string;
          body?: string;
          note?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      collections: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string;
          is_public: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string;
          is_public?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          description?: string;
          is_public?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      collection_prompts: {
        Row: {
          collection_id: string;
          prompt_id: string;
          added_at: string;
        };
        Insert: {
          collection_id: string;
          prompt_id: string;
          added_at?: string;
        };
        Update: {
          collection_id?: string;
          prompt_id?: string;
          added_at?: string;
        };
        Relationships: [];
      };
      workspaces: {
        Row: {
          user_id: string;
          data: Json;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          data?: Json;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          data?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      chat_conversations: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          auto_titled: boolean;
          kind: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          user_id: string;
          title?: string;
          auto_titled?: boolean;
          kind?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          auto_titled?: boolean;
          kind?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      chat_messages: {
        Row: {
          id: string;
          conversation_id: string;
          user_id: string;
          role: string;
          content: string;
          attachments: Json | null;
          files: Json | null;
          sources: Json | null;
          created_at: string;
        };
        Insert: {
          id: string;
          conversation_id: string;
          user_id: string;
          role: string;
          content?: string;
          attachments?: Json | null;
          files?: Json | null;
          sources?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          user_id?: string;
          role?: string;
          content?: string;
          attachments?: Json | null;
          files?: Json | null;
          sources?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
      admin_events: {
        Row: {
          id: string;
          user_id: string | null;
          user_label: string | null;
          event_type: string;
          metadata: Json;
          success: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          user_label?: string | null;
          event_type: string;
          metadata?: Json;
          success?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          user_label?: string | null;
          event_type?: string;
          metadata?: Json;
          success?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      groq_key_usage: {
        Row: {
          key_pool: string;
          key_label: string;
          usage_date: string;
          request_count: number;
          success_count: number;
          failure_count: number;
          updated_at: string;
        };
        Insert: {
          key_pool: string;
          key_label: string;
          usage_date?: string;
          request_count?: number;
          success_count?: number;
          failure_count?: number;
          updated_at?: string;
        };
        Update: {
          key_pool?: string;
          key_label?: string;
          usage_date?: string;
          request_count?: number;
          success_count?: number;
          failure_count?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      system_settings: {
        Row: {
          id: boolean;
          forge_ai_enabled: boolean;
          recipe_forge_enabled: boolean;
          critic_enabled: boolean;
          maintenance_mode: boolean;
          codeforge_enabled: boolean;
          studyforge_enabled: boolean;
          pptforge_enabled: boolean;
          updated_at: string;
        };
        Insert: {
          id?: boolean;
          forge_ai_enabled?: boolean;
          recipe_forge_enabled?: boolean;
          critic_enabled?: boolean;
          maintenance_mode?: boolean;
          codeforge_enabled?: boolean;
          studyforge_enabled?: boolean;
          pptforge_enabled?: boolean;
          updated_at?: string;
        };
        Update: {
          id?: boolean;
          forge_ai_enabled?: boolean;
          recipe_forge_enabled?: boolean;
          critic_enabled?: boolean;
          maintenance_mode?: boolean;
          codeforge_enabled?: boolean;
          studyforge_enabled?: boolean;
          pptforge_enabled?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      admin_overview: {
        Args: Record<string, never>;
        Returns: Json;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
