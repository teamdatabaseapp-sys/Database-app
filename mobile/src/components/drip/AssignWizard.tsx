import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  X,
  Mail,
  Check,
  Sparkles,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { Language, DripCampaign } from '@/lib/types';
import { persistClientDripAssignment } from '@/services/dripCampaignsService';
import { enrollmentKeys } from '@/hooks/useDripCampaigns';
import { useBusiness } from '@/hooks/useBusiness';
import { useClients } from '@/hooks/useClients';
import { useQueryClient } from '@tanstack/react-query';
import { OFFICIAL_TEMPLATES } from './constants';

export interface AssignWizardProps {
  visible: boolean;
  step: 1 | 2 | 3;
  skipClientStep: boolean;
  selectedCampaign: DripCampaign | null;
  selectedClientIds: string[];
  clientSearch: string;
  campaignSearch: string;
  onClose: () => void;
  onStepChange: (step: 1 | 2 | 3) => void;
  onSelectedCampaignChange: (campaign: DripCampaign | null) => void;
  onSelectedClientIdsChange: (ids: string[]) => void;
  onClientSearchChange: (q: string) => void;
  onCampaignSearchChange: (q: string) => void;
  onNavigateToCreate: () => void;
  onAssignSuccess: (message: string) => void;
}

export function AssignWizard({
  visible,
  step,
  skipClientStep,
  selectedCampaign,
  selectedClientIds,
  clientSearch,
  campaignSearch,
  onClose,
  onStepChange,
  onSelectedCampaignChange,
  onSelectedClientIdsChange,
  onClientSearchChange,
  onCampaignSearchChange,
  onNavigateToCreate,
  onAssignSuccess,
}: AssignWizardProps) {
  const { colors, isDark, primaryColor, buttonColor } = useTheme();
  const language = useStore((s) => s.language) as Language;
  const dripCampaigns = useStore((s) => s.dripCampaigns);
  const { data: rawClientsForWizard = [] } = useClients();
  const user = useStore((s) => s.user);
  const assignClientToDrip = useStore((s) => s.assignClientToDrip);
  const { businessId } = useBusiness();
  const queryClient = useQueryClient();

  const handleRequestClose = () => {
    onClose();
    onStepChange(1);
    onSelectedCampaignChange(null);
    onSelectedClientIdsChange([]);
    onClientSearchChange('');
    onCampaignSearchChange('');
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleRequestClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
        {/* Wizard Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Pressable
            onPress={() => {
              // When skipping Step 2, back from Step 3 goes to Step 1 (not Step 2)
              if (step === 3 && skipClientStep) {
                onStepChange(1);
              } else if (step > 1) {
                onStepChange((step - 1) as 1 | 2 | 3);
              } else {
                onClose();
                onStepChange(1);
                onSelectedCampaignChange(null);
                onSelectedClientIdsChange([]);
              }
            }}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isDark ? colors.backgroundTertiary : '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}
          >
            {step > 1 ? <ChevronRight size={20} color={colors.textSecondary} style={{ transform: [{ rotate: '180deg' }] }} /> : <X size={20} color={colors.textSecondary} />}
          </Pressable>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>
              {step === 1 ? t('selectCampaign', language) : step === 2 ? t('selectClients', language) : t('confirmAssignment', language)}
            </Text>
            <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 2 }}>
              {skipClientStep ? `Step ${step === 1 ? 1 : 2} of 2` : `Step ${step} of 3`}
            </Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        {/* Step indicator */}
        <View style={{ flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 12, gap: 6 }}>
          {(skipClientStep ? [1, 3] : [1, 2, 3]).map((s) => (
            <View key={s} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: s <= step ? primaryColor : colors.border }} />
          ))}
        </View>

        {/* Step 1: Select Campaign */}
        {step === 1 && (
          <View style={{ flex: 1 }}>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
              {(() => {
                const q = campaignSearch.trim().toLowerCase();
                // Custom campaigns section
                const customCampaigns = dripCampaigns.filter((c) =>
                  !q || c.name.toLowerCase().includes(q)
                );
                // Official templates section — map SmartDripTemplate to a DripCampaign-like shape for selection
                const officialFiltered = OFFICIAL_TEMPLATES.filter((tpl) =>
                  !q || t(tpl.nameKey, language).toLowerCase().includes(q)
                );
                const noResults = customCampaigns.length === 0 && officialFiltered.length === 0;
                if (noResults) {
                  return (
                    <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                      <Mail size={40} color={colors.textTertiary} />
                      <Text style={{ color: colors.textSecondary, fontSize: 15, marginTop: 12, textAlign: 'center' }}>
                        {q ? t('noClientsMatchFilters', language) : t('noCampaignsYet', language)}
                      </Text>
                      {!q && (
                        <Pressable
                          onPress={() => { onClose(); onNavigateToCreate(); }}
                          style={{ marginTop: 16, backgroundColor: buttonColor, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}
                        >
                          <Text style={{ color: '#fff', fontWeight: '600' }}>{t('createCampaignButton', language)}</Text>
                        </Pressable>
                      )}
                    </View>
                  );
                }
                return (
                  <>
                    {/* Your Campaigns section */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                      <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13, flex: 1 }}>
                        {t('yourCampaigns', language)}
                      </Text>
                      <View style={{ backgroundColor: `${primaryColor}15`, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
                        <Text style={{ color: primaryColor, fontSize: 11, fontWeight: '600' }}>{customCampaigns.length}</Text>
                      </View>
                    </View>
                    {customCampaigns.length === 0 ? (
                      <View style={{ backgroundColor: colors.card, borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}>
                        <Text style={{ color: colors.textTertiary, fontSize: 13 }}>{t('noCampaignsYet', language)}</Text>
                        <Pressable
                          onPress={() => { onClose(); onNavigateToCreate(); }}
                          style={{ marginTop: 10, paddingHorizontal: 14, paddingVertical: 6, backgroundColor: `${primaryColor}15`, borderRadius: 8 }}
                        >
                          <Text style={{ color: primaryColor, fontSize: 12, fontWeight: '600' }}>{t('createCampaignButton', language)}</Text>
                        </Pressable>
                      </View>
                    ) : (
                      customCampaigns.map((campaign) => (
                        <Pressable
                          key={campaign.id}
                          onPress={() => {
                            onSelectedCampaignChange(campaign);
                            onStepChange(skipClientStep ? 3 : 2);
                          }}
                          style={{ backgroundColor: colors.card, borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: selectedCampaign?.id === campaign.id ? primaryColor : colors.border, flexDirection: 'row', alignItems: 'center' }}
                        >
                          <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: `${primaryColor}15`, alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                            <Mail size={20} color={primaryColor} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15 }} numberOfLines={1}>{campaign.name}</Text>
                            <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 2 }}>{campaign.emails.length} email{campaign.emails.length !== 1 ? 's' : ''} · {campaign.frequency}</Text>
                          </View>
                          <View style={{ backgroundColor: campaign.isActive ? `${primaryColor}15` : colors.backgroundTertiary ?? '#F1F5F9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginLeft: 8 }}>
                            <Text style={{ color: campaign.isActive ? primaryColor : colors.textTertiary, fontSize: 11, fontWeight: '600' }}>{campaign.isActive ? t('active', language) : t('paused', language)}</Text>
                          </View>
                        </Pressable>
                      ))
                    )}

                    {/* Official Templates section */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, marginBottom: 10 }}>
                      <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13, flex: 1 }}>
                        {t('dripOfficialTemplates', language)}
                      </Text>
                      <View style={{ backgroundColor: `${primaryColor}20`, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
                        <Text style={{ color: primaryColor, fontSize: 11, fontWeight: '700' }}>OFFICIAL</Text>
                      </View>
                    </View>
                    {officialFiltered.length === 0 ? (
                      <View style={{ backgroundColor: colors.card, borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}>
                        <Text style={{ color: colors.textTertiary, fontSize: 13 }}>No templates available</Text>
                      </View>
                    ) : (
                      officialFiltered.map((tpl) => {
                        // Convert template into a DripCampaign-compatible object for wizard selection
                        const tplAsCampaign: DripCampaign = {
                          id: tpl.id,
                          userId: user?.id ?? '',
                          name: t(tpl.nameKey, language),
                          color: tpl.color || primaryColor,
                          emails: tpl.emails.map((e, idx) => ({
                            id: `${tpl.id}_email_${idx}`,
                            subject: t(e.subjectKey, language),
                            body: t(e.bodyKey, language),
                            delayDays: e.delayDays,
                          })),
                          frequency: (tpl.defaultFrequency as DripCampaign['frequency']) || 'monthly',
                          isActive: true,
                          createdAt: new Date(),
                        };
                        return (
                          <Pressable
                            key={tpl.id}
                            onPress={() => {
                              onSelectedCampaignChange(tplAsCampaign);
                              onStepChange(skipClientStep ? 3 : 2);
                            }}
                            style={{ backgroundColor: colors.card, borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: selectedCampaign?.id === tpl.id ? primaryColor : colors.border, flexDirection: 'row', alignItems: 'center' }}
                          >
                            <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: `${primaryColor}15`, alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                              <Sparkles size={20} color={primaryColor} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15 }} numberOfLines={1}>{t(tpl.nameKey, language)}</Text>
                              <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 2 }}>{tpl.emails.length} email{tpl.emails.length !== 1 ? 's' : ''} · {tpl.defaultFrequency ?? 'once'}</Text>
                            </View>
                            <View style={{ backgroundColor: `${primaryColor}20`, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginLeft: 8 }}>
                              <Text style={{ color: primaryColor, fontSize: 11, fontWeight: '700' }}>OFFICIAL</Text>
                            </View>
                          </Pressable>
                        );
                      })
                    )}
                  </>
                );
              })()}
            </ScrollView>
          </View>
        )}

        {/* Step 2: Select Clients */}
        {step === 2 && (() => {
          const activeClientsForWizard = rawClientsForWizard.filter((c) => !(c as any).is_archived);
          const normalizePhone = (p: string) => p.replace(/[\s\-\(\)\+]/g, '');
          const filteredForWizard = clientSearch.trim()
            ? activeClientsForWizard.filter((c) => {
                const q = clientSearch.trim().toLowerCase();
                const qPhone = normalizePhone(q);
                const fullName = (c.name ?? '').toLowerCase();
                const parts = fullName.split(/\s+/);
                const phone = normalizePhone((c.phone ?? '').toLowerCase());
                return (
                  fullName.includes(q) ||
                  parts[0]?.includes(q) ||
                  parts[parts.length - 1]?.includes(q) ||
                  phone.includes(qPhone) ||
                  (c.email ?? '').toLowerCase().includes(q)
                );
              })
            : activeClientsForWizard;
          const allSelected = filteredForWizard.length > 0 && filteredForWizard.every((c) => selectedClientIds.includes(c.id));
          return (
            <View style={{ flex: 1 }}>
              {/* Select All */}
              <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
                <Pressable
                  onPress={() => {
                    if (allSelected) onSelectedClientIdsChange([]);
                    else onSelectedClientIdsChange(filteredForWizard.map((c) => c.id));
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}
                >
                  <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: allSelected ? primaryColor : colors.border, backgroundColor: allSelected ? primaryColor : 'transparent', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                    {allSelected && <Check size={13} color="#fff" />}
                  </View>
                  <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>{t('selectAll', language)} ({filteredForWizard.length})</Text>
                </Pressable>
              </View>
              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
                {filteredForWizard.map((client) => {
                  const selected = selectedClientIds.includes(client.id);
                  const initials = (client.name ?? '?').split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase() || '?';
                  return (
                    <Pressable
                      key={client.id}
                      onPress={() => onSelectedClientIdsChange(selected ? selectedClientIds.filter((id) => id !== client.id) : [...selectedClientIds, client.id])}
                      style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: selected ? `${primaryColor}08` : colors.card, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: selected ? primaryColor : colors.border }}
                    >
                      <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: selected ? primaryColor : colors.border, backgroundColor: selected ? primaryColor : 'transparent', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                        {selected && <Check size={13} color="#fff" />}
                      </View>
                      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: `${primaryColor}20`, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                        <Text style={{ color: primaryColor, fontWeight: '700', fontSize: 12 }}>{initials}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }} numberOfLines={1}>{client.name}</Text>
                        {client.email && <Text style={{ color: colors.textTertiary, fontSize: 12 }} numberOfLines={1}>{client.email}</Text>}
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border }}>
                <Pressable
                  onPress={() => { if (selectedClientIds.length > 0) onStepChange(3); }}
                  style={{ backgroundColor: selectedClientIds.length > 0 ? buttonColor : (isDark ? colors.backgroundTertiary : '#CBD5E1'), borderRadius: 14, paddingVertical: 16, alignItems: 'center' }}
                  disabled={selectedClientIds.length === 0}
                >
                  <Text style={{ color: selectedClientIds.length > 0 ? '#fff' : colors.textTertiary, fontWeight: '700', fontSize: 15 }}>
                    {t('continue', language)} ({selectedClientIds.length} {t('selected', language)})
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        })()}

        {/* Step 3: Confirm */}
        {step === 3 && selectedCampaign && (() => {
          // Official templates have non-UUID ids (e.g. "official_welcome")
          const isOfficialTemplate = selectedCampaign.id.startsWith('official_');
          return (
          <View style={{ flex: 1 }}>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false}>
              <Animated.View entering={FadeInDown.delay(0).duration(300)}>
                <View style={{ backgroundColor: `${primaryColor}10`, borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: `${primaryColor}30`, alignItems: 'center' }}>
                  <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: `${primaryColor}20`, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                    {isOfficialTemplate ? <Sparkles size={28} color={primaryColor} /> : <Mail size={28} color={primaryColor} />}
                  </View>
                  <Text style={{ color: colors.text, fontWeight: '700', fontSize: 18, textAlign: 'center' }} numberOfLines={2}>{selectedCampaign.name}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }}>{selectedCampaign.emails.length} email{selectedCampaign.emails.length !== 1 ? 's' : ''} · {selectedCampaign.frequency}</Text>
                  {isOfficialTemplate && (
                    <View style={{ backgroundColor: `${primaryColor}20`, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, marginTop: 8 }}>
                      <Text style={{ color: primaryColor, fontSize: 11, fontWeight: '700' }}>OFFICIAL TEMPLATE</Text>
                    </View>
                  )}
                </View>
                {isOfficialTemplate ? (
                  <View style={{ backgroundColor: isDark ? `${primaryColor}10` : `${primaryColor}08`, borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: `${primaryColor}25` }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                      <AlertTriangle size={18} color={primaryColor} style={{ marginTop: 1 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14, marginBottom: 4 }}>Save as Campaign First</Text>
                        <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 19 }}>
                          Official templates must be saved as a custom campaign before you can assign clients. Go back and select one of your saved campaigns, or create a new campaign from this template first.
                        </Text>
                      </View>
                    </View>
                  </View>
                ) : (
                  <View style={{ backgroundColor: colors.card, borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.border }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={{ color: colors.textSecondary, fontSize: 14 }}>Clients to assign</Text>
                      <View style={{ backgroundColor: `${primaryColor}15`, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10 }}>
                        <Text style={{ color: primaryColor, fontWeight: '700', fontSize: 16 }}>{selectedClientIds.length}</Text>
                      </View>
                    </View>
                  </View>
                )}
                {!isOfficialTemplate && (
                  <Text style={{ color: colors.textTertiary, fontSize: 12, textAlign: 'center', lineHeight: 18 }}>
                    These clients will be enrolled in this drip campaign. They will start receiving emails when the campaign is activated.
                  </Text>
                )}
              </Animated.View>
            </ScrollView>
            <View style={{ padding: 20, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border }}>
              {isOfficialTemplate ? (
                <Pressable
                  onPress={() => { onStepChange(1); }}
                  style={{ backgroundColor: buttonColor, borderRadius: 14, paddingVertical: 16, alignItems: 'center' }}
                >
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>← Go Back &amp; Select a Campaign</Text>
                </Pressable>
              ) : (
              <Pressable
                onPress={() => {
                  const campaignId = selectedCampaign!.id;
                  const count = selectedClientIds.length;
                  const campaignName = selectedCampaign!.name;
                  // Update Zustand state immediately
                  selectedClientIds.forEach((clientId) => {
                    assignClientToDrip(clientId, campaignId);
                  });
                  // Persist each assignment to Supabase and invalidate enrollments cache
                  if (businessId) {
                    // Optimistically inject new enrollments so stats update instantly
                    const now = new Date().toISOString();
                    queryClient.setQueryData<import('@/services/dripCampaignsService').EnrollmentRow[]>(
                      enrollmentKeys.list(businessId),
                      (old) => {
                        const existing = old ?? [];
                        const newRows = selectedClientIds
                          .filter((cid) => !existing.some((e) => e.client_id === cid && e.campaign_id === campaignId))
                          .map((cid) => ({
                            id: `optimistic_${cid}_${campaignId}`,
                            business_id: businessId,
                            campaign_id: campaignId,
                            client_id: cid,
                            is_active: true,
                            enrolled_at: now,
                            updated_at: now,
                          }));
                        // Update any existing inactive enrollments for these clients
                        const updated = existing.map((e) =>
                          selectedClientIds.includes(e.client_id) && e.campaign_id === campaignId
                            ? { ...e, is_active: true }
                            : e
                        );
                        return [...updated, ...newRows];
                      }
                    );
                    selectedClientIds.forEach((clientId) => {
                      persistClientDripAssignment(clientId, campaignId, businessId).catch(() => {});
                    });
                    // Refetch enrollments after a brief delay to get real DB state
                    setTimeout(() => {
                      queryClient.invalidateQueries({ queryKey: enrollmentKeys.list(businessId) });
                    }, 800);
                  }
                  onClose();
                  onStepChange(1);
                  onSelectedCampaignChange(null);
                  onSelectedClientIdsChange([]);
                  onClientSearchChange('');
                  onCampaignSearchChange('');
                  onAssignSuccess(`${count} client${count !== 1 ? 's' : ''} assigned to ${campaignName}`);
                }}
                style={{ backgroundColor: buttonColor, borderRadius: 14, paddingVertical: 16, alignItems: 'center' }}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
                  {t('assignClientsButton', language).replace('{count}', String(selectedClientIds.length))}
                </Text>
              </Pressable>
              )}
            </View>
          </View>
          );
        })()}
      </SafeAreaView>
    </Modal>
  );
}
