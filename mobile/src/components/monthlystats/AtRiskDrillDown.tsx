import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Settings, RefreshCw, Zap, ChevronRight } from 'lucide-react-native';
import { format } from 'date-fns';
import { Locale } from 'date-fns';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/types';
import { StoreFilter } from './StoreFilter';

export interface AtRiskDrillDownClient {
  id: string;
  name: string;
  lastVisitAt: Date | null;
}

export interface AtRiskDrillDownInsight {
  count: number;
  clients: AtRiskDrillDownClient[];
}

export interface AtRiskDrillDownProps {
  insight: AtRiskDrillDownInsight;
  atRiskDays: number;
  stores: Array<{ id: string; name: string }>;
  selectedStoreId: string | null;
  onSelectStore: (storeId: string | null) => void;
  language: Language;
  dateLocale: Locale | undefined;
  onShowSettings: () => void;
  onClientPress: (clientId: string) => void;
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

const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }
  return name.charAt(0).toUpperCase();
};

const capitalizeDate = (str: string) => {
  return str.replace(/(^|\s)(\S)/g, (match, space, letter) => space + letter.toUpperCase());
};

export function AtRiskDrillDown({
  insight,
  atRiskDays,
  stores,
  selectedStoreId,
  onSelectStore,
  language,
  dateLocale,
  onShowSettings,
  onClientPress,
  onOpenSmartDrip,
  onOpenMarketing,
}: AtRiskDrillDownProps) {
  const { colors, isDark, primaryColor } = useTheme();

  return (
    <View>
      <StoreFilter
        stores={stores}
        selectedStoreId={selectedStoreId}
        onSelect={onSelectStore}
        language={language}
      />
      <View className="flex-row items-center justify-between mb-4">
        <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 18 }}>
          {t('clientsAtRisk', language)} ({insight.count})
        </Text>
        <Pressable
          onPress={onShowSettings}
          style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}
        >
          <Settings size={18} color={colors.textSecondary} />
        </Pressable>
      </View>
      <View
        className="rounded-xl p-3 mb-4"
        style={{ backgroundColor: `${primaryColor}15` }}
      >
        <Text style={{ color: primaryColor, fontSize: 14 }}>
          {t('showingClientsNoVisits', language)} {atRiskDays} {t('daysLabel', language)}
        </Text>
      </View>
      {/* AI Recommendation Cards — Drip + Marketing for inactive clients */}
      {insight.clients.length > 0 && (
        <>
          {onOpenSmartDrip && (
            <Pressable
              onPress={() => onOpenSmartDrip({
                name: 'Win-Back Campaign',
                frequency: 'monthly',
                contextLabel: t('aiRecWinbackDripContext', language).replace('{count}', String(insight.count)).replace('{days}', String(atRiskDays)),
              })}
              style={{
                backgroundColor: isDark ? `${primaryColor}20` : `${primaryColor}12`,
                borderRadius: 16,
                padding: 16,
                marginBottom: 10,
                borderWidth: 1,
                borderColor: isDark ? `${primaryColor}40` : `${primaryColor}25`,
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}20`, alignItems: 'center', justifyContent: 'center' }}>
                <RefreshCw size={24} color={primaryColor} />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                  <Zap size={14} color={primaryColor} />
                  <Text style={{ color: primaryColor, fontWeight: '700', fontSize: 14, marginLeft: 4 }}>
                    {t('aiSmartDripCampaign', language)}
                  </Text>
                </View>
                <Text style={{ color: isDark ? `${primaryColor}DD` : `${primaryColor}CC`, fontSize: 13, lineHeight: 18 }}>
                  {t('aiRecClientsAtRiskDrip', language)}
                </Text>
              </View>
              <ChevronRight size={20} color={primaryColor} />
            </Pressable>
          )}
          {onOpenMarketing && (
            <Pressable
              onPress={() => onOpenMarketing({
                discountType: 'percentage',
                name: 'Comeback Offer',
                contextLabel: t('aiRecWinbackPromoContext', language).replace('{count}', String(insight.count)),
              })}
              style={{
                backgroundColor: isDark ? `${primaryColor}20` : `${primaryColor}12`,
                borderRadius: 16,
                padding: 16,
                marginBottom: 16,
                borderWidth: 1,
                borderColor: isDark ? `${primaryColor}40` : `${primaryColor}25`,
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}20`, alignItems: 'center', justifyContent: 'center' }}>
                <Zap size={24} color={primaryColor} />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                  <Zap size={14} color={primaryColor} />
                  <Text style={{ color: primaryColor, fontWeight: '700', fontSize: 14, marginLeft: 4 }}>
                    {t('aiMarketingPromotion', language)}
                  </Text>
                </View>
                <Text style={{ color: isDark ? `${primaryColor}DD` : `${primaryColor}CC`, fontSize: 13, lineHeight: 18 }}>
                  {t('aiRecClientsAtRiskPromo', language)}
                </Text>
              </View>
              <ChevronRight size={20} color={primaryColor} />
            </Pressable>
          )}
        </>
      )}
      {insight.clients.map((client: AtRiskDrillDownClient) => {
        const lastAppointment = client.lastVisitAt;

        return (
          <Pressable
            key={client.id}
            onPress={() => onClientPress(client.id)}
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
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: `${primaryColor}20`, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: primaryColor, fontWeight: 'bold' }}>
                  {getInitials(client.name)}
                </Text>
              </View>
              <View className="flex-1 ml-3">
                <Text style={{ color: colors.text, fontWeight: '500' }}>{client.name}</Text>
                <Text style={{ color: colors.textTertiary, fontSize: 14 }}>
                  {lastAppointment ? `${t('lastVisitDate', language)} ${capitalizeDate(format(lastAppointment, 'MMM d, yyyy', { locale: dateLocale }))}` : t('noVisitsRecorded', language)}
                </Text>
              </View>
              <ChevronRight size={18} color={colors.textTertiary} />
            </View>
          </Pressable>
        );
      })}
      {insight.clients.length === 0 && (
        <Text style={{ color: '#10B981', textAlign: 'center', paddingVertical: 32 }}>{t('allClientsActive', language)}</Text>
      )}
    </View>
  );
}
