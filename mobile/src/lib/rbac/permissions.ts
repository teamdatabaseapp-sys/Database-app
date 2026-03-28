/**
 * RBAC Permission Constants and Types
 * Enterprise Role-Based Access Control System
 *
 * SHADOW MODE: UI enforcement only, no backend blocking yet
 *
 * Roles:
 * - OWNER: Full access, non-removable system powers (billing/ownership)
 * - MANAGER: Configurable permissions by owner
 * - STAFF: Configurable permissions by owner (more restricted defaults)
 *
 * Philosophy:
 * - All roles can VIEW everything
 * - Only ACTIONS are restricted by permission toggles
 */

// ============================================
// Role Definitions
// ============================================

export const ROLES = {
  OWNER: 'owner',
  MANAGER: 'manager',
  STAFF: 'staff',
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];

// ============================================
// Permission Categories
// ============================================

export const PERMISSION_CATEGORIES = {
  CLIENTS: 'clients',
  APPOINTMENTS: 'appointments',
  STAFF_MANAGEMENT: 'staff_management',
  STORES: 'stores',
  SERVICES: 'services',
  CAMPAIGNS: 'campaigns',
  PROMOTIONS: 'promotions',
  ANALYTICS: 'analytics',
  SETTINGS: 'settings',
  BILLING: 'billing', // Owner-only, non-configurable
} as const;

export type PermissionCategory = typeof PERMISSION_CATEGORIES[keyof typeof PERMISSION_CATEGORIES];

// ============================================
// Individual Permissions
// ============================================

