import React from 'react';
import { View, Text } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Sparkles } from 'lucide-react-native';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/types';
import { DataBaseLogo } from '@/components/DataBaseLogo';

// EXACT same gradient as AuthScreen (Login):
//   [primaryColor (#0D9488), '#0F766E', '#115E59']
//   start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
const HERO_GRADIENT: [string, string, string] = ['#0D9488', '#0F766E', '#115E59'];

interface TrialHeaderProps {
  language: Language;
}

export function TrialHeader({ language }: TrialHeaderProps) {
  return (
    // NO horizontal padding on the gradient — same as Login.
    // Login: gradient covers full width, inner Animated.View has px-6.
    // This lets the DataBaseLogo size="large" render at full viewport width
    // so it scales correctly via contentFit="contain" without clipping.
    <LinearGradient
      colors={HERO_GRADIENT}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ paddingTop: 56, paddingBottom: 44 }}
    >
      {/* Logo — full viewport width, no side padding, same as Login px-6 header block */}
      <Animated.View
        entering={FadeInDown.delay(0).springify().damping(14)}
        style={{ marginBottom: 24, width: '100%', alignItems: 'center', paddingHorizontal: 24 }}
      >
        <DataBaseLogo size="large" />
      </Animated.View>

      {/* Badge + text block — centered, same px-6 inner padding as Login header */}
      <View style={{ alignItems: 'center', paddingHorizontal: 24 }}>
        {/* Trial badge */}
        <Animated.View
          entering={FadeInDown.delay(60).springify().damping(14)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: 'rgba(255,255,255,0.20)',
            borderRadius: 20,
            paddingHorizontal: 14,
            paddingVertical: 7,
            marginBottom: 18,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.35)',
          }}
        >
          <Sparkles size={13} color="#FFFFFF" />
          <Text style={{
            color: '#FFFFFF',
            fontSize: 12,
            fontWeight: '700',
            letterSpacing: 0.5,
            marginLeft: 6,
            textTransform: 'uppercase',
          }}>
            {t('freeTrial3Days', language)}
          </Text>
        </Animated.View>

        {/* Title — same weight/size as Login "Welcome" heading */}
        <Animated.Text
          entering={FadeInDown.delay(120).springify().damping(14)}
          style={{
            color: '#FFFFFF',
            fontSize: 26,
            fontWeight: '700',
            textAlign: 'center',
            letterSpacing: -0.3,
            lineHeight: 32,
          }}
        >
          {t('trialStartsToday', language)}
        </Animated.Text>

        {/* Subtitle — same rgba(255,255,255,0.80) treatment as Login subtitle */}
        <Animated.Text
          entering={FadeInDown.delay(180).springify().damping(14)}
          style={{
            color: 'rgba(255,255,255,0.80)',
            fontSize: 15,
            textAlign: 'center',
            marginTop: 10,
            lineHeight: 22,
            maxWidth: 300,
          }}
        >
          {t('trialIntroSubtitle', language)}
        </Animated.Text>
      </View>
    </LinearGradient>
  );
}
