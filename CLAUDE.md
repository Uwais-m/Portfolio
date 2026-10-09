# uwaism.com — personal portfolio site

Personal portfolio for Mohamed Uwais (Toronto). Client relations / investment research
positioning, working toward the CFA designation.

## Stack & constraints

- **Plain static HTML/CSS/JS.** No build step, no framework, no bundler, no npm.
- Each page is a **single self-contained `.html` file** — markup, styles, and scripts
  inline in that file. The only shared external files are `tracker.js` and `favicon.svg`.
- Only external network dependency is Google Fonts. Everything else is inline.
- **Hosting:** GitHub Pages, from the `main` branch, root folder, repo `Uwais-m/Portfolio`.
- **Domain:** `uwaism.com`, registered at Porkbun. DNS stays at Porkbun (four A records
  pointing at GitHub Pages IPs + a `www` CNAME to `uwais-m.github.io`). The `CNAME` file
  in the repo root is what binds the domain — **do not delete or rename it.**
- Deploying = commit to `main`. GitHub Pages redeploys automatically in ~1 min.
  GitHub's CDN can serve a stale copy for several minutes after; check in a private window.

## Files

| File | Purpose |
|---|---|
| `index.html` | Home page — name hero, About, Certifications, Experience, Education, Projects, Contact |
| `fire-calculator.html` | FIRE (financial independence) calculator tool |
| `coffee-dashboard.html` | Coffee Sales Dashboard project page (Excel screenshots + workbook download) |
| `coffeedashboard/` | Screenshots + scrubbed `coffee-sales-dashboard.xlsx`; originals are gitignored |
| `fire-calculator-preview.png` | Thumbnail for the FIRE card in the Portfolio grid |
| `admin.html` | Private analytics dashboard, passphrase-gated, not linked in nav |
| `tracker.js` | Fires one beacon per page load to the Cloudflare Worker |
| `worker.js` | Cloudflare Worker source (deployed separately, not served by Pages) |
| `schema.sql` | D1 database schema (run once in the Cloudflare console) |
| `favicon.svg` | "Um" wordmark, transparent background |
| `CNAME` | Custom domain binding for GitHub Pages |

## Design system

Dark, bold fintech aesthetic (reference point was questrade.com).

```
--bg:        #0E0B18   /* page background */
--bg-raised: #171324   /* cards, raised surfaces */
--ink:       #F2F0F8   /* primary text */
--ink-soft:  #A79FC0   /* secondary text */
--ink-muted: #6E668A   /* tertiary text */
--line:      #2A2440   /* borders, dividers */
--accent:    #7C5CFC   /* purple — primary accent */
--pop:       #C6FF6B   /* lime — CTAs, positive values */
--down:      #FF6B7A   /* red — negative values only */
```

Type: **Sora** (600–800) for headings and the brand mark, **Inter** for body,
**JetBrains Mono** for numbers, tickers, timestamps, IPs.

### Hero background

`index.html`'s hero has an ambient "market texture" animation behind the copy:
a faint price grid, small
drifting sparkline cards, plus three DOM rows of scrolling newswire headlines and a
rates ticker. All of it is **deliberately faint** and masked out by a gradient overlay
before it reaches the headline on the left — it should read as texture, not as a graphic.
Keep it that way; several passes were spent tuning it down. It respects
`prefers-reduced-motion`.

The ticker/headline/rates values are **static placeholder text**, not live market data.
If they are ever wired to a real feed, quotes must be labeled as delayed.

## Analytics (custom, self-hosted)

Rather than a third-party analytics product, this tracks visits directly so per-IP
repeat-visit counts are visible.

- `tracker.js` sends a page view to `/track` on load and a `/click` for every link click.
  It posts as `text/plain` on purpose (no CORS preflight; JSON content-type was silently
  dropping beacons). It tags each browser with a random `uw_vid` in localStorage so
  devices sharing one IP (same Wi-Fi) count separately, and carries `?source=`
  (linkedin/message/resume, from the redirect pages) in sessionStorage for the whole visit.
- The Worker reads the real client IP from `CF-Connecting-IP` plus `request.cf.country`
  and inserts into Cloudflare **D1** tables `visits` and `clicks`. It creates `clicks` and
  adds `visits.visitor_id` itself on first run, so no manual migration.
- `GET /stats?source=all|linkedin|message|resume` requires `Authorization: Bearer <ADMIN_TOKEN>`.
  The token is a Worker secret — the gate in `admin.html` is enforced server-side.
- `admin.html` has tabs per source: visits, unique visitors, returning visitors (seen on
  2+ days), link clicks, click rate, 30-day chart, top links, per-IP table, recent activity.
  Its "Don't track this browser" button sets `uw_ignore` in localStorage, which tracker.js honors.
- **Deploying `worker.js` is separate from GitHub Pages** (`npx wrangler deploy`, or paste
  into the Cloudflare dashboard editor). Worker URL: `uwaism-tracker.uwaismm05.workers.dev`.

Visitor IPs are stored intentionally and knowingly. `admin.html` carries
`noindex, nofollow` and is not linked from anywhere on the site.

## Content rules

- **The FIRE calculator is educational, never advice.** Model allocations shown by risk
  profile are generic and illustrative. The disclaimer in the footer stays. Do not turn it
  into personalized recommendations, do not name specific securities to buy, and do not
  remove or weaken the disclaimer language. Mohamed holds the CIRE certification and is
  pursuing the CFA — the compliance line matters.
- The allocation percentages currently in the calculator are **placeholder textbook
  figures** and were flagged for review.
- Contact: `uwaismm05@gmail.com`, `linkedin.com/in/uwaismm/`.

## Conventions

- Keep pages working at phone width; the nav links hide below 640px by design.
- New projects go in the `.card-grid` in the `#projects` section of `index.html`.
- Don't introduce a framework or a build step to solve a problem plain HTML handles.
