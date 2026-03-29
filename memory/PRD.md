# CaseFlow - Multi-Tenant Case Management SaaS for Nonprofits

## Original Problem Statement
Build a futuristic web application with all SaaS features for nonprofit case management with AI Copilot, Stripe payments, comprehensive client management, file attachments, CSV import/export, demo mode, and shareable invite links.

## Architecture
- **Frontend**: React 19 + Tailwind CSS + Shadcn UI (bright cheerful theme)
- **Backend**: FastAPI (Python) + MongoDB — Modular route structure (14 route modules)
- **Auth**: JWT-based (bcrypt + PyJWT) with Advanced RBAC (35 granular permissions)
- **Payments**: Payment Requests system (Stripe checkout available but UI removed)
- **AI**: Hugging Face Inference API (Mistral-7B) with mock fallback
- **Storage**: Emergent Object Storage for file attachments
- **PDF**: reportlab for PDF report generation
- **Email**: SendGrid integration (graceful fallback when no key)

## Backend Structure
```
/app/backend/
├── server.py, config.py, helpers.py
├── models/ (auth, clients, services, payments, admin, ai, notifications)
├── routes/ (auth, clients, services, visits, outcomes, dashboard, payments, admin, ai, storage, demo, reports, notifications, messages)
```

## All Implemented Features

### Phase 1: MVP Core
- JWT auth, onboarding, client CRUD, services, visits, outcomes, dashboard, admin settings, CSV export

### Phase 2: Enhancements
- AI Copilot (HF + fallback), file attachments, CSV import, demo mode, shareable invites

### Phase 3: AI Templates + UI
- AI action templates with confirmation popups, demo user credentials, bright/cheerful UI overhaul

### Phase 4: Onboarding Wizard + Payments
- TurboTax-like 4-step client wizard, payment requests, mock payment data, clear all data

### Phase 5: Reports + Refactoring + Notifications + Messaging
- Backend refactoring (14 modular routes), PDF/CSV reporting, notification system, team messaging, enhanced dashboard

### Phase 6: Bug Fixes + Email + RBAC
- Clear All Data preserves demo accounts, Demo login quick buttons
- SendGrid email integration with graceful fallback (6 triggers)
- Advanced RBAC: 35 granular permissions, custom permission sets per role

### Phase 7: Bug Fixes (Verified)
- Activity Trend chart fixed (query by service_date/date instead of created_at)
- Field Sets CRUD UI added (Add/Edit/Save field sets with types and required flags)
- Role-based button visibility corrected (ADMIN/CASE_WORKER see action buttons, VOLUNTEER read-only)

### Phase 8: P1 Requirements (NEW - March 2026)
- **Dashboard Demographics Breakdown Chart (R27.1)**: Horizontal bar chart showing age_group/gender breakdown
- **Advanced Client Filtering (R9.3)**: Status filter (Active/Pending), date range filters, phone search
- **Visit Conflict Detection (R6.3)**: Warning when scheduling overlapping visits with 'Schedule Anyway' option
- **Duplicate Client Detection (R4.5)**: Warning when creating client with matching email/phone with 'Create Anyway' option

## Test Results
- Iteration 7: Backend 100% (10/10), Frontend 100%
- Iteration 8: Backend 100% (27/27), Frontend 95% (minor Select display fixed)

## Credentials
- Admin: admin@caseflow.io / admin123
- Case Worker: caseworker@demo.caseflow.io / demo1234
- Volunteer: volunteer@demo.caseflow.io / demo1234

## Role-Based Navigation
- Admin: Dashboard, Clients, Calendar, Payments, Reports, Messages, Settings (7 items)
- Case Worker: Dashboard, Clients, Calendar, Payments, Messages (5 items)
- Volunteer: Dashboard, Clients, Calendar, Payments (4 items)

## Remaining P1 Tasks
- R5.4: Service Log 72-hour edit window enforcement
- R27.7: Dashboard CSV export button
- R35.4: AI-generated narrative reports

## P2/Backlog
- Twilio SMS Integration (SMS alerts alongside SendGrid email)
- R16: Enhanced AI features (summarization, tag suggestions, semantic search)
- R13: Audit trail / activity logging
- i18n / localization support
- WCAG 2.2 AA accessibility compliance
