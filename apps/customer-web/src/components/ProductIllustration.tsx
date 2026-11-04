'use client';

import type { ReactElement } from 'react';

interface ProductIllustrationProps {
  categorySlug?: string;
  name?: string;
  className?: string;
}

export function ProductIllustration({
  categorySlug = '',
  name = '',
  className = '',
}: ProductIllustrationProps): ReactElement {
  const slug = categorySlug.toLowerCase();
  const lowerName = name.toLowerCase();

  // 1. Cold-Pressed Juices
  if (slug.includes('juice') || lowerName.includes('juice') || lowerName.includes('orange')) {
    return (
      <svg
        viewBox="0 0 240 240"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-hidden="true"
        style={{ width: '75%', height: '75%', filter: 'drop-shadow(0 16px 24px rgba(255, 102, 0, 0.15))' }}
      >
        <defs>
          <radialGradient id="juiceAmbientGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FF9436" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#FF5500" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="juiceLiquidGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFA63A" />
            <stop offset="50%" stopColor="#FF6E00" />
            <stop offset="100%" stopColor="#D84800" />
          </linearGradient>
          <linearGradient id="glassReflection" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.6" />
            <stop offset="20%" stopColor="#FFFFFF" stopOpacity="0.1" />
            <stop offset="80%" stopColor="#FFFFFF" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.4" />
          </linearGradient>
          <linearGradient id="goldCapGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFE082" />
            <stop offset="50%" stopColor="#D4AF37" />
            <stop offset="100%" stopColor="#997A15" />
          </linearGradient>
        </defs>

        {/* Ambient Warm Atmosphere */}
        <circle cx="120" cy="130" r="85" fill="url(#juiceAmbientGlow)" />

        {/* Soft Contact Shadow */}
        <ellipse cx="120" cy="210" rx="55" ry="10" fill="#1C140E" fillOpacity="0.25" />
        <ellipse cx="120" cy="210" rx="35" ry="6" fill="#1C140E" fillOpacity="0.35" />

        {/* Decanter Outer Glass Wall */}
        <path
          d="M90 70 L90 190 C90 198 96 204 104 204 L136 204 C144 204 150 198 150 190 L150 70 C150 58 142 52 138 42 L138 28 L102 28 L102 42 C98 52 90 58 90 70 Z"
          fill="#FFFDF9"
          fillOpacity="0.12"
          stroke="#D87834"
          strokeWidth="2.5"
        />

        {/* Pure Cold-Pressed Liquid Fill */}
        <path
          d="M93 84 L93 190 C93 196 98 201 104 201 L136 201 C142 201 147 196 147 190 L147 84 Q120 90 93 84 Z"
          fill="url(#juiceLiquidGrad)"
        />

        {/* Glass Specular Highlights */}
        <path
          d="M90 70 L90 190 C90 198 96 204 104 204 L136 204 C144 204 150 198 150 190 L150 70 C150 58 142 52 138 42 L138 28 L102 28 L102 42 C98 52 90 58 90 70 Z"
          fill="url(#glassReflection)"
        />

        {/* Vertical Liquid Light Beam */}
        <path d="M99 92 L99 188" stroke="#FFE2B8" strokeWidth="3" strokeLinecap="round" strokeOpacity="0.85" />
        <path d="M104 100 L104 175" stroke="#FFE2B8" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.6" />

        {/* Golden Fluted Cap */}
        <rect x="99" y="16" width="42" height="15" rx="4" fill="url(#goldCapGrad)" />
        <line x1="102" y1="21" x2="138" y2="21" stroke="#997A15" strokeWidth="1.5" />
        <line x1="102" y1="26" x2="138" y2="26" stroke="#FFE082" strokeWidth="1.5" />

        {/* Signature Citrus Monogram Seal */}
        <circle cx="120" cy="145" r="18" fill="url(#goldCapGrad)" filter="drop-shadow(0 4px 6px rgba(0,0,0,0.2))" />
        <circle cx="120" cy="145" r="15" fill="#FF7700" stroke="#FFF" strokeWidth="1.2" />
        <circle cx="120" cy="145" r="4" fill="#FFE082" />
        <line x1="120" y1="133" x2="120" y2="157" stroke="#FFF" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="108" y1="145" x2="132" y2="145" stroke="#FFF" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="111" y1="136" x2="129" y2="154" stroke="#FFF" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="111" y1="154" x2="129" y2="136" stroke="#FFF" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }

  // 2. Gourmet Chocolates & Confections
  if (slug.includes('chocolate') || lowerName.includes('chocolate') || lowerName.includes('praline')) {
    return (
      <svg
        viewBox="0 0 240 240"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-hidden="true"
        style={{ width: '75%', height: '75%', filter: 'drop-shadow(0 16px 24px rgba(60, 25, 10, 0.25))' }}
      >
        <defs>
          <radialGradient id="chocGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#1A0D06" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="boxGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3D1E0E" />
            <stop offset="100%" stopColor="#1F0D05" />
          </linearGradient>
          <linearGradient id="goldRibbon" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFE082" />
            <stop offset="50%" stopColor="#D4AF37" />
            <stop offset="100%" stopColor="#AA8518" />
          </linearGradient>
        </defs>

        <circle cx="120" cy="120" r="90" fill="url(#chocGlow)" />
        <ellipse cx="120" cy="195" rx="65" ry="12" fill="#140A04" fillOpacity="0.4" />

        {/* Luxury Confectionery Presentation Box */}
        <rect x="50" y="130" width="140" height="55" rx="10" fill="url(#boxGrad)" stroke="#592C15" strokeWidth="2" />
        <rect x="47" y="124" width="146" height="12" rx="4" fill="#522711" stroke="#6B3519" strokeWidth="1" />

        {/* Gold Ribbon & Crest */}
        <rect x="114" y="124" width="12" height="61" fill="url(#goldRibbon)" />
        <circle cx="120" cy="124" r="8" fill="url(#goldRibbon)" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.3))" />

        {/* Truffle 1: Dark Ganache Dome */}
        <ellipse cx="88" cy="110" rx="20" ry="15" fill="#140904" />
        <ellipse cx="88" cy="106" rx="17" ry="11" fill="#2E1509" />
        <path d="M78 104 Q88 98 98 104" stroke="url(#goldRibbon)" strokeWidth="2" strokeLinecap="round" />

        {/* Truffle 2: Golden Pyramid */}
        <polygon points="152,88 136,114 168,114" fill="#3D1D0D" stroke="url(#goldRibbon)" strokeWidth="1.5" />
        <polygon points="152,88 152,114 168,114" fill="#291207" />
        <circle cx="152" cy="88" r="3.5" fill="url(#goldRibbon)" />

        {/* Centerpiece Artisan Truffle */}
        <ellipse cx="120" cy="92" rx="22" ry="17" fill="#120703" />
        <ellipse cx="120" cy="88" rx="18" ry="13" fill="#33170B" />
        <path d="M110 85 Q120 78 130 85" stroke="#FF7700" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="120" cy="84" r="2.5" fill="#FFE082" />
      </svg>
    );
  }

  // 3. Default: Artisanal Cake (Tiered Dark Chocolate Ganache Cake)
  return (
    <svg
      viewBox="0 0 240 240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      style={{ width: '75%', height: '75%', filter: 'drop-shadow(0 18px 26px rgba(40, 18, 8, 0.3))' }}
    >
      <defs>
        <radialGradient id="cakeAtmosphere" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FF7700" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#1E0E06" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="cakeMirrorGlaze" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3D180A" />
          <stop offset="50%" stopColor="#1F0B04" />
          <stop offset="100%" stopColor="#120602" />
        </linearGradient>
        <linearGradient id="plateRim" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#F5ECE0" />
          <stop offset="50%" stopColor="#FFFDFC" />
          <stop offset="100%" stopColor="#E2D4C3" />
        </linearGradient>
        <linearGradient id="orangeGarnish" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFA63A" />
          <stop offset="100%" stopColor="#E05500" />
        </linearGradient>
      </defs>

      <circle cx="120" cy="115" r="90" fill="url(#cakeAtmosphere)" />

      {/* Presentation Pedestal Stand & Shadows */}
      <ellipse cx="120" cy="202" rx="78" ry="14" fill="#140904" fillOpacity="0.35" />
      <ellipse cx="120" cy="195" rx="74" ry="10" fill="url(#plateRim)" stroke="#D4C2B0" strokeWidth="2" />
      <ellipse cx="120" cy="194" rx="68" ry="7" fill="#F0E5D7" />

      {/* Dark Chocolate Sponge Layer (Bottom) */}
      <path
        d="M58 148 C58 148 58 180 58 180 C58 188 86 194 120 194 C154 194 182 188 182 180 L182 148 Z"
        fill="#261107"
      />

      {/* Silky Ganache Cream Mid-Ring */}
      <ellipse cx="120" cy="148" rx="62" ry="13" fill="#E86E20" />

      {/* Dark Chocolate Top Tier Layer */}
      <path
        d="M58 118 C58 118 58 148 58 148 C58 156 86 162 120 162 C154 162 182 156 182 148 L182 118 Z"
        fill="#1C0C05"
      />

      {/* Mirror Glaze Top Surface with Reflection */}
      <ellipse cx="120" cy="118" rx="62" ry="13" fill="url(#cakeMirrorGlaze)" stroke="#592510" strokeWidth="1" />
      <ellipse cx="120" cy="116" rx="56" ry="10" fill="#381507" fillOpacity="0.5" />

      {/* Mirror Ganache Gloss Highlight */}
      <path
        d="M80 114 Q120 110 160 114"
        stroke="#FFF"
        strokeWidth="2"
        strokeLinecap="round"
        strokeOpacity="0.35"
      />

      {/* Ganache Drips */}
      <path d="M76 124 Q79 140 82 132 Q85 124 88 124" fill="#1C0C05" />
      <path d="M148 124 Q152 144 156 135 Q160 124 163 124" fill="#1C0C05" />
      <path d="M115 126 Q118 138 121 133 Q124 126 126 126" fill="#1C0C05" />

      {/* Garnishes: Candied Orange Slice & Fresh Berries */}
      <circle cx="108" cy="106" r="6" fill="#B3122B" filter="drop-shadow(0 2px 3px rgba(0,0,0,0.3))" />
      <circle cx="132" cy="107" r="6" fill="#6B0B1A" filter="drop-shadow(0 2px 3px rgba(0,0,0,0.3))" />
      <circle cx="120" cy="100" r="7" fill="#D71B39" filter="drop-shadow(0 2px 3px rgba(0,0,0,0.4))" />

      {/* Candied Valencia Orange Crescent */}
      <path
        d="M106 96 C106 96 120 80 140 88 C140 88 126 104 106 96 Z"
        fill="url(#orangeGarnish)"
        stroke="#B33E00"
        strokeWidth="1.5"
        filter="drop-shadow(0 3px 6px rgba(0,0,0,0.35))"
      />
      <circle cx="122" cy="99" r="1.5" fill="#FFE082" />
    </svg>
  );
}
