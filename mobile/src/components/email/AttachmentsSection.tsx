import React from 'react';
import { View, Text, Pressable, ScrollView, Image as RNImage } from 'react-native';
import Animated, { SlideInUp } from 'react-native-reanimated';
import { Paperclip, ImageIcon, FileText, File, X } from 'lucide-react-native';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/types';

interface Attachment {
  name: string;
  size: number;
  type: string;
  uri: string;
}

interface EmailImage {
  uri: string;
  name: string;
  size: number;
  optimized: boolean;
  error?: string;
}

interface AttachmentsSectionProps {
  emailImages: EmailImage[];
  attachments: Attachment[];
  imageError: string | null;
  maxImages: number;
  maxFileSizeMb: number;
  isDark: boolean;
  primaryColor: string;
  colors: {
    textSecondary: string;
    textTertiary: string;
    backgroundTertiary: string;
    card: string;
    text: string;
    border: string;
    error?: string;
  };
  language: Language;
  onPickImage: () => void;
  onPickDocument: () => void;
  onRemoveImage: (index: number) => void;
  onRemoveAttachment: (index: number) => void;
  formatFileSize: (bytes: number) => string;
  getFileIcon: (type: string) => React.ReactNode;
}

export function AttachmentsSection({
  emailImages,
  attachments,
  imageError,
  maxImages,
  maxFileSizeMb,
  isDark,
  primaryColor,
  colors,
  language,
  onPickImage,
  onPickDocument,
  onRemoveImage,
  onRemoveAttachment,
  formatFileSize,
  getFileIcon,
}: AttachmentsSectionProps) {
  return (
    <Animated.View entering={SlideInUp.delay(200).duration(300)} style={{ marginTop: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text style={{ color: colors.textSecondary, fontWeight: '600', fontSize: 14 }}>
          {t('attachments', language)}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {/* Add Image Button */}
          <Pressable
            onPress={emailImages.length >= maxImages ? undefined : onPickImage}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: emailImages.length >= maxImages
                ? (isDark ? colors.backgroundTertiary : '#F1F5F9')
                : (isDark ? colors.backgroundTertiary : '#F0FDFA'),
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 8,
              marginRight: 8,
              borderWidth: 1,
              borderColor: emailImages.length >= maxImages
                ? colors.border
                : (isDark ? `${primaryColor}40` : `${primaryColor}30`),
              opacity: emailImages.length >= maxImages ? 0.5 : 1,
            }}
          >
            <ImageIcon size={14} color={emailImages.length >= maxImages ? colors.textTertiary : primaryColor} />
            <Text style={{ color: emailImages.length >= maxImages ? colors.textTertiary : primaryColor, fontWeight: '500', fontSize: 13, marginLeft: 5 }}>
              {t('addImageOptimized', language)}
            </Text>
          </Pressable>
          {/* Add File Button */}
          <Pressable
            onPress={onPickDocument}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 8,
            }}
          >
            <Paperclip size={14} color={colors.textSecondary} />
            <Text style={{ color: colors.textSecondary, fontWeight: '500', fontSize: 13, marginLeft: 5 }}>
              {t('addFile', language)}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Upload guidance — always visible near the controls */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: isDark ? `${primaryColor}12` : `${primaryColor}0C`,
          borderRadius: 8,
          paddingHorizontal: 10,
          paddingVertical: 6,
          marginBottom: 12,
        }}
      >
        <Paperclip size={11} color={colors.textTertiary} style={{ marginRight: 6, flexShrink: 0 }} />
        <Text style={{ color: colors.textTertiary, fontSize: 12, flex: 1 }}>
          {t('attachmentHelperText', language).replace('{size}', `${maxFileSizeMb}MB`)}
        </Text>
      </View>

      {/* Image Thumbnails */}
      {emailImages.length > 0 && (
        <View style={{ marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <ImageIcon size={14} color={colors.textSecondary} style={{ marginRight: 6 }} />
            <Text style={{ color: emailImages.length >= maxImages ? '#F59E0B' : colors.textTertiary, fontSize: 13, fontWeight: emailImages.length >= maxImages ? '600' : '400' }}>
              {t('imagesCounter', language).replace('{count}', emailImages.length.toString())}
            </Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
            {emailImages.map((img, idx) => (
              <View key={idx} style={{ width: 64, height: 64, marginRight: 10, position: 'relative' }}>
                <RNImage
                  source={{ uri: img.uri }}
                  style={{ width: 64, height: 64, borderRadius: 10, backgroundColor: colors.border }}
                  resizeMode="cover"
                />
                {/* Optimized Badge */}
                {img.optimized && (
                  <View
                    style={{
                      position: 'absolute',
                      bottom: 3,
                      left: 3,
                      backgroundColor: '#10B981',
                      paddingHorizontal: 4,
                      paddingVertical: 1,
                      borderRadius: 4,
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>
                      OPT
                    </Text>
                  </View>
                )}
                {/* Remove Button */}
                <Pressable
                  onPress={() => onRemoveImage(idx)}
                  style={{
                    position: 'absolute',
                    top: -4,
                    right: -4,
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    backgroundColor: '#EF4444',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <X size={11} color="#fff" />
                </Pressable>
              </View>
            ))}
          </ScrollView>
          {imageError && (
            <Text style={{ color: colors.error ?? '#EF4444', fontSize: 12, marginTop: 6 }}>
              {imageError}
            </Text>
          )}
        </View>
      )}

      {/* imageError when no images yet */}
      {imageError && emailImages.length === 0 && (
        <Text style={{ color: colors.error ?? '#EF4444', fontSize: 12, marginBottom: 8 }}>
          {imageError}
        </Text>
      )}

      {/* Hard limit helper text */}
      {emailImages.length >= maxImages && (
        <Text style={{ color: '#F59E0B', fontSize: 12, marginBottom: 8, fontWeight: '500' }}>
          {t('imageTooManyError', language)}
        </Text>
      )}

      {/* Document Attachments */}
      {attachments.length > 0 ? (
        <View
          style={{
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
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
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
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
              <Pressable onPress={() => onRemoveAttachment(index)} style={{ padding: 8 }}>
                <X size={16} color="#EF4444" />
              </Pressable>
            </View>
          ))}
        </View>
      ) : emailImages.length === 0 ? (
        <View
          style={{
            backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: colors.border,
            borderRadius: 12,
            padding: 24,
            alignItems: 'center',
          }}
        >
          <Paperclip size={24} color={colors.textTertiary} />
          <Text style={{ color: colors.textTertiary, fontSize: 14, marginTop: 8 }}>
            {t('noAttachments', language)}
          </Text>
          <Text style={{ color: colors.textTertiary, fontSize: 12 }}>
            {t('tapAddFileHint', language)}
          </Text>
        </View>
      ) : null}

    </Animated.View>
  );
}
