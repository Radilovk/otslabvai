/**
 * Tests for worker.js JSON extraction functionality
 */

// Mock the extractJSONFromResponse function
function extractJSONFromResponse(responseText) {
    if (typeof responseText !== 'string') {
        return responseText;
    }
    
    // Try to find and extract valid JSON from the response
    let jsonStr = responseText.trim();
    
    // If response starts with markdown code blocks, remove them
    if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    
    // Find the start and end of the JSON object
    const startIdx = jsonStr.indexOf('{');
    const endIdx = jsonStr.lastIndexOf('}');
    
    if (startIdx === -1 || endIdx === -1 || startIdx >= endIdx) {
        throw new Error('AI отговори с текст без JSON структура.');
    }
    
    // Extract the JSON substring
    jsonStr = jsonStr.substring(startIdx, endIdx + 1);
    
    try {
        // First attempt: Try parsing as-is
        return JSON.parse(jsonStr);
    } catch (parseError) {
        // If initial parse fails, try to fix common AI JSON errors
        try {
            // Remove trailing commas before closing braces and brackets
            let sanitizedJson = jsonStr
                // First: Remove multiple consecutive commas
                .replace(/,+/g, ',')
                // Then: Remove trailing commas before }
                .replace(/,(\s*})/g, '$1')
                // Then: Remove trailing commas before ]
                .replace(/,(\s*])/g, '$1');
            
            return JSON.parse(sanitizedJson);
        } catch (sanitizeError) {
            throw new Error('AI отговори с невалиден JSON формат.');
        }
    }
}

describe('extractJSONFromResponse', () => {
    test('should parse valid JSON', () => {
        const input = '{"name": "Product", "price": 100}';
        const result = extractJSONFromResponse(input);
        expect(result).toEqual({ name: 'Product', price: 100 });
    });

    test('should parse JSON with markdown code blocks', () => {
        const input = '```json\n{"name": "Product", "price": 100}\n```';
        const result = extractJSONFromResponse(input);
        expect(result).toEqual({ name: 'Product', price: 100 });
    });

    test('should handle JSON with trailing comma in object', () => {
        const input = '{"name": "Product", "price": 100,}';
        const result = extractJSONFromResponse(input);
        expect(result).toEqual({ name: 'Product', price: 100 });
    });

    test('should handle JSON with trailing comma in array', () => {
        const input = '{"items": ["item1", "item2",]}';
        const result = extractJSONFromResponse(input);
        expect(result).toEqual({ items: ['item1', 'item2'] });
    });

    test('should handle complex nested JSON with trailing commas', () => {
        const input = `{
            "name": "Product",
            "ingredients": [
                {"name": "Ingredient1", "amount": "100mg",},
                {"name": "Ingredient2", "amount": "200mg",}
            ],
            "effects": ["Effect1", "Effect2",],
        }`;
        const result = extractJSONFromResponse(input);
        expect(result).toEqual({
            name: 'Product',
            ingredients: [
                { name: 'Ingredient1', amount: '100mg' },
                { name: 'Ingredient2', amount: '200mg' }
            ],
            effects: ['Effect1', 'Effect2']
        });
    });

    test('should handle JSON with text before and after', () => {
        const input = 'Here is the JSON: {"name": "Product", "price": 100} Some text after';
        const result = extractJSONFromResponse(input);
        expect(result).toEqual({ name: 'Product', price: 100 });
    });

    test('should return non-string input as-is', () => {
        const input = { name: 'Product' };
        const result = extractJSONFromResponse(input);
        expect(result).toEqual(input);
    });

    test('should throw error for invalid JSON structure', () => {
        const input = 'No JSON here';
        expect(() => extractJSONFromResponse(input)).toThrow();
    });

    test('should handle multiple trailing commas', () => {
        const input = '{"name": "Product",,}';
        const result = extractJSONFromResponse(input);
        expect(result).toEqual({ name: 'Product' });
    });
});
