/**
 * LegalContentRenderer
 *
 * Renders a parsed legal content string with proper visual hierarchy:
 *   - Numbered subsection headings get the grey rounded container (Title Case)
 *   - Body paragraphs / bullets render as plain text
 *
 * This is the single source-of-truth renderer used by ALL legal document
 * viewers in the app.  Drop it wherever you previously had:
 *   <Text>{someRawLegalString}</Text>
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { parseLegalContent } from '@/lib/legal-content-parser';
import { useTheme } from '@/lib/ThemeContext';

interface LegalContentRendererProps {
  content: string;
  /** Optional override for body text color */
  bodyColor?: string;
  /** Optional override for heading text color */
  headingColor?: string;
  /** Optional override for heading background color */
  headingBg?: string;
}

export function LegalContentRenderer({
  content,
  bodyColor,
  headingColor,
  headingBg,
}: LegalContentRendererProps) {
  const { colors, isDark } = useTheme();

  const blocks = useMemo(() => parseLegalContent(content), [content]);

  const resolvedBodyColor = bodyColor ?? colors.textSecondary;
  const resolvedHeadingColor = headingColor ?? (isDark ? colors.text : '#374151');
  const resolvedHeadingBg = headingBg ?? (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)');

  return (
    <>
      {blocks.map((block, index) => {
        if (block.type === 'heading') {
          return (
            <View
              key={index}
              style={[
                styles.headingContainer,
                {
                  backgroundColor: resolvedHeadingBg,
                  marginTop: index === 0 ? 0 : 16,
                },
              ]}
            >
              <Text
                style={[
                  styles.headingText,
                  { color: resolvedHeadingColor },
                ]}
              >
                {block.num}. {block.title}
              </Text>
            </View>
          );
        }

        // body block — only render if non-empty
        const trimmed = block.text.trim();
        if (!trimmed) return null;

        return (
          <Text
            key={index}
            style={[
              styles.bodyText,
              { color: resolvedBodyColor },
            ]}
          >
            {trimmed}
          </Text>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  headingContainer: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  headingText: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 4,
  },
});
