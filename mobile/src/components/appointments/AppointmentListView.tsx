import React from 'react';
import { View, Text, Pressable } from 'react-native';
import {
  Clock,
  Tag,
  Edit3,
  CalendarDays,
  Repeat,
  Gift,
  CalendarClock,
  Eye,
  Scissors,
  Sparkles,
  CreditCard,
} from 'lucide-react-native';
import { isSameDay, isToday } from 'date-fns';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/types';
import type { AppointmentLifecycleStatus } from '@/hooks/useAppointments';
import type { SupabaseClient } from '@/services/clientsService';
import type { LocalAppointment, LocalStaff } from './appointmentsTypes';

// Date range modes
type DateRangeMode = 'day' | 'week' | 'month';

// Appointment status type (mirrors parent)
type AppointmentStatus = 'ongoing' | 'next' | 'upcoming' | 'past' | null;

interface ServiceTag {
  id: string;
  name: string;
  color: string;
}

interface AppointmentListViewProps {
  currentAppointments: LocalAppointment[];
  dateRangeMode: DateRangeMode;
  serviceTags: ServiceTag[];
  language: Language;
  getClient: (clientId: string) => SupabaseClient | undefined;
  getStaffMember: (staffId: string | undefined) => LocalStaff | undefined;
  getAppointmentStatus: (
    appointment: LocalAppointment,
    allDayAppointments: LocalAppointment[]
  ) => AppointmentStatus;
  formatTime: (timeStr: string) => string;
  formatWithLocale: (date: Date, formatStr: string) => string;
  dateLabel: string;
  onView: (appointment: LocalAppointment) => void;
  onEdit: (appointment: LocalAppointment) => void;
}

