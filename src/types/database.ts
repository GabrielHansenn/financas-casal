
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
            "accounts": {
                  Row: {
                    "archived_at": string | null,"created_at": string,"id": string,"initial_balance_cents": number,"name": string,"owner_user_id": string | null,"type": Database["public"]['Enums']["account_type"],"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"created_at"?: string,"id"?: string,"initial_balance_cents"?: number,"name": string,"owner_user_id"?: string | null,"type": Database["public"]['Enums']["account_type"],"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "archived_at"?: string | null,"created_at"?: string,"id"?: string,"initial_balance_cents"?: number,"name"?: string,"owner_user_id"?: string | null,"type"?: Database["public"]['Enums']["account_type"],"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "accounts_owner_user_id_fkey"
      columns: ["owner_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "accounts_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"categories": {
                  Row: {
                    "archived_at": string | null,"color": string,"created_at": string,"icon": string,"id": string,"name": string,"sort_order": number,"type": Database["public"]['Enums']["category_type"],"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"color"?: string,"created_at"?: string,"icon"?: string,"id"?: string,"name": string,"sort_order"?: number,"type": Database["public"]['Enums']["category_type"],"workspace_id": string
                  }
                  Update: {
                    "archived_at"?: string | null,"color"?: string,"created_at"?: string,"icon"?: string,"id"?: string,"name"?: string,"sort_order"?: number,"type"?: Database["public"]['Enums']["category_type"],"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "categories_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"dream_reactions": {
                  Row: {
                    "created_at": string,"dream_id": string,"type": Database["public"]['Enums']["dream_reaction_type"],"user_id": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"dream_id": string,"type": Database["public"]['Enums']["dream_reaction_type"],"user_id"?: string,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"dream_id"?: string,"type"?: Database["public"]['Enums']["dream_reaction_type"],"user_id"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "dream_reactions_dream_id_workspace_id_fkey"
      columns: ["dream_id","workspace_id"]
isOneToOne: false
      referencedRelation: "dreams"
      referencedColumns: ["id","workspace_id"]
    },{
      foreignKeyName: "dream_reactions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"dreams": {
                  Row: {
                    "achieved_at": string | null,"achieved_image_path": string | null,"category": Database["public"]['Enums']["dream_category"],"cover_image_path": string | null,"created_at": string,"created_by": string,"estimated_cost_cents": number | null,"goal_id": string | null,"horizon": Database["public"]['Enums']["dream_horizon"],"id": string,"owner_user_id": string | null,"position": number,"status": Database["public"]['Enums']["dream_status"],"title": string,"updated_at": string,"why": string | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "achieved_at"?: string | null,"achieved_image_path"?: string | null,"category"?: Database["public"]['Enums']["dream_category"],"cover_image_path"?: string | null,"created_at"?: string,"created_by"?: string,"estimated_cost_cents"?: number | null,"goal_id"?: string | null,"horizon"?: Database["public"]['Enums']["dream_horizon"],"id"?: string,"owner_user_id"?: string | null,"position"?: number,"status"?: Database["public"]['Enums']["dream_status"],"title": string,"updated_at"?: string,"why"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "achieved_at"?: string | null,"achieved_image_path"?: string | null,"category"?: Database["public"]['Enums']["dream_category"],"cover_image_path"?: string | null,"created_at"?: string,"created_by"?: string,"estimated_cost_cents"?: number | null,"goal_id"?: string | null,"horizon"?: Database["public"]['Enums']["dream_horizon"],"id"?: string,"owner_user_id"?: string | null,"position"?: number,"status"?: Database["public"]['Enums']["dream_status"],"title"?: string,"updated_at"?: string,"why"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "dreams_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "dreams_goal_id_workspace_id_fkey"
      columns: ["goal_id","workspace_id"]
isOneToOne: false
      referencedRelation: "goal_progress"
      referencedColumns: ["goal_id","workspace_id"]
    },{
      foreignKeyName: "dreams_goal_id_workspace_id_fkey"
      columns: ["goal_id","workspace_id"]
isOneToOne: false
      referencedRelation: "goals"
      referencedColumns: ["id","workspace_id"]
    },{
      foreignKeyName: "dreams_owner_user_id_fkey"
      columns: ["owner_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "dreams_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"goal_contributions": {
                  Row: {
                    "amount_cents": number,"created_at": string,"created_by": string,"date": string,"goal_id": string,"id": string,"note": string | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_cents": number,"created_at"?: string,"created_by"?: string,"date": string,"goal_id": string,"id"?: string,"note"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "amount_cents"?: number,"created_at"?: string,"created_by"?: string,"date"?: string,"goal_id"?: string,"id"?: string,"note"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "goal_contributions_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "goal_contributions_goal_id_workspace_id_fkey"
      columns: ["goal_id","workspace_id"]
isOneToOne: false
      referencedRelation: "goal_progress"
      referencedColumns: ["goal_id","workspace_id"]
    },{
      foreignKeyName: "goal_contributions_goal_id_workspace_id_fkey"
      columns: ["goal_id","workspace_id"]
isOneToOne: false
      referencedRelation: "goals"
      referencedColumns: ["id","workspace_id"]
    }
                  ]
                },"goals": {
                  Row: {
                    "archived_at": string | null,"created_at": string,"created_by": string,"deadline": string | null,"id": string,"name": string,"target_cents": number,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"created_at"?: string,"created_by"?: string,"deadline"?: string | null,"id"?: string,"name": string,"target_cents": number,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "archived_at"?: string | null,"created_at"?: string,"created_by"?: string,"deadline"?: string | null,"id"?: string,"name"?: string,"target_cents"?: number,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "goals_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "goals_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_url": string | null,"created_at": string,"display_name": string,"id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_url"?: string | null,"created_at"?: string,"display_name": string,"id": string,"updated_at"?: string
                  }
                  Update: {
                    "avatar_url"?: string | null,"created_at"?: string,"display_name"?: string,"id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"recurring_transactions": {
                  Row: {
                    "account_id": string,"active": boolean,"amount_cents": number,"category_id": string | null,"created_at": string,"created_by": string,"description": string | null,"end_date": string | null,"frequency": Database["public"]['Enums']["recurrence_frequency"],"id": string,"next_date": string,"paid_by": string | null,"split_type": Database["public"]['Enums']["split_type"],"start_date": string,"type": Database["public"]['Enums']["transaction_type"],"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"active"?: boolean,"amount_cents": number,"category_id"?: string | null,"created_at"?: string,"created_by"?: string,"description"?: string | null,"end_date"?: string | null,"frequency": Database["public"]['Enums']["recurrence_frequency"],"id"?: string,"next_date": string,"paid_by"?: string | null,"split_type"?: Database["public"]['Enums']["split_type"],"start_date": string,"type": Database["public"]['Enums']["transaction_type"],"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "account_id"?: string,"active"?: boolean,"amount_cents"?: number,"category_id"?: string | null,"created_at"?: string,"created_by"?: string,"description"?: string | null,"end_date"?: string | null,"frequency"?: Database["public"]['Enums']["recurrence_frequency"],"id"?: string,"next_date"?: string,"paid_by"?: string | null,"split_type"?: Database["public"]['Enums']["split_type"],"start_date"?: string,"type"?: Database["public"]['Enums']["transaction_type"],"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "recurring_transactions_account_id_workspace_id_fkey"
      columns: ["account_id","workspace_id"]
isOneToOne: false
      referencedRelation: "account_balances"
      referencedColumns: ["account_id","workspace_id"]
    },{
      foreignKeyName: "recurring_transactions_account_id_workspace_id_fkey"
      columns: ["account_id","workspace_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["id","workspace_id"]
    },{
      foreignKeyName: "recurring_transactions_category_id_workspace_id_fkey"
      columns: ["category_id","workspace_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id","workspace_id"]
    },{
      foreignKeyName: "recurring_transactions_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recurring_transactions_paid_by_fkey"
      columns: ["paid_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recurring_transactions_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"settlements": {
                  Row: {
                    "amount_cents": number,"created_at": string,"created_by": string,"date": string,"from_user_id": string,"id": string,"note": string | null,"to_user_id": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_cents": number,"created_at"?: string,"created_by"?: string,"date": string,"from_user_id": string,"id"?: string,"note"?: string | null,"to_user_id": string,"workspace_id": string
                  }
                  Update: {
                    "amount_cents"?: number,"created_at"?: string,"created_by"?: string,"date"?: string,"from_user_id"?: string,"id"?: string,"note"?: string | null,"to_user_id"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "settlements_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "settlements_from_user_id_fkey"
      columns: ["from_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "settlements_to_user_id_fkey"
      columns: ["to_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "settlements_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"transaction_splits": {
                  Row: {
                    "amount_cents": number,"transaction_id": string,"user_id": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_cents": number,"transaction_id": string,"user_id": string,"workspace_id": string
                  }
                  Update: {
                    "amount_cents"?: number,"transaction_id"?: string,"user_id"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "transaction_splits_transaction_id_workspace_id_fkey"
      columns: ["transaction_id","workspace_id"]
isOneToOne: false
      referencedRelation: "transactions"
      referencedColumns: ["id","workspace_id"]
    },{
      foreignKeyName: "transaction_splits_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"transactions": {
                  Row: {
                    "account_id": string,"amount_cents": number,"category_id": string | null,"created_at": string,"created_by": string,"date": string,"description": string | null,"external_id": string | null,"id": string,"paid_by": string | null,"recurring_id": string | null,"source": Database["public"]['Enums']["transaction_source"],"split_type": Database["public"]['Enums']["split_type"],"to_account_id": string | null,"type": Database["public"]['Enums']["transaction_type"],"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"amount_cents": number,"category_id"?: string | null,"created_at"?: string,"created_by"?: string,"date": string,"description"?: string | null,"external_id"?: string | null,"id"?: string,"paid_by"?: string | null,"recurring_id"?: string | null,"source"?: Database["public"]['Enums']["transaction_source"],"split_type"?: Database["public"]['Enums']["split_type"],"to_account_id"?: string | null,"type": Database["public"]['Enums']["transaction_type"],"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "account_id"?: string,"amount_cents"?: number,"category_id"?: string | null,"created_at"?: string,"created_by"?: string,"date"?: string,"description"?: string | null,"external_id"?: string | null,"id"?: string,"paid_by"?: string | null,"recurring_id"?: string | null,"source"?: Database["public"]['Enums']["transaction_source"],"split_type"?: Database["public"]['Enums']["split_type"],"to_account_id"?: string | null,"type"?: Database["public"]['Enums']["transaction_type"],"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "transactions_account_id_workspace_id_fkey"
      columns: ["account_id","workspace_id"]
isOneToOne: false
      referencedRelation: "account_balances"
      referencedColumns: ["account_id","workspace_id"]
    },{
      foreignKeyName: "transactions_account_id_workspace_id_fkey"
      columns: ["account_id","workspace_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["id","workspace_id"]
    },{
      foreignKeyName: "transactions_category_id_workspace_id_fkey"
      columns: ["category_id","workspace_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id","workspace_id"]
    },{
      foreignKeyName: "transactions_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "transactions_paid_by_fkey"
      columns: ["paid_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "transactions_recurring_id_workspace_id_fkey"
      columns: ["recurring_id","workspace_id"]
isOneToOne: false
      referencedRelation: "recurring_transactions"
      referencedColumns: ["id","workspace_id"]
    },{
      foreignKeyName: "transactions_to_account_id_workspace_id_fkey"
      columns: ["to_account_id","workspace_id"]
isOneToOne: false
      referencedRelation: "account_balances"
      referencedColumns: ["account_id","workspace_id"]
    },{
      foreignKeyName: "transactions_to_account_id_workspace_id_fkey"
      columns: ["to_account_id","workspace_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["id","workspace_id"]
    },{
      foreignKeyName: "transactions_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"workspace_invites": {
                  Row: {
                    "accepted_at": string | null,"accepted_by": string | null,"created_at": string,"email": string,"expires_at": string,"id": string,"invited_by": string,"status": Database["public"]['Enums']["invite_status"],"token_hash": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"created_at"?: string,"email": string,"expires_at"?: string,"id"?: string,"invited_by": string,"status"?: Database["public"]['Enums']["invite_status"],"token_hash": string,"workspace_id": string
                  }
                  Update: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"created_at"?: string,"email"?: string,"expires_at"?: string,"id"?: string,"invited_by"?: string,"status"?: Database["public"]['Enums']["invite_status"],"token_hash"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workspace_invites_accepted_by_fkey"
      columns: ["accepted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "workspace_invites_invited_by_fkey"
      columns: ["invited_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "workspace_invites_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"workspace_members": {
                  Row: {
                    "income_cents": number | null,"joined_at": string,"role": Database["public"]['Enums']["member_role"],"user_id": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "income_cents"?: number | null,"joined_at"?: string,"role"?: Database["public"]['Enums']["member_role"],"user_id": string,"workspace_id": string
                  }
                  Update: {
                    "income_cents"?: number | null,"joined_at"?: string,"role"?: Database["public"]['Enums']["member_role"],"user_id"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workspace_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "workspace_members_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"workspaces": {
                  Row: {
                    "created_at": string,"created_by": string,"id": string,"name": string,"type": Database["public"]['Enums']["workspace_type"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by": string,"id"?: string,"name": string,"type": Database["public"]['Enums']["workspace_type"],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"id"?: string,"name"?: string,"type"?: Database["public"]['Enums']["workspace_type"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workspaces_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "account_balances": {
                  Row: {
                    "account_id": string,"balance_cents": number | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "accounts_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"goal_progress": {
                  Row: {
                    "current_cents": number | null,"goal_id": string,"target_cents": number,"workspace_id": string
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "goals_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "accept_workspace_invite":
{ Args: { "p_token": string }; Returns: string
                           },
"assert_transaction_splits":
{ Args: { "p_transaction_id": string }; Returns: undefined
                           },
"can_access_dream_object":
{ Args: { "p_name": string,"p_require_dream": boolean }; Returns: boolean
                           },
"convert_dream_to_goal":
{ Args: { "p_deadline"?: string,"p_dream_id": string,"p_name": string,"p_target_cents": number }; Returns: string
                           },
"create_shared_workspace":
{ Args: { "p_name": string }; Returns: string
                           },
"create_workspace_invite":
{ Args: { "p_email": string,"p_workspace_id": string }; Returns: string
                           },
"get_invite_preview":
{ Args: { "p_token": string }; Returns: {
              "email": string,"expires_at": string,"invited_by_name": string,"status": Database["public"]['Enums']["invite_status"],"workspace_name": string
            }[]
                           },
"get_period_summary":
{ Args: { "p_from": string,"p_to": string,"p_workspace_id": string }; Returns: {
              "category_id": string,"total_cents": number,"type": Database["public"]['Enums']["transaction_type"]
            }[]
                           },
"get_settlement_ledger":
{ Args: { "p_workspace_id": string }; Returns: {
              "amount_cents": number,"creditor_id": string,"debtor_id": string,"kind": string
            }[]
                           },
"is_shared_workspace":
{ Args: { "p_workspace_id": string }; Returns: boolean
                           },
"is_workspace_member":
{ Args: { "p_workspace_id": string }; Returns: boolean
                           },
"is_workspace_owner":
{ Args: { "p_workspace_id": string }; Returns: boolean
                           },
"reorder_dreams":
{ Args: { "p_ids": (string)[],"p_workspace_id": string }; Returns: undefined
                           },
"save_transaction":
{ Args: { "p_account_id": string,"p_amount_cents": number,"p_category_id"?: string,"p_date": string,"p_description"?: string,"p_id"?: string,"p_paid_by"?: string,"p_recurring_id"?: string,"p_source"?: Database["public"]['Enums']["transaction_source"],"p_split_type"?: Database["public"]['Enums']["split_type"],"p_splits"?: Json,"p_to_account_id"?: string,"p_type": Database["public"]['Enums']["transaction_type"],"p_workspace_id": string }; Returns: string
                           },
"seed_workspace_defaults":
{ Args: { "p_account_name": string,"p_workspace_id": string }; Returns: undefined
                           },
"shares_workspace_with":
{ Args: { "p_user_id": string }; Returns: boolean
                           },
"user_is_member":
{ Args: { "p_user_id": string,"p_workspace_id": string }; Returns: boolean
                           }
          }
          Enums: {
            "account_type": "checking"|"savings"|"credit_card"|"cash","category_type": "income"|"expense","dream_category": "travel"|"home"|"vehicle"|"experience"|"career"|"pet"|"wedding"|"education"|"other","dream_horizon": "short"|"medium"|"long"|"someday","dream_reaction_type": "love"|"me_too","dream_status": "dreaming"|"planning"|"achieved","invite_status": "pending"|"accepted"|"revoked","member_role": "owner"|"member","recurrence_frequency": "weekly"|"monthly"|"yearly","split_type": "none"|"equal"|"proportional"|"custom","transaction_source": "manual"|"recurring"|"import","transaction_type": "income"|"expense"|"transfer","workspace_type": "personal"|"shared"
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
            "account_type": ["checking", "savings", "credit_card", "cash"],"category_type": ["income", "expense"],"dream_category": ["travel", "home", "vehicle", "experience", "career", "pet", "wedding", "education", "other"],"dream_horizon": ["short", "medium", "long", "someday"],"dream_reaction_type": ["love", "me_too"],"dream_status": ["dreaming", "planning", "achieved"],"invite_status": ["pending", "accepted", "revoked"],"member_role": ["owner", "member"],"recurrence_frequency": ["weekly", "monthly", "yearly"],"split_type": ["none", "equal", "proportional", "custom"],"transaction_source": ["manual", "recurring", "import"],"transaction_type": ["income", "expense", "transfer"],"workspace_type": ["personal", "shared"]
          }
        }
} as const
