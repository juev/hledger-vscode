const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, 'images', 'icon.png');
const outputPath = path.join(__dirname, 'images', 'icon-optimized.png');

async function optimizeIcon() {
  const originalSize = fs.statSync(inputPath).size;
  
  await sharp(inputPath)
    .resize(128, 128, { fit: 'inside' })
    .png({ compressionLevel: 9 })
    .toFile(outputPath);
  
  const optimizedSize = fs.statSync(outputPath).size;
  
  console.log(`Original size: ${(originalSize / 1024).toFixed(2)} KB`);
  console.log(`Optimized size: ${(optimizedSize / 1024).toFixed(2)} KB`);
  console.log(`Reduction: ${(((originalSize - optimizedSize) / originalSize) * 100).toFixed(2)}%`);
  
  // Replace original with optimized
  fs.copyFileSync(outputPath, inputPath);
  fs.unlinkSync(outputPath);
  console.log('Icon optimized successfully!');
}

optimizeIcon().catch(err => {
  console.error('Error optimizing icon:', err);
  process.exit(1);
});
