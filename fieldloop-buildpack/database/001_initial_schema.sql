-- FieldLoop v0.1 — 001_initial_schema.sql
-- Supabase / Postgres core migration.
-- Applies to the Supabase "public" schema; assumes `auth` schema exists (Supabase).

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
CREATE TYPE job_type_enum AS ENUM ('standard', 'body_corporate', 'insurance_repair');
CREATE TYPE job_status_enum AS ENUM (
  'draft_quote', 'scheduled', 'active', 'pending_signoff', 'completed', 'invoiced'
);
CREATE TYPE work_class_enum AS ENUM (
  'gasfitting', 'sanitary', 'roofing', 'drainage', 'mechanical', 'refrigeration'
);
CREATE TYPE sync_op_enum AS ENUM ('create', 'update', 'delete');
CREATE TYPE evidence_kind_enum AS ENUM ('before', 'after', 'hazard', 'referral', 'evidence');
CREATE TYPE member_role_enum AS ENUM ('admin', 'scheduler', 'technician');
CREATE TYPE note_kind_enum AS ENUM ('diagnostic', 'voice', 'general', 'scope');

-- ---------------------------------------------------------------------------
-- Multi-entity hierarchy
-- ---------------------------------------------------------------------------
CREATE TABLE entities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_company_name TEXT NOT NULL DEFAULT 'Chatsworth Constructions Pty Ltd',
    parent_abn VARCHAR(11) NOT NULL,
    division_name TEXT NOT NULL,
    vba_pic_licence VARCHAR(20),
    trading_logo_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX entities_parent_abn_division_key
    ON entities (parent_abn, division_name);

-- Membership is the authoritative RLS key: auth.uid() -> entities.
CREATE TABLE entity_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role member_role_enum NOT NULL DEFAULT 'technician',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (entity_id, user_id)
);

CREATE INDEX entity_members_user_idx ON entity_members (user_id);

-- ---------------------------------------------------------------------------
-- Jobs (central work order)
-- ---------------------------------------------------------------------------
CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE RESTRICT,
    job_number TEXT NOT NULL,
    job_type job_type_enum NOT NULL DEFAULT 'standard',
    status job_status_enum NOT NULL DEFAULT 'draft_quote',
    source_job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
    client_name TEXT NOT NULL,
    site_address JSONB NOT NULL,
    body_corp_meta JSONB,
    insurance_meta JSONB,
    work_class work_class_enum[],
    jsa_completed BOOLEAN NOT NULL DEFAULT FALSE,
    swms_required BOOLEAN NOT NULL DEFAULT FALSE,
    coes_required BOOLEAN NOT NULL DEFAULT FALSE,
    coes_number TEXT,
    signature_hash TEXT,
    subtotal_inc_gst NUMERIC(12,2),
    total_inc_gst NUMERIC(12,2),
    completed_at TIMESTAMPTZ,
    version INTEGER NOT NULL DEFAULT 1,
    deleted_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX jobs_entity_number_key ON jobs (entity_id, job_number);
CREATE INDEX jobs_entity_status_idx ON jobs (entity_id, status) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Financials
-- ---------------------------------------------------------------------------
CREATE TABLE job_line_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity NUMERIC(12,2) NOT NULL DEFAULT 1,
    unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
    tax_code TEXT,
    total_inc_gst NUMERIC(12,2) NOT NULL DEFAULT 0,
    deleted_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX job_line_items_job_idx ON job_line_items (job_id) WHERE deleted_at IS NULL;

CREATE TYPE quote_mode_enum AS ENUM ('standard', 'scope_variation');
CREATE TYPE quote_status_enum AS ENUM ('draft', 'pending_approval', 'approved', 'declined', 'superseded');

CREATE TABLE quotes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    quote_number TEXT NOT NULL,
    mode quote_mode_enum NOT NULL DEFAULT 'standard',
    status quote_status_enum NOT NULL DEFAULT 'draft',
    subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
    gst NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_inc_gst NUMERIC(12,2) NOT NULL DEFAULT 0,
    version INTEGER NOT NULL DEFAULT 1,
    deleted_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX quotes_job_idx ON quotes (job_id) WHERE deleted_at IS NULL;

CREATE TABLE quote_line_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity NUMERIC(12,2) NOT NULL DEFAULT 1,
    unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_inc_gst NUMERIC(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX quote_line_items_quote_idx ON quote_line_items (quote_id);

-- ---------------------------------------------------------------------------
-- Field evidence & safety
-- ---------------------------------------------------------------------------
CREATE TABLE photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    kind evidence_kind_enum NOT NULL DEFAULT 'evidence',
    r2_key TEXT NOT NULL,
    content_hash TEXT,
    taken_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX photos_job_idx ON photos (job_id) WHERE deleted_at IS NULL;

CREATE TABLE signatures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    signature_base64 TEXT NOT NULL,
    signed_by_name TEXT NOT NULL,
    total_inc_gst NUMERIC(12,2) NOT NULL,
    photo_ids UUID[] NOT NULL DEFAULT '{}',
    dispute_shield_hash TEXT NOT NULL,
    signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX signatures_job_idx ON signatures (job_id);

CREATE TABLE jsa_checklists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    checklist_item_key TEXT NOT NULL,
    response BOOLEAN,
    note TEXT,
    completed_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (job_id, checklist_item_key)
);

