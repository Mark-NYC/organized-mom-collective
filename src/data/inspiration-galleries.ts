/** Image-first Pinterest inspiration galleries. Originals live in public/images/inspiration. */
export type GalleryIdea = {
  id: string; title: string; navLabel: string; tip: string; tryThis: string;
  secondTitle: string; secondTip: string;
  alt: string; image: string; pinDescription: string;
  category: 'Storage' | 'Hooks & walls' | 'Small spaces' | 'Family routines';
};
export type InspirationGallery = {
  slug: string; title: string; seoTitle: string; description: string;
  deck: string; disclosure: string; published: boolean; ideas: GalleryIdea[];
};
const ideas: GalleryIdea[] = [
  {
    id: 'idea-1', navLabel: 'Bench + shoes', image: '/images/inspiration/small-mudroom-ideas/small-mudroom-built-in-bench-shoe-storage.jpeg',
    title: 'A built-in bench with shoe storage', tip: 'Put daily shoes below the bench, not across the doorway.', tryThis: 'Give each family member one assigned shoe compartment.',
    secondTitle: 'Give each person a shoe zone', secondTip: 'An assigned cubby makes it obvious where shoes go.',
    alt: 'small mudroom built in bench shoe storage concept image of an organized small family mudroom.',
    category: 'Storage',
    pinDescription: 'A built-in bench with shoe storage. Small mudroom ideas for busy families, including practical storage inspiration and family-friendly entryway organization.'
  },
  {
    id: 'idea-2', navLabel: 'Farmhouse bench', image: '/images/inspiration/small-mudroom-ideas/small-farmhouse-mudroom-beadboard-wood-bench.jpeg',
    title: 'Try a simple farmhouse bench', tip: 'A wooden bench brings useful seating to a small mudroom without needing a full renovation.', tryThis: 'Pair it with wall hooks instead of a bulky coat rack.',
    secondTitle: 'Use beadboard as a durable wall finish', secondTip: 'Paneling can add texture to the wall that gets the most bumps and scuffs.',
    alt: 'small farmhouse mudroom beadboard wood bench concept image of an organized small family mudroom.',
    category: 'Small spaces',
    pinDescription: 'Try a simple farmhouse bench. Small mudroom ideas for busy families, including practical storage inspiration and family-friendly entryway organization.'
  },
  {
    id: 'idea-3', navLabel: 'Vertical cubbies', image: '/images/inspiration/small-mudroom-ideas/narrow-mudroom-vertical-storage-cubbies.jpeg',
    title: 'Go vertical in a narrow mudroom', tip: 'Tall cubbies take advantage of height when floor space is tight.', tryThis: 'Keep the lowest compartments for kids\' everyday things.',
    secondTitle: 'Keep seasonal gear on the top shelf', secondTip: 'Store rarely used items higher and daily backpacks within reach.',
    alt: 'narrow mudroom vertical storage cubbies concept image of an organized small family mudroom.',
    category: 'Small spaces',
    pinDescription: 'Go vertical in a narrow mudroom. Small mudroom ideas for busy families, including practical storage inspiration and family-friendly entryway organization.'
  },
  {
    id: 'idea-4', navLabel: 'Kid-friendly hooks', image: '/images/inspiration/small-mudroom-ideas/colorful-family-mudroom-kid-friendly-hooks.jpeg',
    title: 'Use colorful hooks kids can reach', tip: 'Kid-height hooks can help children put away their own coats and backpacks.', tryThis: 'Mount hooks for the child who actually uses them.',
    secondTitle: 'Give each child a designated spot', secondTip: 'A consistent place for each person\'s things cuts down on the morning hunt.',
    alt: 'colorful family mudroom kid friendly hooks concept image of an organized small family mudroom.',
    category: 'Family routines',
    pinDescription: 'Use colorful hooks kids can reach. Small mudroom ideas for busy families, including practical storage inspiration and family-friendly entryway organization.'
  },
  {
    id: 'idea-5', navLabel: 'Hidden bench storage', image: '/images/inspiration/small-mudroom-ideas/cozy-small-mudroom-hidden-storage-bench.jpeg',
    title: 'Hide the everyday clutter in a bench', tip: 'Closed bench storage keeps loose accessories out of sight.', tryThis: 'Check that lids or drawers can open without hitting the door.',
    secondTitle: 'Make sitting down part of shoe time', secondTip: 'A comfortable spot helps little kids manage shoes without dropping everything on the floor.',
    alt: 'cozy small mudroom hidden storage bench concept image of an organized small family mudroom.',
    category: 'Storage',
    pinDescription: 'Hide the everyday clutter in a bench. Small mudroom ideas for busy families, including practical storage inspiration and family-friendly entryway organization.'
  },
  {
    id: 'idea-6', navLabel: 'Minimalist storage', image: '/images/inspiration/small-mudroom-ideas/modern-minimalist-mudroom-hidden-shoe-storage.jpeg',
    title: 'Keep shoe storage behind closed fronts', tip: 'Concealed compartments make an entryway feel less busy.', tryThis: 'Leave ventilation for damp footwear.',
    secondTitle: 'Keep one clear surface for keys', secondTip: 'A small uncluttered landing spot is easier to maintain than a catchall counter.',
    alt: 'modern minimalist mudroom hidden shoe storage concept image of an organized small family mudroom.',
    category: 'Storage',
    pinDescription: 'Keep shoe storage behind closed fronts. Small mudroom ideas for busy families, including practical storage inspiration and family-friendly entryway organization.'
  },
  {
    id: 'idea-7', navLabel: 'Corner bench', image: '/images/inspiration/small-mudroom-ideas/corner-mudroom-l-shaped-bench-storage.jpeg',
    title: 'Turn an awkward corner into storage', tip: 'An L-shaped bench can work around two walls without taking over the center of a room.', tryThis: 'Measure traffic clearance before choosing a corner bench.',
    secondTitle: 'Use two walls for different jobs', secondTip: 'Dedicate one wall to coats and the other to shoes or bags.',
    alt: 'corner mudroom l shaped bench storage concept image of an organized small family mudroom.',
    category: 'Small spaces',
    pinDescription: 'Turn an awkward corner into storage. Small mudroom ideas for busy families, including practical storage inspiration and family-friendly entryway organization.'
  },
  {
    id: 'idea-8', navLabel: 'Hallway drop zone', image: '/images/inspiration/small-mudroom-ideas/no-mudroom-small-entryway-hallway-drop-zone.jpg',
    title: 'Build a drop zone without a mudroom', tip: 'A hallway or entry nook can do the job with just a few intentional pieces.', tryThis: 'Start with hooks and one small shoe solution.',
    secondTitle: 'Keep the walkway open', secondTip: 'Choose slim storage and leave enough room to carry groceries and backpacks through.',
    alt: 'no mudroom small entryway hallway drop zone concept image of an organized small family mudroom.',
    category: 'Small spaces',
    pinDescription: 'Build a drop zone without a mudroom. Small mudroom ideas for busy families, including practical storage inspiration and family-friendly entryway organization.'
  },
  {
    id: 'idea-9', navLabel: 'Baskets + cubbies', image: '/images/inspiration/small-mudroom-ideas/mudroom-open-cubbies-baskets-seasonal-storage.jpeg',
    title: 'Use baskets inside open cubbies', tip: 'Baskets keep small accessories from spilling off open shelves.', tryThis: 'Use different containers for gloves, hats, and sports gear.',
    secondTitle: 'Rotate seasonal accessories', secondTip: 'Keep only the current season within easy reach.',
    alt: 'mudroom open cubbies baskets seasonal storage concept image of an organized small family mudroom.',
    category: 'Storage',
    pinDescription: 'Use baskets inside open cubbies. Small mudroom ideas for busy families, including practical storage inspiration and family-friendly entryway organization.'
  },
  {
    id: 'idea-10', navLabel: 'Kids\' lockers', image: '/images/inspiration/small-mudroom-ideas/three-kids-mudroom-lockers-backpack-storage.jpeg',
    title: 'Give each kid a backpack station', tip: 'Separate locker-style spaces make after-school drop-off predictable.', tryThis: 'Place the most-used backpacks where children can reach.',
    secondTitle: 'Make packing tomorrow\'s bag a shared habit', secondTip: 'Return permission slips and supplies to the same station each evening.',
    alt: 'three kids mudroom lockers backpack storage concept image of an organized small family mudroom.',
    category: 'Family routines',
    pinDescription: 'Give each kid a backpack station. Small mudroom ideas for busy families, including practical storage inspiration and family-friendly entryway organization.'
  },
  {
    id: 'idea-11', navLabel: 'Boot trays', image: '/images/inspiration/small-mudroom-ideas/small-mudroom-shoe-cubbies-boot-tray-organization.jpeg',
    title: 'Add a boot tray for messy weather', tip: 'A tray contains wet boots before puddles spread across the entryway.', tryThis: 'Look for a tray with a raised rim and easy-clean surface.',
    secondTitle: 'Reserve cubbies for dry shoes', secondTip: 'Separate wet boots from everyday sneakers to make cleanup easier.',
    alt: 'small mudroom shoe cubbies boot tray organization concept image of an organized small family mudroom.',
    category: 'Storage',
    pinDescription: 'Add a boot tray for messy weather. Small mudroom ideas for busy families, including practical storage inspiration and family-friendly entryway organization.'
  },
  {
    id: 'idea-12', navLabel: 'Under-stairs nook', image: '/images/inspiration/small-mudroom-ideas/under-stairs-mudroom-shoe-storage-bench.jpeg',
    title: 'Put the space under the stairs to work', tip: 'An under-stairs nook can hold shoe storage and a compact seat.', tryThis: 'Measure the lowest usable height before installing shelves.',
    secondTitle: 'Keep the lowest storage easy for kids', secondTip: 'Put shoes and other daily belongings in compartments children can access.',
    alt: 'under stairs mudroom shoe storage bench concept image of an organized small family mudroom.',
    category: 'Small spaces',
    pinDescription: 'Put the space under the stairs to work. Small mudroom ideas for busy families, including practical storage inspiration and family-friendly entryway organization.'
  },
  {
    id: 'idea-13', navLabel: 'Sliding-door storage', image: '/images/inspiration/small-mudroom-ideas/small-mudroom-sliding-door-storage-bench.jpeg',
    title: 'Use sliding doors where space is tight', tip: 'Sliding fronts can provide storage where swinging doors would block a walkway.', tryThis: 'Check that tracks are easy to clean.',
    secondTitle: 'Hide the backup supplies', secondTip: 'Store extra bags and out-of-season items behind closed doors, not on daily hooks.',
    alt: 'small mudroom sliding door storage bench concept image of an organized small family mudroom.',
    category: 'Storage',
    pinDescription: 'Use sliding doors where space is tight. Small mudroom ideas for busy families, including practical storage inspiration and family-friendly entryway organization.'
  },
  {
    id: 'idea-14', navLabel: 'Laundry + mudroom', image: '/images/inspiration/small-mudroom-ideas/small-mudroom-laundry-room-combo-entryway.jpeg',
    title: 'Combine a mudroom and laundry zone', tip: 'If the laundry room sits near an entry, shared storage can serve both purposes.', tryThis: 'Give jackets and laundry separate places.',
    secondTitle: 'Create a landing spot for muddy clothes', secondTip: 'A nearby hamper prevents worn sports gear from traveling through the house.',
    alt: 'small mudroom laundry room combo entryway concept image of an organized small family mudroom.',
    category: 'Family routines',
    pinDescription: 'Combine a mudroom and laundry zone. Small mudroom ideas for busy families, including practical storage inspiration and family-friendly entryway organization.'
  },
  {
    id: 'idea-15', navLabel: 'Budget DIY', image: '/images/inspiration/small-mudroom-ideas/budget-friendly-diy-mudroom-makeover.jpeg',
    title: 'Start with a budget-friendly mudroom update', tip: 'A few well-placed hooks, simple shelving, and shoe storage can change how the entryway works.', tryThis: 'Improve one trouble spot before buying more storage.',
    secondTitle: 'Finish with a five-minute family reset', secondTip: 'Have each person return shoes, coats, and bags to their spot after coming home.',
    alt: 'budget friendly diy mudroom makeover concept image of an organized small family mudroom.',
    category: 'Family routines',
    pinDescription: 'Start with a budget-friendly mudroom update. Small mudroom ideas for busy families, including practical storage inspiration and family-friendly entryway organization.'
  }
];
export const inspirationGalleries: InspirationGallery[] = [{
  slug: 'small-mudroom-ideas', title: '30 Small Mudroom Ideas for Busy Families',
  seoTitle: '30 Small Mudroom Ideas for Busy Families',
  description: 'Explore 30 small mudroom ideas for families, from storage benches and backpack hooks to shoe baskets and compact entryway solutions.',
  deck: '15 inspiring spaces. 30 practical ideas for backpacks, shoes, coats, and the after-school pileup.',
  disclosure: 'These images are AI-generated design inspiration, not photographs of actual homes or listings for specific furniture.',
  published: true,
  ideas
}];
