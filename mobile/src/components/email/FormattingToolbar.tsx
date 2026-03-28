import React from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import {
  Bold,
  Italic,
  Link2,
  List,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from 'lucide-react-native';
import { Language } from '@/lib/types';

interface FormattingToolbarProps {
  activeFmt: Set<string>;
  textAlign: 'left' | 'center' | 'right';
  showLinkModal: boolean;
  linkUrl: string;
  linkDisplayText: string;
  isDark: boolean;
  primaryColor: string;
  colors: {
    textSecondary: string;
    backgroundTertiary: string;
    card: string;
    text: string;
    textTertiary: string;
    border: string;
  };
  language: Language;
  onFormat: (type: 'bold' | 'italic' | 'bullets' | 'spacing') => void;
  onAlign: (align: 'left' | 'center' | 'right') => void;
  onOpenLinkModal: () => void;
  onLinkUrlChange: (url: string) => void;
  onLinkDisplayTextChange: (text: string) => void;
  onInsertLink: () => void;
  onCancelLink: () => void;
}

export function FormattingToolbar({
  activeFmt,
  textAlign,
  showLinkModal,
  linkUrl,
  linkDisplayText,
  isDark,
  primaryColor,
  colors,
  onFormat,
  onAlign,
  onOpenLinkModal,
  onLinkUrlChange,
  onLinkDisplayTextChange,
  onInsertLink,
  onCancelLink,
}: FormattingToolbarProps) {
  return (
    <>
      {/* Formatting Toolbar */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
          borderRadius: 10,
          padding: 4,
          marginBottom: 8,
          flexWrap: 'wrap',
        }}
      >
        {[
          { icon: <Bold size={16} color={activeFmt.has('bold') ? primaryColor : colors.textSecondary} />, onPress: () => onFormat('bold'), active: activeFmt.has('bold') },
          { icon: <Italic size={16} color={activeFmt.has('italic') ? primaryColor : colors.textSecondary} />, onPress: () => onFormat('italic'), active: activeFmt.has('italic') },
          {
            icon: <Link2 size={16} color={showLinkModal ? primaryColor : colors.textSecondary} />,
            onPress: onOpenLinkModal,
            active: showLinkModal,
          },
          { icon: <List size={16} color={activeFmt.has('bullets') ? primaryColor : colors.textSecondary} />, onPress: () => onFormat('bullets'), active: activeFmt.has('bullets') },
          { icon: <AlignLeft size={16} color={textAlign === 'left' ? primaryColor : colors.textSecondary} />, onPress: () => onAlign('left'), active: textAlign === 'left' },
          { icon: <AlignCenter size={16} color={textAlign === 'center' ? primaryColor : colors.textSecondary} />, onPress: () => onAlign('center'), active: textAlign === 'center' },
          { icon: <AlignRight size={16} color={textAlign === 'right' ? primaryColor : colors.textSecondary} />, onPress: () => onAlign('right'), active: textAlign === 'right' },
        ].map((btn, idx) => (
          <Pressable
            key={idx}
            onPress={btn.onPress}
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              alignItems: 'center',
              justifyContent: 'center',
              marginHorizontal: 2,
              backgroundColor: btn.active ? `${primaryColor}20` : 'transparent',
            }}
          >
            {btn.icon}
          </Pressable>
        ))}
      </View>

      {/* Link Modal — shown as overlay */}
      {showLinkModal && (
        <View
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
            padding: 24,
          }}
        >
          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: 16,
              padding: 20,
              width: '100%',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.2,
              shadowRadius: 16,
              elevation: 10,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <Link2 size={18} color={primaryColor} style={{ marginRight: 10 }} />
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Insert Link</Text>
            </View>

            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>URL *</Text>
            <TextInput
              value={linkUrl}
              onChangeText={onLinkUrlChange}
              placeholder="https://example.com"
              placeholderTextColor={colors.textTertiary}
              style={{
                backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                borderRadius: 10,
                padding: 12,
                fontSize: 14,
                color: colors.text,
                marginBottom: 12,
              }}
              autoCapitalize="none"
              keyboardType="url"
              autoFocus
            />

            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>Display Text (optional)</Text>
            <TextInput
              value={linkDisplayText}
              onChangeText={onLinkDisplayTextChange}
              placeholder="Click here"
              placeholderTextColor={colors.textTertiary}
              style={{
                backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                borderRadius: 10,
                padding: 12,
                fontSize: 14,
                color: colors.text,
                marginBottom: 20,
              }}
              returnKeyType="done"
              onSubmitEditing={onInsertLink}
            />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                onPress={onCancelLink}
                style={{ flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}
              >
                <Text style={{ color: colors.textSecondary, fontWeight: '600', fontSize: 14 }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={onInsertLink}
                style={{ flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: primaryColor, alignItems: 'center' }}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Insert</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </>
  );
}
