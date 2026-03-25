#!/usr/bin/env node

/**
 * Script to upload static files to Cloudflare KV
 * Usage: node upload-static-files.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Files to upload
const FILES_TO_UPLOAD = [
    { file: 'index.html', key: 'static_index.html' },
    { file: 'index.js', key: 'static_index.js' },
    { file: 'index.css', key: 'static_index.css' },
    { file: 'config.js', key: 'static_config.js' },
    { file: 'admin.html', key: 'static_admin.html' },
    { file: 'admin.js', key: 'static_admin.js' },
    { file: 'admin.css', key: 'static_admin.css' },
    { file: 'checkout.html', key: 'static_checkout.html' },
    { file: 'life.html', key: 'static_life.html' },
    { file: 'life.js', key: 'static_life.js' },
    { file: 'life.css', key: 'static_life.css' },
    { file: 'quest.html', key: 'static_quest.html' },
    { file: 'questionnaire.js', key: 'static_questionnaire.js' },
    { file: 'questionnaire.css', key: 'static_questionnaire.css' },
    { file: 'bio.html', key: 'static_bio.html' },
    { file: 'bioadmin.html', key: 'static_bioadmin.html' },
    // Static fallback for page_content – used by the worker when the live 'page_content' KV key is empty
    { file: 'backend/page_content.json', key: 'static_backend_page_content.json' },
    { file: 'backend/life_page_content.json', key: 'static_backend_life_page_content.json' },
    // Static-serving keys for GET /page_content.json and GET /life_page_content.json.
    // These are updated by the worker on every admin save, so normal page loads
    // never trigger a dynamic KV read — the browser caches the static file for 1 hour.
    { file: 'backend/page_content.json', key: 'static_page_content.json' },
    { file: 'backend/life_page_content.json', key: 'static_life_page_content.json' },
];

// KV Namespace details
// Note: The default namespace ID matches the one in wrangler.toml for this project
// Override with CLOUDFLARE_KV_NAMESPACE_ID environment variable if using a different namespace
const KV_NAMESPACE_ID = process.env.CLOUDFLARE_KV_NAMESPACE_ID || 'd220db696e414b7cb3da2b19abd53d0f';
const KV_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const KV_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

async function uploadFile(filename, kvKey) {
    const filePath = path.join(__dirname, filename);
    
    if (!fs.existsSync(filePath)) {
        console.warn(`⚠️  File not found: ${filename}, skipping...`);
        return;
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    
    console.log(`📤 Uploading ${filename} as ${kvKey}...`);
    
    const url = `https://api.cloudflare.com/client/v4/accounts/${KV_ACCOUNT_ID}/storage/kv/namespaces/${KV_NAMESPACE_ID}/values/${kvKey}`;
    
    const response = await fetch(url, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${KV_API_TOKEN}`,
            'Content-Type': 'text/plain',
        },
        body: content
    });
    
    if (response.ok) {
        console.log(`✅ Successfully uploaded ${filename}`);
    } else {
        const error = await response.text();
        console.error(`❌ Failed to upload ${filename}: ${error}`);
    }
}

async function main() {
    console.log('🚀 Starting static files upload to Cloudflare KV...\n');
    
    if (!KV_ACCOUNT_ID || !KV_API_TOKEN) {
        console.error('❌ Missing environment variables:');
        console.error('   CLOUDFLARE_ACCOUNT_ID');
        console.error('   CLOUDFLARE_API_TOKEN');
        console.error('\nPlease set these environment variables and try again.');
        process.exit(1);
    }
    
    for (const { file, key } of FILES_TO_UPLOAD) {
        await uploadFile(file, key);
    }

    // Seed the live 'page_content' KV key from backend/page_content.json only when it is
    // not already set (i.e., on first deploy). This preserves any changes that an admin
    // has already saved through the admin panel.
    const pageContentFilePath = path.join(__dirname, 'backend/page_content.json');
    if (fs.existsSync(pageContentFilePath)) {
        const checkUrl = `https://api.cloudflare.com/client/v4/accounts/${KV_ACCOUNT_ID}/storage/kv/namespaces/${KV_NAMESPACE_ID}/values/page_content`;
        const checkResponse = await fetch(checkUrl, {
            headers: { 'Authorization': `Bearer ${KV_API_TOKEN}` }
        });
        if (checkResponse.status === 404) {
            console.log('📤 Seeding live \'page_content\' key from backend/page_content.json (first deploy)...');
            await uploadFile('backend/page_content.json', 'page_content');
            console.log('✅ Seeded \'page_content\'');
        } else {
            console.log('ℹ️  \'page_content\' already set in KV, skipping seed (admin changes preserved)');
        }
    }
    
    console.log('\n✨ Upload complete!');
    console.log('\nNext steps:');
    console.log('1. Deploy the worker: npm run deploy');
    console.log('2. Visit your worker URL to see the frontend');
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
