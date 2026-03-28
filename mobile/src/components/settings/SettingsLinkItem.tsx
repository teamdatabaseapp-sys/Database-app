import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useTheme } from '@/lib/ThemeContext';

// ============================================
// SettingsLinkItem — reusable settings row
// ============================================

export interface SettingsLinkItemProps {
  /** Lucide icon element to render */
  icon: React.ReactNode;
  /** Primary row label */
  label: React.ReactNode;
  /** Optional subtitle shown below the label */
  subtitle?: React.ReactNode;
  /** Called when row is pressed */
  onPress: () => void;
  /**
   * Trailing element rendered at the end of the row.
   * Defaults to a ChevronRight icon.
   */
  trailing?: React.ReactNode;
  /**
   * When true, wraps the icon in a 40×40 rounded container
   * with a primaryColor tinted background (Layout A).
   * When false/omitted, renders the icon directly (Layout B).
   */
  iconWrapper?: boolean;
  /**
   * When true, the Pressable has `flexDirection: 'row'` at the
   * Pressable level (simple rows). When false/omitted the inner
   * content is wrapped in a nested row View (complex/toggle rows).
   * Defaults to true.
   */
  rowFlexDirect?: boolean;
  /** Background color override on the Pressable row */
  backgroundColor?: string;
  /** Whether to show the bottom border (default: true) */
  borderBottom?: boolean;
}

export function SettingsLinkItem({
  icon,
  label,
  subtitle,
  onPress,
  trailing,
  iconWrapper = false,
  rowFlexDirect = true,
  backgroundColor,
  borderBottom = true,
}: SettingsLinkItemProps) {
  const { colors, primaryColor } = useTheme();

  const trailingElement = trailing !== undefined
    ? trailing
    : <ChevronRight size={18} color={colors.textTertiary} />;

  const rowContent = (
    <>
      {iconWrapper ? (
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: `${primaryColor}15`,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
          }}
        >
          {icon}
        </View>
      ) : (
        icon
      )}
      <View style={{ flex: 1, ...(iconWrapper ? {} : { marginLeft: 12 }) }}>
        {typeof label === 'string' ? (
          <Text
            style={{
              color: colors.text,
              fontWeight: subtitle ? '600' : '500',
              fontSize: 15,
            }}
          >
            {label}
          </Text>
        ) : (
          label
        )}
        {subtitle !== undefined && (
          typeof subtitle === 'string' ? (
            <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 2 }}>
              {subtitle}
            </Text>
          ) : (
            subtitle
          )
        )}
      </View>
      {trailingElement}
    </>
  );

  if (rowFlexDirect) {
    return (
      <Pressable
        onPress={onPress}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: 16,
          ...(borderBottom ? { borderBottomWidth: 1, borderBottomColor: colors.border } : {}),
          ...(backgroundColor !== undefined ? { backgroundColor } : {}),
        }}
      >
        {rowContent}
      </Pressable>
    );
  }

  // rowFlexDirect=false: padding on Pressable, row in inner View (used by toggle rows)
  return (
    <Pressable
      onPress={onPress}
      style={{
        padding: 16,
        ...(borderBottom ? { borderBottomWidth: 1, borderBottomColor: colors.border } : {}),
        ...(backgroundColor !== undefined ? { backgroundColor } : {}),
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {rowContent}
      </View>
    </Pressable>
  );
}
