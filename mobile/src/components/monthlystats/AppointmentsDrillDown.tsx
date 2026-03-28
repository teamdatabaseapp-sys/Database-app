import React from 'react';
import { View, Text, Pressable } from 'react-native';
import {
  ChevronRight,
  Mail,
  Zap,
  Gift,
  Calendar,
} from 'lucide-react-native';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/types';
import { format } from 'date-fns';
import type { Locale } from 'date-fns';
import { formatCurrency } from '@/lib/currency';
import { StoreFilter } from './StoreFilter';

// ============================================
// AppointmentsDrillDown — totalAppointments + revenue cases
// ============================================

export interface AppointmentsDrillDownAppointment {
  id: string;
  clientId: string;
  date: Date;
  amount: number;
  promoId?: string;
  isCancelled: boolean;
}

export interface AppointmentsDrillDownClient {
  id: string;
  name: string;
}

export interface AppointmentsDrillDownPromotion {
  id: string;
  name: string;
  color: string;
}

export interface AppointmentWithClient {
  appointment: AppointmentsDrillDownAppointment;
  client: AppointmentsDrillDownClient | null;
}

export interface AppointmentsDrillDownProps {
  mode: 'totalAppointments' | 'revenue';
  // totalAppointments mode
  appointments: AppointmentsDrillDownAppointment[];
  allClients: AppointmentsDrillDownClient[];
  // revenue mode
  appointmentsWithClients: AppointmentWithClient[];
  totalRevenue: number;
  currencySymbol: string;
  // shared
  stores: Array<{ id: string; name: string }>;
  selectedStoreId: string | null;
  onSelectStore: (storeId: string | null) => void;
  marketingPromotions: AppointmentsDrillDownPromotion[];
  language: Language;
  dateLocale: Locale | undefined;
  currency: string;
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

export function AppointmentsDrillDown({
  mode,
  appointments,
  allClients,
  appointmentsWithClients,
  totalRevenue,
  currencySymbol,
  stores,
  selectedStoreId,
  onSelectStore,
  marketingPromotions,
  language,
  dateLocale,
  currency,
  onClientPress,
  onOpenSmartDrip,
  onOpenMarketing,
}: AppointmentsDrillDownProps) {
  const { colors, isDark, primaryColor } = useTheme();

  if (mode === 'totalAppointments') {
    return (
      <View>
        <StoreFilter
          stores={stores}
          selectedStoreId={selectedStoreId}
          onSelect={onSelectStore}
          language={language}
        />
        <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 18, marginBottom: 16 }}>
          {t('allAppointmentsCount', language)} ({appointments.length})
        </Text>
        {onOpenSmartDrip && (
          <Pressable
            onPress={() => onOpenSmartDrip({ name: t('smartTripAppointmentsName', language), frequency: 'weekly', contextLabel: t('smartRecommendationAppointmentsBoost', language) })}
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
              <Text style={{ color: isDark ? `${primaryColor}DD` : `${primaryColor}CC`, fontSize: 13, lineHeight: 18 }}>{t('smartRecommendationAppointmentsBoost', language)}</Text>
            </View>
            <ChevronRight size={20} color={primaryColor} />
          </Pressable>
        )}
        {onOpenMarketing && (
          <Pressable
            onPress={() => onOpenMarketing({ discountType: 'percentage', name: '', contextLabel: t('aiRecNewClientsPromo', language) })}
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
              <Text style={{ color: isDark ? `${primaryColor}DD` : `${primaryColor}CC`, fontSize: 13, lineHeight: 18 }}>{t('aiRecNewClientsPromo', language)}</Text>
            </View>
            <ChevronRight size={20} color={primaryColor} />
          </Pressable>
        )}
        {appointments.map((appointment, index) => {
          const client = allClients.find((c) => c.id === appointment.clientId);
          const promotion = appointment.promoId ? marketingPromotions.find((p) => p.id === appointment.promoId) : null;
          return (
            <Pressable
              key={`${appointment.id}-${index}`}
              onPress={() => client && onClientPress(client.id)}
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
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}15`, alignItems: 'center', justifyContent: 'center' }}>
                  <Calendar size={18} color={primaryColor} />
                </View>
                <View className="flex-1 ml-3">
                  <Text style={{ color: colors.text, fontWeight: '500' }}>{client?.name || 'Unknown Client'}</Text>
                  <Text style={{ color: colors.textTertiary, fontSize: 14 }}>
                    {capitalizeDate(format(appointment.date, 'MMM d, yyyy', { locale: dateLocale }))}
                    {` • ${format(appointment.date, 'HH:mm')}`}
                  </Text>
                  {promotion && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                      <Gift size={12} color={promotion.color} />
                      <Text style={{ color: promotion.color, fontSize: 12, fontWeight: '500', marginLeft: 4 }}>{promotion.name}</Text>
                    </View>
                  )}
                </View>
                {appointment.amount > 0 && (
                  <Text className="text-emerald-600 font-semibold">{formatCurrency(appointment.amount, currency)}</Text>
                )}
              </View>
            </Pressable>
          );
        })}
        {appointments.length === 0 && (
          <Text style={{ color: colors.textTertiary, textAlign: 'center', paddingVertical: 32 }}>{t('noAppointmentsThisPeriod', language)}</Text>
        )}
      </View>
    );
  }

  // mode === 'revenue'
  const revenueItems = appointmentsWithClients.filter((ac) => ac.appointment.amount > 0);
  return (
    <View>
      <StoreFilter
        stores={stores}
        selectedStoreId={selectedStoreId}
        onSelect={onSelectStore}
        language={language}
      />
      <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 18, marginBottom: 16 }}>
        {t('revenueDetails', language)} ({formatCurrency(totalRevenue, currency)})
      </Text>
      {onOpenSmartDrip && (
        <Pressable
          onPress={() => onOpenSmartDrip({ name: t('smartTripRevenueRecoverName', language), frequency: 'monthly', contextLabel: t('smartRecommendationRevenueRecover', language) })}
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
            <Text style={{ color: isDark ? `${primaryColor}DD` : `${primaryColor}CC`, fontSize: 13, lineHeight: 18 }}>{t('aiRecRevenueDrip', language)}</Text>
          </View>
          <ChevronRight size={20} color={primaryColor} />
        </Pressable>
      )}
      {onOpenMarketing && (
        <Pressable
          onPress={() => onOpenMarketing({ discountType: 'percentage', name: '', contextLabel: t('aiRecRevenuePromo', language) })}
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
            <Text style={{ color: isDark ? `${primaryColor}DD` : `${primaryColor}CC`, fontSize: 13, lineHeight: 18 }}>{t('aiRecRevenuePromo', language)}</Text>
          </View>
          <ChevronRight size={20} color={primaryColor} />
        </Pressable>
      )}
      {revenueItems.map((item, index) => {
        const promotion = item.appointment.promoId ? marketingPromotions.find((p) => p.id === item.appointment.promoId) : null;
        return (
          <Pressable
            key={`${item.appointment.id}-${index}`}
            onPress={() => item.client && onClientPress(item.client.id)}
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
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: isDark ? `${primaryColor}30` : `${primaryColor}15`, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: primaryColor }}>{currencySymbol}</Text>
              </View>
              <View className="flex-1 ml-3">
                <Text style={{ color: colors.text, fontWeight: '500' }}>{item.client?.name || 'Unknown Client'}</Text>
                <Text style={{ color: colors.textTertiary, fontSize: 14 }}>
                  {capitalizeDate(format(item.appointment.date, 'MMM d, yyyy', { locale: dateLocale }))}
                </Text>
                {promotion && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                    <Gift size={12} color={promotion.color} />
                    <Text style={{ color: promotion.color, fontSize: 12, fontWeight: '500', marginLeft: 4 }}>{promotion.name}</Text>
                  </View>
                )}
              </View>
              <Text className="text-emerald-600 font-bold text-lg">{formatCurrency(item.appointment.amount, currency)}</Text>
            </View>
          </Pressable>
        );
      })}
      {revenueItems.length === 0 && (
        <Text style={{ color: colors.textTertiary, textAlign: 'center', paddingVertical: 32 }}>{t('noRevenueRecorded', language)}</Text>
      )}
    </View>
  );
}
