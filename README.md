# Digital Disposable Camera – MVP

This is an MVP implementation of the **Digital Disposable Camera Event App** described in the PRD.

## Stack

- **Frontend**: Next.js 16 (App Router) + React 19 + TypeScript
- **Styling**: Tailwind CSS (v4)
- **APIs**: Next.js App Router API routes under `app/api`
- **Persistence (MVP)**: In-memory store in `lib/store.ts`

The in-memory store and API shapes are designed so they can be swapped for:

- **AWS Lambda + API Gateway** (for API routing)
- **DynamoDB** (for `Events` and `Photos` tables)
- **S3 + CloudFront** (for photo storage and delivery)

## Key concepts

- **No host auth in MVP**: the `/dashboard` route is globally accessible and shows all events.
- **Per-guest photo limit**:
  - Enforced on the client using a `guestSessionId` stored in `localStorage`.
  - Enforced on the server by counting photos for (`eventId`, `guestSessionId`) before accepting new uploads.
- **Photo storage**:
  - In this MVP, photos are stored as `dataUrl` (base64 JPEG) in memory.
  - In production, this would be changed to store photos in S3 and only keep metadata in DynamoDB.
- **Photo compression**:
  - Client-side capture uses a canvas with a max width of 1080px and JPEG quality `0.8`.

## Core routes

- `/` – Marketing-style landing page.
- `/dashboard` – Global host dashboard:
  - Create events (name, date, description, cover image URL, per-guest limit, start/end time, moderation toggle).
  - See a list of all events.
- `/dashboard/events/[id]` – Event detail:
  - Guest link + copy helper.
  - Gallery with status filters (all/approved/pending/rejected).
  - Moderation controls when enabled.
- `/e/[id]` – Guest event camera:
  - Event info and description.
  - Camera UI using `getUserMedia`.
  - Preview + upload with per-guest photo limit.

## Running locally

```bash
cd web
npm install
npm run dev
```

The app will be available at `http://localhost:3000`.

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
