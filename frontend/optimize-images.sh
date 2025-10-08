#!/bin/bash

# Image Optimization Script for Liffey Founders Club
# Compresses large JPG images to reasonable sizes for web

echo "🖼️  Image Optimization Script"
echo "=============================="
echo ""

# Check if ImageMagick is installed
if ! command -v convert &> /dev/null; then
    echo "❌ ImageMagick not found!"
    echo ""
    echo "Install it with:"
    echo "  Ubuntu/Debian: sudo apt-get install imagemagick"
    echo "  macOS: brew install imagemagick"
    echo "  Fedora: sudo dnf install ImageMagick"
    exit 1
fi

# Directory containing images
IMG_DIR="./static/img/event_june"
BACKUP_DIR="./static/img/event_june_originals"

echo "📁 Image directory: $IMG_DIR"
echo ""

# Create backup of originals
if [ ! -d "$BACKUP_DIR" ]; then
    echo "📦 Creating backup of original images..."
    mkdir -p "$BACKUP_DIR"
    cp "$IMG_DIR"/*.jpg "$BACKUP_DIR/" 2>/dev/null || true
    echo "✅ Backup created in: $BACKUP_DIR"
    echo ""
fi

# Count images
IMG_COUNT=$(ls "$IMG_DIR"/*.jpg 2>/dev/null | wc -l)
if [ "$IMG_COUNT" -eq 0 ]; then
    echo "❌ No JPG images found in $IMG_DIR"
    exit 1
fi

echo "🔍 Found $IMG_COUNT images to optimize"
echo ""

# Optimize each image
TOTAL_BEFORE=0
TOTAL_AFTER=0

for img in "$IMG_DIR"/*.jpg; do
    filename=$(basename "$img")
    
    # Get original size
    size_before=$(du -h "$img" | cut -f1)
    bytes_before=$(du -b "$img" | cut -f1)
    TOTAL_BEFORE=$((TOTAL_BEFORE + bytes_before))
    
    echo "🔄 Optimizing: $filename ($size_before)"
    
    # Optimize image:
    # - Resize to max 1920px width (preserves aspect ratio)
    # - Quality 85% (good balance between size and quality)
    # - Strip metadata
    # - Progressive JPEG for faster loading
    convert "$img" \
        -resize '1920x1920>' \
        -quality 85 \
        -strip \
        -interlace Plane \
        "$img.tmp" && mv "$img.tmp" "$img"
    
    # Get new size
    size_after=$(du -h "$img" | cut -f1)
    bytes_after=$(du -b "$img" | cut -f1)
    TOTAL_AFTER=$((TOTAL_AFTER + bytes_after))
    
    # Calculate savings
    bytes_saved=$((bytes_before - bytes_after))
    percent_saved=$((100 * bytes_saved / bytes_before))
    
    echo "   ✅ Done: $size_after (saved ${percent_saved}%)"
    echo ""
done

# Calculate total savings
TOTAL_SAVED=$((TOTAL_BEFORE - TOTAL_AFTER))
PERCENT_SAVED=$((100 * TOTAL_SAVED / TOTAL_BEFORE))
TOTAL_BEFORE_MB=$((TOTAL_BEFORE / 1024 / 1024))
TOTAL_AFTER_MB=$((TOTAL_AFTER / 1024 / 1024))
TOTAL_SAVED_MB=$((TOTAL_SAVED / 1024 / 1024))

echo "=============================="
echo "📊 Optimization Summary"
echo "=============================="
echo "Images optimized: $IMG_COUNT"
echo "Total before:     ${TOTAL_BEFORE_MB}MB"
echo "Total after:      ${TOTAL_AFTER_MB}MB"
echo "Total saved:      ${TOTAL_SAVED_MB}MB (${PERCENT_SAVED}%)"
echo ""
echo "✅ Optimization complete!"
echo ""
echo "💡 Tip: Your original images are backed up in:"
echo "   $BACKUP_DIR"
echo ""
