import { useState, useEffect, useCallback } from 'react';
import type { UserSettings } from '../types/types';

const DEFAULT_SETTINGS: UserSettings = {
  id: null,
  name: '',
  bio: '',
  gender: '',
  onboardingComplete: false,
};

export function useUserSettings() {
  const [userSettings, setUserSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.chatApi.user.get().then(setUserSettings).finally(() => setLoading(false));
  }, []);

  const updateUserSettings = useCallback(
    (updates: { name: string; bio: string; gender: string }) => {
      window.chatApi.user.update(updates).then(() => {
        setUserSettings((prev) => ({
          ...prev,
          ...updates,
          onboardingComplete: true,
        }));
      });
    },
    []
  );

  return { userSettings, updateUserSettings, loading };
}
