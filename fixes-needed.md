Critical, High, Medium, Low

Critical
- None detected in automated pass.

High
- Add server-side protection for admin routes.
  - Files: `app/admin/page.tsx`, `app/admin/users/page.tsx`, optionally `middleware.ts`.
  - Change: Add server-side redirects (e.g., use route segment config/Server Actions or an `app/admin/layout.tsx` with auth check) to prevent flash of admin UI.
  - Reason: Currently guarded client-side only; SSR can render content briefly.

Medium
- SEO metadata improvements site-wide.
  - File: `app/layout.tsx` (done in this pass)
  - Change: Added OG tags and canonical link.
  - Reason: Improve social sharing and duplicate URL handling.

- Google Maps script loading.
  - File: `app/layout.tsx` (adjusted)
  - Change: Add `loading="async"` and keep async/defer.
  - Reason: Eliminate performance warning.

- Accessibility: Ensure label associations.
  - File: `app/contact/page.tsx` (done in this pass)
  - Change: Added `id`/`htmlFor` and `name` attributes for form controls.
  - Reason: Reduce inputsWithoutLabel count.

Low
- Footer placeholder links.
  - File: `app/contact/page.tsx` and likely site footer component(s)
  - Change: Replace `href="#"` with real routes or remove until ready.
  - Reason: Avoid dead links.

Database migrations (proposed)
- If not present:
  - Ensure `profiles.is_admin BOOLEAN DEFAULT false NOT NULL`.
  - Ensure RLS enabled for `profiles`, `applications`, `documents` and policies exist (scripts present).
  - Create indexes:
    - `CREATE INDEX IF NOT EXISTS idx_applications_user_id ON public.applications(user_id);`
    - `CREATE INDEX IF NOT EXISTS idx_documents_user_id ON public.documents(user_id);`

Next steps
- Provide Supabase PAT to run automated DB verification and produce exact diffs.


