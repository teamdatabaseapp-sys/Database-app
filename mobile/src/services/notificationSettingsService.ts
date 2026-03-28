/**
 * Notification Settings Service
 *
 * Reads and writes per-business notification settings for transactional emails.
 * Table: business_notification_settings
 */

const getBackendUrl = (): string => {
  return (
    process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL ||
    process.env.EXPO_PUBLIC_BACKEND_URL ||
    'http://localhost:3000'
  );
};

export interface NotificationSettings {
  loyalty_points_earned: boolean;
  loyalty_points_redeemed: boolean;
  gift_card_issued: boolean;
  gift_card_redeemed: boolean;
  promotion_applied: boolean;
  promotion_counter_reward: boolean;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  loyalty_points_earned: true,
  loyalty_points_redeemed: true,
  gift_card_issued: true,
  gift_card_redeemed: true,
  promotion_applied: true,
  promotion_counter_reward: true,
};

export async function getNotificationSettings(
  businessId: string
): Promise<NotificationSettings> {
  try {
    const res = await fetch(`${getBackendUrl()}/api/transactional/settings/${businessId}`);
    if (!res.ok) return DEFAULT_NOTIFICATION_SETTINGS;
    const json = await res.json() as { success: boolean; data?: NotificationSettings };
    return json.data ?? DEFAULT_NOTIFICATION_SETTINGS;
  } catch {
    return DEFAULT_NOTIFICATION_SETTINGS;
  }
}

export async function updateNotificationSettings(
  businessId: string,
  updates: Partial<NotificationSettings>
): Promise<NotificationSettings> {
  try {
    const res = await fetch(`${getBackendUrl()}/api/transactional/settings/${businessId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) return DEFAULT_NOTIFICATION_SETTINGS;
    const json = await res.json() as { success: boolean; data?: NotificationSettings };
    return json.data ?? DEFAULT_NOTIFICATION_SETTINGS;
  } catch {
    return DEFAULT_NOTIFICATION_SETTINGS;
  }
}
