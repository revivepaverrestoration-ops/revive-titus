(() => {
  'use strict';
  const { RULES, calculate: priceQuote } = window.TitusPricing;
  const quoteIds = ['frontSqft','backSqft','bundleDiscount','jointToneSqft','colorRevivalSqft','restoreBundleSqft','accentBorderFlat','customBorderLf','spotBlendFlat','designerAccentFlat','metallicVeilFlat'];
  const projectIds = ['customerName','projectAddress','estimatorName','quoteDate'];
  const $ = (id) => document.getElementById(id);
  const money = new Intl.NumberFormat('en-US', { style:'currency', currency:'USD', maximumFractionDigits:0 });
  const rateFmt = new Intl.NumberFormat('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 });
  const numberFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits:0 });

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
    $('baseAfterDiscount').textContent = money.format(q.baseAfterDiscount);
    $('upgradeSubtotal').textContent = money.format(q.upgrades);
    $('calculatedTotal').textContent = money.format(q.calculated);
    $('finalPrice').textContent = money.format(q.finalPrice);
    $('totalArea').textContent = `${numberFmt.format(q.totalArea)} sq ft`;
    $('effectiveRate').textContent = q.effectiveRate ? `$${rateFmt.format(q.effectiveRate)}` : '—';
    $('minimumNote').textContent = q.calculated < RULES.minimum ? '$1,199 company minimum applied' : 'Calculated project price';
    $('posArea').textContent = `${numberFmt.format(q.totalArea)} sq ft`;
    $('posBase').textContent = money.format(q.baseAfterDiscount);
    $('posConfigured').textContent = money.format(q.finalPrice);
    renderPositioning(q);
    saveState();
  }

  function renderPositioning(q) {
    const low = q.totalArea * 1;
    const premium = q.totalArea * 3;
    const high = q.totalArea * 3.5;
    const reviveBaseRate = q.totalArea > 0 ? q.baseAfterDiscount / q.totalArea : 0;
    const cards = [
      ['Illustrative', 'Low-price / basic-service example', '$1.00 / sf', low, 'Scope may be different. Verify preparation, joint work, sealer, warranty, aftercare, and credentials.', false],
      ['Revive', 'Base professional service', q.totalArea ? `$${rateFmt.format(reviveBaseRate)} / sf` : '—', q.baseAfterDiscount, 'Owner-confirmed base rates with any approved bundle discount.', true],
      ['Revive', 'Project as configured', 'With selected upgrades', q.finalPrice, 'Includes the specialty restoration work selected on the quote.', true],
      ['Illustrative', 'Premium-priced example', '$3.00 / sf', premium, 'Illustrative comparison only — not a competitor quote.', false],
      ['Illustrative', 'Higher premium-priced example', '$3.50 / sf', high, 'Illustrative comparison only — not a competitor quote.', false]
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
      localStorage.setItem('revive-titus-v1-1', JSON.stringify(state));
      if ($('estimatorName').value.trim()) localStorage.setItem('revive-titus-estimator', $('estimatorName').value.trim());
    } catch (_) {}
  }

  function loadState() {
    try {
      const legacy = JSON.parse(localStorage.getItem('revive-titus-v1') || '{}');
      const state = JSON.parse(localStorage.getItem('revive-titus-v1-1') || '{}');
      quoteIds.forEach(id => {
        const value = state[id] !== undefined ? state[id] : legacy[id];
        if (value !== undefined) $(id).value = value;
      });
      projectIds.forEach(id => { if (state[id] !== undefined) $(id).value = state[id]; });
      if (!$('estimatorName').value) $('estimatorName').value = localStorage.getItem('revive-titus-estimator') || '';
    } catch (_) {}
    if (!$('quoteDate').value) $('quoteDate').value = todayISO();
  }

  function resetQuote() {
    const ok = window.confirm('Start a new quote? This clears the current customer, measurements, upgrades, and discount on this iPad.');
    if (!ok) return;
    const estimator = $('estimatorName').value.trim();
    quoteIds.forEach(id => $(id).value = '0');
    $('customerName').value = '';
    $('projectAddress').value = '';
    $('estimatorName').value = estimator;
    $('quoteDate').value = todayISO();
    try { localStorage.removeItem('revive-titus-v1'); } catch (_) {}
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

  function selectedUpgrades() {
    const vals = {
      'Joint tone enhancement': [Number($('jointToneSqft').value)||0, 'sq ft'],
      'Color revival': [Number($('colorRevivalSqft').value)||0, 'sq ft'],
      'Restore bundle': [Number($('restoreBundleSqft').value)||0, 'sq ft'],
      'Accent border pop': [Number($('accentBorderFlat').value)||0, '$'],
      'Custom border': [Number($('customBorderLf').value)||0, 'lf'],
      'Spot blend / problem areas': [Number($('spotBlendFlat').value)||0, '$'],
      'Designer accent finish': [Number($('designerAccentFlat').value)||0, '$'],
      'Full metallic veil': [Number($('metallicVeilFlat').value)||0, '$']
    };
    return Object.entries(vals).filter(([,v]) => v[0] > 0);
  }

  function summaryLinesHtml(q) {
    const lines = [];
    if (q.front > 0) lines.push(['Front driveway / walkway', `${numberFmt.format(q.front)} sq ft`, money.format(q.frontSubtotal)]);
    if (q.back > 0) lines.push(['Lanai / back area', `${numberFmt.format(q.back)} sq ft`, money.format(q.backSubtotal)]);
    if (q.bundleDiscount > 0) lines.push(['Bundle discount', `${Math.round(q.bundleDiscount*100)}%`, `−${money.format(Math.abs(q.discountAmount))}`]);
    selectedUpgrades().forEach(([name,[value,unit]]) => {
      const qty = unit === '$' ? money.format(value) : `${numberFmt.format(value)} ${unit}`;
      lines.push([name, qty, 'Included']);
    });
    if (!lines.length) lines.push(['Project', 'No measurements entered', money.format(q.finalPrice)]);
    return lines.map(([name,qty,amount]) => `<div><span><b>${escapeHtml(name)}</b><small>${escapeHtml(qty)}</small></span><strong>${escapeHtml(amount)}</strong></div>`).join('');
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
      '',
      `Front driveway / walkway: ${numberFmt.format(q.front)} sq ft — ${money.format(q.frontSubtotal)}`,
      `Lanai / back area: ${numberFmt.format(q.back)} sq ft — ${money.format(q.backSubtotal)}`,
      `Bundle discount: ${Math.round(q.bundleDiscount*100)}% (${q.discountAmount === 0 ? '$0' : `-${money.format(Math.abs(q.discountAmount))}`})`,
      `Base service after discount: ${money.format(q.baseAfterDiscount)}`
    ];
    const upgrades = selectedUpgrades();
    if (upgrades.length) {
      lines.push('', 'Selected upgrades:');
      upgrades.forEach(([name,[value,unit]]) => lines.push(`- ${name}: ${unit === '$' ? money.format(value) : `${numberFmt.format(value)} ${unit}`}`));
      lines.push(`Upgrade subtotal: ${money.format(q.upgrades)}`);
    }
    lines.push('', `FINAL SELLING PRICE: ${money.format(q.finalPrice)}`);
    if (q.calculated < RULES.minimum) lines.push('Company minimum applied: $1,199');
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

  quoteIds.forEach(id => $(id).addEventListener('input', render));
  projectIds.forEach(id => $(id).addEventListener('input', saveState));
  $('newQuoteBtn').addEventListener('click', resetQuote);
  $('reviewQuoteBtn').addEventListener('click', openSummary);
  $('closeSummaryBtn').addEventListener('click', closeSummary);
  $('doneSummaryBtn').addEventListener('click', closeSummary);
  $('copySummaryBtn').addEventListener('click', copySummary);
  $('quoteSummaryDialog').addEventListener('click', (event) => { if (event.target === $('quoteSummaryDialog')) closeSummary(); });
  document.querySelectorAll('.nav-btn').forEach(btn => btn.addEventListener('click', () => showScreen(btn.dataset.screen)));
  window.addEventListener('online', updateConnection);
  window.addEventListener('offline', updateConnection);

  loadState();
  render();
  updateConnection();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(() => {}));
  }
})();
