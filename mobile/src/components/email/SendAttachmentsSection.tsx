import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Paperclip, X } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/types';

interface AttachmentItem {
  name: string;
  size: number;
  type: string;
  uri: string;
}

interface SendAttachmentsSectionProps {
  attachments: AttachmentItem[];
  isDark: boolean;
  colors: {
    text: string;
    textSecondary: string;
    textTertiary: string;
    backgroundTertiary: string;
    card: string;
    border: string;
  };
  language: Language;
  onPickDocument: () => void;
  onRemoveAttachment: (index: number) => void;
  formatFileSize: (bytes: number) => string;
  getFileIcon: (type: string) => React.ReactNode;
}

export function SendAttachmentsSection({
  attachments,
  isDark,
  colors,
  language,
  onPickDocument,
  onRemoveAttachment,
  formatFileSize,
  getFileIcon,
}: SendAttachmentsSectionProps) {
  return (
    <Animated.View entering={FadeInDown.delay(200).duration(300)} style={{ marginTop: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>{t('attachments', language)}</Text>
        <Pressable
          onPress={onPickDocument}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 8,
          }}
        >
          <Paperclip size={14} color={colors.textSecondary} />
          <Text style={{ color: colors.textSecondary, fontWeight: '500', fontSize: 14, marginLeft: 6 }}>{t('addFile', language)}</Text>
        </Pressable>
      </View>

      {attachments.length > 0 ? (
        <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, overflow: 'hidden' }}>
          {attachments.map((attachment, index) => (
            <View
              key={index}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 12,
                borderBottomWidth: index < attachments.length - 1 ? 1 : 0,
                borderBottomColor: colors.border,
              }}
            >
              <View style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {getFileIcon(attachment.type)}
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ color: colors.text, fontSize: 14 }} numberOfLines={1}>
                  {attachment.name}
                </Text>
                <Text style={{ color: colors.textTertiary, fontSize: 12 }}>
                  {formatFileSize(attachment.size)}
                </Text>
              </View>
              <Pressable
                onPress={() => onRemoveAttachment(index)}
                style={{ padding: 8 }}
              >
                <X size={16} color="#EF4444" />
              </Pressable>
            </View>
          ))}
        </View>
      ) : (
        <View style={{
          backgroundColor: isDark ? colors.backgroundTertiary : '#F8FAFC',
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: isDark ? colors.border : '#CBD5E1',
          borderRadius: 12,
          padding: 24,
          alignItems: 'center',
        }}>
          <Paperclip size={24} color={colors.textTertiary} />
          <Text style={{ color: colors.textTertiary, fontSize: 14, marginTop: 8 }}>{t('noAttachments', language)}</Text>
          <Text style={{ color: colors.textTertiary, fontSize: 12 }}>{t('tapAddFileHint', language)}</Text>
        </View>
      )}
    </Animated.View>
  );
}
