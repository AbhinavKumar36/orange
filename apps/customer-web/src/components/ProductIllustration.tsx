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
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-hidden="true"
        style={{ width: '65%', height: '65%' }}
      >
        {/* Shadow */}
        <ellipse cx="100" cy="180" rx="45" ry="8" fill="#E8DFD3" />
        {/* Glass Bottle Body */}
        <path
          d="M75 75 L75 165 C75 172 80 176 87 176 L113 176 C120 176 125 172 125 165 L125 75 C125 65 118 60 115 52 L115 35 L85 35 L85 52 C82 60 75 65 75 75 Z"
          fill="#FFF"
          stroke="#D87834"
          strokeWidth="3"
        />
        {/* Juice Fill (Vibrant Orange Liquid) */}
        <path
          d="M78 88 L78 165 C78 170 82 173 87 173 L113 173 C118 173 122 170 122 165 L122 88 Q100 92 78 88 Z"
          fill="#FF7A00"
        />
        {/* Juice Highlights */}
        <path
          d="M83 95 L83 162"
          stroke="#FFB066"
          strokeWidth="3"
          strokeLinecap="round"
        />
        {/* Bottle Cap */}
        <rect x="83" y="24" width="34" height="11" rx="3" fill="#D87834" />
        <line x1="83" y1="29" x2="117" y2="29" stroke="#B85818" strokeWidth="1.5" />
        {/* Citrus Slice Badge on Bottle */}
        <circle cx="100" cy="130" r="14" fill="#FFC72C" />
        <circle cx="100" cy="130" r="11" fill="#FF9E1B" stroke="#FFF" strokeWidth="1" />
        <line x1="100" y1="119" x2="100" y2="141" stroke="#FFF" strokeWidth="1.5" />
        <line x1="89" y1="130" x2="111" y2="130" stroke="#FFF" strokeWidth="1.5" />
        <line x1="92" y1="122" x2="108" y2="138" stroke="#FFF" strokeWidth="1.5" />
        <line x1="92" y1="138" x2="108" y2="122" stroke="#FFF" strokeWidth="1.5" />
      </svg>
    );
  }

  // 2. Gourmet Chocolates & Confections
  if (slug.includes('chocolate') || lowerName.includes('chocolate') || lowerName.includes('praline')) {
    return (
      <svg
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-hidden="true"
        style={{ width: '65%', height: '65%' }}
      >
        {/* Shadow */}
        <ellipse cx="100" cy="170" rx="55" ry="10" fill="#E8DFD3" />
        {/* Chocolate Box Base */}
        <rect x="45" y="115" width="110" height="45" rx="8" fill="#4A2810" />
        <rect x="45" y="110" width="110" height="10" rx="3" fill="#663A1E" />
        {/* Gold Ribbon on Box */}
        <rect x="95" y="110" width="10" height="50" fill="#D4AF37" />
        {/* Praline 1 (Dome) */}
        <ellipse cx="75" cy="95" rx="16" ry="12" fill="#2E180A" />
        <ellipse cx="75" cy="92" rx="13" ry="9" fill="#4A2810" />
        <path d="M68 90 Q75 85 82 90" stroke="#D4AF37" strokeWidth="1.5" strokeLinecap="round" />
        {/* Praline 2 (Pyramid / Swirl) */}
        <ellipse cx="125" cy="95" rx="16" ry="12" fill="#2E180A" />
        <ellipse cx="125" cy="92" rx="13" ry="9" fill="#5A3215" />
        <circle cx="125" cy="90" r="3" fill="#D4AF37" />
        {/* Centerpiece Truffle */}
        <ellipse cx="100" cy="80" rx="18" ry="14" fill="#241308" />
        <ellipse cx="100" cy="76" rx="15" ry="11" fill="#3D1F0C" />
        <path d="M92 74 Q100 68 108 74" stroke="#FF7A00" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  // 3. Default: Artisanal Cake (Tiered Chocolate Sponge with Berries)
  return (
    <svg
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      style={{ width: '65%', height: '65%' }}
    >
      {/* Plate Shadow & Rim */}
      <ellipse cx="100" cy="168" rx="65" ry="12" fill="#E8DFD3" />
      <ellipse cx="100" cy="162" rx="60" ry="8" fill="#FFFFFF" stroke="#E2D7C9" strokeWidth="2" />
      {/* Cake Bottom Sponge Layer */}
      <path
        d="M50 125 C50 125 50 152 50 152 C50 158 72 163 100 163 C128 163 150 158 150 152 L150 125 Z"
        fill="#3D2314"
      />
      {/* Cream Filling Midline */}
      <ellipse cx="100" cy="125" rx="50" ry="11" fill="#FF8A3D" />
      {/* Cake Top Layer */}
      <path
        d="M50 100 C50 100 50 125 50 125 C50 131 72 136 100 136 C128 136 150 131 150 125 L150 100 Z"
        fill="#2B180D"
      />
      {/* Ganache Glaze Top Surface */}
      <ellipse cx="100" cy="100" rx="50" ry="11" fill="#4A2818" />
      {/* Ganache Drips */}
      <path d="M65 106 Q67 118 70 112 Q73 106 75 106" fill="#4A2818" />
      <path d="M125 106 Q128 122 131 114 Q134 106 136 106" fill="#4A2818" />
      {/* Topping: Orange Slice & Berries */}
      <circle cx="92" cy="90" r="5" fill="#C41E3A" />
      <circle cx="108" cy="91" r="5" fill="#800020" />
      <circle cx="100" cy="85" r="5.5" fill="#D72638" />
      <path
        d="M90 82 C90 82 100 70 115 76 C115 76 105 88 90 82 Z"
        fill="#FF7A00"
        stroke="#E65100"
        strokeWidth="1"
      />
    </svg>
  );
}

