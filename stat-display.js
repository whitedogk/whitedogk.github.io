const observed = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const ratio = (numerator, denominator, digits, leadingDot = false) => {
  if (!observed(numerator) || !observed(denominator) || denominator === 0) return '—';
  const value = (numerator / denominator).toFixed(digits);
  return leadingDot ? value.replace(/^0\./, '.') : value;
};

export const formatInnings = outs =>
  Number.isInteger(outs) && outs >= 0 ? `${Math.floor(outs / 3)}.${outs % 3}` : '—';

export function displayStats(kind, stats = {}) {
  const s = {...stats};
  if (kind === 'pitching') {
    s.ERA = ratio(s.er * 27, s.outs, 2);
    s.WHIP = ratio((s.hits + s.bb) * 3, s.outs, 2);
    s['K/9'] = ratio(s.so * 27, s.outs, 2);
    s['BB/9'] = ratio(s.bb * 27, s.outs, 2);
    s['K/BB'] = ratio(s.so, s.bb, 2);
    s['HR/9'] = ratio(s.hr * 27, s.outs, 2);
    return s;
  }
  if (kind === 'batting') {
    const onBase = s.hits + s.bb + s.hbp;
    const obpDenominator = s.ab + s.bb + s.hbp + s.sf;
    const avg = observed(s.hits) && observed(s.ab) && s.ab > 0 ? s.hits / s.ab : null;
    const obp = observed(onBase) && observed(obpDenominator) && obpDenominator > 0 ? onBase / obpDenominator : null;
    const slg = observed(s.tb) && observed(s.ab) && s.ab > 0 ? s.tb / s.ab : null;
    s.AVG = ratio(s.hits, s.ab, 3, true);
    s.OBP = ratio(onBase, obpDenominator, 3, true);
    s.SLG = ratio(s.tb, s.ab, 3, true);
    s.OPS = obp === null || slg === null ? '—' : (obp + slg).toFixed(3).replace(/^0\./, '.');
    s.ISO = slg === null || avg === null ? '—' : (slg - avg).toFixed(3).replace(/^0\./, '.');
    s.IsoD = obp === null || avg === null ? '—' : (obp - avg).toFixed(3).replace(/^0\./, '.');
    s['BB/K'] = ratio(s.bb, s.so, 2);
  }
  return s;
}

export function sumObservedStats(rows) {
  if (!rows.length) return {};
  const keys = new Set(rows.flatMap(row => Object.keys(row)));
  return Object.fromEntries([...keys].filter(key => rows.every(row => observed(row[key])))
    .map(key => [key, rows.reduce((sum, row) => sum + row[key], 0)]));
}
