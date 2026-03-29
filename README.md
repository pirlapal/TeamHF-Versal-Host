# HackForge — Case Management SaaS for Nonprofits

A modern, multi-tenant case management platform built for nonprofit organizations. Track clients, schedule visits, log services, measure outcomes, and generate AI-powered reports — all from a single dashboard.

---

## Features

| Category | Highlights |
|---|---|
| **Client Management** | Registration, intake wizard, demographics, duplicate detection, CSV import/export |
| **Service Logging** | Track services per client, 72-hour edit window enforcement, service type categorization |
| **Visit Scheduling** | Calendar view, conflict detection, status tracking (Scheduled/Completed/Cancelled) |
| **Outcome Tracking** | Goal-based outcomes, progress tracking, achievement status |
| **Dashboard** | Real-time stats, activity trends, demographics breakdown, CSV export |
| **AI Copilot** | Chat assistant, action templates, AI-generated narrative reports |
| **Payments** | Payment requests, Stripe checkout integration, overdue tracking |
| **Reports** | PDF reports (client + org), CSV exports (all entities), AI narrative summaries |
| **RBAC** | 3 default roles (Admin, Case Worker, Volunteer), 35 granular permissions, custom permission sets |
| **Notifications** | In-app bell notifications, SendGrid email integration (6 event triggers) |
| **Team Messaging** | Real-time messaging between team members |
| **Demo Mode** | One-click demo data seeding with 3 pre-configured accounts |
| **File Attachments** | Upload/download files per client (cloud storage) |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Tailwind CSS, Shadcn UI, Recharts |
| Backend | FastAPI (Python), Motor (async MongoDB driver) |
| Database | MongoDB 7 |
| Auth | JWT (bcrypt + PyJWT) with role-based access control |
| AI | Hugging Face Inference API (Mistral-7B) |
| Storage | Cloud object storage for file attachments |
| Email | SendGrid (graceful fallback when unavailable) |
| Payments | Stripe Checkout |
| CI/CD | GitHub Actions, Docker, docker-compose |

---

## Quick Start

### Prerequisites

- Docker & Docker Compose
- (Optional) Node.js 20+ and Python 3.11+ for local development

### Run with Docker Compose

```bash
# Clone the repository
git clone https://github.com/your-org/hackforge.git
cd hackforge

# Configure environment
cp backend/.env.docker backend/.env
# Edit backend/.env with your secrets (JWT_SECRET, etc.)

# Start all services
REACT_APP_BACKEND_URL=http://localhost docker compose up --build -d

# App is available at http://localhost
```

### Local Development

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8001 --reload

# Frontend (separate terminal)
cd frontend
yarn install
REACT_APP_BACKEND_URL=http://localhost:8001 yarn start
```

---

## Project Structure

```
hackforge/
├── .github/workflows/ci-cd.yml   # GitHub Actions CI/CD pipeline
├── Dockerfile                     # Multi-stage build (backend + frontend)
├── docker-compose.yml             # Full stack orchestration
├── nginx.conf                     # Frontend reverse proxy config
├── backend/
│   ├── server.py                  # FastAPI entry point
│   ├── config.py                  # Database & app configuration
│   ├── helpers.py                 # Auth, email, utility functions
│   ├── models/                    # Pydantic data models
│   │   ├── auth.py, clients.py, services.py
│   │   ├── payments.py, admin.py, ai.py, notifications.py
│   └── routes/                    # API route modules (14 total)
│       ├── auth.py, clients.py, services.py, visits.py
│       ├── outcomes.py, dashboard.py, payments.py
│       ├── admin.py, ai.py, storage.py, demo.py
│       ├── reports.py, notifications.py, messages.py
├── frontend/
│   ├── src/
│   │   ├── App.js                 # Root component & routing
│   │   ├── lib/                   # API client, auth context
│   │   ├── components/            # Shared components (Sidebar, Layout, AI Copilot)
│   │   │   └── ui/                # Shadcn UI components
│   │   ├── pages/                 # Page components
│   │   │   ├── Dashboard.js, Clients.js, ClientDetail.js
│   │   │   ├── Calendar.js, AdminSettings.js, Reports.js
│   │   │   ├── Payments.js, Messages.js, Login.js
│   │   │   └── ClientWizard.js, Onboarding.js
│   │   └── __tests__/             # Property-based tests (fast-check)
│   └── public/
└── memory/                        # Project documentation
```

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/register` | User registration |
| GET | `/api/clients` | List clients (with filtering) |
| POST | `/api/clients` | Create client |
| POST | `/api/clients/check-duplicate` | Check for duplicate contacts |
| GET | `/api/clients/{id}` | Get client details |
| POST | `/api/clients/{id}/services` | Log a service |
| PUT | `/api/clients/{id}/services/{sid}` | Update service (72h window) |
| GET | `/api/visits` | List visits |
| POST | `/api/visits` | Schedule visit |
| POST | `/api/visits/check-conflicts` | Check scheduling conflicts |
| GET | `/api/dashboard/stats` | Dashboard statistics |
| GET | `/api/dashboard/trends` | Activity trends |
| GET | `/api/dashboard/demographics` | Client demographics breakdown |
| GET | `/api/reports/dashboard-csv` | Export dashboard as CSV |
| POST | `/api/reports/narrative` | AI narrative report generation |
| GET | `/api/reports/org/pdf` | Organization PDF report |
| POST | `/api/demo/seed` | Seed demo data |
| POST | `/api/demo/clear` | Clear organization data |

---

## Demo Accounts

| Role | Email | Password |
|---|---|---|
| Admin | `admin@caseflow.io` | `admin123` |
| Case Worker | `caseworker@demo.caseflow.io` | `demo1234` |
| Volunteer | `volunteer@demo.caseflow.io` | `demo1234` |

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `MONGO_URL` | Yes | MongoDB connection string |
| `DB_NAME` | Yes | Database name |
| `JWT_SECRET` | Yes | Secret for JWT signing |
| `ADMIN_EMAIL` | No | Default admin email |
| `ADMIN_PASSWORD` | No | Default admin password |
| `HF_TOKEN` | No | Hugging Face API token (AI features) |
| `SENDGRID_API_KEY` | No | SendGrid API key (email notifications) |
| `STRIPE_SECRET_KEY` | No | Stripe secret key (payments) |

### Frontend (`frontend/.env`)

| Variable | Required | Description |
|---|---|---|
| `REACT_APP_BACKEND_URL` | Yes | Backend API base URL |

---

## CI/CD Pipeline

The GitHub Actions workflow (`.github/workflows/ci-cd.yml`) runs:

1. **Backend Tests** — Python tests with MongoDB service container
2. **Frontend Tests** — 23 property-based tests + lint + build
3. **Docker Build** — Multi-stage image build and push to GHCR
4. **Deploy** — Notification with deployment instructions

### Deploy Anywhere

```bash
# Pull latest images
docker compose pull

# Start/restart services
docker compose up -d

# View logs
docker compose logs -f backend
```

Works with any Docker-compatible host: AWS ECS, GCP Cloud Run, Azure Container Apps, DigitalOcean, Railway, Fly.io, or your own VPS.

---

## Testing

```bash
# Frontend property tests (23 tests with fast-check)
cd frontend && yarn test --watchAll=false

# Backend tests
cd backend && python -m pytest tests/ -v
```

---

## License

MIT

---

**Built by HackForge Team**
