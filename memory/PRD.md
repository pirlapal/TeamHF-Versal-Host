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
- **Bug Fix**: Clear All Data preserves demo user accounts (caseworker/volunteer survive)
- **Bug Fix**: Demo login quick buttons on login page (Admin, Case Worker, Volunteer)
- **Email Notifications**: SendGrid integration with graceful fallback. 6 triggers: new client, visit scheduled, payment request, payment received, new message, client onboarded
- **Advanced RBAC**: 35 granular permissions across 12 categories. Custom permission sets per role. Admin UI with checkbox grid editor, save/reset to defaults

## Test Results (Iteration 6)
- Backend: 100% (15/15)
- Frontend: 100%

## Credentials
- Admin: admin@caseflow.io / admin123
- Case Worker: caseworker@demo.caseflow.io / demo1234
- Volunteer: volunteer@demo.caseflow.io / demo1234

## Role-Based Navigation
- Admin: Dashboard, Clients, Calendar, Payments, Reports, Messages, Settings (7 items)
- Case Worker: Dashboard, Clients, Calendar, Payments, Messages (5 items)
- Volunteer: Dashboard, Clients, Calendar, Payments (4 items)
