/**
 * React component for the Choropleth Map pattern.
 * Uses the HTML builder via a sandboxed iframe.
 */

import React, { useMemo } from 'react';
import type { ChartProps } from './types.js';
import { buildChoroplethHtml } from '../html/builders/choropleth.js';

export function Choropleth({
  spec,
  width = 800,
  height = 500,
  className,
  onReady,
}: ChartProps) {
  const srcDoc = useMemo(() => buildChoroplethHtml(spec), [spec]);

  return (
    <iframe
      srcDoc={srcDoc}
      width={width}
      height={height}
      className={className}
      title={spec.title || 'Choropleth Map'}
      style={{ border: 'none', display: 'block' }}
      sandbox="allow-scripts"
      ref={(el) => {
        if (el && onReady) {
          el.addEventListener('load', () => onReady(el as unknown as HTMLDivElement), { once: true });
        }
      }}
    />
  );
}
