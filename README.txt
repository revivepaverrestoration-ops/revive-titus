REVIVE TITUS SALES SYSTEM - PWA V1.1

WHAT THIS IS
A standalone, offline-first web app for Revive field quoting. It is designed for iPad and can be installed to the Home Screen after it is hosted over HTTPS.

V1 PRICING RULES
- Front driveway / walkway: $1.50 per sq ft
- Lanai / back area: $2.00 per sq ft
- Minimum project: $1,199
- Bundle discount: 0%, 5%, or 10%, applied to base service only and only when both front and back are included
- Joint tone: default $0.40 per sq ft
- Color revival: default $0.60 per sq ft
- Restore bundle: default $0.90 per sq ft
- Accent border pop: flat input, typical $295-$695
- Custom border: default $5.50 per linear ft
- Spot blend / problem areas: flat input, typical $150-$350
- Designer accent finish: flat input, typical $350-$750
- Full metallic veil: flat input, typical $750-$1,500

SCREENS
1. Quote
2. Price Positioning
3. Pricing Guide
4. Sales + Financing

OFFLINE
The service worker caches the app after the first successful online load. Core quote calculations and reference screens then work offline. Internet is still required for initial installation, updates, and any future Jobber/cloud integrations.

TEST LOCALLY ON WINDOWS
1. Open Command Prompt in this folder.
2. Run: python -m http.server 8080
3. Open: http://localhost:8080

INSTALL ON IPAD AFTER HOSTING
1. Open the HTTPS app address in Safari.
2. Tap Share.
3. Tap Add to Home Screen.
4. Turn on Open as Web App if shown.
5. Name it TITUS and tap Add.
6. Open TITUS once while online so the offline cache is populated.

IMPORTANT
This package is ready to host, but it is not yet published to a public URL. A free static host such as Cloudflare Pages, Netlify, Vercel, or GitHub Pages can host it. A custom subdomain such as titus.revivepaverrestoration.com can be added later; it is not required for testing.


V1.1 FIELD WORKFLOW UPGRADES
- Customer name, project address, estimator, and date header
- Estimator name persists across new quotes on the same iPad
- Start New Quote clears customer/project values and all quote inputs while keeping the estimator
- Review & Copy Summary modal for fast Jobber transfer
- Copy Jobber Summary button copies project details, scope, discount, upgrades, and final selling price
- Version label updated to V1.1
