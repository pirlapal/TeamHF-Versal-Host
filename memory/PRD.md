# HackForge - Multi-Tenant Case Management SaaS for Nonprofits

## Original Problem Statement
Build a futuristic web application with all SaaS features for nonprofit case management. Team name: HackForge.

## Architecture
- **Frontend**: React 19 + Tailwind CSS + Shadcn UI
- **Backend**: FastAPI (Python) + MongoDB — 14 modular route modules
- **Auth**: JWT (bcrypt + PyJWT) with Advanced RBAC (35 granular permissions)
- **AI**: Hugging Face Inference API (Mistral-7B) with fallback
- **Payments**: Stripe Checkout (payment requests)
- **Email**: SendGrid (graceful fallback)
- **Storage**: Cloud object storage for attachments
- **CI/CD**: GitHub Actions + Docker + docker-compose
- **Testing**: 23 property-based tests (fast-check) + pytest backend tests

## All Implemented Features (Complete)

### Core
- Multi-tenant isolation, JWT auth, RBAC (Admin/CaseWorker/Volunteer)
- Client CRUD, intake wizard, demographics, duplicate detection (R4.5)
- Service logging with 72-hour edit window (R5.4)
- Visit scheduling with conflict detection (R6.3)
- Outcome tracking with goal-based progress
- Dashboard: stats, trends, demographics breakdown (R27.1), CSV export (R27.7)

### Advanced
- AI Copilot with chat + action templates
- AI Narrative Reports: select specific clients or all (R35.4)
- PDF reports (client + org), CSV exports (all entities)
- Payment requests with Stripe Checkout
- SendGrid email notifications (6 triggers)
- In-app notifications + team messaging
- File attachments (cloud storage)
- CSV import/export with preview
- Demo mode (seed/clear) with AlertDialog confirmation
- Advanced client filtering by status/date range (R9.3)
- Custom Field Sets CRUD
- Custom permission sets per role (35 permissions)

### Infrastructure
- CI/CD: GitHub Actions pipeline (test → build → push → deploy)
- Docker: Multi-stage Dockerfile (backend + frontend)
- docker-compose: Full stack orchestration (MongoDB + backend + frontend + nginx)
- 23 frontend property tests with fast-check
- README with full documentation

## Credentials
- Admin: admin@caseflow.io / admin123
- Case Worker: caseworker@demo.caseflow.io / demo1234
- Volunteer: volunteer@demo.caseflow.io / demo1234

## Test Results
- Iteration 7-10: All 100% pass rate
- 23 frontend property tests: All passing
- Backend pytest: All passing

## P2/Backlog
- Twilio SMS Integration
- Enhanced AI (real LLM summarization, semantic search)
- Audit trail / activity logging
- i18n / localization
- WCAG 2.2 AA accessibility compliance
