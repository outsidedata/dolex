import { getGeoConfig, getSubdivisionRegions } from './geo-registry.js';
import type { GeoRegionConfig } from './geo-registry.js';
import { loadTopojson } from './topojson-loader.js';
import { resolveCountryName, getAllCountryNames } from './names/countries.js';
import { resolveSubdivisionName, getSubdivisionNames } from './names/subdivisions.js';
import { suggestMatch } from './names/fuzzy.js';
import type { FuzzySuggestion } from './names/fuzzy.js';

const US_INTENT_RE = /\b(us\b|u\.s\.|united states|by state|state map|american state)/i;

interface GeoHint {
  region?: string;
  level?: 'country' | 'subdivision';
}

const COLUMN_NAME_HINTS: [RegExp, GeoHint][] = [
  [/prefecture/i, { region: 'JP', level: 'subdivision' }],
  [/bundesland|land/i, { region: 'DE', level: 'subdivision' }],
  [/d[eé]partement/i, { region: 'FR', level: 'subdivision' }],
  [/provincia/i, { level: 'subdivision' }],
  [/estado/i, { level: 'subdivision' }],
  [/state|province|region|territory|oblast|canton/i, { level: 'subdivision' }],
  [/country|nation/i, { level: 'country' }],
];

const INTENT_REGION_PATTERNS: [RegExp, GeoHint][] = [
  [/\b(us|u\.s\.|united states|american)\b/i, { region: 'us', level: 'subdivision' }],
  [/\beurope(an)?\b|map of eu\b/i, { region: 'EU', level: 'country' }],
  [/\bchin(a|ese)\b.*\bprovinc/i, { region: 'CN', level: 'subdivision' }],
  [/\bjapan(ese)?\b.*\bprefecture/i, { region: 'JP', level: 'subdivision' }],
  [/\baustrali(a|an)\b.*\bstate/i, { region: 'AU', level: 'subdivision' }],
  [/\bindi(a|an)\b.*\bstate/i, { region: 'IN', level: 'subdivision' }],
  [/\bbrazil(ian)?\b.*\bstate/i, { region: 'BR', level: 'subdivision' }],
  [/\bcanad(a|ian)\b.*\bprovinc/i, { region: 'CA', level: 'subdivision' }],
  [/\bgerman\b.*\b(state|land)/i, { region: 'DE', level: 'subdivision' }],
  [/\bfrench\b.*\b(region|département)/i, { region: 'FR', level: 'subdivision' }],
  [/\bafric(a|an)\b/i, { region: 'AF', level: 'country' }],
  [/\bsouth america(n)?\b/i, { region: 'SA', level: 'country' }],
  [/\basia(n)?\b/i, { region: 'AS', level: 'country' }],
];

function matchHint(input: string | undefined, patterns: [RegExp, GeoHint][]): GeoHint | undefined {
  if (!input) return undefined;
  for (const [re, hint] of patterns) {
    if (re.test(input)) return hint;
  }
  return undefined;
}

export interface GeoScopeResult {
  scope: string;
  geoLevel?: 'country' | 'subdivision';
  confidence?: 'high' | 'medium' | 'low';
  matchedCount?: number;
  totalCount?: number;
  normalizedValues?: Map<string, string>;
  unmatchedValues?: string[];
  suggestions?: FuzzySuggestion[];
}

const CONTINENT_COUNTRIES: Record<string, Set<string>> = {
  EU: new Set(['AL','AD','AT','BY','BE','BA','BG','HR','CZ','DK','EE','FI','FR','DE','GR','HU','IS','IE','IT','XK','LV','LI','LT','LU','MT','MD','MC','ME','NL','MK','NO','PL','PT','RO','RU','SM','RS','SK','SI','ES','SE','CH','UA','GB','VA']),
  AF: new Set(['DZ','AO','BJ','BW','BF','BI','CM','CV','CF','TD','KM','CG','CD','DJ','EG','GQ','ER','SZ','ET','GA','GM','GH','GN','GW','CI','KE','LS','LR','LY','MG','MW','ML','MR','MU','MA','MZ','NA','NE','NG','RW','ST','SN','SC','SL','SO','ZA','SS','SD','TZ','TG','TN','UG','ZM','ZW']),
  AS: new Set(['AF','AM','AZ','BH','BD','BT','BN','KH','CN','CY','GE','IN','ID','IR','IQ','IL','JP','JO','KZ','KW','KG','LA','LB','MY','MV','MN','MM','NP','KP','OM','PK','PS','PH','QA','SA','SG','KR','LK','SY','TW','TJ','TH','TL','TR','TM','AE','UZ','VN','YE']),
  SA: new Set(['AR','BO','BR','CL','CO','EC','GY','PY','PE','SR','UY','VE']),
  NA: new Set(['AG','BS','BB','BZ','CA','CR','CU','DM','DO','SV','GD','GT','HT','HN','JM','MX','NI','PA','KN','LC','VC','TT','US']),
  OC: new Set(['AU','FJ','KI','MH','FM','NR','NZ','PW','PG','WS','SB','TO','TV','VU']),
};

