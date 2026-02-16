/**
 * SVG Export Utilities — extract, inline, and download charts.
 *
 * Provides functions to serialize SVG elements to strings, inline
 * computed styles for portability, and trigger browser downloads
 * as SVG or PNG. All functions are DOM-dependent (browser only).
 */

// ─── SVG TO STRING ───────────────────────────────────────────────────────────

/**
 * Serialize an SVG element to a string.
 *
 * @param svgElement - The SVG DOM element
 * @returns SVG markup string
 */
export function svgToString(svgElement: SVGSVGElement): string {
  const serializer = new XMLSerializer();
  let svgString = serializer.serializeToString(svgElement);

  // Ensure XML declaration and namespace
  if (!svgString.startsWith('<?xml')) {
    svgString = '<?xml version="1.0" encoding="UTF-8"?>\n' + svgString;
  }
  if (!svgString.includes('xmlns="http://www.w3.org/2000/svg"')) {
    svgString = svgString.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  return svgString;
}

// ─── INLINE STYLES ───────────────────────────────────────────────────────────

/** CSS properties to inline for portability */
const INLINE_PROPS = [
  'fill',
  'stroke',
  'stroke-width',
  'stroke-dasharray',
  'opacity',
  'font-family',
  'font-size',
  'font-weight',
  'text-anchor',
  'dominant-baseline',
  'transform',
] as const;

/**
 * Inline computed styles on all SVG child elements.
 *
 * This makes the SVG portable — it will look the same when opened
 * outside the original page context (e.g., in Illustrator, Figma).
 *
 * @param svgElement - The SVG DOM element to process (mutated in place)
 */
export function inlineStyles(svgElement: SVGSVGElement): void {
  const elements = svgElement.querySelectorAll('*');
  elements.forEach((el) => {
    const computed = getComputedStyle(el);
    const style = (el as SVGElement).style;
    for (const prop of INLINE_PROPS) {
      const value = computed.getPropertyValue(prop);
      if (value && value !== 'none' && value !== 'normal' && value !== '0px') {
        style.setProperty(prop, value);
      }
    }
  });
}

// ─── DOWNLOAD SVG ────────────────────────────────────────────────────────────

/**
 * Trigger a browser download of an SVG element as an .svg file.
 *
 * @param svgElement - The SVG DOM element
 * @param filename - Download filename (default 'chart.svg')
 * @param options - Optional: whether to inline styles first
 */
export function downloadSvg(
  svgElement: SVGSVGElement,
  filename = 'chart.svg',
  options?: { inlineStyles?: boolean }
): void {
  if (options?.inlineStyles !== false) {
    inlineStyles(svgElement);
  }

  const svgString = svgToString(svgElement);
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ─── SVG TO PNG ──────────────────────────────────────────────────────────────

/**
 * Convert an SVG element to a PNG data URL via canvas.
 *
 * @param svgElement - The SVG DOM element
 * @param scale - Resolution multiplier (default 2 for retina)
 * @returns Promise resolving to a PNG data URL string
 */
export function svgToPng(svgElement: SVGSVGElement, scale = 2): Promise<string> {
  return new Promise((resolve, reject) => {
    inlineStyles(svgElement);

    const svgString = svgToString(svgElement);
    const width = svgElement.width.baseVal.value || 800;
    const height = svgElement.height.baseVal.value || 500;

    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Canvas 2D context not available'));
      return;
    }

    ctx.scale(scale, scale);

    const img = new Image();
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/png'));
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load SVG into image'));
    };

    img.src = url;
  });
}
