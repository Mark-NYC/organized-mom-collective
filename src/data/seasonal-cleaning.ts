/**
 * Room-by-room seasonal cleaning checklists: spring (/spring-cleaning-checklist), fall
 * (/fall-cleaning-checklist), the New Year declutter sprint (/new-year-declutter) and the paper clutter blitz
 * (/paper-clutter-blitz), all rendered by src/components/site/SeasonalChecklist.astro.
 * Task ids come from position (room id, section, task), so reordering tasks shifts saved ticks.
 */

export interface Room {
  id: string;
  name: string;
  /** A rough guide or when, shown beside the name ("About 30–45 min", "Weeks 1–2"). */
  time: string;
  /** Short label for its badge; defaults to the name. */
  badge?: string;
  /** Adds a countdown timer of this many minutes to the room. */
  minutes?: number;
  /** Two short sections: [title, tasks]. */
  sections: readonly (readonly [string, readonly string[]])[];
}

export const springRooms: readonly Room[] = [
  {
    id: 'entry',
    name: 'Entryway & Mudroom',
    time: 'About 30–45 min',
    sections: [
      ['Winter to spring', ['Pack away heavy coats and snow gear', 'Bring out spring jackets and rain gear', 'Swap winter boots for spring shoes', 'Sort bags and backpacks, donate what nobody uses']],
      ['Fresh & clean', ['Wipe the front door, handles and light switch', 'Shake out or wash the doormat', 'Vacuum and mop the entry floor']],
    ],
  },
  {
    id: 'living',
    name: 'Living Areas & Windows',
    time: 'About 60–90 min',
    sections: [
      ['Brighten & lighten', ['Pack away heavy throws and blankets', 'Swap in lighter pillow covers', 'Wash windows inside (and outside if you can reach)', 'Clear surfaces and shelves you’ve stopped seeing']],
      ['Deep clean', ['Dust ceiling fans, light fixtures and high shelves', 'Vacuum the sofa and wash removable covers', 'Wipe baseboards and remotes']],
    ],
  },
  {
    id: 'kitchen',
    name: 'Kitchen & Pantry',
    time: 'About 75–90 min',
    sections: [
      ['Pantry reset', ['Toss expired food and spices', 'Match every container to a lid, recycle the rest', 'Donate small appliances you don’t use', 'Group snacks where kids can reach them']],
      ['Deep clean', ['Empty and wipe out the fridge', 'Clean the oven, stovetop and microwave', 'Wipe cabinet fronts and handles', 'Run the dishwasher filter clean']],
    ],
  },
  {
    id: 'bedroom',
    name: 'Your Bedroom',
    time: 'About 45–60 min',
    sections: [
      ['Wardrobe swap', ['Pack away winter clothes and heavy bedding', 'Bring out spring clothes and lighter sheets', 'Donate what you didn’t wear last year', 'Sort jewelry and accessories']],
      ['Rest & reset', ['Clear and dust every surface', 'Rotate or flip the mattress, wash pillows', 'Vacuum under the bed']],
    ],
  },
  {
    id: 'kids',
    name: 'Kids’ Rooms & Play Areas',
    time: 'About 45–60 min per room',
    sections: [
      ['Outgrown & broken', ['Sort toys with your kids: keep, donate, toss', 'Check clothes against current sizes', 'Pack away winter gear', 'Restock art supplies, toss dried-out markers']],
      ['Fresh spaces', ['Dust furniture and wipe down toys', 'Vacuum and wash rugs that can be washed', 'Set up an easy spot for outdoor play gear']],
    ],
  },
  {
    id: 'bath',
    name: 'Bathrooms',
    time: 'About 30–45 min per bathroom',
    sections: [
      ['Cabinet reset', ['Check dates on medicine and toiletries', 'Toss expired products', 'Bring sunscreen and bug spray to the front', 'Sort the medicine cabinet']],
      ['Deep clean', ['Scrub the shower and tub, treat any mildew', 'Clean the toilet, base and floor around it', 'Wash bath mats and swap in fresh towels']],
    ],
  },
  {
    id: 'office',
    name: 'Papers & Digital',
    time: 'About 60–90 min',
    sections: [
      ['Paper', ['File tax documents', 'Shred what you don’t need to keep', 'Clear the school-paper pile', 'Clear and organize the desk']],
      ['Digital', ['Back up photos and important files', 'Unsubscribe from emails you never open', 'Delete duplicate files and old downloads']],
    ],
  },
  {
    id: 'outdoor',
    name: 'Outdoor & Garage',
    time: 'About 90–120 min',
    sections: [
      ['Outdoor', ['Clean patio furniture and cushions', 'Sweep or wash the porch, deck or walkways', 'Prep garden beds or pots', 'Check bikes, helmets and outdoor toys']],
      ['Garage or shed', ['Sort and donate what you don’t use', 'Hang tools and group sports gear', 'Sweep the floor']],
    ],
  },
];

