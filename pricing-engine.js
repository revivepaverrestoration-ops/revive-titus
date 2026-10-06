(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TitusPricing = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const RULES = Object.freeze({
    frontRate: 1.50,
    backRate: 2.00,
    minimum: 1199,
    jointToneRate: 0.40,
    colorRevivalRate: 0.60,
    restoreBundleRate: 0.90,
    customBorderRate: 5.50,
    maxBundleDiscount: 0.10
  });
  const nonneg = (v) => Math.max(0, Number(v) || 0);
  function calculate(input) {
    const front = nonneg(input.frontSqft);
    const back = nonneg(input.backSqft);
    const requestedDiscount = nonneg(input.bundleDiscount);
    const bundleDiscount = (front > 0 && back > 0) ? Math.min(requestedDiscount, RULES.maxBundleDiscount) : 0;
    const frontSubtotal = front * RULES.frontRate;
    const backSubtotal = back * RULES.backRate;
    const baseSubtotal = frontSubtotal + backSubtotal;
    const discountAmount = -(baseSubtotal * bundleDiscount);
    const baseAfterDiscount = baseSubtotal + discountAmount;
    const upgrades =
      nonneg(input.jointToneSqft) * RULES.jointToneRate +
      nonneg(input.colorRevivalSqft) * RULES.colorRevivalRate +
      nonneg(input.restoreBundleSqft) * RULES.restoreBundleRate +
      nonneg(input.accentBorderFlat) +
      nonneg(input.customBorderLf) * RULES.customBorderRate +
      nonneg(input.spotBlendFlat) +
      nonneg(input.designerAccentFlat) +
      nonneg(input.metallicVeilFlat) +
      nonneg(input.frenchDrainCleanoutFlat) +
      nonneg(input.paverRepairFlat);
    const calculated = baseAfterDiscount + upgrades;
    const finalPrice = Math.max(calculated, RULES.minimum);
    const totalArea = front + back;
    const effectiveRate = totalArea > 0 ? finalPrice / totalArea : null;
    return { front, back, totalArea, bundleDiscount, frontSubtotal, backSubtotal, baseSubtotal, discountAmount, baseAfterDiscount, upgrades, calculated, finalPrice, effectiveRate };
  }
  return { RULES, calculate };
});
