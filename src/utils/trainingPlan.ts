/**
 * Training plan — the exercise library and the dated sessions the Train page
 * plays. Authored here (not in the DB) for now: the plan is written in
 * conversation with the coach and pasted in week by week.
 */

export interface Exercise {
  id: string;
  name: string;
  /** The one cue that matters most — shown under the name in the player. */
  cue: string;
  how: string[];
  avoid?: string[];
  why?: string;
  /** YouTube demo, played muted + looped inside the how-to panel. */
  video?: { id: string; start?: number };
}

export interface Prescription {
  ex: string;            // Exercise id
  sets?: number;         // default 1
  reps?: string;         // "10", "8 / side", "max · record"
  hold?: number;         // seconds — makes this a timed exercise
  perSide?: boolean;     // timed holds run once per side
  rest?: number;         // seconds between sets
  load?: string;         // "16 kg"
  note?: string;         // session-specific instruction, overrides nothing
}

export interface Block {
  title: string;
  items: Prescription[];
}

export type SessionKind = 'strength' | 'aerobic' | 'mobility' | 'golf' | 'test';

export interface Session {
  id: string;
  date: string;          // local YYYY-MM-DD
  title: string;
  kind: SessionKind;
  minutes: number;
  summary: string;
  blocks: Block[];
}

// ---------------------------------------------------------------------------
// Exercise library
// ---------------------------------------------------------------------------

