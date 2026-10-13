/**
 * The routine charts: free at /routine-chart, and the upgraded one (the same chart plus a notes line under
 * each step, with starter notes) for Take Back Control buyers at ROUTINE_PLUS_PATH.
 *
 * The upgraded page is unlisted, not locked: noindex, out of the sitemap, linked only from a Take Back
 * Control buyer's download page. Anyone with the link can open it. To change the link (if it gets passed
 * around), change ROUTINE_PLUS_PATH; buyers' download pages pick it up.
 *
 * Both use src/components/site/RoutineChart.astro and save in this browser only (separate keys).
 */

export const ROUTINE_PLUS_PATH = '/routine-chart/plus-h4w8q3';

/** Steps on a chart. */
export const ROUTINE_ROWS = 8;

export interface RoutineType {
  label: string;
  /** One line under the type button. */
  blurb: string;
  title: string;
  subtitle: string;
  /** Starter steps: 24-hour time, step, and the note the upgraded chart shows under it. */
  steps: [time: string, step: string, note: string][];
  /** The finish line, e.g. "Lights out by" 20:00. */
  endLabel: string;
  endTime: string;
  /** Suggestion chips: each fills the next empty step. */
  ideas: string[];
}

export const routineTypes: Record<string, RoutineType> = {
  morning: {
    label: 'Morning',
    blurb: 'Out the door on time',
    title: 'Morning Routine',
    subtitle: 'One step at a time',
    steps: [
      ['07:00', 'Wake up & stretch', 'Three deep breaths before you get up'],
      ['07:10', 'Make bed', 'Covers up, pillow on top'],
      ['07:15', 'Get dressed', 'Clothes laid out the night before'],
      ['07:25', 'Eat breakfast', 'Sitting down, dishes to the sink after'],
      ['07:45', 'Brush teeth', 'Two full minutes'],
      ['07:50', 'Grab backpack & shoes', 'Water bottle and folder inside?'],
    ],
    endLabel: 'Out the door by',
    endTime: '08:00',
    ideas: ['Pack lunch', 'Check the calendar', 'Quick tidy up', 'Family huddle', 'Feed pets', 'Brush hair', 'Fill water bottle'],
  },
  afterschool: {
    label: 'After-School',
    blurb: 'Home, reset, then play',
    title: 'After-School Routine',
    subtitle: 'Home, reset, then play',
    steps: [
      ['15:30', 'Shoes & coat away', 'Shoes on the mat, coat on the hook'],
      ['15:35', 'Unpack backpack & lunch box', 'Lunch box to the sink, papers on the counter'],
      ['15:40', 'Wash hands', ''],
      ['15:45', 'Snack', 'Something filling, plus water'],
      ['16:00', 'Homework & reading', 'Quiet spot, timer on'],
      ['16:45', 'Free play', 'Outside if the weather’s good'],
    ],
    endLabel: 'Dinner at',
    endTime: '17:30',
    ideas: ['Outdoor time', 'Help with dinner', 'Practice instrument', 'Set the table', 'Hand over school papers', 'Tidy room'],
  },
  bedtime: {
    label: 'Bedtime',
    blurb: 'Wind down, lights out',
    title: 'Bedtime Routine',
    subtitle: 'Wind down, lights out',
    steps: [
      ['19:00', 'Pick up toys', 'Everything back in its home'],
      ['19:10', 'Bath or shower', ''],
      ['19:30', 'Pajamas on', 'Dirty clothes in the hamper'],
      ['19:35', 'Brush teeth', 'Two full minutes'],
      ['19:40', 'Lay out tomorrow’s clothes', 'Check the weather first'],
      ['19:45', 'Read together', 'One calm story, then lights out'],
    ],
    endLabel: 'Lights out by',
    endTime: '20:00',
    ideas: ['Pack backpack', 'Bathroom one last time', 'Fill water cup', 'Talk about the day', 'Gratitude or prayers', 'Quiet music'],
  },
  weekend: {
    label: 'Weekend',
    blurb: 'Reset for the week ahead',
    title: 'Weekend Reset',
    subtitle: 'Get ready for the week, together',
    steps: [
      ['09:00', 'Family breakfast', 'No rush'],
      ['09:30', 'Plan the week together', 'Practices, appointments, who drives'],
      ['10:00', 'Tidy the house together', 'Everyone takes a room, music on'],
      ['11:00', 'Laundry', 'Everyone puts their own away'],
      ['14:00', 'Grocery shopping', 'List from the week’s meals'],
      ['16:00', 'Meal prep', 'Wash and chop for the first busy nights'],
    ],
    endLabel: 'Done by',
    endTime: '17:00',
    ideas: ['Outdoor activity', 'Family game time', 'Pack bags for Monday', 'Clean out the car', 'Water plants', 'Rest time'],
  },
  custom: {
    label: 'Custom',
    blurb: 'Start from a blank chart',
    title: 'My Routine',
    subtitle: '',
    steps: [],
    endLabel: 'Done by',
    endTime: '',
    ideas: ['Snack time', 'Break time', 'Play time', 'Learning time', 'Family time', 'Quick tidy up'],
  },
};
