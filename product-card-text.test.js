import { splitProductName, cardSnippet, decodeEntities, cardTaglineText } from './product-card-text.js';

describe('product-card-text', () => {
  test('името се разделя на заглавие, подзаглавие и разфасовка', () => {
    expect(splitProductName('Lean | Lipotropic Fat Burner [60 капсули, 30 Дози]'))
      .toEqual({ title: 'Lean', subtitle: 'Lipotropic Fat Burner', pack: '60 капсули, 30 Дози' });
    expect(splitProductName('Magnesium Citrate 200mg')).toEqual({ title: 'Magnesium Citrate 200mg', subtitle: '', pack: '' });
    expect(splitProductName('Marine Collagen &amp;amp; Hyaluronic').title).toBe('Marine Collagen & Hyaluronic');
  });

  test('краткият текст се реже до цяла дума, без HTML', () => {
    const s = cardSnippet('<p>Nutriversum Weight Loss Fibers е добавка с високо съдържание на фибри, предназначена за ситост</p>', 70);
    expect(s.endsWith('…')).toBe(true);
    expect(s).not.toMatch(/предназна…$/);
    expect(s.length).toBeLessThanOrEqual(71);
    expect(cardSnippet('Кратко.', 90)).toBe('Кратко.');
  });

  test('слоганът има предимство пред описанието; ентититата се декодират', () => {
    expect(cardTaglineText({ tagline: 'A &amp; B', description: 'x' })).toBe('A & B');
    expect(cardTaglineText({ description: 'Първо.\nВторо' })).toBe('Първо.');
    expect(decodeEntities('&quot;x&quot;')).toBe('"x"');
  });
});