function ratioToConfidence(ratio: number): 'high' | 'medium' | 'low' {
  if (ratio >= 0.9) return 'high';
  if (ratio >= 0.6) return 'medium';
  return 'low';
}

function collectSuggestions(unmatched: string[], candidates: string[]): FuzzySuggestion[] {
  const results: FuzzySuggestion[] = [];
  for (const val of unmatched) {
    const suggestion = suggestMatch(val, candidates);
    if (suggestion) results.push(suggestion);
  }
  return results;
}

export function detectGeoScope(
  values: string[],
  options?: string | { intent?: string; columnName?: string }
): GeoScopeResult {
  const intent = typeof options === 'string' ? options : options?.intent;
  const columnName = typeof options === 'string' ? undefined : options?.columnName;

  const nonEmpty = values?.filter((v) => v != null && v !== '');
  if (!nonEmpty?.length) {
    return { scope: 'world', geoLevel: 'country' };
  }

  const total = nonEmpty.length;

  const hint = matchHint(intent, INTENT_REGION_PATTERNS) ?? matchHint(columnName, COLUMN_NAME_HINTS);
  const hintedSubdivision = hint?.level === 'subdivision';
  const hintedCountry = hint?.level === 'country';
  const hintedRegion = hint?.region;

  // 1. Score against US states first (fast path, most common)
  let usMatchCount = 0;
  const abbreviationMap = new Map<string, string>();
  for (const val of nonEmpty) {
    const canonical = resolveSubdivisionName('US', val);
    if (canonical) {
      usMatchCount++;
      if (val.trim().length <= 2) {
        abbreviationMap.set(val, canonical);
      }
    }
  }

  const hasUsIntent = intent ? US_INTENT_RE.test(intent) : false;
  const usHinted = hasUsIntent || hintedRegion === 'us';
  const usMinRatio = usHinted ? 0.2 : 0.4;
  const usMinCount = usHinted ? 2 : 3;

  if (usMatchCount >= usMinCount && usMatchCount / total >= usMinRatio) {
    const usUnmatched = nonEmpty.filter(v => !resolveSubdivisionName('US', v));
    const usSuggestions = collectSuggestions(usUnmatched, getSubdivisionNames('US'));
    return {
      scope: 'us',
      geoLevel: 'subdivision',
      confidence: ratioToConfidence(usMatchCount / total),
      matchedCount: usMatchCount,
      totalCount: total,
      normalizedValues: abbreviationMap.size > 0 ? abbreviationMap : undefined,
      unmatchedValues: usUnmatched.length > 0 ? usUnmatched : undefined,
      suggestions: usSuggestions.length > 0 ? usSuggestions : undefined,
    };
  }

  // 2. Score against all subdivision regions
  const subdivisionRegions = getSubdivisionRegions().filter(r => r !== 'US');
  const subdivisionScores: Record<string, number> = {};

  for (const region of subdivisionRegions) {
    let matchCount = 0;
    for (const val of nonEmpty) {
      if (resolveSubdivisionName(region, val)) {
        matchCount++;
      }
    }
    const isHintedRegion = hintedRegion === region;
    const minCount = (hintedSubdivision || isHintedRegion) ? 1 : 3;
    const minCountAlt = (hintedSubdivision || isHintedRegion) ? 1 : 2;
    const minRatioAlt = (hintedSubdivision || isHintedRegion) ? 0.2 : 0.4;
    if (matchCount >= minCount || (matchCount >= minCountAlt && matchCount / total >= minRatioAlt)) {
      subdivisionScores[region] = matchCount;
    }
  }

  // If a specific region is hinted, prefer it over the highest scorer
  const subdivisionEntries = Object.entries(subdivisionScores).sort((a, b) => b[1] - a[1]);
  let bestSubdivision = subdivisionEntries[0];
  if (hintedRegion && subdivisionScores[hintedRegion] != null) {
    bestSubdivision = [hintedRegion, subdivisionScores[hintedRegion]];
  }

  const subdivMinRatio = hint ? 0.2 : 0.4;
  if (bestSubdivision && bestSubdivision[1] / total >= subdivMinRatio) {
    const [region, matchCount] = bestSubdivision;
    const subdivUnmatched = nonEmpty.filter(v => !resolveSubdivisionName(region, v));
    const subdivSuggestions = collectSuggestions(subdivUnmatched, getSubdivisionNames(region));
    return {
      scope: region,
      geoLevel: 'subdivision',
      confidence: ratioToConfidence(matchCount / total),
      matchedCount: matchCount,
      totalCount: total,
      unmatchedValues: subdivUnmatched.length > 0 ? subdivUnmatched : undefined,
      suggestions: subdivSuggestions.length > 0 ? subdivSuggestions : undefined,
    };
  }

  // 3. Score against country names
  let countryMatchCount = 0;
  const matchedCountryCodes = new Set<string>();
  const unmatchedValues: string[] = [];

  for (const val of nonEmpty) {
    const code = resolveCountryName(val);
    if (code) {
      countryMatchCount++;
      matchedCountryCodes.add(code);
    } else {
      unmatchedValues.push(val);
    }
  }

  const countryMinCount = hintedCountry ? 2 : 3;
  const countryMinRatio = hintedCountry ? 0.3 : 0.4;

  if (countryMatchCount >= countryMinCount && countryMatchCount / total >= countryMinRatio) {
    let bestContinent = 'world';
    let bestContinentOverlap = 0;

    // If intent hints a continent, prefer that
    if (hintedRegion && CONTINENT_COUNTRIES[hintedRegion]) {
      bestContinent = hintedRegion;
    } else {
      for (const [continent, countryCodes] of Object.entries(CONTINENT_COUNTRIES)) {
        let overlap = 0;
        for (const code of matchedCountryCodes) {
          if (countryCodes.has(code)) overlap++;
        }
        const overlapRatio = overlap / matchedCountryCodes.size;
        if (overlapRatio >= 0.8 && overlap > bestContinentOverlap) {
          bestContinent = continent;
          bestContinentOverlap = overlap;
        }
      }
    }

    const countrySuggestions = collectSuggestions(unmatchedValues, getAllCountryNames());
    return {
      scope: bestContinent,
      geoLevel: 'country',
      confidence: ratioToConfidence(countryMatchCount / total),
      matchedCount: countryMatchCount,
      totalCount: total,
      unmatchedValues: unmatchedValues.length > 0 ? unmatchedValues : undefined,
      suggestions: countrySuggestions.length > 0 ? countrySuggestions : undefined,
    };
  }

  // 4. No match
  return {
    scope: 'none',
    matchedCount: 0,
    totalCount: total,
  };
}

