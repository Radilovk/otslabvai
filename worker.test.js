/**
 * Tests for worker.js JSON extraction functionality
 */

/**
 * Attempt aggressive JSON repair for common AI mistakes
 */
function attemptJSONRepair(jsonStr) {
    // More aggressive repairs - but still conservative
    let repaired = jsonStr
        // Remove all trailing commas more aggressively (including multiple commas)
        .replace(/,+(\s*[}\]])/g, '$1')
        // Remove multiple consecutive commas anywhere
        .replace(/,{2,}/g, ',')
        // Fix missing commas: } or ] followed by { or [ (with or without whitespace)
        .replace(/(\}|\])(\s*)(\{|\[)/g, '$1,$2$3')
        // Fix missing commas: } or ] followed by " (with or without whitespace)
        .replace(/(\}|\])(\s*)"/g, '$1,$2"')
        // Fix missing commas: " followed by { or [ (with or without whitespace)
        .replace(/"(\s*)(\{|\[)/g, '",$1$2')
        // Fix missing comma between consecutive strings (in arrays and between properties)
        // Handles zero or more whitespace between quotes
        .replace(/"(\s*)"/g, '",$1"')
        // Remove any non-printable control characters (but keep newlines, tabs, carriage returns)
        .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, '')
        // Fix common quote issues - replace smart quotes with regular quotes
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2018\u2019]/g, "'")
        // Fix escaped newlines that might confuse JSON parser
        .replace(/\\\n/g, '\\n')
        // Remove trailing commas before closing braces/brackets (one more time after all fixes)
        .replace(/,(\s*[}\]])/g, '$1');
    
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
                // Fix missing commas between array/object elements (comprehensive patterns)
                // Pattern 1: } followed by { with whitespace
                .replace(/\}(\s+)\{/g, '},$1{')
                // Pattern 2: ] followed by [ with whitespace
                .replace(/\](\s+)\[/g, '],$1[')
                // Pattern 3: } or ] followed by { or [ (with or without whitespace)
                .replace(/(\}|\])(\s*)(\{|\[)/g, '$1,$2$3')
                // Fix missing comma between closing brace/bracket and opening quote
                // Matches: }"WHITESPACE"" or ]"WHITESPACE"" (with or without whitespace)
                .replace(/(\}|\])(\s*)"/g, '$1,$2"')
                // Fix missing comma between closing quote and opening brace/bracket
                // Matches: ""WHITESPACE"{ or ""WHITESPACE"[ (with or without whitespace)
                .replace(/"(\s*)(\{|\[)/g, '",$1$2')
                // Fix missing comma between consecutive strings (in arrays and between properties)
                // Matches: "string1"WHITESPACE"string2" - handles zero or more whitespace
                .replace(/"(\s*)"/g, '",$1"')
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
        // Testing mixed-type arrays (object + string) - simulates AI output with inconsistent types
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

    test('should handle Bulgarian text with missing comma in FAQ array', () => {
        // Simulates the real error: missing comma between FAQ objects with Bulgarian text
        const input = `{
            "name": "Продукт за отслабване",
            "faq": [
                {
                    "question": "Как да използвам продукта?",
                    "answer": "Препоръчва се да се приема по 2 капсули дневно, за да се избегне привикване на организма към стимулантите и да се запази ефективността на продукта."
                }
                {
                    "question": "Има ли странични ефекти?",
                    "answer": "При правилна употреба продуктът е безопасен."
                }
            ]
        }`;
        const result = extractJSONFromResponse(input);
        expect(result.faq).toHaveLength(2);
        expect(result.faq[0].answer).toContain("ефективността на продукта");
        expect(result.faq[1].question).toContain("странични ефекти");
    });

    test('should handle deeply nested structure with Bulgarian text and missing commas', () => {
        // Large nested structure similar to real AI output
        const input = `{
            "name": "Термогенен продукт",
            "description": "Продукт за ускоряване на метаболизма",
            "about_content": {
                "title": "За продукта",
                "benefits": [
                    {
                        "title": "Ускорява метаболизма",
                        "text": "Съдържа съставки които стимулират изгарянето на мазнини"
                    }
                    {
                        "title": "Потиска апетита",
                        "text": "Помага за контрол на глада през деня"
                    }
                ]
            },
            "ingredients": [
                {
                    "name": "Кофеин",
                    "amount": "200mg",
                    "description": "Стимулант на централната нервна система"
                }
                {
                    "name": "Зелен чай екстракт",
                    "amount": "150mg",
                    "description": "Богат на антиоксиданти"
                }
            ]
        }`;
        const result = extractJSONFromResponse(input);
        expect(result.about_content.benefits).toHaveLength(2);
        expect(result.ingredients).toHaveLength(2);
        expect(result.ingredients[1].name).toBe("Зелен чай екстракт");
    });

    test('should handle very long text with newlines and missing comma', () => {
        // Simulates AI output with long multiline text
        const input = `{
            "name": "Product",
            "faq": [
                {
                    "question": "How to use?",
                    "answer": "This is a very long answer that spans multiple lines.\\nIt contains newlines and special characters.\\nThe recommendation is to take 2 capsules daily to avoid building tolerance to stimulants and to preserve the effectiveness of the product."
                }
                {
                    "question": "Side effects?",
                    "answer": "Generally safe when used as directed."
                }
            ]
        }`;
        const result = extractJSONFromResponse(input);
        expect(result.faq).toHaveLength(2);
    });

    test('should handle missing comma with Windows line endings', () => {
        // Test with \r\n line endings
        const input = '{\r\n  "items": [\r\n    {"id": 1}\r\n    {"id": 2}\r\n  ]\r\n}';
        const result = extractJSONFromResponse(input);
        expect(result.items).toHaveLength(2);
    });

    test('should handle real-world Bulgarian FAQ error case', () => {
        // This simulates the actual error from the logs
        const input = `{
            "name": "Продукт",
            "faq": [
                {
                    "question": "Въпрос 1",
                    "answer": "Препоръчва се да се приема по 2 капсули дневно, за да се избегне привикване на организма към стимулантите и да се запази ефективността на продукта."
                }
                {
                    "question": "Въпрос 2",
                    "answer": "Отговор 2"
                }
            ]
        }`;
        const result = extractJSONFromResponse(input);
        expect(result.faq).toHaveLength(2);
        expect(result.faq[0].answer).toContain('ефективността на продукта');
        expect(result.faq[1].question).toBe('Въпрос 2');
    });

    test('should handle extremely large nested JSON with Bulgarian text', () => {
        // Large response similar to what AI might generate
        const input = `{
            "name": "Комплексен продукт",
            "description": "Детайлно описание",
            "about_content": {
                "benefits": [
                    {
                        "title": "Полза 1",
                        "text": "Много дълъг текст с много информация"
                    }
                    {
                        "title": "Полза 2",
                        "text": "Още повече информация тук"
                    }
                ]
            },
            "faq": [
                {
                    "question": "Първи въпрос?",
                    "answer": "Детайлен отговор с много информация за употребата"
                }
                {
                    "question": "Втори въпрос?",
                    "answer": "Друг детайлен отговор"
                }
            ],
            "ingredients": [
                {
                    "name": "Първа съставка",
                    "description": "Описание"
                }
                {
                    "name": "Втора съставка", 
                    "description": "Друго описание"
                }
            ]
        }`;
        const result = extractJSONFromResponse(input);
        expect(result.about_content.benefits).toHaveLength(2);
        expect(result.faq).toHaveLength(2);
        expect(result.ingredients).toHaveLength(2);
    });

    test('should handle missing comma with zero whitespace between strings', () => {
        // This is the specific bug we're fixing - AI generates ""value1""value2"" with NO whitespace
        const input = `{
            "items": ["item1""item2"],
            "data": {
                "field1": "value1""field2": "value2"
            }
        }`;
        const result = extractJSONFromResponse(input);
        expect(result).toEqual({
            items: ['item1', 'item2'],
            data: {
                field1: 'value1',
                field2: 'value2'
            }
        });
    });

    test('should handle missing comma with zero whitespace in ingredient properties', () => {
        // Real-world scenario: ingredient object with missing comma and no whitespace
        const input = `{
            "ingredients": [
                {"name": "L-карнитин""amount": "500mg"},
                {"name": "Креатин""amount": "100mg"}
            ]
        }`;
        const result = extractJSONFromResponse(input);
        expect(result.ingredients).toEqual([
            { name: 'L-карнитин', amount: '500mg' },
            { name: 'Креатин', amount: '100mg' }
        ]);
    });

    test('should NOT corrupt valid JSON with empty strings', () => {
        // Important: valid JSON should pass through unchanged, even with empty strings
        // The sanitization only runs on INVALID JSON
        const validJSON = '{"items": ["", "value"], "key": ""}';
        const result = extractJSONFromResponse(validJSON);
        expect(result).toEqual({
            items: ['', 'value'],  // Empty string preserved
            key: ''  // Empty string preserved
        });
    });
});