export function AppointmentListView({
  currentAppointments,
  dateRangeMode,
  serviceTags,
  language,
  getClient,
  getStaffMember,
  getAppointmentStatus,
  formatTime,
  formatWithLocale,
  dateLabel,
  onView,
  onEdit,
}: AppointmentListViewProps) {
  const { colors, isDark, primaryColor } = useTheme();

  return (
    <View style={{ padding: 16 }}>
      {currentAppointments.length > 0 ? (
        currentAppointments.filter((a) => {
          const lc = (a as LocalAppointment & { lifecycleStatus?: AppointmentLifecycleStatus }).lifecycleStatus;
          return lc !== 'cancelled';
        }).map((appointment, index) => {
          const client = getClient(appointment.clientId);
          const staff = getStaffMember(appointment.staffId);
          // Resolve display name: loaded client object first, then denormalized customerName
          const clientDisplayName = client?.name ?? appointment.customerName;
          // Parse service tags from title
          const titleTags = appointment.title.split(', ').filter(Boolean);
          const matchedTags = serviceTags.filter((tag) =>
            titleTags.some((t) => t.toLowerCase() === tag.name.toLowerCase())
          );

          // Show date header for week/month views
          const showDateHeader = dateRangeMode !== 'day' && (
            index === 0 ||
            !isSameDay(new Date(appointment.date), new Date(currentAppointments[index - 1].date))
          );

          // Get appointments for the same day (for status calculation)
          const sameDayAppointments = currentAppointments.filter((apt) =>
            isSameDay(new Date(apt.date), new Date(appointment.date))
          );

          // Get appointment status
          const status = getAppointmentStatus(appointment, sameDayAppointments);

          // Status-based styling
          const isOngoing = status === 'ongoing';
          const isNext = status === 'next';
          const isPast = status === 'past';

          // Lifecycle-based styling (takes precedence over time-based status)
          const lc = (appointment as LocalAppointment & { lifecycleStatus?: AppointmentLifecycleStatus }).lifecycleStatus ?? 'scheduled';
          const isCheckedIn = lc === 'checked_in';
          const isPendingConfirmation = lc === 'pending_confirmation';
          const isCompleted = lc === 'completed';
          const isNoShow = lc === 'no_show';
          const lcCancelled = lc === 'cancelled';
          // Show Scheduled badge + tint for future scheduled appointments (not today, not past).
          // isPast = true for dates before today. isToday is false for tomorrow+.
          const isScheduledOnline = lc === 'scheduled' && !isPast && !isToday(new Date(appointment.date));
          const apptIsLogVisit = (appointment as LocalAppointment).isLogVisit === true;

          return (
            <View
              key={appointment.id}
            >
              {showDateHeader && (
                <View style={{ marginTop: index === 0 ? 0 : 16, marginBottom: 12 }}>
                  <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>
                    {formatWithLocale(new Date(appointment.date), 'EEEE, MMMM d')}
                  </Text>
                </View>
              )}
              {/* Shadow + background wrapper — needed for iOS shadow to render on tinted backgrounds */}
              <View
                style={{
                  backgroundColor: isCheckedIn
                    ? isDark ? `${primaryColor}18` : `${primaryColor}10`
                    : isPendingConfirmation
                    ? isDark ? `${primaryColor}18` : `${primaryColor}10`
                    : isCompleted
                    ? isDark ? `${primaryColor}15` : `${primaryColor}0D`
                    : isScheduledOnline
                    ? isDark ? `${primaryColor}15` : `${primaryColor}0D`
                    : lcCancelled
                    ? isDark ? `${primaryColor}12` : `${primaryColor}08`
                    : isNoShow
                    ? isDark ? colors.backgroundTertiary : '#F8FAFC'
                    : isOngoing
                    ? isDark ? `${primaryColor}15` : `${primaryColor}08`
                    : isNext
                    ? isDark ? `${primaryColor}10` : `${primaryColor}08`
                    : isPast
                    ? isDark ? colors.backgroundTertiary : '#F8FAFC'
                    : colors.card,
                  borderRadius: 16,
                  marginBottom: 12,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: isPast || isCompleted || isScheduledOnline || isNoShow || lcCancelled ? 0.04 : 0.08,
                  shadowRadius: 8,
                  elevation: isPast || isCompleted || isNoShow || lcCancelled ? 1 : 3,
                  borderLeftWidth: 4,
                  borderLeftColor: lcCancelled ? `${primaryColor}80` : primaryColor,
                  borderWidth: isOngoing || isCheckedIn || isPendingConfirmation || lcCancelled ? 1 : 0,
                  borderColor: isCheckedIn
                    ? `${primaryColor}30`
                    : isPendingConfirmation
                    ? `${primaryColor}30`
                    : isOngoing
                    ? `${primaryColor}30`
                    : lcCancelled
                    ? `${primaryColor}20`
                    : 'transparent',
                  opacity: isPast && !isCompleted && !isScheduledOnline ? 0.7 : isNoShow ? 0.6 : lcCancelled ? 0.75 : 1,
                }}
              >
              <Pressable
                onPress={() => onView(appointment)}
                style={({ pressed }) => ({
                  borderRadius: 16,
                  opacity: pressed ? 0.82 : 1,
                })}
              >
              {/* Inner padding container — enforces 20px clearance from all card edges */}
              <View style={{ paddingTop: 20, paddingBottom: 20, paddingLeft: 20, paddingRight: 20 }}>
              {/* ROW 1: Status badge (left) + Eye/Edit icons (right) */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                {/* Left: primary status badge */}
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', marginRight: 8 }}>
                  {(isCheckedIn || isPendingConfirmation || isCompleted || isNoShow || lcCancelled || isScheduledOnline) ? (
                    <View style={{
                      flexDirection: 'row', alignItems: 'center', gap: 5,
                      flexShrink: 1,
                      backgroundColor: lcCancelled ? `${primaryColor}12` : `${primaryColor}15`,
                      paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
                    }}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: lcCancelled ? `${primaryColor}90` : primaryColor, flexShrink: 0 }} />
                      <Text style={{ fontSize: 11, fontWeight: '700', color: lcCancelled ? `${primaryColor}B0` : primaryColor, flexShrink: 1 }} numberOfLines={1}>
                        {isCheckedIn
                          ? t('statusCheckedIn', language).toUpperCase()
                          : isPendingConfirmation
                          ? (apptIsLogVisit ? t('logVisitPendingConfirmation', language).toUpperCase() : t('confirmOutcome', language).toUpperCase())
                          : isCompleted
                          ? t('statusCompleted', language).toUpperCase()
                          : lcCancelled
                          ? t('outcomeCancelled', language).toUpperCase()
                          : isScheduledOnline
                          ? t('statusScheduled', language).toUpperCase()
                          : t('statusNoShow', language).toUpperCase()}
                      </Text>
                    </View>
                  ) : (isOngoing || isNext) ? (
                    <View style={{
                      flexDirection: 'row', alignItems: 'center',
                      flexShrink: 1,
                      backgroundColor: primaryColor,
                      paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
                    }}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff', marginRight: 6, flexShrink: 0 }} />
                      <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600', flexShrink: 1 }} numberOfLines={1}>
                        {isOngoing ? t('visitOngoing', language) : t('nextVisit', language)}
                      </Text>
                    </View>
                  ) : appointment.seriesId ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1, backgroundColor: isDark ? `${primaryColor}20` : `${primaryColor}12`, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
                      <Repeat size={10} color={primaryColor} />
                      <Text style={{ color: primaryColor, fontSize: 10, fontWeight: '600', marginLeft: 4, flexShrink: 1 }} numberOfLines={1}>
                        {t('recurring', language)}
                      </Text>
                    </View>
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1, backgroundColor: isDark ? `${primaryColor}20` : `${primaryColor}12`, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: primaryColor, marginRight: 6, flexShrink: 0 }} />
                      <Text style={{ color: primaryColor, fontSize: 11, fontWeight: '600', flexShrink: 1 }} numberOfLines={1}>
                        {t('upcomingVisit', language).toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Right: icon-only buttons */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Pressable
                    onPress={(e) => { e.stopPropagation(); onView(appointment); }}
                    hitSlop={10}
                    style={{ width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? `${primaryColor}25` : `${primaryColor}15` }}
                  >
                    <Eye size={15} color={primaryColor} />
                  </Pressable>
                  <Pressable
                    onPress={(e) => { e.stopPropagation(); onEdit(appointment); }}
                    hitSlop={10}
                    style={{ width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9' }}
                  >
                    <Edit3 size={15} color={colors.textTertiary} />
                  </Pressable>
                </View>
              </View>

              {/* ROW 2 (conditional): Ongoing / Next-up full-width pill — only when also has a lifecycle status badge */}
              {(isOngoing || isNext) && (isCheckedIn || isPendingConfirmation || isCompleted || isNoShow || lcCancelled || isScheduledOnline) && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: primaryColor, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff', marginRight: 6 }} />
                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>
                      {isOngoing ? t('visitOngoing', language) : t('nextVisit', language)}
                    </Text>
                  </View>
                </View>
              )}

              {/* Time row */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, marginTop: 2 }}>
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: isOngoing ? `${primaryColor}25` : `${primaryColor}15`, alignItems: 'center', justifyContent: 'center' }}>
                  <Clock size={18} color={primaryColor} />
                </View>
                <View style={{ marginLeft: 10 }}>
                  <Text style={{ color: isPast ? colors.textSecondary : colors.text, fontSize: 16, fontWeight: '600' }}>
                    {appointment.startTime ? formatTime(appointment.startTime) : ''}
                    {appointment.endTime && ` - ${formatTime(appointment.endTime)}`}
                  </Text>
                  {!!appointment.duration && (
                    <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 2 }}>
                      {appointment.duration} {t('minLabel', language)}
                    </Text>
                  )}
                </View>
              </View>

              {/* Staff Member */}
              {staff && (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginBottom: 12,
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: `${primaryColor}20`,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: primaryColor, fontWeight: '600', fontSize: 14 }}>
                      {staff.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ marginLeft: 10, flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 14, fontWeight: '500' }}>
                      {staff.name}
                    </Text>
                    <Text style={{ color: colors.textTertiary, fontSize: 11, textTransform: 'uppercase', marginTop: 2 }}>
                      {t('staff', language)}
                    </Text>
                  </View>
                </View>
              )}

              {/* Client (with inline service name) */}
              {clientDisplayName && (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginBottom: 12,
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: `${primaryColor}15`,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: primaryColor, fontWeight: '600', fontSize: 14 }}>
                      {(() => {
                        const parts = clientDisplayName.trim().split(/\s+/);
                        if (parts.length >= 2) {
                          return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
                        }
                        return clientDisplayName.charAt(0).toUpperCase();
                      })()}
                    </Text>
                  </View>
                  <View style={{ marginLeft: 10, flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 15, fontWeight: '500' }}>
                      {clientDisplayName}
                    </Text>
                    <Text style={{ color: colors.textTertiary, fontSize: 11, textTransform: 'uppercase', marginTop: 2 }}>
                      {t('client', language)}
                    </Text>
                  </View>
                </View>
              )}

              {/* Service row — always shown if service exists, icon-based layout */}
              {appointment.serviceName ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: `${primaryColor}12`, alignItems: 'center', justifyContent: 'center' }}>
                    {/hair|cut|trim|barb/i.test(appointment.serviceName)
                      ? <Scissors size={16} color={primaryColor} />
                      : /facial|face|peel|glow/i.test(appointment.serviceName)
                      ? <Sparkles size={16} color={primaryColor} />
                      : /massage|body|spa|relax/i.test(appointment.serviceName)
                      ? <CreditCard size={16} color={primaryColor} />
                      : <Tag size={16} color={primaryColor} />
                    }
                  </View>
                  <View style={{ marginLeft: 10, flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 15, fontWeight: '500' }}>{appointment.serviceName}</Text>
                    <Text style={{ color: colors.textTertiary, fontSize: 11, textTransform: 'uppercase', marginTop: 2 }}>Service</Text>
                  </View>
                </View>
              ) : matchedTags.length > 0 ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: `${primaryColor}12`, alignItems: 'center', justifyContent: 'center' }}>
                    <Tag size={16} color={primaryColor} />
                  </View>
                  <View style={{ marginLeft: 10, flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 15, fontWeight: '500' }}>{matchedTags[0].name}</Text>
                    <Text style={{ color: colors.textTertiary, fontSize: 11, textTransform: 'uppercase', marginTop: 2 }}>Service</Text>
                  </View>
                </View>
              ) : appointment.title && !apptIsLogVisit ? (
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{appointment.title}</Text>
                </View>
              ) : null}

              {/* Gift Card row — icon+text, no white box */}
              {(appointment.giftCardId || appointment.giftCardCodeFromNotes) && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: `${primaryColor}12`, alignItems: 'center', justifyContent: 'center' }}>
                    <Gift size={16} color={primaryColor} />
                  </View>
                  <View style={{ marginLeft: 10, flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 15, fontWeight: '500' }}>
                      {appointment.giftCardCodeFromNotes ?? (appointment.giftCardId ? appointment.giftCardId.slice(0, 8).toUpperCase() : '')}
                    </Text>
                    <Text style={{ color: colors.textTertiary, fontSize: 11, textTransform: 'uppercase', marginTop: 2 }}>
                      {t('giftCardLabel', language)}
                    </Text>
                  </View>
                </View>
              )}

              {/* Online Booking — icon row only, no white box */}
              {appointment.confirmationCode && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: `${primaryColor}12`, alignItems: 'center', justifyContent: 'center' }}>
                    <CalendarClock size={16} color={primaryColor} />
                  </View>
                  <View style={{ marginLeft: 10, flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 15, fontWeight: '500' }}>
                      {t('onlineBookingBadge', language)} • {appointment.confirmationCode}
                    </Text>
                    <Text style={{ color: colors.textTertiary, fontSize: 11, textTransform: 'uppercase', marginTop: 2 }}>
                      {t('onlineBookingBadge', language)}
                    </Text>
                  </View>
                </View>
              )}

              {/* Log Visit summary — only for logged visits */}
              {apptIsLogVisit && !appointment.confirmationCode && (
                <View style={{ backgroundColor: isDark ? colors.backgroundTertiary : '#F8FAFC', borderRadius: 10, padding: 10, marginBottom: 4 }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                    {(() => {
                      const count = appointment.serviceTags?.length ?? 0;
                      if (count === 0) return t('visitTitle', language);
                      if (count === 1) return `${t('visitTitle', language)} — ${t('visitServiceSingular', language)}`;
                      return `${t('visitTitle', language)} — ${t('visitServicesPlural', language).replace('{count}', String(count))}`;
                    })()}
                  </Text>
                </View>
              )}

              {/* Plain notes — only when no confirmation code and not a log visit */}
              {!apptIsLogVisit && !appointment.confirmationCode && appointment.notes && (
                <View style={{ backgroundColor: isDark ? colors.backgroundTertiary : '#F8FAFC', borderRadius: 10, padding: 10 }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                    {appointment.notes}
                  </Text>
                </View>
              )}
              </View>{/* end inner padding container */}
            </Pressable>
            </View>
          </View>
        );
        })
      ) : (
        <View
          style={{
            alignItems: 'center',
            paddingVertical: 60,
          }}
        >
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <CalendarDays size={36} color={colors.textTertiary} />
          </View>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '600', marginBottom: 6 }}>
            {t('noAppointments', language)}
          </Text>
          <Text style={{ color: colors.textTertiary, fontSize: 14, textAlign: 'center', maxWidth: 260 }}>
            {t('noAppointmentsScheduled', language)} {dateLabel.toLowerCase()}
          </Text>
          <Text style={{ color: colors.textTertiary, fontSize: 13, textAlign: 'center', marginTop: 16 }}>
            {t('useBookAppointmentButton', language)}
          </Text>
        </View>
      )}
    </View>
  );
}
