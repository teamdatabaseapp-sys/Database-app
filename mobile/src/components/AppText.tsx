/**
 * AppText — Global base text component
 *
 * RULES (enforced globally):
 *  - flexShrink: 1  → allows text to compress rather than overflow its container
 *  - minWidth: 0    → lets flexbox shrink below intrinsic width (critical in row layouts)
 *
 * Use this component everywhere instead of raw <Text> when the text lives
 * inside a flex row that could be space-constrained.
 *
 * For label columns that must NEVER compress (e.g. day names), use the
 * `noShrink` prop — it sets flexShrink:0 so the text always shows in full
 * and takes only as much width as its content needs (no fixed px widths).
 */

import React from 'react';
import { Text, TextProps, StyleSheet } from 'react-native';

interface AppTextProps extends TextProps {
  /** When true, text column will NOT shrink — use for labels that must always be fully visible (e.g. day names). */
  noShrink?: boolean;
}

export function AppText({ style, noShrink = false, ...props }: AppTextProps) {
  return (
    <Text
      style={[noShrink ? styles.noShrink : styles.base, style]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  /** Default: shrinks gracefully in constrained row layouts */
  base: {
    flexShrink: 1,
    minWidth: 0,
  },
  /** Label columns: auto-size to content, never compress, never overflow */
  noShrink: {
    flexShrink: 0,
    minWidth: 0,
  },
});
