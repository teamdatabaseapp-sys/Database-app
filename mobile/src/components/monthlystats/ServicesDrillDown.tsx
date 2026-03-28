import React from 'react';
import { View, Text, Pressable } from 'react-native';
import {
  ChevronRight,
  Mail,
  Zap,
  Gift,
  Scissors,
} from 'lucide-react-native';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/types';
import { StoreFilter } from './StoreFilter';
import { type TimeFilterType } from './TimeFilterTabs';

// ============================================
// ServicesDrillDown — topServices case
// ============================================

export interface ServicesDrillDownService {
  id: string;
  name: string;
  count: number;
  color: string;
}

export interface ServicesDrillDownProps {
  services: ServicesDrillDownService[];
  totalServiceCount: number;
  stores: Array<{ id: string; name: string }>;
  selectedStoreId: string | null;
  onSelectStore: (storeId: string | null) => void;
  language: Language;
  timeFilter: TimeFilterType;
  onOpenSmartDrip?: (prefill?: {
    name?: string;
    frequency?: 'weekly' | 'biweekly' | 'monthly' | 'custom';
    emailSubject?: string;
    emailBody?: string;
    contextLabel?: string;
  }) => void;
  onOpenMarketing?: (prefill?: {
    discountType?: 'percentage' | 'fixed' | 'free_service' | 'other' | 'bundle' | 'flash_sale' | 'referral';
    name?: string;
    contextLabel?: string;
  }) => void;
}

function getPeriodText(timeFilter: TimeFilterType, language: Language): string {
  switch (timeFilter) {
    case 'daily': return t('thisDay', language);
    case 'weekly': return t('thisWeekPeriod', language);
    case 'yearly': return t('thisYearPeriod', language);
    default: return t('thisMonthPeriod', language);
  }
}

export function ServicesDrillDown({
  services,
  totalServiceCount,
  stores,
  selectedStoreId,
  onSelectStore,
  language,
  timeFilter,
  onOpenSmartDrip,
  onOpenMarketing,
}: ServicesDrillDownProps) {
  const { colors, isDark, primaryColor } = useTheme();

  return (
    <View>
      <StoreFilter
        stores={stores}
        selectedStoreId={selectedStoreId}
        onSelect={onSelectStore}
        language={language}
      />
      <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 18, marginBottom: 16 }}>
        {t('topServices', language)} ({totalServiceCount} total)
      </Text>
      {onOpenSmartDrip && (
        <Pressable
          onPress={() => onOpenSmartDrip({ name: t('smartTripTopServiceName', language), frequency: 'monthly', contextLabel: t('smartRecommendationTopServicePromote', language) })}
          style={{ backgroundColor: isDark ? `${primaryColor}20` : `${primaryColor}12`, borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: isDark ? `${primaryColor}40` : `${primaryColor}25`, flexDirection: 'row', alignItems: 'center' }}
        >
          <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}20`, alignItems: 'center', justifyContent: 'center' }}>
            <Mail size={24} color={primaryColor} />
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <Zap size={14} color={primaryColor} />
              <Text style={{ color: primaryColor, fontWeight: '700', fontSize: 14, marginLeft: 4 }}>{t('aiSmartDripCampaign', language)}</Text>
            </View>
            <Text style={{ color: isDark ? `${primaryColor}DD` : `${primaryColor}CC`, fontSize: 13, lineHeight: 18 }}>{t('aiRecTopServicesDrip', language)}</Text>
          </View>
          <ChevronRight size={20} color={primaryColor} />
        </Pressable>
      )}
      {onOpenMarketing && services.length > 0 && (
        <Pressable
          onPress={() => onOpenMarketing({ discountType: 'percentage', name: services[0]?.name ?? '', contextLabel: t('aiRecTopServicesPromo', language) })}
          style={{ backgroundColor: isDark ? `${primaryColor}20` : `${primaryColor}12`, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: isDark ? `${primaryColor}40` : `${primaryColor}25`, flexDirection: 'row', alignItems: 'center' }}
        >
          <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}20`, alignItems: 'center', justifyContent: 'center' }}>
            <Gift size={24} color={primaryColor} />
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <Zap size={14} color={primaryColor} />
              <Text style={{ color: primaryColor, fontWeight: '700', fontSize: 14, marginLeft: 4 }}>{t('aiMarketingPromotion', language)}</Text>
            </View>
            <Text style={{ color: isDark ? `${primaryColor}DD` : `${primaryColor}CC`, fontSize: 13, lineHeight: 18 }}>{t('aiRecTopServicesPromo', language)}</Text>
          </View>
          <ChevronRight size={20} color={primaryColor} />
        </Pressable>
      )}
      {services.map((service) => (
        <View
          key={service.id}
          style={{
            backgroundColor: colors.card,
            borderRadius: 12,
            padding: 16,
            marginBottom: 12,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 4,
          }}
        >
          <View className="flex-row items-center">
            <View
              className="w-10 h-10 rounded-full items-center justify-center"
              style={{ backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}15` }}
            >
              <Scissors size={18} color={primaryColor} />
            </View>
            <View className="flex-1 ml-3">
              <Text style={{ color: colors.text, fontWeight: '500' }}>{service.name}</Text>
              <Text style={{ color: colors.textTertiary, fontSize: 14 }}>
                {service.count} {service.count !== 1 ? t('usedTimesPlural', language) : t('usedTimes', language)} {getPeriodText(timeFilter, language)}
              </Text>
            </View>
            <View
              className="px-3 py-1 rounded-full"
              style={{ backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}15` }}
            >
              <Text className="font-semibold" style={{ color: primaryColor }}>
                {service.count}
              </Text>
            </View>
          </View>
        </View>
      ))}
      {services.length === 0 && (
        <Text style={{ color: colors.textTertiary, textAlign: 'center', paddingVertical: 32 }}>{t('noServicesRecorded', language)}</Text>
      )}
    </View>
  );
}
