export type FeatureMode = 'real' | 'simple' | 'mock' | 'concept' | 'off';
export type FeatureId = `F-${string}`;

export const featureModes: Record<FeatureId, FeatureMode> = Object.fromEntries(
  Array.from({ length: 40 }, (_, i) => [`F-${String(i + 1).padStart(2, '0')}`, 'mock' as FeatureMode]),
);
// Official spec §1.2: never mock successful external registration or support links.
featureModes['F-18'] = 'off';
featureModes['F-31'] = 'off';
featureModes['F-11'] = 'off';
for (const id of ['F-37', 'F-38', 'F-39'] as FeatureId[]) featureModes[id] = 'concept';
featureModes['F-26'] = 'real';
featureModes['F-35'] = 'real';
export function getFeatureMode(id: FeatureId): FeatureMode { return featureModes[id] ?? 'off'; }
export const features = featureModes;
