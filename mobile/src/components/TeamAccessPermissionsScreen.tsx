import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useTabPersistence } from '@/hooks/useTabPersistence';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ShieldCheck,
  X,
  UserPlus,
  Mail,
  Crown,
  UserCog,
  User,
  Check,
  Clock,
  Send,
  Trash2,
  RefreshCw,
  Users,
  Store,
  Shield,
  Calendar,
  Briefcase,
  Tag,
  BarChart3,
  Settings,
  CreditCard,
  Info,
  RotateCcw,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/lib/ThemeContext';
import { useToast } from '@/lib/ToastContext';
import { useStore } from '@/lib/store';
import { useBusiness } from '@/hooks/useBusiness';
import { useStores } from '@/hooks/useStores';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/types';
import { feedbackToggle } from '@/lib/SoundManager';
import { SetupHint } from '@/components/SetupHint';
import {
  useStaffAccessData,
  useCreateInvite,
  useCancelInvite,
  useResendInvite,
  useRemoveMember,
  getStaffAccessRpcCallCount,
  type InviteRole,
} from '@/hooks/useStaffInvites';
import {
  ROLES,
  PERMISSIONS,
  PERMISSION_CATEGORIES,
  PERMISSION_METADATA,
  CATEGORY_METADATA,
  getPermissionsForCategory,
  getDefaultPermissionsForRole,
  type Role,
  type Permission,
  type PermissionCategory,
} from '@/lib/rbac';
import {
  getBusinessPermissions,
  updateRolePermissions,
  getAuditSummary,
} from '@/lib/rbac/permissionService';

// ============================================
// PERFORMANCE AUDIT INSTRUMENTATION (DEV ONLY)
// ============================================
const PERF_AUDIT_ENABLED = true;
let __screenOpenCount = 0;
let __screenOpenTimestamp = 0;

function logPerfAudit(event: string, details?: Record<string, unknown>) {
  if (!PERF_AUDIT_ENABLED) return;
  const now = performance.now();
  const elapsed = __screenOpenTimestamp > 0 ? now - __screenOpenTimestamp : 0;
  console.log(`[TEAM_ACCESS_TIMING] ${event}`, {
    elapsed_ms: elapsed.toFixed(2),
    timestamp: now.toFixed(2),
    ...details,
  });
}

export function markTeamAccessScreenOpen() {
  __screenOpenCount++;
  __screenOpenTimestamp = performance.now();
  console.log('\n========================================');
  console.log(`[TEAM_ACCESS_TIMING] SCREEN OPEN #${__screenOpenCount}`);
  console.log(`[TEAM_ACCESS_TIMING] tap_timestamp: ${__screenOpenTimestamp.toFixed(2)}ms`);
  console.log('========================================');
}

// Map category keys to icon components
const CATEGORY_ICONS: Record<PermissionCategory, React.ComponentType<{ size: number; color: string }>> = {
  [PERMISSION_CATEGORIES.CLIENTS]: Users,
  [PERMISSION_CATEGORIES.APPOINTMENTS]: Calendar,
  [PERMISSION_CATEGORIES.STAFF_MANAGEMENT]: UserCog,
  [PERMISSION_CATEGORIES.STORES]: Store,
  [PERMISSION_CATEGORIES.SERVICES]: Briefcase,
  [PERMISSION_CATEGORIES.CAMPAIGNS]: Mail,
  [PERMISSION_CATEGORIES.PROMOTIONS]: Tag,
  [PERMISSION_CATEGORIES.ANALYTICS]: BarChart3,
  [PERMISSION_CATEGORIES.SETTINGS]: Settings,
  [PERMISSION_CATEGORIES.BILLING]: CreditCard,
};

const INVITE_ROLES: { key: InviteRole; icon: React.ComponentType<{ size: number; color: string }>; color: string }[] = [
  { key: 'manager', icon: UserCog, color: '#3B82F6' },
  { key: 'staff', icon: User, color: '#10B981' },
];

