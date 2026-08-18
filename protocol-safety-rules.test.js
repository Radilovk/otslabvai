import {
  getExclusionReasons,
  productMatchesAnyKeyword,
  CONDITION_EXCLUSIONS,
} from './protocol-safety-rules.js';

describe('protocol-safety-rules', () => {
  test('kidney изключва английски protein в името', () => {
    const product = {
      public_data: { name: 'Critical Oats | Protein Porridge Powder' },
      system_data: { portfolio: {} },
    };
    const profile = { conditions: ['kidney'], medications: [], allergies: [], diet: 'omnivore' };
    expect(getExclusionReasons(profile, product).length).toBeGreaterThan(0);
  });

  test('hypertension изключва thermogenic fat burner', () => {
    const product = {
      public_data: { name: 'The Omen Thermogenic Fat Burner' },
      system_data: { portfolio: {} },
    };
    const profile = { conditions: ['hypertension'], medications: [], allergies: [], diet: 'omnivore' };
    expect(getExclusionReasons(profile, product).length).toBeGreaterThan(0);
  });

  test('pregnancy изключва saw palmetto и мъжки мултивитамин', () => {
    const profile = {
      conditions: ['pregnancy'],
      pregnancy: 'yes',
      sex: 'female',
      medications: [],
      allergies: [],
      diet: 'vegetarian',
    };
    const palmetto = { public_data: { name: 'Saw Palmetto Extract' }, system_data: {} };
    const manMulti = { public_data: { name: 'Multivitamins & Minerals Man' }, system_data: {} };
    expect(getExclusionReasons(profile, palmetto).length).toBeGreaterThan(0);
    expect(getExclusionReasons(profile, manMulti).length).toBeGreaterThan(0);
  });

  test('anticoagulants изключват krill oil', () => {
    const product = { public_data: { name: 'Super Krill Oil 1180 mg' }, system_data: {} };
    const profile = { conditions: [], medications: ['anticoagulants'], allergies: [], diet: 'omnivore' };
    expect(getExclusionReasons(profile, product).length).toBeGreaterThan(0);
  });
});
