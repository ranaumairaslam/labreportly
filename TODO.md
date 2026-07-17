# TODO - Fix All API Errors

## Step 1: Inventory & diagnose

- [x] Read API route handlers under `src/app/api/**` and `src/lib/db.js`.
- [x] Identify runtime/logic issues (JWT cookie handling, admin/staff auth, upload path mismatch, Neon DB schema mismatch).

## Step 2: Fix Neon DB adapter inconsistencies

- [x] Add missing `counters` collection used by `/api/admin/labs`.
- [x] Make `toObjectId` accept UUID string ids used by this project.
- [ ] Ensure `createCollection` supports required Mongo-like methods used by routes (`findOneAndUpdate` options, `findOne` etc.).

## Step 3: Fix auth cookie/JWT mismatches

- [ ] Align JWT payload fields: `labId` vs `id` and ensure middleware + API agree.
- [ ] Fix `src/app/api/staff/login/route.js` where it queries `{ email, password }` directly (no hashing/DB field mismatch).
- [ ] Verify middleware redirects aren’t blocking API calls (matcher impacts pages only, but cookie names must match).

## Step 4: Fix upload endpoints

- [ ] Unify upload route paths: either `public/uplaod` vs `public/uploads/images` and URL paths expected by frontend.

## Step 5: Fix report/templates API robustness

- [ ] Ensure `report-templates/route.js` runs with required dependencies (`mammoth`, `xlsx`) and serverless constraints.

## Step 6: Testing

- [x] `npm run lint` now passes errors (only warnings remain in template page).
- [ ] Manually call each API route with curl/postman smoke tests.
