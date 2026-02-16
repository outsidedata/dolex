import { describe, it, expect } from 'vitest';
import { resolveSubdivisionName, getSubdivisionNames } from '../../../src/renderers/d3/geo/names/subdivisions.js';

describe('subdivision name resolution', () => {
  it('resolves US state full name', () => {
    expect(resolveSubdivisionName('US', 'California')).toBe('California');
    expect(resolveSubdivisionName('US', 'New York')).toBe('New York');
  });

  it('resolves US state abbreviation', () => {
    expect(resolveSubdivisionName('US', 'CA')).toBe('California');
    expect(resolveSubdivisionName('US', 'TX')).toBe('Texas');
    expect(resolveSubdivisionName('US', 'NY')).toBe('New York');
    expect(resolveSubdivisionName('US', 'DC')).toBe('District of Columbia');
  });

  it('resolves Chinese province', () => {
    expect(resolveSubdivisionName('CN', 'Beijing')).toBe('Beijing');
    expect(resolveSubdivisionName('CN', 'Guangdong')).toBe('Guangdong');
    expect(resolveSubdivisionName('CN', 'Inner Mongolia')).toBe('Nei Mongol');
    expect(resolveSubdivisionName('CN', 'Tibet')).toBe('Xizang');
  });

  it('resolves Australian state', () => {
    expect(resolveSubdivisionName('AU', 'New South Wales')).toBe('New South Wales');
    expect(resolveSubdivisionName('AU', 'NSW')).toBe('New South Wales');
    expect(resolveSubdivisionName('AU', 'VIC')).toBe('Victoria');
  });

  it('resolves Canadian province', () => {
    expect(resolveSubdivisionName('CA', 'Ontario')).toBe('Ontario');
    expect(resolveSubdivisionName('CA', 'BC')).toBe('British Columbia');
    expect(resolveSubdivisionName('CA', 'Quebec')).toBe('Québec');
  });

  it('resolves German region', () => {
    expect(resolveSubdivisionName('DE', 'Bayern')).toBeDefined();
    expect(resolveSubdivisionName('DE', 'Berlin')).toBe('Berlin');
  });

  it('resolves Japanese prefecture', () => {
    expect(resolveSubdivisionName('JP', 'Tokyo')).toBe('Tokyo');
    expect(resolveSubdivisionName('JP', 'Hokkaido')).toBe('Hokkaido');
    expect(resolveSubdivisionName('JP', 'Osaka')).toBe('Osaka');
    expect(resolveSubdivisionName('JP', 'Nagasaki')).toBe('Naoasaki');
  });

  it('resolves French region', () => {
    expect(resolveSubdivisionName('FR', 'Paris')).toBe('Île-de-France');
    expect(resolveSubdivisionName('FR', 'Bretagne')).toBe('Bretagne');
    expect(resolveSubdivisionName('FR', 'Brittany')).toBe('Bretagne');
  });

  it('resolves Indian state', () => {
    expect(resolveSubdivisionName('IN', 'Maharashtra')).toBe('Maharashtra');
    expect(resolveSubdivisionName('IN', 'Odisha')).toBe('Orissa');
  });

  it('resolves Brazilian state', () => {
    expect(resolveSubdivisionName('BR', 'SP')).toBe('São Paulo');
    expect(resolveSubdivisionName('BR', 'RJ')).toBe('Rio de Janeiro');
  });

  it('resolves Mexican state', () => {
    expect(resolveSubdivisionName('MX', 'Jalisco')).toBe('Jalisco');
    expect(resolveSubdivisionName('MX', 'Mexico City')).toBe('Distrito Federal');
    expect(resolveSubdivisionName('MX', 'CDMX')).toBe('Distrito Federal');
  });

  it('handles ambiguous names within scope', () => {
    expect(resolveSubdivisionName('US', 'Georgia')).toBe('Georgia');
  });

  it('returns undefined for non-matching', () => {
    expect(resolveSubdivisionName('US', 'Beijing')).toBeUndefined();
    expect(resolveSubdivisionName('XX', 'Something')).toBeUndefined();
  });

  it('getSubdivisionNames returns correct counts', () => {
    expect(getSubdivisionNames('US').length).toBe(51);
    expect(getSubdivisionNames('CN').length).toBe(31);
    expect(getSubdivisionNames('JP').length).toBe(47);
    expect(getSubdivisionNames('AU').length).toBe(8);
    expect(getSubdivisionNames('XX')).toEqual([]);
  });

  it('is case-insensitive', () => {
    expect(resolveSubdivisionName('US', 'california')).toBe('California');
    expect(resolveSubdivisionName('US', 'TEXAS')).toBe('Texas');
  });

  it('resolves Russian region', () => {
    expect(resolveSubdivisionName('RU', 'Moscow')).toBe('Moskva');
    expect(resolveSubdivisionName('RU', 'Saint Petersburg')).toBe('City of St. Petersburg');
    expect(resolveSubdivisionName('RU', 'Tatarstan')).toBe('Tatarstan');
  });

  it('resolves Italian region', () => {
    expect(resolveSubdivisionName('IT', 'Tuscany')).toBe('Toscana');
    expect(resolveSubdivisionName('IT', 'Lombardy')).toBe('Lombardia');
    expect(resolveSubdivisionName('IT', 'Sicily')).toBe('Sicily');
    expect(resolveSubdivisionName('IT', 'Puglia')).toBe('Apulia');
  });

  it('resolves Spanish community', () => {
    expect(resolveSubdivisionName('ES', 'Madrid')).toBe('Comunidad de Madrid');
    expect(resolveSubdivisionName('ES', 'Catalonia')).toBe('Cataluña');
    expect(resolveSubdivisionName('ES', 'Basque Country')).toBe('País Vasco');
    expect(resolveSubdivisionName('ES', 'Andalucia')).toBe('Andalucía');
  });

  it('resolves South Korean province', () => {
    expect(resolveSubdivisionName('KR', 'Seoul')).toBe('Seoul');
    expect(resolveSubdivisionName('KR', 'Busan')).toBe('Busan');
    expect(resolveSubdivisionName('KR', 'Jeju')).toBe('Jeju');
  });

  it('resolves South African province', () => {
    expect(resolveSubdivisionName('ZA', 'Gauteng')).toBe('Gauteng');
    expect(resolveSubdivisionName('ZA', 'KZN')).toBe('KwaZulu-Natal');
    expect(resolveSubdivisionName('ZA', 'Western Cape')).toBe('Western Cape');
  });

  it('resolves Colombian department', () => {
    expect(resolveSubdivisionName('CO', 'Antioquia')).toBe('Antioquia');
    expect(resolveSubdivisionName('CO', 'Bogota')).toBeUndefined();
    expect(resolveSubdivisionName('CO', 'Atlantico')).toBe('Atlántico');
  });

  it('resolves Argentine province', () => {
    expect(resolveSubdivisionName('AR', 'Buenos Aires')).toBe('Buenos Aires');
    expect(resolveSubdivisionName('AR', 'CABA')).toBe('Ciudad de Buenos Aires');
    expect(resolveSubdivisionName('AR', 'Tucuman')).toBe('Tucumán');
    expect(resolveSubdivisionName('AR', 'Cordoba')).toBe('Córdoba');
  });

  it('getSubdivisionNames returns correct counts for Tier 2', () => {
    expect(getSubdivisionNames('RU').length).toBe(83);
    expect(getSubdivisionNames('IT').length).toBe(20);
    expect(getSubdivisionNames('ES').length).toBe(18);
    expect(getSubdivisionNames('KR').length).toBe(17);
    expect(getSubdivisionNames('ZA').length).toBe(9);
    expect(getSubdivisionNames('CO').length).toBe(32);
    expect(getSubdivisionNames('AR').length).toBe(24);
  });
});
