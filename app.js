(() => {
  'use strict';
  const { RULES, calculate: priceQuote } = window.TitusPricing;

  const quoteIds = [
    'frontSqft','backSqft','bundleDiscount',
    'jointToneSqft','colorRevivalSqft','restoreBundleSqft','accentBorderFlat','customBorderLf','spotBlendFlat','designerAccentFlat','metallicVeilFlat','paverRepairFlat',
    'houseWashSqft','houseStories','houseWashAdjustmentFlat','roofWashSqft','roofWashAdjustmentFlat',
    'drivewayCleaningSqft','sidewalkCurbSqft','frontPorchEntryFlat','concreteCleaningSealingFlat',
    'poolDeckCleaningSqft','poolCageTier','oneTimePoolClean',
    'gutterInteriorLf','exteriorGutterBrighteningFlat','fenceCleaningFlat','fenceStainingFlat','frenchDrainCleanoutFlat',
    'rustTreatmentFlat','efflorescenceTreatmentFlat','oilGreaseTreatmentFlat','customAdditionalWorkFlat',
    'exteriorPackage','customPackageFlat'
  ];
  const projectIds = ['customerName','projectAddress','customerPhone','customerEmail','estimatorName','quoteDate'];
  const selectDefaults = {
    bundleDiscount: '0', houseStories: '1', poolCageTier: '0', oneTimePoolClean: '0', exteriorPackage: '0'
  };
  const $ = (id) => document.getElementById(id);
  const money = new Intl.NumberFormat('en-US', { style:'currency', currency:'USD', maximumFractionDigits:0 });
  const rateFmt = new Intl.NumberFormat('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 });
  const numberFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits:0 });
  const JOBBER_API_BASE = String(window.TITUS_CONFIG?.jobberApiBase || '').replace(/\/$/, '');
  const DEVICE_TOKEN_KEY = 'revive-titus-jobber-device-token';
  const DEVICE_TOKEN_COOKIE = 'revive_titus_jobber_device';
  let memoryJobberDeviceToken = '';
  let currentJobberSelection = null;
  let currentJobberQuoteUrl = '';


  function syncStoryButtons() {
    const selected = String($('houseStories').value || '1');
    document.querySelectorAll('.story-btn').forEach(btn => {
      const active = btn.dataset.story === selected;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function syncDiscountButtons() {
    const selected = String($('bundleDiscount').value || '0');
    document.querySelectorAll('.discount-btn').forEach(btn => {
      const active = btn.dataset.discount === selected;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function todayISO() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function calculate() {
    const input = {};
    quoteIds.forEach(id => input[id] = $(id).value);
    return priceQuote(input);
  }

  function render() {
    const q = calculate();
    $('frontSubtotal').textContent = money.format(q.frontSubtotal);
    $('backSubtotal').textContent = money.format(q.backSubtotal);
    $('discountAmount').textContent = q.discountAmount === 0 ? '$0' : `−${money.format(Math.abs(q.discountAmount))}`;
    $('baseAfterDiscount').textContent = money.format(q.paverBaseFinal);
    $('upgradeSubtotal').textContent = money.format(q.paverUpgrades);
    $('exteriorSubtotal').textContent = money.format(q.exteriorServices);
    $('paverMinimumAdjustment').textContent = q.paverMinimumAdjustment > 0 ? `+${money.format(q.paverMinimumAdjustment)}` : '$0';
    $('paverUpgradeBreakdown').textContent = money.format(q.paverUpgrades);
    $('exteriorBreakdown').textContent = money.format(q.exteriorServices);
    $('calculatedTotal').textContent = money.format(q.calculated);
    $('finalPrice').textContent = money.format(q.finalPrice);
    $('totalArea').textContent = `${numberFmt.format(q.totalArea)} sq ft`;

    if (q.hasPaverBase && q.paverMinimumAdjustment > 0) $('minimumNote').textContent = '$1,199 paver project minimum applied';
    else if (q.hasPaverBase) $('minimumNote').textContent = 'Calculated paver base + selected add-ons';
    else if (q.exteriorServices > 0 || q.paverUpgrades > 0) $('minimumNote').textContent = 'Exterior / add-on project pricing';
    else $('minimumNote').textContent = 'Enter project scope to begin';

    // Live exterior-service prices.
    $('houseWashCalc').textContent = q.houseSqft > 0 ? (q.houseNeedsCustomReview ? `${money.format(q.houseWash)}+ review` : money.format(q.houseWash)) : '$0';
    $('roofWashCalc').textContent = money.format(q.roofWash);
    $('drivewayCleaningCalc').textContent = money.format(q.drivewayCleaning);
    $('sidewalkCurbCalc').textContent = money.format(q.sidewalkCurbCleaning);
    $('poolDeckCleaningCalc').textContent = money.format(q.poolDeckCleaning);
    $('poolCageCalc').textContent = money.format(q.poolCagePrice);
    $('poolCleanCalc').textContent = money.format(q.oneTimePoolClean);
    $('gutterInteriorCalc').textContent = money.format(q.gutterInteriorCleaning);

    $('posArea').textContent = `${numberFmt.format(q.totalArea)} sq ft`;
    $('posBase').textContent = money.format(q.paverProjectTotal);
    $('posConfigured').textContent = q.effectiveRate === null ? '—' : `$${rateFmt.format(q.effectiveRate)} / sq ft`;
    renderPositioning(q);
    renderCustomerView(q);
    syncStoryButtons();
    syncDiscountButtons();
    saveState();
  }

  function renderPositioning(q) {
    const low = q.totalArea * 1;
    const high = q.totalArea * 3.5;
    const reviveRate = q.effectiveRate;
    const cards = [
      ['Low-price example', 'Chuck in the Truck', '$1.00 / sq ft', low, 'Illustrative basic-service paver example. Scope can be very different from Revive.', false],
      ['Revive', 'Revive Professional Restoration', reviveRate === null ? '—' : `$${rateFmt.format(reviveRate)} / sq ft`, q.paverProjectTotal, 'Your actual paver project: base restoration, approved bundle discount, and selected paver upgrades. Exterior services are excluded.', true],
      ['Higher-price example', 'Top-Dollar Todd', '$3.50 / sq ft', high, 'Illustrative higher-price paver example. This is not an actual competitor quote.', false]
    ];
    $('positionCards').innerHTML = cards.map(c => `
      <article class="position-card${c[5] ? ' revive' : ''}">
        <span class="tag">${c[0]}</span>
        <h3>${c[1]}</h3>
        <p>${c[4]}</p>
        <div class="pos-total">${money.format(c[3])}</div>
        <div class="pos-rate">${c[2]}</div>
      </article>`).join('');
  }

  function customerScopeRows(q) {
    const rows = [];
    if (q.front > 0) rows.push(['Front Driveway Paver Restoration & Sealing', `${numberFmt.format(q.front)} sq ft`]);
    if (q.back > 0) rows.push(['Lanai & Pool Deck Paver Restoration & Sealing', `${numberFmt.format(q.back)} sq ft`]);
    selectedPaverUpgrades().forEach(([name, qty]) => rows.push([name, qty]));
    selectedExteriorServices(q).forEach(([name, qty]) => rows.push([name, qty]));
    return rows;
  }

  function renderCustomerView(q) {
    const customer = $('customerName').value.trim() || 'Your project';
    const address = $('projectAddress').value.trim() || 'Project address';
    $('customerViewName').textContent = customer;
    $('customerViewAddress').textContent = address;
    $('customerFinalPrice').textContent = money.format(q.finalPrice);

    const rows = customerScopeRows(q);
    $('customerScopeList').innerHTML = rows.length ? rows.map(([name, qty]) => `
      <div class="customer-scope-item">
        <span class="customer-check">✓</span>
        <div><b>${escapeHtml(name)}</b><small>${escapeHtml(qty)}</small></div>
      </div>`).join('') : `
      <div class="customer-scope-empty">
        <b>Your project scope will appear here.</b>
        <span>Your estimator is still building the project.</span>
      </div>`;

    const hasPavers = q.hasPaverBase && q.totalArea > 0;
    $('customerComparisonSection').hidden = !hasPavers;
    $('customerWarrantyCard').hidden = !hasPavers;
    if (hasPavers) {
      const low = q.totalArea * 1;
      const high = q.totalArea * 3.5;
      const reviveRate = q.effectiveRate === null ? '—' : `$${rateFmt.format(q.effectiveRate)} / sq ft`;
      const cards = [
        ['Basic Service Example', '$1.00 / sq ft', low, 'Illustrative entry-level paver pricing reference.'],
        ['Revive Professional Restoration', reviveRate, q.paverProjectTotal, 'Your actual Revive paver restoration scope and selected paver upgrades.'],
        ['Premium Market Example', '$3.50 / sq ft', high, 'Illustrative higher-end paver pricing reference.']
      ];
      $('customerComparisonCards').innerHTML = cards.map((c, i) => `
        <article class="customer-comparison-card${i === 1 ? ' revive' : ''}">
          <span>${escapeHtml(c[0])}</span>
          <strong>${money.format(c[2])}</strong>
          <b>${escapeHtml(c[1])}</b>
          <p>${escapeHtml(c[3])}</p>
        </article>`).join('');
    } else {
      $('customerComparisonCards').innerHTML = '';
    }
  }

  function saveState() {
    try {
      const state = {};
      [...quoteIds, ...projectIds].forEach(id => state[id] = $(id).value);
      localStorage.setItem('revive-titus-v1-6', JSON.stringify(state));
      if ($('estimatorName').value.trim()) localStorage.setItem('revive-titus-estimator', $('estimatorName').value.trim());
    } catch (_) {}
  }

  function loadState() {
    try {
      const legacy = JSON.parse(localStorage.getItem('revive-titus-v1') || '{}');
      const v11 = JSON.parse(localStorage.getItem('revive-titus-v1-1') || '{}');
      const v12 = JSON.parse(localStorage.getItem('revive-titus-v1-2') || '{}');
      const v13 = JSON.parse(localStorage.getItem('revive-titus-v1-3') || '{}');
      const v14 = JSON.parse(localStorage.getItem('revive-titus-v1-4') || '{}');
      const v15 = JSON.parse(localStorage.getItem('revive-titus-v1-5') || '{}');
      const state = JSON.parse(localStorage.getItem('revive-titus-v1-6') || '{}');
      quoteIds.forEach(id => {
        const value = state[id] !== undefined ? state[id]
          : (v15[id] !== undefined ? v15[id]
          : (v14[id] !== undefined ? v14[id]
          : (v13[id] !== undefined ? v13[id]
          : (v12[id] !== undefined ? v12[id]
          : (v11[id] !== undefined ? v11[id] : legacy[id])))));
        if (value !== undefined) {
          if (selectDefaults[id] !== undefined) $(id).value = String(value || selectDefaults[id]);
          else $(id).value = Number(value) === 0 ? '' : value;
        }
      });
      projectIds.forEach(id => {
        const value = state[id] !== undefined ? state[id]
          : (v15[id] !== undefined ? v15[id]
          : (v14[id] !== undefined ? v14[id]
          : (v13[id] !== undefined ? v13[id] : v12[id])));
        if (value !== undefined) $(id).value = value;
      });
      if (!$('estimatorName').value) $('estimatorName').value = localStorage.getItem('revive-titus-estimator') || '';
    } catch (_) {}
    Object.entries(selectDefaults).forEach(([id, value]) => { if (!$(id).value) $(id).value = value; });
    if (!$('quoteDate').value) $('quoteDate').value = todayISO();
  }

  function resetQuote() {
    const ok = window.confirm('Start a new quote? This clears the current customer, measurements, upgrades, exterior services, packages, and discount on this iPad.');
    if (!ok) return;
    const estimator = $('estimatorName').value.trim();
    quoteIds.forEach(id => $(id).value = selectDefaults[id] !== undefined ? selectDefaults[id] : '');
    $('bundleDiscount').dataset.lastApproved = '0';
    $('customerName').value = '';
    $('projectAddress').value = '';
    $('customerPhone').value = '';
    $('customerEmail').value = '';
    $('estimatorName').value = estimator;
    $('quoteDate').value = todayISO();
    try {
      ['revive-titus-v1','revive-titus-v1-1','revive-titus-v1-2','revive-titus-v1-3','revive-titus-v1-4','revive-titus-v1-5','revive-titus-v1-6'].forEach(k => localStorage.removeItem(k));
    } catch (_) {}
    render();
    $('customerName').focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function projectMetaHtml() {
    const customer = $('customerName').value.trim() || 'Customer not entered';
    const address = $('projectAddress').value.trim() || 'Address not entered';
    const phone = $('customerPhone').value.trim() || 'Phone not entered';
    const email = $('customerEmail').value.trim() || 'Email not entered';
    const estimator = $('estimatorName').value.trim() || 'Estimator not entered';
    const date = $('quoteDate').value || todayISO();
    return `
      <div><span>Customer</span><strong>${escapeHtml(customer)}</strong></div>
      <div><span>Address</span><strong>${escapeHtml(address)}</strong></div>
      <div><span>Phone</span><strong>${escapeHtml(phone)}</strong></div>
      <div><span>Email</span><strong>${escapeHtml(email)}</strong></div>
      <div><span>Estimator</span><strong>${escapeHtml(estimator)}</strong></div>
      <div><span>Date</span><strong>${escapeHtml(date)}</strong></div>`;
  }

  function selectedPaverUpgrades() {
    const rows = [];
    const jt = Number($('jointToneSqft').value) || 0;
    const cr = Number($('colorRevivalSqft').value) || 0;
    const rb = Number($('restoreBundleSqft').value) || 0;
    const ab = Number($('accentBorderFlat').value) || 0;
    const cb = Number($('customBorderLf').value) || 0;
    const sb = Number($('spotBlendFlat').value) || 0;
    const da = Number($('designerAccentFlat').value) || 0;
    const mv = Number($('metallicVeilFlat').value) || 0;
    const pr = Number($('paverRepairFlat').value) || 0;
    if (jt > 0) rows.push(['Joint Tone Enhancement', `${numberFmt.format(jt)} sq ft`, jt * RULES.jointToneRate]);
    if (cr > 0) rows.push(['Color Revival', `${numberFmt.format(cr)} sq ft`, cr * RULES.colorRevivalRate]);
    if (rb > 0) rows.push(['Restore Bundle', `${numberFmt.format(rb)} sq ft`, rb * RULES.restoreBundleRate]);
    if (ab > 0) rows.push(['Accent Border Pop', 'Flat project price', ab]);
    if (cb > 0) rows.push(['Custom Border', `${numberFmt.format(cb)} linear ft`, cb * RULES.customBorderRate]);
    if (sb > 0) rows.push(['Spot Blend / Problem Areas', 'Flat project price', sb]);
    if (da > 0) rows.push(['Designer Accent Finish', 'Flat project price', da]);
    if (mv > 0) rows.push(['Full Metallic Veil / Metal Flake Finish', 'Flat project price', mv]);
    if (pr > 0) rows.push(['Paver Repair & Re-Leveling', 'Flat project price', pr]);
    return rows;
  }

  function selectedExteriorServices(q) {
    const rows = [];
    if (q.houseSqft > 0) rows.push(['House Soft Wash', `${numberFmt.format(q.houseSqft)} sq ft • ${q.houseStories}${q.houseStories === 1 ? ' story' : ' stories'}${q.houseNeedsCustomReview ? ' • custom review' : ''}`, q.houseWash]);
    if (q.roofSqft > 0) rows.push(['Roof Soft Wash', `${numberFmt.format(q.roofSqft)} sq ft`, q.roofWash]);
    if (q.drivewayCleaningSqft > 0) rows.push(['Driveway Pressure Cleaning', `${numberFmt.format(q.drivewayCleaningSqft)} sq ft`, q.drivewayCleaning]);
    if (q.sidewalkCurbSqft > 0) rows.push(['Sidewalk & Street Curb Cleaning', `${numberFmt.format(q.sidewalkCurbSqft)} sq ft`, q.sidewalkCurbCleaning]);
    const porch = Number($('frontPorchEntryFlat').value) || 0;
    if (porch > 0) rows.push(['Front Porch & Entry Cleaning', 'Flat project price', porch]);
    const concrete = Number($('concreteCleaningSealingFlat').value) || 0;
    if (concrete > 0) rows.push(['Professional Concrete Cleaning & Protective Sealing', 'Flat project price', concrete]);
    if (q.poolDeckCleaningSqft > 0) rows.push(['Lanai, Patio & Pool Deck Floor Cleaning', `${numberFmt.format(q.poolDeckCleaningSqft)} sq ft`, q.poolDeckCleaning]);
    if (q.poolCagePrice > 0) rows.push(['Pool Cage & Screen Enclosure Cleaning', $('poolCageTier').selectedOptions[0].textContent.replace(/ — .*/, ''), q.poolCagePrice]);
    if (q.oneTimePoolClean > 0) rows.push(['One-Time Pool Clean & Chemical Balance', 'Saved Jobber service', q.oneTimePoolClean]);
    if (q.gutterInteriorLf > 0) rows.push(['Gutter Interior Cleaning', `${numberFmt.format(q.gutterInteriorLf)} linear ft`, q.gutterInteriorCleaning]);
    const fixed = [
      ['Exterior Gutter Brightening','exteriorGutterBrighteningFlat'],
      ['Fence Cleaning','fenceCleaningFlat'],
      ['Fence Staining & Protection','fenceStainingFlat'],
      ['Professional French Drain Cleanout','frenchDrainCleanoutFlat'],
      ['Rust Treatment','rustTreatmentFlat'],
      ['Efflorescence Treatment','efflorescenceTreatmentFlat'],
      ['Oil & Grease Stain Treatment','oilGreaseTreatmentFlat'],
      ['Custom Scope / Additional Work','customAdditionalWorkFlat']
    ];
    fixed.forEach(([name,id]) => { const v = Number($(id).value) || 0; if (v > 0) rows.push([name, 'Flat project price', v]); });
    if (q.packagePrice > 0) rows.push([$('exteriorPackage').selectedOptions[0].textContent.replace(/ — .*/, ''), 'Revive saved package', q.packagePrice]);
    if (q.customPackageFlat > 0) rows.push(['Custom Revive Package', 'Roof & House / Complete Home Care / custom scope', q.customPackageFlat]);
    return rows;
  }

  function summaryLinesHtml(q) {
    const lines = [];
    if (q.front > 0) lines.push(['Front Driveway Paver Restoration & Sealing', `${numberFmt.format(q.front)} sq ft`, q.frontSubtotal]);
    if (q.back > 0) lines.push(['Lanai & Pool Deck Paver Restoration & Sealing', `${numberFmt.format(q.back)} sq ft`, q.backSubtotal]);
    if (q.bundleDiscount > 0) lines.push(['Paver bundle discount', `${Math.round(q.bundleDiscount*100)}%${q.bundleDiscount > RULES.standardBundleDiscountMax ? ' • Manager approved' : ''}`, q.discountAmount]);
    if (q.paverMinimumAdjustment > 0) lines.push(['Paver project minimum adjustment', 'Brings base paver project to $1,199', q.paverMinimumAdjustment]);
    selectedPaverUpgrades().forEach(row => lines.push(row));
    selectedExteriorServices(q).forEach(row => lines.push(row));
    if (!lines.length) lines.push(['Project', 'No scope entered', 0]);
    return lines.map(([name,qty,amount]) => `<div><span><b>${escapeHtml(name)}</b><small>${escapeHtml(qty)}</small></span><strong>${amount < 0 ? `−${money.format(Math.abs(amount))}` : money.format(amount)}</strong></div>`).join('');
  }

  function buildSummaryText(q) {
    const customer = $('customerName').value.trim() || 'Not entered';
    const address = $('projectAddress').value.trim() || 'Not entered';
    const phone = $('customerPhone').value.trim() || 'Not entered';
    const email = $('customerEmail').value.trim() || 'Not entered';
    const estimator = $('estimatorName').value.trim() || 'Not entered';
    const date = $('quoteDate').value || todayISO();
    const lines = [
      'REVIVE TITUS QUOTE SUMMARY',
      `Customer: ${customer}`,
      `Address: ${address}`,
      `Phone: ${phone}`,
      `Email: ${email}`,
      `Estimator: ${estimator}`,
      `Date: ${date}`,
      ''
    ];

    if (q.front > 0 || q.back > 0) {
      lines.push('PAVER RESTORATION');
      if (q.front > 0) lines.push(`- Front Driveway Paver Restoration & Sealing: ${numberFmt.format(q.front)} sq ft — ${money.format(q.frontSubtotal)}`);
      if (q.back > 0) lines.push(`- Lanai & Pool Deck Paver Restoration & Sealing: ${numberFmt.format(q.back)} sq ft — ${money.format(q.backSubtotal)}`);
      if (q.bundleDiscount > 0) lines.push(`- Bundle discount: ${Math.round(q.bundleDiscount*100)}%${q.bundleDiscount > RULES.standardBundleDiscountMax ? ' (manager approved)' : ''} — -${money.format(Math.abs(q.discountAmount))}`);
      if (q.paverMinimumAdjustment > 0) lines.push(`- Paver minimum adjustment: +${money.format(q.paverMinimumAdjustment)}`);
      lines.push(`- Paver base after minimum: ${money.format(q.paverBaseFinal)}`);
    }

    const paverUpgrades = selectedPaverUpgrades();
    if (paverUpgrades.length) {
      lines.push('', 'PAVER UPGRADES');
      paverUpgrades.forEach(([name,qty,price]) => lines.push(`- ${name}: ${qty} — ${money.format(price)}`));
    }

    const exterior = selectedExteriorServices(q);
    if (exterior.length) {
      lines.push('', 'EXTERIOR CLEANING & ADD-ONS');
      exterior.forEach(([name,qty,price]) => lines.push(`- ${name}: ${qty} — ${money.format(price)}`));
    }

    lines.push('', `FINAL SELLING PRICE: ${money.format(q.finalPrice)}`);
    if (q.houseNeedsCustomReview) lines.push('REVIEW: House is over 5,000 sq ft; confirm custom/manager pricing before sending.');
    if (q.packagePrice > 0 && exterior.length > 1) lines.push('CHECK PACKAGE SCOPE: Do not duplicate services already included in a selected package.');
    lines.push('', 'Official customer quote and financing are completed in Jobber.');
    return lines.join('\n');
  }

  function openSummary() {
    const q = calculate();
    $('summaryProject').innerHTML = projectMetaHtml();
    $('summaryLines').innerHTML = summaryLinesHtml(q);
    $('summaryFinalPrice').textContent = money.format(q.finalPrice);
    $('copyStatus').textContent = '';
    resetJobberResult();
    refreshJobberStatus();
    const dialog = $('quoteSummaryDialog');
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open','');
  }

  function closeSummary() {
    const dialog = $('quoteSummaryDialog');
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
  }

  async function copySummary() {
    const text = buildSummaryText(calculate());
    const status = $('copyStatus');
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly','');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      status.textContent = 'Copied. Paste this into Jobber notes or the quote workflow.';
      $('copySummaryBtn').textContent = 'Copied ✓';
      setTimeout(() => { $('copySummaryBtn').textContent = 'Copy Jobber Summary'; }, 1800);
    } catch (_) {
      status.textContent = 'Copy was blocked by the browser. Select the summary manually or try again while online.';
    }
  }

  function buildJobberLines(q) {
    const lines = [];
    if (q.hasPaverBase) {
      let name = 'Complete Paver Restoration & Sealing';
      const details = [];
      if (q.front > 0 && q.back <= 0) name = 'Front Driveway Paver Restoration & Sealing';
      else if (q.back > 0 && q.front <= 0) name = 'Lanai & Pool Deck Paver Restoration & Sealing';
      if (q.front > 0) details.push(`Front: ${numberFmt.format(q.front)} sq ft`);
      if (q.back > 0) details.push(`Lanai / back: ${numberFmt.format(q.back)} sq ft`);
      if (q.bundleDiscount > 0) details.push(`Paver bundle discount: ${Math.round(q.bundleDiscount * 100)}%${q.bundleDiscount > RULES.standardBundleDiscountMax ? ' (manager approved)' : ''}`);
      if (q.paverMinimumAdjustment > 0) details.push('$1,199 paver project minimum applied');
      lines.push({ name, detail: details.join(' • '), amount: q.paverBaseFinal });
    }
    selectedPaverUpgrades().forEach(([name, qty, price]) => lines.push({ name, detail: qty, amount: price }));
    selectedExteriorServices(q).forEach(([name, qty, price]) => lines.push({ name, detail: qty, amount: price }));
    return lines.filter(line => Number(line.amount) > 0);
  }

  function jobberQuoteTitle(q) {
    const exterior = selectedExteriorServices(q);
    const upgrades = selectedPaverUpgrades();
    if (q.hasPaverBase && exterior.length) return 'Paver Restoration & Exterior Services';
    if (q.hasPaverBase) {
      if (q.front > 0 && q.back <= 0) return 'Front Driveway Paver Restoration & Sealing';
      if (q.back > 0 && q.front <= 0) return 'Lanai & Pool Deck Paver Restoration & Sealing';
      return 'Complete Paver Restoration & Sealing';
    }
    if (exterior.length === 1 && !upgrades.length) return exterior[0][0];
    return 'Revive Exterior Services';
  }

  function jobberPayload(q) {
    return {
      title: jobberQuoteTitle(q),
      expectedTotal: Number(q.finalPrice.toFixed(2)),
      lines: buildJobberLines(q)
    };
  }

  function readCookie(name) {
    try {
      const target = `${name}=`;
      const entry = document.cookie.split(';').map(v => v.trim()).find(v => v.startsWith(target));
      return entry ? decodeURIComponent(entry.slice(target.length)) : '';
    } catch (_) { return ''; }
  }

  function jobberDeviceToken() {
    if (memoryJobberDeviceToken) return memoryJobberDeviceToken;
    try {
      const token = localStorage.getItem(DEVICE_TOKEN_KEY) || '';
      if (token) return token;
    } catch (_) {}
    try {
      const token = sessionStorage.getItem(DEVICE_TOKEN_KEY) || '';
      if (token) return token;
    } catch (_) {}
    return readCookie(DEVICE_TOKEN_COOKIE);
  }

  function setJobberDeviceToken(token) {
    const value = String(token || '').trim();
    memoryJobberDeviceToken = value;
    if (!value) return false;
    let persisted = false;
    try {
      localStorage.setItem(DEVICE_TOKEN_KEY, value);
      persisted = localStorage.getItem(DEVICE_TOKEN_KEY) === value || persisted;
    } catch (_) {}
    try {
      sessionStorage.setItem(DEVICE_TOKEN_KEY, value);
      persisted = sessionStorage.getItem(DEVICE_TOKEN_KEY) === value || persisted;
    } catch (_) {}
    try {
      document.cookie = `${DEVICE_TOKEN_COOKIE}=${encodeURIComponent(value)}; Max-Age=${60 * 60 * 24 * 180}; Path=/; Secure; SameSite=Strict`;
      persisted = readCookie(DEVICE_TOKEN_COOKIE) === value || persisted;
    } catch (_) {}
    return persisted;
  }

  async function jobberFetch(path, options = {}, allowPair = true, tokenOverride = '') {
    if (!JOBBER_API_BASE) throw new Error('The TITUS Jobber bridge URL is not configured.');
    const headers = { 'Content-Type':'application/json', ...(options.headers || {}) };
    const token = String(tokenOverride || jobberDeviceToken() || '').trim();
    if (token) headers.Authorization = `Bearer ${token}`;
    let response;
    try {
      response = await fetch(`${JOBBER_API_BASE}${path}`, { ...options, headers });
    } catch (_) {
      throw new Error('Could not reach the TITUS Jobber bridge. Check internet service and try again.');
    }
    let body = {};
    try { body = await response.json(); } catch (_) {}
    if (response.status === 401 && body.code === 'PAIR_REQUIRED' && allowPair) {
      const pairedToken = await pairJobberDevice();
      if (!pairedToken) throw new Error('Device pairing was cancelled. Tap Send to Jobber and enter the setup PIN.');
      return jobberFetch(path, options, false, pairedToken);
    }
    if (!response.ok || body.ok === false) throw new Error(body.message || `Jobber bridge returned HTTP ${response.status}.`);
    return body;
  }

  async function pairJobberDevice() {
    const pin = window.prompt('Enter the TITUS setup PIN for this device. You only need to do this once.');
    if (!pin) return '';
    if (!JOBBER_API_BASE) throw new Error('The TITUS Jobber bridge URL is not configured.');

    setJobberStatus('Checking the TITUS setup PIN…', 'muted');
    let response;
    try {
      response = await fetch(`${JOBBER_API_BASE}/api/pair`, {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body:JSON.stringify({ pin: String(pin).trim() })
      });
    } catch (_) {
      throw new Error("Could not reach the TITUS Jobber bridge. Check this device's internet connection and try again.");
    }

    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.deviceToken) {
      throw new Error(body.message || 'That TITUS setup PIN did not work.');
    }

    const token = String(body.deviceToken || '').trim();
    const persisted = setJobberDeviceToken(token);

    let verifyResponse;
    try {
      verifyResponse = await fetch(`${JOBBER_API_BASE}/api/jobber/status`, {
        method:'GET',
        headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` }
      });
    } catch (_) {
      throw new Error('The PIN was accepted, but TITUS could not verify this device with the Jobber bridge. Try again once.');
    }
    const verifyBody = await verifyResponse.json().catch(() => ({}));
    if (!verifyResponse.ok) {
      throw new Error(verifyBody.message || 'The PIN was accepted, but the bridge did not recognize this device.');
    }

    if (!persisted) {
      setJobberStatus('Pairing accepted for this session. Continuing to Jobber…', 'warn');
    } else {
      setJobberStatus('Pairing accepted. Continuing to Jobber…', 'good');
    }
    return token;
  }

  function setJobberStatus(message, tone = '') {
    const el = $('jobberStatus');
    el.textContent = message || '';
    el.className = `jobber-status${tone ? ` ${tone}` : ''}`;
  }

  function clearJobberChoices() {
    const box = $('jobberChoices');
    box.innerHTML = '';
    box.hidden = true;
  }

  function resetJobberResult() {
    currentJobberSelection = null;
    currentJobberQuoteUrl = '';
    $('openJobberQuoteBtn').hidden = true;
    $('sendJobberBtn').hidden = false;
    $('sendJobberBtn').disabled = false;
    $('sendJobberBtn').textContent = 'Send to Jobber';
    clearJobberChoices();
  }

  async function refreshJobberStatus() {
    if (!navigator.onLine) {
      setJobberStatus('Offline. Build the estimate now and send it to Jobber when this device is back online.', 'warn');
      return;
    }
    if (!jobberDeviceToken()) {
      setJobberStatus('Jobber is ready for setup. Tap Send to Jobber to pair this device.', 'muted');
      return;
    }
    try {
      const status = await jobberFetch('/api/jobber/status', { method:'GET' }, false);
      if (status.connected) setJobberStatus(`Connected to Jobber${status.account?.name ? ` • ${status.account.name}` : ''}.`, 'good');
      else setJobberStatus('Jobber authorization is required. Tap Send to Jobber to connect.', 'warn');
    } catch (err) {
      if (/paired/i.test(err.message)) setJobberStatus('Tap Send to Jobber to pair this device.', 'muted');
      else setJobberStatus(err.message, 'warn');
    }
  }

  async function ensureJobberConnection() {
    let token = String(jobberDeviceToken() || '').trim();
    if (!token) {
      token = await pairJobberDevice();
      if (!token) return false;
    }

    let status;
    try {
      status = await jobberFetch('/api/jobber/status', { method:'GET' }, false, token);
    } catch (err) {
      if (/pair|expired|missing/i.test(err.message || '')) {
        token = await pairJobberDevice();
        if (!token) return false;
        status = await jobberFetch('/api/jobber/status', { method:'GET' }, false, token);
      } else {
        throw err;
      }
    }

    if (status.connected) return true;

    setJobberStatus('Device paired. Opening Jobber authorization…', 'good');
    const auth = await jobberFetch('/api/jobber/connect-url', {
      method:'POST',
      body:JSON.stringify({ returnTo: `${window.location.origin}${window.location.pathname}` })
    }, false, token);
    if (!auth.url) throw new Error('Jobber did not return an authorization link.');
    window.location.href = auth.url;
    return false;
  }

  function customerMatchInput() {
    return {
      name: $('customerName').value.trim(),
      address: $('projectAddress').value.trim(),
      phone: $('customerPhone').value.trim(),
      email: $('customerEmail').value.trim()
    };
  }

  function propertyLabel(property) {
    return property.formattedAddress || [property.address?.street1, property.address?.city, property.address?.province, property.address?.postalCode].filter(Boolean).join(', ') || 'Property address not available';
  }

  function renderClientChoices(matches, q) {
    const box = $('jobberChoices');
    box.hidden = false;
    box.innerHTML = `<div class="jobber-choice-head"><b>Select the Jobber client</b><span>TITUS found more than one possible match. Choose the correct customer.</span></div>` + matches.map((match, i) => {
      const property = match.properties?.[0];
      const contact = [match.email, match.phone].filter(Boolean).join(' • ');
      return `<button class="jobber-choice-btn" type="button" data-client-index="${i}"><strong>${escapeHtml(match.name || 'Unnamed client')}</strong><span>${escapeHtml(contact || 'No email / phone')}</span><small>${escapeHtml(property ? propertyLabel(property) : 'No service property found')}</small></button>`;
    }).join('');
    box.querySelectorAll('[data-client-index]').forEach(btn => btn.addEventListener('click', () => {
      const client = matches[Number(btn.dataset.clientIndex)];
      if (!client.properties?.length) {
        setJobberStatus('That Jobber client does not have a service property. Add the property in Jobber, then try again.', 'warn');
        return;
      }
      if (client.properties.length === 1) createDraftJobberQuote(client.id, client.properties[0].id, q);
      else renderPropertyChoices(client, client.properties, q);
    }));
  }

  function renderPropertyChoices(client, properties, q) {
    const box = $('jobberChoices');
    box.hidden = false;
    box.innerHTML = `<div class="jobber-choice-head"><b>Select the service property</b><span>${escapeHtml(client.name || 'Customer')} has more than one property in Jobber.</span></div>` + properties.map((property, i) =>
      `<button class="jobber-choice-btn" type="button" data-property-index="${i}"><strong>${escapeHtml(propertyLabel(property))}</strong><span>${escapeHtml(property.name || 'Service property')}</span></button>`
    ).join('');
    box.querySelectorAll('[data-property-index]').forEach(btn => btn.addEventListener('click', () => {
      const property = properties[Number(btn.dataset.propertyIndex)];
      createDraftJobberQuote(client.id, property.id, q);
    }));
  }

  async function createDraftJobberQuote(clientId, propertyId, q) {
    clearJobberChoices();
    currentJobberSelection = { clientId, propertyId };
    const payload = jobberPayload(q);
    $('sendJobberBtn').disabled = true;
    $('sendJobberBtn').textContent = 'Creating draft…';
    setJobberStatus('Creating the draft quote in Jobber…', 'muted');
    try {
      const result = await jobberFetch('/api/jobber/quote', {
        method:'POST',
        body:JSON.stringify({ clientId, propertyId, ...payload })
      });
      const quote = result.quote;
      currentJobberQuoteUrl = quote.jobberWebUri || '';
      $('sendJobberBtn').hidden = true;
      $('openJobberQuoteBtn').hidden = !currentJobberQuoteUrl;
      $('openJobberQuoteBtn').textContent = quote.quoteNumber ? `Open Jobber Quote #${quote.quoteNumber}` : 'Open Draft Quote in Jobber';
      if (quote.totalMismatch) {
        setJobberStatus(`Draft created, but Jobber totals ${money.format(quote.amounts?.total || 0)} while TITUS is ${money.format(quote.expectedTotal)}. Review tax/settings before sending.`, 'warn');
      } else {
        setJobberStatus(`${result.duplicatePrevented ? 'Existing draft reused' : 'Draft created'}${quote.quoteNumber ? ` • Quote #${quote.quoteNumber}` : ''}. Review it in Jobber before sending to the customer.`, 'good');
      }
    } catch (err) {
      $('sendJobberBtn').hidden = false;
      $('sendJobberBtn').disabled = false;
      $('sendJobberBtn').textContent = 'Send to Jobber';
      setJobberStatus(err.message, 'warn');
    }
  }

  async function sendToJobber() {
    const q = calculate();
    resetJobberResult();
    if (!navigator.onLine) {
      setJobberStatus('This device is offline. TITUS can keep estimating, but Jobber requires internet.', 'warn');
      return;
    }
    if (q.finalPrice <= 0 || !buildJobberLines(q).length) {
      setJobberStatus('Build the project scope and price before sending it to Jobber.', 'warn');
      return;
    }
    const customer = customerMatchInput();
    if (!customer.name && !customer.email && !customer.phone) {
      setJobberStatus('Enter the customer name, phone, or email first so TITUS can find the correct Jobber client.', 'warn');
      return;
    }
    $('sendJobberBtn').disabled = true;
    $('sendJobberBtn').textContent = 'Finding client…';
    setJobberStatus('Checking the existing Jobber client and service property…', 'muted');
    try {
      const connected = await ensureJobberConnection();
      if (!connected) return;
      const match = await jobberFetch('/api/jobber/match', { method:'POST', body:JSON.stringify(customer) });
      $('sendJobberBtn').disabled = false;
      $('sendJobberBtn').textContent = 'Send to Jobber';
      if (match.status === 'not_found') {
        setJobberStatus('No matching Jobber client was found. Nothing was created. Verify/create the client in Jobber, then try again.', 'warn');
      } else if (match.status === 'no_property') {
        setJobberStatus(`Found ${match.client?.name || 'the client'}, but no service property. Add the property in Jobber, then try again.`, 'warn');
      } else if (match.status === 'choose_client') {
        setJobberStatus('Choose the correct Jobber customer below.', 'muted');
        renderClientChoices(match.matches || [], q);
      } else if (match.status === 'choose_property') {
        setJobberStatus('Choose the correct Jobber service property below.', 'muted');
        renderPropertyChoices(match.client, match.properties || [], q);
      } else if (match.status === 'matched') {
        await createDraftJobberQuote(match.client.id, match.property.id, q);
      } else {
        setJobberStatus('TITUS could not safely identify the Jobber customer. Nothing was created.', 'warn');
      }
    } catch (err) {
      $('sendJobberBtn').disabled = false;
      $('sendJobberBtn').textContent = 'Send to Jobber';
      setJobberStatus(err.message, 'warn');
    }
  }

  function openJobberQuote() {
    if (!currentJobberQuoteUrl) return;
    window.open(currentJobberQuoteUrl, '_blank', 'noopener');
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  }

  function handleBundleDiscountChange() {
    const select = $('bundleDiscount');
    const requested = Number(select.value) || 0;
    const previous = select.dataset.lastApproved || '0';
    if (requested > RULES.standardBundleDiscountMax) {
      const approved = window.confirm(`${Math.round(requested * 100)}% discount requires manager approval. Has a manager approved this discount?`);
      if (!approved) {
        select.value = previous;
        render();
        return;
      }
    }
    select.dataset.lastApproved = select.value;
    render();
  }

  function showScreen(name) {
    const customerMode = name === 'customer';
    document.body.classList.toggle('customer-mode', customerMode);
    document.querySelectorAll('.screen').forEach(el => el.classList.toggle('active', el.id === `screen-${name}`));
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.screen === name));
    $('customerNavLabel').textContent = customerMode ? 'Exit Customer View' : 'Customer';
    if (customerMode) renderCustomerView(calculate());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function updateConnection() {
    const badge = $('connectionBadge');
    if (navigator.onLine) {
      badge.textContent = 'Online • Offline ready';
      badge.className = 'status-badge online';
    } else {
      badge.textContent = 'Offline • TITUS ready';
      badge.className = 'status-badge offline';
    }
  }

  quoteIds.forEach(id => {
    const el = $(id);
    if (el.tagName === 'SELECT') el.addEventListener('change', id === 'bundleDiscount' ? handleBundleDiscountChange : render);
    else el.addEventListener('input', render);
  });
  document.querySelectorAll('input[type="number"]').forEach(input => {
    input.addEventListener('focus', () => { if (input.value === '0') input.value = ''; });
  });
  projectIds.forEach(id => $(id).addEventListener('input', saveState));
  $('newQuoteBtn').addEventListener('click', resetQuote);
  $('reviewQuoteBtn').addEventListener('click', openSummary);
  $('closeSummaryBtn').addEventListener('click', closeSummary);
  $('doneSummaryBtn').addEventListener('click', closeSummary);
  $('copySummaryBtn').addEventListener('click', copySummary);
  $('sendJobberBtn').addEventListener('click', sendToJobber);
  $('openJobberQuoteBtn').addEventListener('click', openJobberQuote);
  $('quoteSummaryDialog').addEventListener('click', (event) => { if (event.target === $('quoteSummaryDialog')) closeSummary(); });
  document.querySelectorAll('.discount-btn').forEach(btn => btn.addEventListener('click', () => {
    $('bundleDiscount').value = btn.dataset.discount;
    handleBundleDiscountChange();
  }));
  document.querySelectorAll('.story-btn').forEach(btn => btn.addEventListener('click', () => {
    $('houseStories').value = btn.dataset.story;
    render();
  }));
  document.querySelectorAll('.nav-btn').forEach(btn => btn.addEventListener('click', () => {
    if (btn.dataset.screen === 'customer' && document.body.classList.contains('customer-mode')) {
      const exit = window.confirm('Exit customer view and return to the internal quote screen?');
      if (exit) showScreen('quote');
      return;
    }
    showScreen(btn.dataset.screen);
  }));
  window.addEventListener('online', updateConnection);
  window.addEventListener('offline', updateConnection);

  loadState();
  $('bundleDiscount').dataset.lastApproved = $('bundleDiscount').value || '0';
  render();
  updateConnection();

  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('jobber') === 'connected') {
      window.history.replaceState({}, document.title, window.location.pathname);
      setTimeout(() => {
        openSummary();
        setJobberStatus('Jobber connected. Continuing with this estimate…', 'good');
        setTimeout(() => sendToJobber(), 350);
      }, 250);
    } else if (params.get('jobber') === 'error') {
      const detail = params.get('message') || 'Jobber connection did not finish. Please try again.';
      window.history.replaceState({}, document.title, window.location.pathname);
      setTimeout(() => {
        openSummary();
        setJobberStatus(detail, 'warn');
      }, 250);
    }
  } catch (_) {}

  if ('serviceWorker' in navigator) {
    let refreshedForSW = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshedForSW) return;
      refreshedForSW = true;
      window.location.reload();
    });
    window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js?v=1.8.6').then(reg => reg.update()).catch(() => {}));
  }
})();
