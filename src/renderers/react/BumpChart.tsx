/**
 * React component for the Bump Chart pattern.
 *
 * Since there's no standalone D3 renderer for bump-chart yet,
 * this component uses the HTML builder via a sandboxed iframe.
 */

import React, { useMemo } from 'react';
import type { ChartProps } from './types.js';
import { buildBumpChartHtml } from '../html/builders/bump-chart.js';

export function BumpChart({
  spec,
  width = 800,
  height = 500,
  className,
  onReady,
}: ChartProps) {
  const srcDoc = useMemo(() => buildBumpChartHtml(spec), [spec]);

  return (
    <iframe
      srcDoc={srcDoc}
      width={width}
      height={height}
      className={className}
      title={spec.title || 'Bump Chart'}
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
