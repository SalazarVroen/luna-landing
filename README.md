# LunaOS landing page

The prelaunch page for LunaOS: "Stop trying to sleep". It does two jobs: get people to take a 2-minute sleep check, and get them on the waitlist.

This is its own project, separate from the LunaOS app in `../Driftwell`. It has its own build and deploy.

## Run

```bash
npm install
npm run dev        # http://localhost:5174
npm run build      # type check + production build into dist/
npm run preview
npm run deploy     # build for GitHub Pages and push to the gh-pages branch
```

Live site: https://salazarvroen.github.io/luna-landing/ (GitHub Pages, served from the `gh-pages` branch).

## Waitlist

Set `VITE_WAITLIST_ENDPOINT` in `.env.local` (see `.env.example`). Sign-ups are POSTed there as JSON:

```json
{ "name": "", "email": "", "country": "", "counsellor": "yes|maybe|no|null", "consent": true,
  "score": 0, "band": "", "utm": {}, "referrer": null, "at": "ISO date" }
```

The endpoint URL is public by design (it ships in the page), so the receiving side must validate, rate-limit and dedupe. Without it the page runs in **preview mode**: sign-ups are saved in the visitor's browser only and the success screen says so.

The safety answers (snoring with gasping, dozing while driving) are shown to the visitor as a "check with a doctor" note and are never sent.

## The sleep check

Five of our own questions, each 0–4, total 0–20, score = round((20 − total) / 20 × 100). Bands match the app: 75+ sleeping well, 50+ a little unsettled, 25+ struggling, below that really struggling. It is not the ISI (that needs a licence) and it is not a diagnosis.

## Files

- `index.html`: all page content and SVG art
- `src/styles.css`: brand tokens (copied from the app) and layout
- `src/sky.ts`: the WebGL aurora and stars (hero and sleep check background)
- `src/main.ts`: title reveal, scroll-lit statement, count-ups, sleep-pressure chart, live body clock, myth cards, Luna chat, floating CTA, pause button
- `src/check.ts`: the sleep check, result, beta sign-up form and beta pass card in one `<dialog>`


## Motion

Full motion by default. With the system's reduced-motion setting on, the page keeps fades, glows and a slower aurora, and drops travel, blur-ins and 3D. The footer's Pause animation button stops everything and is remembered on the device.
