# 🗺️ Vocab Quest

> A gamified vocabulary learning platform where teachers build interactive word maps and students race through them in a real-time arcade game.

---

## 📖 Project Overview

**Vocab Quest** is a full-stack web application with three layers:

| Layer | Folder | Technology | Purpose |
|---|---|---|---|
| **Backend API** | `backend/` | Laravel 12 + SQLite | REST API, auth, game logic |
| **Teacher Portal** | `frontend-portal/` | React 19 + TypeScript + Vite | Teacher dashboard to create maps & rooms |
| **Student Game** | `frontend-game/` | Vanilla TypeScript + Vite | 2D arcade game canvas for students |

---

## ✅ Prerequisites

Install these on the new machine before starting:

| Tool | Version | Download |
|---|---|---|
| **PHP** | 8.2 or higher | https://www.php.net/downloads |
| **Composer** | Latest | https://getcomposer.org/download |
| **Node.js** | 18 or higher | https://nodejs.org |
| **npm** | Comes with Node.js | — |
| **Git** | Latest | https://git-scm.com/downloads |

> **Windows users**: Make sure PHP is added to your system PATH. You can verify with `php -v` in a terminal.

---

## 📥 Step 1 — Clone the Repository

```bash
git clone https://github.com/martinitokristan-dev/vocab-quest.git
cd vocab-quest
```

---

## 🔧 Step 2 — Backend Setup (Laravel API)

```bash
cd backend
```

### 2a. Install PHP dependencies
```bash
composer install
```

### 2b. Create the environment file
```bash
cp .env.example .env
```
*(On Windows Command Prompt use: `copy .env.example .env`)*

### 2c. Generate the application key
```bash
php artisan key:generate
```

### 2d. Create the SQLite database file
```bash
# On Mac/Linux:
touch database/database.sqlite

# On Windows PowerShell:
New-Item -ItemType File -Path "database\database.sqlite"
```

### 2e. Run database migrations
```bash
php artisan migrate
```

### 2f. Create the storage symlink (for file uploads)
```bash
php artisan storage:link
```

### 2g. Start the backend server
```bash
php artisan serve
```

The API will run at **http://127.0.0.1:8000**

---

## 🖥️ Step 3 — Teacher Portal Setup (React Frontend)

Open a **new terminal**, then:

```bash
cd frontend-portal
npm install
npm run dev
```

The teacher portal will run at **http://localhost:5173**

---

## 🎮 Step 4 — Student Game Setup (Vanilla TypeScript Frontend)

Open another **new terminal**, then:

```bash
cd frontend-game
npm install
npm run dev
```

The student game will run at **http://localhost:5174**

---

## ▶️ Running the Full App (Summary)

You need **3 terminals** running simultaneously:

```
Terminal 1 — Backend
  cd backend
  php artisan serve

Terminal 2 — Teacher Portal
  cd frontend-portal
  npm run dev

Terminal 3 — Student Game
  cd frontend-game
  npm run dev
```

| App | URL |
|---|---|
| Teacher Portal | http://localhost:5173 |
| Student Game | http://localhost:5174 |
| Backend API | http://127.0.0.1:8000 |

---

## 🔑 Default Configuration

The `.env` file is pre-configured to use **SQLite** — no database server required.

Key environment variables:

```env
APP_NAME=Laravel
APP_ENV=local
APP_DEBUG=true
APP_URL=http://localhost

DB_CONNECTION=sqlite
# SQLite file: backend/database/database.sqlite

FILESYSTEM_DISK=local
```

---

## 🧪 Running Tests (Optional)

```bash
cd backend
php artisan test
```

Expected output: **72 tests, 159 assertions — all passing.**

---

## 🗂️ Project Structure

```
vocab-quest/
├── backend/                 # Laravel 12 REST API
│   ├── app/
│   │   ├── Http/Controllers/   # API controllers
│   │   ├── Models/             # Eloquent models
│   │   └── Actions/            # Business logic actions
│   ├── database/
│   │   ├── migrations/         # 14 database migrations
│   │   └── database.sqlite     # SQLite database (auto-created)
│   ├── routes/
│   │   └── api.php             # All API routes
│   └── storage/                # Uploaded files (map images, audio)
│
├── frontend-portal/         # React 19 Teacher Dashboard
│   └── src/
│       ├── components/         # UI components (Sidebar, MapCard, etc.)
│       └── pages/              # Teacher pages (Maps, Rooms, Audio Review)
│
└── frontend-game/           # Student 2D Arcade Game
    └── src/
        ├── game2d.ts           # 2D canvas world map engine
        └── main.ts             # Game controller & question flow
```

---

## 🎮 How It Works

### Teacher Flow
1. **Register / Login** at http://localhost:5173
2. **Create a Map** — upload a background image, set a title and order
3. **Add Questions** — fill-in-the-blank questions with vocabulary words and audio
4. **Review Audio** — approve or reject student-uploaded vocabulary recordings
5. **Publish the Map** — validates all questions have correct answers and approved audio
6. **Create a Room** — generates a PIN code for students to join
7. **Start the Room** — students can now play
8. **View Results** — live scoreboard and historical question breakdown

