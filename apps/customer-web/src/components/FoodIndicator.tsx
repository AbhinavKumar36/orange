'use client';

import React from 'react';

interface FoodIndicatorProps {
  classification?: 'vegetarian' | 'non_vegetarian' | string | null;
  size?: number;
  showLabel?: boolean;
  className?: string;
}

/**
 * Standard Indian FSSAI Food Classification Indicator.
 * - Vegetarian: Green square border with a filled green circle inside.
 * - Non-Vegetarian: Red square border with a filled red triangle inside.
 * - Null / Unclassified: Renders nothing (never assumes vegetarian).
 */
export function FoodIndicator({
  classification,
  size = 16,
  showLabel = false,
  className = '',
}: FoodIndicatorProps) {
  if (!classification) {
    return null;
  }

  const isVeg = classification === 'vegetarian';
  const isNonVeg = classification === 'non_vegetarian';

  if (!isVeg && !isNonVeg) {
    return null;
  }

  const color = isVeg ? '#168A45' : '#D32F2F';
  const label = isVeg ? 'Vegetarian' : 'Non-Vegetarian';
  const innerSize = Math.max(Math.round(size * 0.45), 6);

  return (
    <span
      className={`food-classification-indicator ${className}`}
      title={label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.4rem',
        verticalAlign: 'middle',
      }}
    >
      <span
        role="img"
        aria-label={label}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: `${size}px`,
          height: `${size}px`,
          border: `1.5px solid ${color}`,
          borderRadius: '3px',
          padding: '2px',
          backgroundColor: '#FFFFFF',
          flexShrink: 0,
          boxSizing: 'border-box',
        }}
      >
        {isVeg ? (
          <span
            style={{
              width: `${innerSize}px`,
              height: `${innerSize}px`,
              borderRadius: '50%',
              backgroundColor: color,
              display: 'block',
            }}
          />
        ) : (
          <span
            style={{
              width: 0,
              height: 0,
              borderLeft: `${innerSize / 2}px solid transparent`,
              borderRight: `${innerSize / 2}px solid transparent`,
              borderBottom: `${innerSize}px solid ${color}`,
              display: 'block',
            }}
          />
        )}
      </span>
      {showLabel && (
        <span
          style={{
            fontSize: '0.75rem',
            fontWeight: 500,
            color: 'var(--color-text-muted)',
            letterSpacing: '0.02em',
          }}
        >
          {label}
        </span>
      )}
    </span>
  );
}
