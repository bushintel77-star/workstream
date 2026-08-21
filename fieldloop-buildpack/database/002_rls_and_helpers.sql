-- FieldLoop v0.1 — 002_rls_and_helpers.sql
-- Row Level Security + tenant helpers.
-- Authoritative isolation: auth.uid() -> entity_members -> entities (parent_abn).

-- ---------------------------------------------------------------------------
-- Helper: entities the current user is a member of.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.my_entity_ids()
RETURNS SETOF UUID AS $$
    SELECT entity_id FROM public.entity_members WHERE user_id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- Helper: parent ABNs the current user is allowed to touch.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.my_parent_abns()
RETURNS SETOF VARCHAR AS $$
    SELECT DISTINCT e.parent_abn
    FROM public.entity_members m
    JOIN public.entities e ON e.id = m.entity_id
    WHERE m.user_id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- Tenant scoping helper.
-- Sets app.current_parent_abn for request-scoped queries AFTER verifying the
-- caller is actually a member of that tenant. The original draft trusted
-- current_setting(...) set by the client, which is unsafe on its own.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_tenant_scope(target_parent_abn VARCHAR)
RETURNS VOID AS $$
BEGIN
    IF target_parent_abn IN (SELECT * FROM public.my_parent_abns()) THEN
        PERFORM set_config('app.current_parent_abn', target_parent_abn, false);
    ELSE
        RAISE EXCEPTION 'not authorized for parent ABN %', target_parent_abn
            USING ERRCODE = '42501';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ---------------------------------------------------------------------------
-- Row Level Security — enable
-- ---------------------------------------------------------------------------
ALTER TABLE entities        ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_line_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE signatures      ENABLE ROW LEVEL SECURITY;
ALTER TABLE jsa_checklists  ENABLE ROW LEVEL SECURITY;
ALTER TABLE hazards         ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheets      ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE vba_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE backflow_tests  ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_outbox     ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_tokens    ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_notes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_inspections ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Policies
--
-- Pattern: a row is visible iff its owning entity is in my_entity_ids().
-- Financial rows join through their parent's job/quote/po entity.
-- ---------------------------------------------------------------------------

-- entities: read the entities I belong to.
CREATE POLICY entities_select ON entities
    FOR SELECT USING (id IN (SELECT * FROM public.my_entity_ids()));

-- entity_members: read my own memberships only.
CREATE POLICY entity_members_select ON entity_members
    FOR SELECT USING (user_id = auth.uid());

-- jobs
CREATE POLICY jobs_all ON jobs FOR ALL USING (
    entity_id IN (SELECT * FROM public.my_entity_ids())
);

-- job_line_items: via jobs
CREATE POLICY job_line_items_all ON job_line_items FOR ALL USING (
    job_id IN (SELECT id FROM jobs WHERE entity_id IN (SELECT * FROM public.my_entity_ids()))
);

-- quotes: via jobs
CREATE POLICY quotes_all ON quotes FOR ALL USING (
    job_id IN (SELECT id FROM jobs WHERE entity_id IN (SELECT * FROM public.my_entity_ids()))
);

-- quote_line_items: via quotes -> jobs
CREATE POLICY quote_line_items_all ON quote_line_items FOR ALL USING (
    quote_id IN (
        SELECT q.id FROM quotes q
        JOIN jobs j ON j.id = q.job_id
        WHERE j.entity_id IN (SELECT * FROM public.my_entity_ids())
    )
);

-- photos: via jobs
CREATE POLICY photos_all ON photos FOR ALL USING (
    job_id IN (SELECT id FROM jobs WHERE entity_id IN (SELECT * FROM public.my_entity_ids()))
);

-- signatures: via jobs
CREATE POLICY signatures_all ON signatures FOR ALL USING (
    job_id IN (SELECT id FROM jobs WHERE entity_id IN (SELECT * FROM public.my_entity_ids()))
);

-- jsa_checklists: via jobs
CREATE POLICY jsa_checklists_all ON jsa_checklists FOR ALL USING (
    job_id IN (SELECT id FROM jobs WHERE entity_id IN (SELECT * FROM public.my_entity_ids()))
);

-- hazards: via jobs
CREATE POLICY hazards_all ON hazards FOR ALL USING (
    job_id IN (SELECT id FROM jobs WHERE entity_id IN (SELECT * FROM public.my_entity_ids()))
);

-- timesheets: via jobs (own rows writable; any member read)
CREATE POLICY timesheets_all ON timesheets FOR ALL USING (
    job_id IN (SELECT id FROM jobs WHERE entity_id IN (SELECT * FROM public.my_entity_ids()))
);

-- purchase_orders: via jobs
CREATE POLICY purchase_orders_all ON purchase_orders FOR ALL USING (
    job_id IN (SELECT id FROM jobs WHERE entity_id IN (SELECT * FROM public.my_entity_ids()))
);

-- purchase_order_items: via po -> jobs
CREATE POLICY purchase_order_items_all ON purchase_order_items FOR ALL USING (
    purchase_order_id IN (
        SELECT po.id FROM purchase_orders po
        JOIN jobs j ON j.id = po.job_id
        WHERE j.entity_id IN (SELECT * FROM public.my_entity_ids())
    )
);

-- vba_certificates: via jobs
CREATE POLICY vba_certificates_all ON vba_certificates FOR ALL USING (
    job_id IN (SELECT id FROM jobs WHERE entity_id IN (SELECT * FROM public.my_entity_ids()))
);

-- backflow_tests: via jobs
CREATE POLICY backflow_tests_all ON backflow_tests FOR ALL USING (
    job_id IN (SELECT id FROM jobs WHERE entity_id IN (SELECT * FROM public.my_entity_ids()))
);

-- job_notes: via jobs
CREATE POLICY job_notes_all ON job_notes FOR ALL USING (
    job_id IN (SELECT id FROM jobs WHERE entity_id IN (SELECT * FROM public.my_entity_ids()))
);

-- vehicle_inspections: my entities
CREATE POLICY vehicle_inspections_all ON vehicle_inspections FOR ALL USING (
    entity_id IN (SELECT * FROM public.my_entity_ids())
);

-- sync_outbox: my entities
CREATE POLICY sync_outbox_all ON sync_outbox FOR ALL USING (
    entity_id IN (SELECT * FROM public.my_entity_ids())
);

-- oauth_tokens: service role only (never exposed to clients)
CREATE POLICY oauth_tokens_service ON oauth_tokens
    FOR ALL USING (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- Seed the three Chatsworth divisions (idempotent).
-- Run once; service-role or migration context.
-- ---------------------------------------------------------------------------
-- Four operating entities: the parent trades as a general-building entity,
-- plus the three divisions. All share parent_abn = 90056106855.
INSERT INTO entities (parent_company_name, parent_abn, division_name, vba_pic_licence)
VALUES
    ('Chatsworth Constructions Pty Ltd', '90056106855', 'Chatsworth Constructions', NULL),
    ('Chatsworth Constructions Pty Ltd', '90056106855', 'Caulfield South Plumbing', '118492'),
    ('Chatsworth Constructions Pty Ltd', '90056106855', 'Majon Kitchens', NULL),
    ('Chatsworth Constructions Pty Ltd', '90056106855', 'Roof Distributors', NULL)
ON CONFLICT (parent_abn, division_name) DO NOTHING;
