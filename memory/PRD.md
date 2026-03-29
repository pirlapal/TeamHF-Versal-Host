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

### Phase 1-3: MVP + Enhancements + AI Templates
- JWT auth, onboarding, client CRUD, services, visits, outcomes, dashboard, admin settings, CSV export
- AI Copilot (HF + fallback), file attachments, CSV import, demo mode, shareable invites
- AI action templates with confirmation popups, demo credentials, bright/cheerful UI

### Phase 4: Onboarding Wizard + Payments
- TurboTax-like 4-step client wizard, payment requests, mock payment data

### Phase 5: Reports + Refactoring + Notifications + Messaging
- Backend refactoring (14 modular routes), PDF/CSV reporting, notification system, team messaging

### Phase 6: Email + RBAC
- SendGrid email integration (6 triggers, graceful fallback)
- Advanced RBAC: 35 granular permissions, custom permission sets per role

### Phase 7: P0 Bug Fixes (Verified)
- Activity Trend chart fixed (query service_date/date)
- Field Sets CRUD UI added
- Role-based button visibility corrected

### Phase 8: P1 Features (Verified)
- Dashboard Demographics Breakdown Chart (R27.1)
- Advanced Client Filtering by status/date (R9.3)
- Visit Conflict Detection (R6.3)
- Duplicate Client Detection (R4.5)

### Phase 9: Final Features (March 2026 - VERIFIED)
- **Dashboard CSV Export (R27.7)**: Admin-only export button on Dashboard - downloads CSV with summary stats + 30-day daily activity trends
- **AI Narrative Reports (R35.4)**: Admin-only section on Reports page. Select specific clients or "All Clients", generates AI-powered (with fallback) case narrative summaries showing client stats and narrative text
- **Service Log 72-hour Edit Window (R5.4)**: Service logs show "Editable" badge if within 72h of creation, "72h window closed" if past. Backend enforces PUT rejection with 403 after 72h

## Test Results
- Iteration 7: 100% (P0 bug fixes)
- Iteration 8: 100% (P1 features - 27/27 backend)
- Iteration 9: 100% (Final features - 23/23 backend, all frontend)

## Credentials
- Admin: admin@caseflow.io / admin123
- Case Worker: caseworker@demo.caseflow.io / demo1234
- Volunteer: volunteer@demo.caseflow.io / demo1234

## Role-Based Access
- Admin: Full access (Dashboard, Clients, Calendar, Payments, Reports, Messages, Settings)
- Case Worker: Dashboard, Clients, Calendar, Payments, Messages
- Volunteer: Dashboard, Clients, Calendar, Payments (read-only)

## P2/Backlog
- Twilio SMS Integration
- Enhanced AI features (summarization with real LLM, semantic search)
- Audit trail / activity logging
- i18n / localization
- WCAG 2.2 AA accessibility