const EXERCISES: Exercise[] = [
  // Warm-up / mobility
  {
    id: 'cat-cow', name: 'Cat–cow',
    cue: 'Move one vertebra at a time — slow, no forcing',
    how: ['Hands under shoulders, knees under hips.', 'Breathe in: drop the belly, lift chest and tailbone.', 'Breathe out: round the back, tuck chin and tailbone.'],
    why: 'Takes the spine gently through flexion and extension before load.',
  },
  {
    id: 'worlds-greatest-stretch', name: "World's greatest stretch",
    cue: 'Elbow to instep, then rotate the arm to the ceiling',
    how: ['Step into a long lunge, back knee off the floor.', 'Same-side hand inside the front foot, drop that elbow towards the instep.', 'Rotate the top arm up to the ceiling, eyes follow the hand.', 'Back to the floor, step through to the other side.'],
    why: 'Hip flexor, adductor, hamstring and thoracic rotation in one movement.',
  },
  {
    id: 'glute-bridge', name: 'Glute bridge',
    cue: 'Squeeze the glutes, ribs down — don’t arch the lower back',
    how: ['On your back, knees bent, feet hip-width.', 'Drive through heels, lift hips until knees–hips–shoulders line up.', 'Pause 1 s at the top, lower slowly.'],
  },
  {
    id: 'arm-circles', name: 'Arm circles',
    cue: 'Small to big, both directions, shoulders relaxed',
    how: ['Arms out to the side.', 'Start small, grow the circles.', 'Reverse direction.'],
  },
  {
    id: 'thoracic-extension', name: 'Thoracic extension over towel',
    cue: 'Extend over the towel — keep the ribs down, neck relaxed',
    how: ['Lie back over a firmly rolled towel (or foam roller) at shoulder-blade level.', 'Hands cross the chest or support the head lightly.', 'Extend back over it for a slow breath, return. 5 reps.', 'Shift the towel up a few cm and repeat — 3 levels.'],
    avoid: ['Cranking the neck back — the head just follows.', 'Doing it on the lower back.'],
    why: 'A stiff mid-back pushes movement into the neck. Restoring thoracic extension is a mainstay of neck-pain physio.',
  },
  {
    id: 'open-book', name: 'Open book',
    cue: 'Knees stay stacked — rotate through the upper back',
    how: ['Lie on your side, hips and knees bent 90°, arms out in front.', 'Open the top arm like a book, following it with your eyes.', 'Let the shoulder blade sink to the floor, breathe out, return.'],
    avoid: ['Letting the top knee lift — that turns it into a lower-back twist.'],
  },
  {
    id: 'wall-slide', name: 'Wall slide',
    cue: 'Forearms on the wall, slide up — shoulder blades wrap forward',
    how: ['Face the wall, forearms on it, elbows at shoulder height.', 'Slide the forearms up into a Y while pushing gently into the wall.', 'Lower slowly.'],
    why: 'Trains serratus and lower trap — the muscles that hold the shoulder blade so the neck muscles don’t have to.',
  },
  {
    id: 'upper-trap-stretch', name: 'Gentle neck side stretch',
    cue: 'Gentle — a stretch, never pain',
    how: ['Sit tall, hold the chair seat with one hand.', 'Tilt the opposite ear towards the shoulder.', 'Breathe; no pulling with the hand.'],
    avoid: ['Forcing it. If it sends pain up the head, skip it.'],
  },
  {
    id: 'hip-90-90', name: '90/90 hip switches',
    cue: 'Sit tall and switch the knees side to side slowly',
    how: ['Sit with both knees bent 90°, one in front, one to the side.', 'Keeping the feet planted, rotate both knees over to the other side.', 'Use your hands behind you as needed.'],
    why: 'Internal and external hip rotation — golf and trail running both need it.',
  },
  {
    id: 'hip-flexor-stretch', name: 'Half-kneeling hip flexor stretch',
    cue: 'Tuck the tailbone and squeeze the back glute first',
    how: ['Half-kneel, back knee on a cushion.', 'Tuck the pelvis under and squeeze the back-leg glute.', 'Shift forward a few cm until you feel the front of the hip. Breathe.'],
    why: 'Long days seated shorten the hip flexors.',
  },
  {
    id: 'adductor-rockback', name: 'Adductor rock-back',
    cue: 'Leg out to the side, rock hips back, flat back',
    how: ['On all fours, extend one leg straight out to the side, foot flat.', 'Rock the hips back towards your heel, keeping the back flat.', 'Return. Stay in a pain-free range.'],
    why: 'Gentle adductor mobility after the 5s strain.',
  },
  {
    id: 'seated-t-rotation', name: 'Seated thoracic rotation',
    cue: 'Hips still — rotate from the ribs',
    how: ['Sit tall on a chair, arms crossed on the chest.', 'Rotate the upper body, hold 1 s, return.'],
  },
  {
    id: 'leg-swings', name: 'Leg swings',
    cue: 'Relaxed swings that get bigger gradually',
    how: ['Hand on a cart, tree or wall.', 'Swing one leg front-to-back 10×, then side-to-side 10×.', 'Switch legs.'],
  },
  {
    id: 'lunge-rotation', name: 'Lunge with rotation',
    cue: 'Lunge, then rotate the chest over the front knee',
    how: ['Step into a lunge.', 'Rotate the chest towards the front-leg side.', 'Return, step through.'],
  },
  {
    id: 'golf-warmup', name: 'Club trunk rotations',
    cue: 'Club across the shoulders, turn like your backswing',
    how: ['Club behind the shoulders, held at both ends.', 'Take a golf posture and rotate back and through.', 'Build range gradually.'],
  },
  {
    id: 'half-swings', name: 'Half swings → full',
    cue: 'Wedge, half swings first, build to full',
    how: ['Wedge: 10 half swings at easy tempo.', 'Build up to full swings before going to the long clubs.'],
  },

  // Strength
  {
    id: 'goblet-squat', name: 'Goblet squat',
    cue: 'Chest up, elbows inside knees, 2 s down',
    how: ['Hold the bell by the horns against your chest.', 'Feet slightly wider than hips, toes slightly out.', 'Sit down between your heels, knees tracking over toes.', 'Drive up through the whole foot.'],
    avoid: ['Heels lifting.', 'Knees caving in.'],
    why: 'Loads the quads, glutes and adductors through a full range — the base of running and lifting toddlers.',
  },
  {
    id: 'push-up', name: 'Push-up',
    cue: 'One straight line from head to heels',
    how: ['Hands just wider than shoulders.', 'Brace the trunk, squeeze the glutes.', 'Lower until the chest is a fist from the floor; elbows ~45° from the body.', 'Press away.'],
    avoid: ['Hips sagging.', 'Head poking forward.'],
  },
  {
    id: 'kb-row', name: 'One-arm row',
    cue: 'Pull to the hip, not the shoulder',
    how: ['Hand and knee on a bench or chair, back flat.', 'Let the bell hang, shoulder blade relaxed forward.', 'Row the elbow back towards the hip; pause.', 'Lower under control.'],
    avoid: ['Shrugging towards the ear — keeps the upper trap and neck out of it.', 'Twisting the torso.'],
    why: 'Strengthens the mid-back and lats that support the neck and shoulder.',
  },
  {
    id: 'kb-single-leg-rdl', name: 'Single-leg Romanian deadlift',
    cue: 'Hips square, reach back with the free leg',
    how: ['Bell in the hand opposite the standing leg.', 'Soft knee, hinge at the hip while the free leg reaches back.', 'Lower until you feel the hamstring, keep the back flat.', 'Drive the hip forward to stand.'],
    avoid: ['Hip of the free leg opening to the ceiling.'],
    why: 'Hamstring and glute strength plus single-leg balance — key for trail running.',
  },
  {
    id: 'copenhagen-short', name: 'Copenhagen plank (short lever)',
    cue: 'Inside of the KNEE on the couch, lift the hips',
    how: ['Side plank on your elbow.', 'Top leg’s inner knee on the couch or bench, bottom leg tucked under.', 'Lift the hips into a straight line and hold.'],
    avoid: ['Putting the ankle on the bench — that’s the long lever. Earn it later.'],
    why: 'Harøy et al. (BJSM 2019): a Copenhagen programme cut groin problems by ~41% in footballers.',
  },
  {
    id: 'dead-bug', name: 'Dead bug',
    cue: 'Lower back stays glued to the floor',
    how: ['On your back, arms to the ceiling, hips and knees at 90°.', 'Breathe out and slowly extend the opposite arm and leg.', 'Return, switch sides.'],
    avoid: ['Lower back lifting off the floor — shorten the range.'],
  },
  {
    id: 'split-squat', name: 'Split squat',
    cue: 'Straight down, front knee over the toes',
    how: ['Long stride stance, back heel up.', 'Drop the back knee straight down towards the floor.', 'Drive up through the front foot.', 'Optional: hold the KB in goblet position.'],
  },
  {
    id: 'single-leg-bridge', name: 'Single-leg glute bridge',
    cue: 'Hips level — don’t let one side drop',
    how: ['On your back, one foot planted, other leg straight or knee to chest.', 'Drive through the heel, lift the hips.', 'Pause, lower slowly.'],
  },
  {
    id: 'kb-floor-press', name: 'One-arm floor press',
    cue: 'Upper arm meets the floor, then press',
    how: ['Lie on the floor, knees bent, bell in one hand.', 'Lower until the upper arm touches the floor.', 'Press straight up, wrist stacked.'],
    why: 'Pressing strength without the overhead position that can irritate the neck.',
  },
  {
    id: 'prone-yt', name: 'Prone Y & T raises',
    cue: 'Thumbs up, squeeze the shoulder blades down',
    how: ['Lie face down, forehead on a towel.', 'Y: arms overhead in a Y, thumbs up, lift a few cm. Hold 2 s.', 'T: arms out to the side, same.', 'Keep the neck long — don’t lift the head.'],
    why: 'Lower and middle trapezius — upper-back reserve to stop the neck overworking.',
  },
  {
    id: 'side-plank', name: 'Side plank',
    cue: 'Straight line, hips high',
    how: ['Elbow under the shoulder, feet stacked (or knees bent to regress).', 'Lift the hips and hold.'],
  },
  {
    id: 'suitcase-carry', name: 'Suitcase carry',
    cue: 'Walk tall — don’t lean towards the bell',
    how: ['Bell in one hand by your side.', 'Walk with level shoulders and slow steps.', 'Switch hands.'],
    why: 'Anti-side-bend core strength — carrying one twin on a hip is a suitcase carry.',
  },

  // Calf rehab
  {
    id: 'calf-iso', name: 'Calf isometric hold',
    cue: 'Up on the toes, weight shifted left — hold still',
    how: ['Stand near a wall for balance.', 'Rise up on both toes to about half height.', 'Shift most of your weight onto the left and hold.', 'Progress to left-only once it’s at or under 3/10.'],
    why: 'Isometrics load healing muscle and tendon with little irritation and can reduce pain in the short term.',
  },
  {
    id: 'calf-eccentric', name: 'Two up, one down calf raise',
    cue: 'Up on two, lower on the left over 3 s',
    how: ['Rise up on both feet.', 'Lift the right foot and lower slowly on the left, 3 s.', 'Repeat.'],
    why: 'Slow loaded lengthening rebuilds calf capacity after a strain.',
  },
  {
    id: 'calf-bent-knee', name: 'Bent-knee calf raise',
    cue: 'Knees bent ~30° the whole time',
    how: ['Stand with knees slightly bent.', 'Rise up onto the toes without straightening the knees.', 'Lower slowly.'],
    why: 'Bent knee shifts the work to the soleus, which takes several times body weight with every running stride.',
  },

  // Aerobic
  {
    id: 'brisk-walk', name: 'Brisk walk',
    cue: 'Flat route, brisk enough to breathe harder but still talk',
    how: ['Flat ground — the promenade is ideal.', 'No hills this week; they load the calf.'],
  },

  // Tests
  {
    id: 'push-up-test', name: 'Push-up test',
    cue: 'Max strict reps — stop when form breaks',
    how: ['Strict push-ups, chest to fist height, body straight.', 'No resting at the top.', 'Count reps until form breaks. Record it.'],
    why: 'Yang et al. (JAMA Netw Open 2019): men doing 40+ push-ups had 96% fewer cardiovascular events over 10 years than those doing under 10.',
  },
  {
    id: 'sitting-rising-test', name: 'Sitting-rising test',
    cue: 'Sit to the floor and stand — no hands, no knees',
    how: ['Barefoot, cross your legs.', 'Sit down to the floor, then stand up.', 'Start at 10. −1 for every support used (hand, knee, forearm); −0.5 for a wobble.'],
    why: 'Araújo et al. (2012): low scores predicted mortality in 51–80 year olds. At 38, aim for 9–10.',
  },
  {
    id: 'single-leg-balance', name: 'Single-leg balance, eyes closed',
    cue: 'Hands on hips, eyes closed — up to 30 s each leg',
    how: ['Stand on one leg, hands on hips.', 'Close your eyes; stop the timer when the foot moves or you open your eyes.'],
  },
  {
    id: 'knee-to-wall', name: 'Knee-to-wall test',
    cue: 'Heel down, knee touches the wall — measure toe to wall',
    how: ['Face a wall, foot pointing at it.', 'Lunge so the knee touches the wall with the heel down.', 'Move the foot back until it’s the furthest that still works.', 'Measure toe-to-wall in cm, each side.'],
    why: 'Ankle dorsiflexion. Over 10 cm and symmetrical is the goal.',
  },
  {
    id: 'single-leg-calf-raise-test', name: 'Single-leg calf raise test',
    cue: 'Full height, one every 2 s — right first',
    how: ['Flat floor, fingertip on the wall.', 'Full-height single-leg raises at a steady 2 s pace.', 'Count to failure (or first symptom on the left). Right side first.'],
    why: 'Left should reach 90%+ of right. About 25 is the return-to-run target.',
  },
  {
    id: 'single-leg-hop', name: 'Single-leg hops',
    cue: 'Small, springy hops on the spot',
    how: ['Hands on hips.', 'Small hops on one leg, landing on the ball of the foot.', '20 per leg. Note any symptoms on the left.'],
    why: 'If both this and the calf raise test are symptom-free, run-walk starts next week.',
  },
];

