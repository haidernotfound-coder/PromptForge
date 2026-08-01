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
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          avatar_url?: string | null;
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
