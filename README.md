# ITRI Visitor Request

This Next.js project hosts the visitor request form and a server-side Vercel relay at `/api/visitor-request`.

## Local setup

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. The root route redirects to the visitor form.

## Files

- `public/ITRI_Visitor_Request_Offline.html`: bilingual visitor form
- `app/api/visitor-request/route.ts`: secure server-side relay
- `ITRI_Visitor_Request_Code.gs`: Google Apps Script source; paste this into Apps Script, not into a browser

## Secrets

Configure these as Vercel Secret environment variables; do not add actual values to this repository:

- `APPS_SCRIPT_URL`: the Apps Script `/exec` URL
- `SYNC_TOKEN`: the same token stored in Apps Script Script Properties