// Demo videos — physio / coaching sources, IDs verified against YouTube oEmbed.
const VIDEOS: Record<string, { id: string; start?: number }> = {
  'cat-cow': { id: 'WHUevrqeKIg' },                      // Cleveland Clinic
  'worlds-greatest-stretch': { id: 'NIz2MdMqBxk' },      // Heafner Health PT
  'glute-bridge': { id: 'R1OXPHRqehw' },                 // Cleveland Clinic
  'goblet-squat': { id: 's64Ss68bABQ' },                 // StrongFirst
  'push-up': { id: 'WDIpL0pjun0' },                      // NASM
  'push-up-test': { id: 'WDIpL0pjun0' },
  'kb-row': { id: 'yA1E9DlA3Vc' },                       // Fusion Sports PT
  'kb-single-leg-rdl': { id: '-w3gokw_s7w' },            // OPEX
  'copenhagen-short': { id: 'nhGK-DxiGBE' },             // Physio Plus Fitness
  'dead-bug': { id: 'kSYl6XOzQ5U' },                     // SOS Physiotherapy
  'calf-iso': { id: 'arLsa_isSOw' },                     // Elite Performance Institute
  'calf-eccentric': { id: '-R1S7SbwNsI' },               // Michael Braccio (physio)
  'calf-bent-knee': { id: '-1s4TMcicYM' },               // Elite Performance Institute
  'split-squat': { id: 'la0pLPq-3A8' },
  'single-leg-bridge': { id: 'K_QyHRlO2cY' },
  'kb-floor-press': { id: 'P_ijh09h23s' },               // OPEX
  'prone-yt': { id: 'juoKsTqy77E' },                     // Y only — T is the same with arms out wide
  'side-plank': { id: '0M-erHBl48U' },                   // Heal Fit Physio
  'suitcase-carry': { id: 'Q1GjhRDAil0' },               // Rehab My Patient
  'thoracic-extension': { id: '9Y11Kc0E0og' },           // Rehab My Patient
  'open-book': { id: 'peeW19ofFUg' },
  'wall-slide': { id: 'cvx06snMQ3A' },                   // Rehab My Patient
  'upper-trap-stretch': { id: 'uwLcpgIqpnU' },           // NUH Physiotherapy
  'hip-90-90': { id: 'bJII__gcUHA' },
  'hip-flexor-stretch': { id: 'Bfb-9dIWEr4' },
  'adductor-rockback': { id: 'yF8o6I6aSZg' },            // Mike Reinold
  'seated-t-rotation': { id: 'uGl-AG4C1Wc' },
  'leg-swings': { id: 'D17eUtUt0zQ' },
  'lunge-rotation': { id: 'dwj78Ir6ZE8' },               // Rehab My Patient
  'sitting-rising-test': { id: '_LVOzG_mcWI' },
  'knee-to-wall': { id: 'kbzYML05Vac' },
  'single-leg-calf-raise-test': { id: 'fSXnnvgKST4' },
  'single-leg-hop': { id: 'Yq75-6SUn7A' },
};

