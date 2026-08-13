# Carelio Backend

Node.js + TypeScript + Express + MongoDB API for the Carelio MVP.

## Stack

- Express + TypeScript
- MongoDB (Mongoose)
- JWT access + refresh tokens
- Zod validation

## Setup

```bash
cp .env.example .env
npm install
npm run seed
npm run dev
```

Server: `http://localhost:4000`

### Seed credentials

| Role | Identifier | Password |
|------|------------|----------|
| Doctor | `dr.smith@carelio.app` | `Password123!` |
| Health Assistant | `ha.jones@carelio.app` | `Password123!` |
| Patient | `PAT-1001` | (login by patient ID) |

## Auth

- `POST /auth/doctor/*` · `POST /auth/assistant/*` · `POST /auth/patient/*`
- Invites: `POST /auth/doctor/invite-patient`, `POST /auth/assistant/invite-patient`, `POST /auth/patient/invite`

## Patients

| Method | Path |
|--------|------|
| GET | `/patients` (`search`, `page`, `limit`) |
| GET | `/patients/assigned` (`assistantId`, `search`, `page`, `limit`) |
| GET | `/patients/unassigned` |
| GET | `/patients/:id` |
| POST | `/patients` (register) |
| PATCH | `/patients/:id` |
| DELETE | `/patients/:id` (soft) |
| POST | `/patients/assign` |
| DELETE | `/patients/:patientId/unassign` |
| POST | `/patients/:id/verify/email\|code` |
| GET | `/patients/:patientId/appointments` |

## Profile & stats

| Method | Path |
|--------|------|
| GET | `/doctor/profile` |
| GET | `/health-assistant/profile` |
| GET | `/stats` |


## Appointments

| Method | Path |
|--------|------|
| GET | `/appointments` (`status`, `startDate`, `endDate`, `page`, `limit`) |
| GET | `/appointments/upcoming` |
| GET | `/appointments/recent` |
| POST | `/appointments` |
| PATCH | `/appointments/:id/reschedule` |
| PATCH | `/appointments/:id/cancel` |
| GET | `/consultations/appointments/:id` |

## Frontend

```
USE_DUMMY_DATA=false
API_BASE_URL=http://localhost:4000
```

## Email (Resend)

Patient invites and email OTPs are sent with Resend.

| Variable | Purpose |
|----------|---------|
| `RESEND_API_KEY` | Resend API key (leave empty to log to console only) |
| `RESEND_FROM` | Sender, e.g. `Carelio <noreply@henneh.online>` |
| `APP_URL` | Base URL for invite links (`http://localhost:3000` locally, `https://carelio.vercel.app` in production) |

### Demo invite flow

1. Staff invites a patient with an email address.
2. Backend emails the invite link (or logs it if no API key).
3. Response also includes `inviteLink` for copy-paste.
4. Open `/patient-invite?token=...` to complete registration.

### Test email (dev only)

Check config:

```bash
curl http://localhost:4000/dev/mail-status
```

Send a test email:

```bash
curl -X POST http://localhost:4000/dev/test-email \
  -H "Content-Type: application/json" \
  -d '{"to":"your@email.com"}'
```

If `RESEND_API_KEY` is empty, the route still works but only logs to the backend console.

Verified sending domain: `henneh.online` (`RESEND_FROM=Carelio <noreply@henneh.online>`).

## Video (LiveKit)

Consultation rooms use LiveKit Cloud. Create a free project at https://cloud.livekit.io and set:

| Variable | Purpose |
|----------|---------|
| `LIVEKIT_URL` | WebSocket URL, e.g. `wss://your-project.livekit.cloud` |
| `LIVEKIT_API_KEY` | Project API key |
| `LIVEKIT_API_SECRET` | Project API secret (reveal/copy in the dashboard; do not paste `••••`) |

Token endpoints: `GET /consultations/:id/token/doctor` and `GET /consultations/:id/token/patient`. Each returns `{ token, code, url }`.

## Planned later

- Cloudinary uploads
