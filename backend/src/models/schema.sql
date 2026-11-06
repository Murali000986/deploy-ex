-- =================================================================
-- Ledgerly Production Database Schema (PostgreSQL & SQLite compatible)
-- =================================================================

-- 1. Clients Table
CREATE TABLE IF NOT EXISTS clients (
    id VARCHAR(64) PRIMARY KEY,
    phone_number VARCHAR(32) NOT NULL UNIQUE,
    full_name VARCHAR(255),
    email VARCHAR(255),
    consent_recorded BOOLEAN DEFAULT FALSE,
    consent_timestamp TIMESTAMP WITH TIME ZONE,
    opted_out BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Client Cases Table
CREATE TABLE IF NOT EXISTS cases (
    id VARCHAR(64) PRIMARY KEY,
    case_number VARCHAR(64) NOT NULL UNIQUE,
    client_id VARCHAR(64) NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    status VARCHAR(64) NOT NULL DEFAULT 'NEW',
    proposed_company_name VARCHAR(255),
    company_type VARCHAR(64) DEFAULT 'PRIVATE_LIMITED',
    company_category VARCHAR(64) DEFAULT 'COMPANY_LIMITED_BY_SHARES',
    registered_office_state VARCHAR(128),
    registered_office_district VARCHAR(128),
    authorized_capital BIGINT DEFAULT 100000,
    paid_up_capital BIGINT DEFAULT 100000,
    client_confirmed BOOLEAN DEFAULT FALSE,
    client_confirmation_timestamp TIMESTAMP WITH TIME ZONE,
    assigned_admin_id VARCHAR(64),
    extension_synced BOOLEAN DEFAULT FALSE,
    extension_synced_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. WhatsApp Messages Table
CREATE TABLE IF NOT EXISTS messages (
    id VARCHAR(64) PRIMARY KEY,
    case_id VARCHAR(64) REFERENCES cases(id) ON DELETE SET NULL,
    client_id VARCHAR(64) NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    whatsapp_message_id VARCHAR(128) UNIQUE,
    direction VARCHAR(16) NOT NULL, -- 'INBOUND' | 'OUTBOUND'
    message_type VARCHAR(32) NOT NULL, -- 'text' | 'image' | 'document' | 'interactive' | 'template'
    content TEXT,
    media_id VARCHAR(128),
    media_mime_type VARCHAR(128),
    media_filename VARCHAR(255),
    media_url TEXT,
    delivery_status VARCHAR(32) DEFAULT 'SENT', -- 'SENT' | 'DELIVERED' | 'READ' | 'FAILED'
    failure_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Case Documents Table
CREATE TABLE IF NOT EXISTS documents (
    id VARCHAR(64) PRIMARY KEY,
    case_id VARCHAR(64) NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    client_id VARCHAR(64) NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    original_filename VARCHAR(255) NOT NULL,
    stored_path TEXT NOT NULL,
    mime_type VARCHAR(128) NOT NULL,
    file_size_bytes INTEGER NOT NULL,
    doc_type VARCHAR(64) DEFAULT 'OTHER', -- 'PAN' | 'AADHAAR' | 'PASSPORT' | 'UTILITY_BILL' | 'OTHER'
    processing_status VARCHAR(32) DEFAULT 'UPLOADED', -- 'UPLOADED' | 'PROCESSING' | 'EXTRACTED' | 'FAILED' | 'HUMAN_REVIEW'
    readability_score NUMERIC(3, 2) DEFAULT 1.00,
    extracted_raw_text TEXT,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. AI Extracted Fields Table
CREATE TABLE IF NOT EXISTS extracted_fields (
    id VARCHAR(64) PRIMARY KEY,
    case_id VARCHAR(64) NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    document_id VARCHAR(64) REFERENCES documents(id) ON DELETE SET NULL,
    entity_type VARCHAR(64) DEFAULT 'COMPANY', -- 'COMPANY' | 'DIRECTOR'
    entity_index INTEGER DEFAULT 0,
    field_key VARCHAR(128) NOT NULL,
    extracted_value TEXT,
    verified_value TEXT,
    confidence NUMERIC(3, 2) NOT NULL DEFAULT 0.00,
    source_document_name VARCHAR(255),
    verification_status VARCHAR(32) DEFAULT 'EXTRACTED', -- 'EXTRACTED' | 'HUMAN_VERIFIED' | 'REJECTED' | 'MANUAL_ENTRY'
    flagged_for_review BOOLEAN DEFAULT FALSE,
    flag_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. SPICe+ Part A Name Checks Table
CREATE TABLE IF NOT EXISTS name_checks (
    id VARCHAR(64) PRIMARY KEY,
    case_id VARCHAR(64) NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    proposed_name VARCHAR(255) NOT NULL,
    check_source VARCHAR(64) NOT NULL, -- 'MCA_REGISTRY' | 'TRADEMARK_DB' | 'RESTRICTED_WORDS'
    check_result VARCHAR(32) NOT NULL, -- 'PASSED' | 'EXACT_MATCH' | 'SIMILAR_CONFLICT' | 'RESTRICTED_WORD' | 'MANUAL_REVIEW_REQUIRED'
    match_score NUMERIC(3, 2) DEFAULT 0.00,
    conflicting_entity_name VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    case_id VARCHAR(64) REFERENCES cases(id) ON DELETE SET NULL,
    actor_id VARCHAR(64) NOT NULL,
    actor_role VARCHAR(32) NOT NULL, -- 'SYSTEM' | 'ADMIN' | 'SUPERADMIN' | 'CLIENT'
    action VARCHAR(128) NOT NULL,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Webhook Idempotency Table
CREATE TABLE IF NOT EXISTS processed_webhook_events (
    event_id VARCHAR(128) PRIMARY KEY,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
