import { getPackDaysSupply, computeTierMonthlyCost } from './protocol-quiz-engine.js';

const product = (name, doses, variants = []) => ({
  public_data: { name, variants, packaging: { doses_per_package: doses } },
});

describe('getPackDaysSupply', () => {
  test('чете дози от packaging, иначе от името', () => {
    expect(getPackDaysSupply(product('X', '60 дози'))).toBe(60);
    expect(getPackDaysSupply(product('X', '30'))).toBe(30);
    expect(getPackDaysSupply(product('Fat Burner [60 капсули, 30 Дози]', ''))).toBe(30);
  });

  test('игнорира боклук и при няколко опаковки не вярва на packaging', () => {
    expect(getPackDaysSupply(product('X', ' концентриран в черния дроб'))).toBeNull();
    expect(getPackDaysSupply(product('X', '60 дози', [{ option_name: '120 капсули' }, { option_name: '60 капсули' }]))).toBeNull();
    expect(getPackDaysSupply(product('X', '2'))).toBeNull();
  });
});

describe('computeTierMonthlyCost', () => {
  test('≈ 30 дни; null ако някой продукт е без данни', () => {
    expect(computeTierMonthlyCost([{ price_eur: 60, days_supply: 60 }, { price_eur: 20, days_supply: 30 }])).toBe(50);
    expect(computeTierMonthlyCost([{ price_eur: 60, days_supply: 60 }, { price_eur: 20, days_supply: null }])).toBeNull();
  });
});

describe('getPackDaysSupply от капсули и дневен прием', () => {
  test('избраната опаковка + „по 2 капсули дневно“', () => {
    const p = {
      public_data: {
        name: 'X',
        variants: [{ option_name: '120 капсули' }, { option_name: '60 капсули' }],
        recommended_intake: 'Приемайте по 2 капсули дневно с храна.',
        packaging: { doses_per_package: '' },
      },
    };
    expect(getPackDaysSupply(p, p.public_data.variants[1])).toBe(30);
    expect(getPackDaysSupply(p, p.public_data.variants[0])).toBe(60);
  });

  test('„1 капсула два пъти дневно“ и без дневен прием → null', () => {
    const p = { public_data: { name: 'X', variants: [], recommended_intake: 'По 1 капсула два пъти дневно.', packaging: { capsules_or_grams: '60 капсули' } } };
    expect(getPackDaysSupply(p)).toBe(30);
    const q = { public_data: { name: 'X', variants: [], recommended_intake: 'Според етикета.', packaging: { capsules_or_grams: '60 капсули' } } };
    expect(getPackDaysSupply(q)).toBeNull();
  });
});
