# Changelog

All notable changes to TestAgent are documented in this file.

## [Unreleased] - 2026-04-17

### Added
- **System-assigned Case ID** — every new scenario gets a global sequential number (001, 002, 003…), shown as `#001` badge in detail modal and in the ID column of the scenario list
  - New `caseNumber Int?` column on `Scenario` model
  - Auto-computed on create via `MAX(caseNumber) + 1` (SQLite doesn't support `autoincrement()` on non-PK fields)
  - Old scenarios without a number display `—`
- **5-tier scenario group tree** — scenarios can be organized into nested folders inside each module
  - New `ScenarioGroup` model (self-referential `parentId`, `sortOrder`, cascade-delete via `moduleId`)
  - Max depth of 5 tiers enforced in the API
  - `groupId` column added to `Scenario` (nullable = ungrouped)
  - Group routes: `POST /library/modules/:moduleId/groups`, `PUT /library/groups/:id`, `PATCH /library/groups/:id/move`, `DELETE /library/groups/:id`, `PATCH /library/scenarios/:id/move`
  - Deleting a group leaves its scenarios ungrouped (not deleted) and re-parents its sub-groups
- **Drag-and-drop organization** (HTML5 native drag API, no new deps)
  - Drag scenarios into groups or to the root drop zone to un-group
  - Drag groups onto other groups to re-parent; drop on root to promote to top level
  - Cycle detection: server rejects moves that would place a group inside one of its own descendants or into itself
  - Drop targets highlight in emerald during drag-over
- **Group management UI**
  - Double-click a group name to rename inline (Enter saves, Escape cancels, blur commits)
  - `+` button on hover adds a sub-group (hidden at tier 5)
  - `×` button on hover deletes the group (with confirm)
  - Up/Down chevron buttons on hover reorder siblings via `sortOrder`; disabled at list boundaries
  - Folder icon toggles between open/closed states via chevron

### Changed
- Pre-flight login check now waits for SPAs to hydrate before scanning for input fields
  - `page.goto(..., { waitUntil: 'networkidle' })` replaces default `load`
  - Explicit `page.waitForSelector('input', { timeout: 10000 })` before probing selectors
  - Added `input[type="text"]` as a fallback email/username selector
  - Same fix applied to the Playwright auth-injected spec in `specGenerator.ts`
- **Removed manual "Kes ID" input** from the scenario creation wizard — the system-assigned case number replaces it; `testCaseId` column retained for DSSB import backward compatibility
- Scenario list column "Kes ID" renamed to "ID", narrowed from 56 to 16 characters wide
- Library search now matches case number (e.g., type `001`) in addition to name and `scenarioRefId`
- Scenario list rendering replaced: flat table → hierarchical tree that recursively renders group rows with indentation (`depth × 16px`)
- `getLibrary()` now returns `groups` alongside `projects`, `modules`, and `scenarios`
- `createScenario()` signature tightened to `Omit<Scenario, "id" | "caseNumber" | "createdAt" | "updatedAt">` (caseNumber is server-assigned)

### Fixed
- **SPA login detection** — auth pre-flight was failing on Nuxt/Vue/React SPAs because the login form didn't exist in the initial HTML. Now waits for network idle and for inputs to render before attempting to fill credentials.
- Dev server script: removed unsupported `--watch` flag from `ts-node` in the `npm run dev` script (was causing `ARG_UNKNOWN_OPTION` crash on Node 25)

## [1.3.0] - 2026-03-30

### Added
- **Structured test steps editor** — scenarios can now define tests as an ordered list of typed steps (`navigate`, `click`, `fill`, `select`, `check`, `hover`, `wait`, `screenshot`, `assert_visible`, `assert_text`, `assert_url`, `custom`) with target/input/expected fields
- **Wizard-style scenario creation** — multi-step creation flow (Basics → Test Design → Review) with progress indicator, dirty-tracking, and unsaved-changes confirmation
- **Code preview mode** — toggle the test-steps editor between table view and generated Playwright code preview
- **Run mode toggle** in scenario detail modal — pick between Template, Recorded spec, or Test Steps when running
- **Dual run controls** — "Headless" and "Visible" buttons run with or without a visible browser
- `stepsToSpec.ts` — converts structured steps to Playwright spec code
- `steps-preview` endpoint for server-side code preview

### Fixed
- Playwright recorder browser closing cleanly on Ctrl-C across platforms (`shell: true` + proper signal handling)
- Missing Prisma migration for a previous column add

## [1.2.0] - 2026-03-29

### Added
- **Test Reports page** — browse all runs across project with pass/fail filter, search, expandable logs, report links
- **Custom spec editor** — edit recorded Playwright code directly in the detail modal (textarea), save changes, delete
- **Project runs API** — `GET /library/projects/:id/runs` returns all run records with scenario/module info
- **Negative testing** — forms template now includes empty submission validation test + invalid email format test (auto-skip if no required fields/email fields)
- **AI assertion enrichment** — "Add Assertions (AI)" button on recorded specs: Haiku analyzes code and injects `expect()` checks (~$0.001 per call, cached)
- **AI failure explainer** endpoint — `POST /library/scenarios/:id/explain-failure` returns plain-language explanation of what went wrong
- **Playwright Codegen recorder** — Record button in scenario detail modal launches `npx playwright codegen`, auto-saves generated spec to DB
- **Custom spec support** — scenarios can store recorded Playwright code alongside templates; toggle between "Template" and "Recorded" when running
- **Code viewer** — collapsible view of recorded spec with line count and delete option
- **Dashboard page** with recharts — pass rate trend (30 days), runs per day bar chart, module breakdown, stat cards, recent runs table
- **Environment management** — per-project environments with baseUrl and auth config, default environment marker
- **Screenshot gallery** in run results
- **Search & filter** in Library — search by name/Kes ID/Scenario ID, filter by status (passed/failed/never run), filter by flow (positif/negatif), result count
- **User management** — roles, members, assignee dropdowns, `runBy` tracking in reports
- **User Manual and About pages** (accessible to all users)
- **Setup script and README** for new-user onboarding
- **Configurable AI model** from App Settings (hot-reload, no restart needed)
- **AI token usage badge** in topbar (gray when $0, purple when active)
- **Daily stats API** — `GET /library/daily-stats` and `GET /library/projects/:id/daily-stats` for time-series data
- **Tech Stack page** — visual documentation of all technologies used
- **API Explorer page** — interactive API docs with 34 endpoints, try-it button, copy cURL
- **Unit & integration test suite** (59 tests) using Vitest covering `specGenerator`, `auth`, `testRunner`, `dssbParser`, `scenarioLibrary`
- npm scripts: `test`, `test:unit`, `test:integration`, `test:coverage`
- Custom favicon

### Changed
- Projects page owns project settings (gear icon opens modal) instead of a separate page
- SPA routing: `index.html` served for all client routes on refresh
- `/app-settings` refresh distinguishes browser vs API via `Accept` header
- Quick Run Test page refactored to use `PageHeader` component
- Reports include `runBy`, project column, project filter, pagination
- Extracted DSSB parser from `server.ts` into `src/dssbParser.ts` for testability
- Exported `buildSummary` from `testRunner.ts` for unit testing
- Fixed auth injection regex in `specGenerator.ts` (was not matching template describe blocks)

### Fixed
- API key from App Settings takes effect immediately without server restart

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
