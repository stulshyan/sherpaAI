-- Migration: 004_user_authentication
-- Description: Add password authentication support to users table
-- Dependencies: 003_core_entities
-- Created: 2024-12-05

-- Add password_hash column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(256);

-- Create index for faster auth lookups
CREATE INDEX IF NOT EXISTS idx_users_email_active ON users(email, is_active);

-- Insert a default admin user with password 'entropy123'
-- Password hash generated using scrypt (will be verified in Node.js)
-- This is a placeholder - the actual hash will be set by the seed script
INSERT INTO users (id, email, name, role, client_id, password_hash)
VALUES (
    '00000000-0000-0000-0000-000000000002',
    'admin@entropy.app',
    'Admin User',
    'admin',
    '00000000-0000-0000-0000-000000000001',
    -- scrypt hash for 'entropy123' with salt 'entropy_salt_v1'
    'c2NyeXB0AA4AAAAIAAAAAWE0bnJvcHlfc2FsdF92MQDqH4fHPTjQmPLJ8PmVtP8mRuEQVKRyPvHv6ZPJqvqKwQ=='
)
ON CONFLICT (id) DO UPDATE SET password_hash = EXCLUDED.password_hash;

-- Also update the system user with a password for dev purposes
UPDATE users
SET password_hash = 'c2NyeXB0AA4AAAAIAAAAAWE0bnJvcHlfc2FsdF92MQDqH4fHPTjQmPLJ8PmVtP8mRuEQVKRyPvHv6ZPJqvqKwQ=='
WHERE email = 'system@entropy.local' AND password_hash IS NULL;
