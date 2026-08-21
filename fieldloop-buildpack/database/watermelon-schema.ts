// FieldLoop v0.1 — WatermelonDB schema (apps/mobile)
// Canonical offline schema. Server rows map 1:1 by `id` (UUID string) so the
// client and Supabase share primary keys. `_status` is WatermelonDB's local
// sync status field (created | updated | deleted | synced). See
// database/sync-contract.md for the push/pull protocol.

import { appSchema, tableSchema } from '@nozbe/watermelondb';

export default appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'entities',
      columns: [
        { name: 'parent_company_name', type: 'string' },
        { name: 'parent_abn', type: 'string', isIndexed: true },
        { name: 'division_name', type: 'string' },
        { name: 'vba_pic_licence', type: 'string', isOptional: true },
        { name: 'trading_logo_url', type: 'string', isOptional: true },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'jobs',
      columns: [
        { name: 'entity_id', type: 'string', isIndexed: true },
        { name: 'job_number', type: 'string' },
        { name: 'job_type', type: 'string' },
        { name: 'status', type: 'string', isIndexed: true },
        { name: 'source_job_id', type: 'string', isOptional: true },
        { name: 'client_name', type: 'string' },
        { name: 'site_address', type: 'string' }, // JSON.stringify of the JSONB
        { name: 'body_corp_meta', type: 'string', isOptional: true },
        { name: 'insurance_meta', type: 'string', isOptional: true },
        { name: 'work_class', type: 'string', isOptional: true }, // JSON array string
        { name: 'jsa_completed', type: 'boolean' },
        { name: 'swms_required', type: 'boolean' },
        { name: 'coes_required', type: 'boolean' },
        { name: 'coes_number', type: 'string', isOptional: true },
        { name: 'signature_hash', type: 'string', isOptional: true },
        { name: 'subtotal_inc_gst', type: 'number', isOptional: true },
        { name: 'total_inc_gst', type: 'number', isOptional: true },
        { name: 'completed_at', type: 'number', isOptional: true },
        { name: 'version', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'job_line_items',
      columns: [
        { name: 'job_id', type: 'string', isIndexed: true },
        { name: 'description', type: 'string' },
        { name: 'quantity', type: 'number' },
        { name: 'unit_price', type: 'number' },
        { name: 'tax_code', type: 'string', isOptional: true },
        { name: 'total_inc_gst', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'quotes',
      columns: [
        { name: 'job_id', type: 'string', isIndexed: true },
        { name: 'quote_number', type: 'string' },
        { name: 'mode', type: 'string' },
        { name: 'status', type: 'string' },
        { name: 'subtotal', type: 'number' },
        { name: 'gst', type: 'number' },
        { name: 'total_inc_gst', type: 'number' },
        { name: 'version', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'quote_line_items',
      columns: [
        { name: 'quote_id', type: 'string', isIndexed: true },
        { name: 'description', type: 'string' },
        { name: 'quantity', type: 'number' },
        { name: 'unit_price', type: 'number' },
        { name: 'total_inc_gst', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'photos',
      columns: [
        { name: 'job_id', type: 'string', isIndexed: true },
        { name: 'kind', type: 'string' },
        { name: 'r2_key', type: 'string' }, // local path until uploaded, then key
        { name: 'content_hash', type: 'string', isOptional: true },
        { name: 'taken_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'signatures',
      columns: [
        { name: 'job_id', type: 'string', isIndexed: true },
        { name: 'signature_base64', type: 'string' },
        { name: 'signed_by_name', type: 'string' },
        { name: 'total_inc_gst', type: 'number' },
        { name: 'photo_ids', type: 'string' }, // JSON array string
        { name: 'dispute_shield_hash', type: 'string' },
        { name: 'signed_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'jsa_checklists',
      columns: [
        { name: 'job_id', type: 'string', isIndexed: true },
        { name: 'checklist_item_key', type: 'string' },
        { name: 'response', type: 'boolean', isOptional: true },
        { name: 'note', type: 'string', isOptional: true },
        { name: 'completed_by', type: 'string', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'hazards',
      columns: [
        { name: 'job_id', type: 'string', isIndexed: true },
        { name: 'severity', type: 'string' },
        { name: 'description', type: 'string' },
        { name: 'photo_id', type: 'string', isOptional: true },
        { name: 'status', type: 'string' },
      ],
    }),
    tableSchema({
      name: 'timesheets',
      columns: [
        { name: 'job_id', type: 'string', isIndexed: true },
        { name: 'user_id', type: 'string' },
        { name: 'clock_in', type: 'number' },
        { name: 'clock_out', type: 'number', isOptional: true },
        { name: 'break_minutes', type: 'number' },
        { name: 'travel_minutes', type: 'number' },
        { name: 'billable_minutes', type: 'number' },
        { name: 'award_note', type: 'string', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'purchase_orders',
      columns: [
        { name: 'job_id', type: 'string', isIndexed: true },
        { name: 'supplier', type: 'string' },
        { name: 'po_number', type: 'string' },
        { name: 'status', type: 'string' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'purchase_order_items',
      columns: [
        { name: 'purchase_order_id', type: 'string', isIndexed: true },
        { name: 'description', type: 'string' },
        { name: 'quantity', type: 'number' },
        { name: 'unit_price', type: 'number' },
        { name: 'total_inc_gst', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'vba_certificates',
      columns: [
        { name: 'job_id', type: 'string', isIndexed: true },
        { name: 'coes_number', type: 'string', isOptional: true },
        { name: 'work_class', type: 'string' }, // JSON array string
        { name: 'job_value_inc_gst', type: 'number' },
        { name: 'gas_test', type: 'string', isOptional: true }, // JSON string
        { name: 'declaration', type: 'string' },
        { name: 'lodged_at', type: 'number', isOptional: true },
        { name: 'status', type: 'string' },
        { name: 'vba_ref', type: 'string', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'backflow_tests',
      columns: [
        { name: 'job_id', type: 'string', isIndexed: true },
        { name: 'device_id', type: 'string' },
        { name: 'location', type: 'string', isOptional: true },
        { name: 'line_pressure', type: 'number', isOptional: true },
        { name: 'relief_pressure', type: 'number', isOptional: true },
        { name: 'tmv_hot_c', type: 'number', isOptional: true },
        { name: 'tmv_mixed_c', type: 'number', isOptional: true },
        { name: 'status', type: 'string' },
        { name: 'pdf_r2_key', type: 'string', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'job_notes',
      columns: [
        { name: 'job_id', type: 'string', isIndexed: true },
        { name: 'kind', type: 'string' },
        { name: 'body_text', type: 'string', isOptional: true },
        { name: 'transcript', type: 'string', isOptional: true },
        { name: 'audio_r2_key', type: 'string', isOptional: true },
        { name: 'deleted_at', type: 'number', isOptional: true },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'vehicle_inspections',
      columns: [
        { name: 'entity_id', type: 'string', isIndexed: true },
        { name: 'vehicle_name', type: 'string' },
        { name: 'item_key', type: 'string' },
        { name: 'result', type: 'string' },
        { name: 'note', type: 'string', isOptional: true },
        { name: 'photo_id', type: 'string', isOptional: true },
        { name: 'inspected_at', type: 'number' },
      ],
    }),
  ],
});
