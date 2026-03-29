# HackForge - Multi-Tenant Case Management SaaS for Nonprofits

## Original Problem Statement
Build a futuristic web application with all SaaS features for nonprofit case management. Team name: HackForge.

## Architecture
- **Frontend**: React 19 + Tailwind CSS + Shadcn UI
- **Backend**: FastAPI (Python) + MongoDB — 14 modular route modules
- **Auth**: JWT (bcrypt + PyJWT) with Advanced RBAC (35 granular permissions)
- **AI**: GPT-4o-mini via Emergent LLM Key (emergentintegrations library)
- **Payments**: Stripe Checkout (payment requests)
- **Email**: SendGrid (graceful fallback)
- **Storage**: Cloud object storage for attachments
- **CI/CD**: GitHub Actions + Docker + docker-compose
- **Testing**: 23 property-based tests (fast-check) + pytest backend

## All Implemented Features (Complete)

### Core
- Multi-tenant isolation, JWT auth, RBAC (Admin/CaseWorker/Volunteer)
- Client CRUD, intake wizard, demographics, duplicate detection
- Service logging with 72-hour edit window
- Visit scheduling with conflict detection
- Outcome tracking with goal-based progress
- Dashboard: stats, trends, demographics breakdown, CSV export

### AI (GPT-4o-mini Powered)
- AI Copilot: Chat with real LLM, auto-detects client context from URL
- Summarize Client: Data-specific professional summaries
- Suggest Tags: Auto-tags based on service history
- Next Actions: Actionable follow-up recommendations
- Missing Fields: Identifies incomplete client records
- AI Narrative Reports: Select specific clients or all, generates professional narratives
- Action Templates: Create Client, Schedule Visit, Log Service, Add Outcome (with AI pre-fill)
- Markdown rendering in chat (bold, lists, line breaks)
- Intelligent data-driven fallbacks when LLM unavailable

### Reporting
- PDF reports (client + organization)
- CSV exports (all entities + dashboard)
- AI narrative report generation (per-client or all)
- Dashboard CSV export (Admin only)

### Infrastructure
- CI/CD: GitHub Actions (test → build → push → deploy)
- Docker: Multi-stage Dockerfile + docker-compose
- 23 frontend property tests (fast-check)
- README with full documentation
- HackForge branding throughout

## Credentials
- Admin: admin@caseflow.io / admin123
- Case Worker: caseworker@demo.caseflow.io / demo1234
- Volunteer: volunteer@demo.caseflow.io / demo1234

## Test Results (All 100%)
- Iterations 7-11: All passing
- 23 frontend property tests: All passing

## P2/Backlog
- Twilio SMS Integration
- Enhanced AI (persistent chat sessions, semantic search)
- Audit trail / activity logging
- i18n / localization
- WCAG 2.2 AA accessibility
