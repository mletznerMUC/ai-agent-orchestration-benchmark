/**
 * The published rubric arithmetic, shared with the weighting engine in
 * index.html and index.en.html.
 *
 * The block between the wt-formula markers is byte-identical in all three
 * places and scripts/panel.test.mjs proves it. That is why it is indented
 * two spaces here and written in plain shared syntax: no export, no module
 * scope, no DOM, nothing the pages cannot also run.
 */
  /* wt-formula:begin */
  /* The visitor's weighting, normalised to 100 and rounded once, half-up, on
     the total only — full precision throughout (ADR-006). A dimension with no
     tier-A evidence yields no total at any weighting, including weight 0:
     ADR-005 makes missing evidence a finding, not a zero. */
  function wtSum(weights) {
    var keys = Object.keys(weights);
    var sum = 0;
    for (var i = 0; i < keys.length; i++) sum += weights[keys[i]];
    return sum;
  }

  function wtTotal(weights, dims) {
    var keys = Object.keys(weights);
    var sum = wtSum(weights);
    if (sum === 0) return null;
    var total = 0;
    for (var i = 0; i < keys.length; i++) {
      var dim = dims[keys[i]];
      if (!dim || dim.raw === null) return null;
      total += ((100 * weights[keys[i]]) / sum) * (dim.raw / dim.max);
    }
    return Math.floor(total + 0.5);
  }
  /* wt-formula:end */

export { wtSum, wtTotal };
