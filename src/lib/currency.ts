const SYMBOLS: Record<string, string> = {
  EUR: '€', USD: '$', GBP: '£', CHF: 'CHF', SEK: 'kr', NOK: 'kr', DKK: 'kr', PLN: 'zł', CZK: 'Kč', HRK: 'kn',
}

export function currencySymbol(code: string | null | undefined): string {
  if (!code) return '€'
  return SYMBOLS[code] ?? code
}
