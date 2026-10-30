# BiomedAccess

BiomedAccess is a biomedical sciences learning platform. Students enroll in courses, work through topics and subtopics with notes and downloadable PDFs, discuss resources, take per-topic quizzes with instant server-side grading, and track progress. Admins create and manage courses, topics, subtopics and resources.

Stack: React 18 + Vite (client), Node.js + Express (server), SQLite via libSQL @libsql/client (local file or Turso), JWT auth, optional Stripe Checkout for paid courses.

## Features

- Email/password signup and login (JWT). Roles: student and admin.
- Profile page with enrolled courses, progress bars and achievements.
- Course catalogue. Courses contain Topics, each Topic has Subtopics, each Subtopic has text notes and Resources (PDF files), and each Topic can have a Quiz.
- Enrollment gating: free courses enroll in one click. Paid courses require Stripe Checkout (or the dev demo unlock).
- Subtopic completion tracking that feeds the course progress percentage.
- Per-resource comment threads. Admin posts are labelled Instructor.
- Quizzes: multiple choice, graded on the server. The student quiz endpoint never returns the correct answer. Explanations are shown after submit.
- Dashboard: progress summary, my courses, recently accessed topics, recommended courses, weak areas.
- Analytics: overall accuracy, per-topic accuracy, weak areas (below 70% with at least 2 answers), recent attempts.
- Admin: create and publish or unpublish courses, add topics, subtopics and resources (PDF upload), and view students.
- Seed data: 3 courses (Intro to Human Anatomy, Medical Microbiology, Hematology Basics), with topics, subtopics, sample PDF resources and quizzes.

## Project layout

```
biomedaccess/
  server/            Express API + SQLite
    src/index.js     app entry, mounts routes
    src/db.js        schema and connection
    src/seed.js      demo data (npm run seed)
    src/routes/      auth, courses, resources, learning, admin, payments
    src/lib/         auth middleware, pdf generator for seed content
    data/            SQLite database (created on first run)
    uploads/         uploaded resource files
  client/            React + Vite app
    src/pages/       Landing, Auth, Courses, CourseDetail, TopicPage,
                     QuizPage, Dashboard, Profile, Analytics, Admin
    src/components/  CourseCard
    src/api.js       fetch wrapper (adds JWT, proxies /api in dev)
```

## Requirements

- Node.js 18 or newer (20 LTS recommended)
- npm

## Setup

Install dependencies for both packages:

```bash
cd biomedaccess/server && npm install
cd ../client && npm install
```

Create the demo database and sample content:

```bash
cd ../server && npm run seed
```

This recreates the database from scratch. Demo accounts:

- Admin: admin@biomedaccess.local / admin1234
- Student: student@biomedaccess.local / student1234

## Run (development)

Use two terminals.

Terminal 1, API on port 4000:

```bash
cd server && npm run dev
```

Terminal 2, web app on port 5173:

```bash
cd client && npm run dev
```

Open http://localhost:5173. Vite proxies `/api` to the API on port 4000.

## Production build

```bash
cd client && npm run build
```

The static site is written to `client/dist`. Serve it with any static host, or let the Express server serve it. Point `CORS_ORIGIN` at the deployed origin if the frontend and API are on different domains.

## Configuration (environment variables)

Create `server/.env` (optional). Every variable has a default.

| Variable | Purpose | Default |
| --- | --- | --- |
| `PORT` | API port | `4000` |
| `JWT_SECRET` | Signing key for login tokens. Set a long random value in production. | dev fallback (insecure) |
| `DATA_DIR` | Folder for the SQLite database | `server/data` |
| `UPLOAD_DIR` | Folder for uploaded resource files | `server/uploads` |
| `CORS_ORIGIN` | Allowed browser origin | any origin |
| `APP_URL` | Frontend URL used for Stripe success and cancel redirects | `http://localhost:5173` |
| `STRIPE_SECRET_KEY` | Stripe test secret key (`sk_test_...`). Enables paid checkout. | unset: payments disabled |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret (`whsec_...`) | unset |
| `DEMO_UNLOCK_PAID` | Set to `true` to enroll in paid courses without paying. Development only. | `false` |

### Payments

Paid courses are flagged with `is_paid` and `price_cents` on the course record. Without `STRIPE_SECRET_KEY`, the payment endpoint returns 503 with a clear message, and the course page says payments are not yet configured. The rest of the app is unaffected.

To enable Stripe test mode:

1. Set `STRIPE_SECRET_KEY` to your test secret key.
2. Optionally set `STRIPE_WEBHOOK_SECRET` and forward webhooks to `/api/payments/webhook`.
3. Restart the server.

Checkout creates a Stripe Checkout session, then the browser returns to the course page, which verifies the session and enrolls the student.

## Verification performed

- `vite build` completes with no errors.
- API starts and serves `/api/health`, `/api/courses`, and authenticated routes.
- Seeded data loads. Login, enrollment, topic access, quiz fetch (no answer keys), quiz submission with server-side grading, analytics, dashboard, profile achievements, comments, PDF download and admin course listing all respond as expected.
- Paid checkout returns 503 when no Stripe key is set.
- Vite dev server serves the app at port 5173 and proxies `/api`.

## Known limitations (Phase 1)

- Resource and comment moderation is basic. There is no report flow.
- No email verification or password reset yet.
- Certificates and video are not included. See PROJECT_ROADMAP.md.
- Stripe integration is a test-mode stub. Live payments need webhook setup and tax and refund handling.
- Seed PDFs are generated sample documents for demonstration only.
