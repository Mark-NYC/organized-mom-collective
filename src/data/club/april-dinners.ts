/** April dinner library · 12 dinner categories × 4 ready-to-lead plans.
 * Each meal is portioned for approximately four and labeled by realistic level of effort.
 * Recipes are curated prototypes, not a dietary/allergy-aware recipe service.
 */
export type DinnerEffort='full'|'quick'|'minimal';
export type DinnerCategory={id:string;name:string};
export type DinnerOption={id:string;category:string;effort:DinnerEffort;name:string;time:string;servings:string;ingredients:string[];instructions:string[]};
export const dinnerCategories:readonly DinnerCategory[]=[
  {
    "id": "tacos",
    "name": "Taco night"
  },
  {
    "id": "pasta",
    "name": "Pasta night"
  },
  {
    "id": "rice",
    "name": "Rice bowls"
  },
  {
    "id": "sandwiches",
    "name": "Sandwich night"
  },
  {
    "id": "pizza",
    "name": "Pizza night"
  },
  {
    "id": "breakfast",
    "name": "Breakfast for dinner"
  },
  {
    "id": "sheetpan",
    "name": "Sheet-pan dinner"
  },
  {
    "id": "soup",
    "name": "Soup night"
  },
  {
    "id": "quesadillas",
    "name": "Quesadilla night"
  },
  {
    "id": "burgers",
    "name": "Burger night"
  },
  {
    "id": "potatoes",
    "name": "Baked potato night"
  },
  {
    "id": "onepot",
    "name": "One-pot dinner"
  }
];
export const aprilDinners:readonly DinnerOption[]=[
  {
    "id": "tacos-a",
    "category": "tacos",
    "effort": "full",
    "name": "Beef & pepper tacos",
    "time": "30–35 min",
    "servings": "About 4 servings",
    "ingredients": [
      "1 lb ground beef",
      "2 bell peppers",
      "8 tortillas",
      "1 packet taco seasoning",
      "1 cup shredded cheese",
      "½ cup salsa"
    ],
    "instructions": [
      "Adult: slice peppers; sauté in a little water until tender. In another pan brown beef to 160°F, then add seasoning and water according to packet.",
      "Adult: warm tortillas according to package. Helpers put cheese and salsa into serving bowls.",
      "Captain: bring out beef, peppers, tortillas and toppings. Everyone builds their tacos.",
      "Dinner Captain: check everyone has a plate, then ask the team to clear dishes, store leftovers safely, and reset the kitchen."
    ]
  },
  {
    "id": "tacos-b",
    "category": "tacos",
    "effort": "quick",
    "name": "Bean & cheese tacos",
    "time": "15–20 min",
    "servings": "About 4 servings",
    "ingredients": [
      "2 cans (15 oz) black beans",
      "8 tortillas",
      "1 cup shredded cheese",
      "1 tsp cumin",
      "½ cup salsa",
      "2 cups shredded lettuce"
    ],
    "instructions": [
      "Adult: rinse beans and warm in a saucepan with cumin and a splash of water until steaming.",
      "Helpers put shredded cheese, washed lettuce and salsa into small bowls. Adult warms tortillas according to package.",
      "Captain: put warm beans and toppings on the table for everyone to serve.",
      "Dinner Captain: check everyone has a plate, then ask the team to clear dishes, store leftovers safely, and reset the kitchen."
    ]
  },
  {
    "id": "tacos-c",
    "category": "tacos",
    "effort": "quick",
    "name": "Chicken & avocado tacos",
    "time": "15–20 min",
    "servings": "About 4 servings",
    "ingredients": [
      "2 cups cooked shredded chicken",
      "8 tortillas",
      "1 avocado",
      "1 cup shredded lettuce",
      "½ cup salsa",
      "1 lime"
    ],
    "instructions": [
      "Adult: heat fully cooked chicken in a saucepan until steaming; check that leftovers reach 165°F.",
      "Adult: halve and slice avocado; helpers set out lettuce and salsa. Warm tortillas according to package.",
      "Captain: invite everyone to fill tortillas with chicken and toppings; add lime as desired.",
      "Dinner Captain: check everyone has a plate, then ask the team to clear dishes, store leftovers safely, and reset the kitchen."
    ]
  },
  {
    "id": "tacos-d",
    "category": "tacos",
    "effort": "minimal",
    "name": "Pantry bean tacos",
    "time": "5–10 min",
    "servings": "About 4 servings",
    "ingredients": [
      "2 cans (15 oz) refried beans",
      "8 tortillas",
      "1 cup shredded cheese",
      "½ cup jarred salsa",
      "1 bag shredded lettuce",
      "1 cup plain yogurt"
    ],
    "instructions": [
      "Adult: heat canned refried beans according to label until hot, stirring; warm tortillas according to package.",
      "Helpers set out cheese, salsa, ready-to-eat lettuce and yogurt; no chopping required.",
      "Captain: have everyone fill their own tortillas and take responsibility for dishes.",
      "Dinner Captain: check everyone has a plate, then ask the team to clear dishes, store leftovers safely, and reset the kitchen."
    ]
  },
  {
    "id": "pasta-a",
    "category": "pasta",
    "effort": "full",
    "name": "Baked mozzarella pasta",
    "time": "35–45 min",
    "servings": "About 4 servings",
    "ingredients": [
      "12 oz dry penne",
      "1 jar (24 oz) marinara",
      "1 cup ricotta",
      "1½ cups shredded mozzarella",
      "2 cups spinach",
      "1 tbsp olive oil"
    ],
    "instructions": [
      "Adult: preheat oven to 375°F. Cook pasta according to package, drain, and toss with marinara and washed spinach.",
      "Spread in an oiled baking dish. Dot with ricotta and cover with mozzarella.",
      "Adult: bake about 20 minutes until piping hot and bubbling. Let stand briefly before serving.",
      "Dinner Captain: check everyone has a plate, then ask the team to clear dishes, store leftovers safely, and reset the kitchen."
    ]
  },
  {
    "id": "pasta-b",
    "category": "pasta",
    "effort": "quick",
    "name": "Spaghetti & salad",
    "time": "15–20 min",
    "servings": "About 4 servings",
    "ingredients": [
      "12 oz dry spaghetti",
      "1 jar (24 oz) marinara",
      "5 oz prewashed greens",
      "¼ cup salad dressing",
      "¼ cup Parmesan",
      "1 tbsp olive oil"
    ],
    "instructions": [
      "Adult: boil spaghetti according to package and drain carefully.",
      "Adult: warm marinara in a saucepan until steaming, then mix with pasta.",
      "Helpers dress salad greens and put Parmesan on table; captain serves.",
      "Dinner Captain: check everyone has a plate, then ask the team to clear dishes, store leftovers safely, and reset the kitchen."
    ]
  },
  {
    "id": "pasta-c",
    "category": "pasta",
    "effort": "quick",
    "name": "Pesto tomato pasta",
    "time": "15–20 min",
    "servings": "About 4 servings",
    "ingredients": [
      "12 oz dry pasta",
      "½ cup prepared pesto",
      "1 cup cherry tomatoes",
      "¼ cup Parmesan",
      "2 tbsp pasta water",
      "1 bag prewashed spinach"
    ],
    "instructions": [
      "Adult: cook pasta according to package; save 2 tbsp cooking water before draining.",
      "Adult: mix hot pasta with pesto and water; stir in washed spinach to wilt.",
      "Helpers rinse tomatoes and put out Parmesan; captain serves pasta.",
      "Dinner Captain: check everyone has a plate, then ask the team to clear dishes, store leftovers safely, and reset the kitchen."
    ]
  },
  {
    "id": "pasta-d",
    "category": "pasta",
    "effort": "minimal",
    "name": "Ready-made ravioli",
    "time": "10–15 min",
    "servings": "About 4 servings",
    "ingredients": [
      "2 packages (9 oz each) refrigerated ravioli",
      "1 jar (24 oz) pasta sauce",
      "1 bag prewashed salad",
      "¼ cup dressing",
      "¼ cup Parmesan",
      "1 loaf ready-to-eat bread"
    ],
    "instructions": [
      "Adult: cook ravioli according to package and drain gently.",
      "Adult: warm jarred sauce in a pan until steaming. Toss with ravioli.",
      "Helpers pour dressing over salad and set out Parmesan and bread. Captain serves.",
      "Dinner Captain: check everyone has a plate, then ask the team to clear dishes, store leftovers safely, and reset the kitchen."
    ]
  },
  {
    "id": "rice-a",
    "category": "rice",
    "effort": "full",
    "name": "Teriyaki chicken bowls",
    "time": "30–35 min",
    "servings": "About 4 servings",
    "ingredients": [
      "1 lb boneless chicken breast",
      "1 cup dry rice",
      "2 cups water",
      "2 cups broccoli florets",
      "⅓ cup teriyaki sauce",
      "1 tbsp oil"
    ],
    "instructions": [
      "Adult: cook rice in water per package. Dice chicken and cook in oil until 165°F throughout.",
      "Steam broccoli until tender. Mix cooked chicken with teriyaki sauce and heat until hot.",
      "Captain: set out rice, chicken and broccoli in bowls and ask everyone to serve.",
      "Dinner Captain: check everyone has a plate, then ask the team to clear dishes, store leftovers safely, and reset the kitchen."
    ]
  },
  {
    "id": "rice-b",
    "category": "rice",
    "effort": "quick",
    "name": "Egg & veggie rice bowls",
    "time": "15–20 min",
    "servings": "About 4 servings",
    "ingredients": [
      "3 cups fully cooked refrigerated rice",
      "4 eggs",
      "2 cups frozen mixed vegetables",
      "2 tbsp soy sauce",
      "1 tbsp oil",
      "1 tsp sesame oil"
    ],
    "instructions": [
      "Adult: scramble eggs in an oiled skillet until fully set; set aside.",
      "Adult: cook frozen vegetables as package directs, then stir-fry with rice until piping hot (165°F for leftovers).",
      "Mix eggs and soy sauce through rice. Captain portions bowls.",
      "Dinner Captain: check everyone has a plate, then ask the team to clear dishes, store leftovers safely, and reset the kitchen."
    ]
  },
  {
    "id": "rice-c",
    "category": "rice",
    "effort": "quick",
    "name": "Mediterranean couscous bowls",
    "time": "15 min",
    "servings": "About 4 servings",
    "ingredients": [
      "1 cup dry couscous",
      "1¼ cups water",
      "1 can (15 oz) chickpeas",
      "1 cucumber",
      "1 cup cherry tomatoes",
      "½ cup hummus"
    ],
    "instructions": [
      "Adult: cook couscous with water according to package directions, then fluff.",
      "Drain and rinse chickpeas. Adult dices cucumber; helpers rinse tomatoes.",
      "Captain: lay out couscous, chickpeas, vegetables and hummus so everyone can build a bowl.",
      "Dinner Captain: check everyone has a plate, then ask the team to clear dishes, store leftovers safely, and reset the kitchen."
    ]
  },
  {
    "id": "rice-d",
    "category": "rice",
    "effort": "minimal",
    "name": "Microwave rice & bean bowls",
    "time": "5–10 min",
    "servings": "About 4 servings",
    "ingredients": [
      "2 pouches (8.8 oz) microwave rice",
      "2 cans (15 oz) black beans",
      "1 cup shredded cheese",
      "½ cup salsa",
      "1 bag shredded lettuce",
      "1 avocado"
    ],
    "instructions": [
      "Adult: heat rice following package instructions; rinse beans and microwave in a safe bowl until hot.",
      "Adult: slice avocado; helpers put out bagged lettuce, salsa and cheese.",
      "Captain: let everyone assemble a rice and bean bowl; check the kitchen is reset afterward.",
      "Dinner Captain: check everyone has a plate, then ask the team to clear dishes, store leftovers safely, and reset the kitchen."
    ]
  },
  {
    "id": "sandwiches-a",
    "category": "sandwiches",
    "effort": "full",
    "name": "Oven turkey melts",
    "time": "25–30 min",
    "servings": "About 4 servings",
    "ingredients": [
      "8 slices whole-grain bread",
      "12 oz sliced turkey",
      "8 slices cheddar",
      "2 tomatoes",
      "1 tbsp butter",
      "1 bag prewashed salad"
    ],
    "instructions": [
      "Adult: heat oven to 375°F. Assemble turkey, cheese and adult-sliced tomato between bread slices.",
      "Brush outer bread lightly with butter; bake on a sheet pan about 10–15 minutes, turning once, until hot and cheese melts.",
      "Captain: serve warm melts with washed salad and direct cleanup.",
      "Dinner Captain: check everyone has a plate, then ask the team to clear dishes, store leftovers safely, and reset the kitchen."
    ]
  },
  {
    "id": "sandwiches-b",
    "category": "sandwiches",
    "effort": "quick",
    "name": "Grilled cheese & tomato soup",
    "time": "15–20 min",
    "servings": "About 4 servings",
    "ingredients": [
      "8 slices bread",
      "8 slices cheddar",
      "2 tbsp butter",
      "2 cans tomato soup",
      "2 cans water or milk (per label)",
      "1 bag baby carrots"
    ],
    "instructions": [
      "Adult: prepare canned soup with liquid according to label; heat until hot.",
      "Adult: butter bread and grill cheese sandwiches over medium heat until golden and melted, flipping once.",
      "Helpers portion ready-to-eat carrots. Captain serves soup and sandwiches.",
      "Dinner Captain: check everyone has a plate, then ask the team to clear dishes, store leftovers safely, and reset the kitchen."
    ]
  },
  {
    "id": "sandwiches-c",
    "category": "sandwiches",
    "effort": "quick",
    "name": "Turkey & hummus wraps",
    "time": "10–15 min",
    "servings": "About 4 servings",
    "ingredients": [
      "4 large tortillas",
      "12 oz ready-to-eat sliced turkey",
      "½ cup hummus",
      "2 cups prewashed spinach",
      "1 cup shredded carrots",
      "1 cucumber"
    ],
    "instructions": [
      "Adult: rinse and slice cucumber; helpers lay out tortillas.",
      "Spread hummus, then add ready-to-eat turkey, spinach, carrots and cucumber.",
      "Roll tightly and cut with adult help. Captain sets out wraps and drinks.",
      "Dinner Captain: check everyone has a plate, then ask the team to clear dishes, store leftovers safely, and reset the kitchen."
    ]
  },
  {
    "id": "sandwiches-d",
    "category": "sandwiches",
    "effort": "minimal",
    "name": "Deli sandwich board",
    "time": "5–10 min",
    "servings": "About 4 servings",
    "ingredients": [
      "8 slices whole-grain bread",
      "12 oz ready-to-eat deli turkey",
      "8 cheese slices",
      "1 bag prewashed lettuce",
      "1 jar pickles",
      "1 bag baby carrots"
    ],
    "instructions": [
      "Helpers wash hands and put bread, turkey, cheese and lettuce onto a serving board.",
      "Adult: put out pickles and washed baby carrots; check ingredients for dietary restrictions.",
      "Captain: invite everyone to assemble sandwiches, then return refrigerated ingredients promptly.",
      "Dinner Captain: check everyone has a plate, then ask the team to clear dishes, store leftovers safely, and reset the kitchen."
    ]
  },
  {
    "id": "pizza-a",
    "category": "pizza",
    "effort": "full",
    "name": "Homemade sheet-pan pizza",
    "time": "35–45 min",
    "servings": "About 4 servings",
    "ingredients": [
      "1 lb prepared pizza dough",
      "½ cup pizza sauce",
      "2 cups shredded mozzarella",
      "½ cup sliced mushrooms",
      "1 bell pepper",
      "1 tbsp olive oil"
    ],
    "instructions": [
      "Adult: heat oven to 450°F and stretch dough onto an oiled sheet pan.",
      "Adult slices pepper; helpers spread sauce and sprinkle cheese and vegetables.",
      "Adult: bake 15–20 minutes or until crust is cooked and cheese bubbles; cool briefly before serving.",
      "Dinner Captain: check everyone has a plate, then ask the team to clear dishes, store leftovers safely, and reset the kitchen."
    ]
  },
  {
    "id": "pizza-b",
    "category": "pizza",
    "effort": "quick",
    "name": "English muffin pizzas",
    "time": "15–20 min",
    "servings": "About 4 servings",
    "ingredients": [
      "8 English muffin halves",
      "½ cup pizza sauce",
      "1 cup shredded mozzarella",
      "¼ cup pepperoni",
      "1 bell pepper",
      "1 bag salad greens"
    ],
    "instructions": [
      "Adult: heat oven to 425°F. Put muffin halves on a tray and spread each with sauce.",
      "Adult slices pepper; helpers add mozzarella, pepper and pepperoni.",
      "Adult: bake 8–10 minutes until hot and cheese melts. Captain serves with greens.",
      "Dinner Captain: check everyone has a plate, then ask the team to clear dishes, store leftovers safely, and reset the kitchen."
    ]
  },
  {
    "id": "pizza-c",
    "category": "pizza",
    "effort": "quick",
    "name": "Tortilla pizzas",
    "time": "15 min",
    "servings": "About 4 servings",
    "ingredients": [
      "4 large tortillas",
      "½ cup pizza sauce",
      "1 cup shredded mozzarella",
      "½ cup chopped cooked chicken",
      "½ cup olives",
      "1 bag baby carrots"
    ],
    "instructions": [
      "Adult: preheat oven to 425°F; put tortillas on baking sheets.",
      "Helpers spread sauce and top with cheese, fully cooked chicken and olives.",
      "Adult: bake 7–10 minutes until cheese melts and tortilla is crisp. Captain sets out carrots.",
      "Dinner Captain: check everyone has a plate, then ask the team to clear dishes, store leftovers safely, and reset the kitchen."
    ]
  },
  {
    "id": "pizza-d",
    "category": "pizza",
    "effort": "minimal",
    "name": "Frozen pizza & salad",
    "time": "15–25 min",
    "servings": "About 4 servings",
    "ingredients": [
      "2 frozen pizzas (about 12 in each)",
      "1 bag prewashed salad greens",
      "¼ cup bottled dressing",
      "1 bag baby carrots",
      "1 pint cherry tomatoes",
      "4 cups water for drinks"
    ],
    "instructions": [
      "Adult: heat and cook frozen pizzas exactly according to package instructions, checking they're thoroughly heated.",
      "Helpers toss bagged greens with dressing and rinse tomatoes and carrots.",
      "Captain: serve pizza and salad, then direct cleanup.",
      "Dinner Captain: check everyone has a plate, then ask the team to clear dishes, store leftovers safely, and reset the kitchen."
    ]
  },
  {
    "id": "breakfast-a",
    "category": "breakfast",
    "effort": "full",
    "name": "Pancakes, eggs & fruit",
    "time": "30–35 min",
    "servings": "About 4 servings",
    "ingredients": [
      "2 cups pancake mix",
      "water per package",
      "8 eggs",
      "1 tbsp butter",
      "2 cups berries",
      "½ cup maple syrup"
    ],
    "instructions": [
      "Adult: make pancake batter with water according to package; cook pancakes on a lightly buttered griddle according to directions.",
      "Adult: scramble eggs in a separate skillet until fully set, with no runny liquid.",
      "Helpers rinse berries and set out syrup. Captain calls everyone to the table.",
      "Dinner Captain: check everyone has a plate, then ask the team to clear dishes, store leftovers safely, and reset the kitchen."
    ]
  },
  {
    "id": "breakfast-b",
    "category": "breakfast",
    "effort": "quick",
    "name": "Egg & cheese sandwiches",
    "time": "15–20 min",
    "servings": "About 4 servings",
    "ingredients": [
      "8 large eggs",
      "4 English muffins",
      "4 cheese slices",
      "1 tbsp butter",
      "2 cups ready-to-eat fruit",
      "1 pint yogurt"
    ],
    "instructions": [
      "Adult: cook eggs in a buttered skillet over medium-low heat until fully set.",
      "Adult: toast split muffins and put eggs and cheese between halves.",
      "Helpers divide fruit and yogurt. Captain serves the sandwiches.",
      "Dinner Captain: check everyone has a plate, then ask the team to clear dishes, store leftovers safely, and reset the kitchen."
    ]
  },
  {
    "id": "breakfast-c",
    "category": "breakfast",
    "effort": "quick",
    "name": "Bean & egg breakfast burritos",
    "time": "15–20 min",
    "servings": "About 4 servings",
    "ingredients": [
      "6 eggs",
      "1 can (15 oz) black beans",
      "4 large tortillas",
      "½ cup shredded cheese",
      "½ cup salsa",
      "1 tbsp oil"
    ],
    "instructions": [
      "Adult: scramble eggs in an oiled skillet until fully set. Rinse beans and warm separately until hot.",
      "Helpers put cheese and salsa in bowls; adult warms tortillas.",
      "Captain: portion eggs and beans onto tortillas; add toppings and roll.",
      "Dinner Captain: check everyone has a plate, then ask the team to clear dishes, store leftovers safely, and reset the kitchen."
    ]
  },
  {
    "id": "breakfast-d",
    "category": "breakfast",
    "effort": "minimal",
    "name": "Yogurt & toast breakfast board",
    "time": "5–10 min",
    "servings": "About 4 servings",
    "ingredients": [
      "4 cups plain or vanilla yogurt",
      "2 cups washed berries",
      "1 cup granola",
      "8 slices whole-grain bread",
      "½ cup peanut or seed butter",
      "1 pint milk"
    ],
    "instructions": [
      "Adult: toast bread if desired; check nut allergies before using peanut butter.",
      "Helpers set out yogurt, washed berries and granola; spread nut or seed butter as appropriate.",
      "Captain: put everything on the table for a build-your-own dinner and lead cleanup.",
      "Dinner Captain: check everyone has a plate, then ask the team to clear dishes, store leftovers safely, and reset the kitchen."
    ]
  },
  {
    "id": "sheetpan-a",
    "category": "sheetpan",
    "effort": "full",
    "name": "Sheet-pan chicken & vegetables",
    "time": "40–45 min",
    "servings": "About 4 servings",
    "ingredients": [
      "1½ lb boneless chicken thighs",
      "1 lb baby potatoes",
      "2 bell peppers",
      "2 cups broccoli florets",
      "2 tbsp olive oil",
      "1 tsp garlic powder"
    ],
    "instructions": [
      "Adult: heat oven to 425°F. Halve potatoes and slice peppers, then toss vegetables with oil and garlic powder.",
      "Spread vegetables on a pan; arrange chicken on a separate pan to avoid crowding. Roast, turning vegetables once.",
      "Adult: cook chicken to 165°F and potatoes until tender (about 25–35 min). Captain serves.",
      "Dinner Captain: check everyone has a plate, then ask the team to clear dishes, store leftovers safely, and reset the kitchen."
    ]
  },
  {
    "id": "sheetpan-b",
    "category": "sheetpan",
    "effort": "quick",
    "name": "Sausage, peppers & potatoes",
    "time": "20–25 min",
    "servings": "About 4 servings",
    "ingredients": [
      "12 oz fully cooked chicken sausage",
      "1 lb microwave-ready potatoes",
      "2 bell peppers",
      "1 tbsp olive oil",
      "1 tsp Italian seasoning",
      "1 bag salad greens"
    ],
    "instructions": [
      "Adult: microwave potatoes per package until nearly tender; preheat oven to 450°F.",
      "Adult: slice fully cooked sausage and peppers, toss with potatoes, oil and seasoning.",
      "Adult: roast 10–15 min until hot. Captain serves with salad greens.",
      "Dinner Captain: check everyone has a plate, then ask the team to clear dishes, store leftovers safely, and reset the kitchen."
    ]
  },
  {
    "id": "sheetpan-c",
    "category": "sheetpan",
    "effort": "quick",
    "name": "Salmon & green beans",
    "time": "20–25 min",
    "servings": "About 4 servings",
    "ingredients": [
      "4 salmon fillets (about 5 oz each)",
      "12 oz trimmed green beans",
      "1 tbsp olive oil",
      "1 lemon",
      "1 tsp garlic powder",
      "2 pouches microwave rice"
    ],
    "instructions": [
      "Adult: heat oven to 425°F. Place salmon and green beans on a lined pan; toss with oil and garlic powder.",
      "Adult: bake about 12–15 min until salmon reaches 145°F. Heat rice per pouch instructions.",
      "Captain serves fish, beans and rice with lemon wedges.",
      "Dinner Captain: check everyone has a plate, then ask the team to clear dishes, store leftovers safely, and reset the kitchen."
    ]
  },
  {
    "id": "sheetpan-d",
    "category": "sheetpan",
    "effort": "minimal",
    "name": "Frozen sheet-pan shortcuts",
    "time": "15–25 min",
    "servings": "About 4 servings",
    "ingredients": [
      "1 bag frozen fully cooked chicken strips",
      "1 bag frozen roasted vegetables",
      "2 microwave rice pouches",
      "1 tbsp olive oil",
      "1 tsp seasoning blend",
      "½ cup bottled sauce"
    ],
    "instructions": [
      "Adult: prepare frozen chicken and vegetables strictly according to package instructions until piping hot (165°F for reheated chicken).",
      "Heat microwave rice per package; helpers portion bottled sauce and set bowls.",
      "Captain: combine chicken, vegetables and rice into bowls and handle cleanup.",
      "Dinner Captain: check everyone has a plate, then ask the team to clear dishes, store leftovers safely, and reset the kitchen."
    ]
  },
  {
    "id": "soup-a",
    "category": "soup",
    "effort": "full",
    "name": "Chicken noodle soup",
    "time": "35–40 min",
    "servings": "About 4 servings",
    "ingredients": [
      "2 cups fully cooked shredded chicken",
      "6 cups low-sodium broth",
      "2 carrots",
      "2 celery stalks",
      "2 cups dry egg noodles",
      "1 tsp dried thyme"
    ],
    "instructions": [
      "Adult: dice carrots and celery; simmer in broth with thyme 12–15 minutes until tender.",
      "Add noodles and cook per package until tender. Stir in fully cooked chicken and heat until steaming (165°F for leftovers).",
      "Captain serves soup once cooled to a safe eating temperature.",
      "Dinner Captain: check everyone has a plate, then ask the team to clear dishes, store leftovers safely, and reset the kitchen."
    ]
  },
  {
    "id": "soup-b",
    "category": "soup",
    "effort": "quick",
    "name": "Tomato soup & grilled cheese",
    "time": "15–20 min",
    "servings": "About 4 servings",
    "ingredients": [
      "2 cans (10.75 oz) tomato soup",
      "milk or water per label",
      "8 slices bread",
      "8 cheddar slices",
      "2 tbsp butter",
      "1 bag baby carrots"
    ],
    "instructions": [
      "Adult: cook soup with milk or water per label until hot.",
      "Adult: butter bread and grill cheese sandwiches over medium heat until browned on both sides and cheese melts.",
      "Helpers wash and serve carrots. Captain sets out soup and sandwiches.",
      "Dinner Captain: check everyone has a plate, then ask the team to clear dishes, store leftovers safely, and reset the kitchen."
    ]
  },
  {
    "id": "soup-c",
    "category": "soup",
    "effort": "quick",
    "name": "Black bean chili",
    "time": "15–20 min",
    "servings": "About 4 servings",
    "ingredients": [
      "2 cans (15 oz) black beans",
      "1 can (28 oz) crushed tomatoes",
      "1 cup frozen corn",
      "2 tsp chili powder",
      "1 tsp cumin",
      "1 cup shredded cheese"
    ],
    "instructions": [
      "Adult: drain beans; put beans, tomatoes, corn and spices in a saucepan.",
      "Bring to a simmer, stirring, for 10–12 minutes until hot throughout.",
      "Captain sets out cheese and invites everyone to serve chili.",
      "Dinner Captain: check everyone has a plate, then ask the team to clear dishes, store leftovers safely, and reset the kitchen."
    ]
  },
  {
    "id": "soup-d",
    "category": "soup",
    "effort": "minimal",
    "name": "Canned soup & toast",
    "time": "5–10 min",
    "servings": "About 4 servings",
    "ingredients": [
      "4 cans (about 15 oz each) favorite soup",
      "8 slices bread",
      "1 cup shredded cheese",
      "1 bag prewashed salad",
      "¼ cup dressing",
      "1 bag baby carrots"
    ],
    "instructions": [
      "Adult: heat soups according to label until hot; use different flavors as needed for preferences.",
      "Adult: toast bread; helpers prepare salad with dressing and portion carrots.",
      "Captain: set out bowls, soup, toast and toppings; organize cleanup.",
      "Dinner Captain: check everyone has a plate, then ask the team to clear dishes, store leftovers safely, and reset the kitchen."
    ]
  },
  {
    "id": "quesadillas-a",
    "category": "quesadillas",
    "effort": "full",
    "name": "Chicken & pepper quesadillas",
    "time": "25–30 min",
    "servings": "About 4 servings",
    "ingredients": [
      "8 medium tortillas",
      "2 cups cooked shredded chicken",
      "2 bell peppers",
      "2 cups shredded cheddar",
      "½ cup salsa",
      "1 tbsp oil"
    ],
    "instructions": [
      "Adult: dice peppers and sauté in a little oil until tender; reheat cooked chicken thoroughly to 165°F.",
      "Helpers sprinkle cheese, chicken and cooked peppers onto half of each tortilla; fold closed.",
      "Adult: cook quesadillas in a skillet over medium heat until golden and cheese melts. Captain serves salsa.",
      "Dinner Captain: check everyone has a plate, then ask the team to clear dishes, store leftovers safely, and reset the kitchen."
    ]
  },
  {
    "id": "quesadillas-b",
    "category": "quesadillas",
    "effort": "quick",
    "name": "Bean & cheese quesadillas",
    "time": "15 min",
    "servings": "About 4 servings",
    "ingredients": [
      "8 medium tortillas",
      "1 can (15 oz) black beans",
      "2 cups shredded cheddar",
      "½ cup salsa",
      "1 tbsp oil",
      "1 bag prewashed lettuce"
    ],
    "instructions": [
      "Adult: drain and rinse beans. Helpers spread beans and cheese on half of each tortilla, then fold.",
      "Adult: cook in a lightly oiled skillet until tortillas are golden and filling is hot.",
      "Captain: serve quesadillas with salsa and lettuce.",
      "Dinner Captain: check everyone has a plate, then ask the team to clear dishes, store leftovers safely, and reset the kitchen."
    ]
  },
  {
    "id": "quesadillas-c",
    "category": "quesadillas",
    "effort": "quick",
    "name": "Spinach quesadillas",
    "time": "15 min",
    "servings": "About 4 servings",
    "ingredients": [
      "8 medium tortillas",
      "2 cups shredded mozzarella",
      "2 cups prewashed spinach",
      "½ cup jarred salsa",
      "1 can (15 oz) black beans",
      "1 tbsp oil"
    ],
    "instructions": [
      "Adult: drain and rinse beans. Helpers place spinach, beans and cheese on tortillas, then fold.",
      "Adult: cook in a lightly oiled skillet over medium heat until cheese melts and filling is hot.",
      "Captain: divide quesadillas and serve with salsa.",
      "Dinner Captain: check everyone has a plate, then ask the team to clear dishes, store leftovers safely, and reset the kitchen."
    ]
  },
  {
    "id": "quesadillas-d",
    "category": "quesadillas",
    "effort": "minimal",
    "name": "Microwave bean & cheese wraps",
    "time": "5–10 min",
    "servings": "About 4 servings",
    "ingredients": [
      "4 large tortillas",
      "1 can (15 oz) refried beans",
      "1 cup shredded cheese",
      "½ cup salsa",
      "1 bag shredded lettuce",
      "1 cup plain yogurt"
    ],
    "instructions": [
      "Adult: heat refried beans according to can directions; warm tortillas per package.",
      "Helpers spread warm beans and cheese onto tortillas; add salsa and bagged lettuce.",
      "Captain: roll wraps, portion yogurt and lead cleanup.",
      "Dinner Captain: check everyone has a plate, then ask the team to clear dishes, store leftovers safely, and reset the kitchen."
    ]
  },
  {
    "id": "burgers-a",
    "category": "burgers",
    "effort": "full",
    "name": "Homemade beef burgers",
    "time": "30–35 min",
    "servings": "About 4 servings",
    "ingredients": [
      "1 lb ground beef",
      "4 burger buns",
      "4 cheese slices",
      "1 tomato",
      "1 bag prewashed lettuce",
      "1 bag frozen oven fries"
    ],
    "instructions": [
      "Adult: shape beef into four patties, wash hands and cook in skillet until 160°F in the center.",
      "Adult: bake fries per package; slice tomato and wash lettuce.",
      "Helpers assemble buns with toppings; captain serves with fries.",
      "Dinner Captain: check everyone has a plate, then ask the team to clear dishes, store leftovers safely, and reset the kitchen."
    ]
  },
  {
    "id": "burgers-b",
    "category": "burgers",
    "effort": "quick",
    "name": "Turkey burgers",
    "time": "20–25 min",
    "servings": "About 4 servings",
    "ingredients": [
      "1 lb ground turkey",
      "4 burger buns",
      "4 cheese slices",
      "1 bag prewashed lettuce",
      "½ cup ketchup",
      "1 tbsp oil"
    ],
    "instructions": [
      "Adult: shape turkey into four patties; cook in an oiled skillet to 165°F throughout.",
      "Adult: toast buns if desired; helpers put washed lettuce, cheese and ketchup on the table.",
      "Captain: assemble burgers and serve.",
      "Dinner Captain: check everyone has a plate, then ask the team to clear dishes, store leftovers safely, and reset the kitchen."
    ]
  },
  {
    "id": "burgers-c",
    "category": "burgers",
    "effort": "quick",
    "name": "Black bean burgers",
    "time": "15–20 min",
    "servings": "About 4 servings",
    "ingredients": [
      "4 frozen black bean patties",
      "4 burger buns",
      "4 cheese slices",
      "1 bag prewashed lettuce",
      "1 tomato",
      "½ cup ketchup"
    ],
    "instructions": [
      "Adult: cook frozen bean patties according to package until thoroughly heated.",
      "Adult: slice tomato and toast buns if desired; helpers set out cheese and lettuce.",
      "Captain: set out cooked patties and toppings for everyone to assemble.",
      "Dinner Captain: check everyone has a plate, then ask the team to clear dishes, store leftovers safely, and reset the kitchen."
    ]
  },
  {
    "id": "burgers-d",
    "category": "burgers",
    "effort": "minimal",
    "name": "Frozen burgers & veggie sticks",
    "time": "15–25 min",
    "servings": "About 4 servings",
    "ingredients": [
      "4 fully cooked frozen burger patties",
      "4 burger buns",
      "4 cheese slices",
      "1 bag baby carrots",
      "1 bag snap peas",
      "½ cup ketchup"
    ],
    "instructions": [
      "Adult: reheat fully cooked frozen burgers strictly per package instructions until thoroughly hot.",
      "Helpers wash carrots and snap peas and put out buns, cheese and ketchup.",
      "Captain: assemble burgers with helpers and lead cleanup.",
      "Dinner Captain: check everyone has a plate, then ask the team to clear dishes, store leftovers safely, and reset the kitchen."
    ]
  },
  {
    "id": "potatoes-a",
    "category": "potatoes",
    "effort": "full",
    "name": "Chili-stuffed baked potatoes",
    "time": "45–55 min",
    "servings": "About 4 servings",
    "ingredients": [
      "4 large baking potatoes",
      "1 can (15 oz) kidney beans",
      "1 can (15 oz) diced tomatoes",
      "1 cup frozen corn",
      "1 tsp chili powder",
      "1 cup shredded cheese"
    ],
    "instructions": [
      "Adult: scrub and pierce potatoes; bake at 425°F for about 45–55 minutes until tender.",
      "Adult: heat drained beans, tomatoes, corn and chili powder in a pan until hot.",
      "Captain: split potatoes safely with adult help, spoon chili on top and add cheese.",
      "Dinner Captain: check everyone has a plate, then ask the team to clear dishes, store leftovers safely, and reset the kitchen."
    ]
  },
  {
    "id": "potatoes-b",
    "category": "potatoes",
    "effort": "quick",
    "name": "Broccoli & cheese potatoes",
    "time": "15–20 min",
    "servings": "About 4 servings",
    "ingredients": [
      "4 medium baking potatoes",
      "2 cups frozen broccoli",
      "1 cup shredded cheddar",
      "½ cup plain yogurt",
      "1 tbsp butter",
      "½ tsp garlic powder"
    ],
    "instructions": [
      "Adult: scrub and pierce potatoes, then microwave following appliance guidance, turning until fork-tender.",
      "Heat broccoli according to package. Adult carefully split hot potatoes and add butter.",
      "Captain: top potatoes with broccoli, cheese, yogurt and garlic powder.",
      "Dinner Captain: check everyone has a plate, then ask the team to clear dishes, store leftovers safely, and reset the kitchen."
    ]
  },
  {
    "id": "potatoes-c",
    "category": "potatoes",
    "effort": "quick",
    "name": "BBQ chicken potatoes",
    "time": "15–20 min",
    "servings": "About 4 servings",
    "ingredients": [
      "4 medium baking potatoes",
      "2 cups fully cooked shredded chicken",
      "½ cup bottled BBQ sauce",
      "1 cup shredded cheese",
      "1 bag prewashed coleslaw",
      "¼ cup dressing"
    ],
    "instructions": [
      "Adult: scrub, pierce and microwave potatoes until tender; reheat cooked chicken to 165°F.",
      "Stir BBQ sauce into hot chicken. Helpers toss coleslaw with dressing.",
      "Captain: split potatoes with adult help, add BBQ chicken and cheese, and serve slaw.",
      "Dinner Captain: check everyone has a plate, then ask the team to clear dishes, store leftovers safely, and reset the kitchen."
    ]
  },
  {
    "id": "potatoes-d",
    "category": "potatoes",
    "effort": "minimal",
    "name": "Microwave bean potatoes",
    "time": "10–15 min",
    "servings": "About 4 servings",
    "ingredients": [
      "4 microwave-ready potatoes",
      "1 can (15 oz) black beans",
      "1 cup shredded cheddar",
      "½ cup jarred salsa",
      "½ cup plain yogurt",
      "1 bag baby carrots"
    ],
    "instructions": [
      "Adult: heat potatoes according to their package until fork-tender; heat rinsed beans until hot.",
      "Helpers put cheese, salsa, yogurt and washed carrots on the table.",
      "Captain: invite everyone to top their own potato with beans and toppings.",
      "Dinner Captain: check everyone has a plate, then ask the team to clear dishes, store leftovers safely, and reset the kitchen."
    ]
  },
  {
    "id": "onepot-a",
    "category": "onepot",
    "effort": "full",
    "name": "Chicken & vegetable skillet rice",
    "time": "30–35 min",
    "servings": "About 4 servings",
    "ingredients": [
      "1 lb boneless chicken breast",
      "1 cup dry quick-cooking rice",
      "2 cups chicken broth",
      "2 cups frozen mixed vegetables",
      "1 tbsp oil",
      "1 tsp Italian seasoning"
    ],
    "instructions": [
      "Adult: dice chicken; cook in oiled large skillet until 165°F throughout, then set aside.",
      "Cook quick-cooking rice with broth according to package, adding vegetables near end until hot.",
      "Return chicken to skillet, heat through, and serve. Captain coordinates the table and cleanup.",
      "Dinner Captain: check everyone has a plate, then ask the team to clear dishes, store leftovers safely, and reset the kitchen."
    ]
  },
  {
    "id": "onepot-b",
    "category": "onepot",
    "effort": "quick",
    "name": "Taco skillet pasta",
    "time": "20 min",
    "servings": "About 4 servings",
    "ingredients": [
      "12 oz quick-cooking pasta",
      "1 can (15 oz) black beans",
      "1 jar (24 oz) salsa",
      "1 cup frozen corn",
      "1 cup shredded cheddar",
      "1 tsp cumin"
    ],
    "instructions": [
      "Adult: cook pasta according to package and drain.",
      "In the same pot, warm rinsed beans, salsa, corn and cumin until hot.",
      "Return pasta and mix; top with cheddar. Captain serves.",
      "Dinner Captain: check everyone has a plate, then ask the team to clear dishes, store leftovers safely, and reset the kitchen."
    ]
  },
  {
    "id": "onepot-c",
    "category": "onepot",
    "effort": "quick",
    "name": "Egg & vegetable noodle skillet",
    "time": "15–20 min",
    "servings": "About 4 servings",
    "ingredients": [
      "8 oz quick-cooking noodles",
      "4 eggs",
      "2 cups frozen mixed vegetables",
      "2 tbsp soy sauce",
      "1 tbsp oil",
      "½ tsp garlic powder"
    ],
    "instructions": [
      "Adult: cook noodles according to package and drain.",
      "Cook mixed vegetables as directed; scramble eggs in a separate oiled skillet until fully set.",
      "Toss noodles, vegetables, cooked eggs, soy sauce and garlic powder in one pan until hot.",
      "Dinner Captain: check everyone has a plate, then ask the team to clear dishes, store leftovers safely, and reset the kitchen."
    ]
  },
  {
    "id": "onepot-d",
    "category": "onepot",
    "effort": "minimal",
    "name": "Pantry mac & peas",
    "time": "10–20 min",
    "servings": "About 4 servings",
    "ingredients": [
      "2 boxes boxed macaroni and cheese",
      "milk per box directions",
      "butter per box directions",
      "2 cups frozen peas",
      "1 can (15 oz) white beans",
      "1 bag baby carrots"
    ],
    "instructions": [
      "Adult: prepare boxed macaroni according to package; add peas during the final few minutes of cooking if directions allow.",
      "Adult: drain and rinse white beans; warm until hot and stir into prepared pasta.",
      "Captain: serve with washed baby carrots; coordinate cleanup.",
      "Dinner Captain: check everyone has a plate, then ask the team to clear dishes, store leftovers safely, and reset the kitchen."
    ]
  }
];
