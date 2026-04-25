import { useState, useCallback } from 'react';

interface OnboardingModalProps {
  onComplete: (name: string, bio: string, gender: string) => void;
}

const GENDERS = [
  { value: '', label: 'Prefer not to say' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'nonbinary', label: 'Non-binary' },
];

export default function OnboardingModal({ onComplete }: OnboardingModalProps) {
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [gender, setGender] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!name.trim()) {
        setError('Please enter your name.');
        return;
      }
      setError('');
      onComplete(name.trim(), bio.trim(), gender);
    },
    [name, bio, gender, onComplete]
  );

  return (
    <div className="modal-overlay">
      <div className="modal-content theme-main">
        <h2 className="text-xl font-semibold theme-text-heading mb-1">Welcome to Pulse</h2>
        <p className="text-sm theme-text-muted mb-6">
          Let&apos;s set things up. This info helps the assistant feel more personal.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="ob-name" className="block text-sm font-medium theme-text-primary mb-1">
              Name
            </label>
            <input
              id="ob-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alex"
              className="w-full px-3 py-2 rounded-lg bg-transparent border theme-border-light theme-text-primary text-sm focus:outline-none focus:ring-1 focus:ring-neutral-500"
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="ob-gender" className="block text-sm font-medium theme-text-primary mb-1">
              Gender
            </label>
            <select
              id="ob-gender"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-transparent border theme-border-light theme-text-primary text-sm focus:outline-none focus:ring-1 focus:ring-neutral-500"
            >
              {GENDERS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="ob-bio" className="block text-sm font-medium theme-text-primary mb-1">
              Bio / Interests
            </label>
            <textarea
              id="ob-bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="e.g. Software developer, into AI and music"
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-transparent border theme-border-light theme-text-primary text-sm focus:outline-none focus:ring-1 focus:ring-neutral-500 resize-none"
            />
            <p className="text-xs theme-text-muted mt-1">
              Used for personalization. Not yet implemented.
            </p>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="px-4 py-2 text-sm bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg transition-colors"
            >
              Get started
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
