# CaseFlow - Multi-Tenant Case Management SaaS for Nonprofits

## Original Problem Statement
Build a futuristic web application with all the SaaS features integrated and fully working. Multi-tenant case management system for nonprofits with AI Copilot, Stripe payments, and comprehensive client management.

## Architecture
- **Frontend**: React 19 + Tailwind CSS + Shadcn UI (dark "Control Room" theme)
- **Backend**: FastAPI (Python) + MongoDB via Motor
- **Auth**: JWT-based (bcrypt + PyJWT, cookies + Bearer tokens)
- **Payments**: Stripe via emergentintegrations
- **AI**: Mock service (MOCK responses, ready for Hugging Face integration)

## User Personas
1. **Admin**: Full access - org settings, user management, approvals, billing
2. **Case Worker**: Client CRUD, services, visits, outcomes, AI copilot
3. **Volunteer**: Read-only client access

## Core Requirements (Static)
- Multi-tenant data isolation via tenant_id
- JWT auth with login, register, onboarding, invites
- Client CRUD with admin approval workflow
- Service logs, visit scheduling, outcome tracking
- Dashboard with charts (services trends, outcome breakdown)
- AI Copilot (chat, summarize, suggest tags/actions)
- Stripe subscription payments (4 tiers)
- Admin settings: vocabulary config, field sets, user management, invitations
- CSV export
- Role-based access control

## What's Been Implemented (2026-03-29)
- [x] Complete backend API (40+ endpoints)
- [x] JWT authentication with cookie + Bearer token
- [x] Organization onboarding flow
- [x] Client CRUD with search, pagination, approval workflow
- [x] Service logs, outcomes, follow-ups CRUD
- [x] Visit scheduling with status management
- [x] Dashboard with stat cards, line chart, pie chart
- [x] AI Copilot panel (MOCK responses)
- [x] Stripe payment integration (checkout sessions)
- [x] Admin settings (users, invites, vocabulary, field sets)
- [x] CSV export for clients
- [x] Dark "Control Room" UI theme with Outfit/IBM Plex Sans/JetBrains Mono fonts
- [x] Role-based navigation and access control
- [x] All tests passing (100% backend, 100% frontend, 100% integration)

## Prioritized Backlog
### P0 (Critical - Next)
- Replace MOCK AI with real Hugging Face LLM integration
- File attachments for client records
- CSV import (currently only export)

### P1 (Important)
- Demo/sandbox mode
- Audit log UI
- Client merge/dedup
- Configurable approval workflow

### P2 (Nice to Have)
- Real-time notifications
- Mobile-responsive refinements
- Email notifications for invites
- Customizable dashboard widgets
- Advanced reporting/analytics

## Next Tasks
1. Integrate Hugging Face LLM for AI Copilot
2. Add file upload/attachment capability
3. Build CSV import flow
4. Add demo mode with sample data
5. Implement audit log viewer
