/**
 * ClientTimelineModal
 *
 * Stripe-style unified client timeline showing all events across all value
 * systems (appointments, loyalty, gift cards, memberships, promotion counters).
 *
 * Features:
 *  - Chronological feed with source-system colored icons
 *  - Human-readable summaries with amount badges
 *  - Investigation mode toggle — reveals raw technical fields per event
 *  - Lazy loaded — fetches only when the modal is opened
 *  - Load-more pagination
 *  - Graceful degradation if the RPC migration is not yet applied
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import {
  X,
  Calendar,
  Star,
  Gift,
  Crown,
  Target,
  ChevronDown,
  Search,
  Terminal,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Clock,
} from 'lucide-react-native';
import { useTheme } from '@/lib/ThemeContext';
import { useClientTimeline } from '@/hooks/useClientTimeline';
import type { TimelineEvent, TimelineSourceSystem } from '@/services/clientTimelineService';
import { format, formatDistanceToNow, isToday, isYesterday, isThisYear } from 'date-fns';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClientTimelineModalProps {
  clientId: string | undefined;
  clientName: string;
  isVisible: boolean;
  onClose: () => void;
}

// ─── Source system configuration ─────────────────────────────────────────────

const SOURCE_CONFIG: Record<
  TimelineSourceSystem,
  { color: string; bgColor: string; darkBg: string; label: string; Icon: React.ComponentType<{ size: number; color: string }> }
> = {
  appointment: {
    color: '#3B82F6',
    bgColor: '#EFF6FF',
    darkBg: '#1e3a5f',
    label: 'Appointment',
    Icon: Calendar,
  },
  loyalty: {
    color: '#F59E0B',
    bgColor: '#FFFBEB',
    darkBg: '#422006',
    label: 'Loyalty',
    Icon: Star,
  },
  gift_card: {
    color: '#EC4899',
    bgColor: '#FDF2F8',
    darkBg: '#4a1942',
    label: 'Gift Card',
    Icon: Gift,
  },
  membership: {
    color: '#8B5CF6',
    bgColor: '#F5F3FF',
    darkBg: '#2e1065',
    label: 'Membership',
    Icon: Crown,
  },
  membership_credit: {
    color: '#6D28D9',
    bgColor: '#F5F3FF',
    darkBg: '#2e1065',
    label: 'Membership',
    Icon: Crown,
  },
  promotion_counter: {
    color: '#10B981',
    bgColor: '#ECFDF5',
    darkBg: '#064e3b',
    label: 'Promotion',
    Icon: Target,
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatEventDate(isoString: string): string {
  const d = new Date(isoString);
  if (isToday(d)) return `Today · ${format(d, 'h:mm a')}`;
  if (isYesterday(d)) return `Yesterday · ${format(d, 'h:mm a')}`;
  if (isThisYear(d)) return format(d, 'MMM d · h:mm a');
  return format(d, 'MMM d, yyyy · h:mm a');
}

function groupEventsByDate(events: TimelineEvent[]): Array<{ label: string; events: TimelineEvent[] }> {
  const groups: Map<string, TimelineEvent[]> = new Map();
  for (const ev of events) {
    const d = new Date(ev.event_at);
    let key: string;
    if (isToday(d)) key = 'Today';
    else if (isYesterday(d)) key = 'Yesterday';
    else if (isThisYear(d)) key = format(d, 'MMMM d');
    else key = format(d, 'MMMM d, yyyy');

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(ev);
  }
  return Array.from(groups.entries()).map(([label, events]) => ({ label, events }));
}

function AmountBadge({
  amount,
  currency,
  eventType,
  isDark,
}: {
  amount: number | null;
  currency: string | null;
  eventType: string;
  isDark: boolean;
}) {
  if (amount === null || amount === undefined) return null;

  const isPositive =
    eventType.includes('earn') ||
    eventType.includes('redeem') ||
    eventType.includes('load') ||
    eventType.includes('enroll') ||
    eventType.includes('add') ||
    eventType.includes('stamp');

  const isNegative =
    eventType.includes('spend') ||
    eventType.includes('debit') ||
    eventType.includes('cancel') ||
    eventType.includes('expire');

  const sign = isNegative ? '-' : isPositive ? '+' : '';
  const displayAmount = currency
    ? `${sign}${currency} ${Math.abs(amount).toFixed(2)}`
    : `${sign}${Math.abs(amount)}`;

  const bg = isNegative
    ? isDark ? '#3f1515' : '#FEF2F2'
    : isDark ? '#064e3b' : '#ECFDF5';
  const color = isNegative ? '#EF4444' : '#10B981';

  return (
    <View style={{ backgroundColor: bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color, fontVariant: ['tabular-nums'] }}>
        {displayAmount}
      </Text>
    </View>
  );
}

// ─── Investigation panel ──────────────────────────────────────────────────────

function InvestigationPanel({
  event,
  isDark,
}: {
  event: TimelineEvent;
  isDark: boolean;
}) {
  const bgColor = isDark ? '#0F1115' : '#F8FAFC';
  const borderColor = isDark ? '#2D3139' : '#E2E8F0';
  const labelColor = isDark ? '#6B7280' : '#94A3B8';
  const valueColor = isDark ? '#EDEDED' : '#1E293B';
  const dimColor = isDark ? '#4B5563' : '#CBD5E1';

  const rows: Array<[string, string | null | undefined]> = [
    ['event_id', event.event_id],
    ['source_system', event.source_system],
    ['event_type', event.event_type],
    ['event_at', event.event_at],
    ['reference_id', event.reference_id],
    ['reference_label', event.reference_label],
    ['actor_id', event.actor_id],
  ];

  return (
    <View
      style={{
        marginTop: 8,
        backgroundColor: bgColor,
        borderWidth: 1,
        borderColor,
        borderRadius: 8,
        padding: 10,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 4 }}>
        <Terminal size={11} color={dimColor} />
        <Text style={{ fontSize: 10, fontWeight: '600', color: dimColor, textTransform: 'uppercase', letterSpacing: 0.8 }}>
          Investigation
        </Text>
      </View>

      {rows.map(([key, value]) => (
        <View key={key} style={{ flexDirection: 'row', marginBottom: 4, gap: 8 }}>
          <Text style={{ fontSize: 11, color: labelColor, fontFamily: 'monospace', width: 110, flexShrink: 0 }}>
            {key}
          </Text>
          <Text style={{ fontSize: 11, color: value ? valueColor : dimColor, fontFamily: 'monospace', flex: 1 }}>
            {value ?? '—'}
          </Text>
        </View>
      ))}

      {event.metadata && Object.keys(event.metadata).length > 0 && (
        <View style={{ marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderColor }}>
          <Text style={{ fontSize: 10, color: dimColor, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4, fontWeight: '600' }}>
            metadata
          </Text>
          {Object.entries(event.metadata).map(([k, v]) => (
            <View key={k} style={{ flexDirection: 'row', marginBottom: 3, gap: 8 }}>
              <Text style={{ fontSize: 11, color: labelColor, fontFamily: 'monospace', width: 110, flexShrink: 0 }}>
                {k}
              </Text>
              <Text style={{ fontSize: 11, color: v != null ? valueColor : dimColor, fontFamily: 'monospace', flex: 1 }}>
                {v === null || v === undefined ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Single event row ─────────────────────────────────────────────────────────

function EventRow({
  event,
  investigationMode,
  isDark,
}: {
  event: TimelineEvent;
  investigationMode: boolean;
  isDark: boolean;
}) {
  const cfg = SOURCE_CONFIG[event.source_system] ?? SOURCE_CONFIG.appointment;
  const IconComp = cfg.Icon;
  const iconBg = isDark ? cfg.darkBg : cfg.bgColor;
  const cardBg = isDark ? '#1A1D23' : '#FFFFFF';
  const borderColor = isDark ? '#2D3139' : '#F1F5F9';
  const textColor = isDark ? '#EDEDED' : '#1E293B';
  const subtextColor = isDark ? '#9CA3AF' : '#64748B';

  return (
    <Animated.View entering={FadeInDown.duration(200)}>
      <View
        style={{
          backgroundColor: cardBg,
          borderWidth: 1,
          borderColor,
          borderRadius: 12,
          padding: 12,
          marginBottom: 8,
          flexDirection: 'column',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
          {/* Icon */}
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: iconBg,
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              marginTop: 2,
            }}
          >
            <IconComp size={17} color={cfg.color} />
          </View>

          {/* Content */}
          <View style={{ flex: 1, gap: 3 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: textColor, flex: 1, lineHeight: 20 }}>
                {event.summary}
              </Text>
              <AmountBadge
                amount={event.amount}
                currency={event.currency}
                eventType={event.event_type}
                isDark={isDark}
              />
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ backgroundColor: iconBg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                <Text style={{ fontSize: 10, fontWeight: '600', color: cfg.color, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {cfg.label}
                </Text>
              </View>
              <Text style={{ fontSize: 12, color: subtextColor }}>
                {formatEventDate(event.event_at)}
              </Text>
            </View>
          </View>
        </View>

        {/* Investigation panel */}
        {investigationMode && (
          <InvestigationPanel event={event} isDark={isDark} />
        )}
      </View>
    </Animated.View>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export function ClientTimelineModal({
  clientId,
  clientName,
  isVisible,
  onClose,
}: ClientTimelineModalProps) {
  const { isDark, theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [investigationMode, setInvestigationMode] = useState(false);

  const { events, isLoading, isFetchingMore, hasMore, isError, migrationPending, loadMore } =
    useClientTimeline(clientId, isVisible);

  const handleClose = useCallback(() => {
    setInvestigationMode(false);
    onClose();
  }, [onClose]);

  const groups = groupEventsByDate(events);

  // ── Colors ────────────────────────────────────────────────────────────────

  const bgModal = isDark ? '#0F1115' : '#F8FAFC';
  const bgHeader = isDark ? '#1A1D23' : '#FFFFFF';
  const borderColor = isDark ? '#2D3139' : '#E2E8F0';
  const textPrimary = isDark ? '#EDEDED' : '#1E293B';
  const textSecondary = isDark ? '#9CA3AF' : '#64748B';
  const textTertiary = isDark ? '#6B7280' : '#94A3B8';
  const investigationActive = isDark ? '#1e3a5f' : '#EFF6FF';
  const investigationActiveBorder = isDark ? '#3B82F6' : '#BFDBFE';

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={{ flex: 1, backgroundColor: bgModal }}>
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View
          style={{
            backgroundColor: bgHeader,
            borderBottomWidth: 1,
            borderBottomColor: borderColor,
            paddingTop: insets.top + 12,
            paddingBottom: 12,
            paddingHorizontal: 16,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: textPrimary }}>
                Timeline
              </Text>
              <Text style={{ fontSize: 13, color: textSecondary, marginTop: 1 }}>
                {clientName}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {/* Investigation mode toggle */}
              <Pressable
                onPress={() => setInvestigationMode(v => !v)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 8,
                  borderWidth: 1,
                  backgroundColor: investigationMode ? investigationActive : 'transparent',
                  borderColor: investigationMode ? investigationActiveBorder : borderColor,
                }}
              >
                <Terminal size={13} color={investigationMode ? '#3B82F6' : textSecondary} />
                <Text style={{ fontSize: 12, fontWeight: '600', color: investigationMode ? '#3B82F6' : textSecondary }}>
                  Inspect
                </Text>
              </Pressable>

              {/* Close */}
              <Pressable
                onPress={handleClose}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: isDark ? '#252932' : '#F1F5F9',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={16} color={textSecondary} />
              </Pressable>
            </View>
          </View>

          {investigationMode && (
            <Animated.View entering={FadeIn.duration(200)}>
              <View
                style={{
                  marginTop: 10,
                  backgroundColor: investigationActive,
                  borderWidth: 1,
                  borderColor: investigationActiveBorder,
                  borderRadius: 8,
                  paddingHorizontal: 10,
                  paddingVertical: 7,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Search size={12} color="#3B82F6" />
                <Text style={{ fontSize: 12, color: '#3B82F6', fontWeight: '500', flex: 1 }}>
                  Investigation mode — raw event fields visible below each event
                </Text>
              </View>
            </Animated.View>
          )}
        </View>

        {/* ── Body ───────────────────────────────────────────────────────── */}
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Loading state */}
          {isLoading && (
            <View style={{ alignItems: 'center', paddingTop: 60, gap: 12 }}>
              <ActivityIndicator color={textSecondary} />
              <Text style={{ fontSize: 14, color: textSecondary }}>Loading timeline…</Text>
            </View>
          )}

          {/* Migration not applied yet */}
          {!isLoading && migrationPending && (
            <View style={{ alignItems: 'center', paddingTop: 60, gap: 12, paddingHorizontal: 24 }}>
              <View style={{
                width: 56, height: 56, borderRadius: 16,
                backgroundColor: isDark ? '#422006' : '#FFFBEB',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Clock size={26} color="#F59E0B" />
              </View>
              <Text style={{ fontSize: 16, fontWeight: '700', color: textPrimary, textAlign: 'center' }}>
                Timeline Coming Soon
              </Text>
              <Text style={{ fontSize: 14, color: textSecondary, textAlign: 'center', lineHeight: 20 }}>
                Apply migration 20260325000002 in the Supabase SQL Editor to enable the unified timeline.
              </Text>
            </View>
          )}

          {/* Error state */}
          {!isLoading && isError && !migrationPending && (
            <View style={{ alignItems: 'center', paddingTop: 60, gap: 12 }}>
              <AlertCircle size={32} color={theme.error} />
              <Text style={{ fontSize: 14, color: textSecondary, textAlign: 'center' }}>
                Failed to load timeline. Please try again.
              </Text>
            </View>
          )}

          {/* Empty state */}
          {!isLoading && !isError && !migrationPending && events.length === 0 && (
            <View style={{ alignItems: 'center', paddingTop: 60, gap: 12 }}>
              <View style={{
                width: 56, height: 56, borderRadius: 16,
                backgroundColor: isDark ? '#252932' : '#F1F5F9',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Clock size={26} color={textTertiary} />
              </View>
              <Text style={{ fontSize: 16, fontWeight: '700', color: textPrimary }}>No activity yet</Text>
              <Text style={{ fontSize: 14, color: textSecondary, textAlign: 'center' }}>
                Events will appear here once this client has appointments, loyalty points, gift cards, or memberships.
              </Text>
            </View>
          )}

          {/* Event groups */}
          {!isLoading && !isError && groups.map(group => (
            <View key={group.label} style={{ marginBottom: 8 }}>
              {/* Group label */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: textTertiary, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                  {group.label}
                </Text>
                <View style={{ flex: 1, height: 1, backgroundColor: borderColor }} />
              </View>

              {/* Events */}
              {group.events.map(ev => (
                <EventRow
                  key={ev.event_id}
                  event={ev}
                  investigationMode={investigationMode}
                  isDark={isDark}
                />
              ))}
            </View>
          ))}

          {/* Load more */}
          {hasMore && !isLoading && (
            <Pressable
              onPress={loadMore}
              disabled={isFetchingMore}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                marginTop: 8,
                paddingVertical: 14,
                borderRadius: 12,
                borderWidth: 1,
                borderColor,
                backgroundColor: isDark ? '#1A1D23' : '#FFFFFF',
              }}
            >
              {isFetchingMore
                ? <ActivityIndicator size="small" color={textSecondary} />
                : <>
                    <ChevronDown size={16} color={textSecondary} />
                    <Text style={{ fontSize: 14, fontWeight: '600', color: textSecondary }}>Load more events</Text>
                  </>
              }
            </Pressable>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}
