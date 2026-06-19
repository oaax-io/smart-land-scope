-- Add platform_admin to app_role enum and rewrite is_platform_admin
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'platform_admin';