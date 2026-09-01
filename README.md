# Intern Management System — Inventory Dashboard

A single-file HTML/CSS/JS dashboard, backed by a Google Apps Script
web app, for tracking equipment issued to interns (laptops, badges,
peripherals) — built during a Forbes Marshall internship. This repo
was previously empty except for a stub README; this fills it in with
a working reconstruction matching the project's actual architecture.

## Architecture

```
index.html  (frontend, single file)
      │  fetch() for list/add/update, hidden-form submit for export
      ▼
Code.gs  (Google Apps Script, deployed as a Web App)
      │  doGet (reads) / doPost (writes), branching on `action`
      ▼
Google Sheet "Inventory"  (the actual data store)
```

- **Frontend**: one HTML file, no build step, no framework — plain
  JS + CSS with CSS custom properties for the dark/light theme toggle
  (persisted via `localStorage`).
- **Backend**: Google Apps Script instead of a hosted server — free,
  zero-deployment-infra, and the Sheet itself doubles as a
  human-readable/editable database, which matters for a small internal
  tool an intern coordinator might want to eyeball or hand-edit directly.
- **5-state status system**: In Stock, Issued, Returned Vendor,
  Received Vendor, Damaged — each with its own stat card and color-coded
  badge in the table.

## Setup (to actually deploy this)

1. Create a new Google Sheet. Apps Script needs to run *bound* to it:
   **Extensions → Apps Script**.
2. Paste `Code.gs`'s contents into the Apps Script editor (replacing
   the default `Code.gs` stub it creates).
3. **Deploy → New deployment → Web app**. Set "Execute as: Me" and
   "Who has access: Anyone" (or "Anyone with Google account" if you
   want to restrict it), then deploy.
4. Copy the deployment URL and paste it into `index.html`'s
   `SCRIPT_URL` constant (currently a placeholder:
   `YOUR_DEPLOYMENT_ID`).
5. Open `index.html` in a browser (or host it — GitHub Pages works
   fine for a static file like this).

The backend auto-creates the `Inventory` sheet with the right headers
on first read/write if it doesn't already exist.

## Why a hidden form for export, not `fetch()`

The export button submits a real HTML `<form>` (GET, `target="_blank"`)
instead of calling `fetch()`. Apps Script Web Apps don't reliably
return CORS headers that let a cross-origin `fetch()` read the
response — a plain form submission/page navigation isn't subject to
that restriction, since it's not reading the response via JavaScript,
just navigating to it. This was a real fix during development (the
original fetch-based export approach broke on CORS) and is kept as the
working approach here.

## `HEADER_ALIASES`: tolerating spreadsheet drift

`Code.gs` doesn't hardcode exact column header strings. A real
internal spreadsheet gets hand-edited over time — someone renames
"Item Name" to "ItemName", or "Assigned To" to "Intern" — and code that
assumes exact headers breaks silently the next time someone opens the
sheet. `HEADER_ALIASES` maps common variants back to the canonical
field name the backend actually uses, so the sync logic tolerates that
drift instead of failing.

## What's honestly unverified

This sandbox has no Google account or live Apps Script runtime to
deploy against, so:
- ✅ The embedded JavaScript is syntax-checked (`node --check`) and the
  HTML/CSS is hand-verified to render a complete dashboard structure.
- ✅ `Code.gs` is syntactically valid JavaScript (verified the same
  way), and its logic — header canonicalization, row read/write,
  doGet/doPost branching — is written to match the Apps Script API as
  documented.
- ⚠️ **Not verified**: an actual end-to-end deploy-and-click-through
  against a real Google Sheet. Follow the setup steps above and test
  against a real deployment before relying on this for real intern
  equipment tracking.
- 📝 The real Forbes Marshall logo wasn't available to embed here — the
  header currently shows a generated placeholder icon; swap in the
  actual base64-embedded PNG logo (per the original notes) before
  using this for real.
- 📝 The fifth status ("Issued") is a reasonable inference to complete
  a "5 states" system alongside the four that were on record (In
  Stock, Returned Vendor, Received Vendor, Damaged) — double-check this
  matches your actual original status naming and rename in both
  `index.html` and `Code.gs` if it doesn't.

## License

MIT — see `LICENSE`.
