# CaseFlow - Multi-Tenant Case Management SaaS for Nonprofits

## Original Problem Statement
Build a futuristic web application with all SaaS features for nonprofit case management with AI Copilot, Stripe payments, comprehensive client management, file attachments, CSV import/export, demo mode, and shareable invite links.

## Architecture
- **Frontend**: React 19 + Tailwind CSS + Shadcn UI (bright cheerful theme)
- **Backend**: FastAPI (Python) + MongoDB via Motor — Modular route structure
- **Auth**: JWT-based (bcrypt + PyJWT)
- **Payments**: Stripe + Payment Requests system
- **AI**: Hugging Face Inference API (Mistral-7B) with mock fallback
- **Storage**: Emergent Object Storage for file attachments
- **PDF**: reportlab for PDF report generation

## Backend Structure (Refactored)
```
/app/backend/
├── server.py          (slim entry: app, CORS, router includes, startup)
├── config.py          (env vars, DB, constants)
├── helpers.py         (auth, serialization, storage, HF AI, notifications)
├── models/            (Pydantic request models)
│   ├── auth.py, clients.py, services.py, payments.py, admin.py, ai.py, notifications.py
├── routes/            (14 API route modules)
│   ├── auth.py, clients.py, services.py, visits.py, outcomes.py
│   ├── dashboard.py, payments.py, admin.py, ai.py
│   ├── storage.py, demo.py, reports.py, notifications.py, messages.py
```

## What's Been Implemented

### Phase 1 (MVP)
- JWT auth, onboarding, client CRUD, services, visits, outcomes, dashboard, Stripe, admin settings, CSV export

### Phase 2 (Enhancements)
- AI Copilot (HF + fallback), file attachments, CSV import, demo mode, shareable invites

### Phase 3 (AI Templates + UI + Demo Users)
- AI action templates with confirmation popups, demo user credentials, bright/cheerful UI overhaul

### Phase 4 (Onboarding Wizard + Payments + Clear Data)
- TurboTax-like 4-step client wizard, payment requests, mock payment data, clear all data

### Phase 5 (Reports + Refactoring + Notifications + Messaging + Dashboard)
- **Backend Refactoring**: Split monolithic server.py (~1500 lines) into 14 modular route files, separate models, config, helpers
- **Advanced Reporting**: PDF reports (client + org) using reportlab, CSV export for services/visits/outcomes/payments
- **Notification System**: In-app bell with unread badge, mark read/unread, auto-generated on events
- **Team Messaging**: In-app messaging between team members with compose/reply/read tracking
- **Enhanced Dashboard**: Activity widgets (recent clients, upcoming visits, overdue payments, quick actions), trend chart, outcome distribution
- **Payments Redesigned**: Subscriptions removed, payment requests only with filter tabs (ALL/PENDING/PAID/OVERDUE/CANCELLED)

## Test Results (Latest - Iteration 5)
- Backend: 100% (36/36)
- Frontend: 100%
- All features working correctly

## Credentials
- Admin: admin@caseflow.io / admin123
- Case Worker: caseworker@demo.caseflow.io / demo1234
- Volunteer: volunteer@demo.caseflow.io / demo1234

## Key API Endpoints
- Auth: POST /api/auth/login, /register, /logout, GET /api/auth/me
- Clients: GET/POST /api/clients, POST /api/clients/wizard, /api/clients/import
- Dashboard: GET /api/dashboard/stats, /trends, /outcomes, /activity
- Reports: GET /api/reports/export, /export/{type}, /client/{id}/pdf, /org/pdf
- Notifications: GET /api/notifications, /unread-count, PATCH /{id}/read, POST /read-all
- Messages: GET/POST /api/messages, GET /{id}, POST /{id}/reply, GET /unread-count
- Payments: POST /api/payments/request, GET /requests, PATCH /requests/{id}, GET /summary, /history
- Demo: POST /api/demo/seed, /demo/clear
