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
│   ├── helpers.py                 # Auth, email, RBAC, utility functions
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
│       └── test-auth.html         # Permission testing utility
└── memory/                        # Project documentation
```

---

## Demo Accounts

HackForge includes 3 pre-configured demo accounts with different permission levels:

| Role | Email | Password | Sidebar Tabs | Permissions |
|------|-------|----------|--------------|-------------|
| **Admin** | `admin@caseflow.io` | `admin123` | 7 tabs (all) | Full access to all features |
| **Case Worker** | `caseworker@demo.caseflow.io` | `demo1234` | 5 tabs | Create/manage clients, services, visits, payments, messages |
| **Volunteer** | `volunteer@demo.caseflow.io` | `demo1234` | 3 tabs | Read-only access to clients, services, visits |

### First-Time Setup

1. Log in as **Admin** (`admin@caseflow.io` / `admin123`)
2. Go to **Settings** → **Demo Data**
3. Click **"Seed Demo Data"** to create:
   - 12 demo clients with services and outcomes
   - Case Worker and Volunteer user accounts
   - Sample visits, payments, and notifications

---

## Role-Based Access Control (RBAC)

### Navigation Visibility by Role

The sidebar dynamically shows/hides navigation items based on user permissions:

| Navigation Item | Permission Required | Admin | Case Worker | Volunteer |
|----------------|---------------------|-------|-------------|-----------|
| **Dashboard** | _(always visible)_ | ✅ | ✅ | ✅ |
| **Clients** | `clients.read` | ✅ | ✅ | ✅ |
| **Calendar** | `visits.read` | ✅ | ✅ | ✅ |
| **Payments** | `payments.read` | ✅ | ✅ | ❌ |
| **Reports** | `reports.read` | ✅ | ❌ | ❌ |
| **Messages** | `messages.read` | ✅ | ✅ | ❌ |
| **Settings** | `admin.settings` | ✅ | ❌ | ❌ |

### Default Permissions by Role

#### Admin (33 permissions)
```
clients.create, clients.read, clients.update, clients.delete, clients.import, clients.approve
services.create, services.read
visits.create, visits.read, visits.update
outcomes.create, outcomes.read, outcomes.update
follow_ups.create, follow_ups.read, follow_ups.update
payments.create, payments.read, payments.update
reports.read, reports.export
messages.create, messages.read
admin.users, admin.settings, admin.vocabulary, admin.roles
demo.seed, demo.clear
ai.copilot, ai.templates
storage.upload, storage.read, storage.delete
```

#### Case Worker (23 permissions)
```
clients.create, clients.read, clients.update, clients.import
services.create, services.read
visits.create, visits.read, visits.update
outcomes.create, outcomes.read, outcomes.update
follow_ups.create, follow_ups.read, follow_ups.update
payments.create, payments.read
messages.create, messages.read
ai.copilot, ai.templates
storage.upload, storage.read
```

#### Volunteer (6 permissions)
```
clients.read
services.read
visits.read
outcomes.read
follow_ups.read
storage.read
```

### Custom Roles

Admins can create custom roles with specific permission sets via the Admin Settings page. Custom role permissions override default role permissions.

---

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/register` | User registration |
| POST | `/api/onboard` | Organization onboarding |
| GET | `/api/auth/me` | Get current user with permissions |
| POST | `/api/auth/logout` | User logout |
| POST | `/api/auth/refresh` | Refresh access token |

### Clients
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/clients` | List clients (with filtering) |
| POST | `/api/clients` | Create client |
| POST | `/api/clients/check-duplicate` | Check for duplicate contacts |
| GET | `/api/clients/{id}` | Get client details |
| PUT | `/api/clients/{id}` | Update client |
| DELETE | `/api/clients/{id}` | Delete client |

### Services & Visits
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/clients/{id}/services` | Log a service |
| PUT | `/api/clients/{id}/services/{sid}` | Update service (72h window) |
| GET | `/api/visits` | List visits |
| POST | `/api/visits` | Schedule visit |
| POST | `/api/visits/check-conflicts` | Check scheduling conflicts |

### Dashboard & Reports
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/dashboard/stats` | Dashboard statistics |
| GET | `/api/dashboard/trends` | Activity trends |
| GET | `/api/dashboard/demographics` | Client demographics breakdown |
| GET | `/api/reports/dashboard-csv` | Export dashboard as CSV |
| POST | `/api/reports/narrative` | AI narrative report generation |
| GET | `/api/reports/org/pdf` | Organization PDF report |

### Demo & Admin
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/demo/seed` | Seed demo data (Admin only) |
| POST | `/api/demo/clear` | Clear organization data (Admin only) |
| GET | `/api/admin/users` | List organization users |
| POST | `/api/invites` | Create user invite (Admin only) |

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `MONGO_URL` | Yes | MongoDB connection string |
| `DB_NAME` | Yes | Database name |
| `JWT_SECRET` | Yes | Secret for JWT signing (change in production!) |
| `ADMIN_EMAIL` | No | Default admin email |
| `ADMIN_PASSWORD` | No | Default admin password |
| `HF_TOKEN` | No | Hugging Face API token (AI features) |
| `SENDGRID_API_KEY` | No | SendGrid API key (email notifications) |
| `STRIPE_SECRET_KEY` | No | Stripe secret key (payments) |
| `EMERGENT_LLM_KEY` | No | Emergent Agent LLM key (AI features) |
| `SENDER_EMAIL` | No | Sender email for notifications |

