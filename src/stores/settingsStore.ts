import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getSupabaseClient } from '@/services/supabase/supabaseClient';
import { useAuthStore } from '@/stores/authStore';
import { embedAndStoreMemory } from '@/services/supabase/conversationService';
import { syncWrite } from '@/services/sync/supabaseQuery';
import type { Settings, CharacterProfile, MemoryItem, MemoryCategory, Language } from '@/types';
import { DEFAULT_SETTINGS, DEFAULT_CHARACTER_PROFILE } from '@/constants';

/**
 * Settings store (Zustand) — CLOUD-FIRST cache model.
 *
 * Supabase is the single source of truth. This store is a per-user read cache:
 *   - On login, `loadFromCloud()` hydrates from the DB and OVERRIDES any stale
 *     localStorage values (including an empty memory list — fixing the bug
 *     where stale local data masked an empty cloud).
 *   - On every change, the store updates locally for instant UI, then syncs to
 *     the cloud via `syncWrite` (which retries on transient failure and queues
 *     for later replay when offline).
 *   - On logout, `resetStore()` wipes the cache so the next user starts clean.
 *
 * The `persist` middleware keeps a localStorage copy (key `liza-app-state`)
 * purely as a read cache for fast page loads — it is never authoritative.
 */
interface SettingsStore {
  settings: Settings;
  characterProfile: CharacterProfile;
  memory: MemoryItem[];
  /** True once the initial cloud load has completed for the current user. */
  cloudLoaded: boolean;
  /** The last user ID for whom cloud data was loaded. Prevents re-loading on every navigation. */
  lastCloudLoadedUserId: string | null;
  updateSettings: (updates: Partial<Settings>) => Promise<void>;
  updateCharacterProfile: (updates: Partial<CharacterProfile>) => Promise<void>;
  /** Manual single-fact add (from Settings UI). Embeds + persists to cloud. */
  addMemory: (item: MemoryItem) => void;
  /** Batch add (from mid-conversation extraction). Cloud write already done by caller. */
  addMemories: (items: MemoryItem[]) => void;
  deleteMemory: (id: string) => void;
  /** Hydrate store from Supabase — call once after the user is authenticated. */
  loadFromCloud: (userId: string) => Promise<void>;
  /** Wipe the cache back to defaults — called on logout. */
  resetStore: () => void;
}

