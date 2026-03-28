import React, { useState, useCallback, useEffect, useRef } from 'react';
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
  UserPlus,
  Mail,
  Crown,
  UserCog,
  User,
  Check,
  X,
  Clock,
  Send,
  Trash2,
  RefreshCw,
  Users,
  Store,
  ShieldCheck,
} from 'lucide-react-native';
// PERF AUDIT: Animations temporarily disabled for raw performance measurement
// import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/lib/ThemeContext';
import { useToast } from '@/lib/ToastContext';
import { useStore } from '@/lib/store';
import { useBusiness } from '@/hooks/useBusiness';
import { useStores } from '@/hooks/useStores';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/types';
import { feedbackToggle } from '@/lib/SoundManager';
import {
  useStaffAccessData,
  useCreateInvite,
  useCancelInvite,
  useResendInvite,
  useRemoveMember,
  getStaffAccessRpcCallCount,
  type InviteRole,
} from '@/hooks/useStaffInvites';

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
  console.log(`[STAFF_ACCESS_TIMING] ${event}`, {
    elapsed_ms: elapsed.toFixed(2),
    timestamp: now.toFixed(2),
    ...details,
  });
}

// Call this when screen opens
export function markStaffAccessScreenOpen() {
  __screenOpenCount++;
  __screenOpenTimestamp = performance.now();
  console.log('\n========================================');
  console.log(`[STAFF_ACCESS_TIMING] SCREEN OPEN #${__screenOpenCount}`);
  console.log(`[STAFF_ACCESS_TIMING] tap_timestamp: ${__screenOpenTimestamp.toFixed(2)}ms`);
  console.log('========================================');
}

interface StaffAccessScreenProps {
  onClose: () => void;
}

const ROLES: { key: InviteRole; icon: React.ComponentType<{ size: number; color: string }>; color: string }[] = [
  { key: 'manager', icon: UserCog, color: '#3B82F6' },
  { key: 'staff', icon: User, color: '#10B981' },
];

