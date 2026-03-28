/**
 * useClientMigration
 *
 * One-time migration that syncs local Zustand clients to Supabase.
 *
 * BACKGROUND:
 *   Older versions of the app stored clients exclusively in the Zustand store
 *   (local-first, persisted via AsyncStorage).  After the Supabase migration,
 *   new client creation writes directly to the database, but pre-existing
 *   local clients were never synced.  This hook detects that state and
 *   performs a single, idempotent migration.
 *
 * GUARANTEES:
 *   - Runs at most ONCE per business (keyed by business_id in AsyncStorage).
 *   - Skips gracefully if Supabase already has clients (safe on reinstall).
 *   - Skips if the local store has nothing to migrate.
 *   - Duplicate emails/phones are handled by the createClient service (not errors).
 *   - Invalidates the React Query client list cache after a successful run so
 *     every consumer (BulkEmailModal, ClientListScreen, etc.) refreshes.
 *   - Non-blocking: runs fully in the background; never throws to the caller.
 */

import { useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import { useBusiness } from '@/hooks/useBusiness';
import { clientKeys } from '@/hooks/useClients';
import { createClient, getClientCounts } from '@/services/clientsService';
import { useStore } from '@/lib/store';

const MIGRATION_FLAG_PREFIX = 'clients_supabase_migration_v1';

export function useClientMigration() {
  const { businessId, isInitialized } = useBusiness();
  const user = useStore((s) => s.user);
  const storeClients = useStore((s) => s.clients);
  const queryClient = useQueryClient();

  // Prevent double-execution within the same session (React strict-mode safe)
  const hasStartedRef = useRef(false);

  useEffect(() => {
    if (!isInitialized || !businessId || !user?.id || hasStartedRef.current) return;
    hasStartedRef.current = true;

    const run = async () => {
      const flag = `${MIGRATION_FLAG_PREFIX}_${businessId}`;

      try {
        // ── 1. Skip if already migrated ─────────────────────────────────────
        const alreadyDone = await AsyncStorage.getItem(flag);
        if (alreadyDone === 'true') return;

        // ── 2. Collect local clients scoped to this user ─────────────────────
        const localClients = storeClients.filter(
          (c) => c.userId === user.id && !c.isArchived
        );

        if (localClients.length === 0) {
          // Nothing to migrate — still mark done so we never re-check
          console.log('[ClientMigration] No local clients to migrate for business:', businessId);
          await AsyncStorage.setItem(flag, 'true');
          return;
        }

        // ── 3. Skip if Supabase already has clients (avoid double-migration) ──
        const countsResult = await getClientCounts(businessId);
        const existingCount = countsResult.data?.total ?? 0;
        if (existingCount > 0) {
          console.log('[ClientMigration] Supabase already has', existingCount, 'clients — skipping');
          await AsyncStorage.setItem(flag, 'true');
          return;
        }

        // ── 4. Insert each local client into Supabase ────────────────────────
        console.log('[ClientMigration] Migrating', localClients.length, 'local clients to Supabase');
        let successCount = 0;

        for (const client of localClients) {
          const result = await createClient({
            business_id: businessId,
            name: client.name,
            // Convert empty strings to null — CreateClientData uses nullable types
            email: client.email?.trim() || null,
            phone: client.phone?.trim() || null,
            notes: client.notes?.trim() || null,
          });

          const errCode = (result.error as any)?.code;
          const isDuplicate =
            errCode === 'CLIENT_EMAIL_DUPLICATE' || errCode === 'CLIENT_PHONE_DUPLICATE';

          if (!result.error || isDuplicate) {
            successCount++;
          } else {
            console.log(
              '[ClientMigration] Could not migrate client:',
              client.name,
              '—',
              result.error?.message
            );
          }
        }

        console.log(
          '[ClientMigration] Complete:',
          successCount,
          '/',
          localClients.length,
          'clients persisted to Supabase'
        );

        // ── 5. Mark migration as done ────────────────────────────────────────
        await AsyncStorage.setItem(flag, 'true');

        // ── 6. Refresh React Query cache so all consumers see the new rows ───
        if (successCount > 0) {
          queryClient.invalidateQueries({ queryKey: clientKeys.list(businessId) });
        }
      } catch (err) {
        // Do NOT mark as done on unexpected errors — allow retry on next launch
        console.log('[ClientMigration] Unexpected error:', err);
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized, businessId, user?.id]);
}
