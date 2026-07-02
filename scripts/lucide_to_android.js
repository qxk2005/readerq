const fs = require('fs');
const path = require('path');

const ICON_DIR = path.join(__dirname, '../node_modules/lucide-react/dist/esm/icons');

// Parse arguments: node lucide_to_android.js <lucide-icon-name> <output-xml-path>
const iconName = process.argv[2];
const outputPath = process.argv[3];

if (!iconName || !outputPath) {
  console.error("Usage: node lucide_to_android.js <icon-name> <output-xml-path>");
  process.exit(1);
}

function getIconNode(name) {
  let filePath = path.join(ICON_DIR, `${name}.mjs`);
  if (!fs.existsSync(filePath)) {
    // Try camelCase just in case (e.g., refresh-cw -> refreshCw)
    const camel = name.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
    filePath = path.join(ICON_DIR, `${camel}.mjs`);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Icon file not found: ${name} (tried ${filePath})`);
    }
  }

  let content = fs.readFileSync(filePath, 'utf8');

  // Handle aliases like: export { default } from './house.mjs';
  const aliasMatch = content.match(/export\s+\{\s*default\s*\}\s+from\s+['"]\.\/([^'"]+)\.mjs['"]/);
  if (aliasMatch) {
    const aliasName = aliasMatch[1];
    return getIconNode(aliasName);
  }

  // Extract __iconNode array
  const nodeMatch = content.match(/const\s+__iconNode\s*=\s*(\[[\s\S]*?\]);/);
  if (!nodeMatch) {
    throw new Error(`__iconNode not found in ${filePath}`);
  }

  try {
    // Safely evaluate the array since we trust local node_modules structure
    const fn = new Function(`return ${nodeMatch[1]}`);
    return fn();
  } catch (err) {
    throw new Error(`Failed to evaluate __iconNode from ${filePath}: ${err.message}`);
  }
}

function convertToAndroidVector(nodes) {
  let xml = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp"
    android:height="24dp"
    android:viewportWidth="24"
    android:viewportHeight="24">
`;

  for (const [tag, attrs] of nodes) {
    let pathData = '';

    if (tag === 'path') {
      pathData = attrs.d;
    } else if (tag === 'circle') {
      const cx = parseFloat(attrs.cx);
      const cy = parseFloat(attrs.cy);
      const r = parseFloat(attrs.r);
      pathData = `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 -${r * 2} 0`;
    } else if (tag === 'rect') {
      const x = parseFloat(attrs.x || 0);
      const y = parseFloat(attrs.y || 0);
      const w = parseFloat(attrs.width || 0);
      const h = parseFloat(attrs.height || 0);
      const rx = parseFloat(attrs.rx || attrs.ry || 0);
      const ry = parseFloat(attrs.ry || attrs.rx || 0);
      if (rx > 0 || ry > 0) {
        pathData = `M ${x + rx} ${y} h ${w - 2 * rx} a ${rx} ${ry} 0 0 1 ${rx} ${ry} v ${h - 2 * ry} a ${rx} ${ry} 0 0 1 -${rx} ${ry} h -${w - 2 * rx} a ${rx} ${ry} 0 0 1 -${rx} -${ry} v -${h - 2 * ry} a ${rx} ${ry} 0 0 1 ${rx} -${ry} Z`;
      } else {
        pathData = `M ${x} ${y} h ${w} v ${h} h -${w} Z`;
      }
    } else if (tag === 'line') {
      const x1 = attrs.x1;
      const y1 = attrs.y1;
      const x2 = attrs.x2;
      const y2 = attrs.y2;
      pathData = `M ${x1} ${y1} L ${x2} ${y2}`;
    } else if (tag === 'polyline') {
      const pts = attrs.points.trim().split(/[\s,]+/).filter(Boolean);
      if (pts.length >= 2) {
        pathData = `M ${pts[0]} ${pts[1]}`;
        for (let i = 2; i < pts.length; i += 2) {
          pathData += ` L ${pts[i]} ${pts[i + 1]}`;
        }
      }
    } else if (tag === 'polygon') {
      const pts = attrs.points.trim().split(/[\s,]+/).filter(Boolean);
      if (pts.length >= 2) {
        pathData = `M ${pts[0]} ${pts[1]}`;
        for (let i = 2; i < pts.length; i += 2) {
          pathData += ` L ${pts[i]} ${pts[i + 1]}`;
        }
        pathData += ' Z';
      }
    } else if (tag === 'ellipse') {
      const cx = parseFloat(attrs.cx);
      const cy = parseFloat(attrs.cy);
      const rx = parseFloat(attrs.rx);
      const ry = parseFloat(attrs.ry);
      pathData = `M ${cx - rx} ${cy} a ${rx} ${ry} 0 1 0 ${rx * 2} 0 a ${rx} ${ry} 0 1 0 -${rx * 2} 0`;
    } else {
      console.warn(`Warning: Unhandled tag <${tag}> in icon ${iconName}`);
      continue;
    }

    if (pathData) {
      xml += `    <path
        android:pathData="${pathData}"
        android:fillColor="#00000000"
        android:strokeColor="#FF000000"
        android:strokeWidth="2"
        android:strokeLineCap="round"
        android:strokeLineJoin="round" />
`;
    }
  }

  xml += `</vector>\n`;
  return xml;
}

try {
  const nodes = getIconNode(iconName);
  const xmlContent = convertToAndroidVector(nodes);
  
  // Ensure target folder exists
  const parentDir = path.dirname(outputPath);
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, xmlContent, 'utf8');
  console.log(`Successfully converted '${iconName}' to '${outputPath}'`);
} catch (e) {
  console.error(`Error converting icon '${iconName}':`, e.message);
  process.exit(1);
}
