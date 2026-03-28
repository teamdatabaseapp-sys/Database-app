import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Mail, Phone, ChevronRight } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '@/lib/ThemeContext';
import { formatPhoneDisplay } from '@/lib/phone-utils';
import { Client } from '@/lib/types';

interface ClientSearchItemProps {
  client: Client;
  index: number;
  onPress: () => void;
  isSelected?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  showEmail?: boolean;
  showPhone?: boolean;
  showChevron?: boolean;
  compact?: boolean;
}

/**
 * Get initials from client name
 * - If name has multiple words: First letter of first name + First letter of last name
 * - If name has only one word: First two letters of that word
 */
export function getClientInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }
  // Single name: use first two letters
  return name.slice(0, 2).toUpperCase();
}

/**
 * Sort clients alphabetically by first name
 */
export function sortClientsAlphabetically<T extends { name: string }>(clients: T[]): T[] {
  return [...clients].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Reusable client search item component with consistent design
 * Matches the main Clients page design
 */
export function ClientSearchItem({
  client,
  index,
  onPress,
  isSelected = false,
  disabled = false,
  disabledReason,
  showEmail = true,
  showPhone = true,
  showChevron = false,
  compact = false,
}: ClientSearchItemProps) {
  const { colors, isDark, primaryColor } = useTheme();

  const avatarSize = compact ? 44 : 52;
  const fontSize = compact ? 15 : 16;
  const padding = compact ? 14 : 16;

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 30).duration(200)}
    >
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={{
          backgroundColor: disabled
            ? isDark ? '#7F1D1D20' : '#FEE2E2'
            : colors.card,
          borderRadius: 16,
          padding: padding,
          marginBottom: 12,
          opacity: disabled ? 0.6 : 1,
          borderWidth: disabled || isSelected ? 1 : 0,
          borderColor: disabled ? '#EF4444' : isSelected ? primaryColor : 'transparent',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {/* Avatar */}
          <View
            style={{
              width: avatarSize,
              height: avatarSize,
              borderRadius: avatarSize / 2,
              backgroundColor: disabled ? '#EF444420' : `${primaryColor}15`,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              style={{
                color: disabled ? '#EF4444' : primaryColor,
                fontWeight: 'bold',
                fontSize: compact ? 16 : 18,
              }}
            >
              {getClientInitials(client.name)}
            </Text>
          </View>

          {/* Info */}
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text
              style={{
                color: disabled ? '#EF4444' : colors.text,
                fontWeight: '600',
                fontSize: fontSize,
              }}
            >
              {client.name}
            </Text>

            {disabled && disabledReason ? (
              <Text style={{ color: '#EF4444', fontSize: 13, marginTop: 2 }}>
                {disabledReason}
              </Text>
            ) : (
              <>
                {showEmail && client.email && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                    <Mail size={12} color={colors.textTertiary} />
                    <Text
                      style={{
                        color: colors.textTertiary,
                        fontSize: 14,
                        marginLeft: 6,
                        flex: 1,
                      }}
                      numberOfLines={1}
                    >
                      {client.email}
                    </Text>
                  </View>
                )}

                {showPhone && client.phone && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 1 }}>
                    <Phone size={12} color={colors.textTertiary} />
                    <Text
                      style={{
                        color: colors.textTertiary,
                        fontSize: 14,
                        marginLeft: 6,
                      }}
                    >
                      {formatPhoneDisplay(client.phone)}
                    </Text>
                  </View>
                )}
              </>
            )}
          </View>

          {/* Right side indicator */}
          {showChevron && !disabled && (
            <ChevronRight size={18} color={colors.textTertiary} />
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}
