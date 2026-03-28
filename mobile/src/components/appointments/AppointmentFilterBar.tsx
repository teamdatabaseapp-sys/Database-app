import React from 'react';
import { View, Text, Pressable } from 'react-native';
import {
  Building2,
  Users,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/lib/ThemeContext';
import { t, getLocalizedStoreName } from '@/lib/i18n';
import { Language } from '@/lib/types';
import { useStore } from '@/lib/store';
import {
  isSameDay,
  subDays,
  addDays,
  addWeeks,
  startOfWeek,
  startOfMonth,
  endOfMonth,
} from 'date-fns';
import type { LocalStore, LocalStaff } from './appointmentsTypes';

export type FilterBarDateRangeMode = 'day' | 'week' | 'month';

export interface AppointmentFilterBarProps {
  // Data
  stores: LocalStore[];
  staffMembers: LocalStaff[];
  // Filter state
  selectedStoreFilter: string | null;
  selectedStaffFilter: string | null;
  dateRangeMode: FilterBarDateRangeMode;
  selectedDate: Date;
  // Dropdown visibility (owned by parent)
  showStoreFilterDropdown: boolean;
  showStaffFilterDropdown: boolean;
  // Filter setters
  onSelectStore: (storeId: string | null) => void;
  onSelectStaff: (staffId: string | null) => void;
  onToggleStoreDropdown: () => void;
  onToggleStaffDropdown: () => void;
  onOpenDateFilterModal: () => void;
  onOpenCalendarPicker: () => void;
  // Date navigation
  onPreviousRange: () => void;
  onNextRange: () => void;
  // Date label (thin wrapper from parent)
  dateLabel: string;
  // Locale formatting
  formatWithLocale: (date: Date, formatStr: string) => string;
  // Layout measurement callbacks
  onContainerLayout: (height: number) => void;
  onFilterRowLayout: (height: number) => void;
}

export function AppointmentFilterBar({
  stores,
  staffMembers,
  selectedStoreFilter,
  selectedStaffFilter,
  dateRangeMode,
  selectedDate,
  showStoreFilterDropdown,
  showStaffFilterDropdown,
  onSelectStore,
  onSelectStaff,
  onToggleStoreDropdown,
  onToggleStaffDropdown,
  onOpenDateFilterModal,
  onOpenCalendarPicker,
  onPreviousRange,
  onNextRange,
  dateLabel,
  formatWithLocale,
  onContainerLayout,
  onFilterRowLayout,
}: AppointmentFilterBarProps) {
  const { colors, isDark, primaryColor } = useTheme();
  const language = useStore((s) => s.language) as Language;

  return (
    <View
      style={{ paddingHorizontal: 16, paddingBottom: 8, paddingTop: 4 }}
      onLayout={(e) => { onContainerLayout(Math.round(e.nativeEvent.layout.height)); }}
    >
      {/* Row 1: Filter chips — Store, Staff, Date */}
      <View
        style={{ flexDirection: 'row', gap: 8, marginBottom: 8, height: 36, alignItems: 'center', flexWrap: 'nowrap', overflow: 'visible' }}
        onLayout={(e) => { onFilterRowLayout(Math.round(e.nativeEvent.layout.height)); }}
      >
        {/* Store chip — only if user has multiple stores */}
        {stores.length > 1 && (
          <Pressable
            onPress={onToggleStoreDropdown}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              paddingHorizontal: 11,
              paddingVertical: 5,
              borderRadius: 20,
              flexShrink: 1,
              minWidth: 0,
              backgroundColor: selectedStoreFilter
                ? `${primaryColor}18`
                : isDark ? colors.card : '#F1F5F9',
              borderWidth: selectedStoreFilter ? 1 : 0,
              borderColor: selectedStoreFilter ? `${primaryColor}40` : 'transparent',
            }}
          >
            <Building2 size={13} color={selectedStoreFilter ? primaryColor : colors.textSecondary} />
            <Text style={{ color: selectedStoreFilter ? primaryColor : colors.textSecondary, fontSize: 13, fontWeight: selectedStoreFilter ? '600' : '500', flexShrink: 1, minWidth: 0 }} numberOfLines={1}>
              {selectedStoreFilter
                ? getLocalizedStoreName(stores.find(s => s.id === selectedStoreFilter)?.name, language)
                : t('allStores', language)}
            </Text>
            <ChevronDown size={11} color={selectedStoreFilter ? primaryColor : colors.textTertiary} />
          </Pressable>
        )}

        {/* Staff chip */}
        <Pressable
          onPress={onToggleStaffDropdown}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            paddingHorizontal: 11,
            paddingVertical: 5,
            borderRadius: 20,
            flexShrink: 1,
            minWidth: 0,
            backgroundColor: selectedStaffFilter
              ? `${staffMembers.find(s => s.id === selectedStaffFilter)?.color || primaryColor}18`
              : isDark ? colors.card : '#F1F5F9',
            borderWidth: selectedStaffFilter ? 1 : 0,
            borderColor: selectedStaffFilter
              ? `${staffMembers.find(s => s.id === selectedStaffFilter)?.color || primaryColor}40`
              : 'transparent',
          }}
        >
          <Users size={13} color={selectedStaffFilter ? (staffMembers.find(s => s.id === selectedStaffFilter)?.color || primaryColor) : colors.textSecondary} />
          <Text style={{ color: selectedStaffFilter ? (staffMembers.find(s => s.id === selectedStaffFilter)?.color || primaryColor) : colors.textSecondary, fontSize: 13, fontWeight: selectedStaffFilter ? '600' : '500', flexShrink: 1, minWidth: 0 }} numberOfLines={1}>
            {selectedStaffFilter
              ? staffMembers.find(s => s.id === selectedStaffFilter)?.name || t('staff', language)
              : t('allStaff', language)}
          </Text>
          <ChevronDown size={11} color={selectedStaffFilter ? (staffMembers.find(s => s.id === selectedStaffFilter)?.color || primaryColor) : colors.textTertiary} />
        </Pressable>

        {/* Date range chip */}
        <Pressable
          onPress={onOpenDateFilterModal}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            paddingHorizontal: 11,
            paddingVertical: 5,
            borderRadius: 20,
            flexShrink: 1,
            minWidth: 0,
            backgroundColor: isDark ? colors.card : '#F1F5F9',
          }}
        >
          <Calendar size={13} color={colors.textSecondary} />
          <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '500', flexShrink: 1, minWidth: 0 }} numberOfLines={1}>
            {(() => {
              const now = new Date();
              if (dateRangeMode === 'day') {
                if (isSameDay(selectedDate, now)) return t('today', language);
                if (isSameDay(selectedDate, subDays(now, 1))) return t('yesterday', language);
                if (isSameDay(selectedDate, addDays(now, 1))) return t('tomorrow', language);
                return formatWithLocale(selectedDate, 'MMM d');
              }
              if (dateRangeMode === 'week') {
                if (isSameDay(startOfWeek(selectedDate), startOfWeek(now))) return t('thisWeek', language);
                if (isSameDay(startOfWeek(selectedDate), startOfWeek(addWeeks(now, 1)))) return t('nextWeek', language);
                return formatWithLocale(selectedDate, 'MMM d');
              }
              if (dateRangeMode === 'month') return t('thisMonth', language);
              return dateLabel;
            })()}
          </Text>
          <ChevronDown size={11} color={colors.textTertiary} />
        </Pressable>
      </View>

      {/* Store dropdown flyout */}
      {showStoreFilterDropdown && stores.length > 0 && (
        <View style={{ backgroundColor: colors.card, borderRadius: 14, padding: 6, marginBottom: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 8 }}>
          <Pressable
            onPress={() => { onSelectStore(null); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
            style={{ paddingVertical: 11, paddingHorizontal: 14, borderRadius: 10, backgroundColor: !selectedStoreFilter ? `${primaryColor}12` : 'transparent', flexDirection: 'row', alignItems: 'center' }}
          >
            <Building2 size={16} color={!selectedStoreFilter ? primaryColor : colors.textSecondary} />
            <Text style={{ color: !selectedStoreFilter ? primaryColor : colors.text, fontWeight: !selectedStoreFilter ? '600' : '400', fontSize: 14, marginLeft: 10, flex: 1 }}>{t('allStores', language)}</Text>
            {!selectedStoreFilter && <Check size={15} color={primaryColor} style={{ marginLeft: 'auto' }} />}
          </Pressable>
          {stores.map((store) => (
            <Pressable
              key={store.id}
              onPress={() => { onSelectStore(store.id); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              style={{ paddingVertical: 11, paddingHorizontal: 14, borderRadius: 10, backgroundColor: selectedStoreFilter === store.id ? `${primaryColor}12` : 'transparent', flexDirection: 'row', alignItems: 'center' }}
            >
              <Building2 size={16} color={selectedStoreFilter === store.id ? primaryColor : colors.textSecondary} />
              <Text style={{ color: selectedStoreFilter === store.id ? primaryColor : colors.text, fontWeight: selectedStoreFilter === store.id ? '600' : '400', fontSize: 14, marginLeft: 10, flex: 1 }}>{getLocalizedStoreName(store.name, language)}</Text>
              {selectedStoreFilter === store.id && <Check size={15} color={primaryColor} style={{ marginLeft: 'auto' }} />}
            </Pressable>
          ))}
        </View>
      )}

      {/* Staff dropdown flyout */}
      {showStaffFilterDropdown && (
        <View style={{ backgroundColor: colors.card, borderRadius: 14, padding: 6, marginBottom: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 8 }}>
          <Pressable
            onPress={() => { onSelectStaff(null); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
            style={{ paddingVertical: 11, paddingHorizontal: 14, borderRadius: 10, backgroundColor: !selectedStaffFilter ? `${primaryColor}12` : 'transparent', flexDirection: 'row', alignItems: 'center' }}
          >
            <Users size={16} color={!selectedStaffFilter ? primaryColor : colors.textSecondary} />
            <Text style={{ color: !selectedStaffFilter ? primaryColor : colors.text, fontWeight: !selectedStaffFilter ? '600' : '400', fontSize: 14, marginLeft: 10, flex: 1 }}>{t('allStaff', language)}</Text>
            {!selectedStaffFilter && <Check size={15} color={primaryColor} style={{ marginLeft: 'auto' }} />}
          </Pressable>
          {staffMembers.map((staff) => (
            <Pressable
              key={staff.id}
              onPress={() => { onSelectStaff(staff.id); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              style={{ paddingVertical: 11, paddingHorizontal: 14, borderRadius: 10, backgroundColor: selectedStaffFilter === staff.id ? `${primaryColor}12` : 'transparent', flexDirection: 'row', alignItems: 'center' }}
            >
              <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: `${primaryColor}20`, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: primaryColor, fontWeight: '700', fontSize: 11 }}>{staff.name.charAt(0).toUpperCase()}</Text>
              </View>
              <Text style={{ color: selectedStaffFilter === staff.id ? primaryColor : colors.text, fontWeight: selectedStaffFilter === staff.id ? '600' : '400', fontSize: 14, marginLeft: 10, flex: 1 }}>{staff.name}</Text>
              {selectedStaffFilter === staff.id && <Check size={15} color={primaryColor} style={{ marginLeft: 'auto' }} />}
            </Pressable>
          ))}
        </View>
      )}

      {/* Date nav — chevrons + label */}
      <View
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}
      >
        <Pressable
          onPress={onPreviousRange}
          style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: isDark ? colors.card : '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}
        >
          <ChevronLeft size={18} color={colors.textSecondary} />
        </Pressable>

        <Pressable onPress={onOpenCalendarPicker} style={{ flex: 1, alignItems: 'center', paddingHorizontal: 8 }}>
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}>{dateLabel}</Text>
          <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 1 }}>
            {dateRangeMode === 'month'
              ? `${formatWithLocale(startOfMonth(selectedDate), 'MMM d')} – ${formatWithLocale(endOfMonth(selectedDate), 'MMM d, yyyy')}`
              : formatWithLocale(selectedDate, 'MMMM d, yyyy')}
          </Text>
        </Pressable>

        <Pressable
          onPress={onNextRange}
          style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: isDark ? colors.card : '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}
        >
          <ChevronRight size={18} color={colors.textSecondary} />
        </Pressable>
      </View>
    </View>
  );
}
