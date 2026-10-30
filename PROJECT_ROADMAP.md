# BiomedAccess: Project Roadmap

This roadmap covers the three planned phases of the BiomedAccess platform.

## Phase 1: MVP (built)

Core learning functionality to get students onboard.

- User authentication and profiles: email/password signup and login (JWT), student and admin roles, profile page with enrolled courses, progress and achievements.
- Course structure: Course → Topic → Subtopic → Resources → Quiz. Admins create and edit courses, topics, subtopics and resources. Students browse the course catalogue.
- Materials: upload and download notes and PDFs per subtopic, with a comment thread per resource.
- Quizzes: per-topic multiple choice with instant server-side grading, score history, and analytics (per-topic accuracy and weak areas).
- Dashboard: progress summary, recently accessed topics, recommended courses, weak areas.
- Payments: paid-course flag plus a Stripe Checkout stub in test mode. Driven by the `STRIPE_SECRET_KEY` environment variable and skipped gracefully when no key is set, so paid courses can be added later without rework.
- Seed content: Intro to Human Anatomy, Medical Microbiology, Hematology Basics (one paid).

## Phase 2: Personalization and engagement

- Personalization: recommendations driven by quiz performance and learning goals.
- Offline mode: download courses and quizzes for offline study.
- Virtual labs: interactive simulations for anatomy, microbiology and hematology practicals.
- Study planner: schedule topics and quizzes against deadlines.
- Gamification: streaks, points and badges beyond the MVP achievements.
- Video: lecture video per topic.
- Research hub: curated papers and literature linked to topics.
- Mentorship: connect students with professionals and instructors.

## Phase 3: Advanced clinical and career features

- Clinical case hub: case-based learning with patient scenarios.
- Deep analytics: longitudinal learning analytics for students and instructors.
- Career hub: job and career resources for biomedical graduates.
- Notifications: reminders, course updates and community activity.
- Verification: credential verification for instructors and professionals.
- ELI5 mode: simplified explanations of complex topics.