export const fallRooms: readonly Room[] = [
  {
    id: 'entry',
    name: 'Entryway & Coat Closet',
    time: 'About 30–45 min',
    sections: [
      ['Declutter & sort', ['Put away summer items: flip-flops, beach bags, sun hats', 'Sort coats, donate outgrown or unworn ones', 'Match shoe pairs, donate the singles', 'Sort bags, backpacks and accessories']],
      ['Clean & set up', ['Wipe the front door, handles and light switch', 'Vacuum the entry and coat closet floor', 'Set out fall basics: umbrella stand, boot tray']],
    ],
  },
  {
    id: 'living',
    name: 'Living & Family Room',
    time: 'About 45–60 min',
    sections: [
      ['Declutter & reset', ['Clear the coffee table, side tables and shelves', 'Sort books, magazines and games', 'Donate toys and games nobody plays with', 'Pack away summer decor and light throws']],
      ['Clean & cozy', ['Dust surfaces, lamps and picture frames', 'Vacuum the sofa and under the cushions', 'Bring out warm blankets']],
    ],
  },
  {
    id: 'kitchen',
    name: 'Kitchen & Pantry',
    time: 'About 60–90 min',
    sections: [
      ['Pantry & cabinets', ['Toss expired food and spices', 'Group baking supplies for the holidays', 'Match every container to a lid, recycle the rest', 'Donate small appliances you don’t use']],
      ['Deep clean', ['Empty and wipe out the fridge and freezer', 'Clean the oven and stovetop', 'Wipe cabinet fronts and handles', 'Stock soup and comfort-food staples']],
    ],
  },
  {
    id: 'bedroom',
    name: 'Your Bedroom',
    time: 'About 45–60 min',
    sections: [
      ['Wardrobe swap', ['Pack away summer clothes and light sheets', 'Bring out fall clothes and warm bedding', 'Donate what doesn’t fit or didn’t get worn', 'Store sandals, bring out boots']],
      ['Rest & reset', ['Clear nightstands and the dresser top', 'Dust furniture and wipe mirrors', 'Vacuum, including under the bed']],
    ],
  },
  {
    id: 'kids',
    name: 'Kids’ Rooms',
    time: 'About 30–45 min per room',
    sections: [
      ['Declutter together', ['Sort toys with your kids: keep, donate, toss', 'Sort books and school supplies', 'Swap summer clothes for fall, check sizes', 'Clear the desk, dresser and nightstand']],
      ['Clean & set up', ['Dust furniture and wipe surfaces', 'Vacuum and sort what’s under the bed', 'Set up a cozy reading corner']],
    ],
  },
  {
    id: 'bath',
    name: 'Bathrooms',
    time: 'About 20–30 min per bathroom',
    sections: [
      ['Cabinet reset', ['Check dates on medicine and vitamins', 'Toss expired products', 'Put sunscreen away for the season', 'Stock lip balm, lotion and tissues']],
      ['Deep clean', ['Scrub the shower, tub and grout', 'Clean the toilet, base and floor around it', 'Swap in fresh towels and bath mats']],
    ],
  },
  {
    id: 'office',
    name: 'Papers & Holiday Prep',
    time: 'About 60–90 min',
    sections: [
      ['Paper', ['Sort the mail pile, file what matters', 'Gather this year’s tax papers and receipts in one folder', 'Shred old paperwork you don’t need to keep', 'Clear the school-paper pile']],
      ['Holiday prep', ['Clear the desk and sort supplies', 'Set up one spot for gift and holiday plans', 'Check gift wrap, tape and card supplies']],
    ],
  },
  {
    id: 'storage',
    name: 'Basement, Garage & Storage',
    time: 'About 90–120 min',
    sections: [
      ['Seasonal swap', ['Pack away summer gear: pool, beach, outdoor toys', 'Bring out coats, boots and fall decorations', 'Put holiday decorations where you can reach them', 'Check flashlights, batteries and emergency supplies']],
      ['Declutter', ['Go through storage boxes, donate what you don’t use', 'Sweep or vacuum the storage area', 'Label every bin']],
    ],
  },
];

