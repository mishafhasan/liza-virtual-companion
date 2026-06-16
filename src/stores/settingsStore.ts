import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getSupabaseClient, isSupabaseEnabled } from '@/services/supabase/supabaseClient';
import type { Settings, CharacterProfile, MemoryItem, Language } from '@/types';
import { DEFAULT_SETTINGS, DEFAULT_CHARACTER_PROFILE } from '@/constants';

/**
 * Settings store (Zustand).
 *
 * When Supabase is configured, settings, character profile, and long-term
 * memories are synced to `user_settings`, `character_profiles`, and `memories`
 * tables respectively (upserted on every change).
 * On first load `loadFromCloud()` is called to hydrate the store from the DB,
 * overriding any stale localStorage values.
 *
 * In local-only mode the `persist` middleware keeps everything in localStorage
 * exactly as before — no behaviour change.
 */
interface SettingsStore {
  settings: Settings;
  characterProfile: CharacterProfile;
  memory: MemoryItem[];
  /** True once the initial cloud load has completed (or Supabase is absent). */
  cloudLoaded: boolean;
  /** The last user ID for whom cloud data was loaded. Prevents re-loading on every navigation. */
  lastCloudLoadedUserId: string | null;
  updateSettings: (updates: Partial<Settings>) => Promise<void>;
  updateCharacterProfile: (updates: Partial<CharacterProfile>) => Promise<void>;
  addMemory: (item: MemoryItem) => void;
  deleteMemory: (id: string) => void;
  /** Hydrate store from Supabase — call once after the user is authenticated. */
  loadFromCloud: (userId: string) => Promise<void>;
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

        if (!isSupabaseEnabled()) {
          set({ cloudLoaded: true, lastCloudLoadedUserId: userId });
          return;
        }

        const supabase = await getSupabaseClient();
        if (!supabase) { set({ cloudLoaded: true, lastCloudLoadedUserId: userId }); return; }

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
            .select('id, fact, created_at')
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
        if (memoriesRows && memoriesRows.length > 0) {
          updates.memory = memoriesRows.map((m) => ({ id: m.id, fact: m.fact }));
        }

        set(updates);
      },

      // ─── Update settings ─────────────────────────────────────────────────
      updateSettings: async (updates) => {
        set((state) => ({ settings: { ...state.settings, ...updates } }));

        if (!isSupabaseEnabled()) return;
        const supabase = await getSupabaseClient();
        if (!supabase) return;

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const merged = get().settings;
        await supabase.from('user_settings').upsert(
          {
            user_id: user.id,
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

      // ─── Update character profile ─────────────────────────────────────────
      updateCharacterProfile: async (updates) => {
        set((state) => ({ characterProfile: { ...state.characterProfile, ...updates } }));

        if (!isSupabaseEnabled()) return;
        const supabase = await getSupabaseClient();
        if (!supabase) return;

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const merged = get().characterProfile;
        const { error } = await supabase.from('character_profiles').upsert(
          {
            user_id: user.id,
            name: merged.name,
            personality: merged.personality,
            avatar_image: merged.avatar ?? null,
          },
          { onConflict: 'user_id' },
        );
        if (error) console.error("Supabase upsert error:", error);
      },

      // ─── Memory (local + cloud sync) ──────────────────────────────────────
      addMemory: (item) => {
        set((state) => ({ memory: [...state.memory, item] }));

        // Fire-and-forget cloud sync
        if (!isSupabaseEnabled()) return;
        (async () => {
          try {
            const supabase = await getSupabaseClient();
            if (!supabase) return;
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            await supabase.from('memories').upsert(
              { user_id: user.id, fact: item.fact },
              { onConflict: 'user_id,fact' },
            );
          } catch (err) {
            console.warn('[settingsStore] addMemory cloud sync failed:', (err as Error).message);
          }
        })();
      },

      deleteMemory: (id) => {
        const item = get().memory.find((m) => m.id === id);
        set((state) => ({ memory: state.memory.filter((m) => m.id !== id) }));

        if (!item || !isSupabaseEnabled()) return;
        (async () => {
          try {
            const supabase = await getSupabaseClient();
            if (!supabase) return;
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            await supabase.from('memories').delete()
              .eq('user_id', user.id)
              .eq('fact', item.fact);
          } catch (err) {
            console.warn('[settingsStore] deleteMemory cloud sync failed:', (err as Error).message);
          }
        })();
      },
    }),
    {
      name: 'liza-app-state',
      version: 1,
      // Persist lastCloudLoadedUserId so we don't re-fetch on every navigation.
      // cloudLoaded is NOT persisted so a fresh tab still re-verifies.
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
