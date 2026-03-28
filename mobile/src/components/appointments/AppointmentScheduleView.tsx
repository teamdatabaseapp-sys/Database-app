import React from 'react';
import { View, Text, Pressable, Image } from 'react-native';
import {
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  startOfMonth,
  endOfMonth,
} from 'date-fns';
import * as Haptics from 'expo-haptics';
import { Clock } from 'lucide-react-native';
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

// Time slots for schedule view (8 AM to 8 PM)
const TIME_SLOTS = Array.from({ length: 13 }, (_, i) => {
  const hour = i + 8;
  return {
    hour,
    label: format(new Date().setHours(hour, 0, 0, 0), 'h a'),
    time24: `${hour.toString().padStart(2, '0')}:00`,
  };
});

interface AppointmentScheduleViewProps {
  dateRangeMode: DateRangeMode;
  selectedDate: Date;
  selectedStaffFilter: string | null;
  staffMembers: LocalStaff[];
  currentAppointments: LocalAppointment[];
  appointments: LocalAppointment[];
  weekdays: string[];
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
  onSelectDate: (date: Date) => void;
  onView: (appointment: LocalAppointment) => void;
  onEdit: (appointment: LocalAppointment) => void;
}

export function AppointmentScheduleView({
  dateRangeMode,
  selectedDate,
  selectedStaffFilter,
  staffMembers,
  currentAppointments,
  appointments,
  weekdays,
  language,
  getClient,
  getStaffMember,
  getAppointmentStatus,
  formatTime,
  formatWithLocale,
  dateLabel,
  onSelectDate,
  onView,
  onEdit,
}: AppointmentScheduleViewProps) {
  const { colors, isDark, primaryColor } = useTheme();

  return (
    <>
      {/* Schedule View - Different layouts based on date range mode */}
      {dateRangeMode === 'month' ? (
        /* Monthly Calendar View - Shows days with appointment counts */
        <View
          style={{ padding: 16 }}
        >
          {/* Month Calendar Grid */}
          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: 16,
              padding: 16,
            }}
          >
            {/* Weekday Headers */}
            <View style={{ flexDirection: 'row', marginBottom: 12 }}>
              {weekdays.map((day, index) => (
                <View key={index} style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ color: colors.textTertiary, fontSize: 12, fontWeight: '500' }}>
                    {day}
                  </Text>
                </View>
              ))}
            </View>

            {/* Calendar Days */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {(() => {
                const monthStart = startOfMonth(selectedDate);
                const monthEnd = endOfMonth(selectedDate);
                const calStart = startOfWeek(monthStart);
                const calEnd = endOfWeek(monthEnd);
                const days = eachDayOfInterval({ start: calStart, end: calEnd });

                return days.map((day, index) => {
                  const isCurrentMonthDay = isSameMonth(day, selectedDate);
                  const isTodayDay = isToday(day);
                  const dayAppointments = appointments.filter((a) => {
                    const matches = isSameDay(new Date(a.date), day);
                    if (!matches) return false;
                    if (selectedStaffFilter && a.staffId !== selectedStaffFilter) return false;
                    return true;
                  });
                  const appointmentCount = dayAppointments.length;

                  return (
                    <Pressable
                      key={index}
                      onPress={() => {
                        onSelectDate(day);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                      style={{
                        width: '14.28%',
                        aspectRatio: 1,
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 2,
                      }}
                    >
                      <View
                        style={{
                          width: '100%',
                          height: '100%',
                          borderRadius: 8,
                          backgroundColor: isTodayDay
                            ? `${primaryColor}15`
                            : appointmentCount > 0
                            ? isDark ? colors.backgroundTertiary : '#F1F5F9'
                            : 'transparent',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderWidth: isTodayDay ? 1 : 0,
                          borderColor: primaryColor,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 14,
                            fontWeight: isTodayDay ? '600' : '400',
                            color: !isCurrentMonthDay
                              ? colors.textTertiary
                              : isTodayDay
                              ? primaryColor
                              : colors.text,
                          }}
                        >
                          {format(day, 'd')}
                        </Text>
                        {appointmentCount > 0 && (
                          <Text
                            style={{
                              fontSize: 10,
                              fontWeight: '600',
                              color: primaryColor,
                              marginTop: 2,
                            }}
                          >
                            {appointmentCount}
                          </Text>
                        )}
                      </View>
                    </Pressable>
                  );
                });
              })()}
            </View>
          </View>

          {/* Monthly Summary */}
          <View style={{ marginTop: 16 }}>
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600', marginBottom: 12 }}>
              {t('appointmentsThisMonth', language)}: {currentAppointments.length}
            </Text>
            {currentAppointments.length > 0 && (
              <View style={{ backgroundColor: colors.card, borderRadius: 12, padding: 12 }}>
                {(() => {
                  // Group by date
                  const grouped = currentAppointments.reduce((acc, apt) => {
                    const dateKey = format(new Date(apt.date), 'yyyy-MM-dd');
                    if (!acc[dateKey]) acc[dateKey] = [];
                    acc[dateKey].push(apt);
                    return acc;
                  }, {} as Record<string, typeof currentAppointments>);

                  return Object.entries(grouped).slice(0, 5).map(([dateKey, apts]) => (
                    <Pressable
                      key={dateKey}
                      onPress={() => {
                        onSelectDate(new Date(dateKey));
                      }}
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        paddingVertical: 8,
                        borderBottomWidth: 1,
                        borderBottomColor: colors.border,
                      }}
                    >
                      <Text style={{ color: colors.text, fontSize: 14 }}>
                        {formatWithLocale(new Date(dateKey), 'EEE, MMM d')}
                      </Text>
                      <Text style={{ color: primaryColor, fontSize: 14, fontWeight: '600' }}>
                        {apts.length} appointment{apts.length > 1 ? 's' : ''}
                      </Text>
                    </Pressable>
                  ));
                })()}
              </View>
            )}
          </View>

          {/* Empty State */}
          {currentAppointments.length === 0 && (
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <Text style={{ color: colors.textTertiary, fontSize: 14 }}>
                {t('noAppointmentsThisMonth', language)}
              </Text>
            </View>
          )}
        </View>
      ) : dateRangeMode === 'week' ? (
        /* Weekly Schedule View - Shows each day with time slots */
        <View>
          {/* Week Days */}
          {(() => {
            const weekStart = startOfWeek(selectedDate);
            const weekDays = eachDayOfInterval({ start: weekStart, end: endOfWeek(weekStart) });

            return weekDays.map((day) => {
              const dayAppointments = currentAppointments.filter((a) =>
                isSameDay(new Date(a.date), day)
              );
              const isTodayDay = isToday(day);

              return (
                <View key={day.toISOString()} style={{ marginBottom: 8 }}>
                  {/* Day Header */}
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      backgroundColor: isTodayDay ? `${primaryColor}15` : colors.card,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                    }}
                  >
                    <Text
                      style={{
                        color: isTodayDay ? primaryColor : colors.text,
                        fontSize: 15,
                        fontWeight: '600',
                      }}
                    >
                      {formatWithLocale(day, 'EEEE, MMM d')}
                      {isTodayDay && ` (${t('today', language)})`}
                    </Text>
                    <Text style={{ color: colors.textTertiary, fontSize: 13 }}>
                      {dayAppointments.length} {dayAppointments.length !== 1 ? t('appointments', language).toLowerCase() : t('appointmentSingular', language)}
                    </Text>
                  </View>

                  {/* Day's Time Slots with Appointments */}
                  {dayAppointments.length > 0 ? (
                    <View style={{ backgroundColor: colors.card }}>
                      {TIME_SLOTS.map((slot) => {
                        const staffList = selectedStaffFilter
                          ? staffMembers.filter(s => s.id === selectedStaffFilter)
                          : staffMembers.length > 0
                            ? staffMembers
                            : [{ id: 'unassigned', name: t('unassigned', language), color: '#6B7280', storeIds: [] }];

                        const slotAppointments = dayAppointments.filter((apt) => {
                          const aptHour = parseInt(apt.startTime.split(':')[0], 10);
                          return aptHour === slot.hour;
                        });

                        if (slotAppointments.length === 0) return null;

                        return (
                          <View
                            key={slot.hour}
                            style={{
                              flexDirection: 'row',
                              borderBottomWidth: 1,
                              borderBottomColor: colors.border,
                              minHeight: 50,
                            }}
                          >
                            <View
                              style={{
                                width: 60,
                                alignItems: 'center',
                                justifyContent: 'flex-start',
                                paddingTop: 8,
                                backgroundColor: isDark ? colors.background : '#F8FAFC',
                              }}
                            >
                              <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '500' }}>
                                {slot.label}
                              </Text>
                            </View>
                            <View style={{ flex: 1, flexDirection: 'row', padding: 4 }}>
                              {slotAppointments.map((apt) => {
                                const client = getClient(apt.clientId);
                                const staff = getStaffMember(apt.staffId);
                                const staffColor = staff?.color || '#6B7280';

                                // Get appointment status for weekly view
                                const aptStatus = getAppointmentStatus(apt, dayAppointments);
                                const isOngoing = aptStatus === 'ongoing';
                                const isNext = aptStatus === 'next';
                                const isPast = aptStatus === 'past';

                                return (
                                  <Pressable
                                    key={apt.id}
                                    onPress={() => onEdit(apt)}
                                    style={{
                                      flex: 1,
                                      backgroundColor: isOngoing
                                        ? `${primaryColor}30`
                                        : isNext
                                        ? `${primaryColor}15`
                                        : `${staffColor}20`,
                                      borderLeftWidth: 3,
                                      borderLeftColor: isOngoing ? primaryColor : isNext ? primaryColor : staffColor,
                                      borderRadius: 6,
                                      padding: 6,
                                      marginRight: 4,
                                      opacity: isPast ? 0.6 : 1,
                                    }}
                                  >
                                    {/* Status indicator dot for ongoing/next */}
                                    {(isOngoing || isNext) && (
                                      <View
                                        style={{
                                          flexDirection: 'row',
                                          alignItems: 'center',
                                          marginBottom: 2,
                                        }}
                                      >
                                        <View
                                          style={{
                                            width: 5,
                                            height: 5,
                                            borderRadius: 2.5,
                                            backgroundColor: primaryColor,
                                            marginRight: 4,
                                          }}
                                        />
                                        <Text style={{ color: primaryColor, fontSize: 9, fontWeight: '600' }}>
                                          {isOngoing ? t('visitOngoing', language) : t('nextVisit', language)}
                                        </Text>
                                      </View>
                                    )}
                                    <Text style={{ color: isPast ? colors.textTertiary : (isOngoing ? primaryColor : isNext ? primaryColor : staffColor), fontSize: 11, fontWeight: '600' }} numberOfLines={1}>
                                      {apt.startTime ? formatTime(apt.startTime) : ''} - {staff?.name || t('unassigned', language)}
                                    </Text>
                                    <Text style={{ color: isPast ? colors.textTertiary : colors.text, fontSize: 11, fontWeight: '500', marginTop: 2 }} numberOfLines={1}>
                                      {apt.serviceName
                                        ? `${client?.name || t('client', language)} • ${apt.serviceName}`
                                        : client?.name || t('client', language)}
                                    </Text>
                                  </Pressable>
                                );
                              })}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  ) : (
                    <View style={{ backgroundColor: colors.card, paddingVertical: 12, paddingHorizontal: 16 }}>
                      <Text style={{ color: colors.textTertiary, fontSize: 13 }}>{t('noAppointments', language)}</Text>
                    </View>
                  )}
                </View>
              );
            });
          })()}
        </View>
      ) : (
        /* Daily Schedule View - Staff Column View (for day/yesterday/today/tomorrow) */
        <View>
          {currentAppointments.length > 0 ? (
            <>
          {/* Schedule Header with Staff Names */}
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: colors.card,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
              paddingVertical: 12,
            }}
          >
            {/* Time Column Header */}
            <View style={{ width: 54, alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={16} color={colors.textTertiary} />
            </View>
            {/* Staff Column Headers */}
            {(selectedStaffFilter
              ? staffMembers.filter(s => s.id === selectedStaffFilter)
              : staffMembers
            ).map((staff) => (
              <View
                key={staff.id}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  paddingHorizontal: 4,
                  minWidth: 104,
                }}
              >
                {staff.photoUrl ? (
                  <Image
                    source={{ uri: staff.photoUrl }}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      marginBottom: 5,
                      borderWidth: 2,
                      borderColor: `${primaryColor}40`,
                    }}
                  />
                ) : (
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: `${primaryColor}20`,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 5,
                      borderWidth: 1.5,
                      borderColor: `${primaryColor}50`,
                    }}
                  >
                    <Text style={{ color: primaryColor, fontWeight: '700', fontSize: 15 }}>
                      {staff.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <Text
                  style={{ color: colors.text, fontSize: 12, fontWeight: '500', textAlign: 'center' }}
                  numberOfLines={1}
                >
                  {staff.name}
                </Text>
              </View>
            ))}
          </View>

          {/* Time Slots Grid */}
          {TIME_SLOTS.map((slot) => {
            const staffList = selectedStaffFilter
              ? staffMembers.filter(s => s.id === selectedStaffFilter)
              : staffMembers;

            // Check if any staff column has appointments at this hour
            const staffSlotAppointments = currentAppointments.filter((apt) => {
              if (!apt.staffId) return false;
              const aptHour = parseInt(apt.startTime.split(':')[0], 10);
              return aptHour === slot.hour;
            });

            // Skip empty slots entirely — prevents blank rows dominating the grid
            if (staffSlotAppointments.length === 0) {
              return null;
            }

            return (
              <View
                key={slot.hour}
                style={{
                  flexDirection: 'row',
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                  minHeight: 185,
                }}
              >
                {/* Time Label — start hour + next hour below */}
                <View
                  style={{
                    width: 54,
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    paddingTop: 10,
                    backgroundColor: isDark ? colors.background : '#F8FAFC',
                  }}
                >
                  <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '500' }}>
                    {slot.label}
                  </Text>
                  <Text style={{ color: colors.textTertiary, fontSize: 10, fontWeight: '400', marginTop: 3, opacity: 0.7 }}>
                    {format(new Date().setHours(slot.hour + 1, 0, 0, 0), 'h a')}
                  </Text>
                </View>

                {/* Staff Columns */}
                {staffList.map((staff) => {
                  // Find appointments for this staff at this hour on the selected date
                  const staffAppointments = currentAppointments.filter((apt) => {
                    // For assigned staff columns, only show appointments with staffId
                    if (!apt.staffId) return false;
                    if (apt.staffId !== staff.id) return false;
                    const aptHour = parseInt(apt.startTime.split(':')[0], 10);
                    return aptHour === slot.hour;
                  });

                  return (
                    <View
                      key={staff.id}
                      style={{
                        flex: 1,
                        borderLeftWidth: 1,
                        borderLeftColor: colors.border,
                        padding: 3,
                        minWidth: 104,
                        backgroundColor: colors.card,
                      }}
                    >
                      {staffAppointments.map((apt) => {
                        const client = getClient(apt.clientId);
                        const clientName = client?.name ?? apt.customerName;

                        // Lifecycle status
                        const lc = (apt as LocalAppointment & { lifecycleStatus?: AppointmentLifecycleStatus }).lifecycleStatus ?? 'scheduled';
                        const isCheckedIn = lc === 'checked_in';
                        const isPendingConfirmation = lc === 'pending_confirmation';
                        const isCompleted = lc === 'completed';
                        const isNoShow = lc === 'no_show';
                        const isCancelled = lc === 'cancelled';

                        // Hide cancelled appointments from grid entirely
                        if (isCancelled) return null;

                        // Time status
                        const aptStatus = getAppointmentStatus(apt, currentAppointments);
                        const isOngoing = aptStatus === 'ongoing';
                        const isNext = aptStatus === 'next';
                        const isPast = aptStatus === 'past';

                        // Status label — every block gets a chip
                        const statusLabel = isCheckedIn
                          ? t('statusCheckedIn', language)
                          : isPendingConfirmation
                          ? t('confirmOutcome', language)
                          : isCompleted
                          ? t('statusCompleted', language)
                          : isNoShow
                          ? t('statusNoShow', language)
                          : isOngoing
                          ? t('visitOngoing', language)
                          : isNext
                          ? t('nextVisit', language)
                          : t('statusScheduled', language);

                        // Gift card — show last 4 chars if code is long
                        const rawCode = apt.giftCardCodeFromNotes ?? (apt.giftCardId ? apt.giftCardId.slice(0, 8).toUpperCase() : null);
                        const giftCardCode = rawCode;
                        const giftCardShort = rawCode && rawCode.length > 6 ? `GC • ${rawCode.slice(-4)}` : rawCode ? `GC • ${rawCode}` : null;

                        // Service label — resolve from all possible field names
                        const serviceLabel = (apt as any).serviceName ?? (apt as any).service_name ?? (apt as any).service?.name ?? (apt as any).services?.name ?? null;

                        return (
                          <Pressable
                            key={apt.id}
                            onPress={() => onView(apt)}
                            style={({ pressed }) => ({
                              backgroundColor: pressed
                                ? `${primaryColor}35`
                                : isOngoing
                                ? `${primaryColor}22`
                                : isNext
                                ? `${primaryColor}18`
                                : isCompleted
                                ? `${primaryColor}15`
                                : `${primaryColor}10`,
                              borderLeftWidth: 3,
                              borderLeftColor: primaryColor,
                              borderRadius: 8,
                              paddingHorizontal: 10,
                              paddingTop: 10,
                              paddingBottom: 10,
                              marginBottom: 4,
                              opacity: (isPast && !isCompleted) || isNoShow ? 0.65 : 1,
                            })}
                          >
                            {/* 1. Status chip — always shown, theme-colored pill */}
                            <View style={{
                              alignSelf: 'flex-start',
                              backgroundColor: `${primaryColor}12`,
                              borderWidth: 1,
                              borderColor: `${primaryColor}50`,
                              paddingHorizontal: 5,
                              paddingVertical: 2,
                              borderRadius: 20,
                              marginBottom: 8,
                            }}>
                              <Text style={{ color: primaryColor, fontSize: 8, fontWeight: '700', letterSpacing: 0.3 }}>
                                {statusLabel.toUpperCase()}
                              </Text>
                            </View>

                            {/* 2. Client name — primary dominant element */}
                            {clientName ? (
                              <Text
                                style={{ color: isPast ? colors.textTertiary : colors.text, fontSize: 14, fontWeight: '600', marginBottom: 6, lineHeight: 19 }}
                                numberOfLines={2}
                              >
                                {clientName}
                              </Text>
                            ) : null}

                            {/* 3. Service — clearly readable secondary */}
                            {serviceLabel ? (
                              <Text
                                style={{ color: isPast ? colors.textTertiary : (colors.textSecondary ?? colors.text), fontSize: 11, fontWeight: '500', marginBottom: 6, lineHeight: 15 }}
                                numberOfLines={1}
                              >
                                {serviceLabel}
                              </Text>
                            ) : null}

                            {/* 4. Gift card code — tertiary, lower contrast */}
                            {giftCardCode ? (
                              <Text
                                style={{ color: colors.textTertiary, fontSize: 10, fontWeight: '400', lineHeight: 14, letterSpacing: 0.2 }}
                                numberOfLines={1}
                              >
                                {giftCardShort}
                              </Text>
                            ) : null}
                          </Pressable>
                        );
                      })}
                    </View>
                  );
                })}
              </View>
            );
          })}
            </>
          ) : (
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <Text style={{ color: colors.textTertiary, fontSize: 14 }}>
                {t('noAppointmentsFor', language)} {dateLabel.toLowerCase()}
              </Text>
            </View>
          )}
        </View>
      )}
    </>
  );
}
