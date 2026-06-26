export interface Country { code: string; name: string }

export const PRIORITY_COUNTRIES: Country[] = [
  { code: 'DK', name: 'Danmark' },
  { code: 'SE', name: 'Sverige' },
  { code: 'NO', name: 'Norge' },
  { code: 'FI', name: 'Finland' },
  { code: 'DE', name: 'Tyskland' },
  { code: 'GB', name: 'UK' },
  { code: 'US', name: 'USA' },
];

export const OTHER_COUNTRIES: Country[] = [
  { code: 'AF', name: 'Afghanistan' },
  { code: 'AL', name: 'Albanien' },
  { code: 'DZ', name: 'Algeriet' },
  { code: 'AD', name: 'Andorra' },
  { code: 'AO', name: 'Angola' },
  { code: 'AR', name: 'Argentina' },
  { code: 'AM', name: 'Armenien' },
  { code: 'AU', name: 'Australien' },
  { code: 'AT', name: 'Østrig' },
  { code: 'AZ', name: 'Aserbajdsjan' },
  { code: 'BH', name: 'Bahrain' },
  { code: 'BD', name: 'Bangladesh' },
  { code: 'BY', name: 'Hviderusland' },
  { code: 'BE', name: 'Belgien' },
  { code: 'BA', name: 'Bosnien-Hercegovina' },
  { code: 'BR', name: 'Brasilien' },
  { code: 'BG', name: 'Bulgarien' },
  { code: 'CA', name: 'Canada' },
  { code: 'CL', name: 'Chile' },
  { code: 'CN', name: 'Kina' },
  { code: 'CO', name: 'Colombia' },
  { code: 'HR', name: 'Kroatien' },
  { code: 'CY', name: 'Cypern' },
  { code: 'CZ', name: 'Tjekkiet' },
  { code: 'EG', name: 'Egypten' },
  { code: 'EE', name: 'Estland' },
  { code: 'ET', name: 'Etiopien' },
  { code: 'FR', name: 'Frankrig' },
  { code: 'GE', name: 'Georgien' },
  { code: 'GH', name: 'Ghana' },
  { code: 'GR', name: 'Grækenland' },
  { code: 'HU', name: 'Ungarn' },
  { code: 'IN', name: 'Indien' },
  { code: 'ID', name: 'Indonesien' },
  { code: 'IE', name: 'Irland' },
  { code: 'IL', name: 'Israel' },
  { code: 'IT', name: 'Italien' },
  { code: 'JP', name: 'Japan' },
  { code: 'JO', name: 'Jordan' },
  { code: 'KZ', name: 'Kasakhstan' },
  { code: 'KE', name: 'Kenya' },
  { code: 'KW', name: 'Kuwait' },
  { code: 'LV', name: 'Letland' },
  { code: 'LB', name: 'Libanon' },
  { code: 'LI', name: 'Liechtenstein' },
  { code: 'LT', name: 'Litauen' },
  { code: 'LU', name: 'Luxembourg' },
  { code: 'MK', name: 'Nordmakedonien' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'MT', name: 'Malta' },
  { code: 'MX', name: 'Mexico' },
  { code: 'MD', name: 'Moldova' },
  { code: 'MC', name: 'Monaco' },
  { code: 'ME', name: 'Montenegro' },
  { code: 'MA', name: 'Marokko' },
  { code: 'NL', name: 'Holland' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'PK', name: 'Pakistan' },
  { code: 'PH', name: 'Filippinerne' },
  { code: 'PL', name: 'Polen' },
  { code: 'PT', name: 'Portugal' },
  { code: 'QA', name: 'Qatar' },
  { code: 'RO', name: 'Rumænien' },
  { code: 'RU', name: 'Rusland' },
  { code: 'SA', name: 'Saudi-Arabien' },
  { code: 'RS', name: 'Serbien' },
  { code: 'SG', name: 'Singapore' },
  { code: 'SK', name: 'Slovakiet' },
  { code: 'SI', name: 'Slovenien' },
  { code: 'ZA', name: 'Sydafrika' },
  { code: 'KR', name: 'Sydkorea' },
  { code: 'ES', name: 'Spanien' },
  { code: 'LK', name: 'Sri Lanka' },
  { code: 'CH', name: 'Schweiz' },
  { code: 'TW', name: 'Taiwan' },
  { code: 'TH', name: 'Thailand' },
  { code: 'TN', name: 'Tunesien' },
  { code: 'TR', name: 'Tyrkiet' },
  { code: 'UA', name: 'Ukraine' },
  { code: 'AE', name: 'UAE' },
  { code: 'UY', name: 'Uruguay' },
  { code: 'UZ', name: 'Usbekistan' },
  { code: 'VN', name: 'Vietnam' },
];

export const ALL_COUNTRIES: Country[] = [
  ...PRIORITY_COUNTRIES,
  ...OTHER_COUNTRIES.filter(c => !PRIORITY_COUNTRIES.find(p => p.code === c.code))
    .sort((a, b) => a.name.localeCompare(b.name, 'da')),
];

export function flag(code: string): string {
  if (!code || code.length !== 2) return '🌍';
  return code.toUpperCase().replace(/./g, c => String.fromCodePoint(c.charCodeAt(0) + 127397));
}

export function countryName(code: string): string {
  return ALL_COUNTRIES.find(c => c.code === code)?.name ?? code;
}

export function countryDisplay(code: string): string {
  if (!code) return '';
  return `${flag(code)} ${countryName(code)}`;
}
