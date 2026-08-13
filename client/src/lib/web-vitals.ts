/**
 * Web Vitals tracking for Core Web Vitals metrics
 * Measures and reports CLS, LCP, INP, TTFB to Sentry
 */

import * as Sentry from '@sentry/react';
import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from 'web-vitals';

export type WebVitalsMetric = {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
};

/**
 * Get rating for each metric based on Web Vitals thresholds
 * https://web.dev/articles/vitals
 */
function getMetricRating(metric: Metric): 'good' | 'needs-improvement' | 'poor' {
  const { name, value } = metric;
  
  switch (name) {
    case 'CLS':
      // Cumulative Layout Shift: good < 0.1, poor > 0.25
      return value < 0.1 ? 'good' : value > 0.25 ? 'poor' : 'needs-improvement';
    
    case 'INP':
      // Interaction to Next Paint: good < 200ms, poor > 500ms
      return value < 200 ? 'good' : value > 500 ? 'poor' : 'needs-improvement';
    
    case 'LCP':
      // Largest Contentful Paint: good < 2500ms, poor > 4000ms
      return value < 2500 ? 'good' : value > 4000 ? 'poor' : 'needs-improvement';
    
    case 'TTFB':
      // Time to First Byte: good < 800ms, poor > 1800ms
      return value < 800 ? 'good' : value > 1800 ? 'poor' : 'needs-improvement';
    
    case 'FCP':
      // First Contentful Paint: good < 1800ms, poor > 3000ms
      return value < 1800 ? 'good' : value > 3000 ? 'poor' : 'needs-improvement';
    
    default:
      return 'needs-improvement';
  }
}

/**
 * Send metric to Sentry as a measurement
 */
function sendToSentry(metric: Metric) {
  const rating = getMetricRating(metric);
  
  // Send as Sentry measurement
  Sentry.setMeasurement(metric.name, metric.value, 'millisecond');
  
  // Also log to console in development
  if (import.meta.env.MODE === 'development') {
    console.log(
      `[Web Vitals] ${metric.name}:`,
      Math.round(metric.value),
      `(${rating})`,
      metric
    );
  }
  
  // Track as custom event for poor ratings
  if (rating === 'poor') {
    Sentry.captureMessage(`Poor ${metric.name}: ${Math.round(metric.value)}`, {
      level: 'warning',
      tags: {
        web_vital: metric.name,
        rating,
      },
      contexts: {
        web_vitals: {
          name: metric.name,
          value: metric.value,
          rating,
          delta: metric.delta,
          id: metric.id,
        },
      },
    });
  }
}

/**
 * Initialize Web Vitals tracking
 * Call this once on app mount
 */
export function reportWebVitals() {
  try {
    // Core Web Vitals
    onCLS(sendToSentry); // Cumulative Layout Shift
    onINP(sendToSentry); // Interaction to Next Paint
    onLCP(sendToSentry); // Largest Contentful Paint
    onTTFB(sendToSentry); // Time to First Byte
    
    // Additional metrics
    onFCP(sendToSentry); // First Contentful Paint
    
    console.info('[Web Vitals] Tracking initialized');
  } catch (err) {
    console.error('[Web Vitals] Failed to initialize:', err);
  }
}

/**
 * Manually report a custom performance metric
 */
export function reportCustomMetric(name: string, value: number, unit = 'millisecond') {
  try {
    Sentry.setMeasurement(name, value, unit);
    
    if (import.meta.env.MODE === 'development') {
      console.log(`[Web Vitals] Custom metric: ${name} = ${value}${unit}`);
    }
  } catch (err) {
    console.error('[Web Vitals] Failed to report custom metric:', err);
  }
}
