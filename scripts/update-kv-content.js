#!/usr/bin/env node

/**
 * Script to update Cloudflare KV with the correct page content
 * This fixes the issue where BIOCODE content is served instead of ОТСЛАБВАНЕ content
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the mock data file
const mockDataPath = path.join(__dirname, '..', 'page_content_mock.json');
const mockData = JSON.parse(fs.readFileSync(mockDataPath, 'utf8'));

// API URL from config
const API_URL = 'https://port.radilov-k.workers.dev';

async function updatePageContent() {
  try {
    console.log('🚀 Updating page content in Cloudflare KV...');
    console.log(`📝 Using data from: ${mockDataPath}`);
    console.log(`🌐 API URL: ${API_URL}/page_content.json`);
    
    const response = await fetch(`${API_URL}/page_content.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mockData, null, 2),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ Success!', result);
    console.log('\n📋 Updated content summary:');
    console.log(`   Site Name: ${mockData.settings.site_name}`);
    console.log(`   Site Slogan: ${mockData.settings.site_slogan}`);
    console.log(`   Navigation Items: ${mockData.navigation.length}`);
    console.log(`   Page Components: ${mockData.page_content.length}`);
    
  } catch (error) {
    console.error('❌ Error updating page content:', error.message);
    process.exit(1);
  }
}

updatePageContent();
