/**
 * Sitemap Generator for Liffey Founders Club
 * Automatically generates sitemap.xml during build process
 */

import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const SITE_URL = 'https://liffeyfoundersclub.com';
const BUILD_DIR = join(__dirname, '../build');
const OUTPUT_FILE = join(BUILD_DIR, 'sitemap.xml');

// Get current date in YYYY-MM-DD format
const getCurrentDate = () => {
	const now = new Date();
	return now.toISOString().split('T')[0];
};

// Define your site's routes with metadata
const routes = [
	{
		path: '/',
		changefreq: 'weekly',
		priority: 1.0,
		images: [
			{
				loc: `${SITE_URL}/img/logo/Liffey_Founders_Club_Logo.png`,
				title: 'Liffey Founders Club Logo',
				caption: "Dublin's premier startup community for founders and entrepreneurs"
			}
		]
	},
	{
		path: '/pitch',
		changefreq: 'monthly',
		priority: 0.9,
		images: [
			{
				loc: `${SITE_URL}/img/logo/Liffey_Founders_Club_Logo.png`,
				title: 'Liffey Founders Club - Startup Pitches',
				caption: 'Watch innovative startup pitches from our community'
			}
		]
	},
	{
		path: '/learnMore',
		changefreq: 'monthly',
		priority: 0.8,
		images: [
			{
				loc: `${SITE_URL}/img/logo/Liffey_Founders_Club_Logo.png`,
				title: 'Liffey Founders Club - Join Community',
				caption: 'Register for upcoming events and join our founder community'
			}
		]
	}
];

// Generate XML for a single URL entry
const generateUrlEntry = (route, lastmod) => {
	const imageXml = route.images
		? route.images
				.map(
					(img) => `
    <image:image>
      <image:loc>${img.loc}</image:loc>
      <image:title>${img.title}</image:title>
      <image:caption>${img.caption}</image:caption>
    </image:image>`
				)
				.join('')
		: '';

	return `
  <url>
    <loc>${SITE_URL}${route.path}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>${imageXml}
  </url>`;
};

// Generate the complete sitemap
const generateSitemap = () => {
	const lastmod = getCurrentDate();

	const urlEntries = routes.map((route) => generateUrlEntry(route, lastmod)).join('');

	const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
  ${urlEntries}
</urlset>`;

	return sitemap;
};

// Main execution
try {
	console.log('🗺️  Generating sitemap...');
	const sitemap = generateSitemap();
	writeFileSync(OUTPUT_FILE, sitemap, 'utf-8');
	console.log(`✅ Sitemap generated successfully at: ${OUTPUT_FILE}`);
	console.log(`📅 Last modified date: ${getCurrentDate()}`);
	console.log(`📄 Total URLs: ${routes.length}`);
} catch (error) {
	console.error('❌ Error generating sitemap:', error);
	process.exit(1);
}
