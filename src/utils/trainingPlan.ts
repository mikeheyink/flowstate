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
  restLabel?: string;    // what the rest is called — "Walk" in a run-walk
  /** Items in a block sharing a superset key alternate set by set; the rest
   *  comes after the last one in the group (its `rest`). */
  superset?: string;
}

export interface Block {
  title: string;
  items: Prescription[];
  /** Can be done now or later in the day — not counted in the core time. */
  anytime?: boolean;
}

export type SessionKind = 'strength' | 'aerobic' | 'mobility' | 'golf' | 'test';

export interface Session {
  id: string;
  date: string;          // local YYYY-MM-DD
  title: string;
  kind: SessionKind;
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
    id: 'rfe-split-squat', name: 'Rear-foot-elevated split squat',
    cue: 'Back foot on the couch, drop straight down over 3 s',
    how: ['Stand a long stride in front of a couch or bench, laces of the back foot on it.', 'Hands on hips. No bell while the right biceps settles.', 'Lower the back knee towards the floor over 3 s, front heel planted.', 'Drive up through the whole front foot.'],
    avoid: ['Front heel lifting.', 'Pushing off the back foot. It’s only a kickstand.'],
    why: 'The next step up from the split squat: much more load on the front leg with nothing in your hands.',
  },
  {
    id: 'step-up', name: 'Step-up, slow step-down',
    cue: 'Drive through the top foot, then lower over 3 s',
    how: ['Use a knee-height step or bench.', 'Put the whole foot on the step and drive up through it without pushing off the back foot.', 'Step down slowly over 3 s, with the top leg controlling it.', 'Do all the reps on one side, then switch.'],
    why: 'Single-leg strength for the climbs, plus slow eccentric control for the descents. Downhills are what wreck quads on Drakensberg passes.',
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
  {
    id: 'kb-swing', name: 'One-arm swing (left)',
    cue: 'Snap the hips. The arm is a rope, not a lifter',
    how: ['Feet a bit wider than hips, bell a step in front of you.', 'Hike it back between the legs with the left hand, like a centre snap.', 'Drive the hips forward hard so the bell floats to chest height. Stand tall and squeeze the glutes at the top.', 'Let it fall back and hinge again. Free (right) hand stays relaxed by your side.'],
    avoid: ['Squatting it up. It’s a hinge: hips back, shins nearly vertical.', 'Lifting with the arm or shrugging.', 'Using the right hand, even to switch.'],
    why: 'Fast, powerful hip extension: glutes and hamstrings for the climbs, and a big conditioning hit from a single 16 kg bell.',
  },
  {
    id: 'adductor-squeeze', name: 'Adductor squeeze',
    cue: 'Pillow between the knees, squeeze 5 s at 50–70%',
    how: ['On your back, knees bent, feet flat.', 'Put a firm pillow, rolled towel or football between the knees.', 'Squeeze for 5 s, release slowly. That’s one rep.'],
    why: 'The gentlest way to load the groin. Squeeze strength is what physios track after groin strains.',
  },
  {
    id: 'side-lying-adduction', name: 'Side-lying adduction lift',
    cue: 'Bottom leg straight up 10–15 cm, 3 s down',
    how: ['Lie on your side, head resting on your arm.', 'Bend the top leg and plant its foot on the floor in front of you.', 'Lift the straight bottom leg 10–15 cm, pause 1 s, lower over 3 s.'],
    why: 'The Copenhagen movement without a bench. Inner-thigh strength protects the groin on uneven trail.',
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

  // Rehab
  {
    id: 'elbow-iso', name: 'Biceps isometric (right)',
    cue: 'Gentle push up into the table — 30% effort, pain 0–2/10',
    how: ['Sit side-on to a table, right elbow bent 90°, thumb pointing up.', 'Press the back of your fist up into the underside of the table, gently (~30% effort).', 'Hold, breathe, release slowly.', 'Pain up to 3/10 is OK if it’s settled by the next morning. Worse than that: halve the effort.', 'Once 45 s at 50% is easy and pain-free, turn the palm up (that loads the biceps more).'],
    avoid: ['Hanging, pull-ups, curls, arm wrestling.', 'Twins on the right arm. Use the left arm or both arms, keeping them close to your body with palms down where you can.', 'Carrying bags or the bell in the right hand.'],
    why: 'Stage 1 of the arm rehab. Isometrics load an irritated tendon without the movement that aggravates it and often ease pain in the short term (the evidence is mixed, but the risk is low). It keeps the tendon loaded while it settles.',
  },

  // Aerobic
  {
    id: 'run-walk', name: 'Run-walk',
    cue: 'Run easy enough to chat — walk briskly between',
    how: ['Flat route (the promenade).', 'Run at a truly easy, conversational pace.', 'Walk briskly through every walk interval — don’t skip them.', 'Calf up to 2/10 is fine if it’s gone by the next morning. Sharper than that: stop and walk home.'],
    why: 'Graded return to running: small, repeatable doses let the healing calf adapt without a re-strain. Progress only when the previous session left no next-morning symptoms.',
  },
  {
    id: 'trail-run-walk', name: 'Trail run-walk',
    cue: 'Walk every climb — run the flats and gentle descents',
    how: ['Smooth, non-technical trail: jeep track or contour path, not rocks or roots.', 'Run only the flats and gentle descents at a talk-test pace. Walk every climb briskly.', 'Use short, quick steps on descents, and stay off sections where you’d need your hands.', 'Calf up to 2/10 is fine if it’s gone by the next morning. If it gets sharper, walk home.'],
    why: 'Climbing loads the calf more than flat running, so walking the climbs keeps today close to Thursday’s load while the uneven ground starts training your feet and ankles for the Berg.',
  },
  {
    id: 'easy-run', name: 'Easy run',
    cue: 'Talk-test easy: full sentences, never just a few words',
    how: ['Flat route (the promenade).', 'Run slowly enough to speak in full sentences. If you can only manage a few words, slow down or walk.', 'With the HR strap, stay roughly under 140 bpm (about 75% of an estimated max of ~181, from 208 − 0.7 × age). We’ll refine this from your real data.', 'Calf up to 2/10 is fine if it’s gone by the next morning.'],
    why: 'Most endurance volume should be truly easy (Seiler’s ~80/20). Your easy runs drift into the grey zone, which is hard enough to add fatigue but brings neither the base-building of easy running nor the stimulus of real intervals.',
  },
  {
    id: 'pogo-hops', name: 'Pogo hops',
    cue: 'Stiff ankles, quick contacts, small bounces',
    how: ['Both feet, hands on hips.', 'Bounce on the balls of the feet with knees nearly straight and heels barely kissing the floor.', 'Get off the floor quickly, as if it’s hot.', 'Stop if the left calf goes above 2/10.'],
    why: 'Low-level plyometrics train the calf–Achilles spring. Strength and plyometric work improve running economy (Balsalobre-Fernández et al., meta-analysis, 2016). It’s also the bridge from calf rehab to calf performance.',
  },
  {
    id: 'strides', name: 'Strides',
    cue: 'Smooth and quick, about 85% effort. Never a sprint',
    how: ['Flat, straight, soft ground (grass or the promenade).', 'Build up over 5 s, hold a relaxed, fast stride for about 15 s, then ease off over 5 s.', 'Walk back slowly until your breathing is fully calm. That is the rest.', 'Stay tall with quick, light steps. If the calf, a hip or the groin twinges, stop. That’s the set.'],
    avoid: ['Sprinting flat out.', 'Over-striding. Quick light steps beat long reaching ones.'],
    why: 'Short fast strides train running form and the calf–Achilles spring at almost no fatigue cost, a good bridge to harder running later.',
  },
  {
    id: 'trail-long-run', name: 'Long trail run',
    cue: 'Easy enough to talk the whole way. Power-hike the steep climbs',
    how: ['Your usual trail is fine.', 'Talk-test easy on the flats, roughly under 140 bpm. It should feel too easy for the first half.', 'Power-hike anything steep: short steps, hands on hips or swinging. Don’t push on the knees with the right hand.', 'Take water. Over 75 min, take something to eat as well.', 'Right calf: tightness that eases as you warm up is OK. A sharp or growing pain means walk home.'],
    why: 'Time on feet at an easy effort builds the aerobic base and the legs for the Berg. Easy is what makes it repeatable week after week.',
  },
  {
    id: 'calf-single', name: 'Single-leg calf raise',
    cue: 'All the way up, 3 s down. Left leg first',
    how: ['Fingertip on the wall for balance.', 'Rise as high as you can on one foot.', 'Lower slowly over 3 s.'],
    why: 'The next step after two-up-one-down: full single-leg loading through the whole range.',
    video: { id: 'fSXnnvgKST4' },
  },
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
  {
    id: 'cooper-test', name: 'Cooper test',
    cue: '12 minutes, as far as you can, evenly paced',
    how: ['Flat, measurable route: a track, or a flat stretch of promenade with the watch on GPS.', 'Start the watch and run as far as you can in exactly 12 minutes.', 'Go out at a pace you can hold. The last 3 minutes should be really hard.', 'Record the distance in metres. VO2max ≈ (metres − 504.9) ÷ 44.73.'],
    avoid: ['Sprinting the first lap.', 'Doing it with a sore calf. A tight calf that isn’t easing means postpone.'],
    why: 'A simple, repeatable fitness benchmark. Re-test every 8–10 weeks to see the base building.',
  },
];

// Demo videos — short (≤60 s) exercise-library clips that show the movement
// from the first frame, so they loop cleanly. IDs verified via oEmbed.
const VIDEOS: Record<string, { id: string; start?: number }> = {
  'cat-cow': { id: 'FLQDiUccsko' },                      // E3 Rehab · 11s
  'worlds-greatest-stretch': { id: 'pO3KPQ5fzJ0' },      // The Active Life · 30s
  'glute-bridge': { id: '_bCmHW_mLCU' },                 // E3 Rehab · 30s
  'goblet-squat': { id: 'aIfDo1Ctpl8' },                 // Fibre Active · 16s
  'push-up': { id: 'WDIpL0pjun0' },                      // NASM · 14s
  'push-up-test': { id: 'WDIpL0pjun0' },
  'kb-row': { id: 'yA1E9DlA3Vc' },                       // Fusion Sports PT · 17s
  'kb-single-leg-rdl': { id: '-w3gokw_s7w' },            // OPEX · 19s
  'copenhagen-short': { id: 'p2xXd1fPh2A' },             // E3 Rehab · 11s
  'dead-bug': { id: 'BZYaCzbP09M' },                     // E3 Rehab · 19s
  'calf-iso': { id: 'YM2M1_Al5fo' },                     // Competitive Edge PT · 17s
  'calf-eccentric': { id: 'difh8uVDwSs' },               // E3 Rehab · 19s
  'calf-bent-knee': { id: '-9WJeQzqhBs' },               // OPEX · 11s
  'split-squat': { id: 'Py2Qeg-D5T0' },                  // OPEX · 14s
  'rfe-split-squat': { id: '3fxmRoIE_fk' },              // OPEX · 12s
  'step-up': { id: 'Q1XT6Va1IsU' },                      // Garrett McLaughlin · 28s
  'elbow-iso': { id: 'p0-mFWMh0xo' },                    // Feel Good Life · 14s (press up into a table)
  'pogo-hops': { id: 'WNf2vCLncgY' },                    // Rich Hill · 16s
  'single-leg-bridge': { id: 'U9M8dsoRYzU' },            // E3 Rehab · 14s
  'kb-floor-press': { id: 'P_ijh09h23s' },               // OPEX · 15s
  'prone-yt': { id: 'QdGTI4Lshg4' },                     // The Active Life · 31s (Y, T and W)
  'side-plank': { id: 'eRygfYEe1hs' },                   // E3 Rehab · 11s
  'suitcase-carry': { id: 'Q1GjhRDAil0' },               // Rehab My Patient · 42s
  'thoracic-extension': { id: '9Y11Kc0E0og' },           // Rehab My Patient · 48s
  'open-book': { id: 'TgPyqddUdrM' },                    // Rehab Hero · 15s
  'wall-slide': { id: 'cvx06snMQ3A' },                   // Rehab My Patient · 31s
  'upper-trap-stretch': { id: 'EjkFVidgy7o' },           // E3 Rehab · 15s
  'hip-90-90': { id: '6tcOGbrG3l0' },                    // Theory of Motion · 20s
  'hip-flexor-stretch': { id: 'Bfb-9dIWEr4' },           // Live Lean TV · 42s
  'adductor-rockback': { id: '1sSnSh-yKJU' },            // E3 Rehab · 19s
  'seated-t-rotation': { id: 'uGl-AG4C1Wc' },            // 28s
  'leg-swings': { id: 'D17eUtUt0zQ' },                   // MyPhysioRehab · 26s
  'lunge-rotation': { id: 'dwj78Ir6ZE8' },               // Rehab My Patient · 48s
  'golf-warmup': { id: 'QTpvGIdJYWo' },                  // David Franks Golf · 43s
  'sitting-rising-test': { id: 'diVoA2_tpIc' },          // Movement Physio · 7s
  'knee-to-wall': { id: 'KmiPXKmoUbs' },                 // E3 Rehab · 14s
  'single-leg-calf-raise-test': { id: 'fSXnnvgKST4' },   // 16s
  'single-leg-hop': { id: '6yOw02lrmu8' },               // Theory of Motion · 8s
  // Picked from search results on 16 Nov: YouTube was unreachable from the
  // session, so these are NOT oEmbed-verified. Swap any that don't play.
  'arm-circles': { id: 'RN40wyH6x9o' },                  // "How To Do Arm Circles Properly for Beginners" · short
  'kb-swing': { id: '5ESeF0kmo0k' },                     // "Single Arm Russian Kettlebell Swing" · short
  'adductor-squeeze': { id: 'VvdBX1cD_to' },             // "Isometric Adduction Squeezes with Ball"
  'side-lying-adduction': { id: 'RYNirxq46Tw' },         // "Sidelying Hip Adductor Isotonics for Early Groin Rehab" · short
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

// Week 2 progressions: 3 sets at ~7/10, calf work goes single-leg.
const CALF_2: Block = {
  title: 'Calf rehab',
  items: [
    { ex: 'calf-iso', sets: 4, hold: 45, rest: 30, note: 'Left leg only now.' },
    { ex: 'calf-single', sets: 3, reps: '12', rest: 60 },
    { ex: 'calf-bent-knee', sets: 2, reps: '12 · left only', rest: 60 },
  ],
};

const NECK_2: Block = {
  title: 'Neck & upper back',
  items: [
    { ex: 'thoracic-extension', reps: '5 × 3 levels' },
    { ex: 'open-book', reps: '8 / side' },
    { ex: 'wall-slide', reps: '10' },
  ],
};

// Week 3: calf rehab graduates into calf strength and spring, using both legs.
const CALF_3: Block = {
  title: 'Calf strength',
  items: [
    { ex: 'calf-single', sets: 3, reps: '15 / side', rest: 60, note: 'Left first. Once 15 is easy, hold the 16 kg in the LEFT hand.' },
    { ex: 'calf-bent-knee', sets: 2, reps: '15', rest: 45 },
    { ex: 'pogo-hops', sets: 2, reps: '20 contacts', rest: 60 },
  ],
};

// The neck gets sore after long stretches in one position, so the fix is
// moving often, not more stretching.
const DESK: Block = {
  title: 'Desk reset · every 45–60 min',
  anytime: true,
  items: [
    { ex: 'seated-t-rotation', reps: '10 / side', note: 'Set a timer. Stand, do these, walk to refill your water.' },
    { ex: 'wall-slide', reps: '10' },
  ],
};

// Right biceps: a distal strain from arm wrestling (golf tour, 9–10 Oct),
// re-flared by a dead-hang contest on 18 Oct. Self-checks on 19 Oct ruled out
// a complete rupture (no pop or bruising, normal contour, hook test cord
// present, turning strength intact). Staged rehab, criteria-based; see MILESTONES.
const ARM: Block = {
  title: 'Right arm rehab · any time',
  anytime: true,
  items: [{ ex: 'elbow-iso', sets: 5, hold: 45, rest: 30, note: 'Daily. 30–50% effort. Pain up to 3/10 is OK if it’s gone by the next morning.' }],
};
const ELBOW = ARM;

// Week 4: the right biceps was re-strained at beach volleyball and touch rugby
// (22 Oct). Isometrics drop back to a lower effort, shorter holds; the hips are
// stiff after the same day, so they get their own reset.
const ARM_4: Block = {
  title: 'Right arm rehab · any time',
  anytime: true,
  items: [{ ex: 'elbow-iso', sets: 4, hold: 30, rest: 30, note: 'Daily, but only 20–30% effort this week. Pain 0–2/10. If it’s worse the next morning, skip a day.' }],
};

const HIPS: Block = {
  title: 'Hip reset · now or evening',
  anytime: true,
  items: [
    { ex: 'hip-90-90', reps: '8' },
    { ex: 'hip-flexor-stretch', hold: 45, perSide: true },
    { ex: 'adductor-rockback', reps: '10 / side' },
  ],
};

// Week 7: back from two weeks of travel and near-daily running. The right calf
// is tight and getting tighter each morning, the neck spasms at night, and the
// right biceps is no better after four weeks because lifting the twins keeps
// re-irritating it. Nobody has examined the arm or neck yet.
const WARM_UP_HIPS: Block = {
  title: 'Warm-up',
  items: [
    { ex: 'cat-cow', reps: '8 slow' },
    { ex: 'worlds-greatest-stretch', reps: '4 / side' },
    { ex: 'hip-90-90', reps: '8' },
    { ex: 'glute-bridge', reps: '10' },
    { ex: 'arm-circles', reps: '10 each way' },
  ],
};

const CALF_7: Block = {
  title: 'Calf strength · now or evening',
  anytime: true,
  items: [
    { ex: 'calf-single', sets: 3, reps: '12 / side', rest: 60, note: 'Right calf: slow and full range. Tightness is fine, pain isn’t.' },
    { ex: 'calf-bent-knee', sets: 3, reps: '15', rest: 45, note: 'The soleus takes the biggest load when you run. It’s usually the tight one.' },
  ],
};

const CALF_8: Block = {
  ...CALF_7,
  items: [
    { ex: 'calf-single', sets: 3, reps: '15 / side', rest: 60, note: 'Once 15 is easy on both legs, hold the 16 kg in the LEFT hand.' },
    { ex: 'calf-bent-knee', sets: 3, reps: '15 · single leg', rest: 45 },
    { ex: 'pogo-hops', sets: 2, reps: '20 contacts', rest: 60, note: 'Only if the right calf isn’t tight in the mornings any more.' },
  ],
};

const ARM_7: Block = {
  title: 'Right arm rehab · any time',
  anytime: true,
  items: [{ ex: 'elbow-iso', sets: 5, hold: 30, rest: 30, note: 'Daily at 30% effort. Lift the twins with both arms, palms down and close to your body. Avoid a palm-up, arm-out lift.' }],
};

const NECK_7: Block = { ...NECK_2, title: 'Neck · before bed', anytime: true };

const ADDUCTORS: Prescription[] = [
  { ex: 'adductor-squeeze', sets: 2, reps: '10 × 5 s', superset: 'c' },
  { ex: 'side-lying-adduction', sets: 2, reps: '12 / side', rest: 45, superset: 'c' },
];

const run = (minutes: number, note?: string): Block => ({
  title: 'Run',
  items: [
    { ex: 'brisk-walk', hold: 5 * 60, note: 'Warm-up walk.' },
    { ex: 'easy-run', hold: minutes * 60, note },
    { ex: 'brisk-walk', hold: 5 * 60, note: 'Cool-down walk.' },
  ],
});

const runWalk = (reps: number, run: number, walk: number, note?: string): Block => ({
  title: 'Run-walk',
  items: [
    { ex: 'brisk-walk', hold: 5 * 60, note: 'Warm-up walk.' },
    { ex: 'run-walk', sets: reps, hold: run, rest: walk, restLabel: 'Walk', note },
    { ex: 'brisk-walk', hold: 5 * 60, note: 'Cool-down walk.' },
  ],
});

// ---------------------------------------------------------------------------
// Sessions — week of 5 Oct 2026 (calf healing, golf tour Fri/Sat)
// ---------------------------------------------------------------------------

export const SESSIONS: Session[] = [
  {
    id: '2026-10-05-strength-a', date: '2026-10-05', title: 'Strength A', kind: 'strength',
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
    id: '2026-10-06-walk', date: '2026-10-06', title: 'Walk + push-up test', kind: 'aerobic',
    summary: 'Flat brisk walk, push-up test, calf and neck.',
    blocks: [
      { title: 'Aerobic', items: [{ ex: 'brisk-walk', hold: 35 * 60 }] },
      { title: 'Baseline (part B)', items: [{ ex: 'push-up-test', reps: 'max · record' }] },
      CALF,
      NECK,
    ],
  },
  {
    id: '2026-10-07-strength-b', date: '2026-10-07', title: 'Strength B', kind: 'strength',
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
    id: '2026-10-08-loosen', date: '2026-10-08', title: 'Loosen up', kind: 'mobility',
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
    id: `${date}-golf`, date, title: `Golf tour · day ${i + 1}`, kind: 'golf',
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
    id: '2026-10-11-recover', date: '2026-10-11', title: 'Recover + calf go/no-go', kind: 'test',
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

  // ---- Week 2 · 12 Oct — run-walk returns -------------------------------
  {
    id: '2026-10-12-strength-a', date: '2026-10-12', title: 'Strength A', kind: 'strength',
    summary: 'Same exercises, 3 sets at 7/10, paired into supersets. Calf + neck can move to the evening.',
    blocks: [
      WARM_UP,
      {
        title: 'Strength A',
        items: [
          { ex: 'goblet-squat', sets: 3, reps: '12 · 3 s down', load: '16 kg', superset: 'a' },
          { ex: 'kb-row', sets: 3, reps: '12 / side', load: '16 kg', rest: 60, superset: 'a' },
          { ex: 'push-up', sets: 3, reps: 'stop 3 short', superset: 'b' },
          { ex: 'kb-single-leg-rdl', sets: 3, reps: '10 / side', load: '16 kg', rest: 60, superset: 'b' },
          { ex: 'copenhagen-short', sets: 3, hold: 25, perSide: true, superset: 'c' },
          { ex: 'dead-bug', sets: 3, reps: '10 / side', rest: 45, superset: 'c' },
        ],
      },
      { ...CALF_2, title: 'Calf rehab · now or evening', anytime: true },
      { ...NECK_2, title: 'Neck · now or evening', anytime: true },
    ],
  },
  {
    id: '2026-10-13-run-walk', date: '2026-10-13', title: 'Run-walk 1', kind: 'aerobic',
    summary: 'First run back. Flat, easy, 8 × 1 min run / 1 min walk. Calf not cleared? Brisk 40 min walk instead.',
    blocks: [runWalk(8, 60, 60), { title: 'Calf', items: [{ ex: 'calf-iso', sets: 3, hold: 45, rest: 30, note: 'Left leg only.' }] }],
  },
  {
    id: '2026-10-14-strength-b', date: '2026-10-14', title: 'Strength B', kind: 'strength',
    summary: 'Right biceps protected: no loaded elbow bending, no weight in the right hand. Legs and trunk get the work.',
    blocks: [
      WARM_UP,
      {
        title: 'Strength B',
        items: [
          { ex: 'split-squat', sets: 3, reps: '12 / side', load: 'bodyweight · hands on hips', superset: 'a', note: 'No kettlebell — holding it loads the biceps. Slow 3 s down instead.' },
          { ex: 'push-up', sets: 3, reps: 'stop 3 short', rest: 60, superset: 'a', note: 'Only if the right elbow stays at 0–2/10. Otherwise skip.' },
          { ex: 'single-leg-bridge', sets: 3, reps: '12 / side', superset: 'b' },
          { ex: 'prone-yt', sets: 3, reps: '8 each · no weight', rest: 45, superset: 'b' },
          { ex: 'copenhagen-short', sets: 3, hold: 25, perSide: true, superset: 'c' },
          { ex: 'side-plank', sets: 3, hold: 30, perSide: true, rest: 45, superset: 'c', note: 'Right side: stop if the elbow complains.' },
        ],
      },
      { ...CALF_2, title: 'Calf rehab · now or evening', anytime: true },
      { ...NECK_2, title: 'Neck · now or evening', anytime: true },
    ],
  },
  {
    id: '2026-10-15-run-walk', date: '2026-10-15', title: 'Run-walk 2', kind: 'aerobic',
    summary: '6 × 2 min run / 1 min walk — only if Tuesday left nothing the next morning. Otherwise repeat Tuesday.',
    blocks: [runWalk(6, 120, 60), { title: 'Calf', items: [{ ex: 'calf-iso', sets: 3, hold: 45, rest: 30, note: 'Left leg only.' }] }, { title: 'Right elbow', items: [{ ex: 'elbow-iso', sets: 5, hold: 30, rest: 30, note: 'Only once the soreness is settling — pain 0–2/10.' }] }],
  },
  {
    id: '2026-10-16-mobility', date: '2026-10-16', title: 'Mobility', kind: 'mobility',
    summary: 'Hips, mid-back and calf — an easy day that keeps the habit.',
    blocks: [
      {
        title: 'Mobility',
        items: [
          { ex: 'worlds-greatest-stretch', reps: '4 / side' },
          { ex: 'hip-90-90', reps: '10' },
          { ex: 'hip-flexor-stretch', hold: 45, perSide: true },
          { ex: 'adductor-rockback', reps: '10 / side' },
          { ex: 'seated-t-rotation', reps: '10 / side' },
        ],
      },
      CALF_2,
      NECK_2,
      { title: 'Right elbow', items: [{ ex: 'elbow-iso', sets: 5, hold: 30, rest: 30, note: 'Only once the soreness is settling — pain 0–2/10.' }] },
    ],
  },
  {
    id: '2026-10-17-trail', date: '2026-10-17', title: 'Trail run-walk', kind: 'aerobic',
    summary: 'First trail outing (swapped in for Run-walk 3). Smooth trail, walk every climb, about 18 min of running in total. Tomorrow morning’s calf decides next week.',
    blocks: [
      {
        title: 'Trail',
        items: [
          { ex: 'brisk-walk', hold: 5 * 60, note: 'Warm-up walk on the trail.' },
          { ex: 'trail-run-walk', sets: 6, hold: 180, rest: 60, restLabel: 'Walk', note: 'Run up to 3 min, then walk 1 min. Walk every climb, even mid-interval.' },
          { ex: 'brisk-walk', hold: 5 * 60, note: 'Cool-down walk.' },
        ],
      },
      { title: 'Right elbow', items: [{ ex: 'elbow-iso', sets: 5, hold: 30, rest: 30, note: 'Only if the elbow is at 0–2/10. Otherwise skip it.' }] },
    ],
  },
  {
    id: '2026-10-18-rest', date: '2026-10-18', title: 'Family walk', kind: 'aerobic',
    summary: 'Easy walk with the girls. Check the left calf when you wake up: anything left over from the trail means next week starts a step back.',
    blocks: [
      { title: 'Walk', items: [{ ex: 'brisk-walk', hold: 45 * 60, note: 'Easy — with the family.' }] },
      { title: 'Calf', items: [{ ex: 'calf-iso', sets: 3, hold: 45, rest: 30, note: 'Left leg only.' }] },
      { title: 'Right elbow', items: [{ ex: 'elbow-iso', sets: 5, hold: 30, rest: 30, note: 'Only once the soreness is settling — pain 0–2/10.' }] },
    ],
  },
  // ---- Week 3 · 19 Oct: continuous running, right arm off-limits ----------
  // Runs on Tue/Thu/Sat give 48 h between each. Each one progresses only if the
  // last left nothing the next morning; otherwise repeat it.
  {
    id: '2026-10-19-strength-a', date: '2026-10-19', title: 'Strength A', kind: 'strength',
    summary: 'Legs get heavier with the bell in a backpack. The right arm stays out of it: no push-ups this week, nothing in the right hand. Arm isometrics start Wednesday, once the flare settles.',
    blocks: [
      WARM_UP,
      {
        title: 'Strength A',
        items: [
          { ex: 'rfe-split-squat', sets: 4, reps: '8 / side · 3 s down', load: 'backpack · 16 kg', superset: 'a', note: 'Set 1 bodyweight to learn it. If it’s smooth, put the bell in a backpack for sets 2–4. Put the pack on with the left arm, or sit to put it on.' },
          { ex: 'kb-row', sets: 4, reps: '12 · left arm only', load: '16 kg', rest: 60, superset: 'a', note: 'Right arm rests on the bench. No rowing with it until it’s pain-free.' },
          { ex: 'kb-single-leg-rdl', sets: 3, reps: '10 / side', load: '16 kg', superset: 'b', note: 'Bell in the LEFT hand for both legs.' },
          { ex: 'dead-bug', sets: 3, reps: '10 / side', rest: 60, superset: 'b' },
          { ex: 'copenhagen-short', sets: 3, hold: 30, perSide: true, rest: 45, note: 'Right side: drop to your knees or skip it if leaning on the forearm hurts.' },
        ],
      },
      { ...CALF_3, title: 'Calf strength · now or evening', anytime: true },
      DESK,
    ],
  },
  {
    id: '2026-10-20-run', date: '2026-10-20', title: 'Easy run 1', kind: 'aerobic',
    summary: '3 × 6 min run / 1 min walk, flat. Talk-test easy: if you can’t speak in full sentences, slow down.',
    blocks: [
      {
        title: 'Run',
        items: [
          { ex: 'brisk-walk', hold: 5 * 60, note: 'Warm-up walk.' },
          { ex: 'easy-run', sets: 3, hold: 6 * 60, rest: 60, restLabel: 'Walk' },
          { ex: 'brisk-walk', hold: 5 * 60, note: 'Cool-down walk.' },
        ],
      },
      { ...NECK_2, title: 'Neck · now or evening', anytime: true },
      DESK,
    ],
  },
  {
    id: '2026-10-21-strength-b', date: '2026-10-21', title: 'Strength B', kind: 'strength',
    summary: 'Climbing and descending strength: loaded step-ups with slow step-downs. Right arm rehab starts today.',
    blocks: [
      WARM_UP,
      {
        title: 'Strength B',
        items: [
          { ex: 'step-up', sets: 3, reps: '10 / side', load: 'backpack · 16 kg', superset: 'a', note: 'If Monday’s split squats left you very sore, use bodyweight.' },
          { ex: 'prone-yt', sets: 3, reps: '8 each · no weight', rest: 45, superset: 'a' },
          { ex: 'single-leg-bridge', sets: 3, reps: '15 / side', superset: 'b' },
          { ex: 'side-plank', sets: 3, hold: 35, perSide: true, rest: 45, superset: 'b', note: 'Right side: stop if the elbow complains, or drop to the knees.' },
          { ex: 'suitcase-carry', sets: 3, reps: '40 m · left hand only', load: '16 kg', superset: 'c', note: 'Walk 40 m out and back with the bell in the left hand. Stay level.' },
          { ex: 'copenhagen-short', sets: 3, hold: 30, perSide: true, rest: 45, superset: 'c' },
        ],
      },
      { ...CALF_3, title: 'Calf strength · now or evening', anytime: true },
      ARM,
      DESK,
    ],
  },
  {
    id: '2026-10-22-run', date: '2026-10-22', title: 'Easy run 2', kind: 'aerobic',
    summary: '2 × 10 min run / 1 min walk. Same easy effort; it should feel easier than Tuesday, not faster.',
    blocks: [
      {
        title: 'Run',
        items: [
          { ex: 'brisk-walk', hold: 5 * 60, note: 'Warm-up walk.' },
          { ex: 'easy-run', sets: 2, hold: 10 * 60, rest: 60, restLabel: 'Walk' },
          { ex: 'brisk-walk', hold: 5 * 60, note: 'Cool-down walk.' },
        ],
      },
      ELBOW,
      DESK,
    ],
  },
  {
    id: '2026-10-23-mobility', date: '2026-10-23', title: 'Mobility', kind: 'mobility',
    summary: 'An easy day before Saturday’s 30 minutes. No calf loading today.',
    blocks: [
      {
        title: 'Mobility',
        items: [
          { ex: 'worlds-greatest-stretch', reps: '4 / side' },
          { ex: 'hip-90-90', reps: '10' },
          { ex: 'hip-flexor-stretch', hold: 45, perSide: true },
          { ex: 'adductor-rockback', reps: '10 / side' },
          { ex: 'open-book', reps: '8 / side' },
        ],
      },
      NECK_2,
      ELBOW,
    ],
  },
  {
    id: '2026-10-24-run-30', date: '2026-10-24', title: '30 min continuous', kind: 'test',
    summary: 'The first milestone: 30 minutes without stopping, easy. Flat, or a smooth trail where you walk the steep climbs (walking them still counts as continuous).',
    blocks: [
      {
        title: 'Run',
        items: [
          { ex: 'brisk-walk', hold: 5 * 60, note: 'Warm-up walk.' },
          { ex: 'easy-run', hold: 30 * 60, note: 'If Thursday left anything the next morning, do 3 × 8 min / 1 min walk instead.' },
          { ex: 'brisk-walk', hold: 5 * 60, note: 'Cool-down walk.' },
        ],
      },
      ELBOW,
    ],
  },
  {
    id: '2026-10-25-family', date: '2026-10-25', title: 'Family walk + check-in', kind: 'mobility',
    summary: 'Easy walk or hike with the family, then the weekly check-in with your coach: calf, elbow, neck, how the runs felt.',
    blocks: [
      { title: 'Walk', items: [{ ex: 'brisk-walk', hold: 45 * 60, note: 'Easy, with the family. Hills are fine.' }] },
      { title: 'Mobility', items: [{ ex: 'hip-90-90', reps: '8' }, { ex: 'hip-flexor-stretch', hold: 45, perSide: true }, { ex: 'open-book', reps: '8 / side' }] },
    ],
  },
  // ---- Week 4 · 26 Oct: easy running, arm and hips settle, cold in the house ----
  // Cold rule: symptoms only above the neck (sniffles, sore throat) means train
  // as written at an easier effort. Fever, chest or body aches means a rest day.
  {
    id: '2026-10-26-strength-a', date: '2026-10-26', title: 'Strength A', kind: 'strength',
    summary: 'Same legs as last week, not heavier: hips are stiff, there’s a cold, and the right arm needs a quiet week. Sniffles only: train at 6/10. Fever or a chesty cough: take a walk instead.',
    blocks: [
      {
        ...WARM_UP,
        items: [
          { ex: 'cat-cow', reps: '8 slow' },
          { ex: 'worlds-greatest-stretch', reps: '4 / side' },
          { ex: 'hip-90-90', reps: '8' },
          { ex: 'glute-bridge', reps: '10' },
          { ex: 'arm-circles', reps: '10 each way' },
        ],
      },
      {
        title: 'Strength A',
        items: [
          { ex: 'rfe-split-squat', sets: 3, reps: '8 / side · 3 s down', load: 'backpack · 16 kg', superset: 'a', note: 'Same 16 kg as last week. If the hips feel tight at the bottom, use the ordinary split squat instead (same bell in the backpack). Put the pack on with the left arm.' },
          { ex: 'kb-row', sets: 3, reps: '12 · left arm only', load: '16 kg', rest: 60, superset: 'a', note: 'Right arm rests on the bench.' },
          { ex: 'kb-single-leg-rdl', sets: 3, reps: '10 / side', load: '16 kg', superset: 'b', note: 'Bell in the LEFT hand for both legs.' },
          { ex: 'dead-bug', sets: 3, reps: '10 / side', rest: 60, superset: 'b' },
          { ex: 'copenhagen-short', sets: 2, hold: 20, perSide: true, rest: 45, note: 'Groin strain history: stop if the inner thigh or groin pulls. Right side on your knees if leaning on the forearm hurts.' },
        ],
      },
      { ...CALF_3, title: 'Calf strength · now or evening', anytime: true },
      HIPS,
      ARM_4,
    ],
  },
  {
    id: '2026-10-27-run', date: '2026-10-27', title: 'Easy run 1', kind: 'aerobic',
    summary: '30 min continuous, flat, easy. Heart rate under 140. A cold raises it, so go by the talk test and slow right down if it climbs. Calf and hips should feel fine afterwards.',
    blocks: [
      {
        title: 'Run',
        items: [
          { ex: 'brisk-walk', hold: 5 * 60, note: 'Warm-up walk.' },
          { ex: 'easy-run', hold: 30 * 60, note: 'Chesty or breathless? Cut it to 3 × 8 min / 1 min walk, or go home.' },
          { ex: 'brisk-walk', hold: 5 * 60, note: 'Cool-down walk.' },
        ],
      },
      { ...HIPS, title: 'Hip reset · after the run' },
      ARM_4,
      DESK,
    ],
  },
  {
    id: '2026-10-28-strength-b', date: '2026-10-28', title: 'Strength B', kind: 'strength',
    summary: 'Step-ups with slow step-downs again, no push-ups, nothing in the right hand. Hip stiffness and the cold set the effort: 6/10, stop if it feels worse than it should.',
    blocks: [
      {
        ...WARM_UP,
        items: [
          { ex: 'cat-cow', reps: '8 slow' },
          { ex: 'worlds-greatest-stretch', reps: '4 / side' },
          { ex: 'hip-90-90', reps: '8' },
          { ex: 'glute-bridge', reps: '10' },
          { ex: 'arm-circles', reps: '10 each way' },
        ],
      },
      {
        title: 'Strength B',
        items: [
          { ex: 'step-up', sets: 3, reps: '10 / side', load: 'backpack · 16 kg', superset: 'a', note: 'Same load as last week. Bodyweight only if Monday’s split squats left you very sore.' },
          { ex: 'prone-yt', sets: 3, reps: '8 each · no weight', rest: 45, superset: 'a' },
          { ex: 'single-leg-bridge', sets: 3, reps: '15 / side', superset: 'b' },
          { ex: 'side-plank', sets: 3, hold: 35, perSide: true, rest: 45, superset: 'b', note: 'Right side: on your knees if the elbow complains.' },
          { ex: 'suitcase-carry', sets: 3, reps: '40 m · left hand only', load: '16 kg', superset: 'c' },
          { ex: 'copenhagen-short', sets: 2, hold: 20, perSide: true, rest: 45, superset: 'c', note: 'Skip if the groin or inner thigh is sore.' },
        ],
      },
      { ...CALF_3, title: 'Calf strength · now or evening', anytime: true },
      HIPS,
      ARM_4,
    ],
  },
  {
    id: '2026-10-29-trail', date: '2026-10-29', title: 'Easy trail run', kind: 'aerobic',
    summary: 'A short trail outing: run the flats and gentle descents, power-hike every climb. The hike is the hill-power work for this week. Nothing technical, hands out of your pockets and off the rocks.',
    blocks: [
      {
        title: 'Trail',
        items: [
          { ex: 'brisk-walk', hold: 5 * 60, note: 'Warm-up walk on the trail.' },
          { ex: 'trail-run-walk', sets: 4, hold: 6 * 60, rest: 60, restLabel: 'Walk', note: 'Run up to 6 min, then walk 1 min. Power-hike every climb: short steps, hands on hips or swinging, never on the knees. Still talking in sentences.' },
          { ex: 'brisk-walk', hold: 5 * 60, note: 'Cool-down walk.' },
        ],
      },
      ARM_4,
      DESK,
    ],
  },
  {
    id: '2026-10-30-mobility', date: '2026-10-30', title: 'Mobility + hips', kind: 'mobility',
    summary: 'A proper hip session before tomorrow’s bloods and run. No calf loading today.',
    blocks: [
      {
        title: 'Mobility',
        items: [
          { ex: 'worlds-greatest-stretch', reps: '4 / side' },
          { ex: 'hip-90-90', reps: '10' },
          { ex: 'hip-flexor-stretch', hold: 60, perSide: true },
          { ex: 'adductor-rockback', reps: '10 / side' },
          { ex: 'open-book', reps: '8 / side' },
        ],
      },
      NECK_2,
      ARM_4,
    ],
  },
  {
    id: '2026-10-31-run', date: '2026-10-31', title: 'Easy run 3 + strides', kind: 'aerobic',
    summary: 'Bloods first (ApoB + Lp(a)), then 35 min easy. Strides only if the cold is gone, the hips are loose and Tuesday and Thursday left nothing the next morning. Otherwise skip them. They wait for week 5.',
    blocks: [
      {
        title: 'Run',
        items: [
          { ex: 'brisk-walk', hold: 5 * 60, note: 'Warm-up walk.' },
          { ex: 'easy-run', hold: 35 * 60, note: 'Same easy effort. If the cold is hanging on, do 30 min.' },
        ],
      },
      {
        title: 'Strides · only if all clear',
        items: [{ ex: 'strides', sets: 6, hold: 20, rest: 60, restLabel: 'Walk back', note: 'About 85% effort, never a sprint.' }],
      },
      { title: 'Cool-down', items: [{ ex: 'brisk-walk', hold: 5 * 60 }] },
      ARM_4,
    ],
  },
  {
    id: '2026-11-01-family', date: '2026-11-01', title: 'Family walk + check-in', kind: 'mobility',
    summary: 'Easy walk or hike with the family, then the weekly check-in with your coach: right arm, hips, cold, how the runs felt.',
    blocks: [
      { title: 'Walk', items: [{ ex: 'brisk-walk', hold: 45 * 60, note: 'Easy, with the family. Hills are fine.' }] },
      HIPS,
      ARM_4,
    ],
  },
  // ---- Weeks 5–6 · 2–15 Nov: travelling ---------------------------------
  {
    id: '2026-11-02-travel', date: '2026-11-02', title: 'Travelling', kind: 'aerobic',
    summary: 'Two weeks on the road: an easy run most days, no structured strength.',
    blocks: [{ title: 'Run', items: [{ ex: 'easy-run', hold: 30 * 60, note: 'Most days while away.' }] }],
  },
  {
    id: '2026-11-15-trail', date: '2026-11-15', title: 'Standard trail · 10 km', kind: 'aerobic',
    summary: 'Your usual 10 km trail in about 1h10. Ran well and felt fit. The right calf was tight at the start and tighter the next morning.',
    blocks: [{ title: 'Trail', items: [{ ex: 'trail-long-run', hold: 70 * 60 }] }],
  },

  // ---- Week 7 · 16 Nov: settle the calf, run the tests -----------------------
  // Four runs, never more than two days in a row. Each morning, check the right
  // calf on getting up: tighter than yesterday means the next run gets shorter.
  {
    id: '2026-11-16-strength-a', date: '2026-11-16', title: 'Strength A', kind: 'strength',
    summary: 'Back to lifting after two weeks away: 4 sets on the legs and power from one-arm swings. Right arm out of it. Book the physio for the arm and neck today.',
    blocks: [
      WARM_UP_HIPS,
      {
        title: 'Strength A',
        items: [
          { ex: 'rfe-split-squat', sets: 4, reps: '8 / side · 3 s down', load: 'backpack · 16 kg', superset: 'a', note: 'Set 1 bodyweight after two weeks off. Put the pack on with the left arm.' },
          { ex: 'kb-row', sets: 4, reps: '12 · left arm only', load: '16 kg', rest: 60, superset: 'a', note: 'Right arm rests on the couch arm or your knee.' },
          { ex: 'kb-swing', sets: 4, reps: '12 · left hand', load: '16 kg', superset: 'b', note: 'Learn the hinge first. Stop a set as soon as the hips stop doing the work.' },
          { ex: 'dead-bug', sets: 4, reps: '10 / side', rest: 60, superset: 'b' },
          ...ADDUCTORS,
        ],
      },
      CALF_7,
      ARM_7,
      NECK_7,
    ],
  },
  {
    id: '2026-11-17-run', date: '2026-11-17', title: 'Easy run 1', kind: 'aerobic',
    summary: '35 min easy, flat. School drop is at 7:30, so head out by 6:30. After daily running the calf needs easy days to settle, so keep it truly conversational.',
    blocks: [run(35, 'If the right calf is tighter than yesterday, cut it to 25 min.'), CALF_7, ARM_7, NECK_7],
  },
  {
    id: '2026-11-18-strength-b', date: '2026-11-18', title: 'Strength B', kind: 'strength',
    summary: 'Climbing legs and the back of the body. Step-ups with slow step-downs, single-leg RDLs, adductors without a bench.',
    blocks: [
      WARM_UP_HIPS,
      {
        title: 'Strength B',
        items: [
          { ex: 'step-up', sets: 4, reps: '10 / side', load: 'backpack · 16 kg', superset: 'a', note: 'Use the couch, a step or a low wall at knee height. 3 s down.' },
          { ex: 'prone-yt', sets: 4, reps: '8 each · no weight', rest: 45, superset: 'a' },
          { ex: 'kb-single-leg-rdl', sets: 3, reps: '10 / side', load: '16 kg', superset: 'b', note: 'Bell in the LEFT hand for both legs.' },
          { ex: 'side-plank', sets: 3, hold: 40, perSide: true, rest: 45, superset: 'b', note: 'Right side on your knees if the elbow complains.' },
          ...ADDUCTORS,
          { ex: 'suitcase-carry', sets: 2, reps: '40 m · left hand only', load: '16 kg', rest: 45 },
        ],
      },
      CALF_7,
      ARM_7,
      NECK_7,
    ],
  },
  {
    id: '2026-11-19-run', date: '2026-11-19', title: 'Easy run 2', kind: 'aerobic',
    summary: '35 min easy. No strides yet, because they wait for the right calf. The Gees event is tonight: if there’s sport, keep the right arm out of it.',
    blocks: [run(35, 'Right calf tighter than Tuesday morning? Do 25 min.'), ARM_7, NECK_7],
  },
  {
    id: '2026-11-20-tests', date: '2026-11-20', title: 'Baseline tests', kind: 'test',
    summary: 'The week 1 tests, finally. Before your 8:00 call. Push-up test waits until the arm is cleared. Then a long hip and mid-back session.',
    blocks: [
      {
        title: 'Baseline',
        items: [
          { ex: 'sitting-rising-test', reps: 'score /10 · record' },
          { ex: 'single-leg-balance', hold: 30, perSide: true, note: 'Record seconds per leg.' },
          { ex: 'knee-to-wall', reps: 'cm each side · record' },
          { ex: 'single-leg-calf-raise-test', reps: 'max each side · record', note: 'Left first this time. Stop the right at the first real pain and note where it was.' },
          { ex: 'side-plank', hold: 120, perSide: true, note: 'Max hold, up to 2 min. Right side on the knees if the elbow complains. Record both.' },
        ],
      },
      {
        title: 'Mobility',
        items: [
          { ex: 'hip-90-90', reps: '10' },
          { ex: 'hip-flexor-stretch', hold: 60, perSide: true },
          { ex: 'adductor-rockback', reps: '10 / side' },
          { ex: 'thoracic-extension', reps: '5 × 3 levels' },
          { ex: 'open-book', reps: '8 / side' },
        ],
      },
      ARM_7,
    ],
  },
  {
    id: '2026-11-21-long', date: '2026-11-21', title: 'Long trail run', kind: 'aerobic',
    summary: '70 min on your standard trail, but properly easy this time, with the climbs hiked. Same distance-ish, less cost. Take water.',
    blocks: [{ title: 'Trail', items: [{ ex: 'trail-long-run', hold: 70 * 60 }] }, ARM_7],
  },
  {
    id: '2026-11-22-recovery', date: '2026-11-22', title: 'Recovery run + check-in', kind: 'aerobic',
    summary: '25 min very easy, flat. Only if the right calf is no tighter than it was on Saturday morning. Otherwise a family walk. Then the weekly check-in: calf, arm, neck, physio and the test results.',
    blocks: [
      run(25, 'Slower than you think. Shuffle pace is fine.'),
      { title: 'Mobility', items: [{ ex: 'hip-90-90', reps: '8' }, { ex: 'hip-flexor-stretch', hold: 45, perSide: true }, { ex: 'open-book', reps: '8 / side' }] },
      ARM_7,
    ],
  },

  // ---- Week 8 · 23 Nov: first benchmark, three strength sessions ------------
  {
    id: '2026-11-23-strength-a', date: '2026-11-23', title: 'Strength A', kind: 'strength',
    summary: 'Progression week: more reps on the split squats, a fifth set of swings. Endeavor dinner tonight, so get this done in the morning.',
    blocks: [
      WARM_UP_HIPS,
      {
        title: 'Strength A',
        items: [
          { ex: 'rfe-split-squat', sets: 4, reps: '10 / side · 3 s down', load: 'backpack · 16 kg', superset: 'a' },
          { ex: 'kb-row', sets: 4, reps: '12 · left arm only · pause at top', load: '16 kg', rest: 60, superset: 'a' },
          { ex: 'kb-swing', sets: 5, reps: '15 · left hand', load: '16 kg', superset: 'b' },
          { ex: 'dead-bug', sets: 5, reps: '10 / side', rest: 60, superset: 'b' },
          ...ADDUCTORS.map(rx => ({ ...rx, sets: 3 })),
        ],
      },
      CALF_8,
      ARM_7,
      NECK_7,
    ],
  },
  {
    id: '2026-11-24-run', date: '2026-11-24', title: 'Easy run + strides', kind: 'aerobic',
    summary: '30 min easy, then 6 strides if the right calf has been loose in the mornings. School drop at 7:30: head out by 6:30.',
    blocks: [
      run(30),
      { title: 'Strides · only if the calf is loose', items: [{ ex: 'strides', sets: 6, hold: 20, rest: 60, restLabel: 'Walk back' }] },
      CALF_8,
      ARM_7,
    ],
  },
  {
    id: '2026-11-25-strength-b', date: '2026-11-25', title: 'Strength B', kind: 'strength',
    summary: 'Step-ups go to 12, RDLs to 4 sets. Keep the legs honest: tomorrow is the Cooper test, so stop each set with 2 reps in the tank.',
    blocks: [
      WARM_UP_HIPS,
      {
        title: 'Strength B',
        items: [
          { ex: 'step-up', sets: 4, reps: '12 / side', load: 'backpack · 16 kg', superset: 'a' },
          { ex: 'prone-yt', sets: 4, reps: '10 each · no weight', rest: 45, superset: 'a' },
          { ex: 'kb-single-leg-rdl', sets: 4, reps: '10 / side', load: '16 kg', superset: 'b', note: 'Bell in the LEFT hand for both legs.' },
          { ex: 'side-plank', sets: 3, hold: 45, perSide: true, rest: 45, superset: 'b' },
          ...ADDUCTORS.map(rx => ({ ...rx, sets: 3 })),
        ],
      },
      ARM_7,
      NECK_7,
    ],
  },
  {
    id: '2026-11-26-cooper', date: '2026-11-26', title: 'Cooper test', kind: 'test',
    summary: 'The first fitness benchmark: as far as you can in 12 minutes. Only if the right calf has been loose for three mornings in a row. Otherwise run 40 min easy and the test moves to next week.',
    blocks: [
      {
        title: 'Warm-up',
        items: [
          { ex: 'easy-run', hold: 10 * 60, note: 'Very easy.' },
          { ex: 'strides', sets: 4, hold: 20, rest: 60, restLabel: 'Walk back' },
        ],
      },
      { title: 'Test', items: [{ ex: 'cooper-test', hold: 12 * 60, reps: 'metres · record' }] },
      { title: 'Cool-down', items: [{ ex: 'easy-run', hold: 10 * 60, note: 'Jog or walk.' }] },
      ARM_7,
    ],
  },
  {
    id: '2026-11-27-strength-c', date: '2026-11-27', title: 'Strength C', kind: 'strength',
    summary: 'A lighter third session: trunk, hips and the left arm. Legs stay fresh for tomorrow’s long run.',
    blocks: [
      WARM_UP_HIPS,
      {
        title: 'Strength C',
        items: [
          { ex: 'kb-floor-press', sets: 3, reps: '10 · left arm only', load: '16 kg', superset: 'a', note: 'Right arm relaxed on the floor.' },
          { ex: 'single-leg-bridge', sets: 3, reps: '15 / side', rest: 45, superset: 'a' },
          { ex: 'suitcase-carry', sets: 3, reps: '40 m · left hand only', load: '16 kg', superset: 'b' },
          { ex: 'dead-bug', sets: 3, reps: '12 / side', rest: 45, superset: 'b' },
        ],
      },
      {
        title: 'Mobility',
        items: [
          { ex: 'hip-90-90', reps: '10' },
          { ex: 'hip-flexor-stretch', hold: 60, perSide: true },
          { ex: 'thoracic-extension', reps: '5 × 3 levels' },
          { ex: 'open-book', reps: '8 / side' },
        ],
      },
      CALF_8,
      ARM_7,
    ],
  },
  {
    id: '2026-11-28-long', date: '2026-11-28', title: 'Long trail run', kind: 'aerobic',
    summary: '80 min easy on trail, hiking the climbs. Take water and something to eat, and practise eating on the run.',
    blocks: [{ title: 'Trail', items: [{ ex: 'trail-long-run', hold: 80 * 60 }] }, ARM_7],
  },
  {
    id: '2026-11-29-recovery', date: '2026-11-29', title: 'Recovery run + check-in', kind: 'aerobic',
    summary: '30 min very easy, if the right calf is no tighter than on Saturday morning. Otherwise a family walk. Then the weekly check-in: Cooper result, calf, arm, neck, what the physio said.',
    blocks: [
      run(30, 'Shuffle pace is fine.'),
      { title: 'Mobility', items: [{ ex: 'hip-90-90', reps: '8' }, { ex: 'hip-flexor-stretch', hold: 45, perSide: true }, { ex: 'open-book', reps: '8 / side' }] },
      ARM_7,
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
  W(3, 'rebuild', 'Continuous running', 'Build to 30 min continuous at a talk-test easy pace. Calf rehab becomes calf strength. Right arm stays off-limits.', ['Easy runs Tue / Thu / Sat: 3×6 → 2×10 → 30 min', 'Strength: backpack-loaded legs, no push-ups, nothing in the right hand', 'Right arm: daily isometrics from Wed, physio this week', 'Calf: both legs + pogo hops', 'Desk resets for the neck', 'Sat: 30 min continuous, pain-free'], { km: '10–12' }),
  W(4, 'foundation', 'Easy means easy', 'Conversational pace, heart rate zone 2. The right arm, the hips and a cold all set the pace, so strides and curls wait until they’re ready.', ['3 easy runs: 30 min flat, 24 min on a trail, 35 min', 'Hill power-hikes folded into Thursday’s trail run', 'Strides 6 × 20 s on Saturday, only if the cold is gone and the hips are loose', 'Strength 2×: same backpack legs, hip warm-up', 'Right arm: gentler isometrics, curls postponed', 'Bloods: ApoB + Lp(a)'], { km: '12–15' }),
  W(5, 'foundation', 'Travelling', 'On the road: an easy run most days, no structured strength.', ['Daily easy runs', 'No strength sessions'], { km: '~25' }),
  W(6, 'foundation', 'Travelling', 'Still away. Finished with the standard 10 km trail in 1h10, feeling fit. The right calf tightened up.', ['Daily easy runs', 'Sun: 10 km trail, 1h10'], { km: '~30' }),
  W(7, 'foundation', 'Settle the calf, run the tests', 'Four runs instead of seven, so the right calf can settle. Strength restarts with power work. The week 1 tests finally happen. Get the arm and neck examined.', ['4 runs: 35 · 35 · 70 min trail · 25', 'Strength A & B: 4 sets, one-arm swings, adductors without a bench', 'Fri: baseline tests', 'Book the physio: right arm + neck', 'Neck routine before bed'], { km: '24–28' }),
  W(8, 'foundation', 'First benchmark', 'Cooper test on Thursday if the calf has settled. Three strength sessions. Long run up to 80 min.', ['4 runs: 30 + strides · Cooper test · 80 min trail · 30', 'Strides return', 'Strength A, B & C', 'Pogo hops back if the calf is loose'], { km: '26–30' }),
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
  { id: 'run-30', date: '2026-10-24', kind: 'run', title: '30 min continuous', detail: 'Easy pace, pain-free during and the next morning.' },
  { id: 'physio', date: '2026-11-20', kind: 'health', title: 'Physio: right biceps + neck', detail: 'Overdue. The arm is no better four weeks on and the neck spasms at night. Ask whether the neck could be feeding the arm pain, and for an ultrasound of the distal biceps.' },
  { id: 'baseline', date: '2026-11-20', kind: 'test', title: 'Baseline tests', detail: 'Sitting-rising, balance, knee-to-wall, calf raises, side plank. Push-ups wait for the arm.' },
  { id: 'arm-curls', date: '2026-12-07', kind: 'health', title: 'Arm: light curls begin', detail: 'Moved back twice: the 22 Oct re-strain, then four weeks of lifting the twins. Physio first. Only when there’s no pain at rest, isometrics are pain-free and lifting the twins is ≤2/10. Slow hammer curls at 2–4 kg, then palm-up curls and slow lowering.' },
  { id: 'arm-full', date: '2027-01-18', kind: 'health', title: 'Arm: hanging + pull-ups return', detail: 'Only after heavy slow curls and two-arm rows are pain-free with strength matching the left. No dead-hang contests before then.' },
  { id: 'bloods', date: '2026-10-31', kind: 'health', title: 'Bloods: ApoB + Lp(a)', detail: 'Family cardiac history — Lp(a) is a once-in-a-lifetime test.' },
  { id: 'cooper', date: '2026-11-26', kind: 'test', title: 'First fitness benchmark', detail: '12-min Cooper test (VO2max ≈ (m − 504.9) ÷ 44.73). Only once the right calf is loose in the mornings.' },
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

/** Today's session, else the next one, else the most recent. (Callers show a
 *  "not written yet" note when the result is in an earlier week than today.) */
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

/** Rounds that make one set: a per-side hold is left + right. */
export const roundsPerSet = (rx: Prescription) => (rx.hold && rx.perSide ? 2 : 1);

/** The other half of a two-exercise superset, as an index into `steps`. */
export function supersetPartner(steps: Step[], idx: number): number | null {
  const me = steps[idx];
  if (!me?.rx.superset) return null;
  for (const j of [idx - 1, idx + 1]) {
    const o = steps[j];
    if (o && o.block === me.block && o.rx.superset === me.rx.superset) return j;
  }
  return null;
}

// --- Time estimates -------------------------------------------------------
// Rough but honest: rep sets ≈ 40 s (75 s when it's "/ side"), holds are
// their length, plus rests between sets and ~15 s to set up each exercise.

const workSecs = (rx: Prescription) =>
  rx.hold ? rx.hold * (rx.perSide ? 2 : 1) : rx.reps && /\/ side|each/.test(rx.reps) ? 75 : 40;

export function blockSeconds(b: Block): number {
  let total = 0;
  for (let i = 0; i < b.items.length; i++) {
    const rx = b.items[i];
    const group = rx.superset ? b.items.filter(x => x.superset === rx.superset) : [rx];
    if (rx.superset && group[0] !== rx) continue; // counted with its group
    const sets = Math.max(...group.map(x => x.sets ?? 1));
    const rest = group[group.length - 1].rest ?? 0;
    total += sets * group.reduce((t, x) => t + workSecs(x), 0) + (sets - 1) * rest + 15 * group.length;
  }
  return total;
}

export const blockMinutes = (b: Block) => Math.max(1, Math.round(blockSeconds(b) / 60));
const roundTo5 = (secs: number) => Math.max(5, Math.round(secs / 60 / 5) * 5);
/** Core session time, plus the "now or evening" extras separately. */
export const sessionMinutes = (s: Session) => roundTo5(s.blocks.filter(b => !b.anytime).reduce((t, b) => t + blockSeconds(b), 0));
export const anytimeMinutes = (s: Session) => {
  const secs = s.blocks.filter(b => b.anytime).reduce((t, b) => t + blockSeconds(b), 0);
  return secs ? roundTo5(secs) : 0;
};

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
