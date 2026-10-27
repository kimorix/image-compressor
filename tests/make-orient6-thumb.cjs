// Generator for tests/orient6-thumb.jpg (NOT shipped to the repo):
// 1600x1200 stored JPEG + EXIF Orientation=6 (display 1200x1600) +
// Make + GPS + embedded thumbnail. Mirrors how gps.jpg was made.
const fs = require('fs');
const piexif = require('/home/hatch/workspace/image-compressor/node_modules/piexifjs');
const { execSync } = require('child_process');
// Small JPEG thumbnail via PIL.
execSync(`python3 -c "from PIL import Image; im = Image.open('/home/hatch/workspace/image-compressor/tests/test.jpg'); im.resize((160, 120)).save('/tmp/orient6-thumb-small.jpg', quality=75)"`);
const base = fs.readFileSync('/home/hatch/workspace/image-compressor/tests/test.jpg', 'binary');
const thumb = fs.readFileSync('/tmp/orient6-thumb-small.jpg', 'binary');
const exifObj = {
  '0th': {
    [piexif.ImageIFD.Make]: 'TestCamera',
    [piexif.ImageIFD.Orientation]: 6,
  },
  Exif: {},
  GPS: {
    [piexif.GPSIFD.GPSLatitudeRef]: 'N',
    [piexif.GPSIFD.GPSLatitude]: [[31, 1], [12, 1], [0, 1]],
    [piexif.GPSIFD.GPSLongitudeRef]: 'E',
    [piexif.GPSIFD.GPSLongitude]: [[121, 1], [29, 1], [0, 1]],
  },
  '1st': {
    [piexif.ImageIFD.Compression]: 6,
  },
  thumbnail: thumb,
};
const out = piexif.insert(piexif.dump(exifObj), base);
fs.writeFileSync('/home/hatch/workspace/image-compressor/tests/orient6-thumb.jpg', out, 'binary');
// Verify round-trip.
const check = piexif.load(fs.readFileSync('/home/hatch/workspace/image-compressor/tests/orient6-thumb.jpg', 'binary'));
console.log('ori:', check['0th'][piexif.ImageIFD.Orientation],
  'make:', check['0th'][piexif.ImageIFD.Make],
  'gps:', Object.keys(check.GPS || {}).length,
  '1st:', Object.keys(check['1st'] || {}).length,
  'thumbBytes:', (check.thumbnail || '').length);