const LIBRARY = new Map(EXERCISES.map(e => [e.id, { ...e, video: VIDEOS[e.id] ?? e.video }]));

export const getExercise = (id: string): Exercise =>
  LIBRARY.get(id) ?? { id, name: id, cue: '', how: [] };

// ---------------------------------------------------------------------------
// Reusable blocks
// ---------------------------------------------------------------------------

const WARM_UP: Block = {
  title: 'Warm-up',
  items: [
    { ex: 'cat-cow', reps: '8 slow' },
    { ex: 'worlds-greatest-stretch', reps: '3 / side' },
    { ex: 'glute-bridge', reps: '10' },
    { ex: 'arm-circles', reps: '10 each way' },
  ],
};

const CALF: Block = {
  title: 'Calf rehab',
  items: [
    { ex: 'calf-iso', sets: 4, hold: 40, rest: 30 },
    { ex: 'calf-eccentric', sets: 2, reps: '12', rest: 60 },
    { ex: 'calf-bent-knee', sets: 2, reps: '12', rest: 60 },
  ],
};

// Chin tucks were dropped on 5 Oct: they sent sharp pain into the side of the
// neck and the back of the head. Back in only after the physio has assessed it.
const NECK: Block = {
  title: 'Neck & upper back',
  items: [
    { ex: 'thoracic-extension', reps: '5 × 3 levels' },
    { ex: 'open-book', reps: '8 / side' },
    { ex: 'wall-slide', reps: '10' },
    { ex: 'upper-trap-stretch', hold: 30, perSide: true, note: 'Skip if it sends pain up into the head.' },
  ],
};

