# HackForge - Multi-Tenant Case Management SaaS for Nonprofits

## Architecture
- **Frontend**: React 19 + Tailwind CSS + Shadcn UI
- **Backend**: FastAPI (Python) + MongoDB — 14 modular route modules
- **Auth**: JWT (bcrypt + PyJWT) with Advanced RBAC (35 granular permissions)
- **AI**: GPT-4o-mini via Emergent LLM Key
- **CI/CD**: GitHub Actions + Docker + docker-compose

## All Implemented Features (Complete)

### Core
- Multi-tenant isolation, JWT auth, RBAC (Admin/CaseWorker/Volunteer)
- Client CRUD with intake wizard, demographics, duplicate detection, CSV import/export
- Service logging with 72-hour edit window (R5.4)
- Visit scheduling with conflict detection (R6.3)
- Outcome tracking, dashboard stats/trends/demographics, CSV export (R27.7)

### AI (GPT-4o-mini)
- Copilot: Chat, Summarize, Tags, Next Actions, Missing Fields
- AI Narrative Reports (per-client or all) (R35.4)
- Action Templates with AI pre-fill

### Admin
- **Vocabulary**: Custom labels propagate across entire app (sidebar, pages) via TenantProvider context
- **Field Sets**: Custom field definitions appear in Client Detail display + Edit dialog
- **Client Editing**: Full edit capability — Basic Info, Demographics (6 fields), Custom Fields (dynamic from field sets)
- Advanced RBAC: 35 permissions, custom permission sets

### Infrastructure
- CI/CD: GitHub Actions (test → build → push → deploy)
- Docker + docker-compose (host anywhere)
- 23 property-based tests (fast-check)
- Deployment health check passed

## Credentials
- Admin: admin@caseflow.io / admin123
- Case Worker: caseworker@demo.caseflow.io / demo1234
- Volunteer: volunteer@demo.caseflow.io / demo1234

## Test Results (All 100%)
- Iterations 7-12: All passing

## P2/Backlog
- Twilio SMS Integration
- Persistent AI chat sessions
- Audit trail / activity logging
- i18n / WCAG accessibility