export const PERMISSIONS = {
  // Client Management
  CLIENTS_CREATE: 'clients.create',
  CLIENTS_EDIT: 'clients.edit',
  CLIENTS_DELETE: 'clients.delete',
  CLIENTS_ARCHIVE: 'clients.archive',
  CLIENTS_EXPORT: 'clients.export',
  CLIENTS_SEND_EMAIL: 'clients.send_email',

  // Appointment Management
  APPOINTMENTS_CREATE: 'appointments.create',
  APPOINTMENTS_EDIT: 'appointments.edit',
  APPOINTMENTS_DELETE: 'appointments.delete',
  APPOINTMENTS_CANCEL: 'appointments.cancel',

  // Staff Management
  STAFF_CREATE: 'staff_management.create',
  STAFF_EDIT: 'staff_management.edit',
  STAFF_DELETE: 'staff_management.delete',
  STAFF_ASSIGN_STORES: 'staff_management.assign_stores',
  STAFF_MANAGE_SCHEDULE: 'staff_management.manage_schedule',

  // Store Management
  STORES_CREATE: 'stores.create',
  STORES_EDIT: 'stores.edit',
  STORES_DELETE: 'stores.delete',
  STORES_MANAGE_HOURS: 'stores.manage_hours',

  // Services Management
  SERVICES_CREATE: 'services.create',
  SERVICES_EDIT: 'services.edit',
  SERVICES_DELETE: 'services.delete',

  // Campaign Management
  CAMPAIGNS_CREATE: 'campaigns.create',
  CAMPAIGNS_EDIT: 'campaigns.edit',
  CAMPAIGNS_DELETE: 'campaigns.delete',
  CAMPAIGNS_ACTIVATE: 'campaigns.activate',
  CAMPAIGNS_SEND: 'campaigns.send',

  // Promotions Management
  PROMOTIONS_CREATE: 'promotions.create',
  PROMOTIONS_EDIT: 'promotions.edit',
  PROMOTIONS_DELETE: 'promotions.delete',
  PROMOTIONS_ACTIVATE: 'promotions.activate',

  // Analytics
  ANALYTICS_VIEW_REVENUE: 'analytics.view_revenue',
  ANALYTICS_EXPORT: 'analytics.export',

  // Settings
  SETTINGS_BUSINESS_INFO: 'settings.business_info',
  SETTINGS_THEME: 'settings.theme',
  SETTINGS_BOOKING_PAGE: 'settings.booking_page',
  SETTINGS_ROLES_PERMISSIONS: 'settings.roles_permissions', // Owner-only

  // Billing (Owner-only, non-configurable)
  BILLING_VIEW: 'billing.view',
  BILLING_MANAGE: 'billing.manage',
  BILLING_CANCEL_SUBSCRIPTION: 'billing.cancel_subscription',
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

// ============================================
// Permission Metadata for UI
// ============================================

export interface PermissionMeta {
  key: Permission;
  category: PermissionCategory;
  translationKey: string;
  descriptionKey: string;
  isOwnerOnly: boolean;
  defaultManager: boolean;
  defaultStaff: boolean;
}

export const PERMISSION_METADATA: PermissionMeta[] = [
  // Client Management
  {
    key: PERMISSIONS.CLIENTS_CREATE,
    category: PERMISSION_CATEGORIES.CLIENTS,
    translationKey: 'rbacPermissionClientsCreate',
    descriptionKey: 'rbacPermissionClientsCreateDesc',
    isOwnerOnly: false,
    defaultManager: true,
    defaultStaff: true,
  },
  {
    key: PERMISSIONS.CLIENTS_EDIT,
    category: PERMISSION_CATEGORIES.CLIENTS,
    translationKey: 'rbacPermissionClientsEdit',
    descriptionKey: 'rbacPermissionClientsEditDesc',
    isOwnerOnly: false,
    defaultManager: true,
    defaultStaff: true,
  },
  {
    key: PERMISSIONS.CLIENTS_DELETE,
    category: PERMISSION_CATEGORIES.CLIENTS,
    translationKey: 'rbacPermissionClientsDelete',
    descriptionKey: 'rbacPermissionClientsDeleteDesc',
    isOwnerOnly: false,
    defaultManager: true,
    defaultStaff: false,
  },
  {
    key: PERMISSIONS.CLIENTS_ARCHIVE,
    category: PERMISSION_CATEGORIES.CLIENTS,
    translationKey: 'rbacPermissionClientsArchive',
    descriptionKey: 'rbacPermissionClientsArchiveDesc',
    isOwnerOnly: false,
    defaultManager: true,
    defaultStaff: true,
  },
  {
    key: PERMISSIONS.CLIENTS_EXPORT,
    category: PERMISSION_CATEGORIES.CLIENTS,
    translationKey: 'rbacPermissionClientsExport',
    descriptionKey: 'rbacPermissionClientsExportDesc',
    isOwnerOnly: false,
    defaultManager: true,
    defaultStaff: false,
  },
  {
    key: PERMISSIONS.CLIENTS_SEND_EMAIL,
    category: PERMISSION_CATEGORIES.CLIENTS,
    translationKey: 'rbacPermissionClientsSendEmail',
    descriptionKey: 'rbacPermissionClientsSendEmailDesc',
    isOwnerOnly: false,
    defaultManager: true,
    defaultStaff: false,
  },

  // Appointment Management
  {
    key: PERMISSIONS.APPOINTMENTS_CREATE,
    category: PERMISSION_CATEGORIES.APPOINTMENTS,
    translationKey: 'rbacPermissionAppointmentsCreate',
    descriptionKey: 'rbacPermissionAppointmentsCreateDesc',
    isOwnerOnly: false,
    defaultManager: true,
    defaultStaff: true,
  },
  {
    key: PERMISSIONS.APPOINTMENTS_EDIT,
    category: PERMISSION_CATEGORIES.APPOINTMENTS,
    translationKey: 'rbacPermissionAppointmentsEdit',
    descriptionKey: 'rbacPermissionAppointmentsEditDesc',
    isOwnerOnly: false,
    defaultManager: true,
    defaultStaff: true,
  },
  {
    key: PERMISSIONS.APPOINTMENTS_DELETE,
    category: PERMISSION_CATEGORIES.APPOINTMENTS,
    translationKey: 'rbacPermissionAppointmentsDelete',
    descriptionKey: 'rbacPermissionAppointmentsDeleteDesc',
    isOwnerOnly: false,
    defaultManager: true,
    defaultStaff: false,
  },
  {
    key: PERMISSIONS.APPOINTMENTS_CANCEL,
    category: PERMISSION_CATEGORIES.APPOINTMENTS,
    translationKey: 'rbacPermissionAppointmentsCancel',
    descriptionKey: 'rbacPermissionAppointmentsCancelDesc',
    isOwnerOnly: false,
    defaultManager: true,
    defaultStaff: true,
  },

  // Staff Management
  {
    key: PERMISSIONS.STAFF_CREATE,
    category: PERMISSION_CATEGORIES.STAFF_MANAGEMENT,
    translationKey: 'rbacPermissionStaffCreate',
    descriptionKey: 'rbacPermissionStaffCreateDesc',
    isOwnerOnly: false,
    defaultManager: true,
    defaultStaff: false,
  },
  {
    key: PERMISSIONS.STAFF_EDIT,
    category: PERMISSION_CATEGORIES.STAFF_MANAGEMENT,
    translationKey: 'rbacPermissionStaffEdit',
    descriptionKey: 'rbacPermissionStaffEditDesc',
    isOwnerOnly: false,
    defaultManager: true,
    defaultStaff: false,
  },
  {
    key: PERMISSIONS.STAFF_DELETE,
    category: PERMISSION_CATEGORIES.STAFF_MANAGEMENT,
    translationKey: 'rbacPermissionStaffDelete',
    descriptionKey: 'rbacPermissionStaffDeleteDesc',
    isOwnerOnly: false,
    defaultManager: false,
    defaultStaff: false,
  },
  {
    key: PERMISSIONS.STAFF_ASSIGN_STORES,
    category: PERMISSION_CATEGORIES.STAFF_MANAGEMENT,
    translationKey: 'rbacPermissionStaffAssignStores',
    descriptionKey: 'rbacPermissionStaffAssignStoresDesc',
    isOwnerOnly: false,
    defaultManager: true,
    defaultStaff: false,
  },
  {
    key: PERMISSIONS.STAFF_MANAGE_SCHEDULE,
    category: PERMISSION_CATEGORIES.STAFF_MANAGEMENT,
    translationKey: 'rbacPermissionStaffManageSchedule',
    descriptionKey: 'rbacPermissionStaffManageScheduleDesc',
    isOwnerOnly: false,
    defaultManager: true,
    defaultStaff: false,
  },

  // Store Management
  {
    key: PERMISSIONS.STORES_CREATE,
    category: PERMISSION_CATEGORIES.STORES,
    translationKey: 'rbacPermissionStoresCreate',
    descriptionKey: 'rbacPermissionStoresCreateDesc',
    isOwnerOnly: false,
    defaultManager: false,
    defaultStaff: false,
  },
  {
    key: PERMISSIONS.STORES_EDIT,
    category: PERMISSION_CATEGORIES.STORES,
    translationKey: 'rbacPermissionStoresEdit',
    descriptionKey: 'rbacPermissionStoresEditDesc',
    isOwnerOnly: false,
    defaultManager: true,
    defaultStaff: false,
  },
  {
    key: PERMISSIONS.STORES_DELETE,
    category: PERMISSION_CATEGORIES.STORES,
    translationKey: 'rbacPermissionStoresDelete',
    descriptionKey: 'rbacPermissionStoresDeleteDesc',
    isOwnerOnly: false,
    defaultManager: false,
    defaultStaff: false,
  },
  {
    key: PERMISSIONS.STORES_MANAGE_HOURS,
    category: PERMISSION_CATEGORIES.STORES,
    translationKey: 'rbacPermissionStoresManageHours',
    descriptionKey: 'rbacPermissionStoresManageHoursDesc',
    isOwnerOnly: false,
    defaultManager: true,
    defaultStaff: false,
  },

  // Services Management
  {
    key: PERMISSIONS.SERVICES_CREATE,
    category: PERMISSION_CATEGORIES.SERVICES,
    translationKey: 'rbacPermissionServicesCreate',
    descriptionKey: 'rbacPermissionServicesCreateDesc',
    isOwnerOnly: false,
    defaultManager: true,
    defaultStaff: false,
  },
  {
    key: PERMISSIONS.SERVICES_EDIT,
    category: PERMISSION_CATEGORIES.SERVICES,
    translationKey: 'rbacPermissionServicesEdit',
    descriptionKey: 'rbacPermissionServicesEditDesc',
    isOwnerOnly: false,
    defaultManager: true,
    defaultStaff: false,
  },
  {
    key: PERMISSIONS.SERVICES_DELETE,
    category: PERMISSION_CATEGORIES.SERVICES,
    translationKey: 'rbacPermissionServicesDelete',
    descriptionKey: 'rbacPermissionServicesDeleteDesc',
    isOwnerOnly: false,
    defaultManager: false,
    defaultStaff: false,
  },

  // Campaign Management
  {
    key: PERMISSIONS.CAMPAIGNS_CREATE,
    category: PERMISSION_CATEGORIES.CAMPAIGNS,
    translationKey: 'rbacPermissionCampaignsCreate',
    descriptionKey: 'rbacPermissionCampaignsCreateDesc',
    isOwnerOnly: false,
    defaultManager: true,
    defaultStaff: false,
  },
  {
    key: PERMISSIONS.CAMPAIGNS_EDIT,
    category: PERMISSION_CATEGORIES.CAMPAIGNS,
    translationKey: 'rbacPermissionCampaignsEdit',
    descriptionKey: 'rbacPermissionCampaignsEditDesc',
    isOwnerOnly: false,
    defaultManager: true,
    defaultStaff: false,
  },
  {
    key: PERMISSIONS.CAMPAIGNS_DELETE,
    category: PERMISSION_CATEGORIES.CAMPAIGNS,
    translationKey: 'rbacPermissionCampaignsDelete',
    descriptionKey: 'rbacPermissionCampaignsDeleteDesc',
    isOwnerOnly: false,
    defaultManager: false,
    defaultStaff: false,
  },
  {
    key: PERMISSIONS.CAMPAIGNS_ACTIVATE,
    category: PERMISSION_CATEGORIES.CAMPAIGNS,
    translationKey: 'rbacPermissionCampaignsActivate',
    descriptionKey: 'rbacPermissionCampaignsActivateDesc',
    isOwnerOnly: false,
    defaultManager: true,
    defaultStaff: false,
  },
  {
    key: PERMISSIONS.CAMPAIGNS_SEND,
    category: PERMISSION_CATEGORIES.CAMPAIGNS,
    translationKey: 'rbacPermissionCampaignsSend',
    descriptionKey: 'rbacPermissionCampaignsSendDesc',
    isOwnerOnly: false,
    defaultManager: true,
    defaultStaff: false,
  },

  // Promotions Management
  {
    key: PERMISSIONS.PROMOTIONS_CREATE,
    category: PERMISSION_CATEGORIES.PROMOTIONS,
    translationKey: 'rbacPermissionPromotionsCreate',
    descriptionKey: 'rbacPermissionPromotionsCreateDesc',
    isOwnerOnly: false,
    defaultManager: true,
    defaultStaff: false,
  },
  {
    key: PERMISSIONS.PROMOTIONS_EDIT,
    category: PERMISSION_CATEGORIES.PROMOTIONS,
    translationKey: 'rbacPermissionPromotionsEdit',
    descriptionKey: 'rbacPermissionPromotionsEditDesc',
    isOwnerOnly: false,
    defaultManager: true,
    defaultStaff: false,
  },
  {
    key: PERMISSIONS.PROMOTIONS_DELETE,
    category: PERMISSION_CATEGORIES.PROMOTIONS,
    translationKey: 'rbacPermissionPromotionsDelete',
    descriptionKey: 'rbacPermissionPromotionsDeleteDesc',
    isOwnerOnly: false,
    defaultManager: false,
    defaultStaff: false,
  },
  {
    key: PERMISSIONS.PROMOTIONS_ACTIVATE,
    category: PERMISSION_CATEGORIES.PROMOTIONS,
    translationKey: 'rbacPermissionPromotionsActivate',
    descriptionKey: 'rbacPermissionPromotionsActivateDesc',
    isOwnerOnly: false,
    defaultManager: true,
    defaultStaff: false,
  },

  // Analytics
  {
    key: PERMISSIONS.ANALYTICS_VIEW_REVENUE,
    category: PERMISSION_CATEGORIES.ANALYTICS,
    translationKey: 'rbacPermissionAnalyticsViewRevenue',
    descriptionKey: 'rbacPermissionAnalyticsViewRevenueDesc',
    isOwnerOnly: false,
    defaultManager: true,
    defaultStaff: false,
  },
  {
    key: PERMISSIONS.ANALYTICS_EXPORT,
    category: PERMISSION_CATEGORIES.ANALYTICS,
    translationKey: 'rbacPermissionAnalyticsExport',
    descriptionKey: 'rbacPermissionAnalyticsExportDesc',
    isOwnerOnly: false,
    defaultManager: true,
    defaultStaff: false,
  },

  // Settings
  {
    key: PERMISSIONS.SETTINGS_BUSINESS_INFO,
    category: PERMISSION_CATEGORIES.SETTINGS,
    translationKey: 'rbacPermissionSettingsBusinessInfo',
    descriptionKey: 'rbacPermissionSettingsBusinessInfoDesc',
    isOwnerOnly: false,
    defaultManager: false,
    defaultStaff: false,
  },
  {
    key: PERMISSIONS.SETTINGS_THEME,
    category: PERMISSION_CATEGORIES.SETTINGS,
    translationKey: 'rbacPermissionSettingsTheme',
    descriptionKey: 'rbacPermissionSettingsThemeDesc',
    isOwnerOnly: false,
    defaultManager: true,
    defaultStaff: false,
  },
  {
    key: PERMISSIONS.SETTINGS_BOOKING_PAGE,
    category: PERMISSION_CATEGORIES.SETTINGS,
    translationKey: 'rbacPermissionSettingsBookingPage',
    descriptionKey: 'rbacPermissionSettingsBookingPageDesc',
    isOwnerOnly: false,
    defaultManager: true,
    defaultStaff: false,
  },
  {
    key: PERMISSIONS.SETTINGS_ROLES_PERMISSIONS,
    category: PERMISSION_CATEGORIES.SETTINGS,
    translationKey: 'rbacPermissionSettingsRolesPermissions',
    descriptionKey: 'rbacPermissionSettingsRolesPermissionsDesc',
    isOwnerOnly: true,
    defaultManager: false,
    defaultStaff: false,
  },

  // Billing (Owner-only)
  {
    key: PERMISSIONS.BILLING_VIEW,
    category: PERMISSION_CATEGORIES.BILLING,
    translationKey: 'rbacPermissionBillingView',
    descriptionKey: 'rbacPermissionBillingViewDesc',
    isOwnerOnly: true,
    defaultManager: false,
    defaultStaff: false,
  },
  {
    key: PERMISSIONS.BILLING_MANAGE,
    category: PERMISSION_CATEGORIES.BILLING,
    translationKey: 'rbacPermissionBillingManage',
    descriptionKey: 'rbacPermissionBillingManageDesc',
    isOwnerOnly: true,
    defaultManager: false,
    defaultStaff: false,
  },
  {
    key: PERMISSIONS.BILLING_CANCEL_SUBSCRIPTION,
    category: PERMISSION_CATEGORIES.BILLING,
    translationKey: 'rbacPermissionBillingCancelSubscription',
    descriptionKey: 'rbacPermissionBillingCancelSubscriptionDesc',
    isOwnerOnly: true,
    defaultManager: false,
    defaultStaff: false,
  },
];

// ============================================
// Category Metadata for UI Grouping
// ============================================

export interface CategoryMeta {
  key: PermissionCategory;
  translationKey: string;
  iconName: string;
  displayOrder: number;
}

export const CATEGORY_METADATA: CategoryMeta[] = [
  {
    key: PERMISSION_CATEGORIES.CLIENTS,
    translationKey: 'rbacCategoryClients',
    iconName: 'Users',
    displayOrder: 1,
  },
  {
    key: PERMISSION_CATEGORIES.APPOINTMENTS,
    translationKey: 'rbacCategoryAppointments',
    iconName: 'Calendar',
    displayOrder: 2,
  },
  {
    key: PERMISSION_CATEGORIES.STAFF_MANAGEMENT,
    translationKey: 'rbacCategoryStaffManagement',
    iconName: 'UserCog',
    displayOrder: 3,
  },
  {
    key: PERMISSION_CATEGORIES.STORES,
    translationKey: 'rbacCategoryStores',
    iconName: 'Store',
    displayOrder: 4,
  },
  {
    key: PERMISSION_CATEGORIES.SERVICES,
    translationKey: 'rbacCategoryServices',
    iconName: 'Briefcase',
    displayOrder: 5,
  },
  {
    key: PERMISSION_CATEGORIES.CAMPAIGNS,
    translationKey: 'rbacCategoryCampaigns',
    iconName: 'Mail',
    displayOrder: 6,
  },
  {
    key: PERMISSION_CATEGORIES.PROMOTIONS,
    translationKey: 'rbacCategoryPromotions',
    iconName: 'Tag',
    displayOrder: 7,
  },
  {
    key: PERMISSION_CATEGORIES.ANALYTICS,
    translationKey: 'rbacCategoryAnalytics',
    iconName: 'BarChart3',
    displayOrder: 8,
  },
  {
    key: PERMISSION_CATEGORIES.SETTINGS,
    translationKey: 'rbacCategorySettings',
    iconName: 'Settings',
    displayOrder: 9,
  },
  {
    key: PERMISSION_CATEGORIES.BILLING,
    translationKey: 'rbacCategoryBilling',
    iconName: 'CreditCard',
    displayOrder: 10,
  },
];

// ============================================
// Helper Functions
// ============================================

/**
 * Get permissions for a category
 */
export function getPermissionsForCategory(category: PermissionCategory): PermissionMeta[] {
  return PERMISSION_METADATA.filter(p => p.category === category);
}

/**
 * Get configurable permissions (non-owner-only)
 */
export function getConfigurablePermissions(): PermissionMeta[] {
  return PERMISSION_METADATA.filter(p => !p.isOwnerOnly);
}

/**
 * Get owner-only permissions
 */
export function getOwnerOnlyPermissions(): PermissionMeta[] {
  return PERMISSION_METADATA.filter(p => p.isOwnerOnly);
}

/**
 * Get default permissions for a role
 */
export function getDefaultPermissionsForRole(role: Role): Permission[] {
  if (role === ROLES.OWNER) {
    // Owner has ALL permissions
    return PERMISSION_METADATA.map(p => p.key);
  }

  if (role === ROLES.MANAGER) {
    return PERMISSION_METADATA
      .filter(p => p.defaultManager && !p.isOwnerOnly)
      .map(p => p.key);
  }

  if (role === ROLES.STAFF) {
    return PERMISSION_METADATA
      .filter(p => p.defaultStaff && !p.isOwnerOnly)
      .map(p => p.key);
  }

  return [];
}

/**
 * Check if a permission is configurable for a role
 */
export function isPermissionConfigurableForRole(permission: Permission, role: Role): boolean {
  if (role === ROLES.OWNER) {
    return false; // Owner permissions are not configurable
  }

  const meta = PERMISSION_METADATA.find(p => p.key === permission);
  return meta ? !meta.isOwnerOnly : false;
}

/**
 * Get category metadata by key
 */
export function getCategoryMeta(category: PermissionCategory): CategoryMeta | undefined {
  return CATEGORY_METADATA.find(c => c.key === category);
}

/**
 * Get permission metadata by key
 */
export function getPermissionMeta(permission: Permission): PermissionMeta | undefined {
  return PERMISSION_METADATA.find(p => p.key === permission);
}
