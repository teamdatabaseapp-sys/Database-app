import React from 'react';
import { View, Text, Pressable, ScrollView, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Clock, Users, Calendar, Edit3, ChevronRight } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/types';
import { useStore } from '@/lib/store';
import type { LocalAppointment, LocalStaff } from './appointmentsTypes';
import type { SupabaseClient } from '@/services/clientsService';

export interface EditAppointmentSelectorModalProps {
  visible: boolean;
  activeAppointments: LocalAppointment[];
  serviceTags: { id: string; name: string; color: string }[];
  getClient: (clientId: string) => SupabaseClient | undefined;
  getStaffMember: (staffId: string | undefined) => LocalStaff | undefined;
  formatWithLocale: (date: Date, formatStr: string) => string;
  formatTime: (timeStr: string) => string;
  onSelect: (appointment: LocalAppointment) => void;
  onClose: () => void;
}

export function EditAppointmentSelectorModal({
  visible,
  activeAppointments,
  serviceTags,
  getClient,
  getStaffMember,
  formatWithLocale,
  formatTime,
  onSelect,
  onClose,
}: EditAppointmentSelectorModalProps) {
  const { colors, isDark, primaryColor } = useTheme();
  const language = useStore((s) => s.language) as Language;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView
        style={{ flex: 1, backgroundColor: isDark ? colors.background : '#F8FAFC' }}
        edges={['top']}
      >
        {/* Header */}
        <View
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
          <Pressable onPress={onClose} style={{ padding: 4 }}>
            <X size={24} color={colors.text} />
          </Pressable>
          <Text
            style={{ color: colors.text, fontSize: 17, fontWeight: '600', textAlign: 'center', flex: 1, marginHorizontal: 8 }}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
          >
            {t('editAppointment', language)}
          </Text>
          <View style={{ width: 28 }} />
        </View>

        {/* Instructions */}
        <View
          style={{
            paddingHorizontal: 16,
            paddingVertical: 12,
            backgroundColor: isDark ? `${primaryColor}20` : `${primaryColor}15`,
            marginHorizontal: 16,
            marginTop: 16,
            borderRadius: 12,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <Edit3 size={18} color={primaryColor} />
          <Text style={{ color: primaryColor, fontSize: 14, marginLeft: 10, flex: 1 }}>
            {t('tapToEditAppointment', language)}
          </Text>
        </View>

        {/* Active Appointments List */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        >
          {activeAppointments.length > 0 ? (
            activeAppointments.map((appointment, index) => {
              const client = getClient(appointment.clientId);
              const staff = getStaffMember(appointment.staffId);
              const titleTags = appointment.title.split(', ').filter(Boolean);
              const matchedTags = serviceTags.filter((tag) =>
                titleTags.some((tItem) => tItem.toLowerCase() === tag.name.toLowerCase())
              );

              return (
                <Animated.View
                  key={appointment.id}
                  entering={FadeInDown.delay(Math.min(index * 50, 300)).duration(300)}
                >
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      onSelect(appointment);
                    }}
                    style={{
                      backgroundColor: colors.card,
                      borderRadius: 16,
                      paddingVertical: 16,
                      paddingHorizontal: 18,
                      marginBottom: 12,
                      borderLeftWidth: 4,
                      borderLeftColor: primaryColor,
                    }}
                  >
                    {/* Client Info */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                      <View
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 22,
                          backgroundColor: `${primaryColor}15`,
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: 12,
                        }}
                      >
                        <Text style={{ color: primaryColor, fontWeight: '700', fontSize: 16 }}>
                          {client?.name
                            ? (() => {
                                const parts = client.name.trim().split(/\s+/);
                                if (parts.length >= 2) {
                                  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
                                }
                                return client.name.charAt(0).toUpperCase();
                              })()
                            : '?'}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontWeight: '600', fontSize: 16 }}>
                          {appointment.serviceName
                            ? `${client?.name || 'Unknown Client'} • ${appointment.serviceName}`
                            : client?.name || 'Unknown Client'}
                        </Text>
                        <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>
                          {formatWithLocale(new Date(appointment.date), 'EEEE, MMMM d, yyyy')}
                        </Text>
                      </View>
                      <ChevronRight size={20} color={colors.textTertiary} />
                    </View>

                    {/* Time */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                      <Clock size={14} color={colors.textSecondary} />
                      <Text style={{ color: colors.textSecondary, fontSize: 14, marginLeft: 6 }}>
                        {appointment.startTime ? formatTime(appointment.startTime) : ''}
                        {appointment.endTime ? ` - ${formatTime(appointment.endTime)}` : ''}
                      </Text>
                    </View>

                    {/* Staff */}
                    {staff && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                        <Users size={14} color={colors.textSecondary} />
                        <Text style={{ color: colors.textSecondary, fontSize: 14, marginLeft: 6 }}>
                          {staff.name}
                        </Text>
                      </View>
                    )}

                    {/* Service Tags */}
                    {matchedTags.length > 0 && (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 }}>
                        {matchedTags.map((tag) => (
                          <View
                            key={tag.id}
                            style={{
                              backgroundColor: `${tag.color}20`,
                              paddingHorizontal: 10,
                              paddingVertical: 4,
                              borderRadius: 12,
                              marginRight: 6,
                              marginBottom: 4,
                            }}
                          >
                            <Text style={{ color: tag.color, fontSize: 12, fontWeight: '500' }}>
                              {tag.name}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </Pressable>
                </Animated.View>
              );
            })
          ) : (
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <Calendar size={48} color={colors.textTertiary} />
              <Text style={{ color: colors.textSecondary, fontSize: 16, marginTop: 16 }}>
                {t('noAppointmentsToEdit', language)}
              </Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