function requireUserId(): string {
  const userId = useAuthStore.getState().userId;
  if (!userId) throw new Error('No authenticated user.');
  return userId;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      settings: DEFAULT_SETTINGS,
      characterProfile: DEFAULT_CHARACTER_PROFILE,
      memory: [],
      cloudLoaded: false,
      lastCloudLoadedUserId: null,

      // ─── Load from cloud ──────────────────────────────────────────────────
      loadFromCloud: async (userId: string) => {
        // If we've already loaded for this user, skip to avoid redundant network calls.
        if (get().lastCloudLoadedUserId === userId) {
          set({ cloudLoaded: true });
          return;
        }

        const supabase = await getSupabaseClient();

        // Read first — only upsert if the row is missing. This avoids unnecessary writes.
        const [{ data: settingsRow, error: settingsErr }, { data: characterRow, error: characterErr }, { data: memoriesRows, error: memoriesErr }] = await Promise.all([
          supabase
            .from('user_settings')
            .select('language, voice_name, flirt_intensity, emotion_intensity, video_mode, avatar_id')
            .eq('user_id', userId)
            .single(),
          supabase
            .from('character_profiles')
            .select('name, personality, avatar_image')
            .eq('user_id', userId)
            .single(),
          supabase
            .from('memories')
            .select('id, fact, category')
            .eq('user_id', userId)
            .order('created_at', { ascending: true }),
        ]);

        // If we hit a real network error (not just "row not found"), don't mark as loaded
        // so the next navigation will retry.
        const settingsFailed = settingsErr && settingsErr.code !== 'PGRST116';
        const characterFailed = characterErr && characterErr.code !== 'PGRST116';
        if (settingsFailed || characterFailed || memoriesErr) {
          console.error('[settingsStore] loadFromCloud failed:', settingsErr?.message || characterErr?.message || memoriesErr?.message);
          return;
        }

        const s = get().settings;
        const cp = get().characterProfile;
        const updates: Partial<SettingsStore> = {
          cloudLoaded: true,
          lastCloudLoadedUserId: userId,
        };

        // If missing, upsert defaults so the row exists for future writes.
        if (settingsErr?.code === 'PGRST116') {
          await supabase.from('user_settings').upsert(
            {
              user_id: userId,
              language: s.language,
              voice_name: s.voiceName,
              flirt_intensity: s.flirtIntensity,
              emotion_intensity: s.emotionIntensity,
              video_mode: s.videoMode,
              avatar_id: s.avatarId ?? 'default',
            },
            { onConflict: 'user_id' },
          );
        }
        if (characterErr?.code === 'PGRST116') {
          await supabase.from('character_profiles').upsert(
            {
              user_id: userId,
              name: cp.name,
              personality: cp.personality,
              avatar_image: cp.avatar ?? null,
            },
            { onConflict: 'user_id' },
          );
        }

        if (settingsRow) {
          updates.settings = {
            language: (settingsRow.language as Language) ?? DEFAULT_SETTINGS.language,
            voiceName: settingsRow.voice_name ?? DEFAULT_SETTINGS.voiceName,
            flirtIntensity: settingsRow.flirt_intensity ?? DEFAULT_SETTINGS.flirtIntensity,
            emotionIntensity: settingsRow.emotion_intensity ?? DEFAULT_SETTINGS.emotionIntensity,
            videoMode: settingsRow.video_mode ?? DEFAULT_SETTINGS.videoMode,
            avatarId: settingsRow.avatar_id ?? DEFAULT_SETTINGS.avatarId,
            heygenApiKey: get().settings.heygenApiKey, // never stored in cloud
          };
        }

        if (characterRow) {
          updates.characterProfile = {
            name: characterRow.name ?? DEFAULT_CHARACTER_PROFILE.name,
            personality: characterRow.personality ?? DEFAULT_CHARACTER_PROFILE.personality,
            avatar: characterRow.avatar_image || get().characterProfile.avatar,
          };
        }

        // ALWAYS overwrite the local memory list with the cloud result, even when
        // empty. Previously the list was left untouched when the query returned no
        // rows, which let stale localStorage mask an empty cloud on fresh deploys.
        updates.memory = (memoriesRows ?? []).map((m) => ({
          id: m.id as string,
          fact: m.fact as string,
          category: (m.category as MemoryCategory | null) ?? 'other',
        }));

        set(updates);
      },

      // ─── Update settings ─────────────────────────────────────────────────
      updateSettings: async (updates) => {
        set((state) => ({ settings: { ...state.settings, ...updates } }));

        const userId = requireUserId();
        const merged = get().settings;
        await syncWrite(
          async () => {
            const supabase = await getSupabaseClient();
            await supabase.from('user_settings').upsert(
              {
                user_id: userId,
                language: merged.language,
                voice_name: merged.voiceName,
                flirt_intensity: merged.flirtIntensity,
                emotion_intensity: merged.emotionIntensity,
                video_mode: merged.videoMode,
                avatar_id: merged.avatarId ?? 'default',
              },
              { onConflict: 'user_id' },
            );
          },
          { dedupeKey: `user_settings:${userId}`, label: 'Could not save settings' },
        );
      },

      // ─── Update character profile ─────────────────────────────────────────
      updateCharacterProfile: async (updates) => {
        set((state) => ({ characterProfile: { ...state.characterProfile, ...updates } }));

        const userId = requireUserId();
        const merged = get().characterProfile;
        await syncWrite(
          async () => {
            const supabase = await getSupabaseClient();
            const { error } = await supabase.from('character_profiles').upsert(
              {
                user_id: userId,
                name: merged.name,
                personality: merged.personality,
                avatar_image: merged.avatar ?? null,
              },
              { onConflict: 'user_id' },
            );
            if (error) throw error;
          },
          { dedupeKey: `character_profiles:${userId}`, label: 'Could not save profile' },
        );
      },

      // ─── Memory (local cache + cloud sync) ────────────────────────────────
      addMemory: (item) => {
        // Optimistically add to the local cache for instant UI.
        set((state) => ({ memory: [...state.memory, item] }));

        // Persist to cloud WITH an embedding so the fact becomes RAG-retrievable.
        // Previously manual adds went in with no embedding, making them invisible to
        // semantic retrieval. Category defaults to 'other' (no UI picker yet).
        const userId = requireUserId();
        const category: MemoryCategory = item.category ?? 'other';
        syncWrite(
          async () => {
            await embedAndStoreMemory(item.fact, 0.5, category);
          },
          {
            dedupeKey: `memory_upsert:${userId}:${item.fact}`,
            label: 'Could not save memory',
          },
        );
      },

      addMemories: (items) => {
        // Batch mirror into the local cache. The cloud write was already done by
        // the caller (summarizeMessageBatch), so this is a local-only update.
        if (!items.length) return;
        set((state) => ({ memory: [...state.memory, ...items] }));
      },

      deleteMemory: (id) => {
        const item = get().memory.find((m) => m.id === id);
        set((state) => ({ memory: state.memory.filter((m) => m.id !== id) }));

        if (!item) return;
        const userId = requireUserId();
        syncWrite(
          async () => {
            const supabase = await getSupabaseClient();
            const { error } = await supabase
              .from('memories')
              .delete()
              .eq('id', id)
              .eq('user_id', userId);
            if (error) throw error;
          },
          {
            dedupeKey: `memory_delete:${userId}:${id}`,
            label: 'Could not delete memory',
          },
        );
      },

      // ─── Reset (logout) ───────────────────────────────────────────────────
      resetStore: () => {
        set({
          settings: DEFAULT_SETTINGS,
          characterProfile: DEFAULT_CHARACTER_PROFILE,
          memory: [],
          cloudLoaded: false,
          lastCloudLoadedUserId: null,
        });
      },
    }),
    {
      name: 'liza-app-state',
      version: 1,
      // Persist lastCloudLoadedUserId so we don't re-fetch on every navigation.
      // cloudLoaded is NOT persisted so a fresh tab still re-verifies against cloud.
      partialize: (state) => ({
        settings: state.settings,
        characterProfile: state.characterProfile,
        memory: state.memory,
        lastCloudLoadedUserId: state.lastCloudLoadedUserId,
      }),
    },
  ),
);

/**
 * Backwards-compatible hook mirroring the old `useSettings()` Context API.
 * Existing components keep working unchanged.
 */
export const useSettings = () => {
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const characterProfile = useSettingsStore((s) => s.characterProfile);
  const updateCharacterProfile = useSettingsStore((s) => s.updateCharacterProfile);
  const memory = useSettingsStore((s) => s.memory);
  const addMemory = useSettingsStore((s) => s.addMemory);
  const deleteMemory = useSettingsStore((s) => s.deleteMemory);

  return {
    settings,
    updateSettings,
    characterProfile,
    updateCharacterProfile,
    memory,
    addMemory,
    deleteMemory,
  };
};
