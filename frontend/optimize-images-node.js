#!/usr/bin/env node

/**
 * Image Optimization Script using Sharp (Node.js)
 * No external dependencies like ImageMagick required!
 */

const fs = require('fs');
const path = require('path');

console.log('🖼️  Image Optimization Script (Node.js)');
console.log('==========================================');
console.log('');

// Check if sharp is available
let sharp;
try {
  sharp = require('sharp');
} catch (err) {
  console.log('❌ Sharp package not found!');
  console.log('');
  console.log('Install it with:');
  console.log('  npm install sharp');
  console.log('');
  console.log('Or run this script:');
  console.log('  cd frontend');
  console.log('  npm install sharp');
  console.log('  node optimize-images-node.js');
  process.exit(1);
}

const IMG_DIR = path.join(__dirname, 'static', 'img', 'event_june');
const BACKUP_DIR = path.join(__dirname, 'static', 'img', 'event_june_originals');

console.log(`📁 Image directory: ${IMG_DIR}`);
console.log('');

// Create backup directory
if (!fs.existsSync(BACKUP_DIR)) {
  console.log('📦 Creating backup of original images...');
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  
  // Copy originals to backup
  const files = fs.readdirSync(IMG_DIR).filter(f => f.endsWith('.jpg'));
  files.forEach(file => {
    fs.copyFileSync(
      path.join(IMG_DIR, file),
      path.join(BACKUP_DIR, file)
    );
  });
  console.log(`✅ Backup created in: ${BACKUP_DIR}`);
  console.log('');
}

// Get all JPG files
const images = fs.readdirSync(IMG_DIR).filter(f => f.endsWith('.jpg'));

if (images.length === 0) {
  console.log(`❌ No JPG images found in ${IMG_DIR}`);
  process.exit(1);
}

console.log(`🔍 Found ${images.length} images to optimize`);
console.log('');

// Optimization statistics
let totalBefore = 0;
let totalAfter = 0;

// Process images sequentially
async function optimizeImages() {
  for (const filename of images) {
    const filePath = path.join(IMG_DIR, filename);
    const tempPath = path.join(IMG_DIR, `${filename}.tmp`);
    
    // Get original size
    const statsBefore = fs.statSync(filePath);
    const sizeMB = (statsBefore.size / 1024 / 1024).toFixed(2);
    totalBefore += statsBefore.size;
    
    console.log(`🔄 Optimizing: ${filename} (${sizeMB}MB)`);
    
    try {
      // Optimize with Sharp
      await sharp(filePath)
        .resize(1920, 1920, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({
          quality: 85,
          progressive: true,
          mozjpeg: true
        })
        .withMetadata({
          density: 72 // Standard web density
        })
        .toFile(tempPath);
      
      // Replace original with optimized
      fs.unlinkSync(filePath);
      fs.renameSync(tempPath, filePath);
      
      // Get new size
      const statsAfter = fs.statSync(filePath);
      const sizeAfterMB = (statsAfter.size / 1024 / 1024).toFixed(2);
      totalAfter += statsAfter.size;
      
      // Calculate savings
      const saved = statsBefore.size - statsAfter.size;
      const percentSaved = ((saved / statsBefore.size) * 100).toFixed(0);
      
      console.log(`   ✅ Done: ${sizeAfterMB}MB (saved ${percentSaved}%)`);
      console.log('');
    } catch (err) {
      console.log(`   ❌ Error: ${err.message}`);
      console.log('');
      // Clean up temp file if it exists
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    }
  }
  
  // Print summary
  const totalBeforeMB = (totalBefore / 1024 / 1024).toFixed(2);
  const totalAfterMB = (totalAfter / 1024 / 1024).toFixed(2);
  const totalSavedMB = (totalBefore - totalAfter) / 1024 / 1024;
  const percentSaved = ((totalBefore - totalAfter) / totalBefore * 100).toFixed(0);
  
  console.log('==========================================');
  console.log('📊 Optimization Summary');
  console.log('==========================================');
  console.log(`Images optimized: ${images.length}`);
  console.log(`Total before:     ${totalBeforeMB}MB`);
  console.log(`Total after:      ${totalAfterMB}MB`);
  console.log(`Total saved:      ${totalSavedMB.toFixed(2)}MB (${percentSaved}%)`);
  console.log('');
  console.log('✅ Optimization complete!');
  console.log('');
  console.log('💡 Tip: Your original images are backed up in:');
  console.log(`   ${BACKUP_DIR}`);
  console.log('');
}

// Run optimization
optimizeImages().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
