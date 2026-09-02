# Multi-organisation EADREAMSS SaaS plan

## Goal
Convert the current EADREAMSS competition platform into a secure, multi-organisation, multi-user product. EADREAMSS will be the first organisation, with one platform-level Super Admin who can manage all organisations, users, branding, plans, and organisation data. Each Organisation Admin will manage only their own organisation.

## Recommended launch scope
- **Platform Super Admin:** create/approve/suspend organisations; manage organisation admins; view or support organisation data; configure plans, limits, branding, domains, and platform settings.
- **Organisation Admin:** manage that organisation’s students, batches, categories, competitions, questions, assignments, support, reports, and results.
- **Student:** remains the test-taking user and can access only their organisation’s assigned tests and permitted results.
- **Organisation onboarding:** support both Super Admin-created organisations and customer onboarding requests requiring approval.
- **Branding:** provide a branded subdomain for every organisation and support custom domains as an upgrade or assisted setup.

## Delivery phases

### 1. Secure identity and tenancy foundation
- Add an organisations registry with status, contact details, plan, limits, branding, subdomain, and custom-domain fields.
- Add organisation membership and role records using server-validated roles; do not store authorisation decisions in browser storage or on a profile record.
- Replace the current plaintext/password-column login approach with managed authentication and server-side role checks. Existing student credentials will be migrated through a controlled compatibility/reset flow rather than exposed or copied into new tenants.
- Add a safe initial platform-owner bootstrap path and ensure there is no public route for creating a Super Admin.
- Add tenant ownership to every business table: students, competitions, questions, assignments, answers, result summaries, signup requests, support tickets, batches, and categories.
- Add indexes, uniqueness rules, and server-side policies/functions so every read and write is scoped to the active organisation; Super Admin access is explicit and auditable.

### 2. Migrate EADREAMSS
- Create EADREAMSS as the initial organisation and assign its existing records to it without changing test, answer, result, timing, or attempt history.
- Backfill existing admins, students, competitions, questions, assignments, results, batches, categories, signup requests, and support data.
- Add a migration validation report for orphaned records, duplicate usernames/phones, missing ownership, and inconsistent assignments before enabling tenant enforcement.
- Preserve current timing and scoring behavior while making all server-side calculations tenant-aware.

### 3. Application access and organisation context
- Add Super Admin routes and navigation for organisation management, organisation switching, global users, plans/limits, branding, domains, audit history, and support.
- Add an organisation context selector for users who belong to more than one organisation, with the selected organisation validated against membership.
- Update all current admin pages and all student queries to use the active organisation context; remove assumptions that there is only one global dataset.
- Add organisation-aware signup approval, test assignment, result visibility, exports, WhatsApp links, OCR imports, and undo actions.
- Keep Organisation Admin screens focused on their own organisation and prevent cross-organisation IDs from being accepted by client requests.

### 4. White-label product layer
- Add organisation name, logo, favicon, primary/secondary colours, login copy, contact details, and email/WhatsApp message identity.
- Resolve branding from the organisation subdomain or custom domain before protected pages render.
- Add Super Admin controls for domain verification/status and a fallback branded URL while a custom domain is pending.
- Ensure exports, login screens, student pages, result PDFs, and notifications use the organisation’s branding while platform controls remain Super Admin-only.

### 5. Commercial readiness
- Add plan and usage enforcement for active students, organisation admins, competitions, questions, storage/OCR usage, exports, and support level.
- Start with manual plan assignment and invoicing-ready records; add automated checkout only after the limits and upgrade paths are proven.
- Add organisation lifecycle states: trial, active, past-due, suspended, and cancelled, with clear student/admin behavior for each.
- Add audit events for Super Admin actions, membership changes, impersonation/support access, data exports, and organisation suspension.

## Recommended pricing
Use a **hybrid tier**: a monthly/annual platform fee includes a number of active students, then larger organisations upgrade tiers or pay for additional student blocks. Price in the customer’s market after validating support and infrastructure costs; these are starting ranges, not a final quote:

| Tier | Suggested starting price | Included active students | Positioning |
|---|---:|---:|---|
| Starter | ₹2,499–₹4,999/month | Up to 250 | Small coaching centre or pilot |
| Growth | ₹7,500–₹14,999/month | Up to 1,000 | Established institute with multiple tests |
| Professional | ₹20,000–₹39,999/month | Up to 5,000 | Larger academy, advanced reporting and branding |
| Enterprise | ₹60,000+/month or annual quote | Custom | Custom domain, onboarding, SLA, migration, support |

Recommended commercial rules:
- Offer 10–20% savings for annual billing and charge a one-time onboarding/data-migration fee for larger customers.
- Keep custom domains, advanced white-labeling, audit access, priority support, and higher OCR/storage limits in Professional/Enterprise.
- Charge extra for bespoke integrations, dedicated support, data migration, and custom workflows rather than hiding those costs in the base subscription.
- Before publishing prices, calculate per-organisation database, storage, AI/OCR, messaging, support, and payment costs, then target a healthy gross margin.

## Technical implementation details
- Use database migrations for schema changes, with explicit grants and row-level security policies for every new public table.
- Use separate organisation membership/role records and security-definer authorization functions to avoid recursive policy checks.
- Move sensitive operations such as provisioning admins, password reset, organisation creation, bulk assignment, and cross-tenant support access behind authenticated server functions.
- Never rely on localStorage for authentication, Super Admin status, organisation selection, or permissions.
- Add automated tenant-isolation tests and browser checks for: Super Admin cross-tenant access, Organisation Admin denial outside their organisation, student denial outside their organisation, custom-domain branding, and suspended-organisation behavior.
- Deliver in increments: foundation and EADREAMSS migration first, then application refactor, then branding/domains, then plans and billing. Do not expose customer organisations until isolation tests pass.

## Acceptance criteria
- EADREAMSS data continues to work with unchanged historical results and timing records.
- A second organisation can be created and operated without seeing or modifying EADREAMSS data.
- Super Admin can manage both organisations and their organisation admins from a dedicated control area.
- Organisation Admin can manage only their own organisation.
- Student login, signup approval, test assignment, test timing, results, exports, OCR, and notifications remain organisation-scoped.
- Branding and URLs identify each organisation, and platform ownership remains hidden from organisation users.
- No plaintext credential storage, client-side privilege checks, or unrestricted public business-table access remains in the production path.
