# Buks Shot It

Website and business platform for Buks Shot It (wedding, portrait, event and product photography).

| Folder | Contents |
| --- | --- |
| `src/` | Next.js 16 website (App Router, TypeScript, Tailwind CSS 4) |
| `src/content/` | Approved copy, prices and the image registry |
| `supabase/` | Database schema, security rules and tests |
| `tests/e2e/` | Browser checks: accessibility, links, forms, layout |
| `brand/` | Logo files, design tokens, brand guidelines, mockups |
| `design/` | Approved design prototype source |

## Run locally

```bash
npm install
npm run dev
```

## Checks

```bash
npm run typecheck
npm run lint
npm run build
npm run test:site     # needs a running site: BASE=http://localhost:3000, and Playwright installed
npm run test:db       # needs a local PostgreSQL superuser (see supabase/README.md)
```

## Preview and production

- `NEXT_PUBLIC_SITE_STAGE` unset: preview build. Shows a preview banner and visible placeholders, and is hidden from search engines.
- `NEXT_PUBLIC_SITE_STAGE=production`: launch build. **The build fails if any `[Placeholder]` is still on a page.**
- `NEXT_PUBLIC_SITE_URL`: the live domain, used for canonical links and the sitemap.

Temporary stock images are listed in `src/assets/temp/CREDITS.md` and must be replaced before launch.
