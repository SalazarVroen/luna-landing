# LunaOS landing (separate project)

- This is the prelaunch landing page, not the LunaOS app. The app lives in `../Driftwell`. Never import from `../Driftwell/src` and never change the app from here.
- Plain Vite + TypeScript, no framework. Keep it small: one page, `src/main.ts` for page motion, `src/check.ts` for the sleep check and waitlist.
- Brand tokens in `src/styles.css` are copied from the app's tokens. If the app's brand changes, copy the change across by hand.
- Dev server runs on port 5174 so it doesn't clash with the app (5173).
- Only `VITE_WAITLIST_ENDPOINT` is a client env var, and it's public by design. No secrets in this project: anything prefixed `VITE_` ships to the browser.
- Every animation needs a reduced-motion path, and content must be visible without JS.
- Copy rules: short, calm, plain. Luna is "AI sleep guide · not a doctor". Never name the AI model or provider. The sleep check is not the ISI and not a diagnosis.
- `npm run build` (tsc + vite build) must pass before calling work done.
