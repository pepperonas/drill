// Training-location metadata + one-tap quick-start templates.
// These power the "log a short workout at home" flow: pick a place, tap a
// template, hit save. Bodyweight templates need no equipment and no weights.

export const WORKOUT_PLACES = [
  { id: 'gym', label: 'Gym', icon: '🏋️' },
  { id: 'home', label: 'Zuhause', icon: '🏠' },
  { id: 'outdoor', label: 'Draußen', icon: '🌳' },
];

const PLACE_BY_ID = Object.fromEntries(WORKOUT_PLACES.map((p) => [p.id, p]));
export const placeMeta = (id) => PLACE_BY_ID[id] || null;

// Home-friendly exercise library, merged into the autocomplete so a bodyweight
// session is quick to type even without saved history.
export const BODYWEIGHT_EXERCISES = [
  'Liegestütze', 'Kniebeugen', 'Ausfallschritte', 'Plank', 'Crunches',
  'Beinheben', 'Burpees', 'Mountain Climbers', 'Hampelmänner', 'Klimmzüge',
  'Dips', 'Glute Bridge', 'Superman', 'Wadenheben', 'Russian Twist',
  'Hollow Hold', 'Wall Sit', 'Hip Thrust', 'Seitstütz', 'Hampelmann',
];

// Classic weighted gym lifts (barbell/dumbbell/machine), merged into the
// autocomplete so a Hantel-Workout is just as quick to log as a bodyweight one.
export const GYM_EXERCISES = [
  'Bankdrücken', 'Kniebeuge', 'Kreuzheben', 'Schulterdrücken', 'Langhantelrudern',
  'Klimmzüge', 'Latzug', 'Beinpresse', 'Beinstrecker', 'Beinbeuger',
  'Bizeps-Curls', 'Hammer-Curls', 'Trizepsdrücken', 'Butterfly', 'Schrägbankdrücken',
  'Kurzhantel-Bankdrücken', 'Seitheben', 'Frontheben', 'Kabelrudern', 'Wadenheben',
  'Ausfallschritte (Kurzhantel)', 'Rumänisches Kreuzheben', 'Face Pulls', 'Dips',
];

// Curated quick-start sessions. `group` ('gym' | 'home') drives the two labelled
// rows in the picker. Gym templates keep the kg field (weight blank → user fills
// it in); `bodyweight: true` hides it. reps `null` = hold/duration exercise;
// `count` = number of sets that row stands for.
export const WORKOUT_TEMPLATES = [
  // --- 🏋️ Gym (weighted / Hantel) ---
  {
    id: 'fullbody', label: 'Ganzkörper', icon: '🏋️', group: 'gym',
    place: 'gym', category: 'Ganzkörper', bodyweight: false, duration: 60,
    sets: [
      { exercise: 'Kniebeuge', count: 3, reps: 10 },
      { exercise: 'Bankdrücken', count: 3, reps: 10 },
      { exercise: 'Langhantelrudern', count: 3, reps: 10 },
      { exercise: 'Schulterdrücken', count: 3, reps: 12 },
    ],
  },
  {
    id: 'push', label: 'Push', icon: '💪', group: 'gym',
    place: 'gym', category: 'Push', bodyweight: false, duration: 55,
    sets: [
      { exercise: 'Bankdrücken', count: 4, reps: 8 },
      { exercise: 'Schrägbankdrücken', count: 3, reps: 10 },
      { exercise: 'Schulterdrücken', count: 3, reps: 10 },
      { exercise: 'Trizepsdrücken', count: 3, reps: 12 },
    ],
  },
  {
    id: 'pull', label: 'Pull', icon: '🏋️', group: 'gym',
    place: 'gym', category: 'Pull', bodyweight: false, duration: 55,
    sets: [
      { exercise: 'Klimmzüge', count: 4, reps: 8 },
      { exercise: 'Langhantelrudern', count: 4, reps: 10 },
      { exercise: 'Latzug', count: 3, reps: 12 },
      { exercise: 'Bizeps-Curls', count: 3, reps: 12 },
    ],
  },
  {
    id: 'legs', label: 'Beine', icon: '🦵', group: 'gym',
    place: 'gym', category: 'Beine', bodyweight: false, duration: 55,
    sets: [
      { exercise: 'Kniebeuge', count: 4, reps: 8 },
      { exercise: 'Beinpresse', count: 3, reps: 12 },
      { exercise: 'Rumänisches Kreuzheben', count: 3, reps: 10 },
      { exercise: 'Wadenheben', count: 4, reps: 15 },
    ],
  },
  // --- 🏠 Zuhause (bodyweight) ---
  {
    id: 'bodyweight', label: 'Bodyweight', icon: '🤸', group: 'home',
    place: 'home', category: 'Ganzkörper', bodyweight: true, duration: 20,
    sets: [
      { exercise: 'Liegestütze', count: 3, reps: 12 },
      { exercise: 'Kniebeugen', count: 3, reps: 15 },
      { exercise: 'Ausfallschritte', count: 3, reps: 12 },
      { exercise: 'Plank', count: 3, reps: null },
    ],
  },
  {
    id: 'hiit', label: 'HIIT', icon: '🔥', group: 'home',
    place: 'home', category: 'Cardio', bodyweight: true, duration: 15,
    sets: [
      { exercise: 'Burpees', count: 4, reps: 10 },
      { exercise: 'Mountain Climbers', count: 4, reps: 20 },
      { exercise: 'Hampelmänner', count: 4, reps: 30 },
    ],
  },
  {
    id: 'core', label: 'Core', icon: '🫀', group: 'home',
    place: 'home', category: 'Ganzkörper', bodyweight: true, duration: 10,
    sets: [
      { exercise: 'Plank', count: 3, reps: null },
      { exercise: 'Crunches', count: 3, reps: 20 },
      { exercise: 'Beinheben', count: 3, reps: 15 },
      { exercise: 'Russian Twist', count: 3, reps: 20 },
    ],
  },
  {
    id: 'mobility', label: 'Mobility', icon: '🧘', group: 'home',
    place: 'home', category: 'Mobility', bodyweight: true, duration: 10, sets: [],
  },
  {
    id: 'cardio', label: 'Cardio', icon: '🏃', group: 'home',
    place: 'outdoor', category: 'Cardio', bodyweight: true, duration: 30, sets: [],
  },
];
