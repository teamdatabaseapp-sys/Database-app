import React from 'react';
import { View, Text, Pressable } from 'react-native';
import {
  ChevronRight,
  Mail,
  Zap,
  Gift,
} from 'lucide-react-native';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/types';
import { format } from 'date-fns';
import type { Locale } from 'date-fns';
import { StoreFilter } from './StoreFilter';

// ============================================
// ClientsDrillDown — totalClients + newClients cases
// ============================================

export interface ClientsDrillDownClient {
  id: string;
  name: string;
  createdAt: Date;
}

export interface ClientsDrillDownProps {
  mode: 'totalClients' | 'newClients';
  clients: ClientsDrillDownClient[];
  stores: Array<{ id: string; name: string }>;
  selectedStoreId: string | null;
  onSelectStore: (storeId: string | null) => void;
  language: Language;
  dateLocale: Locale | undefined;
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

function capitalizeDate(str: string): string {
  return str.replace(/(^|\s)(\S)/g, (match, space, letter) => space + letter.toUpperCase());
}

export function ClientsDrillDown({
  mode,
  clients,
  stores,
  selectedStoreId,
  onSelectStore,
  language,
  dateLocale,
  onClientPress,
  onOpenSmartDrip,
  onOpenMarketing,
}: ClientsDrillDownProps) {
  const { colors, isDark, primaryColor } = useTheme();

  const isTotalClients = mode === 'totalClients';

  const titleKey = isTotalClients ? 'allClientsCount' : 'newClientsCount';
  const emptyKey = isTotalClients ? 'noClientsFound' : 'noNewClients';

  const smartDripPrefill = isTotalClients
    ? { name: t('smartTripTotalClientsName', language), frequency: 'monthly' as const, contextLabel: t('smartRecommendationTotalClientsGrow', language) }
    : { name: t('smartTripWelcomeName', language), frequency: 'weekly' as const, contextLabel: t('smartRecommendationNewClientsConvert', language) };

  const marketingPrefill = isTotalClients
    ? { discountType: 'percentage' as const, name: '', contextLabel: t('smartRecommendationTotalClientsGrow', language) }
    : { discountType: 'percentage' as const, name: '', contextLabel: t('aiRecNewClientsPromo', language) };

  const marketingSubtextKey = isTotalClients ? 'aiRecNewClientsPromo' : 'aiRecNewClientsPromo';

  return (
    <View>
      <StoreFilter
        stores={stores}
        selectedStoreId={selectedStoreId}
        onSelect={onSelectStore}
        language={language}
      />
      <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 18, marginBottom: 16 }}>
        {t(titleKey, language)} ({clients.length})
      </Text>
      {onOpenSmartDrip && (
        <Pressable
          onPress={() => onOpenSmartDrip(smartDripPrefill)}
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
            <Text style={{ color: isDark ? `${primaryColor}DD` : `${primaryColor}CC`, fontSize: 13, lineHeight: 18 }}>
              {isTotalClients ? t('smartRecommendationTotalClientsGrow', language) : t('aiRecNewClientsDrip', language)}
            </Text>
          </View>
          <ChevronRight size={20} color={primaryColor} />
        </Pressable>
      )}
      {onOpenMarketing && (
        <Pressable
          onPress={() => onOpenMarketing(marketingPrefill)}
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
            <Text style={{ color: isDark ? `${primaryColor}DD` : `${primaryColor}CC`, fontSize: 13, lineHeight: 18 }}>
              {t(marketingSubtextKey, language)}
            </Text>
          </View>
          <ChevronRight size={20} color={primaryColor} />
        </Pressable>
      )}
      {clients.map((client: ClientsDrillDownClient) => {
        // Get initials from first and last name
        const nameParts = client.name.trim().split(/\s+/);
        const initials = nameParts.length >= 2
          ? (nameParts[0].charAt(0) + nameParts[nameParts.length - 1].charAt(0)).toUpperCase()
          : client.name.charAt(0).toUpperCase();

        return (
          <Pressable
            key={client.id}
            onPress={() => onClientPress(client.id)}
            style={{
              backgroundColor: colors.card,
              borderRadius: 12,
              padding: 16,
              marginBottom: 12,
              flexDirection: 'row',
              alignItems: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.05,
              shadowRadius: 4,
            }}
          >
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}15`, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: primaryColor, fontWeight: 'bold' }}>
                {initials}
              </Text>
            </View>
            <View className="flex-1 ml-3">
              <Text style={{ color: colors.text, fontWeight: '500' }}>{client.name}</Text>
              <Text style={{ color: colors.textTertiary, fontSize: 14 }}>
                {t('added', language)} {capitalizeDate(format(new Date(client.createdAt), 'PPP', { locale: dateLocale }))}
              </Text>
            </View>
            <ChevronRight size={18} color={colors.textTertiary} />
          </Pressable>
        );
      })}
      {clients.length === 0 && (
        <Text style={{ color: colors.textTertiary, textAlign: 'center', paddingVertical: 32 }}>{t(emptyKey, language)}</Text>
      )}
    </View>
  );
}
