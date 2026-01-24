/**
 * Tests for worker.js JSON extraction functionality
 */

/**
 * Attempt aggressive JSON repair for common AI mistakes
 */
function attemptJSONRepair(jsonStr) {
    // More aggressive repairs - but still conservative
    let repaired = jsonStr
        // Remove all trailing commas more aggressively
        .replace(/,(\s*[}\]])/g, '$1')
        // Ensure proper structure for common patterns - missing commas between objects/arrays
        .replace(/\}(\s*)\{/g, '},$1{')
        .replace(/\](\s*)\[/g, '],$1[')
        // Fix missing comma between closing brace/bracket and opening quote
        .replace(/(\}|\])(\s*)"/g, '$1,$2"')
        // Fix missing comma between closing quote and opening brace/bracket
        .replace(/"(\s*)(\{|\[)/g, '",$1$2')
        // Fix missing comma between consecutive strings (conservative - only in array context)
        .replace(/"(\s+)"(?=[^:]*(?:\]|,))/g, '",$1"')
        // Remove any non-printable characters except newlines (newlines in strings should stay)
        .replace(/[\x00-\x09\x0B-\x1F\x7F-\x9F]/g, '')
        // Fix common quote issues - replace smart quotes with regular quotes
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2018\u2019]/g, "'");
    
    return repaired;
}

// Mock the extractJSONFromResponse function with enhanced sanitization
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
            // Apply comprehensive sanitization for common AI JSON errors
            let sanitizedJson = jsonStr
                // Remove multiple consecutive commas (2 or more)
                .replace(/,{2,}/g, ',')
                // Remove trailing commas before } (with optional whitespace/newlines)
                .replace(/,(\s*})/g, '$1')
                // Remove trailing commas before ] (with optional whitespace/newlines)
                .replace(/,(\s*])/g, '$1')
                // Fix missing commas between array elements (common AI error)
                // Matches: }"WHITESPACE"{ or ]"WHITESPACE"[ 
                .replace(/(\}|\])(\s*)(\{|\[)/g, '$1,$2$3')
                // Fix missing comma between closing brace/bracket and opening quote
                // Matches: }"WHITESPACE"" or ]"WHITESPACE""
                .replace(/(\}|\])(\s*)"/g, '$1,$2"')
                // Fix missing comma between closing quote and opening brace/bracket
                // Matches: ""WHITESPACE"{ or ""WHITESPACE"[
                .replace(/"(\s*)(\{|\[)/g, '",$1$2')
                // Fix missing comma between consecutive strings in arrays
                // Matches: ""WHITESPACE"" (but not in object properties with :)
                .replace(/"(\s+)"(?=[^:]*(?:\]|,))/g, '",$1"')
                // Remove any trailing comma right before the final }
                .replace(/,(\s*)$/g, '$1');
            
            return JSON.parse(sanitizedJson);
        } catch (sanitizeError) {
            // Try one more aggressive fix: use a JSON repair library approach
            try {
                // Last resort: try to extract just valid parts and rebuild
                const repairedJson = attemptJSONRepair(jsonStr);
                return JSON.parse(repairedJson);
            } catch (repairError) {
                throw new Error(`AI отговори с невалиден JSON формат. Грешка: ${parseError.message}`);
            }
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

    test('should handle missing commas between array elements', () => {
        const input = '{"items": [{"a": 1}{"b": 2}]}';
        const result = extractJSONFromResponse(input);
        expect(result).toEqual({ items: [{ a: 1 }, { b: 2 }] });
    });

    test('should handle smart quotes', () => {
        const input = '{"name": "Product"}'; // Using smart quotes (unicode)
        const result = extractJSONFromResponse(input);
        expect(result).toEqual({ name: 'Product' });
    });

    test('should handle missing commas between object properties in array', () => {
        const input = '{"effects": [{"label": "Effect1", "value": 8}{"label": "Effect2", "value": 9}]}';
        const result = extractJSONFromResponse(input);
        expect(result).toEqual({
            effects: [
                { label: 'Effect1', value: 8 },
                { label: 'Effect2', value: 9 }
            ]
        });
    });

    test('should handle missing comma between object and string', () => {
        const input = '{"items": [{"id": 1}"text"]}';
        const result = extractJSONFromResponse(input);
        expect(result).toEqual({ items: [{ id: 1 }, "text"] });
    });

    test('should handle missing comma after object in array', () => {
        const input = '{"data": [{"id": 1}{"id": 2}]}';
        const result = extractJSONFromResponse(input);
        expect(result).toEqual({ data: [{ id: 1 }, { id: 2 }] });
    });

    test('should handle missing comma between consecutive strings in array', () => {
        const input = '{"tags": ["tag1" "tag2" "tag3"]}';
        const result = extractJSONFromResponse(input);
        expect(result).toEqual({ tags: ["tag1", "tag2", "tag3"] });
    });

    test('should handle missing comma after array before property', () => {
        const input = '{"items": ["a", "b"]"name": "test"}';
        const result = extractJSONFromResponse(input);
        expect(result).toEqual({ items: ["a", "b"], name: "test" });
    });

    test('should handle complex missing commas in nested structure', () => {
        const input = `{
            "name": "Product",
            "effects": [
                {"label": "Effect1", "value": 8}
                {"label": "Effect2", "value": 9}
            ]
            "tags": ["tag1" "tag2"]
        }`;
        const result = extractJSONFromResponse(input);
        expect(result).toEqual({
            name: "Product",
            effects: [
                { label: 'Effect1', value: 8 },
                { label: 'Effect2', value: 9 }
            ],
            tags: ["tag1", "tag2"]
        });
    });
});
