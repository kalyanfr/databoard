# Data Board · Open-Source Privacy-First Website Analytics

> Lightweight, cookie-free web analytics platform with real-time 3D telemetry, funnels, revenue goals, AI MCP server integration (Claude & Cursor), and global uptime monitoring.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Framework: React + Vite](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-61dafb.svg)](https://vitejs.dev/)
[![Database: Supabase](https://img.shields.io/badge/Database-Supabase%20PostgreSQL-3ecf8e.svg)](https://supabase.com/)
[![Deployment: Vercel](https://img.shields.io/badge/Deploy-Vercel-black.svg)](https://vercel.com/)

---

## 🚀 Features

- **⚡ Real-Time Ingestion (<3 KB Snippet):** Zero-cookie, anonymous, non-blocking telemetry tracker (`/t.js`).
- **🌍 3D Live Earth Globe:** Three.js visualization of incoming visitor hits and geographical pins.
- **📊 Traffic Breakdowns & Funnels:** Filter by country, referrer, channel, device, operating system, and browser.
- **🎯 Goals & Revenue Attribution:** Track conversions and revenue with simple HTML attributes (`data-goal="signup" data-revenue="49"`).
- **🤖 Model Context Protocol (MCP) Server:** Native MCP endpoint (`/api/mcp`) allowing Claude Desktop, Cursor, and ChatGPT to directly query live analytics.
- **⏱️ Global Uptime Monitoring:** Automated HTTP pingers with response-time sparklines and failure detection.
- **✉️ Automated Founder Drip & Custom SMTP:** Onboarding emails and system alerts delivered via custom SMTP.
- **🔒 Data Sovereignty (BYOC):** Optional 1-click Bring-Your-Own-Cloudflare (Cloudflare D1 SQLite database storage).

---

## 🛠️ Architecture & Tech Stack

- **Frontend:** React 19, Vite, Tailwind CSS, Radix UI primitives, Lucide Icons, Three.js / Globe.gl
- **API & Functions:** Node.js Serverless Functions (`/api/*` running on Vercel)
- **Database & Auth:** Supabase (PostgreSQL, Row-Level Security, Supabase Auth)
- **Payments:** Dodo Payments (lifetime deal licensing & webhook verification)

---

## 📦 Prerequisites

Before building or running locally, make sure you have:
1. **Node.js:** v18.0.0 or later (v20+ recommended). Check with `node -v`.
2. **npm:** v9.0.0 or later. Check with `npm -v`.
3. **Supabase Account:** Free account at [supabase.com](https://supabase.com).
4. **Git:** Installed on your computer.

---

## 💻 Local Setup & Installation

### 1. Clone the repository
```bash
git clone https://github.com/<your-username>/databoard.git
cd databoard
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy the provided `.env.example` file to `.env.local`:
```bash
cp .env.example .env.local
```
Edit `.env.local` with your Supabase credentials:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 4. Database Setup (Supabase)
In your Supabase SQL Editor, ensure the following core tables exist:
- `profiles` (`id`, `email`, `role`, `full_name`, `created_at`, `updated_at`)
- `projects` (`id`, `project_id`, `name`, `domain`, `status`, `created_by_id`, `created_at`)
- `events` (`id`, `project_id`, `type`, `name`, `properties`, `timestamp`, `session_id`, `visitor_id`, `country`, `referrer`)
- `sessions` (`id`, `project_id`, `visitor_id`, `duration_seconds`, `is_bounce`, `started_at`, `ended_at`)
- `visitor_days` (`id`, `project_id`, `date`, `count`)
- `monitors` (`id`, `name`, `url`, `status`, `owner_email`, `last_checked_at`, `created_by_id`)
- `monitor_checks` (`id`, `monitor_id`, `status`, `response_ms`, `checked_at`)
- `support_tickets` (`id`, `created_by_id`, `subject`, `message`, `status`, `reply`)

### 5. Start the development server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🏗️ Production Build

To test the production build locally:
```bash
npm run build
npm run preview
```
The compiled static assets and serverless bundles will be generated inside the `dist/` folder.

---

## 🚀 Deployment

### Deploying to Vercel (Recommended)

1. Install the Vercel CLI:
```bash
npm install -g vercel
```
2. Link and deploy:
```bash
vercel --prod
```
3. Add the environment variables from `.env.example` in the **Vercel Project Settings → Environment Variables**.

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
