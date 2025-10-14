/**
 * Sitemap Validator for Liffey Founders Club
 * Validates the generated sitemap for common issues
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SITEMAP_PATH = join(__dirname, '../build/sitemap.xml');

// Validation rules
const validators = {
	exists: () => {
		if (!existsSync(SITEMAP_PATH)) {
			return { valid: false, message: '❌ Sitemap file not found at build/sitemap.xml' };
		}
		return { valid: true, message: '✅ Sitemap file exists' };
	},

	isXML: (content) => {
		if (!content.startsWith('<?xml version="1.0"')) {
			return { valid: false, message: '❌ Missing XML declaration' };
		}
		return { valid: true, message: '✅ Valid XML declaration' };
	},

	hasNamespaces: (content) => {
		const requiredNamespaces = [
			'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
			'xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"'
		];

		for (const ns of requiredNamespaces) {
			if (!content.includes(ns)) {
				return { valid: false, message: `❌ Missing namespace: ${ns}` };
			}
		}
		return { valid: true, message: '✅ All required namespaces present' };
	},

	hasURLs: (content) => {
		const urlMatches = content.match(/<url>/g);
		if (!urlMatches || urlMatches.length === 0) {
			return { valid: false, message: '❌ No URLs found in sitemap' };
		}
		return { valid: true, message: `✅ Found ${urlMatches.length} URLs` };
	},

	hasValidDates: (content) => {
		const datePattern = /<lastmod>(\d{4}-\d{2}-\d{2})<\/lastmod>/g;
		const dates = [...content.matchAll(datePattern)];
		
		if (dates.length === 0) {
			return { valid: false, message: '❌ No lastmod dates found' };
		}

		const today = new Date().toISOString().split('T')[0];
		const allCurrent = dates.every(match => match[1] === today);
		
		if (!allCurrent) {
			return { valid: false, message: `⚠️  Some dates are not current (should be ${today})` };
		}
		
		return { valid: true, message: `✅ All dates are current (${today})` };
	},

	hasImages: (content) => {
		const imageMatches = content.match(/<image:image>/g);
		if (!imageMatches || imageMatches.length === 0) {
			return { valid: false, message: '⚠️  No images found (optional but recommended)' };
		}
		return { valid: true, message: `✅ Found ${imageMatches.length} images` };
	},

	validURLStructure: (content) => {
		const urlPattern = /<loc>(https?:\/\/[^<]+)<\/loc>/g;
		const urls = [...content.matchAll(urlPattern)];
		
		const invalidURLs = urls.filter(match => {
			const url = match[1];
			return !url.startsWith('https://liffeyfoundersclub.com');
		});

		if (invalidURLs.length > 0) {
			return { 
				valid: false, 
				message: `❌ Invalid URLs found: ${invalidURLs.map(u => u[1]).join(', ')}` 
			};
		}
		return { valid: true, message: '✅ All URLs have correct domain' };
	}
};

// Run validation
try {
	console.log('🔍 Validating sitemap...\n');

	// Check if file exists first
	const existsResult = validators.exists();
	console.log(existsResult.message);
	
	if (!existsResult.valid) {
		console.log('\n💡 Tip: Run "pnpm run build" to generate the sitemap\n');
		process.exit(1);
	}

	// Read sitemap content
	const content = readFileSync(SITEMAP_PATH, 'utf-8');

	// Run all validators
	let allValid = true;
	const results = [];

	for (const [name, validator] of Object.entries(validators)) {
		if (name === 'exists') continue; // Already checked
		
		const result = validator(content);
		results.push(result);
		console.log(result.message);
		
		if (!result.valid && !result.message.includes('⚠️')) {
			allValid = false;
		}
	}

	// Summary
	console.log('\n' + '='.repeat(50));
	if (allValid) {
		console.log('✅ Sitemap validation PASSED');
		console.log(`📍 Location: ${SITEMAP_PATH}`);
		console.log('🚀 Ready for deployment!');
	} else {
		console.log('❌ Sitemap validation FAILED');
		console.log('Please fix the issues above before deploying.');
		process.exit(1);
	}
	console.log('='.repeat(50) + '\n');

} catch (error) {
	console.error('❌ Error validating sitemap:', error.message);
	process.exit(1);
}