export interface ApplyGeoScopeResult {
  data: Record<string, any>[];
  mapType: string;
  projection: string;
  isUs: boolean;
  regionConfig?: GeoRegionConfig;
  topojsonData?: any;
}

/**
 * Builds the config fragment for a geo spec from an ApplyGeoScopeResult.
 * Includes topoPath, objectName, nameProperty, projection overrides, and inline topojson.
 */
export function buildGeoSpecConfig(geo: ApplyGeoScopeResult): Record<string, any> {
  const rc = geo.regionConfig;
  if (!rc) return {};
  return {
    topoPath: rc.topoPath,
    objectName: rc.objectName,
    nameProperty: rc.nameProperty,
    ...(rc.center ? { center: rc.center } : {}),
    ...(rc.scale ? { scale: rc.scale } : {}),
    ...(rc.parallels ? { parallels: rc.parallels } : {}),
    ...(rc.rotate ? { rotate: rc.rotate } : {}),
    ...(geo.topojsonData ? { topojsonData: geo.topojsonData } : {}),
  };
}

export function applyGeoScope(
  data: Record<string, any>[],
  geoField: string,
  options?: Record<string, any>
): ApplyGeoScopeResult {
  const explicitRegion = options?.geoRegion as string | undefined;

  if (explicitRegion) {
    const regionConfig = getGeoConfig(explicitRegion);
    if (regionConfig) {
      return {
        data,
        mapType: explicitRegion,
        projection: options?.projection ?? regionConfig.projection,
        isUs: explicitRegion.toUpperCase() === 'US',
        regionConfig,
        topojsonData: loadTopojson(regionConfig.topoPath),
      };
    }
  }

  const geoValues = data.map((row) => String(row[geoField] ?? ''));
  const scopeResult = detectGeoScope(geoValues, options?._intent);

  let finalData = data;
  if (scopeResult.normalizedValues) {
    const normMap = scopeResult.normalizedValues;
    finalData = data.map((row) => {
      const original = String(row[geoField] ?? '');
      const expanded = normMap.get(original);
      return expanded ? { ...row, [geoField]: expanded } : row;
    });
  }

  const isUs = scopeResult.scope === 'us';
  const resolvedScope = scopeResult.scope === 'none' ? 'world' : scopeResult.scope;
  const regionConfig = getGeoConfig(resolvedScope);

  return {
    data: finalData,
    mapType: options?.mapType ?? resolvedScope,
    projection: options?.projection ?? regionConfig?.projection ?? 'naturalEarth1',
    isUs,
    regionConfig,
    topojsonData: regionConfig ? loadTopojson(regionConfig.topoPath) : undefined,
  };
}
