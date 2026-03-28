import React, { useState, useEffect } from 'react';
import { useTabPersistence } from '@/hooks/useTabPersistence';
import { View, Text, Pressable, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LayoutGrid, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/lib/ThemeContext';
import { useStore } from '@/lib/store';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/types';
import { TeamServicesScreen } from './TeamServicesScreen';
import { StaffCalendarScreen } from './StaffCalendarScreen';
import { SetupHint } from '@/components/SetupHint';
import { HighlightWrapper } from '@/components/HighlightWrapper';

type TabKey = 'storesStaff' | 'calendar';

interface StoresStaffCalendarHubProps {
  visible: boolean;
  onClose: () => void;
  setupHint?: string;
}

export function StoresStaffCalendarHub({ visible, onClose, setupHint }: StoresStaffCalendarHubProps) {
  const [activeTab, setActiveTab] = useTabPersistence<TabKey>('stores_staff_calendar', 'storesStaff');
  const { colors, isDark, primaryColor } = useTheme();
  const language = useStore((s) => s.language) as Language;

  const [highlightActive, setHighlightActive] = useState(false);

  useEffect(() => {
    if (!setupHint || !visible) return;
    let mounted = true;
    let fadeTimer: ReturnType<typeof setTimeout> | null = null;
    console.log('[SetupHint] StoresStaffCalendarHub hint:', setupHint);
    // Force correct tab based on hint — before highlight fires
    if (setupHint === 'hours' || setupHint === 'additionalLocations' || setupHint === 'primaryStore') {
      setActiveTab('storesStaff');
    } else if (setupHint === 'staff') {
      setActiveTab('storesStaff');
    } else if (setupHint === 'staffCalendar') {
      setActiveTab('calendar');
    }
    const timer = setTimeout(() => {
      if (!mounted) return;
      setHighlightActive(true);
      fadeTimer = setTimeout(() => {
        if (mounted) setHighlightActive(false);
      }, 2500);
    }, 450);
    return () => {
      mounted = false;
      clearTimeout(timer);
      if (fadeTimer !== null) clearTimeout(fadeTimer);
    };
  }, [setupHint, visible]);

  const handleTabPress = (tab: TabKey) => {
    Haptics.selectionAsync();
    setActiveTab(tab);
  };

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'storesStaff', label: t('storesAndStaff', language) },
    { key: 'calendar', label: t('staffCalendar', language) },
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>

        {/* ── 1. HEADER ── */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            paddingHorizontal: 16,
            paddingVertical: 14,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            backgroundColor: colors.card,
          }}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: `${primaryColor}15`,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 12,
              marginTop: 1,
            }}
          >
            <LayoutGrid size={20} color={primaryColor} />
          </View>
          <Text
            style={{
              flex: 1,
              fontSize: 17,
              fontWeight: '600',
              color: colors.text,
              flexWrap: 'wrap',
              lineHeight: 22,
            }}
          >
            {t('storesStaffCalendar', language)}
          </Text>
          <Pressable
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={24} color={colors.textSecondary} />
          </Pressable>
        </View>

        {/* ── 2. PAGE SWITCH — directly under header ── */}
        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 8,
            backgroundColor: colors.background,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
              borderRadius: 12,
              padding: 4,
            }}
          >
            {tabs.map((tab) => (
              <Pressable
                key={tab.key}
                onPress={() => handleTabPress(tab.key)}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 10,
                  alignItems: 'center',
                  backgroundColor: activeTab === tab.key ? colors.card : 'transparent',
                  shadowColor: activeTab === tab.key ? '#000' : 'transparent',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: activeTab === tab.key ? 0.08 : 0,
                  shadowRadius: 2,
                  elevation: activeTab === tab.key ? 2 : 0,
                }}
              >
                <Text
                  style={{
                    fontWeight: activeTab === tab.key ? '600' : '500',
                    fontSize: 14,
                    color: activeTab === tab.key ? colors.text : colors.textSecondary,
                  }}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                >
                  {tab.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* ── 3. CONTENT AREA ── */}
        <View style={{ flex: 1 }}>
          <SetupHint hintKey={setupHint} />
          {/* Stores & Staff — only mounted when active */}
          {activeTab === 'storesStaff' && (
            <TeamServicesScreen
              visible={visible}
              onClose={onClose}
              embedded
              layout="unified"
              setupHint={setupHint}
              highlightActive={highlightActive}
            />
          )}

          {/*
            Staff Calendar — pre-mounted as soon as the hub opens (visible=true)
            but hidden via pointerEvents+opacity when not active. This lets
            React Query start fetching data immediately, so by the time the user
            taps the "Staff Calendar" tab the data is already cached and renders
            instantly with zero spinner.
          */}
          {visible && (
            <View
              style={{
                flex: 1,
                display: activeTab === 'calendar' ? 'flex' : 'none',
              }}
              pointerEvents={activeTab === 'calendar' ? 'auto' : 'none'}
            >
              <StaffCalendarScreen
                visible={visible}
                onClose={onClose}
                language={language}
                embedded
              />
            </View>
          )}
        </View>

      </SafeAreaView>
    </Modal>
  );
}
