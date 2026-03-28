import React from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { Hash, Search, Calendar, Tag, User, Building2 } from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useTheme } from '@/lib/ThemeContext';
import { t, getLocalizedStoreName } from '@/lib/i18n';
import { Language } from '@/lib/types';
import { getServiceIconColor } from '@/lib/serviceColors';
import type { SearchableAppointment } from './appointmentsTypes';

export interface AppointmentSearchResultsProps {
  searchResults: SearchableAppointment[];
  isSearchLoading: boolean;
  isServerSearchLoading: boolean;
  formatWithLocale: (date: Date, formatStr: string) => string;
  formatTime: (timeStr: string) => string;
  currencySymbol: string;
  language: Language;
  onSelectAppointment: (apt: SearchableAppointment) => void;
}

export function AppointmentSearchResults({
  searchResults,
  isSearchLoading,
  isServerSearchLoading,
  formatWithLocale,
  formatTime,
  currencySymbol,
  language,
  onSelectAppointment,
}: AppointmentSearchResultsProps) {
  const { colors, isDark, primaryColor } = useTheme();

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      style={{
        flex: 1,
        backgroundColor: isDark ? colors.background : '#F8FAFC',
      }}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Search Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
          <Hash size={16} color={colors.textSecondary} />
          <Text style={{ color: colors.textSecondary, fontSize: 14, marginLeft: 6 }}>
            {searchResults.length === 0
              ? 'No upcoming appointments found'
              : `${searchResults.length} upcoming appointment${searchResults.length !== 1 ? 's' : ''} found`}
          </Text>
          {(isSearchLoading || isServerSearchLoading) && (
            <ActivityIndicator size="small" color={primaryColor} style={{ marginLeft: 8 }} />
          )}
        </View>

        {/* No Results State */}
        {searchResults.length === 0 && !isSearchLoading && !isServerSearchLoading && (
          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
              }}
            >
              <Search size={28} color={colors.textTertiary} />
            </View>
            <Text style={{ color: colors.textSecondary, fontSize: 16, fontWeight: '500', textAlign: 'center' }}>
              No upcoming appointments
            </Text>
            <Text style={{ color: colors.textTertiary, fontSize: 14, textAlign: 'center', marginTop: 8 }}>
              This client has no future bookings. Past appointments are shown in Visit History.
            </Text>
          </View>
        )}

        {/* Search Results List */}
        {searchResults.map((apt, index) => {
          const appointmentDate = new Date(apt.date);
          const isPast = appointmentDate < new Date();
          const isCancelled = apt.cancelled;

          return (
            <Animated.View
              key={apt.id}
              entering={FadeInDown.delay(index * 30).duration(250)}
            >
              <Pressable
                onPress={() => onSelectAppointment(apt)}
                style={{
                  backgroundColor: colors.card,
                  borderRadius: 14,
                  paddingVertical: 14,
                  paddingHorizontal: 18,
                  marginBottom: 10,
                  borderLeftWidth: 4,
                  borderLeftColor: isCancelled
                    ? `${primaryColor}80`
                    : isPast
                    ? colors.textTertiary
                    : primaryColor,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.05,
                  shadowRadius: 4,
                }}
              >
                {/* Top Row: Confirmation Code + Status + Chevron */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Hash size={14} color={primaryColor} />
                    <Text style={{ color: primaryColor, fontSize: 13, fontWeight: '700', marginLeft: 4, letterSpacing: 0.5 }}>
                      {apt.confirmationCode}
                    </Text>
                  </View>
                  {isCancelled ? (
                    <View style={{ backgroundColor: `${primaryColor}15`, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                      <Text style={{ color: `${primaryColor}B0`, fontSize: 11, fontWeight: '600' }}>{t('statusCancelled', language).toUpperCase()}</Text>
                    </View>
                  ) : isPast ? (
                    <View style={{ backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                      <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '600' }}>{t('statusCompleted', language).toUpperCase()}</Text>
                    </View>
                  ) : (
                    <View style={{ backgroundColor: `${primaryColor}20`, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                      <Text style={{ color: primaryColor, fontSize: 11, fontWeight: '600' }}>{t('upcomingVisit', language).toUpperCase()}</Text>
                    </View>
                  )}
                </View>

                {/* Client Name */}
                <Text style={{ color: colors.text, fontSize: 17, fontWeight: '600', marginBottom: 4 }}>
                  {apt.clientName || 'Unknown Client'}
                </Text>

                {/* Date & Time */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <Calendar size={14} color={colors.textSecondary} />
                  <Text style={{ color: colors.textSecondary, fontSize: 14, marginLeft: 6 }}>
                    {formatWithLocale(appointmentDate, 'EEEE, d MMM yyyy')}{t('atTimeConnector', language) ? ` ${t('atTimeConnector', language)} ` : ' '}{apt.startTime ? formatTime(apt.startTime) : ''}
                  </Text>
                </View>

                {/* Details Grid */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 }}>
                  {/* Service */}
                  {apt.serviceName && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 16, marginBottom: 4 }}>
                      <Tag size={12} color={getServiceIconColor(apt.serviceColor, primaryColor)} />
                      <Text style={{ color: colors.textSecondary, fontSize: 13, marginLeft: 4 }}>
                        {apt.serviceName}
                      </Text>
                    </View>
                  )}

                  {/* Staff */}
                  {apt.staffName && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 16, marginBottom: 4 }}>
                      <User size={12} color={colors.textTertiary} />
                      <Text style={{ color: colors.textSecondary, fontSize: 13, marginLeft: 4 }}>
                        {apt.staffName}
                      </Text>
                    </View>
                  )}

                  {/* Store */}
                  {apt.storeName && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 16, marginBottom: 4 }}>
                      <Building2 size={12} color={colors.textTertiary} />
                      <Text style={{ color: colors.textSecondary, fontSize: 13, marginLeft: 4 }}>
                        {getLocalizedStoreName(apt.storeName, language)}
                      </Text>
                    </View>
                  )}

                  {/* Amount */}
                  {!!apt.amount && apt.amount > 0 && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                      <Text style={{ color: primaryColor, fontSize: 13, fontWeight: '600' }}>
                        {currencySymbol}{apt.amount.toFixed(2)}
                      </Text>
                    </View>
                  )}
                </View>
              </Pressable>
            </Animated.View>
          );
        })}
      </ScrollView>
    </Animated.View>
  );
}
