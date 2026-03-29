# CaseFlow - Multi-Tenant Case Management SaaS for Nonprofits

## Original Problem Statement
Build a futuristic web application with all SaaS features for nonprofit case management with AI Copilot, Stripe payments, comprehensive client management, file attachments, CSV import/export, demo mode, and shareable invite links.

## Architecture
- **Frontend**: React 19 + Tailwind CSS + Shadcn UI (bright cheerful theme: Nunito/DM Sans, coral+teal)
- **Backend**: FastAPI (Python) + MongoDB via Motor
- **Auth**: JWT-based (bcrypt + PyJWT, cookies + Bearer)
- **Payments**: Stripe via emergentintegrations
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
- Demo user credentials: Case Worker (caseworker@demo.caseflow.io / demo1234), Volunteer (volunteer@demo.caseflow.io / demo1234)
- Complete UI overhaul: warm cream (#FFF8F0), coral (#F97316) primary, teal (#14B8A6) accent, rounded-xl corners, Nunito/DM Sans fonts

## Test Results (Latest)
- Backend: 100% (17/17)
- Frontend: 100%
- AI Features: 100%
- Role-Based Access: 100%
- Theme: 100%

## Credentials
- Admin: admin@caseflow.io / admin123
- Case Worker: caseworker@demo.caseflow.io / demo1234
- Volunteer: volunteer@demo.caseflow.io / demo1234
