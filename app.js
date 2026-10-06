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
  const projectIds = ['customerName','projectAddress','estimatorName','quoteDate'];
  const selectDefaults = {
    bundleDiscount: '0', houseStories: '1', poolCageTier: '0', oneTimePoolClean: '0', exteriorPackage: '0'
  };
  const $ = (id) => document.getElementById(id);
  const money = new Intl.NumberFormat('en-US', { style:'currency', currency:'USD', maximumFractionDigits:0 });
  const rateFmt = new Intl.NumberFormat('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 });
  const numberFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits:0 });

  function syncStoryButtons() {
    const selected = String($('houseStories').value || '1');
    document.querySelectorAll('.story-btn').forEach(btn => {
      const active = btn.dataset.story === selected;
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
    syncStoryButtons();
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

  function saveState() {
    try {
      const state = {};
      [...quoteIds, ...projectIds].forEach(id => state[id] = $(id).value);
      localStorage.setItem('revive-titus-v1-5', JSON.stringify(state));
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
      const state = JSON.parse(localStorage.getItem('revive-titus-v1-5') || '{}');
      quoteIds.forEach(id => {
        const value = state[id] !== undefined ? state[id]
          : (v14[id] !== undefined ? v14[id]
          : (v13[id] !== undefined ? v13[id]
          : (v12[id] !== undefined ? v12[id]
          : (v11[id] !== undefined ? v11[id] : legacy[id]))));
        if (value !== undefined) {
          if (selectDefaults[id] !== undefined) $(id).value = String(value || selectDefaults[id]);
          else $(id).value = Number(value) === 0 ? '' : value;
        }
      });
      projectIds.forEach(id => {
        const value = state[id] !== undefined ? state[id] : (v14[id] !== undefined ? v14[id] : (v13[id] !== undefined ? v13[id] : v12[id]));
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
    $('estimatorName').value = estimator;
    $('quoteDate').value = todayISO();
    try {
      ['revive-titus-v1','revive-titus-v1-1','revive-titus-v1-2','revive-titus-v1-3','revive-titus-v1-4','revive-titus-v1-5'].forEach(k => localStorage.removeItem(k));
    } catch (_) {}
    render();
    $('customerName').focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function projectMetaHtml() {
    const customer = $('customerName').value.trim() || 'Customer not entered';
    const address = $('projectAddress').value.trim() || 'Address not entered';
    const estimator = $('estimatorName').value.trim() || 'Estimator not entered';
    const date = $('quoteDate').value || todayISO();
    return `
      <div><span>Customer</span><strong>${escapeHtml(customer)}</strong></div>
      <div><span>Address</span><strong>${escapeHtml(address)}</strong></div>
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
    const estimator = $('estimatorName').value.trim() || 'Not entered';
    const date = $('quoteDate').value || todayISO();
    const lines = [
      'REVIVE TITUS QUOTE SUMMARY',
      `Customer: ${customer}`,
      `Address: ${address}`,
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
    document.querySelectorAll('.screen').forEach(el => el.classList.toggle('active', el.id === `screen-${name}`));
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.screen === name));
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
  $('quoteSummaryDialog').addEventListener('click', (event) => { if (event.target === $('quoteSummaryDialog')) closeSummary(); });
  document.querySelectorAll('.story-btn').forEach(btn => btn.addEventListener('click', () => {
    $('houseStories').value = btn.dataset.story;
    render();
  }));
  document.querySelectorAll('.nav-btn').forEach(btn => btn.addEventListener('click', () => showScreen(btn.dataset.screen)));
  window.addEventListener('online', updateConnection);
  window.addEventListener('offline', updateConnection);

  loadState();
  $('bundleDiscount').dataset.lastApproved = $('bundleDiscount').value || '0';
  render();
  updateConnection();

  if ('serviceWorker' in navigator) {
    let refreshedForSW = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshedForSW) return;
      refreshedForSW = true;
      window.location.reload();
    });
    window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').then(reg => reg.update()).catch(() => {}));
  }
})();
