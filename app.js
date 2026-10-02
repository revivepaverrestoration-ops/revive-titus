(() => {
  'use strict';
  const { RULES, calculate: priceQuote } = window.TitusPricing;
  const ids = ['frontSqft','backSqft','bundleDiscount','jointToneSqft','colorRevivalSqft','restoreBundleSqft','accentBorderFlat','customBorderLf','spotBlendFlat','designerAccentFlat','metallicVeilFlat'];
  const $ = (id) => document.getElementById(id);
  const money = new Intl.NumberFormat('en-US', { style:'currency', currency:'USD', maximumFractionDigits:0 });
  const rateFmt = new Intl.NumberFormat('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 });
  function calculate() {
    const input = {};
    ids.forEach(id => input[id] = $(id).value);
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
    $('totalArea').textContent = `${Math.round(q.totalArea).toLocaleString()} sq ft`;
    $('effectiveRate').textContent = q.effectiveRate ? `$${rateFmt.format(q.effectiveRate)}` : '—';
    $('minimumNote').textContent = q.calculated < RULES.minimum ? '$1,199 company minimum applied' : 'Calculated project price';
    $('posArea').textContent = `${Math.round(q.totalArea).toLocaleString()} sq ft`;
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
      ids.forEach(id => state[id] = $(id).value);
      localStorage.setItem('revive-titus-v1', JSON.stringify(state));
    } catch (_) {}
  }

  function loadState() {
    try {
      const state = JSON.parse(localStorage.getItem('revive-titus-v1') || '{}');
      ids.forEach(id => { if (state[id] !== undefined) $(id).value = state[id]; });
    } catch (_) {}
  }

  function resetQuote() {
    const ok = window.confirm('Start a new quote? This clears the current measurements and upgrades on this iPad.');
    if (!ok) return;
    ids.forEach(id => $(id).value = id === 'bundleDiscount' ? '0' : '0');
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

  ids.forEach(id => $(id).addEventListener('input', render));
  $('newQuoteBtn').addEventListener('click', resetQuote);
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