/** The New Year declutter sprint: eight weeks, two weeks per area, plus jobs the kids can own. */
export const newYearRooms: readonly Room[] = [
  {
    id: 'toys',
    name: 'Toys',
    time: 'Weeks 1–2',
    sections: [
      ['Sort it', ['Gather all the toys in one spot', 'Sort with the kids: keep, give away, broken', 'Broken toys out, give-aways in the car']],
      ['Set it up', ['Low, labeled bins kids can reach', 'One bin out at a time', 'A 10-minute pickup timer before dinner']],
    ],
  },
  {
    id: 'clothes',
    name: 'Clothes',
    time: 'Weeks 3–4',
    sections: [
      ['Sort it', ['Kids try on winter clothes: what still fits?', 'Three piles: donate, save for a sibling, keep', 'Your own closet: what you actually wore this winter']],
      ['Set it up', ['Spring clothes checked and sized', 'Tomorrow’s outfit spot for each kid', 'Dress-up clothes in one bin']],
    ],
  },
  {
    id: 'kitchen',
    name: 'Kitchen',
    time: 'Weeks 5–6',
    sections: [
      ['Sort it', ['Expired holiday baking supplies out', 'Gadgets you didn’t use this year: donate', 'Containers matched to lids, the rest recycled']],
      ['Set it up', ['A snack spot kids can reach', 'Coffee or tea station in one place', 'One clear stretch of counter for meal prep']],
    ],
  },
  {
    id: 'paper',
    name: 'Paper',
    time: 'Weeks 7–8',
    sections: [
      ['Sort it', ['Holiday cards: keep the special ones', 'Important papers filed, junk mail recycled', 'Kids’ artwork: keep a few favorites, photograph the rest']],
      ['Set it up', ['One spot for incoming mail by the door', 'School dates and key numbers on the calendar', 'Five minutes with the mail each evening']],
    ],
  },
  {
    id: 'kids',
    name: 'Jobs the Kids Own',
    time: 'All eight weeks',
    badge: 'Kid helpers',
    sections: [
      ['Ages 4–6', ['Put toys back in the right bin', 'Sort socks by person', 'Count items for the donation box']],
      ['Ages 7–10', ['Try on clothes and call out what doesn’t fit', 'Run the 10-minute pickup timer', 'Carry the donation bag to the car']],
    ],
  },
];

/**
 * The three-day paper clutter blitz (/paper-clutter-blitz), timed. Uses the same two pockets as FP-03
 * (/resources/home-command-center): “Needs attention” and “Ready to go”. Don't introduce another paper system.
 */
export const paperBlitzDays: readonly Room[] = [
  {
    id: 'day1',
    name: 'Day 1: Clear the Counter',
    time: '15 minutes',
    badge: 'Day 1',
    minutes: 15,
    sections: [
      ['Gather', ['Three piles or bags: trash & recycling, needs attention, keep', 'Papers from the counter, table, car, backpacks and “that chair”']],
      ['Sort fast', ['Don’t read everything: grab, glance, drop', 'Out now: old flyers, expired coupons, takeout menus', 'Done when the timer stops, even mid-pile']],
    ],
  },
  {
    id: 'day2',
    name: 'Day 2: Give Papers a Home',
    time: '10 minutes',
    badge: 'Day 2',
    minutes: 10,
    sections: [
      ['Two pockets', ['“Needs attention” pocket by the calendar', '“Ready to go” pocket beside it', 'Today’s “needs attention” pile goes in']],
      ['One folder', ['One folder or file box for papers you keep', 'Four sections: school, medical, activities, house & money', 'Yesterday’s “keep” pile filed']],
    ],
  },
  {
    id: 'day3',
    name: 'Day 3: The 5-Minute Habit',
    time: '5 minutes',
    badge: 'Day 3',
    minutes: 5,
    sections: [
      ['Every evening', ['New papers land in “needs attention”, nowhere else', 'After dinner: dates on the calendar, forms signed', 'Signed forms into “ready to go”, then into bags']],
      ['Once a week', ['Clear both pockets in your weekly reset', 'Photograph keepers into a “Family Docs” album', 'Recycle anything past its date']],
    ],
  },
];
