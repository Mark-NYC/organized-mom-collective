/** One source for the Family Dinner System page, PDF and previews.
 * Aligns with /meal-planner's Full/Short/Zero nights and April Club's four roles.
 */
export const kinds=[
 ['calendar','FULL','Time to cook','A longer recipe on a night the family is home.'],
 ['clock','SHORT','About 20 minutes','A familiar quick meal, such as pasta or tacos.'],
 ['sandwich','ZERO','0–5 minutes','Leftovers, freezer food, sandwiches or another easy backup.']
];
export const planning=[
 ['calendar','Check the real week','Mark late practices and appointments first. Label each night Full, Short or Zero.'],
 ['pot','Choose four or five dinners','Repeat family favorites. Plan leftovers, flexible nights and an easy backup.'],
 ['grocery','Shop your kitchen first','Check fridge, freezer and pantry. List only what is missing, with quantities.'],
 ['clipboard','Give dinners an owner','Name the grown-up who owns each dinner from supplies through cleanup, not just cooking.'],
 ['table','Post the plan','Write meals and groceries on the family calendar or free Weekly Dinner Planner.']
];
export const mealCategories=[
 ['pot','Taco or rice-bowl night'],
 ['sandwich','Sandwich or soup night'],
 ['dish','Pasta night'],
 ['fork','Breakfast for dinner'],
 ['grocery','Sheet-pan or one-pot dinner'],
 ['clock','Leftovers or easy freezer night']
];
export const team=[
 ['clipboard','DINNER CAPTAIN','Adult','Owns the whole dinner: chooses, gathers helpers, adapts the plan and checks cleanup.'],
 ['grocery','INGREDIENTS CHECKER','Age 7+ with help','Checks the fridge and pantry and gathers safe ingredients.'],
 ['table','TABLE CAPTAIN','Age 3+ with help','Sets safe dishes and toppings, then helps clear the table.'],
 ['pot','COOKING LEAD','Adult','Handles heat, sharp tools and food-safety decisions; invites safe kid participation.']
];
export const issues=[
 ['clock','Practice ran late','Swap in a Short or Zero dinner. The owner updates the shared plan.'],
 ['grocery','An ingredient is missing','Use a known substitute or a pantry backup rather than restarting the meal plan.'],
 ['sandwich','Nobody has energy','A zero-effort dinner counts. Decide who gathers, serves and puts away food.'],
 ['table','Kids stop helping','Choose one safe, concrete job; show what done looks like and practice together.'],
 ['clipboard','Mom still carries every decision','Give another adult ownership of one entire meal, including supplies and follow-through.'],
 ['dish','Cleanup always falls to Mom','Dinner Captain assigns the after-meal reset; everyone clears their own place safely.']
];
export const familyPrompt="What's one part of dinner you could take responsibility for this week?";