### Frontend (`frontend/.env`)

| Variable | Required | Description |
|---|---|---|
| `REACT_APP_BACKEND_URL` | Yes | Backend API base URL |
| `REACT_APP_EMAILJS_SERVICE_ID` | No | EmailJS service ID |
| `REACT_APP_EMAILJS_TEMPLATE_ID` | No | EmailJS template ID |
| `REACT_APP_EMAILJS_PUBLIC_KEY` | No | EmailJS public key |

---

## Testing

### Automated Tests

```bash
# Frontend property tests (23 tests with fast-check)
cd frontend && yarn test --watchAll=false

# Backend tests
cd backend && python -m pytest tests/ -v
```

### Permission Testing Utility

Visit [http://localhost/test-auth.html](http://localhost/test-auth.html) to test user permissions:

1. Click "Test Case Worker" → Verify 5 visible tabs
2. Click "Test Volunteer" → Verify 3 visible tabs
3. Click "Test Admin" → Verify 7 visible tabs

This utility tests the authentication flow and displays:
- ✅ Login status
- 📊 Permission count per role
- 📝 List of visible sidebar tabs
- 🔍 Complete permission list

---

## Troubleshooting

### Permissions Not Showing After Login

**Symptom**: Users see Dashboard only, other sidebar tabs are missing

**Solution**: Clear browser cache
1. Press `Cmd + Shift + R` (Mac) or `Ctrl + Shift + F5` (Windows)
2. Or open DevTools (F12) → Application → Clear site data
3. Log out and log back in
4. Verify in browser console:
   ```
   [AuthContext] User loaded: {email: "...", role: "...", permissionCount: XX}
   [Sidebar] User loaded: {...}
   ```

**Alternative**: Use Incognito/Private browsing window

### Demo Data Seeding

**Issue**: Demo users don't exist

**Solution**:
1. Log in as Admin (`admin@caseflow.io` / `admin123`)
2. Navigate to Settings → Demo Data
3. Click "Seed Demo Data"
4. Demo users (Case Worker & Volunteer) will be created

### MongoDB Connection Issues

**Symptom**: Backend health check fails

**Solution**:
```bash
# Check MongoDB is running
docker compose logs mongodb

# Restart services
docker compose restart mongodb backend

# Check health
curl http://localhost:8001/api/health
```

### Container Not Starting

```bash
# View logs
docker compose logs -f backend
docker compose logs -f frontend

# Rebuild from scratch
docker compose down
docker compose up --build -d
```

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

## Development Workflow

### Adding New Permissions

1. Add permission to `DEFAULT_PERMISSIONS` in `backend/helpers.py`
2. Add permission check to relevant route in `backend/routes/`
3. Update sidebar navigation in `frontend/src/components/Sidebar.js`
4. Add permission to route protection in `frontend/src/App.js`

Example:
```python
# backend/helpers.py
DEFAULT_PERMISSIONS = {
    "ADMIN": [..., "new_feature.read", "new_feature.write"],
    "CASE_WORKER": [..., "new_feature.read"],
}

# backend/routes/new_feature.py
@router.get("/new-feature")
async def get_feature(request: Request):
    await require_permission(request, "new_feature.read")
    # ... implementation

# frontend/src/components/Sidebar.js
const NAV_ITEMS = [
    ...,
    { to: "/new-feature", icon: Icon, permission: "new_feature.read" }
]
```

### Creating Custom Roles

Admins can create custom roles via Settings → Roles:
1. Navigate to Admin Settings
2. Click "Create Custom Role"
3. Select permissions from the 35 available options
4. Assign role to users

Custom roles override default role permissions and are stored per organization.

---

## Architecture Decisions

### Why MongoDB?
- Flexible schema for evolving nonprofit requirements
- Embedded documents for client → services relationship
- Easy horizontal scaling for multi-tenant architecture

### Why FastAPI?
- Async/await support for high concurrency
- Automatic OpenAPI documentation
- Pydantic validation for type safety
- Fast performance (on par with Node.js)

### Why JWT Cookies?
- HttpOnly cookies prevent XSS attacks
- Refresh token rotation for security
- Stateless authentication scales easily

### RBAC Implementation
- Permission-based (not just role-based) for granular control
- Default permissions per role + custom role overrides
- Permissions returned with `/auth/me` for frontend use
- Server-side enforcement on all protected routes

---

## License

MIT

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## Support

- 📧 Email: support@hackforge.io
- 🐛 Issues: [GitHub Issues](https://github.com/your-org/hackforge/issues)
- 📚 Documentation: [docs.hackforge.io](https://docs.hackforge.io)

---

**Built with ❤️ by the HackForge Team**

*Empowering nonprofits with modern case management tools*
