(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TitusPricing = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  const RULES = Object.freeze({
    frontRate: 1.50,
    backRate: 2.00,
    paverMinimum: 1199,
    jointToneRate: 0.40,
    colorRevivalRate: 0.60,
    restoreBundleRate: 0.80,
    accentBorderRate: 5.50,
    accentBorderMinimum: 395,
    edgeRestraintRate: 10.00,
    edgeRestraintMinimum: 299,
    standardBundleDiscountMax: 0.10,
    maxBundleDiscount: 0.20,

    // Exterior cleaning field guide pricing.
    // These are TITUS starting guides, not fixed Jobber catalog prices.
    houseWashTiers: [
      [1500, 249],
      [2000, 299],
      [2500, 349],
      [3000, 399],
      [3500, 449],
      [4000, 499],
      [4500, 599],
      [5000, 699]
    ],
    houseStoryTwoAdd: 75,
    houseStoryThreeAdd: 150,
    roofWashRate: 0.45,
    roofWashMinimum: 1200,
    drivewayCleaningRate: 0.20,
    drivewayCleaningMinimum: 149,
    sidewalkCurbRate: 0.20,
    sidewalkCurbMinimum: 99,
    poolDeckCleaningRate: 0.25,
    poolDeckCleaningMinimum: 149,
    poolCageStandard: 299,
    poolCageLarge: 399,
    gutterInteriorRate: 1.00,
    gutterInteriorMinimum: 149,
    oneTimePoolClean: 150,

    entryRefreshPackage: 249,
    curbAppealPackage: 449,
    outdoorLivingPackage: 349,
    wholePropertyPackage: 849
  });

  const nonneg = (v) => Math.max(0, Number(v) || 0);
  const serviceWithMinimum = (qty, rate, minimum) => qty > 0 ? Math.max(qty * rate, minimum) : 0;

  function houseWashTierPrice(sqft) {
    if (sqft <= 0) return 0;
    for (const [maxSqft, price] of RULES.houseWashTiers) {
      if (sqft <= maxSqft) return price;
    }
    // Over 5,000 sq ft stays at the top tier until a field adjustment is entered.
    // UI flags these projects for manager/custom pricing review.
    return RULES.houseWashTiers[RULES.houseWashTiers.length - 1][1];
  }

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
    const hasPaverBase = front > 0 || back > 0;
    const paverBaseFinal = hasPaverBase ? Math.max(baseAfterDiscount, RULES.paverMinimum) : 0;
    const paverMinimumAdjustment = Math.max(0, paverBaseFinal - baseAfterDiscount);

    const paverUpgrades =
      nonneg(input.jointToneSqft) * RULES.jointToneRate +
      nonneg(input.colorRevivalSqft) * RULES.colorRevivalRate +
      nonneg(input.restoreBundleSqft) * RULES.restoreBundleRate +
      serviceWithMinimum(nonneg(input.accentBorderLf), RULES.accentBorderRate, RULES.accentBorderMinimum) +
      nonneg(input.spotBlendFlat) +
      nonneg(input.metallicVeilFlat) +
      nonneg(input.paverRepairFlat) +
      serviceWithMinimum(nonneg(input.edgeRestraintLf), RULES.edgeRestraintRate, RULES.edgeRestraintMinimum);

    // Exterior / property services.
    const houseSqft = nonneg(input.houseWashSqft);
    const houseStories = Math.max(1, Math.round(nonneg(input.houseStories) || 1));
    const houseBase = houseWashTierPrice(houseSqft);
    const houseStoryAdd = houseSqft > 0 ? (houseStories >= 3 ? RULES.houseStoryThreeAdd : houseStories === 2 ? RULES.houseStoryTwoAdd : 0) : 0;
    const houseAdjustment = nonneg(input.houseWashAdjustmentFlat);
    const houseWash = houseSqft > 0 ? houseBase + houseStoryAdd + houseAdjustment : 0;

    const roofSqft = nonneg(input.roofWashSqft);
    const roofBase = serviceWithMinimum(roofSqft, RULES.roofWashRate, RULES.roofWashMinimum);
    const roofAdjustment = nonneg(input.roofWashAdjustmentFlat);
    const roofWash = roofSqft > 0 ? roofBase + roofAdjustment : 0;

    const drivewayCleaningSqft = nonneg(input.drivewayCleaningSqft);
    const drivewayCleaning = serviceWithMinimum(drivewayCleaningSqft, RULES.drivewayCleaningRate, RULES.drivewayCleaningMinimum);

    const sidewalkCurbSqft = nonneg(input.sidewalkCurbSqft);
    const sidewalkCurbCleaning = serviceWithMinimum(sidewalkCurbSqft, RULES.sidewalkCurbRate, RULES.sidewalkCurbMinimum);

    const poolDeckCleaningSqft = nonneg(input.poolDeckCleaningSqft);
    const poolDeckCleaning = serviceWithMinimum(poolDeckCleaningSqft, RULES.poolDeckCleaningRate, RULES.poolDeckCleaningMinimum);

    const poolCagePrice = nonneg(input.poolCageTier);
    const gutterInteriorLf = nonneg(input.gutterInteriorLf);
    const gutterInteriorCleaning = serviceWithMinimum(gutterInteriorLf, RULES.gutterInteriorRate, RULES.gutterInteriorMinimum);

    const fixedExterior =
      nonneg(input.frontPorchEntryFlat) +
      nonneg(input.exteriorGutterBrighteningFlat) +
      nonneg(input.fenceCleaningFlat) +
      nonneg(input.fenceStainingFlat) +
      nonneg(input.concreteCleaningSealingFlat) +
      nonneg(input.rustTreatmentFlat) +
      nonneg(input.efflorescenceTreatmentFlat) +
      nonneg(input.oilGreaseTreatmentFlat) +
      nonneg(input.frenchDrainCleanoutFlat) +
      nonneg(input.customAdditionalWorkFlat);

    const oneTimePoolClean = nonneg(input.oneTimePoolClean);
    const packagePrice = nonneg(input.exteriorPackage);
    const customPackageFlat = nonneg(input.customPackageFlat);

    const exteriorServices =
      houseWash + roofWash + drivewayCleaning + sidewalkCurbCleaning +
      poolDeckCleaning + poolCagePrice + gutterInteriorCleaning + fixedExterior +
      oneTimePoolClean + packagePrice + customPackageFlat;

    const paverProjectTotal = paverBaseFinal + paverUpgrades;
    const calculated = paverProjectTotal + exteriorServices;
    const finalPrice = calculated;
    const totalArea = front + back;
    const effectiveRate = totalArea > 0 ? paverProjectTotal / totalArea : null;

    return {
      front, back, totalArea, bundleDiscount,
      frontSubtotal, backSubtotal, baseSubtotal, discountAmount, baseAfterDiscount,
      hasPaverBase, paverBaseFinal, paverMinimumAdjustment, paverUpgrades, paverProjectTotal,
      houseSqft, houseStories, houseBase, houseStoryAdd, houseAdjustment, houseWash,
      roofSqft, roofBase, roofAdjustment, roofWash,
      drivewayCleaningSqft, drivewayCleaning,
      sidewalkCurbSqft, sidewalkCurbCleaning,
      poolDeckCleaningSqft, poolDeckCleaning,
      poolCagePrice,
      gutterInteriorLf, gutterInteriorCleaning,
      fixedExterior, oneTimePoolClean, packagePrice, customPackageFlat,
      exteriorServices, calculated, finalPrice, effectiveRate,
      houseNeedsCustomReview: houseSqft > 5000
    };
  }

  return { RULES, calculate, houseWashTierPrice };
});
