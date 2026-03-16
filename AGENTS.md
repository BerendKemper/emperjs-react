# AGENTS.md

## Purpose
Operational guidance for working in this frontend repo within the shared workspace, alongside the related backend repo.

## Workspace Layout
- Frontend repo: sibling directory `..\emperjs-react`
- Backend repo: sibling directory `..\emperjs-cloudflare`
- Shared workspace guidance: `..\AGENTS.md`

## Startup Context Rule
Before analysis or edits, read:
- this file
- `..\AGENTS.md` when the task touches both repos or asks about workspace-level architecture

## Documentation Maintenance Rule
When a task changes any of the following, update this file before finishing:
- frontend route structure
- frontend URL-state behavior
- frontend API client integration points
- frontend auth/session assumptions
- frontend dev-safety behavior
- frontend/backend integration points that are primarily expressed in this repo

Keep this file focused on durable current truth, not a dated changelog.

## Current Truth
- Frontend repo location: current repo
- Backend repo location: sibling directory `..\emperjs-cloudflare`
- Frontend API-origin env var: `VITE_AUTH_API_ORIGIN`
- Frontend dev-mock env var: `VITE_DEV_MOCK_SESSION`

## Cross-Repo Workflow
When a task affects API-backed UI behavior:
1. Confirm the backend contract and authorization behavior first.
2. Update the frontend API client wrapper.
3. Update the consuming page or component.
4. Preserve URL-state and route behavior unless the contract change requires otherwise.
5. If frontend behavior reveals a backend mismatch, fix both sides in the same task when possible.

## Current Frontend Route Structure
- Shop routes:
  - `/shop`
  - `/shop/products/new`
  - `/shop/products/:slug`
- Admin routes:
  - `/admin`
  - `/admin/seller-profiles`
  - `/admin/users`
  - `/admin/settings`
- Current route definitions live in:
  - `src/app/Router/Router.tsx`

## Current Frontend Integration Points
- Shop API client:
  - `src/services/shopApi.ts`
- Users/admin API client:
  - `src/services/usersApi.ts`
- Shop UI:
  - `src/products/Shop/Shop.tsx`
- Product detail/editor page:
  - `src/pages/ShopProductPage.tsx`
- Current admin page shell:
  - `src/pages/AdminUsersPage.tsx`

## Current URL-State Defaults
- Shop route `/shop` uses query-state for:
  - `search`
  - `tags`
  - `authors`
  - `minPriceCents`
  - `maxPriceCents`
  - `sortBy`
  - `page`
  - `pageSize`
- Admin users route `/admin/users` uses query-state for:
  - `name`
  - `email`
  - `emailProviders`
  - `roles`
  - `sellerProfile`
  - `page`
  - `pageSize`

## Current Frontend Auth And Role Assumptions
- Frontend role gating is UX only; backend authorization is the real security boundary.
- `/admin/settings` is owner-only.
- `/admin/users` and `/admin/seller-profiles` are admin-visible routes.
- Product creation route `/shop/products/new` requires product-management capability in the frontend shell.

## Current Frontend Contract Expectations
- Use `product` terminology, not `article`.
- Product detail/editor flows are built around `shopApi`.
- Admin users listing is built around `usersApi.fetchAdminUsersPage`.
- Product detail compatibility still expects `imageId` and `imageUrl`, with ordered `images` support.
- System email provider settings UI belongs under `/admin/settings`.

## Dev And Safety Defaults
- `VITE_DEV_MOCK_SESSION=1` enables a mock authenticated session for UI testing in dev.
- In dev, frontend fetch behavior should block mutating requests to `api.emperjs.com`.

## Safety
- Keep frontend-only guidance here.
- Keep shared cross-repo guidance in `..\AGENTS.md`.
- Keep backend-only API and operational guidance in `..\emperjs-cloudflare\AGENTS.md`.
- When code and this file disagree, trust the code first and then update this file.
