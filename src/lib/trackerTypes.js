// Metadata for the flexible tracker system — used by forms, cards and pickers.

export const TYPES = [
  { type: 'number',   label: 'Zahl',        hint: 'Freier Wert mit Einheit (kg, ml, Schritte …)', icon: '#️⃣' },
  { type: 'scale',    label: 'Skala',       hint: 'Bewertung von min–max (z. B. Stimmung 1–5)',   icon: '🎚️' },
  { type: 'boolean',  label: 'Ja/Nein',     hint: 'Gewohnheit abhaken (erledigt / nicht)',        icon: '✅' },
  { type: 'duration', label: 'Dauer',       hint: 'Minuten (z. B. Meditation, Mobility)',         icon: '⏱️' },
  { type: 'choice',   label: 'Auswahl',     hint: 'Eine von eigenen Optionen',                    icon: '🔘' },
  { type: 'text',     label: 'Notiz',       hint: 'Freitext / Tagebuch',                          icon: '📝' },
];

export const CATEGORIES = [
  { key: 'body',      label: 'Körper',     icon: '📏' },
  { key: 'training',  label: 'Training',   icon: '🏋️' },
  { key: 'nutrition', label: 'Ernährung',  icon: '🥗' },
  { key: 'wellbeing', label: 'Wohlbefinden', icon: '🧘' },
  { key: 'habit',     label: 'Gewohnheit', icon: '🔁' },
  { key: 'custom',    label: 'Sonstiges',  icon: '✨' },
];

export const GOAL_DIRECTIONS = [
  { key: 'up',       label: 'Erhöhen ↑' },
  { key: 'down',     label: 'Senken ↓' },
  { key: 'maintain', label: 'Halten ≈' },
];

// Curated palette (matches the MD3 Expressive chart colors).
export const COLORS = ['#c6ff00', '#8fd6ff', '#ffb59c', '#d0bcff', '#ffd34d', '#7ee787', '#ff9ec7', '#ffa657'];

export const ICONS = [
  '⚖️', '📏', '💪', '🏋️', '🏃', '🚴', '🧘', '🥗', '🍎', '💧', '😴', '😊', '⚡', '🔥',
  '❤️', '🧠', '📈', '🎯', '☕', '🚬', '💊', '🦶', '🩺', '🧴', '📝', '✅', '⭐', '🌙',
];

// One-tap templates so users keep the old convenience but everything stays editable.
export const TEMPLATES = [
  { name: 'Gewicht',     type: 'number', unit: 'kg', icon: '⚖️', category: 'body' },
  { name: 'Körperfett',  type: 'number', unit: '%',  icon: '📉', category: 'body' },
  { name: 'Taille',      type: 'number', unit: 'cm', icon: '📏', category: 'body' },
  { name: 'Brust',       type: 'number', unit: 'cm', icon: '📏', category: 'body' },
  { name: 'Hüfte',       type: 'number', unit: 'cm', icon: '📏', category: 'body' },
  { name: 'Arm',         type: 'number', unit: 'cm', icon: '💪', category: 'body' },
  { name: 'Schritte',    type: 'number', unit: '',   icon: '🦶', category: 'wellbeing', goal_value: 10000, goal_direction: 'up' },
  { name: 'Wasser',      type: 'number', unit: 'ml', icon: '💧', category: 'nutrition', goal_value: 2500, goal_direction: 'up' },
  { name: 'Schlaf',      type: 'number', unit: 'h',  icon: '😴', category: 'wellbeing', goal_value: 8, goal_direction: 'up' },
  { name: 'Stimmung',    type: 'scale',  unit: '',   icon: '😊', category: 'wellbeing', scale_min: 1, scale_max: 5 },
  { name: 'Meditation',  type: 'duration', unit: 'min', icon: '🧘', category: 'habit' },
  { name: 'Kein Alkohol', type: 'boolean', unit: '', icon: '🚫', category: 'habit' },
];

export function typeLabel(type) { return (TYPES.find((t) => t.type === type) || TYPES[0]).label; }
export function catLabel(key) { return (CATEGORIES.find((c) => c.key === key) || CATEGORIES[5]).label; }

// Format an entry value for display based on tracker type.
export function fmtValue(tracker, entry) {
  if (!entry) return '–';
  if (tracker.type === 'boolean') return entry.value ? '✅ Ja' : '✕ Nein';
  if (tracker.type === 'text' || tracker.type === 'choice') return entry.text_value || '–';
  if (tracker.type === 'duration') return `${entry.value} min`;
  return `${entry.value}${tracker.unit ? ' ' + tracker.unit : ''}`;
}
