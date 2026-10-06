REVIVE TITUS SALES SYSTEM - PWA V1.5.1

WHAT THIS IS
A standalone, offline-first field quoting app for Revive Paver Restoration. It is designed for iPad, uses protected pricing logic instead of spreadsheet cells, and can be installed to the Home Screen after hosting over HTTPS.

PAVER PRICING RULES
- Front driveway / walkway paver restoration: $1.50 per sq ft
- Lanai / back paver restoration: $2.00 per sq ft
- Paver restoration/sealing base minimum: $1,199
- The $1,199 minimum is applied to the paver base before specialty upgrades and exterior services are added
- Bundle discount: 0%, 5%, or 10% standard; 12%, 15%, or 20% with manager approval
- Bundle discount applies only to paver base service and only when both front and back are included
- Joint tone: default $0.40 per sq ft
- Color revival: default $0.60 per sq ft
- Restore bundle: default $0.90 per sq ft
- Accent border pop: flat input, typical $295-$695
- Custom border: default $5.50 per linear ft
- Spot blend / problem areas: flat input, typical $150-$350
- Designer accent finish: flat input, typical $350-$750
- Full metallic veil: flat input, typical $750-$1,500
- Paver repair & re-leveling: approved flat project price

EXTERIOR CLEANING FIELD GUIDES
These are TITUS field-estimating guides for on-site quoting. They are not fixed Jobber catalog prices unless noted.
- House Soft Wash: tier pricing from $249 through $699 for homes up to 5,000 sq ft
  - Up to 1,500 sq ft: $249
  - 1,501-2,000: $299
  - 2,001-2,500: $349
  - 2,501-3,000: $399
  - 3,001-3,500: $449
  - 3,501-4,000: $499
  - 4,001-4,500: $599
  - 4,501-5,000: $699
  - 2-story guide: +$75
  - 3+ story guide: +$150
  - Over 5,000 sq ft: manager/custom review; use the adjustment field
- Roof Soft Wash: $0.45 per sq ft, $1,200 minimum, plus field adjustment for pitch/material/access/condition
- Driveway Pressure Cleaning: $0.20 per sq ft, $149 minimum
- Sidewalk & Street Curb Cleaning: $0.20 per sq ft, $99 minimum
- Lanai / Patio / Pool Deck Floor Cleaning: $0.25 per sq ft, $149 minimum
- Pool Cage & Screen Enclosure Cleaning: $299 standard / $399 large-tall; custom for oversized/two-story
- Gutter Interior Cleaning: $1.00 per linear ft, $149 minimum
- One-Time Pool Clean & Chemical Balance: $150 (current Jobber saved service price)
- Professional French Drain Cleanout: current Jobber saved service starts at $249; TITUS keeps it as an editable flat price
- Exterior gutter brightening, fence cleaning, fence staining, concrete cleaning/sealing, rust, efflorescence, oil/grease, and custom scope use approved flat project prices

REVIVE CLEANING PACKAGES
Current saved Jobber package prices represented in TITUS:
- Entry Refresh: $249
- Curb Appeal: $449
- Outdoor Living Refresh: $349
- Whole Property: $849
- Roof & House Refresh: custom
- Complete Home Care: custom

IMPORTANT PACKAGE RULE
A selected package is added to the quote total. Do not also enter individual services already included in the selected package unless they are genuinely additional scope.

SCREENS
1. Quote
2. Price Positioning
3. Pricing Guide
4. Sales + Financing

V1.4 CHANGES
- Added Exterior Cleaning & Add-Ons section with collapsible categories
- Added automatic House Soft Wash tier calculator with story adjustment and manual adjustment field
- Added Roof Soft Wash square-foot calculator with $1,200 minimum and manual condition/access adjustment
- Added Driveway Pressure Cleaning square-foot calculator
- Added Sidewalk & Street Curb Cleaning square-foot calculator
- Added Lanai / Patio / Pool Deck Floor Cleaning square-foot calculator
- Added Pool Cage & Screen Enclosure pricing tiers
- Added Gutter Interior Cleaning linear-foot calculator
- Added flat-price fields for entry cleaning, gutter brightening, fence cleaning/staining, concrete sealing, stain treatments, French drain cleanout, and custom work
- Added One-Time Pool Clean & Chemical Balance at the current Jobber saved $150 price
- Added Revive saved package selector and custom package field
- Updated quote summary / Jobber copy text to include all selected services with quantities and prices
- Corrected paver minimum logic so the $1,199 paver minimum is applied to the paver base first, then paver upgrades and exterior services are added on top
- Blank quote now starts at $0; the $1,199 minimum appears only when paver base work is entered
- Updated offline cache and version label to V1.4

OFFLINE
The service worker caches the app after the first successful online load. Core quote calculations and reference screens work offline. Internet is still required for initial installation, updates, and future Jobber/cloud integrations.

INSTALL ON IPAD AFTER HOSTING
1. Open the HTTPS app address in Safari.
2. Tap Share.
3. Tap Add to Home Screen.
4. Turn on Open as Web App if shown.
5. Name it TITUS and tap Add.
6. Open TITUS once while online so the offline cache is populated.


V1.5 CHANGES
- Simplified Price Positioning from five cards to three internal training references:
  Chuck in the Truck ($1.00/sq ft), Revive Professional Restoration (actual paver project), and Top-Dollar Todd ($3.50/sq ft).
- Positioning now uses only paver base + selected paver upgrades. Exterior services can never change the paver comparison.
- Added explicit paverProjectTotal to the pricing engine.
- Changed all user-visible "lf" abbreviations to "linear ft".
- Reorganized Pricing Guide into Paver Base, Paver Upgrades, Pressure/Soft Washing, Exterior Add-ons, and Packages.
- Simplified Sales screen and clarified bundle discount, paver minimum, package, financing, and exterior-service rules.
- Updated offline cache and local-storage version to V1.5 while retaining V1.4 quote-state migration.


V1.5.1 CHANGES
- Replaced the House Soft Wash story-count dropdown with three large visible buttons: 1 story, 2 stories, 3+ stories.
- Removes the browser/iPad native dropdown contrast issue where 2-story and 3+ story choices could be unreadable.
- Pricing logic is unchanged: 1 story +$0, 2 stories +$75, 3+ stories +$150.
- Updated offline cache to force the story-selector UI update.


V1.6
- Added Customer Phone and Customer Email to Project Details.
- Phone and email save locally with the current quote and clear on New Quote.
- Existing V1.5 quote state migrates forward automatically.
- Review & Copy Summary now includes customer phone and email for Jobber matching.
- Updated project/summary layouts and offline cache.
- This is the customer-matching preparation step for the future secure TITUS -> Jobber draft quote handoff.