### Student Flow
1. Open http://localhost:5174
2. Enter the **PIN** given by the teacher
3. Enter your **nickname**
4. Navigate the **2D floating sky world map** — drag to pan, scroll to zoom
5. Click on **numbered step bubbles** to answer vocabulary questions
6. See your score on the **live scoreboard**

---

## 🛠️ Troubleshooting

| Problem | Solution |
|---|---|
| `php: command not found` | Add PHP to your system PATH and restart terminal |
| `composer: command not found` | Install Composer from https://getcomposer.org |
| `SQLSTATE: unable to open database file` | Run `New-Item -ItemType File -Path "database\database.sqlite"` inside `backend/` |
| Port 5173 already in use | Change Vite port in `vite.config.ts` or kill the process |
| CORS errors in browser | Make sure the backend is running at `http://127.0.0.1:8000` |
| Images not loading | Run `php artisan storage:link` inside the `backend/` folder |

---

## 📋 Quick Reference — All Commands

```bash
# Clone
git clone https://github.com/martinitokristan-dev/vocab-quest.git
cd vocab-quest

# Backend
cd backend
composer install
cp .env.example .env            # Windows: copy .env.example .env
php artisan key:generate
New-Item -ItemType File -Path "database\database.sqlite"   # Windows PowerShell
php artisan migrate
php artisan storage:link
php artisan serve

# Teacher Portal (new terminal)
cd frontend-portal
npm install
npm run dev

# Student Game (new terminal)
cd frontend-game
npm install
npm run dev
```

---

## 🧑‍💻 Tech Stack

- **Backend**: PHP 8.2, Laravel 12, Laravel Sanctum, SQLite, PestPHP
- **Teacher Portal**: React 19, TypeScript, Vite 8, Tailwind CSS 4, Lucide React
- **Student Game**: Vanilla TypeScript, Vite 8, HTML5 Canvas 2D API

---

## 🚀 Deploying to Production

> **Stack**: Backend → [Render](https://render.com) | Frontends → [Cloudflare Pages](https://pages.cloudflare.com)

### Step 1 — Deploy Backend to Render

1. Go to https://render.com → **New Web Service** → connect your GitHub repo
2. Set these settings:
   - **Root Directory**: `backend`
   - **Build Command**: `composer install --no-dev --optimize-autoloader && php artisan migrate --force && php artisan storage:link`
   - **Start Command**: `php artisan serve --host=0.0.0.0 --port=10000`
3. Add these **Environment Variables** in Render dashboard:
   ```
   APP_ENV=production
   APP_DEBUG=false
   APP_KEY=<generate with: php artisan key:generate --show>
   APP_URL=https://your-backend.onrender.com

   DB_CONNECTION=sqlite

   FILESYSTEM_DISK=local

   FRONTEND_ORIGINS=https://your-portal.pages.dev,https://your-game.pages.dev
   ```
4. After deploy, copy your Render URL (e.g. `https://vocab-quest-api.onrender.com`)

---

### Step 2 — Deploy Teacher Portal to Cloudflare Pages

1. Go to https://pages.cloudflare.com → **Create a project** → connect GitHub repo
2. Set these settings:
   - **Root Directory**: `frontend-portal`
   - **Build Command**: `npm install && npm run build`
   - **Output Directory**: `dist`
3. Add **Environment Variable**:
   ```
   VITE_API_URL=https://your-backend.onrender.com/api
   ```
4. Deploy — Cloudflare gives you a URL like `https://vocab-quest-portal.pages.dev`

---

### Step 3 — Deploy Student Game to Cloudflare Pages

1. Create **another** Cloudflare Pages project from the same repo
2. Set these settings:
   - **Root Directory**: `frontend-game`
   - **Build Command**: `npm install && npm run build`
   - **Output Directory**: `dist`
3. Add **Environment Variable**:
   ```
   VITE_API_URL=https://your-backend.onrender.com/api
   ```
4. Deploy — you get a URL like `https://vocab-quest-game.pages.dev`

---

### Step 4 — Update Backend CORS

Go back to your Render dashboard → **Environment** tab → update:
```
FRONTEND_ORIGINS=https://vocab-quest-portal.pages.dev,https://vocab-quest-game.pages.dev
```
Then redeploy the backend. Done! ✅

---

### Production Environment Variable Summary

| Variable | Where to set | Example value |
|---|---|---|
| `VITE_API_URL` | Cloudflare Pages (both frontends) | `https://vocab-quest-api.onrender.com/api` |
| `FRONTEND_ORIGINS` | Render (backend) | `https://your-portal.pages.dev,https://your-game.pages.dev` |
| `APP_URL` | Render (backend) | `https://vocab-quest-api.onrender.com` |
| `APP_KEY` | Render (backend) | Run `php artisan key:generate --show` locally |
