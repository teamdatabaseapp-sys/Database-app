import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { MoreHorizontal, PauseCircle, PlayCircle, UserMinus } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

// ============================================
// AssignedClientRow
// Presentational row used inside the grouped promo client list.
// All logic (menu state, pause/resume/remove handlers) lives in the parent.
// ============================================

// Minimal shape — only the fields this component actually renders.
export interface AssignedClient {
  id: string;
  name: string;
  assignmentStatus: 'active' | 'paused';
}

interface AssignedClientRowProps {
  client: AssignedClient;
  index: number;
  isLastItem: boolean;
  isMenuOpen: boolean;
  isInProgress: boolean;
  isCompleted: boolean;
  onMenuToggle: () => void;
  onPause: () => void;
  onResume: () => void;
  onRemove: () => void;
  initials: string;
  primaryColor: string;
  borderColor: string;
  textColor: string;
  textSecondaryColor: string;
  textTertiaryColor: string;
  isDark: boolean;
  // Pre-translated labels
  pausedLabel: string;
  completedLabel: string;
  inProgressLabel: string;
  activeLabel: string;
  pauseLabel: string;
  resumeLabel: string;
  removeLabel: string;
}

export function AssignedClientRow({
  client,
  index,
  isLastItem,
  isMenuOpen,
  isInProgress,
  isCompleted,
  onMenuToggle,
  onPause,
  onResume,
  onRemove,
  initials,
  primaryColor,
  borderColor,
  textColor,
  textSecondaryColor,
  textTertiaryColor,
  isDark,
  pausedLabel,
  completedLabel,
  inProgressLabel,
  activeLabel,
  pauseLabel,
  resumeLabel,
  removeLabel,
}: AssignedClientRowProps) {
  const statusDotColor =
    client.assignmentStatus === 'paused' ? '#F59E0B'
    : isCompleted ? '#10B981'
    : isInProgress ? primaryColor
    : textTertiaryColor;

  const statusLabel =
    client.assignmentStatus === 'paused' ? pausedLabel
    : isCompleted ? completedLabel
    : isInProgress ? inProgressLabel
    : activeLabel;

  return (
    <Animated.View key={client.id} entering={FadeInDown.delay(index * 22).duration(180)}>
      <View style={{ borderBottomWidth: isLastItem ? 0 : 1, borderBottomColor: borderColor }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 }}>
          <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: `${primaryColor}20`, alignItems: 'center', justifyContent: 'center', marginRight: 10, flexShrink: 0 }}>
            <Text style={{ color: primaryColor, fontWeight: '700', fontSize: 11 }}>{initials}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: textColor, fontWeight: '600', fontSize: 14 }} numberOfLines={1}>{client.name}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: statusDotColor }} />
              <Text style={{ color: textTertiaryColor, fontSize: 12 }}>{statusLabel}</Text>
            </View>
          </View>
          <Pressable
            onPress={(e) => { e.stopPropagation?.(); onMenuToggle(); }}
            style={{ padding: 8 }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MoreHorizontal size={18} color={isMenuOpen ? primaryColor : textTertiaryColor} />
          </Pressable>
        </View>
        {isMenuOpen && (
          <Animated.View entering={FadeInDown.delay(0).duration(150)} style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingBottom: 12 }}>
            {/* Pause / Resume */}
            <Pressable
              onPress={client.assignmentStatus === 'active' ? onPause : onResume}
              style={{
                flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                paddingVertical: 9, borderRadius: 10,
                backgroundColor: client.assignmentStatus === 'active' ? (isDark ? '#1E293B' : '#F1F5F9') : `${primaryColor}15`,
                borderWidth: 1,
                borderColor: client.assignmentStatus === 'active' ? borderColor : `${primaryColor}30`,
              }}
            >
              {client.assignmentStatus === 'active'
                ? <PauseCircle size={13} color={textSecondaryColor} />
                : <PlayCircle size={13} color={primaryColor} />
              }
              <Text style={{ color: client.assignmentStatus === 'active' ? textSecondaryColor : primaryColor, fontSize: 12, fontWeight: '600' }}>
                {client.assignmentStatus === 'active' ? pauseLabel : resumeLabel}
              </Text>
            </Pressable>
            {/* Remove */}
            <Pressable
              onPress={onRemove}
              style={{
                flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                paddingVertical: 9, borderRadius: 10,
                backgroundColor: isDark ? '#7F1D1D30' : '#FEF2F2',
                borderWidth: 1, borderColor: '#FCA5A540',
              }}
            >
              <UserMinus size={13} color="#EF4444" />
              <Text style={{ color: '#EF4444', fontSize: 12, fontWeight: '600' }}>{removeLabel}</Text>
            </Pressable>
          </Animated.View>
        )}
      </View>
    </Animated.View>
  );
}