type TabKey = 'team' | 'roles';

interface TeamAccessPermissionsScreenProps {
  onClose: () => void;
  setupHint?: string;
}

export function TeamAccessPermissionsScreen({ onClose, setupHint }: TeamAccessPermissionsScreenProps) {
  const language = useStore((s) => s.language) as Language;
  const userId = useStore((s) => s.user?.id);
  const { businessId } = useBusiness();
  const { isDark, colors, primaryColor } = useTheme();
  const { showSuccess } = useToast();

  // Tab state
  const [activeTab, setActiveTab] = useTabPersistence<TabKey>('team_access', 'roles');

  // ============================================
  // TEAM TAB STATE
  // ============================================
  const hasLoggedDataRender = useRef(false);

  useEffect(() => {
    markTeamAccessScreenOpen();
    logPerfAudit('COMPONENT_MOUNTED');
  }, []);

  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [selectedInviteRole, setSelectedInviteRole] = useState<InviteRole>('staff');
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);
  const [allStoresSelected, setAllStoresSelected] = useState(true);

  const { data: staffAccessData, isLoading: isLoadingStaffData } = useStaffAccessData();
  const showSkeleton = isLoadingStaffData && !staffAccessData;
  const pendingInvites = staffAccessData?.pending_invites ?? [];
  const members = staffAccessData?.team_members ?? [];

  useEffect(() => {
    if (staffAccessData && !hasLoggedDataRender.current) {
      hasLoggedDataRender.current = true;
      const rpcCallCount = getStaffAccessRpcCallCount();
      const tapToRender = performance.now() - __screenOpenTimestamp;
      console.log('\n========================================');
      console.log('[TEAM_ACCESS_TIMING] PERFORMANCE SUMMARY');
      console.log(`  tap_to_first_render_ms: ${tapToRender.toFixed(2)}`);
      console.log(`  rpc_call_count: ${rpcCallCount}`);
      console.log(`  skeleton_shown: ${showSkeleton ? 'YES' : 'NO (cached data)'}`);
      console.log(`  data: ${pendingInvites.length} invites, ${members.length} members`);
      console.log('========================================\n');
    }
  }, [staffAccessData, showSkeleton, pendingInvites.length, members.length]);

  const { data: stores = [] } = useStores();
  const createInviteMutation = useCreateInvite();
  const cancelInviteMutation = useCancelInvite();
  const resendInviteMutation = useResendInvite();
  const removeMemberMutation = useRemoveMember();

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const handleSendInvite = useCallback(async () => {
    if (!inviteEmail.trim() || !isValidEmail(inviteEmail)) {
      Alert.alert(t('invalidEmail', language));
      return;
    }
    if (!userId) return;
    try {
      await createInviteMutation.mutateAsync({
        email: inviteEmail.trim(),
        role: selectedInviteRole,
        storeIds: allStoresSelected ? [] : selectedStoreIds,
        invitedBy: userId,
      });
      showSuccess(t('inviteSent', language));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setInviteEmail('');
      setShowInviteForm(false);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t('inviteAlreadyExists', language);
      Alert.alert(message);
    }
  }, [inviteEmail, selectedInviteRole, allStoresSelected, selectedStoreIds, userId, language, createInviteMutation, showSuccess]);

  const handleCancelInvite = useCallback(async (inviteId: string) => {
    Alert.alert(t('cancelInvite', language), '', [
      { text: t('cancel', language), style: 'cancel' },
      {
        text: t('delete', language),
        style: 'destructive',
        onPress: async () => {
          try {
            await cancelInviteMutation.mutateAsync(inviteId);
            showSuccess(t('inviteCancelled', language));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch {
            Alert.alert('Failed to cancel invite');
          }
        },
      },
    ]);
  }, [language, cancelInviteMutation, showSuccess]);

  const handleResendInvite = useCallback(async (inviteId: string) => {
    try {
      await resendInviteMutation.mutateAsync(inviteId);
      showSuccess(t('inviteResent', language));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      Alert.alert('Failed to resend invite');
    }
  }, [language, resendInviteMutation, showSuccess]);

  const handleRemoveMember = useCallback(async (memberId: string) => {
    const memberToRemove = members.find((m) => m.id === memberId);
    if (memberToRemove?.role === 'owner') {
      Alert.alert(
        t('cannotRemoveOwner', language) || 'Cannot Remove Owner',
        t('ownerCannotBeRemoved', language) || 'The business owner cannot be removed from the team.'
      );
      return;
    }
    Alert.alert(t('removeMember', language), '', [
      { text: t('cancel', language), style: 'cancel' },
      {
        text: t('delete', language),
        style: 'destructive',
        onPress: async () => {
          try {
            await removeMemberMutation.mutateAsync(memberId);
            showSuccess(t('memberRemoved', language));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch {
            Alert.alert('Failed to remove member');
          }
        },
      },
    ]);
  }, [language, removeMemberMutation, showSuccess, members]);

  const getRoleInfo = (role: string) => {
    switch (role) {
      case 'owner': return { label: t('ownerRole', language), icon: Crown, color: '#F59E0B' };
      case 'manager': return { label: t('managerRole', language), icon: UserCog, color: '#3B82F6' };
      default: return { label: t('staffMemberRole', language), icon: User, color: '#10B981' };
    }
  };

  const formatExpiry = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days <= 0) return 'Expired';
    if (days === 1) return '1 day';
    return `${days} days`;
  };

  const getMemberDisplayName = (member: typeof members[0], isCurrentUser: boolean) => {
    if (isCurrentUser) {
      if (member.user_name) return `${member.user_name} (You)`;
      if (member.user_email) return `${member.user_email} (You)`;
      return 'You';
    }
    if (member.user_name) return member.user_name;
    if (member.user_email) return member.user_email;
    return `User ${member.user_id?.slice(0, 8) ?? 'Unknown'}...`;
  };

  const SkeletonCard = ({ widthPercent = 70 }: { widthPercent?: number }) => (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: isDark ? '#374151' : '#E5E7EB' }} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <View style={{ width: `${widthPercent}%` as `${number}%`, height: 14, borderRadius: 4, backgroundColor: isDark ? '#374151' : '#E5E7EB', marginBottom: 6 }} />
        <View style={{ width: '40%', height: 10, borderRadius: 4, backgroundColor: isDark ? '#374151' : '#E5E7EB' }} />
      </View>
    </View>
  );

  // ============================================
  // ROLES TAB STATE
  // ============================================
  const [selectedRoleTab, setSelectedRoleTab] = useState<'manager' | 'staff'>('manager');

  const [managerPermissions, setManagerPermissions] = useState<Set<Permission>>(() => {
    if (!businessId) return new Set(getDefaultPermissionsForRole(ROLES.MANAGER));
    const config = getBusinessPermissions(businessId);
    return new Set(config.manager_permissions);
  });

  const [staffPermissions, setStaffPermissions] = useState<Set<Permission>>(() => {
    if (!businessId) return new Set(getDefaultPermissionsForRole(ROLES.STAFF));
    const config = getBusinessPermissions(businessId);
    return new Set(config.staff_permissions);
  });

  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const currentPermissions = selectedRoleTab === 'manager' ? managerPermissions : staffPermissions;
  const setCurrentPermissions = selectedRoleTab === 'manager' ? setManagerPermissions : setStaffPermissions;

  const togglePermission = useCallback((permission: Permission) => {
    feedbackToggle();
    setCurrentPermissions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(permission)) {
        newSet.delete(permission);
      } else {
        newSet.add(permission);
      }
      return newSet;
    });
    setHasChanges(true);
  }, [setCurrentPermissions]);

  const handleSave = useCallback(async () => {
    if (!businessId) return;
    setIsSaving(true);
    try {
      updateRolePermissions(businessId, 'manager', Array.from(managerPermissions));
      updateRolePermissions(businessId, 'staff', Array.from(staffPermissions));
      const summary = getAuditSummary();
      console.log('[RBAC] Permissions saved. Audit summary:', summary);
      setHasChanges(false);
      showSuccess(t('permissionsSaved', language));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('[RBAC] Failed to save permissions:', error);
    } finally {
      setIsSaving(false);
    }
  }, [businessId, managerPermissions, staffPermissions, language, showSuccess]);

  const handleResetToDefaults = useCallback(() => {
    feedbackToggle();
    if (selectedRoleTab === 'manager') {
      setManagerPermissions(new Set(getDefaultPermissionsForRole(ROLES.MANAGER)));
    } else {
      setStaffPermissions(new Set(getDefaultPermissionsForRole(ROLES.STAFF)));
    }
    setHasChanges(true);
    showSuccess(t('permissionsReset', language));
  }, [selectedRoleTab, language, showSuccess]);

  const groupedPermissions = useMemo(() => {
    const groups: { category: PermissionCategory; permissions: typeof PERMISSION_METADATA }[] = [];
    CATEGORY_METADATA
      .filter((cat) => cat.key !== PERMISSION_CATEGORIES.BILLING)
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .forEach((cat) => {
        const perms = getPermissionsForCategory(cat.key).filter((p) => !p.isOwnerOnly);
        if (perms.length > 0) {
          groups.push({ category: cat.key, permissions: perms });
        }
      });
    return groups;
  }, []);

  // ============================================
  // RENDER
  // ============================================
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.card,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <ShieldCheck size={22} color={primaryColor} />
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: '600', marginLeft: 10 }}>
            {t('teamAccessPermissions', language)}
          </Text>
        </View>
        <Pressable
          onPress={onClose}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={18} color={primaryColor} />
        </Pressable>
      </View>

      {/* Contextual hint from Business Setup */}
      <SetupHint hintKey={setupHint} />

      {/* Segmented Tab Control */}
      <View
        style={{
          flexDirection: 'row',
          marginHorizontal: 16,
          marginTop: 14,
          marginBottom: 4,
          backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
          borderRadius: 12,
          padding: 4,
        }}
      >
        {([
          { key: 'roles' as TabKey, label: 'Roles' },
          { key: 'team' as TabKey, label: 'Team' },
        ] as const).map((tab) => (
          <Pressable
            key={tab.key}
            onPress={() => {
              feedbackToggle();
              setActiveTab(tab.key);
            }}
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
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* ============================== */}
      {/* TAB 1 — TEAM                  */}
      {/* ============================== */}
      {activeTab === 'team' && (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 100, paddingTop: 12 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Invite Button */}
          <View style={{ paddingHorizontal: 16 }}>
            <Pressable
              onPress={() => {
                feedbackToggle();
                setShowInviteForm(!showInviteForm);
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: primaryColor,
                paddingVertical: 14,
                borderRadius: 12,
              }}
            >
              <UserPlus size={20} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 16, marginLeft: 8 }}>
                {t('inviteTeamMember', language)}
              </Text>
            </Pressable>
          </View>

          {/* Invite Form */}
          {showInviteForm && (
            <View
              style={{
                backgroundColor: colors.card,
                marginHorizontal: 16,
                marginTop: 16,
                borderRadius: 16,
                padding: 16,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              {/* Email Input */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 8 }}>
                  {t('inviteByEmail', language)}
                </Text>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: isDark ? '#1F2937' : '#F3F4F6',
                    borderRadius: 10,
                    paddingHorizontal: 12,
                  }}
                >
                  <Mail size={18} color={colors.textSecondary} />
                  <TextInput
                    value={inviteEmail}
                    onChangeText={setInviteEmail}
                    placeholder={t('enterEmailAddress', language)}
                    placeholderTextColor={colors.textTertiary}
                    style={{ flex: 1, paddingVertical: 12, marginLeft: 10, color: colors.text, fontSize: 15 }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>

              {/* Role Selection */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 8 }}>
                  {t('selectRole', language)}
                </Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {INVITE_ROLES.map((role) => {
                    const isSelected = selectedInviteRole === role.key;
                    const RoleIcon = role.icon;
                    const roleInfo = getRoleInfo(role.key);
                    return (
                      <Pressable
                        key={role.key}
                        onPress={() => { feedbackToggle(); setSelectedInviteRole(role.key); }}
                        style={{
                          flex: 1,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          paddingVertical: 12,
                          borderRadius: 10,
                          backgroundColor: isSelected ? `${role.color}20` : isDark ? '#1F2937' : '#F3F4F6',
                          borderWidth: isSelected ? 2 : 1,
                          borderColor: isSelected ? role.color : colors.border,
                        }}
                      >
                        <RoleIcon size={18} color={isSelected ? role.color : colors.textSecondary} />
                        <Text style={{ marginLeft: 8, fontWeight: '500', color: isSelected ? role.color : colors.textSecondary }}>
                          {roleInfo.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Store Assignment */}
              {stores.length > 1 && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 8 }}>
                    {t('assignToStores', language)}
                  </Text>
                  <Pressable
                    onPress={() => {
                      feedbackToggle();
                      setAllStoresSelected(!allStoresSelected);
                      if (!allStoresSelected) setSelectedStoreIds([]);
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 12,
                      paddingHorizontal: 12,
                      borderRadius: 10,
                      backgroundColor: allStoresSelected ? `${primaryColor}15` : isDark ? '#1F2937' : '#F3F4F6',
                      borderWidth: allStoresSelected ? 2 : 1,
                      borderColor: allStoresSelected ? primaryColor : colors.border,
                      marginBottom: 8,
                    }}
                  >
                    <Store size={18} color={allStoresSelected ? primaryColor : colors.textSecondary} />
                    <Text style={{ flex: 1, marginLeft: 10, color: allStoresSelected ? primaryColor : colors.text, fontWeight: '500' }}>
                      {t('allStoresAccess', language)}
                    </Text>
                    {allStoresSelected && <Check size={18} color={primaryColor} />}
                  </Pressable>

                  {!allStoresSelected && stores.map((store) => {
                    const isSelected = selectedStoreIds.includes(store.id);
                    return (
                      <Pressable
                        key={store.id}
                        onPress={() => {
                          feedbackToggle();
                          setSelectedStoreIds(
                            isSelected
                              ? selectedStoreIds.filter((id) => id !== store.id)
                              : [...selectedStoreIds, store.id]
                          );
                        }}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingVertical: 10,
                          paddingHorizontal: 12,
                          borderRadius: 8,
                          backgroundColor: isSelected ? `${primaryColor}10` : 'transparent',
                          marginBottom: 4,
                        }}
                      >
                        <View
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: 11,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: isSelected ? primaryColor : 'transparent',
                            borderWidth: isSelected ? 0 : 2,
                            borderColor: isDark ? '#4B5563' : '#D1D5DB',
                          }}
                        >
                          {isSelected && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
                        </View>
                        <Text style={{ marginLeft: 10, color: colors.text }}>{store.name}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}

              {/* Expiry Notice */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: isDark ? '#374151' : '#F3F4F6',
                  padding: 10,
                  borderRadius: 8,
                  marginBottom: 16,
                }}
              >
                <Clock size={16} color={colors.textSecondary} />
                <Text style={{ marginLeft: 8, color: colors.textSecondary, fontSize: 13 }}>
                  {t('inviteExpiresIn', language)}
                </Text>
              </View>

              {/* Send Button */}
              <Pressable
                onPress={handleSendInvite}
                disabled={createInviteMutation.isPending}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: primaryColor,
                  paddingVertical: 14,
                  borderRadius: 10,
                  opacity: createInviteMutation.isPending ? 0.7 : 1,
                }}
              >
                {createInviteMutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Send size={18} color="#FFFFFF" />
                    <Text style={{ color: '#FFFFFF', fontWeight: '600', marginLeft: 8 }}>
                      {t('sendInvite', language)}
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          )}

          {/* Pending Invites */}
          <View style={{ paddingHorizontal: 16, marginTop: 24 }}>
            <Text style={{ color: colors.text, fontWeight: '600', fontSize: 16, marginBottom: 12 }}>
              {t('pendingInvites', language)}
            </Text>

            {showSkeleton ? (
              <View>
                <SkeletonCard widthPercent={65} />
                <SkeletonCard widthPercent={55} />
              </View>
            ) : pendingInvites.length === 0 ? (
              <View style={{ backgroundColor: colors.card, borderRadius: 12, padding: 20, alignItems: 'center' }}>
                <Mail size={32} color={colors.textTertiary} />
                <Text style={{ color: colors.textSecondary, marginTop: 8 }}>
                  {t('noPendingInvites', language)}
                </Text>
              </View>
            ) : (
              <View>
                {pendingInvites.map((invite, index) => {
                  const roleInfo = getRoleInfo(invite.role);
                  const RoleIcon = roleInfo.icon;
                  return (
                    <View
                      key={invite.id || `invite-${index}`}
                      style={{
                        backgroundColor: colors.card,
                        borderRadius: 12,
                        padding: 14,
                        marginBottom: 10,
                        flexDirection: 'row',
                        alignItems: 'center',
                      }}
                    >
                      <View
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 20,
                          backgroundColor: `${roleInfo.color}20`,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <RoleIcon size={20} color={roleInfo.color} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={{ color: colors.text, fontWeight: '500' }}>{invite.email}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                          <Text style={{ color: roleInfo.color, fontSize: 12, fontWeight: '500' }}>
                            {roleInfo.label}
                          </Text>
                          <Text style={{ color: colors.textTertiary, fontSize: 12, marginLeft: 8 }}>
                            {t('inviteExpires', language)}: {formatExpiry(invite.expires_at)}
                          </Text>
                        </View>
                      </View>
                      <Pressable onPress={() => handleResendInvite(invite.id)} style={{ padding: 8, marginRight: 4 }}>
                        <RefreshCw size={18} color={colors.textSecondary} />
                      </Pressable>
                      <Pressable onPress={() => handleCancelInvite(invite.id)} style={{ padding: 8 }}>
                        <Trash2 size={18} color="#EF4444" />
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* Team Members */}
          <View style={{ paddingHorizontal: 16, marginTop: 24 }}>
            <Text style={{ color: colors.text, fontWeight: '600', fontSize: 16, marginBottom: 12 }}>
              {t('teamMembers', language)}
            </Text>

            {showSkeleton ? (
              <View>
                <SkeletonCard widthPercent={50} />
                <SkeletonCard widthPercent={60} />
              </View>
            ) : members.length === 0 ? (
              <View style={{ backgroundColor: colors.card, borderRadius: 12, padding: 20, alignItems: 'center' }}>
                <Users size={32} color={colors.textTertiary} />
                <Text style={{ color: colors.textSecondary, marginTop: 8 }}>
                  {t('noTeamMembers', language)}
                </Text>
              </View>
            ) : (
              <View>
                {members.map((member, index) => {
                  const roleInfo = getRoleInfo(member.role);
                  const RoleIcon = roleInfo.icon;
                  const isOwner = member.role === 'owner';
                  return (
                    <View
                      key={member.id || `member-${index}`}
                      style={{
                        backgroundColor: colors.card,
                        borderRadius: 12,
                        padding: 14,
                        marginBottom: 10,
                        flexDirection: 'row',
                        alignItems: 'center',
                        borderWidth: isOwner ? 1 : 0,
                        borderColor: isOwner ? '#F59E0B40' : 'transparent',
                      }}
                    >
                      <View
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 20,
                          backgroundColor: `${roleInfo.color}20`,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <RoleIcon size={20} color={roleInfo.color} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={{ color: colors.text, fontWeight: '500' }}>
                          {getMemberDisplayName(member, member.user_id === userId)}
                        </Text>
                        <Text style={{ color: roleInfo.color, fontSize: 12, fontWeight: '500', marginTop: 2 }}>
                          {roleInfo.label}
                        </Text>
                      </View>
                      {!isOwner && member.user_id !== userId && (
                        <Pressable onPress={() => handleRemoveMember(member.id)} style={{ padding: 8 }}>
                          <X size={18} color="#EF4444" />
                        </Pressable>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {/* ============================== */}
      {/* TAB 2 — ROLES                 */}
      {/* ============================== */}
      {activeTab === 'roles' && (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Shadow Mode Notice */}
          <Animated.View
            entering={FadeInDown.delay(100).duration(400)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: isDark ? '#3B82F620' : '#EFF6FF',
              padding: 12,
              marginHorizontal: 16,
              marginTop: 16,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: isDark ? '#3B82F640' : '#BFDBFE',
            }}
          >
            <Info size={20} color="#3B82F6" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ color: '#3B82F6', fontWeight: '600', fontSize: 14 }}>
                {t('shadowModeNotice', language)}
              </Text>
              <Text style={{ color: isDark ? '#93C5FD' : '#1D4ED8', fontSize: 12, marginTop: 2 }}>
                {t('shadowModeDescription', language)}
              </Text>
            </View>
          </Animated.View>

          {/* Owner Card */}
          <Animated.View
            entering={FadeInDown.delay(150).duration(400)}
            style={{
              backgroundColor: isDark ? '#F59E0B20' : '#FFFBEB',
              marginHorizontal: 16,
              marginTop: 16,
              borderRadius: 16,
              padding: 16,
              borderWidth: 1,
              borderColor: isDark ? '#F59E0B40' : '#FDE68A',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: isDark ? '#F59E0B30' : '#FEF3C7',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Crown size={24} color="#F59E0B" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ color: isDark ? '#FCD34D' : '#B45309', fontWeight: '700', fontSize: 16 }}>
                  {t('owner', language)}
                </Text>
                <Text style={{ color: isDark ? '#FDE68A' : '#92400E', fontSize: 13, marginTop: 2 }}>
                  {t('ownerDescription', language)}
                </Text>
              </View>
            </View>
            <View
              style={{
                marginTop: 12,
                paddingTop: 12,
                borderTopWidth: 1,
                borderTopColor: isDark ? '#F59E0B30' : '#FDE68A',
              }}
            >
              <Text style={{ color: isDark ? '#FCD34D' : '#92400E', fontSize: 12, fontStyle: 'italic' }}>
                {t('ownerCannotBeModified', language)}
              </Text>
            </View>
          </Animated.View>

          {/* Role Selector Tabs */}
          <Animated.View
            entering={FadeInDown.delay(200).duration(400)}
            style={{
              flexDirection: 'row',
              marginHorizontal: 16,
              marginTop: 16,
              backgroundColor: colors.card,
              borderRadius: 12,
              padding: 4,
            }}
          >
            <Pressable
              onPress={() => { setSelectedRoleTab('manager'); feedbackToggle(); }}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 10,
                backgroundColor: selectedRoleTab === 'manager' ? primaryColor : 'transparent',
                alignItems: 'center',
              }}
            >
              <Text style={{ color: selectedRoleTab === 'manager' ? '#FFFFFF' : colors.textSecondary, fontWeight: '600', fontSize: 15 }}>
                {t('manager', language)}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => { setSelectedRoleTab('staff'); feedbackToggle(); }}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 10,
                backgroundColor: selectedRoleTab === 'staff' ? primaryColor : 'transparent',
                alignItems: 'center',
              }}
            >
              <Text style={{ color: selectedRoleTab === 'staff' ? '#FFFFFF' : colors.textSecondary, fontWeight: '600', fontSize: 15 }}>
                {t('staffRole', language)}
              </Text>
            </Pressable>
          </Animated.View>

          {/* Role Description */}
          <Animated.View
            entering={FadeInDown.delay(250).duration(400)}
            style={{ marginHorizontal: 16, marginTop: 12, paddingHorizontal: 4 }}
          >
            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
              {selectedRoleTab === 'manager'
                ? t('managerDescription', language)
                : t('staffRoleDescription', language)}
            </Text>
          </Animated.View>

          {/* Permission Categories */}
          {groupedPermissions.map(({ category, permissions }, groupIndex) => {
            const categoryMeta = CATEGORY_METADATA.find((c) => c.key === category);
            const IconComponent = CATEGORY_ICONS[category] || Settings;

            return (
              <Animated.View
                key={category}
                entering={FadeInDown.delay(300 + groupIndex * 50).duration(400)}
                style={{
                  backgroundColor: colors.card,
                  marginHorizontal: 16,
                  marginTop: 16,
                  borderRadius: 16,
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 16,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                    backgroundColor: isDark ? `${primaryColor}10` : `${primaryColor}05`,
                  }}
                >
                  <IconComponent size={20} color={primaryColor} />
                  <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15, marginLeft: 10 }}>
                    {categoryMeta ? t(categoryMeta.translationKey as keyof typeof t, language) : category}
                  </Text>
                </View>

                {permissions.map((perm, permIndex) => {
                  const isEnabled = currentPermissions.has(perm.key);
                  return (
                    <Pressable
                      key={perm.key}
                      onPress={() => togglePermission(perm.key)}
                      accessible={true}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: isEnabled }}
                      accessibilityLabel={`${t(perm.translationKey as keyof typeof t, language)}: ${isEnabled ? 'On' : 'Off'}`}
                      style={{
                        padding: 16,
                        borderBottomWidth: permIndex < permissions.length - 1 ? 1 : 0,
                        borderBottomColor: colors.border,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: colors.text, fontWeight: '500', fontSize: 14 }}>
                            {t(perm.translationKey as keyof typeof t, language)}
                          </Text>
                          <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 2 }}>
                            {t(perm.descriptionKey as keyof typeof t, language)}
                          </Text>
                        </View>
                        <View
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 12,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: isEnabled ? primaryColor : 'transparent',
                            borderWidth: 2,
                            borderColor: isEnabled ? primaryColor : colors.border,
                          }}
                        >
                          {isEnabled && <Check size={14} color="#FFFFFF" />}
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </Animated.View>
            );
          })}

          {/* Save Button */}
          <Animated.View
            entering={FadeInDown.delay(600).duration(400)}
            style={{ marginHorizontal: 16, marginTop: 24 }}
          >
            <Pressable
              onPress={handleSave}
              disabled={!hasChanges || isSaving}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 16,
                borderRadius: 12,
                backgroundColor: hasChanges ? primaryColor : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'),
                opacity: isSaving ? 0.7 : 1,
              }}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Check size={20} color={hasChanges ? '#FFFFFF' : colors.textTertiary} />
                  <Text style={{ color: hasChanges ? '#FFFFFF' : colors.textTertiary, fontWeight: '700', fontSize: 16, marginLeft: 8 }}>
                    {t('savePermissions', language)}
                  </Text>
                </>
              )}
            </Pressable>
          </Animated.View>

          {/* Reset to Defaults Button */}
          <Animated.View
            entering={FadeInDown.delay(650).duration(400)}
            style={{ marginHorizontal: 16, marginTop: 12, marginBottom: 32 }}
          >
            <Pressable
              onPress={handleResetToDefaults}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 14,
                borderRadius: 12,
                backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
              }}
            >
              <RotateCcw size={18} color={colors.textSecondary} />
              <Text style={{ color: colors.textSecondary, fontWeight: '600', marginLeft: 8 }}>
                {t('resetToDefaults', language)}
              </Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
