import React from 'react';
import { View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';

interface DataBaseLogoProps {
  size?: 'small' | 'medium' | 'large';
  showText?: boolean;
  variant?: 'light' | 'dark' | 'auto';
}

// Pre-require the image to ensure it's bundled and cached
const logoSource = require('../../public/image-1769784304.png');

// Logo natural aspect ratio: 5669 × 3898 px → w/h ≈ 1.454
const ASPECT_RATIO = 5669 / 3898;

// Max widths per size — used as cap; actual width is min(screenWidth - padding, maxWidth)
const maxWidths = {
  small: 230,
  medium: 322,
  large: 391,
};

export function DataBaseLogo({ size = 'medium' }: DataBaseLogoProps) {
  const { width: screenWidth } = useWindowDimensions();
  const maxW = maxWidths[size];
  // Leave 48px of horizontal breathing room (24px each side)
  const imageWidth = Math.min(screenWidth - 48, maxW);
  const imageHeight = imageWidth / ASPECT_RATIO;

  return (
    <View style={{ alignItems: 'center', width: '100%' }}>
      <Image
        source={logoSource}
        style={{ width: imageWidth, height: imageHeight }}
        contentFit="contain"
        cachePolicy="memory-disk"
        priority="high"
      />
    </View>
  );
}
