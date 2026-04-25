import { useState, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { ThemedInput, ThemedSelect, ThemedTextarea } from '../FormInputs';

const GENDERS = [
  { value: '', label: 'Prefer not to say' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'nonbinary', label: 'Non-binary' },
];

export function ProfileTab() {
  const { userSettings, updateUserSettings } = useApp();
  const [name, setName] = useState(userSettings.name);
  const [bio, setBio] = useState(userSettings.bio);
  const [gender, setGender] = useState(userSettings.gender);

  const handleSave = useCallback(() => {
    updateUserSettings({ name, bio, gender });
  }, [name, bio, gender, updateUserSettings]);

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-xs text-gray-400 mb-1">Name</label>
        <ThemedInput
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={handleSave}
          placeholder="Your name"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1">Gender</label>
        <ThemedSelect value={gender} onChange={(e) => setGender(e.target.value)} onBlur={handleSave}>
          {GENDERS.map((g) => (
            <option key={g.value} value={g.value}>
              {g.label}
            </option>
          ))}
        </ThemedSelect>
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1">Bio / Interests</label>
        <ThemedTextarea
          value={bio}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBio(e.target.value)}
          onBlur={handleSave}
          placeholder="e.g. Software developer, into AI and music"
          className="resize-y h-20"
        />
        <p className="text-xs theme-text-muted mt-1">
          Used for personalization. Not yet implemented.
        </p>
      </div>
    </div>
  );
}
