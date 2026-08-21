# FieldLoop v0.1 — Company Profile (canonical)

The authoritative corporate identity for the FieldLoop build. This replaces the
placeholder ABN used in the initial draft.

## About us (verbatim)

Chatsworth Constructions is the parent company of the following: Roof
Distributors, Caulfield South Plumbing & Majon Kitchens. Together these four
companies can provide a complete building/construction solution for all
renovation, extension or property maintenance requirements. These include, but
are not limited to: design, manufacture and installation of kitchen, bathroom
and other cabinetry; roof maintenance, repairs and replacement of tile and metal
roofing; all plumbing requirements including gas connection; total building
solutions for all required construction, renovation or repair work. All our
tradespeople are qualified, experienced and quality focused, to provide you with
the best result possible for any work we undertake.

## Registered details

| Field | Value |
|-------|-------|
| Registered name | Chatsworth Constructions Pty Ltd |
| ABN | 90 056 106 855 |
| ACN | 056 106 855 |
| Website | http://www.chatsworthconstructions.com.au |
| Industry | Construction |
| Company size | 11–50 employees |
| Headquarters | Caulfield South, VIC |
| Type | Privately held |
| Specialties | Building Insurance Repairs · Renovations and extensions · Kitchen and Bathrooms — made to measure · Body Corporate Management Maintenance work |

Source: [ABN Lookup](https://abr.business.gov.au/ABN/View?abn=90056106855).
Confirm the registered name/status on the register before using the ABN in
tax/compliance rendering — this is the entity the register returns for the
Caulfield South construction company, but the operator should verify it is the
correct legal entity.

## Entity model — four operating entities

"Together these four companies" resolves to **four operating entities**: the
parent itself trades as a general-building entity, plus the three divisions.

| # | Entity (`entities.division_name`) | Scope | VBA PIC |
|---|----------------------------------|-------|---------|
| 1 | Chatsworth Constructions | Total building solutions: renovations, extensions, construction, repairs | — |
| 2 | Caulfield South Plumbing | General, gasfitting, and drainage plumbing | 118492 |
| 3 | Majon Kitchens | Cabinetry, bathroom vanity repairs, custom joinery | — |
| 4 | Roof Distributors | Metal and tile roofing repair and maintenance | — |

All four share `parent_abn = 90056106855`. Tenancy remains parent-scoped; RLS
isolation is per entity via `entity_members`.

## Specialties → FieldLoop mapping

| Corporate specialty | FieldLoop representation |
|---------------------|--------------------------|
| Building Insurance Repairs | `jobs.job_type = 'insurance_repair'` |
| Body Corporate Management Maintenance work | `jobs.job_type = 'body_corporate'` |
| Renovations and extensions | Chatsworth Constructions (general building) entity |
| Kitchen and Bathrooms — made to measure | Majon Kitchens entity |
