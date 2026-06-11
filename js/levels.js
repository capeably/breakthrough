// The campaign (design doc §7.2): four chapters, each introducing one elite
// per level, each ending in a boss wall. Tokens: `.` empty · 1/2/3 tiers ·
// P positive · @ JOYFUL token · elite letters (see ELITE_TOKENS in bricks.js):
// R procrastination · D doubt · A anxiety · O overthinking · X distraction ·
// F perfectionism · N denial · S shame · B burnout · H rabbit hole · E the feed

export const CHAPTERS = [
  {
    name: 'Monday',
    tagline: 'Daily friction.',
    levels: [
      {
        name: 'The Starting Gate',
        map: `
          . . 1 1 1 1 1 1 1 1 1 . .
          . 1 1 1 1 1 1 1 1 1 1 1 .
          . 2 2 . . . @ . . . 2 2 .
          . 2 2 . . P . P . . 2 2 .
          . 2 2 . . . . . . . 2 2 .
        `,
      },
      {
        name: 'Snooze Button',
        map: `
          . . . . 1 1 1 1 1 . . . .
          . . 1 1 2 2 2 2 2 1 1 . .
          . 1 2 2 R P @ P R 2 2 1 .
          . . 1 1 2 2 2 2 2 1 1 . .
          . . . . 1 1 1 1 1 . . . .
        `,
      },
      {
        name: 'Inbox Zero',
        map: `
          1 1 1 1 1 1 E 1 1 1 1 1 1
          . . . . . . . . . . . . .
          2 2 2 R 2 . . . 2 R 2 2 2
          . . @ . . . . . . . . . .
          1 1 1 2 P 1 . 1 P 2 1 1 1
          . . . . . . . . . . . . .
          2 2 . 2 2 2 . 2 2 2 . 2 2
        `,
      },
      { name: 'LATER', boss: 'LATER', bossType: 'later' },
    ],
  },
  {
    name: 'The Inner Critic',
    tagline: 'Self-judgment, armored.',
    levels: [
      {
        name: 'Second Guess',
        map: `
          . . 2 2 2 2 2 2 2 2 2 . .
          . 2 1 1 D 1 1 1 D 1 1 2 .
          . 2 1 . . P @ P . . 1 2 .
          . 2 1 1 D 1 1 1 D 1 1 2 .
          . . 2 2 2 2 2 2 2 2 2 . .
        `,
      },
      {
        name: 'Imposter Hour',
        map: `
          . 1 1 1 1 1 1 1 1 1 1 1 .
          . N . N . N . N . N . N .
          . 2 2 2 2 2 @ 2 2 2 2 2 .
          . . D . P . . . P . D . .
          . . . 1 1 1 1 1 1 1 . . .
        `,
      },
      {
        name: 'Harsh Feedback',
        map: `
          S S . S S S . S S S . S S
          2 2 2 2 2 2 2 2 2 2 2 2 2
          1 1 D 1 1 1 @ 1 1 1 D 1 1
          . 2 2 2 P 2 . 2 P 2 2 2 .
          . . 1 1 1 1 1 1 1 1 1 . .
        `,
      },
      { name: 'DOUBT', boss: 'DOUBT', bossType: 'doubt' },
    ],
  },
  {
    name: 'The Spiral',
    tagline: 'Mental noise, in motion.',
    levels: [
      {
        name: 'Racing Thoughts',
        map: `
          . O . 2 2 2 2 2 2 2 . O .
          1 1 1 1 . 1 1 1 . 1 1 1 1
          . 2 . P . . @ . . P . 2 .
          1 1 1 1 . 1 1 1 . 1 1 1 1
          . O . 2 2 2 2 2 2 2 . O .
        `,
      },
      {
        name: 'Static',
        map: `
          1 1 1 . 1 1 X 1 1 . 1 1 1
          . . 2 2 . . . . . 2 2 . .
          2 A 2 . P . @ . P . 2 A 2
          . . 2 2 . . . . . 2 2 . .
          1 1 1 . 1 1 X 1 1 . 1 1 1
        `,
      },
      {
        name: 'Down the Rabbit Hole',
        map: `
          2 2 2 2 2 . . . 2 2 2 2 2
          1 1 . 1 1 1 H 1 1 1 . 1 1
          . . 2 . . P @ P . . 2 . .
          1 1 . 1 1 1 H 1 1 1 . 1 1
          2 2 2 2 2 . . . 2 2 2 2 2
        `,
      },
      { name: 'FEAR', boss: 'FEAR', bossType: 'fear' },
    ],
  },
  {
    name: 'The Wall',
    tagline: 'The big one.',
    levels: [
      {
        name: 'Polish It Again',
        map: `
          . . 3 . F . 3 . F . 3 . .
          2 2 2 2 2 2 2 2 2 2 2 2 2
          1 1 . P . 1 @ 1 . P . 1 1
          2 2 2 2 2 2 2 2 2 2 2 2 2
          . . 3 . 3 . F . 3 . 3 . .
        `,
      },
      {
        name: 'Behind Closed Doors',
        map: `
          . S S . . S S S . . S S .
          3 3 3 3 . 3 3 3 . 3 3 3 3
          2 2 2 2 . 2 @ 2 . 2 2 2 2
          1 1 N 1 . P . P . 1 N 1 1
          . 1 1 1 1 1 1 1 1 1 1 1 .
        `,
      },
      {
        name: 'Running on Empty',
        map: `
          2 2 2 . 2 2 2 2 2 . 2 2 2
          2 B 2 . 2 2 B 2 2 . 2 B 2
          2 2 2 . 1 P @ P 1 . 2 2 2
          1 1 1 . 1 1 1 1 1 . 1 1 1
          . B . . . 1 1 1 . . . B .
        `,
      },
      { name: 'BURNOUT', boss: 'BURNOUT', bossType: 'burnout' },
    ],
  },
];
