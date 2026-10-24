/** Three carefully bounded April proof-of-concept dinners, each for about four people.
 * Tested household recipe library / dietary filtering is future work.
 * Keep these values as the single source for both Astro render and browser updates.
 */
export type DinnerOption = {
  id: string; name: string; time: string; servings: string;
  ingredients: string[]; instructions: string[];
};
export const aprilDinners: readonly DinnerOption[] = [
  {
    id: 'bowls', name: 'Build-Your-Own Taco Bowls', time: '25–30 min', servings: 'About 4 servings',
    ingredients: [
      '1 cup dry rice', '2 cups water', '2 cans (15 oz) black beans',
      '1 cup shredded cheese', '2 cups chopped lettuce', '½ cup salsa',
    ],
    instructions: [
      'Adult: rinse rice if needed. Combine rice and 2 cups water in a saucepan. Bring to a boil, cover, turn heat low, and simmer according to package directions (usually 15–20 minutes).',
      'Adult: drain and rinse beans. Warm them in a small pot over medium-low heat until hot, stirring occasionally.',
      'Helpers: wash lettuce, then an adult chops it. Set out cheese, lettuce and salsa in separate bowls.',
      'Captain: call everyone to build their bowls with rice, beans and toppings. Finish by directing the cleanup.',
    ],
  },
  {
    id: 'pasta', name: 'Pasta & Salad Night', time: '20–25 min', servings: 'About 4 servings',
    ingredients: [
      '12 oz dry pasta', '1 jar (24 oz) pasta sauce', '5 oz salad greens',
      '1 cucumber', '¼ cup salad dressing', '¼ cup grated Parmesan',
    ],
    instructions: [
      'Adult: bring a large pot of water to a boil. Add pasta and cook according to the package until tender. Drain carefully.',
      'Adult: warm the pasta sauce in a saucepan over medium-low heat, stirring until hot. Combine with drained pasta.',
      'Helpers: rinse salad greens and cucumber. An adult slices the cucumber; helpers toss everything with dressing.',
      'Captain: set the pasta, salad and Parmesan on the table. Invite everyone to serve themselves and share cleanup.',
    ],
  },
  {
    id: 'breakfast', name: 'Breakfast for Dinner', time: '20–25 min', servings: 'About 4 servings',
    ingredients: [
      '8 large eggs', '¼ cup milk or water', '8 slices bread', '1 tbsp butter or oil',
      '2 cups washed berries or fruit', '4 cups yogurt',
    ],
    instructions: [
      'Adult: whisk eggs and milk or water in a bowl. Melt butter in a nonstick skillet over medium-low heat.',
      'Adult: pour eggs into the skillet. Stir gently until fully set with no runny liquid remaining; turn off heat.',
      'Helpers: wash fruit, portion yogurt and set the table. An adult handles the toaster; toast bread in batches.',
      'Captain: check that everyone has food, then lead clearing dishes and resetting the kitchen.',
    ],
  },
];