CREATE TABLE hazards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    severity TEXT NOT NULL DEFAULT 'near_miss',
    description TEXT NOT NULL,
    photo_id UUID REFERENCES photos(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'open',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX hazards_job_idx ON hazards (job_id);

CREATE TABLE job_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    kind note_kind_enum NOT NULL DEFAULT 'general',
    body_text TEXT,
    transcript TEXT,
    audio_r2_key TEXT,
    deleted_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX job_notes_job_idx ON job_notes (job_id) WHERE deleted_at IS NULL;

CREATE TABLE vehicle_inspections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    vehicle_name TEXT NOT NULL,
    item_key TEXT NOT NULL,
    result TEXT NOT NULL DEFAULT 'pass', -- 'pass' | 'fail'
    note TEXT,
    photo_id UUID REFERENCES photos(id) ON DELETE SET NULL,
    inspected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX vehicle_inspections_entity_idx ON vehicle_inspections (entity_id);

-- ---------------------------------------------------------------------------
-- Labour & supply
-- ---------------------------------------------------------------------------
CREATE TABLE timesheets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    clock_in TIMESTAMPTZ NOT NULL,
    clock_out TIMESTAMPTZ,
    break_minutes INTEGER NOT NULL DEFAULT 0,
    travel_minutes INTEGER NOT NULL DEFAULT 0,
    billable_minutes INTEGER NOT NULL DEFAULT 0,
    award_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX timesheets_job_idx ON timesheets (job_id);

CREATE TYPE po_status_enum AS ENUM ('draft', 'issued', 'received', 'cancelled');

CREATE TABLE purchase_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    supplier TEXT NOT NULL,
    po_number TEXT NOT NULL,
    status po_status_enum NOT NULL DEFAULT 'draft',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX purchase_orders_po_number_idx ON purchase_orders (po_number);

CREATE TABLE purchase_order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity NUMERIC(12,2) NOT NULL DEFAULT 1,
    unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_inc_gst NUMERIC(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX purchase_order_items_po_idx ON purchase_order_items (purchase_order_id);

-- ---------------------------------------------------------------------------
-- Compliance artefacts
-- ---------------------------------------------------------------------------
CREATE TABLE vba_certificates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    coes_number TEXT,
    work_class work_class_enum[] NOT NULL,
    job_value_inc_gst NUMERIC(12,2) NOT NULL,
    gas_test JSONB,
    declaration TEXT NOT NULL,
    lodged_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'pending',
    vba_ref TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX vba_certificates_job_idx ON vba_certificates (job_id);

CREATE TABLE backflow_tests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,
    location TEXT,
    line_pressure NUMERIC(8,2),
    relief_pressure NUMERIC(8,2),
    tmv_hot_c NUMERIC(5,2),
    tmv_mixed_c NUMERIC(5,2),
    status TEXT NOT NULL DEFAULT 'pending',
    pdf_r2_key TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX backflow_tests_job_idx ON backflow_tests (job_id);

-- ---------------------------------------------------------------------------
-- Offline action queue (server-side replay target)
-- ---------------------------------------------------------------------------
CREATE TABLE sync_outbox (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    record_type TEXT NOT NULL,
    record_id UUID NOT NULL,
    op sync_op_enum NOT NULL,
    payload JSONB NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    synced_at TIMESTAMPTZ
);

CREATE INDEX sync_outbox_pending_idx ON sync_outbox (entity_id) WHERE synced_at IS NULL;

-- ---------------------------------------------------------------------------
-- OAuth token storage (server-side, secrets never leave the API)
-- ---------------------------------------------------------------------------
CREATE TABLE oauth_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at TIMESTAMPTZ,
    company_file_uri TEXT,
    tenant_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (entity_id, provider)
);

-- ---------------------------------------------------------------------------
-- Updated-at trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER entities_set_updated_at BEFORE UPDATE ON entities
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER jobs_set_updated_at BEFORE UPDATE ON jobs
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER job_line_items_set_updated_at BEFORE UPDATE ON job_line_items
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER quotes_set_updated_at BEFORE UPDATE ON quotes
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER purchase_orders_set_updated_at BEFORE UPDATE ON purchase_orders
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER oauth_tokens_set_updated_at BEFORE UPDATE ON oauth_tokens
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER job_notes_set_updated_at BEFORE UPDATE ON job_notes
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER vehicle_inspections_set_updated_at BEFORE UPDATE ON vehicle_inspections
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