export function StaffAccessScreen({ onClose }: StaffAccessScreenProps) {
  const language = useStore((s) => s.language) as Language;
  const userId = useStore((s) => s.user?.id);
  const { businessId } = useBusiness();
  const { isDark, colors, primaryColor } = useTheme();
  const { showSuccess } = useToast();

  // PERF AUDIT: Track timing from screen open
  const hasLoggedFirstRender = useRef(false);
  const hasLoggedDataRender = useRef(false);

  // Mark screen open on mount
  useEffect(() => {
    markStaffAccessScreenOpen();
    logPerfAudit('COMPONENT_MOUNTED');
  }, []);

  // Form state
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState<InviteRole>('staff');
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);
  const [allStoresSelected, setAllStoresSelected] = useState(true);

  // Data hooks - single optimized RPC call
  const { data: staffAccessData, isLoading: isLoadingStaffData, isFetching } = useStaffAccessData();

  // PERF FIX: Only show skeleton if BOTH loading AND no data exists
  // This ensures warm opens with cached data render instantly
  const showSkeleton = isLoadingStaffData && !staffAccessData;

  // Extract data immediately - renders cached data on first frame
  const pendingInvites = staffAccessData?.pending_invites ?? [];
  const members = staffAccessData?.team_members ?? [];

  // PERF AUDIT: Log performance summary (non-blocking)
  useEffect(() => {
    if (staffAccessData && !hasLoggedDataRender.current) {
      hasLoggedDataRender.current = true;
      const rpcCallCount = getStaffAccessRpcCallCount();
      const tapToRender = performance.now() - __screenOpenTimestamp;
      console.log('\n========================================');
      console.log('[STAFF_ACCESS_TIMING] PERFORMANCE SUMMARY');
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

  // Validate email
  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  };

  // Handle send invite
  const handleSendInvite = useCallback(async () => {
    if (!inviteEmail.trim()) {
      Alert.alert(t('invalidEmail', language));
      return;
    }
    if (!isValidEmail(inviteEmail)) {
      Alert.alert(t('invalidEmail', language));
      return;
    }
    if (!userId) return;

    try {
      await createInviteMutation.mutateAsync({
        email: inviteEmail.trim(),
        role: selectedRole,
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
  }, [inviteEmail, selectedRole, allStoresSelected, selectedStoreIds, userId, language, createInviteMutation, showSuccess]);

  // Handle cancel invite
  const handleCancelInvite = useCallback(async (inviteId: string) => {
    Alert.alert(
      t('cancelInvite', language),
      '',
      [
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
      ]
    );
  }, [language, cancelInviteMutation, showSuccess]);

  // Handle resend invite
  const handleResendInvite = useCallback(async (inviteId: string) => {
    try {
      await resendInviteMutation.mutateAsync(inviteId);
      showSuccess(t('inviteResent', language));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      Alert.alert('Failed to resend invite');
    }
  }, [language, resendInviteMutation, showSuccess]);

  // Handle remove member - with owner protection
  const handleRemoveMember = useCallback(async (memberId: string) => {
    // Find the member to check if they're an owner
    const memberToRemove = members.find(m => m.id === memberId);

    // Block removal of owners at the action level
    if (memberToRemove?.role === 'owner') {
      Alert.alert(
        t('cannotRemoveOwner', language) || 'Cannot Remove Owner',
        t('ownerCannotBeRemoved', language) || 'The business owner cannot be removed from the team.'
      );
      return;
    }

    Alert.alert(
      t('removeMember', language),
      '',
      [
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
      ]
    );
  }, [language, removeMemberMutation, showSuccess, members]);

  // Get role display info
  const getRoleInfo = (role: string) => {
    switch (role) {
      case 'owner':
        return { label: t('ownerRole', language), icon: Crown, color: '#F59E0B' };
      case 'manager':
        return { label: t('managerRole', language), icon: UserCog, color: '#3B82F6' };
      default:
        return { label: t('staffMemberRole', language), icon: User, color: '#10B981' };
    }
  };

  // Format expiry date
  const formatExpiry = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days <= 0) return 'Expired';
    if (days === 1) return '1 day';
    return `${days} days`;
  };

  // Get member display name - prioritizes: name > email > shortened user_id
  const getMemberDisplayName = (member: typeof members[0], isCurrentUser: boolean) => {
    if (isCurrentUser) {
      // Show name with "(You)" suffix if available
      if (member.user_name) return `${member.user_name} (You)`;
      if (member.user_email) return `${member.user_email} (You)`;
      return 'You';
    }
    // For other users, show best available identity
    if (member.user_name) return member.user_name;
    if (member.user_email) return member.user_email;
    return `User ${member.user_id?.slice(0, 8) ?? 'Unknown'}...`;
  };

  // Skeleton placeholder component for loading states
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
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: isDark ? '#374151' : '#E5E7EB',
        }}
      />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <View
          style={{
            width: `${widthPercent}%` as `${number}%`,
            height: 14,
            borderRadius: 4,
            backgroundColor: isDark ? '#374151' : '#E5E7EB',
            marginBottom: 6,
          }}
        />
        <View
          style={{
            width: '40%',
            height: 10,
            borderRadius: 4,
            backgroundColor: isDark ? '#374151' : '#E5E7EB',
          }}
        />
      </View>
    </View>
  );

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
            {t('staffAccess', language)}
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

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Invite Button - PERF AUDIT: Animation disabled */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
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

        {/* Invite Form - PERF AUDIT: Animation disabled */}
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
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    marginLeft: 10,
                    color: colors.text,
                    fontSize: 15,
                  }}
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
                {ROLES.map((role) => {
                  const isSelected = selectedRole === role.key;
                  const RoleIcon = role.icon;
                  const roleInfo = getRoleInfo(role.key);
                  return (
                    <Pressable
                      key={role.key}
                      onPress={() => {
                        feedbackToggle();
                        setSelectedRole(role.key);
                      }}
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
                      <Text
                        style={{
                          marginLeft: 8,
                          fontWeight: '500',
                          color: isSelected ? role.color : colors.textSecondary,
                        }}
                      >
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
                  <Text
                    style={{
                      flex: 1,
                      marginLeft: 10,
                      color: allStoresSelected ? primaryColor : colors.text,
                      fontWeight: '500',
                    }}
                  >
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

        {/* Pending Invites - PERF FIX: Only skeleton if no cached data */}
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
            <View
              style={{
                backgroundColor: colors.card,
                borderRadius: 12,
                padding: 20,
                alignItems: 'center',
              }}
            >
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
                    <Pressable
                      onPress={() => handleResendInvite(invite.id)}
                      style={{ padding: 8, marginRight: 4 }}
                    >
                      <RefreshCw size={18} color={colors.textSecondary} />
                    </Pressable>
                    <Pressable
                      onPress={() => handleCancelInvite(invite.id)}
                      style={{ padding: 8 }}
                    >
                      <Trash2 size={18} color="#EF4444" />
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Team Members - PERF FIX: Only skeleton if no cached data */}
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
            <View
              style={{
                backgroundColor: colors.card,
                borderRadius: 12,
                padding: 20,
                alignItems: 'center',
              }}
            >
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
                      <Pressable
                        onPress={() => handleRemoveMember(member.id)}
                        style={{ padding: 8 }}
                      >
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
    </SafeAreaView>
  );
}
