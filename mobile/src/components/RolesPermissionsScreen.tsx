import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  X,
  Shield,
  Crown,
  Users,
  UserCog,
  Calendar,
  Store,
  Briefcase,
  Mail,
  Tag,
  BarChart3,
  Settings,
  CreditCard,
  Info,
  RotateCcw,
  Check,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/lib/ThemeContext';
import { useToast } from '@/lib/ToastContext';
import { useStore } from '@/lib/store';
import { useBusiness } from '@/hooks/useBusiness';
import { t } from '@/lib/i18n';
import { Language } from '@/lib/types';
import { feedbackToggle } from '@/lib/SoundManager';
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

interface RolesPermissionsScreenProps {
  onClose: () => void;
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

export function RolesPermissionsScreen({ onClose }: RolesPermissionsScreenProps) {
  const language = useStore((s) => s.language) as Language;
  const userId = useStore((s) => s.user?.id);
  const { businessId } = useBusiness();
  const { isDark, colors, primaryColor } = useTheme();
  const { showSuccess } = useToast();

  // Selected role tab
  const [selectedRole, setSelectedRole] = useState<'manager' | 'staff'>('manager');

  // Permission states
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

  // Get current permissions based on selected role
  const currentPermissions = selectedRole === 'manager' ? managerPermissions : staffPermissions;
  const setCurrentPermissions = selectedRole === 'manager' ? setManagerPermissions : setStaffPermissions;

  // Toggle a permission
  const togglePermission = useCallback((permission: Permission) => {
    feedbackToggle();
    setCurrentPermissions(prev => {
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

  // Save permissions
  const handleSave = useCallback(async () => {
    if (!businessId) return;

    setIsSaving(true);
    try {
      // Save both roles
      updateRolePermissions(businessId, 'manager', Array.from(managerPermissions));
      updateRolePermissions(businessId, 'staff', Array.from(staffPermissions));

      // Log audit summary for shadow mode
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

  // Reset to defaults
  const handleResetToDefaults = useCallback(() => {
    feedbackToggle();
    if (selectedRole === 'manager') {
      setManagerPermissions(new Set(getDefaultPermissionsForRole(ROLES.MANAGER)));
    } else {
      setStaffPermissions(new Set(getDefaultPermissionsForRole(ROLES.STAFF)));
    }
    setHasChanges(true);
    showSuccess(t('permissionsReset', language));
  }, [selectedRole, language, showSuccess]);

  // Group permissions by category
  const groupedPermissions = useMemo(() => {
    const groups: { category: PermissionCategory; permissions: typeof PERMISSION_METADATA }[] = [];

    CATEGORY_METADATA
      .filter(cat => cat.key !== PERMISSION_CATEGORIES.BILLING) // Exclude billing (owner-only)
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .forEach(cat => {
        const perms = getPermissionsForCategory(cat.key).filter(p => !p.isOwnerOnly);
        if (perms.length > 0) {
          groups.push({ category: cat.key, permissions: perms });
        }
      });

    return groups;
  }, []);

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
          <Shield size={22} color={primaryColor} />
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: '600', marginLeft: 10 }}>
            {t('rolesAndPermissions', language)}
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

        {/* Role Tabs */}
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
            onPress={() => {
              setSelectedRole('manager');
              feedbackToggle();
            }}
            style={{
              flex: 1,
              paddingVertical: 12,
              borderRadius: 10,
              backgroundColor: selectedRole === 'manager' ? primaryColor : 'transparent',
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                color: selectedRole === 'manager' ? '#FFFFFF' : colors.textSecondary,
                fontWeight: '600',
                fontSize: 15,
              }}
            >
              {t('manager', language)}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setSelectedRole('staff');
              feedbackToggle();
            }}
            style={{
              flex: 1,
              paddingVertical: 12,
              borderRadius: 10,
              backgroundColor: selectedRole === 'staff' ? primaryColor : 'transparent',
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                color: selectedRole === 'staff' ? '#FFFFFF' : colors.textSecondary,
                fontWeight: '600',
                fontSize: 15,
              }}
            >
              {t('staffRole', language)}
            </Text>
          </Pressable>
        </Animated.View>

        {/* Role Description */}
        <Animated.View
          entering={FadeInDown.delay(250).duration(400)}
          style={{
            marginHorizontal: 16,
            marginTop: 12,
            paddingHorizontal: 4,
          }}
        >
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
            {selectedRole === 'manager'
              ? t('managerDescription', language)
              : t('staffRoleDescription', language)}
          </Text>
        </Animated.View>

        {/* Permission Categories */}
        {groupedPermissions.map(({ category, permissions }, groupIndex) => {
          const categoryMeta = CATEGORY_METADATA.find(c => c.key === category);
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
              {/* Category Header */}
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

              {/* Permission Items */}
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
          style={{
            marginHorizontal: 16,
            marginTop: 24,
          }}
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
                <Text
                  style={{
                    color: hasChanges ? '#FFFFFF' : colors.textTertiary,
                    fontWeight: '700',
                    fontSize: 16,
                    marginLeft: 8,
                  }}
                >
                  {t('savePermissions', language)}
                </Text>
              </>
            )}
          </Pressable>
        </Animated.View>

        {/* Reset to Defaults Button */}
        <Animated.View
          entering={FadeInDown.delay(650).duration(400)}
          style={{
            marginHorizontal: 16,
            marginTop: 12,
            marginBottom: 32,
          }}
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
    </SafeAreaView>
  );
}
