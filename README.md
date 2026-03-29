# TestAgent

AI-powered Playwright test automation platform. Record browser actions, run template-based tests, manage scenarios across projects, and track results — all from a web UI.

## Quick Start

```bash
# Clone the repo
git clone https://github.com/mfauzzury/TestAgent.git
cd TestAgent

# Run the setup script (installs everything)
npm run setup

# Start the server
npm start
```

Open **http://localhost:4000** and login:
- Email: `admin@testagent.local`
- Password: `admin123`

## What the setup does

The `npm run setup` script handles everything automatically:

1. Installs server dependencies (`npm install`)
2. Installs client dependencies (`cd client && npm install`)
3. Creates `.env` from `.env.example`
4. Sets up SQLite database via Prisma
5. Downloads Chromium browser for Playwright
6. Builds the React client

## Requirements

- **Node.js 18+** (tested on 25.x)
- ~500MB disk space (mostly Chromium browser)
- macOS, Linux, or Windows

## Features

| Feature | Description |
|---------|-------------|
| **Projects** | Organize test scenarios by project, module, and role |
| **Codegen Recorder** | Record browser actions → auto-generate Playwright test code |
| **Template Tests** | Smoke, navigation, forms, responsive, accessibility — no coding needed |
| **AI Assertions** | Claude AI enriches recorded specs with `expect()` checks (optional) |
| **Live Test Runner** | SSE streaming with real-time logs in a terminal-style panel |
| **Pre-flight Login** | Verifies login credentials before running tests |
| **Environments** | Staging/production URL switching per project |
| **Dashboard** | Charts: pass rate trend, runs per day, module breakdown |
| **Test Reports** | Browse all runs with search, filter, pagination, log history |
| **Screenshot Gallery** | Grid view of all test screenshots with lightbox |
| **DSSB Import** | Auto-detect and import formal test script Excel files |
| **Multi-user** | User management, project member assignment, role-based access |
| **Token Tracking** | Monitor AI API usage and costs |

## Scripts

```bash
npm run setup          # First-time setup (install + build + DB + browsers)
npm start              # Start production server (port 4000)
npm run dev            # Start dev server with hot reload
npm test               # Run all 59 unit + integration tests
npm run test:unit      # Run unit tests only
npm run test:integration  # Run DB integration tests only
npm run test:coverage  # Run tests with coverage report
npm run build:client   # Rebuild React client
npm run db:studio      # Open Prisma Studio (DB browser)
```

## AI Features (Optional)

AI features require an Anthropic API key. Without it, everything works except:
- "Add Assertions (AI)" button on recorded specs
- "Explain Failure" analysis

To enable AI:
1. Get a key from [console.anthropic.com](https://console.anthropic.com/settings/keys)
2. Login to TestAgent → **App Settings** → paste your API key → **Save**
3. Select your preferred model (Haiku is cheapest ~$0.001/call)
4. No restart needed — works immediately

## Project Structure

```
TestAgent/
├── src/                    # Server (Express + TypeScript)
│   ├── server.ts           # API routes + SSE streaming
│   ├── scenarioLibrary.ts  # Database CRUD (Prisma)
│   ├── specGenerator.ts    # Template-based Playwright specs
│   ├── testRunner.ts       # Playwright test execution
│   ├── dssbParser.ts       # DSSB Excel format parser
│   ├── aiAssist.ts         # AI assertion enrichment + failure explainer
│   ├── auth.ts             # JWT + bcrypt authentication
│   └── db.ts               # Prisma client
├── client/                 # Frontend (React + Vite + Tailwind)
│   └── src/pages/          # UI pages (Projects, Library, Dashboard, etc.)
├── prisma/                 # Database schema + migrations
├── tests/                  # Unit + integration tests (Vitest)
├── generated-tests/        # Auto-generated Playwright specs
├── playwright-reports/     # HTML test reports
└── scripts/setup.sh        # First-time setup script
```

## Tech Stack

- **Frontend**: React 19, Vite 8, Tailwind CSS 4, TanStack Query, Recharts
- **Backend**: Express 5, Node.js, TypeScript 5
- **Database**: Prisma 7 + SQLite (better-sqlite3)
- **Testing**: Playwright 1.58, Vitest 4
- **AI**: Claude API (Haiku) via @anthropic-ai/sdk

## License

MIT
