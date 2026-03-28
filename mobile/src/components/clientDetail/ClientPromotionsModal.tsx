/**
 * ClientPromotionsModal
 *
 * Unified client promotion dashboard.
 * Two sections:
 *   1. Assigned Promotions — marketing promotions from client_promotion_assignments
 *   2. Punch Cards         — counter-based programs from promotion_counters
 *
 * Replaces the old shallow "Select Promotion" picker and the separate
 * "Promotion Counter" modal. Everything promotion-related for a client
 * is managed from one place.
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Tag,
  Award,
  Plus,
  X,
  Check,
  ChevronRight,
  Trash2,
  Clock,
  Play,
  Pause,
} from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { format } from 'date-fns';
import { t } from '@/lib/i18n';
import { getCachedDateFnsLocale } from '@/lib/i18n';
import { Language, MarketingPromotion, CurrencyCode } from '@/lib/types';
import { PromoAssignmentRow } from '@/services/promotionAssignmentsService';
import { formatCurrency } from '@/lib/currency';
import type { ClientPromotionUsed } from '@/services/promotionRedemptionsService';

// ─── Local shape for a promotion counter (computed in ClientDetailScreen) ─────

export interface LocalCounter {
  id: string;
  promotionId: string | null;
  currentCount: number;
  targetCount: number;
  isCompleted: boolean;
  createdAt: Date;
  promotion?: {
    id: string;
    name: string;
    color: string;
    discountType?: string;
    discountValue?: number;
  } | null;
  _isDbBacked: boolean;
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface ThemeColors {
  background: string;
  card: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  border: string;
  backgroundTertiary: string;
  [key: string]: string;
}

interface ClientPromotionsModalProps {
  visible: boolean;
  onClose: () => void;
  clientId: string;
  language: Language;
  colors: ThemeColors;
  isDark: boolean;
  primaryColor: string;
  currency: CurrencyCode;
  // Data
  clientAssignments: PromoAssignmentRow[];     // status != 'removed', for this client
  marketingPromotions: MarketingPromotion[];
  clientLoyaltyPrograms: LocalCounter[];
  clientPromotionsUsed: ClientPromotionUsed[]; // redemption history from promotion_redemptions
  // Assignment actions
  onAssignPromo: (promotionId: string) => void;
  onPausePromo: (promotionId: string) => void;
  onResumePromo: (promotionId: string) => void;
  onRemovePromo: (promotionId: string) => void;
  // Counter actions
  onOpenAddCounter: () => void;
  onAddCount: (counterId: string) => void;
  onViewHistory: (counterId: string) => void;
  onDeleteCounter: (counterId: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function discountText(
  promo: MarketingPromotion | undefined,
  language: Language,
  currency: CurrencyCode
): string {
  if (!promo) return '';
  switch (promo.discountType) {
    case 'percentage':
      return `${promo.discountValue}${t('percentOff', language)}`;
    case 'fixed':
      return `${formatCurrency(promo.discountValue, currency)} ${t('fixedOff', language)}`;
    case 'free_service':
      return t('freeAfterServices', language).replace('{count}', String(promo.freeServiceAfter ?? ''));
    case 'other':
      return promo.otherDiscountDescription ?? '';
    default:
      return '';
  }
}

function formatShortDate(date: string | Date, language: Language): string {
  try {
    const locale = getCachedDateFnsLocale(language);
    return format(typeof date === 'string' ? new Date(date) : date, 'MMM d, yyyy', { locale });
  } catch {
    return '';
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ClientPromotionsModal({
  visible,
  onClose,
  clientId: _clientId,
  language,
  colors,
  isDark,
  primaryColor,
  currency,
  clientAssignments,
  marketingPromotions,
  clientLoyaltyPrograms,
  clientPromotionsUsed,
  onAssignPromo,
  onPausePromo,
  onResumePromo,
  onRemovePromo,
  onOpenAddCounter,
  onAddCount,
  onViewHistory,
  onDeleteCounter,
}: ClientPromotionsModalProps) {
  const [showAssignPicker, setShowAssignPicker] = useState(false);
  // Inline confirm states — avoids Alert.alert() inside pageSheet (crashes on iOS)
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // STRICT SEPARATION: counter promotions (free_service) must NEVER appear in the
  // "Assigned Promotions" section — they belong exclusively in the Punch Cards section.
  const nonCounterAssignments = useMemo(
    () => clientAssignments.filter((a) => {
      const promo = marketingPromotions.find((p) => p.id === a.promotion_id);
      return promo?.discountType !== 'free_service';
    }),
    [clientAssignments, marketingPromotions]
  );

  // Promotions available to assign (active, not already assigned with active status,
  // AND not a counter/free_service type)
  const assignedActiveIds = useMemo(
    () => new Set(nonCounterAssignments.filter((a) => a.status === 'active').map((a) => a.promotion_id)),
    [nonCounterAssignments]
  );
  const availableToAssign = useMemo(
    () => marketingPromotions.filter(
      (p) => p.isActive && !assignedActiveIds.has(p.id) && p.discountType !== 'free_service'
    ),
    [marketingPromotions, assignedActiveIds]
  );

  const totalCount = nonCounterAssignments.length + clientLoyaltyPrograms.length;

  // ─── Sub-components (inline so they share theme closures without prop drilling) ─

  const SectionHeader = ({ icon, label, count }: { icon: React.ReactNode; label: string; count: number }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 10 }}>
      <View style={{
        width: 30,
        height: 30,
        borderRadius: 9,
        backgroundColor: isDark ? `${primaryColor}25` : `${primaryColor}12`,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {icon}
      </View>
      <Text style={{
        color: colors.textSecondary,
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        flex: 1,
      }}>
        {label}
      </Text>
      {count > 0 && (
        <View style={{
          backgroundColor: `${primaryColor}20`,
          borderRadius: 10,
          paddingHorizontal: 9,
          paddingVertical: 3,
        }}>
          <Text style={{ color: primaryColor, fontSize: 11, fontWeight: '700' }}>{count}</Text>
        </View>
      )}
    </View>
  );

  const StatusBadge = ({ status }: { status: string }) => {
    const isPaused = status === 'paused';
    const bg = isPaused
      ? (isDark ? colors.backgroundTertiary : '#F1F5F9')
      : `${primaryColor}20`;
    const textColor = isPaused ? colors.textSecondary : primaryColor;
    const label = isPaused ? t('paused', language) : status === 'completed' ? t('completed', language) : t('active', language);
    return (
      <View style={{ backgroundColor: bg, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 3 }}>
        <Text style={{ color: textColor, fontSize: 11, fontWeight: '700' }}>{label}</Text>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>

        {/* ── Header ── */}
        <Animated.View
          entering={FadeIn.duration(250)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingVertical: 16,
            backgroundColor: colors.card,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}15`,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 12,
            }}>
              <Tag size={22} color={primaryColor} />
            </View>
            <View>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>
                {t('promotions', language)}
              </Text>
              <Text style={{ color: colors.textTertiary, fontSize: 13 }}>
                {totalCount > 0
                  ? `${totalCount} ${totalCount === 1 ? t('marketingPromo', language) : t('promotions', language).toLowerCase()}`
                  : t('noPromotion', language)}
              </Text>
            </View>
          </View>
          <Pressable
            onPress={onClose}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={20} color={colors.textSecondary} />
          </Pressable>
        </Animated.View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>

          {/* ══════════════════════════════════════════════
              SECTION 1 — ASSIGNED PROMOTIONS
              ══════════════════════════════════════════════ */}
          <SectionHeader
            icon={<Tag size={16} color={primaryColor} />}
            label={t('assignedPromos', language)}
            count={nonCounterAssignments.length}
          />

          {nonCounterAssignments.length === 0 && (
            <Animated.View
              entering={FadeInDown.duration(200)}
              style={{
                backgroundColor: colors.card,
                borderRadius: 14,
                padding: 24,
                marginBottom: 12,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <View style={{
                width: 60,
                height: 60,
                borderRadius: 30,
                backgroundColor: isDark ? `${primaryColor}20` : `${primaryColor}10`,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 12,
              }}>
                <Tag size={28} color={primaryColor} style={{ opacity: 0.6 }} />
              </View>
              <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600', marginBottom: 4 }}>
                {t('noPromotion', language)}
              </Text>
              <Text style={{ color: colors.textTertiary, fontSize: 13, textAlign: 'center' }}>
                {t('assignMarketingPromotion', language)}
              </Text>
            </Animated.View>
          )}

          {nonCounterAssignments.map((assignment, idx) => {
            const promo = marketingPromotions.find((p) => p.id === assignment.promotion_id);
            const promoColor = promo?.color || primaryColor;
            const desc = discountText(promo, language, currency);
            const isActive = assignment.status === 'active';
            const isConfirmingRemove = confirmRemoveId === assignment.promotion_id;

            // Redemption history for this specific promotion
            const redemptions = clientPromotionsUsed.filter((r) => r.promotion_id === assignment.promotion_id);
            const usedCount = redemptions.length;
            const lastUsed = redemptions.length > 0
              ? redemptions.reduce((latest, r) => r.redeemed_at > latest ? r.redeemed_at : latest, redemptions[0].redeemed_at)
              : null;

            return (
              <Animated.View
                key={assignment.id}
                entering={FadeInDown.delay(idx * 40).duration(250)}
                style={{
                  backgroundColor: colors.card,
                  borderRadius: 14,
                  padding: 16,
                  marginBottom: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: isDark ? 0.15 : 0.05,
                  shadowRadius: 6,
                }}
              >
                {/* Card header row */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <View style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    backgroundColor: `${promoColor}18`,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Tag size={20} color={promoColor} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }} numberOfLines={1}>
                      {promo?.name ?? 'Promotion'}
                    </Text>
                    {desc ? (
                      <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>{desc}</Text>
                    ) : null}
                  </View>
                  <StatusBadge status={isActive ? 'active' : 'paused'} />
                </View>

                {/* Assignment date + usage stats */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 14, flexWrap: 'wrap' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Clock size={13} color={colors.textTertiary} />
                    <Text style={{ color: colors.textTertiary, fontSize: 12 }}>
                      {t('started', language)} {formatShortDate(assignment.assigned_at, language)}
                    </Text>
                  </View>
                  {usedCount > 0 && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: primaryColor }} />
                      <Text style={{ color: colors.textTertiary, fontSize: 12 }}>
                        {usedCount}× {usedCount === 1 ? t('usedTimes', language) : t('usedTimesPlural', language)}
                        {lastUsed ? ` · ${formatShortDate(lastUsed, language)}` : ''}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Action row — or inline confirm */}
                {isConfirmingRemove ? (
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    paddingTop: 12,
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                  }}>
                    <Text style={{ flex: 1, color: colors.textSecondary, fontSize: 13 }}>
                      {t('removeFromPromotion', language)}?
                    </Text>
                    <Pressable
                      onPress={() => setConfirmRemoveId(null)}
                      style={{
                        paddingVertical: 8,
                        paddingHorizontal: 14,
                        borderRadius: 10,
                        backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                      }}
                    >
                      <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600' }}>
                        {t('cancel', language)}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        setConfirmRemoveId(null);
                        onRemovePromo(assignment.promotion_id);
                      }}
                      style={{
                        paddingVertical: 8,
                        paddingHorizontal: 14,
                        borderRadius: 10,
                        backgroundColor: isDark ? '#EF444425' : '#FEE2E2',
                      }}
                    >
                      <Text style={{ color: '#EF4444', fontSize: 13, fontWeight: '700' }}>
                        {t('removeFromPromotion', language)}
                      </Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={{
                    flexDirection: 'row',
                    gap: 8,
                    paddingTop: 12,
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                  }}>
                    {/* Pause / Resume */}
                    <Pressable
                      onPress={() => isActive ? onPausePromo(assignment.promotion_id) : onResumePromo(assignment.promotion_id)}
                      style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        paddingVertical: 10,
                        borderRadius: 10,
                        backgroundColor: isActive
                          ? (isDark ? colors.backgroundTertiary : '#F1F5F9')
                          : `${primaryColor}18`,
                      }}
                    >
                      {isActive
                        ? <Pause size={14} color={colors.textSecondary} />
                        : <Play size={14} color={primaryColor} />}
                      <Text style={{
                        color: isActive ? colors.textSecondary : primaryColor,
                        fontWeight: '600',
                        fontSize: 13,
                        marginLeft: 6,
                      }}>
                        {isActive ? t('pause', language) : t('resumeEnrollment', language)}
                      </Text>
                    </Pressable>

                    {/* Remove */}
                    <Pressable
                      onPress={() => setConfirmRemoveId(assignment.promotion_id)}
                      style={{
                        width: 44,
                        height: 40,
                        borderRadius: 10,
                        backgroundColor: isDark ? '#EF444418' : '#FEE2E2',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Trash2 size={16} color="#EF4444" />
                    </Pressable>
                  </View>
                )}
              </Animated.View>
            );
          })}

          {/* Assign promotion button */}
          {!showAssignPicker ? (
            <Pressable
              onPress={() => setShowAssignPicker(true)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 14,
                borderRadius: 12,
                backgroundColor: primaryColor,
                marginBottom: 28,
              }}
            >
              <Plus size={16} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14, marginLeft: 6 }}>
                {t('assignMarketingPromotion', language)}
              </Text>
            </Pressable>
          ) : (
            <Animated.View entering={FadeInDown.duration(200)} style={{ marginBottom: 28 }}>
              {/* Picker header */}
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 10,
              }}>
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14 }}>
                  {t('selectPromotion', language)}
                </Text>
                <Pressable onPress={() => setShowAssignPicker(false)}>
                  <X size={18} color={colors.textTertiary} />
                </Pressable>
              </View>

              {availableToAssign.length === 0 ? (
                <View style={{
                  backgroundColor: colors.card,
                  borderRadius: 12,
                  padding: 16,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: colors.border,
                }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
                    {t('noPromotionsToAssign', language)}
                  </Text>
                  <Text style={{ color: colors.textTertiary, fontSize: 13, marginTop: 4, textAlign: 'center' }}>
                    {t('createPromotionsHint', language)}
                  </Text>
                </View>
              ) : (
                availableToAssign.map((promo) => {
                  const desc = discountText(promo, language, currency);
                  return (
                    <Pressable
                      key={promo.id}
                      onPress={() => {
                        onAssignPromo(promo.id);
                        setShowAssignPicker(false);
                      }}
                      style={{
                        backgroundColor: colors.card,
                        borderRadius: 12,
                        padding: 14,
                        marginBottom: 8,
                        flexDirection: 'row',
                        alignItems: 'center',
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <View style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        backgroundColor: `${promo.color}18`,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        <Tag size={18} color={promo.color} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>{promo.name}</Text>
                        {desc ? (
                          <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 1 }}>{desc}</Text>
                        ) : null}
                      </View>
                      <ChevronRight size={16} color={colors.textTertiary} />
                    </Pressable>
                  );
                })
              )}
            </Animated.View>
          )}

          {/* ══════════════════════════════════════════════
              SECTION 2 — PUNCH CARDS (COUNTERS)
              ══════════════════════════════════════════════ */}
          <SectionHeader
            icon={<Award size={16} color={primaryColor} />}
            label={t('promotionCounter', language)}
            count={clientLoyaltyPrograms.length}
          />

          {clientLoyaltyPrograms.length === 0 && (
            <Animated.View
              entering={FadeInDown.duration(200)}
              style={{
                backgroundColor: colors.card,
                borderRadius: 14,
                padding: 24,
                marginBottom: 12,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <View style={{
                width: 60,
                height: 60,
                borderRadius: 30,
                backgroundColor: isDark ? `${primaryColor}20` : `${primaryColor}10`,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 12,
              }}>
                <Award size={28} color={primaryColor} style={{ opacity: 0.6 }} />
              </View>
              <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600', marginBottom: 4 }}>
                {t('noPromotionCounters', language)}
              </Text>
              <Text style={{ color: colors.textTertiary, fontSize: 13, textAlign: 'center' }}>
                {t('addPromoCounter', language)}
              </Text>
            </Animated.View>
          )}

          {clientLoyaltyPrograms.map((cp, idx) => {
            const promoColor = cp.promotion?.color || primaryColor;
            const progressPct = cp.targetCount > 0
              ? Math.min(100, (cp.currentCount / cp.targetCount) * 100)
              : 0;
            const counterStatus = cp.isCompleted ? 'completed' : 'inProgress';
            const isConfirmingDelete = confirmDeleteId === cp.id;

            return (
              <Animated.View
                key={cp.id}
                entering={FadeInDown.delay(idx * 40).duration(250)}
                style={{
                  backgroundColor: colors.card,
                  borderRadius: 14,
                  padding: 16,
                  marginBottom: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: isDark ? 0.15 : 0.05,
                  shadowRadius: 6,
                }}
              >
                {/* Counter header */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <View style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    backgroundColor: `${promoColor}18`,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Award size={20} color={promoColor} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }} numberOfLines={1}>
                      {cp.promotion?.name ?? t('customProgram', language)}
                    </Text>
                    <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 2 }}>
                      {t('started', language)} {formatShortDate(cp.createdAt, language)}
                    </Text>
                  </View>
                  <StatusBadge status={counterStatus} />
                </View>

                {/* Progress */}
                <View style={{ marginBottom: 14 }}>
                  <View style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 8,
                  }}>
                    <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                      {t('progress', language)}
                    </Text>
                    <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14 }}>
                      {cp.currentCount} / {cp.targetCount}
                    </Text>
                  </View>
                  <View style={{
                    height: 6,
                    backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                    borderRadius: 3,
                    overflow: 'hidden',
                  }}>
                    <View
                      style={{
                        height: '100%',
                        width: `${progressPct}%`,
                        backgroundColor: primaryColor,
                        borderRadius: 3,
                      }}
                    />
                  </View>
                  {/* Punch dots */}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 10 }}>
                    {Array.from({ length: cp.targetCount }).map((_, i) => (
                      <View
                        key={i}
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 11,
                          backgroundColor: i < cp.currentCount
                            ? primaryColor
                            : (isDark ? colors.backgroundTertiary : '#F1F5F9'),
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderWidth: i < cp.currentCount ? 0 : 1,
                          borderColor: colors.border,
                        }}
                      >
                        {i < cp.currentCount && <Check size={12} color="#fff" />}
                      </View>
                    ))}
                  </View>
                </View>

                {/* Action row — or inline confirm */}
                {isConfirmingDelete ? (
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    paddingTop: 12,
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                  }}>
                    <Text style={{ flex: 1, color: colors.textSecondary, fontSize: 13 }}>
                      {t('deleteCounter', language)}?
                    </Text>
                    <Pressable
                      onPress={() => setConfirmDeleteId(null)}
                      style={{
                        paddingVertical: 8,
                        paddingHorizontal: 14,
                        borderRadius: 10,
                        backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                      }}
                    >
                      <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600' }}>
                        {t('cancel', language)}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        setConfirmDeleteId(null);
                        onDeleteCounter(cp.id);
                      }}
                      style={{
                        paddingVertical: 8,
                        paddingHorizontal: 14,
                        borderRadius: 10,
                        backgroundColor: isDark ? '#EF444425' : '#FEE2E2',
                      }}
                    >
                      <Text style={{ color: '#EF4444', fontSize: 13, fontWeight: '700' }}>
                        {t('delete', language)}
                      </Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={{
                    flexDirection: 'row',
                    gap: 8,
                    paddingTop: 12,
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                  }}>
                    {/* Add Count */}
                    {!cp.isCompleted && (
                      <Pressable
                        onPress={() => onAddCount(cp.id)}
                        style={{
                          flex: 1,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          paddingVertical: 10,
                          borderRadius: 10,
                          backgroundColor: primaryColor,
                        }}
                      >
                        <Plus size={15} color="#fff" />
                        <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13, marginLeft: 5 }}>
                          {t('addCount', language)}
                        </Text>
                      </Pressable>
                    )}

                    {/* History */}
                    {cp._isDbBacked && (
                      <Pressable
                        onPress={() => onViewHistory(cp.id)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          paddingVertical: 10,
                          paddingHorizontal: 14,
                          borderRadius: 10,
                          backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                        }}
                      >
                        <Clock size={15} color={colors.textSecondary} />
                        <Text style={{ color: colors.textSecondary, fontWeight: '600', fontSize: 13, marginLeft: 5 }}>
                          {t('recentHistory', language)}
                        </Text>
                      </Pressable>
                    )}

                    {/* Delete */}
                    <Pressable
                      onPress={() => setConfirmDeleteId(cp.id)}
                      style={{
                        width: 44,
                        height: 40,
                        borderRadius: 10,
                        backgroundColor: isDark ? '#EF444418' : '#FEE2E2',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Trash2 size={16} color="#EF4444" />
                    </Pressable>
                  </View>
                )}
              </Animated.View>
            );
          })}

          {/* Add Punch Card button */}
          <Pressable
            onPress={onOpenAddCounter}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 14,
              borderRadius: 12,
              backgroundColor: primaryColor,
              marginBottom: 40,
            }}
          >
            <Plus size={16} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14, marginLeft: 6 }}>
              {t('addPromoCounter', language)}
            </Text>
          </Pressable>

        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
