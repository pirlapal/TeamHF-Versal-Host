# CaseFlow - Multi-Tenant Case Management SaaS for Nonprofits

## Original Problem Statement
Build a futuristic web application with all SaaS features for nonprofit case management with AI Copilot, Stripe payments, comprehensive client management, file attachments, CSV import/export, demo mode, and shareable invite links.

## Architecture
- **Frontend**: React 19 + Tailwind CSS + Shadcn UI (bright cheerful theme: Nunito/DM Sans, coral+teal)
- **Backend**: FastAPI (Python) + MongoDB via Motor
- **Auth**: JWT-based (bcrypt + PyJWT, cookies + Bearer)
- **Payments**: Stripe via emergentintegrations + Payment Requests system
- **AI**: Hugging Face Inference API (Mistral-7B) with mock fallback + Action Templates
- **Storage**: Emergent Object Storage for file attachments

## What's Been Implemented

### Phase 1 (MVP) - 2026-03-29
- JWT auth, onboarding, client CRUD, services, visits, outcomes, dashboard, Stripe, admin settings, CSV export

### Phase 2 (Enhancements) - 2026-03-29
- AI Copilot (HF + fallback), file attachments, CSV import, demo mode, shareable invites

### Phase 3 (AI Templates + UI + Demo Users) - 2026-03-29
- AI action templates: Create Client, Schedule Visit, Log Service, Add Outcome Goal
- Confirmation popup with editable fields before AI executes actions
- Demo user credentials: Case Worker, Volunteer
- Complete UI overhaul: warm cream, coral primary, teal accent

### Phase 4 (Onboarding Wizard + Payments + Clear Data) - 2026-03-29
- **Client Onboarding Wizard**: TurboTax-like 4-step wizard (Personal Info -> Demographics -> Services -> First Visit) with progress bar, animated transitions, review summary
- **Payment Requests**: Send/track payment requests to clients with status management (PENDING/PAID/OVERDUE/CANCELLED), summary cards (Received/Pending/Overdue totals)
- **Payments Page Redesign**: Tabs for Subscriptions, Payment Requests, History
- **Mock Payment Data**: Demo Mode seeds payment requests and subscription transactions
- **Clear All Data**: Button in Admin Settings Demo tab to wipe all organization data
- **Onboard Wizard Button**: Added to Clients page for quick access

## Test Results (Latest - Iteration 4)
- Backend: 100% (14/14)
- Frontend: 100%
- All features working correctly

## Credentials
- Admin: admin@caseflow.io / admin123
- Case Worker: caseworker@demo.caseflow.io / demo1234
- Volunteer: volunteer@demo.caseflow.io / demo1234

## Key API Endpoints
- POST /api/clients/wizard - Client onboarding wizard
- POST /api/demo/clear - Clear all demo data
- POST /api/payments/request - Send payment request
- GET /api/payments/requests - List payment requests
- PATCH /api/payments/requests/{id} - Update request status

## Remaining Tasks (Backlog)
- P1: Advanced Reporting & Export (PDF reports, outcome charts)
- P2: Backend refactoring (split server.py into modular routes)
- P2: Notification system (in-app alerts)
- P3: Communication integrations (email/SMS)
- P3: Custom dashboard widgets/layouts
