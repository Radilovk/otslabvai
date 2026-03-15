/**
 * Tests for worker.js AI message building
 */

// Mirror of the buildAIMessages function from worker.js
function buildAIMessages(template, productDataJson) {
    if (template.includes('{{productData}}')) {
        const prompt = template.replace('{{productData}}', () => productDataJson);
        return [{ role: 'user', content: prompt }];
    }
    return [
        { role: 'system', content: template },
        { role: 'user', content: `Въведена информация за продукта:\n${productDataJson}` }
    ];
}

describe('buildAIMessages', () => {
    const productJson = '{"productName": "Test Product", "price": "25"}';

    test('new-style template (no {{productData}}) produces system + user messages', () => {
        const template = 'Ти си експерт. Попълни JSON за продукта.';
        const messages = buildAIMessages(template, productJson);

        expect(messages).toHaveLength(2);
        expect(messages[0].role).toBe('system');
        expect(messages[0].content).toBe(template);
        expect(messages[1].role).toBe('user');
        expect(messages[1].content).toContain(productJson);
        // System message must NOT contain the raw product data
        expect(messages[0].content).not.toContain('Test Product');
    });

    test('legacy template (with {{productData}}) produces single user message', () => {
        const template = 'Анализирай: {{productData}} и попълни JSON.';
        const messages = buildAIMessages(template, productJson);

        expect(messages).toHaveLength(1);
        expect(messages[0].role).toBe('user');
        expect(messages[0].content).toContain('Test Product');
        expect(messages[0].content).not.toContain('{{productData}}');
    });

    test('new-style template keeps system instructions separate from product data', () => {
        const template = 'Инструкции за AI: ПРАВИЛО 1, ПРАВИЛО 2.';
        const messages = buildAIMessages(template, productJson);

        // Instructions must appear in system message only
        expect(messages[0].content).toContain('ПРАВИЛО 1');
        // Product data must appear in user message only
        expect(messages[1].content).toContain('Test Product');
        expect(messages[0].content).not.toContain('Test Product');
    });

    test("legacy template: dollar-apostrophe in product data is not corrupted", () => {
        // Regression: String.replace() with $' as replacement text inserted text-after-match
        const template = 'Инструкции {{productData}} края';
        const dataWithDollar = `{"description": "Costs $'100 per box"}`;
        const messages = buildAIMessages(template, dataWithDollar);

        expect(messages[0].content).toContain(`Costs $'100 per box`);
    });

    test('legacy template: dollar-ampersand in product data is not corrupted', () => {
        const template = 'Инструкции {{productData}} края';
        const dataWithDollar = '{"description": "Price: $& per unit"}';
        const messages = buildAIMessages(template, dataWithDollar);

        expect(messages[0].content).toContain('Price: $& per unit');
    });
});

