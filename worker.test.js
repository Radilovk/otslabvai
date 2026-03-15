/**
 * Tests for worker.js JSON extraction functionality
 */

/**
 * Fix unescaped control characters inside JSON string values.
 * (Mirror of the worker.js sanitizeJSONStrings function)
 */
function sanitizeJSONStrings(jsonStr) {
    let result = '';
    let inString = false;
    let i = 0;
    while (i < jsonStr.length) {
        const char = jsonStr[i];
        if (!inString) {
            if (char === '"') {
                inString = true;
                result += char;
            } else {
                result += char;
            }
        } else {
            if (char === '\\') {
                result += char;
                i++;
                if (i < jsonStr.length) result += jsonStr[i];
            } else if (char === '"') {
                inString = false;
                result += char;
            } else if (char === '\n') {
                result += '\\n';
            } else if (char === '\r') {
                result += '\\r';
            } else if (char === '\t') {
                result += '\\t';
            } else if (char < ' ') {
                // Drop other raw control characters
            } else {
                result += char;
            }
        }
        i++;
    }
    return result;
}

/**
 * Attempt aggressive JSON repair for common AI mistakes
 */
function attemptJSONRepair(jsonStr) {
    // First, fix any unescaped control characters inside string values
    let repaired = sanitizeJSONStrings(jsonStr);

    // Then apply structural repairs
    repaired = repaired
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
        // Requires at least one whitespace between quotes to avoid corrupting empty strings ""
        .replace(/"(\s+)"/g, '",$1"')
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

// Mirror of the extractJSONFromResponse function from worker.js
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
            // Stage 2: Fix unescaped control chars first, then apply structural fixes
            let sanitizedJson = sanitizeJSONStrings(jsonStr);
            sanitizedJson = sanitizedJson
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
                .replace(/(\}|\])(\s*)"/g, '$1,$2"')
                // Fix missing comma between closing quote and opening brace/bracket
                .replace(/"(\s*)(\{|\[)/g, '",$1$2')
                // Fix missing comma between consecutive strings (in arrays and between properties)
                .replace(/"(\s+)"/g, '",$1"')
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

    test('should handle missing comma between consecutive strings separated by whitespace', () => {
        // AI almost always separates strings with at least a newline; the fix requires \s+ (one or more whitespace)
        const input = `{
            "items": ["item1"
                "item2"],
            "data": {
                "field1": "value1"
                "field2": "value2"
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

    test('should handle missing comma between ingredient properties separated by whitespace', () => {
        // Real-world scenario: ingredient object with missing comma separated by newline
        const input = `{
            "ingredients": [
                {"name": "L-карнитин"
                 "amount": "500mg"},
                {"name": "Креатин"
                 "amount": "100mg"}
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

    test('should preserve empty strings in invalid JSON that also has missing commas', () => {
        // Bug fix: empty strings "" must NOT be corrupted to "," when JSON also has missing commas
        // The admin prompt explicitly tells AI to use "" for unknown values, so this is a common case
        const input = `{
            "name": "Продукт"
            "brand": ""
            "manufacturer": "Nutrend"
            "packaging_info": {
                "capsules_or_grams": ""
                "doses_per_package": "30 дози"
            }
        }`;
        const result = extractJSONFromResponse(input);
        expect(result.name).toBe('Продукт');
        expect(result.brand).toBe('');           // Empty string must be preserved, not corrupted to ","
        expect(result.manufacturer).toBe('Nutrend');
        expect(result.packaging_info.capsules_or_grams).toBe('');  // Empty string preserved
        expect(result.packaging_info.doses_per_package).toBe('30 дози');
    });
});

describe('sanitizeJSONStrings', () => {
    test('should escape literal newlines inside string values', () => {
        // AI sometimes outputs literal newlines inside strings instead of \\n
        const input = '{"description": "Line one\nLine two\nLine three"}';
        const result = sanitizeJSONStrings(input);
        expect(result).toBe('{"description": "Line one\\nLine two\\nLine three"}');
        expect(() => JSON.parse(result)).not.toThrow();
        expect(JSON.parse(result).description).toBe('Line one\nLine two\nLine three');
    });

    test('should escape literal carriage returns inside string values', () => {
        const input = '{"text": "before\rafter"}';
        const result = sanitizeJSONStrings(input);
        expect(result).toBe('{"text": "before\\rafter"}');
        expect(() => JSON.parse(result)).not.toThrow();
    });

    test('should escape literal tabs inside string values', () => {
        const input = '{"text": "col1\tcol2"}';
        const result = sanitizeJSONStrings(input);
        expect(result).toBe('{"text": "col1\\tcol2"}');
        expect(() => JSON.parse(result)).not.toThrow();
    });

    test('should not modify already-escaped sequences', () => {
        const input = '{"text": "line\\nbreak and \\t tab"}';
        const result = sanitizeJSONStrings(input);
        expect(result).toBe('{"text": "line\\nbreak and \\t tab"}');
    });

    test('should not modify structural whitespace outside strings', () => {
        const input = '{\n  "key": "value"\n}';
        const result = sanitizeJSONStrings(input);
        expect(result).toBe('{\n  "key": "value"\n}');
    });

    test('should handle multiline AI output with literal newlines in strings', () => {
        // This simulates the exact scenario: AI outputs literal newlines in FAQ answers
        const rawAIOutput = `{
  "faq": [
    {
      "question": "How to use?",
      "answer": "Take 2 capsules daily.\nDrink plenty of water.\nAvoid caffeine."
    }
  ]
}`;
        const sanitized = sanitizeJSONStrings(rawAIOutput);
        expect(() => JSON.parse(sanitized)).not.toThrow();
        const parsed = JSON.parse(sanitized);
        expect(parsed.faq[0].answer).toContain('Take 2 capsules daily.');
        expect(parsed.faq[0].answer).toContain('Drink plenty of water.');
    });
});

describe('extractJSONFromResponse - unescaped newlines', () => {
    test('should handle AI output with literal newlines inside string values', () => {
        // Simulates the most common case: AI outputs literal newlines in description/answer fields
        const input = `{
            "name": "Product",
            "description": "Line one
Line two
Line three"
        }`;
        const result = extractJSONFromResponse(input);
        expect(result.name).toBe('Product');
        expect(result.description).toContain('Line one');
        expect(result.description).toContain('Line two');
    });

    test('should handle FAQ answer with literal newlines (matches reported error pattern)', () => {
        // This pattern triggers "Expected ',' or '}' after property value" at a specific line
        const input = `{
            "name": "Продукт",
            "description": "Описание на продукта",
            "faq": [
                {
                    "question": "Как да го използвам?",
                    "answer": "Приемайте 2 капсули дневно.
Пийте достатъчно вода.
Избягвайте кофеин."
                },
                {
                    "question": "Безопасен ли е?",
                    "answer": "Да, при правилна употреба."
                }
            ]
        }`;
        const result = extractJSONFromResponse(input);
        expect(result.faq).toHaveLength(2);
        expect(result.faq[0].answer).toContain('Приемайте 2 капсули дневно.');
        expect(result.faq[1].question).toContain('Безопасен ли е?');
    });
});

describe('prompt template $ pattern safety', () => {
    test("function replacement prevents dollar-apostrophe corruption in product descriptions", () => {
        // The bug: String.replace() interprets $' as "insert text after the match",
        // which corrupts the entire prompt when product data contains $'
        const template = 'BEFORE {{productData}} AFTER';
        const productData = { name: 'Product', description: "Costs $'100 per bottle" };
        const jsonStr = JSON.stringify(productData, null, 2);

        // Buggy approach (old code): string replace interprets $' as replacement specifier
        const buggyResult = template.replace('{{productData}}', jsonStr);
        // Safe approach (new code): function replacement - return value used verbatim
        const safeResult = template.replace('{{productData}}', () => jsonStr);

        // The safe result must contain the original $' text unchanged
        expect(safeResult).toContain("Costs $'100 per bottle");
        expect(safeResult).toBe(`BEFORE ${jsonStr} AFTER`);

        // The buggy result would be corrupted (AFTER appears inside the description)
        // We verify the fix actually differs from the old broken behavior when $' is present
        expect(buggyResult).not.toBe(safeResult);
    });

    test('function replacement prevents dollar-ampersand corruption in product descriptions', () => {
        const template = 'BEFORE {{productData}} AFTER';
        const productData = { name: 'Product', description: 'Price: $& per unit' };
        const jsonStr = JSON.stringify(productData, null, 2);

        const safeResult = template.replace('{{productData}}', () => jsonStr);
        expect(safeResult).toContain('Price: $& per unit');
        expect(safeResult).toBe(`BEFORE ${jsonStr} AFTER`);
    });

    test('function replacement prevents dollar-backtick corruption in product descriptions', () => {
        const template = 'BEFORE {{productData}} AFTER';
        const productData = { name: 'Product', description: 'Formula $`X` active' };
        const jsonStr = JSON.stringify(productData, null, 2);

        const safeResult = template.replace('{{productData}}', () => jsonStr);
        expect(safeResult).toContain('Formula $`X` active');
        expect(safeResult).toBe(`BEFORE ${jsonStr} AFTER`);
    });
});
