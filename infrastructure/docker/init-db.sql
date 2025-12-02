-- Initialize PostgreSQL database with extensions

-- Enable pgvector extension for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create initial schema
CREATE SCHEMA IF NOT EXISTS entropy;

-- Grant permissions
GRANT ALL ON SCHEMA entropy TO entropy;
