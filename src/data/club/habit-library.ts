/**
 * The Club's shared habit library: age-appropriate behaviors any month can suggest, each with the small action, the
 * moments it could follow (anchors: offered as options unless the family's own information confirms one), one way
 * the child makes it their own, and an environmental or grown-up support. Month-independent: months choose which ids
 * they allow (MonthTheme.allowed); selection lives in src/lib/club/habits/recommend.ts.
 *
 * Writing rules (tests/club-habits.test.ts): the child is {name}, never a pronoun; actions start with a verb and carry
 * no anchor; nothing assumes a season, a sport's schedule or a routine the family didn't report; no "Mom", "Dad" or
 * "parents"; no rewards by default.
 */
import type { HabitItem } from '../../lib/club/habits/types';

export const HABIT_LIBRARY: readonly HabitItem[] = [
  { id: 'pack-school-bag', wish: 'packing the school bag', category: 'school-prep', title: 'School things ready', times: ['evening'], school: true, byStage: {
    preschool: { action: 'Put the folder and water bottle in the school bag.', anchors: ['after dinner', 'after bath'], ownership: 'Let {name} hang the bag on the hook each time.', support: 'A low hook for the bag by the door; do it together the first week.', principle: 'environment' },
    early: { action: 'Check tomorrow’s supplies and pack the school bag.', anchors: ['after dinner', 'after homework is put away'], ownership: 'Let {name} choose where the bag lives, so it’s ready without help.', support: 'A hook by the door at the right height.', principle: 'stacking' },
    middle: { action: 'Check tomorrow’s supplies and pack the school bag.', anchors: ['after homework is put away', 'after dinner'], ownership: 'Let {name} choose where the bag lives, so it’s ready without help.', support: 'Tomorrow’s plans on the family calendar, where {name} can check.', principle: 'stacking' },
    teen: { action: 'Pack bag and gear for tomorrow.', anchors: ['before screens at night', 'after homework'], ownership: '{name} keeps a personal checklist; nobody checks the bag.', principle: 'ownership' },
  }, shared: { title: 'School things ready the night before', action: 'Everyone packs their own bag for tomorrow.', ownership: 'Each child picks where their bag lives.', support: 'One spot by the door with a hook for each bag.', anchors: ['after dinner', 'after homework is put away'],
    parts: { preschool: 'Put the folder and water bottle in the bag.', early: 'Check tomorrow’s supplies and pack the bag.', middle: 'Pack the bag and check tomorrow on the calendar.', teen: 'Pack bag and gear; nobody checks it.' } } },

  { id: 'bedtime-routine', wish: 'the bedtime routine', category: 'routines', title: 'Pajamas ready', times: ['bedtime', 'evening'], byStage: {
    preschool: { action: 'Pick pajamas and put toys in the bin before story time.', anchors: ['after bath', 'after brushing teeth'], ownership: 'Let {name} pick tomorrow’s pajamas.', support: 'A toy bin within reach; do it together at first.', principle: 'stacking' },
    early: { action: 'Put pajamas on the bed before bath time.', anchors: ['after dinner', 'after the table is cleared'], ownership: 'Let {name} draw or choose the pictures for the reminder.', support: 'A simple picture reminder near the dresser, so {name} can remember without being told.', principle: 'environment' },
    middle: { action: 'Get ready for bed at the agreed time without a reminder.', anchors: ['when screens go off', 'after the last show'], ownership: 'Let {name} help set the agreed time.', support: 'A clock {name} can see from the bedroom.', principle: 'trigger' },
    teen: { action: 'Keep a school-night wind-down time.', anchors: ['a self-set phone alarm'], ownership: '{name} sets the wind-down time and the alarm.', principle: 'ownership' },
  }, shared: { title: 'An evening wind-down', action: 'Everyone gets ready for bed at the same signal.', ownership: 'The kids choose the signal: a song, a light, a timer.', support: 'A picture list by the bathroom for the younger ones.', anchors: ['when screens go off', 'when the dinner dishes are done'],
    parts: { preschool: 'Pick pajamas and put toys in the bin.', early: 'Pajamas on and teeth brushed.', middle: 'Get ready for bed without a reminder.', teen: 'Start a quiet wind-down.' } } },

  { id: 'morning-routine', wish: 'getting ready in the morning', category: 'routines', title: 'Ready on time in the morning', times: ['morning'], byStage: {
    preschool: { action: 'Get dressed in clothes laid out the night before.', anchors: ['after breakfast', 'after waking up'], ownership: 'Let {name} choose tomorrow’s outfit from two.', support: 'A chair for tomorrow’s clothes; help with buttons at first.', principle: 'environment' },
    early: { action: 'Do three morning steps: dressed, teeth, shoes.', anchors: ['after breakfast', 'right after waking up'], ownership: 'Let {name} put the three steps in order on the list.', support: 'A three-step picture list by the mirror.', principle: 'simplicity' },
    middle: { action: 'Get ready solo and be at the door on time.', anchors: ['after breakfast'], ownership: '{name} sets the clock or timer.', support: 'A clock where getting ready happens.', principle: 'trigger' },
    teen: { action: 'Run the whole morning from a self-set alarm.', anchors: ['a self-set alarm'], ownership: '{name} decides the wake-up time.', principle: 'ownership' },
  }, shared: { title: 'A calmer morning start', action: 'Everyone does their own three morning steps.', ownership: 'Each child puts their steps in order.', support: 'A picture list by the mirror for the younger ones.', anchors: ['right after waking up', 'after breakfast'],
    parts: { preschool: 'Get dressed in clothes laid out the night before.', early: 'Dressed, teeth, shoes.', middle: 'Dressed, teeth, shoes, bag by the door.', teen: 'Ready and out the door on a self-set alarm.' } } },

  { id: 'homework-start', wish: 'starting homework without reminders', category: 'homework', title: 'Homework started', times: ['after-school'], school: true, byStage: {
    early: { action: 'Start homework at the same spot.', anchors: ['after the after-school snack'], ownership: 'Let {name} set up the homework spot.', support: 'Pencils and supplies kept at the spot.', principle: 'stacking' },
    middle: { action: 'Start homework solo and ask for help when stuck.', anchors: ['after the after-school snack'], ownership: '{name} decides the order: hardest first or easiest first.', support: 'Supplies kept at the homework spot.', principle: 'stacking' },
    teen: { action: 'Plan the week’s homework time.', anchors: ['Sunday evening, looking at the week'], ownership: '{name} plans it; grown-ups ask only if asked.', principle: 'ownership' },
  } },

  { id: 'tidy-room', wish: 'keeping the bedroom picked up', category: 'cleaning', title: 'Things back where they live', times: ['evening', 'weekly'], byStage: {
    preschool: { action: 'Put toys back in the bins.', anchors: ['before bath', 'before story time'], ownership: 'Let {name} pick which bin each kind of toy lives in.', support: 'A picture label on each bin.', principle: 'environment' },
    early: { action: 'Do a five-minute bedroom pick-up.', anchors: ['before screen time', 'before bath'], ownership: '{name} chooses the music for the five minutes.', support: 'A basket for things that live elsewhere.', principle: 'stacking' },
    middle: { action: 'Do a weekly bedroom reset.', anchors: ['before weekend screen time'], ownership: '{name} picks the reset day.', principle: 'stacking' },
    teen: { action: 'Do a weekly bedroom reset, any way that works.', anchors: ['a day picked ahead'], ownership: '{name} decides what “reset” means, within reason.', principle: 'ownership' },
  }, shared: { title: 'A five-minute family pick-up', action: 'Everyone puts their own things back for five minutes.', ownership: 'The kids take turns choosing the music.', support: 'A basket in each room for things that live elsewhere.', anchors: ['before dinner', 'before screen time'],
    parts: { preschool: 'Put toys back in the bins.', early: 'Put own books, shoes and clothes back.', middle: 'Clear own things off the table and couch.', teen: 'Clear own things from the shared rooms.' } } },

  { id: 'put-away-laundry', wish: 'putting clean clothes away', category: 'laundry', title: 'Clean clothes put away', times: ['anytime'], byStage: {
    preschool: { action: 'Put folded clothes in the right drawer.', anchors: ['when the clean basket arrives'], ownership: 'Let {name} help choose the drawer labels.', support: 'Picture labels on the drawers; together at first.', principle: 'environment' },
    early: { action: 'Put clean clothes away the same day.', anchors: ['when the clean basket arrives'], ownership: '{name} decides which drawer holds what.', support: 'Drawers that open without help.', principle: 'environment' },
    middle: { action: 'Fold and put away clean clothes the same day.', anchors: ['when the clean basket arrives'], ownership: '{name} picks a folding style that works.', principle: 'trigger' },
    teen: { action: 'Wash, dry and put away one load a week.', anchors: ['a set laundry day'], ownership: '{name} picks the laundry day.', principle: 'ownership' },
  }, shared: { title: 'Laundry back in drawers', action: 'Everyone puts away their own clean clothes the day they arrive.', ownership: 'Each child decides which drawer holds what.', support: 'Picture labels on the younger ones’ drawers.', anchors: ['when the clean basket arrives'],
    parts: { preschool: 'Put folded clothes in the right drawer.', early: 'Put clean clothes away.', middle: 'Fold and put away clean clothes.', teen: 'Fold and put away own clothes, start to finish.' } } },

  { id: 'help-with-meals', wish: 'helping with meals or dishes', category: 'meals', title: 'A part at dinner', times: ['evening'], byStage: {
    preschool: { action: 'Set out the napkins and spoons.', anchors: ['when dinner is five minutes away'], ownership: 'Let {name} choose the napkins.', support: 'Napkins and spoons in a low drawer.', principle: 'environment' },
    early: { action: 'Set the table.', anchors: ['when dinner is five minutes away'], ownership: '{name} decides where everyone sits.', support: 'Plates and cups on a shelf {name} can reach.', principle: 'trigger' },
    middle: { action: 'Clear and rinse the dishes.', anchors: ['right after dinner'], ownership: '{name} picks the music while cleaning up.', principle: 'stacking' },
    teen: { action: 'Help cook one dinner a week.', anchors: ['a dinner night picked together'], ownership: '{name} picks what to cook.', principle: 'ownership' },
  }, shared: { title: 'Everyone has a part at dinner', action: 'Each child does one dinner job: set, serve or clear.', ownership: 'The kids trade jobs each week.', support: 'Dishes on reachable shelves for the younger ones.', anchors: ['when dinner is five minutes away'],
    parts: { preschool: 'Set out napkins and spoons.', early: 'Set the plates and cups.', middle: 'Serve or clear.', teen: 'Clear and rinse, or help cook.' } } },

  { id: 'own-belongings', wish: 'keeping track of belongings', category: 'belongings', title: 'A spot for everything', times: ['after-school', 'evening'], byStage: {
    preschool: { action: 'Put coat on the hook and shoes in the shoe spot.', anchors: ['coming in the door'], ownership: 'Let {name} pick a hook.', support: 'A low hook and a shoe spot by the door.', principle: 'environment' },
    early: { action: 'Hang up the bag and coat and put shoes away.', anchors: ['coming in the door'], ownership: '{name} chooses the spot for each thing.', support: 'A hook at the right height.', principle: 'stacking' },
    middle: { action: 'Put gear and water bottle in one home spot.', anchors: ['coming home'], ownership: '{name} sets up the gear spot.', support: 'One spot for gear by the door.', principle: 'environment' },
    teen: { action: 'Keep keys, chargers and gear in one spot.', anchors: ['coming home'], ownership: '{name} picks the spot.', principle: 'stacking' },
  }, shared: { title: 'A landing spot by the door', action: 'Everyone puts coat, bag and shoes in their own spot coming home.', ownership: 'Each child picks their hook.', support: 'Hooks at each child’s height.', anchors: ['coming in the door'],
    parts: { preschool: 'Coat on the hook, shoes in the shoe spot.', early: 'Bag and coat hung up, shoes away.', middle: 'Bag, coat and gear in one spot.', teen: 'Keys, charger and gear in one spot.' } } },

  { id: 'pet-care', wish: 'caring for the pet', category: 'pet-care', title: 'The pet’s care', times: ['morning'], byStage: {
    preschool: { action: 'Scoop the pet’s food with a grown-up.', anchors: ['at breakfast'], ownership: 'Let {name} carry the bowl.', principle: 'stacking' },
    early: { action: 'Fill the pet’s water bowl.', anchors: ['after breakfast'], ownership: '{name} chooses when, morning or after school.', support: 'The bowl somewhere easy to reach.', principle: 'stacking' },
    middle: { action: 'Feed the pet.', anchors: ['right after breakfast'], ownership: '{name} keeps the feeding chart.', principle: 'stacking' },
    teen: { action: 'Handle the pet’s daily care.', anchors: ['part of the morning'], ownership: '{name} decides the routine.', principle: 'ownership' },
  } },

  // Her own activities: anchored to the activity she listed, never to a season we assume.
  { id: 'activity-gear', category: 'belongings', title: 'Ready for {activity}', times: ['evening'], activity: true, byStage: {
    early: { action: 'Pack the gear for {activity} with a grown-up checking once.', anchors: ['the evening before {activity}'], ownership: 'Let {name} make the gear checklist with pictures.', support: 'A gear bag that lives in one spot.', principle: 'stacking' },
    middle: { action: 'Pack the gear for {activity}.', anchors: ['the evening before {activity}'], ownership: '{name} makes the gear checklist.', support: 'A gear bag that lives in one spot.', principle: 'stacking' },
    teen: { action: 'Pack the gear and sort the ride for {activity}.', anchors: ['the evening before {activity}'], ownership: '{name} asks for the ride a day ahead.', principle: 'ownership' },
  } },

  { id: 'calendar-check', category: 'other', title: 'Tomorrow on the calendar', times: ['evening', 'morning'], byStage: {
    preschool: { action: 'Put a sticker on today’s date on the calendar.', anchors: ['after breakfast'], ownership: 'Let {name} choose the stickers.', support: 'The calendar hung at eye level.', principle: 'feedback' },
    early: { action: 'Check tomorrow on the calendar and lay out what’s needed.', anchors: ['after dinner'], ownership: '{name} picks a color for plans on the calendar.', principle: 'stacking' },
    middle: { action: 'Add each new activity to the family calendar the same day.', anchors: ['as new plans come up'], ownership: '{name} adds plans in a chosen color.', support: 'A pen kept by the calendar.', principle: 'trigger' },
    teen: { action: 'Keep plans on the family calendar, rides included.', anchors: ['as plans are made'], ownership: '{name} asks for rides a day ahead.', principle: 'ownership' },
  }, shared: { title: 'Everyone’s plans on the calendar', action: 'Everyone adds their own plans to the family calendar.', ownership: 'Each child uses their own marker color.', support: 'The calendar at eye level, with a pen beside it.', anchors: ['after dinner', 'at the Family Meeting'],
    parts: { preschool: 'Put a sticker on today’s date.', early: 'Check tomorrow and say what’s needed.', middle: 'Add new plans the same day.', teen: 'Add plans and rides the same day.' } } },

  // A family habit, for families who told us little: the meeting itself.
  { id: 'family-meeting', category: 'other', title: 'Our Family Meeting', times: ['weekly'], byStage: {}, shared: {
    title: 'A regular Family Meeting', action: 'Hold the meeting at the same time each week.', anchors: ['after a meal everyone is home for', 'a weekend afternoon'], ownership: 'The kids take turns opening the meeting or choosing the snack.', support: 'Write the next meeting on the calendar before this one ends.',
  } },
];

export const habitItem = (id: string) => HABIT_LIBRARY.find((h) => h.id === id);
