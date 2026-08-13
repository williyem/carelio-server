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
| POST | `/patients/:id/verify/phone\|email\|code` |
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

## Planned later

- Cloudinary uploads
- LiveKit video tokens
- SOAP notes / vitals / consultation complete
