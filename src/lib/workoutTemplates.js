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

// Curated short at-home sessions. `bodyweight: true` hides the kg field;
// reps `null` = hold/duration exercise (logged as the exercise only). `count` =
// number of sets for that row (one row stands for N identical sets).
export const WORKOUT_TEMPLATES = [
  {
    id: 'bodyweight', label: 'Bodyweight', icon: '💪',
    place: 'home', category: 'Ganzkörper', bodyweight: true, duration: 20,
    sets: [
      { exercise: 'Liegestütze', count: 3, reps: 12 },
      { exercise: 'Kniebeugen', count: 3, reps: 15 },
      { exercise: 'Ausfallschritte', count: 3, reps: 12 },
      { exercise: 'Plank', count: 3, reps: null },
    ],
  },
  {
    id: 'hiit', label: 'HIIT', icon: '🔥',
    place: 'home', category: 'Cardio', bodyweight: true, duration: 15,
    sets: [
      { exercise: 'Burpees', count: 4, reps: 10 },
      { exercise: 'Mountain Climbers', count: 4, reps: 20 },
      { exercise: 'Hampelmänner', count: 4, reps: 30 },
    ],
  },
  {
    id: 'core', label: 'Core', icon: '🫀',
    place: 'home', category: 'Ganzkörper', bodyweight: true, duration: 10,
    sets: [
      { exercise: 'Plank', count: 3, reps: null },
      { exercise: 'Crunches', count: 3, reps: 20 },
      { exercise: 'Beinheben', count: 3, reps: 15 },
      { exercise: 'Russian Twist', count: 3, reps: 20 },
    ],
  },
  {
    id: 'mobility', label: 'Mobility', icon: '🧘',
    place: 'home', category: 'Mobility', bodyweight: true, duration: 10, sets: [],
  },
  {
    id: 'cardio', label: 'Cardio', icon: '🏃',
    place: 'outdoor', category: 'Cardio', bodyweight: true, duration: 30, sets: [],
  },
];
