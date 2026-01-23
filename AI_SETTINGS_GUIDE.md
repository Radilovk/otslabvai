# AI Settings Module - User Guide

## Overview

The AI Settings module allows you to configure which AI provider to use, customize the prompt, and manage API keys for the AI Assistant feature.

## Accessing AI Settings

1. Open the admin panel (`admin.html`)
2. Click on the **"AI Настройки"** tab in the navigation bar

## Configuration Options

### 1. AI Provider Selection
Choose between three AI providers:
- **Cloudflare AI** (Llama 3.1 70B) - Free/cheap option, requires Cloudflare account
- **OpenAI** (GPT-4/GPT-3.5) - Highest quality, paid service
- **Google AI** (Gemini Pro) - Balance between quality and cost

### 2. AI Model
Specify the exact model to use:
- **Cloudflare**: `@cf/meta/llama-3.1-70b-instruct`
- **OpenAI**: `gpt-4` or `gpt-3.5-turbo`
- **Google**: `gemini-pro`

### 3. API Key
- Enter your API key for the selected provider
- **Security**: API keys are stored only in your browser's localStorage
- Never stored on the server
- Required for OpenAI and Google, not required for Cloudflare (uses environment variables)

### 4. Temperature (Creativity)
- Range: 0.0 to 2.0
- **0.0** = Very conservative, predictable
- **0.3** = Recommended (balanced)
- **2.0** = Very creative, unpredictable

### 5. Max Tokens
- Maximum length of AI response
- Range: 1024 to 8192
- **4096** = Recommended (default)

### 6. Prompt Template
- Customize how the AI generates product information
- Use `{{productData}}` placeholder for product data
- Written in Bulgarian
- Default template includes all necessary instructions

## Buttons

### 💾 Save Settings
- Saves all settings to the server (except API key)
- API key saved only in browser localStorage
- Settings persist across sessions

### 🧪 Test AI
- Tests the current configuration with a simple product ("Витамин C")
- Verifies that the AI provider, model, and API key work correctly
- Shows success or error notification

### 🔄 Reset to Default
- Restores all settings to factory defaults
- Clears API key
- Resets to Cloudflare provider
- Restores default prompt template

## How API Keys Are Stored

### Server Storage (KV)
- Provider selection
- Model name
- Temperature
- Max tokens
- Prompt template

### Browser Storage (localStorage)
- API keys (never sent to server)
- Kept locally for security

## Getting API Keys

### Cloudflare AI
- No API key needed in settings
- Uses environment variables (`ACCOUNT_ID` and `AI_TOKEN`)
- Configured on server deployment

### OpenAI
1. Go to https://platform.openai.com/api-keys
2. Create a new API key
3. Copy and paste into AI Settings

### Google AI (Gemini)
1. Go to https://makersuite.google.com/app/apikey
2. Create a new API key
3. Copy and paste into AI Settings

## Usage Flow

```
1. Open AI Settings tab
2. Select AI provider
3. Enter API key (if not Cloudflare)
4. Customize prompt if needed
5. Click "Test AI" to verify
6. Click "Save Settings"
7. Go to product editor
8. Use "AI Assistant" button
   └─> Uses your configured settings
```

## Provider Comparison

| Feature | Cloudflare | OpenAI | Google |
|---------|-----------|--------|--------|
| Cost | Free/Cheap | Paid | Free/Moderate |
| Quality | Good | Excellent | Very Good |
| Speed | Fast | Fast | Fast |
| Bulgarian Support | Good | Excellent | Very Good |
| Setup | Server env vars | API key | API key |
| Model | Llama 3.1 70B | GPT-4/3.5 | Gemini Pro |

## Troubleshooting

### "API key is missing"
- Make sure you've entered the API key for non-Cloudflare providers
- Click "Save Settings" after entering

### "Test failed"
- Check that API key is correct
- Verify model name matches provider
- Check internet connection
- Ensure you have API credits/quota

### "Settings not saving"
- Check browser localStorage is enabled
- Check server connection
- Look for errors in browser console

## Security Notes

✅ **API keys stored only in browser localStorage**
✅ **Never transmitted except to AI provider**
✅ **Server stores only provider configuration**
✅ **Encrypted HTTPS connection**
✅ **No API keys in logs or database**

## Example Configurations

### Configuration 1: Free (Cloudflare)
```
Provider: Cloudflare
Model: @cf/meta/llama-3.1-70b-instruct
API Key: (not needed)
Temperature: 0.3
Max Tokens: 4096
```

### Configuration 2: Premium (OpenAI)
```
Provider: OpenAI
Model: gpt-4
API Key: sk-...
Temperature: 0.3
Max Tokens: 4096
```

### Configuration 3: Balanced (Google)
```
Provider: Google AI
Model: gemini-pro
API Key: AIza...
Temperature: 0.3
Max Tokens: 4096
```

---

**Last Updated:** January 23, 2026
**Feature:** AI Settings Module v1.0
