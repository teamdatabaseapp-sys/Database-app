import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  X,
  Mail,
  Send,
  FileText,
  Image,
  File,
  AlertTriangle,
  MailX,
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
} from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as DocumentPicker from 'expo-document-picker';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { Language, Client, EmailAttachment } from '@/lib/types';
import { emailService } from '@/lib/email-service';
import { getEmailFooterPreview, getComplianceHelperMessage, formatPhoneForEmailFooter } from '@/lib/country-legal-compliance';
import { SendOptedOutBanner } from './email/SendOptedOutBanner';
import { SendRecipientCard } from './email/SendRecipientCard';
import { SendFooterPreview } from './email/SendFooterPreview';
import { SendAttachmentsSection } from './email/SendAttachmentsSection';

interface SendEmailModalProps {
  visible: boolean;
  onClose: () => void;
  client: Client;
}

interface Attachment {
  name: string;
  size: number;
  type: string;
  uri: string;
}

export function SendEmailModal({ visible, onClose, client }: SendEmailModalProps) {
  const language = useStore((s) => s.language) as Language;
  const user = useStore((s) => s.user);
  const getOptOutStatus = useStore((s) => s.getOptOutStatus);
  const { isDark, colors, primaryColor, buttonColor } = useTheme();

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isSending, setIsSending] = useState(false);

  // Formatting toolbar state
  const [bodySelection, setBodySelection] = useState({ start: 0, end: 0 });
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>('left');
  const [activeFmt, setActiveFmt] = useState<Set<string>>(new Set());

  const applyFormatting = (type: 'bold' | 'italic' | 'bullets') => {
    const { start, end } = bodySelection;
    const hasSelection = end > start;
    const selected = body.substring(start, end);
    let newBody = body;

    if (type === 'bold') {
      newBody = hasSelection
        ? body.substring(0, start) + `**${selected}**` + body.substring(end)
        : body.substring(0, start) + `****` + body.substring(end);
      setActiveFmt((prev) => { const s = new Set(prev); s.has('bold') ? s.delete('bold') : s.add('bold'); return s; });
    } else if (type === 'italic') {
      newBody = hasSelection
        ? body.substring(0, start) + `_${selected}_` + body.substring(end)
        : body.substring(0, start) + `__` + body.substring(end);
      setActiveFmt((prev) => { const s = new Set(prev); s.has('italic') ? s.delete('italic') : s.add('italic'); return s; });
    } else if (type === 'bullets') {
      newBody = hasSelection
        ? body.substring(0, start) + selected.split('\n').map((l) => `• ${l}`).join('\n') + body.substring(end)
        : body.substring(0, start) + '• ' + body.substring(end);
    }
    setBody(newBody);
  };

  // Get the footer preview for country-based legal compliance
  const footerPreview = useMemo(() => {
    const preview = getEmailFooterPreview(
      user?.businessName || 'Your Business',
      user?.businessAddress || '',
      user?.businessCountry,
      user?.businessState,
      user?.emailFooterLanguage || language,
      user?.businessPhoneNumber
    );
    // Format the preview object as a readable string
    // Order: Business Name, Address, Phone Number (below address)
    const phoneNumberLine = preview.businessPhoneNumber ? `\n${formatPhoneForEmailFooter(preview.businessPhoneNumber)}` : '';
    return `${preview.businessName}\n${preview.businessAddress || t('businessAddressNotSet', language)}${phoneNumberLine}\n\n${preview.receivingText}\n${preview.unsubscribeText}\n${preview.linkActiveText}${preview.legalNotice ? `\n\n${preview.legalNotice}` : ''}`;
  }, [user?.businessName, user?.businessAddress, user?.businessPhoneNumber, user?.businessCountry, user?.businessState, user?.emailFooterLanguage, language]);

  // Check if recipient has opted out (SYSTEM-ENFORCED CHECK)
  const isOptedOut = useMemo(() => {
    if (!user?.id || !client.email) return false;
    return getOptOutStatus(client.email, user.id);
  }, [client.email, user?.id, getOptOutStatus]);

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        multiple: true,
      });

      if (!result.canceled && result.assets) {
        const newAttachments: Attachment[] = result.assets.map((asset) => ({
          name: asset.name,
          size: asset.size || 0,
          type: asset.mimeType || 'application/octet-stream',
          uri: asset.uri,
        }));
        setAttachments((prev) => [...prev, ...newAttachments]);
      }
    } catch (error) {
      console.log('Document picker error:', error);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <Image size={16} color="#8B5CF6" />;
    if (type.includes('pdf')) return <FileText size={16} color="#EF4444" />;
    return <File size={16} color="#64748B" />;
  };

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) {
      Alert.alert(
        'Missing Information',
        'Please fill in the subject and message.'
      );
      return;
    }

    if (!user?.id) {
      Alert.alert('Error', 'Please log in to send emails.');
      return;
    }

    // SYSTEM-ENFORCED: Block sending to opted-out recipients
    if (isOptedOut) {
      Alert.alert(
        'Cannot Send Email',
        `${client.name} has opted out of receiving emails from your business. This is a system-enforced restriction that cannot be bypassed.`
      );
      return;
    }

    setIsSending(true);

    try {
      // Use the CAN-SPAM compliant email service
      const result = await emailService.sendEmail({
        recipientEmail: client.email,
        recipientName: client.name,
        subject: subject.trim(),
        body: body.trim(),
        businessId: user.id,
        businessName: user.businessName || 'Your Business',
        businessAddress: user.businessAddress || '',
        businessPhoneNumber: user.businessPhoneNumber,
        businessCountry: user.businessCountry,
        businessState: user.businessState,
        emailFooterLanguage: user.emailFooterLanguage || language,
        attachments: attachments.map((a): EmailAttachment => ({
          name: a.name,
          size: a.size,
          type: a.type,
          uri: a.uri,
        })),
      });

      if (result.success) {
        Alert.alert(
          'Email Sent!',
          `Your email has been sent to ${client.name}.\n\nNote: An unsubscribe link has been automatically added to comply with email regulations.`,
          [{ text: 'OK', onPress: resetAndClose }]
        );
      } else if (result.blockedByOptOut) {
        Alert.alert(
          'Email Blocked',
          'This recipient has opted out of receiving emails. The email was not sent.'
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to send email. Please try again.');
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const resetAndClose = () => {
    setSubject('');
    setBody('');
    setAttachments([]);
    setTextAlign('left');
    setActiveFmt(new Set());
    setBodySelection({ start: 0, end: 0 });
    onClose();
  };

  // Cannot send if opted out OR missing required fields OR currently sending
  const canSend = !isOptedOut && subject.trim() && body.trim() && !isSending;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={resetAndClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
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
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: `${primaryColor}15`,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
              }}>
                <Mail size={22} color={primaryColor} />
              </View>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>{t('sendEmail', language)}</Text>
            </View>
            <Pressable
              onPress={resetAndClose}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={20} color={colors.textSecondary} />
            </Pressable>
          </Animated.View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 20, paddingBottom: 140 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Opt-Out Warning Banner - SYSTEM-ENFORCED */}
            <SendOptedOutBanner
              isOptedOut={isOptedOut}
              isDark={isDark}
              clientName={client.name}
              language={language}
            />

            {/* Recipient */}
            <SendRecipientCard
              isOptedOut={isOptedOut}
              isDark={isDark}
              clientName={client.name}
              clientEmail={client.email}
              primaryColor={primaryColor}
              colors={colors}
              language={language}
            />

            {/* Subject */}
            <Animated.View entering={FadeInDown.delay(100).duration(300)} style={{ marginTop: 20 }}>
              <Text style={{ color: colors.text, fontWeight: '600', marginBottom: 8, fontSize: 14 }}>
                {t('subject', language)} *
              </Text>
              <View style={{
                backgroundColor: colors.inputBackground,
                borderWidth: 1,
                borderColor: colors.inputBorder,
                borderRadius: 12,
                padding: 16,
              }}>
                <TextInput
                  value={subject}
                  onChangeText={setSubject}
                  placeholder={t('enterSubjectPlaceholder', language)}
                  style={{ fontSize: 16, color: colors.inputText }}
                  placeholderTextColor={colors.inputPlaceholder}
                  cursorColor={primaryColor}
                  selectionColor={`${primaryColor}40`}
                />
              </View>
            </Animated.View>

            {/* Message Body */}
            <Animated.View entering={FadeInDown.delay(150).duration(300)} style={{ marginTop: 20 }}>
              <Text style={{ color: colors.text, fontWeight: '600', marginBottom: 8, fontSize: 14 }}>
                {t('message', language)} *
              </Text>
              {/* Formatting Toolbar */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9',
                  borderRadius: 10,
                  padding: 4,
                  marginBottom: 6,
                  flexWrap: 'wrap',
                }}
              >
                {([
                  { icon: <Bold size={15} color={activeFmt.has('bold') ? primaryColor : colors.textSecondary} />, onPress: () => applyFormatting('bold'), active: activeFmt.has('bold') },
                  { icon: <Italic size={15} color={activeFmt.has('italic') ? primaryColor : colors.textSecondary} />, onPress: () => applyFormatting('italic'), active: activeFmt.has('italic') },
                  { icon: <List size={15} color={colors.textSecondary} />, onPress: () => applyFormatting('bullets'), active: false },
                  { icon: <AlignLeft size={15} color={textAlign === 'left' ? primaryColor : colors.textSecondary} />, onPress: () => setTextAlign('left'), active: textAlign === 'left' },
                  { icon: <AlignCenter size={15} color={textAlign === 'center' ? primaryColor : colors.textSecondary} />, onPress: () => setTextAlign('center'), active: textAlign === 'center' },
                  { icon: <AlignRight size={15} color={textAlign === 'right' ? primaryColor : colors.textSecondary} />, onPress: () => setTextAlign('right'), active: textAlign === 'right' },
                ] as Array<{ icon: React.ReactNode; onPress: () => void; active: boolean }>).map((btn, idx) => (
                  <Pressable
                    key={idx}
                    onPress={btn.onPress}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 7,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginHorizontal: 1,
                      backgroundColor: btn.active ? `${primaryColor}20` : 'transparent',
                    }}
                  >
                    {btn.icon}
                  </Pressable>
                ))}
              </View>
              <View style={{
                backgroundColor: colors.inputBackground,
                borderWidth: 1,
                borderColor: colors.inputBorder,
                borderRadius: 12,
                padding: 16,
              }}>
                <TextInput
                  value={body}
                  onChangeText={setBody}
                  onSelectionChange={(e) => setBodySelection(e.nativeEvent.selection)}
                  placeholder={t('writeMessagePlaceholder', language)}
                  multiline
                  numberOfLines={6}
                  style={{ fontSize: 16, color: colors.inputText, textAlignVertical: 'top', minHeight: 150, textAlign }}
                  placeholderTextColor={colors.inputPlaceholder}
                  cursorColor={primaryColor}
                  selectionColor={`${primaryColor}40`}
                />
              </View>
            </Animated.View>

            {/* Attachments */}
            <SendAttachmentsSection
              attachments={attachments}
              isDark={isDark}
              colors={colors}
              language={language}
              onPickDocument={pickDocument}
              onRemoveAttachment={removeAttachment}
              formatFileSize={formatFileSize}
              getFileIcon={getFileIcon}
            />

            {/* Legal Footer Preview */}
            <SendFooterPreview
              footerPreview={footerPreview}
              isDark={isDark}
              colors={colors}
              language={language}
            />
          </ScrollView>

          {/* Send Button */}
          <View style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: 20,
            backgroundColor: colors.card,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}>
            {/* Compliance notice */}
            {!isOptedOut && (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, paddingHorizontal: 8 }}>
                <AlertTriangle size={12} color={colors.textTertiary} />
                <Text style={{ color: colors.textTertiary, fontSize: 12, marginLeft: 6, flex: 1 }}>
                  {getComplianceHelperMessage(user?.businessCountry, language, user?.businessState)}
                </Text>
              </View>
            )}
            <Pressable
              onPress={handleSend}
              disabled={!canSend}
              style={{
                paddingVertical: 16,
                borderRadius: 12,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isOptedOut
                  ? (isDark ? '#7F1D1D' : '#FEE2E2')
                  : canSend
                  ? buttonColor
                  : (isDark ? colors.backgroundTertiary : '#E2E8F0'),
              }}
            >
              {isOptedOut ? (
                <>
                  <MailX size={18} color="#EF4444" />
                  <Text style={{ fontWeight: '600', fontSize: 16, marginLeft: 8, color: '#EF4444' }}>
                    {t('cannotSendEmail', language)}
                  </Text>
                </>
              ) : isSending ? (
                <Text style={{ fontWeight: '600', fontSize: 16, color: '#fff' }}>{t('sending', language)}...</Text>
              ) : (
                <>
                  <Send size={18} color={canSend ? '#fff' : colors.textTertiary} />
                  <Text
                    style={{
                      fontWeight: '600',
                      fontSize: 16,
                      marginLeft: 8,
                      color: canSend ? '#fff' : colors.textTertiary,
                    }}
                  >
                    {t('send', language)}
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
