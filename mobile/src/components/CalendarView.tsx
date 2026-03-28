import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, Modal, TextInput, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Clock,
  User,
  Search,
  Check,
  Calendar,
  Trash2,
} from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/ThemeContext';
import { useToast } from '@/lib/ToastContext';
import { useSaveConfirmation } from '@/lib/SaveConfirmationContext';
import { cn } from '@/lib/cn';
import { t, getDateFnsLocale, getCachedDateFnsLocale } from '@/lib/i18n';
import { Language } from '@/lib/types';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  isToday,
  Locale,
} from 'date-fns';
import { Client, Appointment } from '@/lib/types';

interface CalendarViewProps {
  onAddClient: () => void;
  hideHeader?: boolean;
}

export function CalendarView({ onAddClient, hideHeader }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [showAppointmentDetails, setShowAppointmentDetails] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);

  // Form state
  const [appointmentTitle, setAppointmentTitle] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('09:00');
  const [appointmentEndTime, setAppointmentEndTime] = useState('10:00');
  const [appointmentNotes, setAppointmentNotes] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [showClientSearch, setShowClientSearch] = useState(false);

  const { colors, isDark, primaryColor } = useTheme();
  const { showSuccess } = useToast();
  const { showSaveConfirmation } = useSaveConfirmation();
  const language = useStore((s) => s.language) as Language;
  const [locale, setLocale] = useState<Locale | undefined>(undefined);

  useEffect(() => {
    const cached = getCachedDateFnsLocale(language);
    if (cached) setLocale(cached);
    getDateFnsLocale(language).then(setLocale);
  }, [language]);

  // Get translated weekdays
  const weekdays = useMemo(() => [
    t('sunShort', language),
    t('monShort', language),
    t('tueShort', language),
    t('wedShort', language),
    t('thuShort', language),
    t('friShort', language),
    t('satShort', language),
  ], [language]);

  // Format dates with locale
  const formatWithLocale = useCallback((date: Date, formatStr: string) => {
    return locale ? format(date, formatStr, { locale }) : format(date, formatStr);
  }, [locale]);

  // Store
  const allClients = useStore((s) => s.clients);
  const allAppointments = useStore((s) => s.appointments);
  const userId = useStore((s) => s.user?.id);
  const addAppointment = useStore((s) => s.addAppointment);
  const deleteAppointment = useStore((s) => s.deleteAppointment);

  // Filter data by user
  const clients = useMemo(() => {
    if (!userId) return [];
    return allClients.filter((c) => c.userId === userId && !c.isArchived);
  }, [allClients, userId]);

  const appointments = useMemo(() => {
    if (!userId) return [];
    return allAppointments.filter((a) => a.userId === userId);
  }, [allAppointments, userId]);

  // Filtered clients for search
  const filteredClients = useMemo(() => {
    if (!clientSearchQuery.trim()) return clients;
    const query = clientSearchQuery.toLowerCase();
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.email.toLowerCase().includes(query) ||
        c.phone.includes(query)
    );
  }, [clients, clientSearchQuery]);

  // Get calendar days
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  // Get appointments for a specific day
  const getAppointmentsForDay = useCallback(
    (date: Date) => {
      return appointments.filter((a) => isSameDay(new Date(a.date), date));
    },
    [appointments]
  );

  // Get appointments for selected date
  const selectedDateAppointments = useMemo(() => {
    if (!selectedDate) return [];
    return getAppointmentsForDay(selectedDate).sort((a, b) =>
      a.startTime.localeCompare(b.startTime)
    );
  }, [selectedDate, getAppointmentsForDay]);

  // Navigation
  const goToPreviousMonth = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const goToNextMonth = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const goToToday = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentMonth(new Date());
    setSelectedDate(new Date());
  };

  // Handle day press
  const handleDayPress = (date: Date) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedDate(date);
  };

  // Open new appointment modal
  const openNewAppointmentModal = () => {
    if (!selectedDate) {
      setSelectedDate(new Date());
    }
    setAppointmentTitle('');
    setAppointmentTime('09:00');
    setAppointmentEndTime('10:00');
    setAppointmentNotes('');
    setSelectedClientId(null);
    setClientSearchQuery('');
    setShowAppointmentModal(true);
  };

  // Save appointment
  const handleSaveAppointment = () => {
    if (!selectedClientId || !selectedDate) return;

    const client = clients.find((c) => c.id === selectedClientId);
    if (!client) return;

    addAppointment({
      clientId: selectedClientId,
      date: selectedDate,
      startTime: appointmentTime,
      endTime: appointmentEndTime,
      title: appointmentTitle || `Appointment with ${client.name}`,
      notes: appointmentNotes,
    });

    showSaveConfirmation();
    setShowAppointmentModal(false);
  };

  // Delete appointment
  const handleDeleteAppointment = (appointment: Appointment) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    deleteAppointment(appointment.id);
    setShowAppointmentDetails(false);
    setSelectedAppointment(null);
  };

  // Get client by ID
  const getClient = (clientId: string) => {
    return clients.find((c) => c.id === clientId);
  };

  // Render calendar day
  const renderDay = (date: Date, index: number) => {
    const isCurrentMonth = isSameMonth(date, currentMonth);
    const isSelected = selectedDate && isSameDay(date, selectedDate);
    const dayAppointments = getAppointmentsForDay(date);
    const hasAppointments = dayAppointments.length > 0;
    const isTodayDate = isToday(date);

    return (
      <Pressable
        key={index}
        onPress={() => handleDayPress(date)}
        style={{
          flex: 1,
          aspectRatio: 1,
          alignItems: 'center',
          justifyContent: 'center',
          margin: 2,
          borderRadius: 12,
          backgroundColor: isSelected
            ? '#0D9488'
            : isTodayDate
            ? isDark ? '#0D948820' : '#0D948815'
            : 'transparent',
        }}
      >
        <Text
          style={{
            fontSize: 16,
            fontWeight: isSelected || isTodayDate ? '600' : '400',
            color: isSelected
              ? '#FFFFFF'
              : !isCurrentMonth
              ? colors.textTertiary
              : isTodayDate
              ? '#0D9488'
              : colors.text,
          }}
        >
          {format(date, 'd')}
        </Text>
        {hasAppointments && !isSelected && (
          <View
            style={{
              position: 'absolute',
              bottom: 4,
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: '#0D9488',
            }}
          />
        )}
        {hasAppointments && isSelected && (
          <View
            style={{
              position: 'absolute',
              bottom: 4,
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: '#FFFFFF',
            }}
          />
        )}
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <SafeAreaView edges={hideHeader ? [] : ['top']} style={{ backgroundColor: colors.headerBackground }}>
        <View style={{ paddingHorizontal: 16, paddingTop: hideHeader ? 8 : 16, paddingBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Pressable
                onPress={goToPreviousMonth}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ChevronLeft size={20} color={colors.textSecondary} />
              </Pressable>
              <Pressable onPress={goToToday}>
                <Text style={{ color: colors.text, fontSize: 20, fontWeight: 'bold', marginHorizontal: 16 }}>
                  {formatWithLocale(currentMonth, 'MMMM yyyy')}
                </Text>
              </Pressable>
              <Pressable
                onPress={goToNextMonth}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ChevronRight size={20} color={colors.textSecondary} />
              </Pressable>
            </View>
            <Pressable
              onPress={openNewAppointmentModal}
              style={{
                backgroundColor: '#0D9488',
                width: 40,
                height: 40,
                borderRadius: 20,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Plus size={22} color="#FFFFFF" />
            </Pressable>
          </View>

          {/* Weekday headers */}
          <View style={{ flexDirection: 'row', marginBottom: 8 }}>
            {weekdays.map((day, index) => (
              <View key={index} style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ color: colors.textTertiary, fontSize: 12, fontWeight: '500' }}>
                  {day}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </SafeAreaView>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {/* Calendar Grid */}
        <View style={{ paddingHorizontal: 12, paddingTop: 8 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {calendarDays.map((date, index) => (
              <View key={index} style={{ width: '14.28%' }}>
                {renderDay(date, index)}
              </View>
            ))}
          </View>
        </View>

        {/* Selected Date Appointments */}
        {selectedDate && (
          <Animated.View
            entering={FadeInUp.duration(300)}
            style={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 24 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600', flex: 1 }}>
                {formatWithLocale(selectedDate, 'EEEE, MMMM d')}
              </Text>
              <Text style={{ color: colors.textTertiary, fontSize: 14 }}>
                {selectedDateAppointments.length} {selectedDateAppointments.length === 1 ? t('appointmentSingular', language) : t('appointments', language)}
              </Text>
            </View>

            {selectedDateAppointments.length > 0 ? (
              selectedDateAppointments.map((appointment, index) => {
                const client = getClient(appointment.clientId);
                return (
                  <Pressable
                    key={appointment.id}
                    onPress={() => {
                      setSelectedAppointment(appointment);
                      setShowAppointmentDetails(true);
                    }}
                  >
                    <Animated.View
                      entering={FadeInDown.delay(index * 50).duration(300)}
                      style={{
                        backgroundColor: colors.card,
                        borderRadius: 16,
                        padding: 16,
                        marginBottom: 12,
                        borderLeftWidth: 4,
                        borderLeftColor: '#0D9488',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.05,
                        shadowRadius: 8,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600', marginBottom: 4 }}>
                            {appointment.title}
                          </Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                            <User size={14} color={colors.textTertiary} />
                            <Text style={{ color: colors.textSecondary, fontSize: 14, marginLeft: 6 }}>
                              {client?.name || 'Unknown Client'}
                            </Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Clock size={14} color={colors.textTertiary} />
                            <Text style={{ color: colors.textTertiary, fontSize: 14, marginLeft: 6 }}>
                              {appointment.startTime}
                              {appointment.endTime && ` - ${appointment.endTime}`}
                            </Text>
                          </View>
                        </View>
                        <ChevronRight size={20} color={colors.textTertiary} />
                      </View>
                    </Animated.View>
                  </Pressable>
                );
              })
            ) : (
              <View
                style={{
                  backgroundColor: colors.card,
                  borderRadius: 16,
                  padding: 32,
                  alignItems: 'center',
                }}
              >
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 12,
                  }}
                >
                  <Calendar size={28} color={colors.textTertiary} />
                </View>
                <Text style={{ color: colors.textSecondary, fontSize: 16, fontWeight: '500', marginBottom: 4 }}>
                  No appointments
                </Text>
                <Text style={{ color: colors.textTertiary, fontSize: 14, textAlign: 'center' }}>
                  Tap + to schedule an appointment
                </Text>
              </View>
            )}
          </Animated.View>
        )}
      </ScrollView>

      {/* New Appointment Modal */}
      <Modal
        visible={showAppointmentModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAppointmentModal(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? colors.background : '#F8FAFC' }} edges={['top']}>
          {/* Header */}
          <Animated.View
            entering={FadeIn.duration(300)}
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
            <Pressable onPress={() => setShowAppointmentModal(false)}>
              <Text style={{ color: colors.textSecondary, fontSize: 16 }}>Cancel</Text>
            </Pressable>
            <Text style={{ color: colors.text, fontSize: 17, fontWeight: '600' }}>New Appointment</Text>
            <Pressable
              onPress={handleSaveAppointment}
              disabled={!selectedClientId}
              style={{ opacity: selectedClientId ? 1 : 0.4 }}
            >
              <Text style={{ color: '#0D9488', fontSize: 16, fontWeight: '600' }}>Save</Text>
            </Pressable>
          </Animated.View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
            {/* Date Display */}
            <View
              style={{
                backgroundColor: colors.card,
                borderRadius: 16,
                padding: 16,
                marginBottom: 16,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 8,
              }}
            >
              <Text style={{ color: colors.textTertiary, fontSize: 12, fontWeight: '500', marginBottom: 4 }}>
                {t('selectDate', language).toUpperCase()}
              </Text>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: '500' }}>
                {selectedDate ? formatWithLocale(selectedDate, 'EEEE, MMMM d, yyyy') : t('selectDate', language)}
              </Text>
            </View>

            {/* Client Selection */}
            <View
              style={{
                backgroundColor: colors.card,
                borderRadius: 16,
                padding: 16,
                marginBottom: 16,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 8,
              }}
            >
              <Text style={{ color: colors.textTertiary, fontSize: 12, fontWeight: '500', marginBottom: 8 }}>
                CLIENT *
              </Text>

              {selectedClientId ? (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: '#0D948815',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                    }}
                  >
                    <Text style={{ color: '#0D9488', fontWeight: '600' }}>
                      {getClient(selectedClientId)?.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 16, fontWeight: '500' }}>
                      {getClient(selectedClientId)?.name}
                    </Text>
                    <Text style={{ color: colors.textTertiary, fontSize: 14 }}>
                      {getClient(selectedClientId)?.email}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => {
                      setSelectedClientId(null);
                      setShowClientSearch(true);
                    }}
                  >
                    <X size={20} color={colors.textTertiary} />
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  onPress={() => setShowClientSearch(true)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                    borderRadius: 12,
                    padding: 14,
                  }}
                >
                  <Search size={18} color={colors.textTertiary} />
                  <Text style={{ color: colors.textTertiary, marginLeft: 10, flex: 1 }}>
                    Search for a client...
                  </Text>
                </Pressable>
              )}

              {clients.length === 0 && (
                <Pressable
                  onPress={() => {
                    setShowAppointmentModal(false);
                    onAddClient();
                  }}
                  style={{
                    marginTop: 12,
                    padding: 12,
                    backgroundColor: '#0D948815',
                    borderRadius: 12,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: '#0D9488', fontWeight: '500' }}>
                    + Add your first client
                  </Text>
                </Pressable>
              )}
            </View>

            {/* Time Selection */}
            <View
              style={{
                backgroundColor: colors.card,
                borderRadius: 16,
                padding: 16,
                marginBottom: 16,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 8,
              }}
            >
              <Text style={{ color: colors.textTertiary, fontSize: 12, fontWeight: '500', marginBottom: 8 }}>
                TIME
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textTertiary, fontSize: 12, marginBottom: 4 }}>Start</Text>
                  <TextInput
                    value={appointmentTime}
                    onChangeText={setAppointmentTime}
                    placeholder="09:00"
                    placeholderTextColor={colors.textTertiary}
                    style={{
                      backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                      borderRadius: 12,
                      padding: 14,
                      color: colors.text,
                      fontSize: 16,
                    }}
                  />
                </View>
                <Text style={{ color: colors.textTertiary, marginHorizontal: 12 }}>to</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textTertiary, fontSize: 12, marginBottom: 4 }}>End</Text>
                  <TextInput
                    value={appointmentEndTime}
                    onChangeText={setAppointmentEndTime}
                    placeholder="10:00"
                    placeholderTextColor={colors.textTertiary}
                    style={{
                      backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                      borderRadius: 12,
                      padding: 14,
                      color: colors.text,
                      fontSize: 16,
                    }}
                  />
                </View>
              </View>
            </View>

            {/* Title */}
            <View
              style={{
                backgroundColor: colors.card,
                borderRadius: 16,
                padding: 16,
                marginBottom: 16,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 8,
              }}
            >
              <Text style={{ color: colors.textTertiary, fontSize: 12, fontWeight: '500', marginBottom: 8 }}>
                TITLE (OPTIONAL)
              </Text>
              <TextInput
                value={appointmentTitle}
                onChangeText={setAppointmentTitle}
                placeholder="e.g., Haircut, Consultation"
                placeholderTextColor={colors.textTertiary}
                style={{
                  backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                  borderRadius: 12,
                  padding: 14,
                  color: colors.text,
                  fontSize: 16,
                }}
              />
            </View>

            {/* Notes */}
            <View
              style={{
                backgroundColor: colors.card,
                borderRadius: 16,
                padding: 16,
                marginBottom: 16,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 8,
              }}
            >
              <Text style={{ color: colors.textTertiary, fontSize: 12, fontWeight: '500', marginBottom: 8 }}>
                NOTES (OPTIONAL)
              </Text>
              <TextInput
                value={appointmentNotes}
                onChangeText={setAppointmentNotes}
                placeholder="Any additional notes..."
                placeholderTextColor={colors.textTertiary}
                multiline
                numberOfLines={3}
                style={{
                  backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                  borderRadius: 12,
                  padding: 14,
                  color: colors.text,
                  fontSize: 16,
                  minHeight: 80,
                  textAlignVertical: 'top',
                }}
              />
            </View>
          </ScrollView>
        </SafeAreaView>

        {/* Client Search Modal */}
        <Modal
          visible={showClientSearch}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowClientSearch(false)}
        >
          <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? colors.background : '#F8FAFC' }} edges={['top']}>
            <Animated.View
              entering={FadeIn.duration(300)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 20,
                paddingVertical: 16,
                backgroundColor: colors.card,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              <View
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                  borderRadius: 12,
                  paddingHorizontal: 12,
                }}
              >
                <Search size={18} color={colors.textTertiary} />
                <TextInput
                  value={clientSearchQuery}
                  onChangeText={setClientSearchQuery}
                  placeholder="Search clients..."
                  placeholderTextColor={colors.textTertiary}
                  autoFocus
                  cursorColor={primaryColor}
                  style={{
                    flex: 1,
                    padding: 12,
                    color: colors.text,
                    fontSize: 16,
                  }}
                />
              </View>
              <Pressable onPress={() => setShowClientSearch(false)} style={{ marginLeft: 12 }}>
                <Text style={{ color: '#0D9488', fontSize: 16 }}>Cancel</Text>
              </Pressable>
            </Animated.View>

            <FlatList
              data={filteredClients}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 20 }}
              renderItem={({ item, index }) => (
                <Pressable
                  onPress={() => {
                    setSelectedClientId(item.id);
                    setShowClientSearch(false);
                    setClientSearchQuery('');
                  }}
                >
                  <Animated.View
                    entering={FadeInDown.delay(index * 30).duration(200)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: colors.card,
                      borderRadius: 16,
                      padding: 16,
                      marginBottom: 12,
                    }}
                  >
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        backgroundColor: '#0D948815',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 12,
                      }}
                    >
                      <Text style={{ color: '#0D9488', fontWeight: '600', fontSize: 16 }}>
                        {item.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontSize: 16, fontWeight: '500' }}>
                        {item.name}
                      </Text>
                      <Text style={{ color: colors.textTertiary, fontSize: 14 }}>
                        {item.email}
                      </Text>
                    </View>
                    {selectedClientId === item.id && (
                      <Check size={20} color={primaryColor} />
                    )}
                  </Animated.View>
                </Pressable>
              )}
              ListEmptyComponent={
                <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                  <User size={40} color={colors.textTertiary} />
                  <Text style={{ color: colors.textSecondary, fontSize: 16, marginTop: 12 }}>
                    No clients found
                  </Text>
                </View>
              }
            />
          </SafeAreaView>
        </Modal>
      </Modal>

      {/* Appointment Details Modal */}
      <Modal
        visible={showAppointmentDetails}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAppointmentDetails(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? colors.background : '#F8FAFC' }} edges={['top']}>
          <Animated.View
            entering={FadeIn.duration(300)}
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
            <Pressable onPress={() => setShowAppointmentDetails(false)}>
              <Text style={{ color: colors.textSecondary, fontSize: 16 }}>Close</Text>
            </Pressable>
            <Text style={{ color: colors.text, fontSize: 17, fontWeight: '600' }}>Appointment</Text>
            <View style={{ width: 50 }} />
          </Animated.View>

          {selectedAppointment && (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
              {/* Appointment Info */}
              <View
                style={{
                  backgroundColor: colors.card,
                  borderRadius: 16,
                  padding: 20,
                  marginBottom: 16,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.05,
                  shadowRadius: 8,
                }}
              >
                <Text style={{ color: colors.text, fontSize: 20, fontWeight: '600', marginBottom: 16 }}>
                  {selectedAppointment.title}
                </Text>

                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <Calendar size={18} color={colors.textTertiary} />
                  <Text style={{ color: colors.textSecondary, fontSize: 16, marginLeft: 12 }}>
                    {formatWithLocale(new Date(selectedAppointment.date), 'EEEE, MMMM d, yyyy')}
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <Clock size={18} color={colors.textTertiary} />
                  <Text style={{ color: colors.textSecondary, fontSize: 16, marginLeft: 12 }}>
                    {selectedAppointment.startTime}
                    {selectedAppointment.endTime && ` - ${selectedAppointment.endTime}`}
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <User size={18} color={colors.textTertiary} />
                  <Text style={{ color: colors.textSecondary, fontSize: 16, marginLeft: 12 }}>
                    {getClient(selectedAppointment.clientId)?.name || 'Unknown Client'}
                  </Text>
                </View>

                {selectedAppointment.notes && (
                  <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border }}>
                    <Text style={{ color: colors.textTertiary, fontSize: 12, fontWeight: '500', marginBottom: 4 }}>
                      NOTES
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 16 }}>
                      {selectedAppointment.notes}
                    </Text>
                  </View>
                )}
              </View>

              {/* Delete Button */}
              <Pressable
                onPress={() => handleDeleteAppointment(selectedAppointment)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#FEE2E2',
                  borderRadius: 16,
                  padding: 16,
                }}
              >
                <Trash2 size={18} color="#EF4444" />
                <Text style={{ color: '#EF4444', fontSize: 16, fontWeight: '600', marginLeft: 8 }}>
                  Delete Appointment
                </Text>
              </Pressable>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </View>
  );
}
