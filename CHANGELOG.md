# Changelog

All notable changes to TestAgent are documented in this file.

## [Unreleased]

### Added
- **Negative testing** — forms template now includes empty submission validation test + invalid email format test (auto-skip if no required fields/email fields)
- **AI assertion enrichment** — "Add Assertions (AI)" button on recorded specs: Haiku analyzes code and injects expect() checks (one-time ~$0.001 per call, cached)
- **AI failure explainer** endpoint — POST /library/scenarios/:id/explain-failure returns plain-language explanation of what went wrong
- **Playwright Codegen recorder** — Record button in scenario detail modal launches `npx playwright codegen`, auto-saves generated spec to DB
- **Custom spec support** — scenarios can store recorded Playwright code alongside templates; toggle between "Template" and "Recorded" when running
- **Code viewer** — collapsible view of recorded spec with line count and delete option
- **Dashboard page** with recharts — pass rate trend (30 days), runs per day bar chart, module breakdown, stat cards, recent runs table
- **Search & filter** in Library — search by name/Kes ID/Scenario ID, filter by status (passed/failed/never run), filter by flow (positif/negatif), result count
- **Daily stats API** — `GET /library/daily-stats` and `GET /library/projects/:id/daily-stats` for time-series data
- **Tech Stack page** — visual documentation of all technologies used
- **API Explorer page** — interactive API docs with 34 endpoints, try-it button, copy cURL
- **Unit & integration test suite** (59 tests) using Vitest
  - `specGenerator` — template generation, auth injection, URL escaping
  - `auth` — password hashing, JWT sign/verify, middleware (requireAuth, requireAdmin)
  - `testRunner` — Playwright result summary parser
  - `dssbParser` — Excel format detection, project/credential/test case extraction
  - `scenarioLibrary` — database CRUD, JSON round-trips, cascade deletes, run history
- npm scripts: `test`, `test:unit`, `test:integration`, `test:coverage`

### Changed
- Extracted DSSB parser from `server.ts` into `src/dssbParser.ts` for testability
- Exported `buildSummary` from `testRunner.ts` for unit testing
- Fixed auth injection regex in `specGenerator.ts` (was not matching template describe blocks)

## [1.1.0] - 2026-03-28

### Added
- **Projects landing page** — card grid with CRUD, edit/delete modals
- **DSSB formal test-script import** — auto-detects Excel format (Senario sheets, TC-/SR- IDs), extracts credentials, creates project/modules/scenarios
- **Scenario detail/run modal** — click row to open two-panel modal with live terminal log (SSE streaming), run controls, test type indicators
- **Pre-flight login check** — tests login credentials before running Playwright tests, with clear pass/fail feedback
- **Template-based Playwright spec generation** — smoke, navigation, forms, responsive, accessibility (no Claude API required)
- **Kes ID / Scenario ID fields** — on scenarios and list view columns
- Login auth screenshots (`auth-01-login-page.png`, `auth-02-credentials-filled.png`, `auth-03-logged-in.png`)
- Import button on Projects page for uploading DSSB test scripts
- Accessibility tests skip gracefully when landmarks/images not found

### Changed
- Scenario list switched from card grid to **table/list view** with aligned columns
- Scenario edit modal redesigned as **landscape two-column layout**
- Edit modal stays open after save, shows "Saved" indicator
- Edit modal has back button + unsaved changes confirmation
- Module dropdown in scenario modal filtered to current project only
- Sidebar nav: Projects as home page, Quick Run moved to `/run`
- Routes: `/` = Projects, `/library/:projectId` = Library

### Removed
- Claude API dependency for spec generation (replaced with templates)
- AI failure explanation (explainFailure calls removed)

## [1.0.0] - 2026-03-27

### Added
- Initial scaffold: AI-powered Playwright test agent
- Express API server with Prisma SQLite backend
- React client with Tailwind CSS
- Auth system (bcrypt + JWT + cookies)
- Scenario library with modules, members, roles
- Quick run test page
- Katalon .tc file import
- Excel/CSV import with template download
- App settings page