// ---------------------------------------------------------------------------
// Sessions — week of 5 Oct 2026 (calf healing, golf tour Fri/Sat)
// ---------------------------------------------------------------------------

export const SESSIONS: Session[] = [
  {
    id: '2026-10-05-strength-a', date: '2026-10-05', title: 'Strength A', kind: 'strength', minutes: 35,
    summary: 'Baseline tests, then full-body strength at 6/10 effort.',
    blocks: [
      {
        title: 'Baseline (part A)',
        items: [
          { ex: 'sitting-rising-test', reps: 'score /10 · record' },
          { ex: 'single-leg-balance', hold: 30, perSide: true },
          { ex: 'knee-to-wall', reps: 'cm each side · record' },
          { ex: 'single-leg-calf-raise-test', reps: 'max each side · record' },
        ],
      },
      WARM_UP,
      {
        title: 'Strength A',
        items: [
          { ex: 'goblet-squat', sets: 2, reps: '10', load: '16 kg', rest: 75 },
          { ex: 'push-up', sets: 2, reps: 'stop 4 short', rest: 75 },
          { ex: 'kb-row', sets: 2, reps: '10 / side', load: '16 kg', rest: 60 },
          { ex: 'kb-single-leg-rdl', sets: 2, reps: '8 / side', load: '16 kg', rest: 60 },
          { ex: 'copenhagen-short', sets: 2, hold: 20, perSide: true, rest: 45 },
          { ex: 'dead-bug', sets: 2, reps: '8 / side', rest: 45 },
        ],
      },
      CALF,
      NECK,
    ],
  },
  {
    id: '2026-10-06-walk', date: '2026-10-06', title: 'Walk + push-up test', kind: 'aerobic', minutes: 50,
    summary: 'Flat brisk walk, push-up test, calf and neck.',
    blocks: [
      { title: 'Aerobic', items: [{ ex: 'brisk-walk', hold: 35 * 60 }] },
      { title: 'Baseline (part B)', items: [{ ex: 'push-up-test', reps: 'max · record' }] },
      CALF,
      NECK,
    ],
  },
  {
    id: '2026-10-07-strength-b', date: '2026-10-07', title: 'Strength B', kind: 'strength', minutes: 30,
    summary: 'Light full-body strength — 6/10 effort so nothing is sore by Friday’s tee time.',
    blocks: [
      WARM_UP,
      {
        title: 'Strength B',
        items: [
          { ex: 'split-squat', sets: 2, reps: '8 / side', load: 'bodyweight or 16 kg', rest: 60 },
          { ex: 'single-leg-bridge', sets: 2, reps: '12 / side', rest: 45 },
          { ex: 'kb-floor-press', sets: 2, reps: '10 / side', load: '16 kg', rest: 60 },
          { ex: 'prone-yt', sets: 2, reps: '8 each', rest: 45 },
          { ex: 'side-plank', sets: 2, hold: 30, perSide: true, rest: 45 },
          { ex: 'suitcase-carry', sets: 2, reps: '30 m / side', load: '16 kg', rest: 45 },
        ],
      },
      CALF,
      NECK,
    ],
  },
  {
    id: '2026-10-08-loosen', date: '2026-10-08', title: 'Loosen up', kind: 'mobility', minutes: 30,
    summary: 'Get loose for the tour — finish feeling better than you started.',
    blocks: [
      { title: 'Walk', items: [{ ex: 'brisk-walk', hold: 15 * 60, note: 'Easy pace today.' }] },
      {
        title: 'Mobility',
        items: [
          { ex: 'hip-90-90', reps: '8' },
          { ex: 'hip-flexor-stretch', hold: 45, perSide: true },
          { ex: 'adductor-rockback', reps: '10 / side' },
          { ex: 'open-book', reps: '8 / side' },
          { ex: 'seated-t-rotation', reps: '10 / side' },
        ],
      },
      { title: 'Calf', items: [{ ex: 'calf-iso', sets: 3, hold: 40, rest: 30 }] },
      { title: 'Neck', items: [{ ex: 'thoracic-extension', reps: '5 × 3 levels' }, { ex: 'wall-slide', reps: '10' }] },
    ],
  },
  ...(['2026-10-09', '2026-10-10'].map((date, i): Session => ({
    id: `${date}-golf`, date, title: `Golf tour · day ${i + 1}`, kind: 'golf', minutes: 15,
    summary: 'Warm up before the round, reset in the evening. Walk the course if you can.',
    blocks: [
      {
        title: 'Before the round',
        items: [
          { ex: 'brisk-walk', hold: 120, note: 'Two minutes to get warm.' },
          { ex: 'leg-swings', reps: '10 each way / leg' },
          { ex: 'lunge-rotation', reps: '5 / side' },
          { ex: 'golf-warmup', reps: '10' },
          { ex: 'cat-cow', reps: '5 standing' },
          { ex: 'half-swings', reps: '10 → full' },
        ],
      },
      {
        title: 'Evening reset',
        items: [
          { ex: 'calf-iso', sets: 3, hold: 40, rest: 30 },
          { ex: 'thoracic-extension', reps: '5 × 3 levels' },
          { ex: 'open-book', reps: '8 / side' },
          { ex: 'wall-slide', reps: '10' },
        ],
      },
    ],
  }))),
  {
    id: '2026-10-11-recover', date: '2026-10-11', title: 'Recover + calf go/no-go', kind: 'test', minutes: 60,
    summary: 'Easy family walk, mobility, then the calf test that decides whether running starts.',
    blocks: [
      { title: 'Walk', items: [{ ex: 'brisk-walk', hold: 45 * 60, note: 'Easy — with the family.' }] },
      {
        title: 'Mobility',
        items: [
          { ex: 'hip-90-90', reps: '8' },
          { ex: 'hip-flexor-stretch', hold: 45, perSide: true },
          { ex: 'open-book', reps: '8 / side' },
        ],
      },
      {
        title: 'Calf go/no-go',
        items: [
          { ex: 'single-leg-calf-raise-test', reps: '25 slow on the left · record' },
          { ex: 'single-leg-hop', reps: '20 / leg · record', note: 'Both symptom-free → run-walk next week.' },
        ],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// The big picture — phases, weeks and milestones towards the A-race.
// Weeks beyond the next few are provisional: they get refined in the weekly
// check-in, and the volume ramps higher if the January decision is GCU65.
// ---------------------------------------------------------------------------

export const RACE = {
  name: 'Ultra-Trail Drakensberg',
  date: '2027-04-24', // event runs 23–25 Apr 2027; exact day depends on the distance
  distance: 'SDR36 (≈36 km) — or GCU65 if January says go',
  url: 'https://www.ultratraildrakensberg.com/',
};

export type PhaseId = 'rebuild' | 'foundation' | 'build' | 'mountain' | 'taper' | 'recover';

export const PHASES: Record<PhaseId, { name: string; color: string; why: string }> = {
  rebuild:    { name: 'Rebuild',    color: '#F97316', why: 'Close the gap between engine and tissues: heal the calf, start lifting, return to running gradually.' },
  foundation: { name: 'Foundation', color: '#10B981', why: 'Mostly easy aerobic volume (Seiler’s ~80/20) plus twice-weekly strength. Build the base everything else sits on.' },
  build:      { name: 'Build',      color: '#0EA5E9', why: 'Add one quality session a week (4×4 intervals improve VO2max — Helgerud 2007), hills, and longer trail runs.' },
  mountain:   { name: 'Mountain',   color: '#8B5CF6', why: 'Race-specific: vertical, power-hiking, downhill technique, long runs with race kit and nutrition.' },
  taper:      { name: 'Taper',      color: '#F43F5E', why: 'Cut volume, keep a little intensity, arrive fresh. Fitness doesn’t fade in two weeks; fatigue does.' },
  recover:    { name: 'Recover',    color: '#94A3B8', why: 'Let the body absorb the race. Walk, mobilise, then decide what’s next.' },
};

export interface Week {
  n: number;
  phase: PhaseId;
  title: string;
  focus: string;
  outline: string[];
  km?: string;       // weekly running volume target
  deload?: boolean;
}

export const PLAN_START = '2026-10-05'; // Monday of week 1

const W = (n: number, phase: PhaseId, title: string, focus: string, outline: string[], extra: Partial<Week> = {}): Week =>
  ({ n, phase, title, focus, outline, ...extra });

export const WEEKS: Week[] = [
  W(1, 'rebuild', 'Heal the calf, start lifting', 'No running. Daily calf and neck work, two light strength sessions, golf tour.', ['Strength A & B at 6/10', 'Calf rehab + neck routine daily', 'Flat walks', 'Sun: calf go/no-go test'], { km: '0' }),
  W(2, 'rebuild', 'Run-walk returns', 'If the calf passed: three flat run-walks, building the run portions. Strength twice.', ['3 × run-walk (1 min run / 1 min walk → build)', 'Strength A & B, slightly heavier', 'Calf rehab: add load in hand', 'Order equipment + HR strap'], { km: '6–8' }),
  W(3, 'rebuild', 'Continuous running', 'Progress to 20–30 min continuous at an easy pace. Learn what easy feels like.', ['3 easy runs, 20–30 min', 'Strength A & B', 'Sun: 30 min continuous, pain-free'], { km: '10–12' }),
  W(4, 'foundation', 'Easy means easy', 'Conversational pace, heart rate zone 2. First week with the new kit.', ['3 easy runs incl. one short trail', 'Strength 2× — progress load', 'Yoga / mobility 1×', 'Bloods: ApoB + Lp(a)'], { km: '15–18' }),
  W(5, 'foundation', 'Build the base', 'Add a little volume, nothing faster.', ['3 easy runs', 'Long run 50 min trail', 'Strength 2×'], { km: '18–20' }),
  W(6, 'foundation', 'Strides arrive', 'Add 6 × 20 s strides after one easy run — speed without fatigue.', ['3 easy runs (one with strides)', 'Long run 60 min', 'Strength 2×'], { km: '20–24' }),
  W(7, 'foundation', 'First benchmark', 'Re-test the baseline and run the 12-minute Cooper test for a VO2max estimate.', ['3 easy runs', 'Sat: Cooper test + re-tests', 'Strength 2×'], { km: '22–25' }),
  W(8, 'foundation', 'Deload', 'Cut ~30% volume. Absorb the first block.', ['3 short easy runs', 'Strength 1–2× (lighter)', 'Extra sleep'], { km: '15–18', deload: true }),
  W(9, 'foundation', 'Fourth run', 'Add a short fourth easy run. Long run moves to the trails.', ['4 easy runs', 'Long run 75 min trail', 'Strength 2×'], { km: '26–28' }),
  W(10, 'foundation', 'Easy hills', 'Rolling terrain at easy effort — walk the steep bits.', ['4 runs', 'Long run 80 min with climbing', 'Strength 2×'], { km: '28–32' }),
  W(11, 'foundation', '90 minutes', 'Longest run yet: 90 min easy on trail.', ['4 runs', 'Sat: 90 min trail long run', 'Strength 2×'], { km: '32–35' }),
  W(12, 'foundation', 'Holiday deload', 'Christmas week — keep moving, keep it light, enjoy it.', ['3 easy runs', 'Strength 1×', 'Family hikes count'], { km: '20–24', deload: true }),
  W(13, 'build', 'Quality returns', 'One quality session a week: Norwegian 4 × 4 min hard, 3 min easy.', ['1 × 4×4 intervals', '3 easy runs', 'Long run 1h40', 'Strength 2×'], { km: '34–38' }),
  W(14, 'build', 'Hill repeats', 'Swap intervals for hill repeats: strength-endurance for the climbs.', ['1 × hill repeats', '3 easy runs', 'Long run 1h50 with climbing', 'Strength 2×'], { km: '38–42' }),
  W(15, 'build', 'Decision week', 'Long run of 2 h. Then choose SDR36 or GCU65 and enter.', ['1 quality session', 'Sat: 2 h trail long run', 'Distance decision + entry'], { km: '40–44' }),
  W(16, 'build', 'Deload', 'Lighter week before the second build.', ['3–4 easy runs', 'Strength 1–2×'], { km: '28–32', deload: true }),
  W(17, 'build', 'Back-to-backs', 'Long Saturday, moderate Sunday — learning to run on tired legs.', ['1 quality session', 'Sat long 2h15 + Sun 60 min', 'Strength 2×'], { km: '44–48' }),
  W(18, 'build', '5k time trial', 'Find out where your speed is. Is sub-20 still there?', ['Sat: 5 km time trial', '3 easy runs', 'Long run 1h45 Sun', 'Strength 2×'], { km: '42–46' }),
  W(19, 'build', 'Mountain long run', '2h30 on Table Mountain / Lion’s Head terrain.', ['1 quality session', 'Long run 2h30 mountain', 'Strength 2×'], { km: '46–50' }),
  W(20, 'build', 'Deload', 'Absorb the build block.', ['3–4 easy runs', 'Strength 1–2×'], { km: '32–36', deload: true }),
  W(21, 'mountain', 'Vert + descents', 'Power-hiking practice and downhill technique. Quads get eccentric strength work.', ['Hill power-hike session', 'Long run 2h45 with big descents', 'Strength 2× (step-downs, split squats)'], { km: '48–52' }),
  W(22, 'mountain', 'Tune-up race', 'A 20–25 km trail race: practise pacing, fuelling and kit under race conditions.', ['Sat: tune-up trail race', 'Easy week otherwise', 'Strength 1×'], { km: '40–45' }),
  W(23, 'mountain', 'Fuel the long run', '3 h long run, eating and drinking exactly as on race day.', ['1 quality session', 'Long run 3 h + race nutrition', 'Strength 2×'], { km: '52–56' }),
  W(24, 'mountain', 'Deload', 'The last easy week before the peak.', ['3–4 easy runs', 'Strength 1×'], { km: '36–40', deload: true }),
  W(25, 'mountain', 'Peak block', 'Biggest weekend: back-to-back 3 h + 1h30 on mountain terrain.', ['1 quality session', 'Sat 3 h + Sun 1h30', 'Strength 1–2×'], { km: '55–60' }),
  W(26, 'mountain', 'Dress rehearsal', '3.5–4 h in full race kit, race nutrition, race-pace hiking on the climbs.', ['Sat: dress rehearsal', '3 easy runs', 'Strength 1×'], { km: '50–55' }),
  W(27, 'taper', 'Ease down', 'Volume −25%. Keep one short quality session so the legs stay sharp.', ['Short 4×4 or hills', '3 easy runs', 'Long run 1h45', 'Strength 1× light'], { km: '38–42' }),
  W(28, 'taper', 'Taper', 'Volume −40%. Strides, sleep, carbs in the last days. Nothing new.', ['3 short runs with strides', 'Kit + logistics check', 'Strength: mobility only'], { km: '25–30' }),
  W(29, 'taper', 'Race week', 'Drakensberg. Two short shakeouts, travel, race.', ['Tue + Thu: 30 min shakeouts', 'Travel to the Berg', 'Race day'], { km: 'race' }),
  W(30, 'recover', 'Recover', 'No running for 5–7 days. Walk, mobilise, sleep. Then a debrief and the next goal.', ['Walks + mobility', 'Debrief with coach'], { km: '0–10' }),
];

export type MilestoneKind = 'health' | 'run' | 'test' | 'decision' | 'race';

export interface Milestone {
  id: string;
  date: string;
  title: string;
  detail: string;
  kind: MilestoneKind;
  big?: boolean;
}

export const MILESTONES: Milestone[] = [
  { id: 'calf-go', date: '2026-10-11', kind: 'test', title: 'Calf cleared', detail: '25 slow single-leg raises + 20 hops on the left, symptom-free → run-walk starts.' },
  { id: 'run-30', date: '2026-10-25', kind: 'run', title: '30 min continuous', detail: 'Easy pace, pain-free during and the next morning.' },
  { id: 'bloods', date: '2026-10-31', kind: 'health', title: 'Bloods: ApoB + Lp(a)', detail: 'Family cardiac history — Lp(a) is a once-in-a-lifetime test.' },
  { id: 'cooper', date: '2026-11-21', kind: 'test', title: 'First fitness benchmark', detail: '12-min Cooper test (VO2max ≈ (m − 504.9) ÷ 44.73) + baseline re-tests.' },
  { id: 'long-90', date: '2026-12-19', kind: 'run', title: '90 min trail run', detail: 'Easy effort, on trail, feeling good at the end.' },
  { id: 'decision', date: '2027-01-16', kind: 'decision', title: 'Choose the distance', detail: 'SDR36 or GCU65. Go for 65 if: 2 h long run comfortable, three weeks at 40+ km, zero niggles.' },
  { id: '5k-tt', date: '2027-02-06', kind: 'test', title: '5 km time trial', detail: 'Where is the speed? Sub-20 is the old benchmark.' },
  { id: 'tune-up', date: '2027-03-06', kind: 'race', title: 'Tune-up trail race', detail: '20–25 km — pacing, fuelling and kit under race conditions.' },
  { id: 'rehearsal', date: '2027-04-03', kind: 'run', title: 'Dress rehearsal', detail: '3.5–4 h in full kit with race nutrition.' },
  { id: 'utd', date: RACE.date, kind: 'race', big: true, title: 'Ultra-Trail Drakensberg', detail: '23–25 April 2027, Maloti-Drakensberg. The big one.' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;
const noon = (date: string) => new Date(`${date}T12:00:00`).getTime();

export const addDays = (date: string, days: number) => localDate(new Date(noon(date) + days * DAY_MS));

export const daysBetween = (from: string, to: string) => Math.round((noon(to) - noon(from)) / DAY_MS);

export const weekStart = (n: number) => addDays(PLAN_START, (n - 1) * 7);

/** Week number a date falls in (can be < 1 or beyond the plan). */
export const weekOf = (date: string) => Math.floor(daysBetween(PLAN_START, date) / 7) + 1;

export const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Today's session, else the next one, else the most recent. */
export function defaultSessionIndex(sessions: Session[], today = localDate()): number {
  const exact = sessions.findIndex(s => s.date === today);
  if (exact >= 0) return exact;
  const next = sessions.findIndex(s => s.date > today);
  if (next >= 0) return next;
  return Math.max(0, sessions.length - 1);
}

export interface Step {
  block: string;
  rx: Prescription;
  exercise: Exercise;
}

export const flattenSession = (s: Session): Step[] =>
  s.blocks.flatMap(b => b.items.map(rx => ({ block: b.title, rx, exercise: getExercise(rx.ex) })));

/**
 * The rounds an exercise is made of — what Space ticks through. A per-side
 * timed hold runs left then right within each set; rep work counts per set
 * (sides are done inside the set).
 */
export function roundsFor(rx: Prescription): string[] {
  const sets = rx.sets ?? 1;
  const out: string[] = [];
  for (let i = 1; i <= sets; i++) {
    const base = sets > 1 ? `Set ${i}` : '';
    if (rx.hold && rx.perSide) {
      out.push(base ? `${base} · Left` : 'Left', base ? `${base} · Right` : 'Right');
    } else {
      out.push(base || 'Go');
    }
  }
  return out;
}

export const fmtClock = (secs: number) => {
  const s = Math.max(0, Math.ceil(secs));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
};

export const fmtHold = (secs: number) => (secs >= 60 && secs % 60 === 0 ? `${secs / 60} min` : `${secs}s`);

/** "2 × 10 · 16 kg", "4 × 40s", "2 × 20s / side" */
export function describeRx(rx: Prescription): string {
  const sets = rx.sets ?? 1;
  const amount = rx.hold ? `${fmtHold(rx.hold)}${rx.perSide ? ' / side' : ''}` : rx.reps ?? '';
  const main = sets > 1 ? `${sets} × ${amount}` : amount;
  return rx.load ? `${main} · ${rx.load}` : main;
}
