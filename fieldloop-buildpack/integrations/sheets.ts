// FieldLoop v0.1 — integrations/sheets.ts
// Google Sheets two-way: import the receptionist's Bookings sheet into job
// drafts, and export a live Roster/Status sheet for office visibility.
// Deps: googleapis, google-auth-library.

import { google, sheets_v4 } from 'googleapis';
import { JWT } from 'google-auth-library';

export interface SheetsConfig {
  clientEmail: string; // service account email
  privateKey: string;  // PEM private key (env: GOOGLE_PRIVATE_KEY)
}

export function buildSheetsClient(cfg: SheetsConfig): sheets_v4.Sheets {
  const auth = new JWT({
    email: cfg.clientEmail,
    key: cfg.privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

export interface BookingRow {
  clientName: string;
  address: string;
  phone: string;
  jobType: 'standard' | 'body_corporate' | 'insurance_repair';
  division: string;
  notes: string;
}

/**
 * Import the Bookings sheet. Header row (A1:F1) must be:
 * Client, Address, Phone, Job Type, Division, Notes
 */
export async function importBookings(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  range = 'Bookings!A2:F',
): Promise<BookingRow[]> {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  return (res.data.values ?? []).map((row) => ({
    clientName: row[0] ?? '',
    address: row[1] ?? '',
    phone: row[2] ?? '',
    jobType: (row[3] as BookingRow['jobType']) ?? 'standard',
    division: row[4] ?? '',
    notes: row[5] ?? '',
  }));
}

export interface RosterRow {
  jobNumber: string;
  clientName: string;
  address: string;
  technician: string;
  status: string;
}

const ROSTER_HEADER: RosterRow = {
  jobNumber: 'Job',
  clientName: 'Client',
  address: 'Address',
  technician: 'Technician',
  status: 'Status',
};

/** Export the live roster/status board for office visibility. */
export async function exportRoster(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  rows: RosterRow[],
  range = 'Roster!A2:E',
): Promise<void> {
  const values = [Object.values(ROSTER_HEADER), ...rows.map((r) => Object.values(r))];
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  });
}
