/**
 * Curated responsibility skills, seeded from public chore choices, age guides and
 * approved age-guide card illustration IDs. Published PDFs/cards are not modified.
 *
 * Canonical IDs are stable. Age bands are editorial starting guidance, never
 * automatic advancement, mandatory eligibility or a clinical milestone.
 *
 * Philosophy: docs/product/RESPONSIBILITY_DEVELOPMENT_FRAMEWORK.md
 * Resource crosswalk: docs/product/RESOURCE_ALIGNMENT.md
 */
import type { SeasonContext, SkillDefinition } from './framework';
import { choreChoices } from '../../data/chore-recommendations';

export const SKILLS_LIBRARY_VERSION = 1 as const;

export type SkillCategory =
  | 'self-care' | 'personal-space' | 'school-prep' | 'home-care'
  | 'meals' | 'laundry' | 'food-independence' | 'initiative'
  | 'routines' | 'caring' | 'family-team';

export interface CuratedSkill extends SkillDefinition {
  category: SkillCategory;
  /** A naturally satisfying outcome, never a mandatory external prize. */
  naturalPayoff: string;
  /** Coaching copy, not a four-box assignment checklist. */
  model: string;
  assist: string;
  watch: string;
  launch: string;
  safety?: string;
  /** ID validated against the approved age-guide illustration config only.
   * This is not a verified print card ID or printed card instruction text. */
  cardIllustrationId?: number;
}

/** The library is append-only by ID. All strings are authored, never generated from child records. */
export const skills = [
  {
    id: "toys", category: "personal-space", title: "Put toys away", outcome: "Toys go into their usual places after play.",
    typicalAge: { from: 2 }, finishLine: "Toys go into their usual places after play.",
    cueSuggestions: ["After playtime"], naturalPayoff: "The play space is ready to use again.",
    watchVariations: ["Put toys away when visiting another room."], seasons: ['everyday'],
    model: "Show how to put toys away and point out the finish line.",
    assist: "Do put toys away together, then let the child take over the steps.",
    watch: "Observe the child's initiation and quality; practice a variation: Put toys away when visiting another room.",
    launch: "The family decides when the child can initiate, complete, check and adapt this responsibility.",
    
    cardIllustrationId: 29,
  },
  {
    id: "hamper", category: "self-care", title: "Put dirty clothes in the hamper", outcome: "Worn clothes reach the laundry basket.",
    typicalAge: { from: 2 }, finishLine: "Worn clothes reach the laundry basket.",
    cueSuggestions: ["After changing clothes"], naturalPayoff: "Clothes are ready for laundry.",
    watchVariations: ["Use the right hamper away from home."], seasons: ['everyday'],
    model: "Show how to put dirty clothes in the hamper and point out the finish line.",
    assist: "Do put dirty clothes in the hamper together, then let the child take over the steps.",
    watch: "Observe the child's initiation and quality; practice a variation: Use the right hamper away from home.",
    launch: "The family decides when the child can initiate, complete, check and adapt this responsibility.",
    
    
  },
  {
    id: "bed-help", category: "self-care", title: "Make my bed together", outcome: "Straighten bedding with support.",
    typicalAge: { from: 4 }, finishLine: "Straighten bedding with support.",
    cueSuggestions: ["After getting up"], naturalPayoff: "The bed is ready for tonight.",
    watchVariations: ["Straighten bedding when the morning is busy."], seasons: ['everyday'],
    model: "Show how to make my bed together and point out the finish line.",
    assist: "Do make my bed together together, then let the child take over the steps.",
    watch: "Observe the child's initiation and quality; practice a variation: Straighten bedding when the morning is busy.",
    launch: "The family decides when the child can initiate, complete, check and adapt this responsibility.",
    
    cardIllustrationId: 28,
  },
  {
    id: "bed", category: "self-care", title: "Make my bed", outcome: "Straighten the bed without adult steps.",
    typicalAge: { from: 6 }, finishLine: "Straighten the bed without adult steps.",
    cueSuggestions: ["After getting dressed"], naturalPayoff: "The sleeping space feels ready.",
    watchVariations: ["Manage a different blanket or rushed morning."], seasons: ['everyday'],
    model: "Show how to make my bed and point out the finish line.",
    assist: "Do make my bed together, then let the child take over the steps.",
    watch: "Observe the child's initiation and quality; practice a variation: Manage a different blanket or rushed morning.",
    launch: "The family decides when the child can initiate, complete, check and adapt this responsibility.",
    
    cardIllustrationId: 28,
  },
  {
    id: "floor", category: "personal-space", title: "Tidy my bedroom floor", outcome: "Return things from the floor to their homes.",
    typicalAge: { from: 6 }, finishLine: "Return things from the floor to their homes.",
    cueSuggestions: ["Before bedtime"], naturalPayoff: "The floor is clear and safe.",
    watchVariations: ["Sort unexpected items on a busy day."], seasons: ['everyday'],
    model: "Show how to tidy my bedroom floor and point out the finish line.",
    assist: "Do tidy my bedroom floor together, then let the child take over the steps.",
    watch: "Observe the child's initiation and quality; practice a variation: Sort unexpected items on a busy day.",
    launch: "The family decides when the child can initiate, complete, check and adapt this responsibility.",
    
    cardIllustrationId: 32,
  },
  {
    id: "room", category: "personal-space", title: "Reset my bedroom", outcome: "Notice and finish the room's agreed reset.",
    typicalAge: { from: 11 }, finishLine: "Notice and finish the room's agreed reset.",
    cueSuggestions: ["Before weekend time"], naturalPayoff: "The room is ready for the week.",
    watchVariations: ["Handle extra clutter after guests."], seasons: ['everyday'],
    model: "Show how to reset my bedroom and point out the finish line.",
    assist: "Do reset my bedroom together, then let the child take over the steps.",
    watch: "Observe the child's initiation and quality; practice a variation: Handle extra clutter after guests.",
    launch: "The family decides when the child can initiate, complete, check and adapt this responsibility.",
    
    
  },
  {
    id: "table", category: "meals", title: "Set the table", outcome: "Place agreed safe dishes and utensils for the meal.",
    typicalAge: { from: 4 }, finishLine: "Place agreed safe dishes and utensils for the meal.",
    cueSuggestions: ["When meal preparation begins"], naturalPayoff: "Everyone has a place ready to eat.",
    watchVariations: ["Set places for a different number of people."], seasons: ['everyday'],
    model: "Show how to set the table and point out the finish line.",
    assist: "Do set the table together, then let the child take over the steps.",
    watch: "Observe the child's initiation and quality; practice a variation: Set places for a different number of people.",
    launch: "The family decides when the child can initiate, complete, check and adapt this responsibility.",
    
    cardIllustrationId: 33,
  },
  {
    id: "dishes", category: "meals", title: "Clear my dishes", outcome: "Take own safe dishes to the agreed location.",
    typicalAge: { from: 4 }, finishLine: "Take own safe dishes to the agreed location.",
    cueSuggestions: ["After eating"], naturalPayoff: "The table is ready for the next meal.",
    watchVariations: ["Clear dishes when eating somewhere else."], seasons: ['everyday'],
    model: "Show how to clear my dishes and point out the finish line.",
    assist: "Do clear my dishes together, then let the child take over the steps.",
    watch: "Observe the child's initiation and quality; practice a variation: Clear dishes when eating somewhere else.",
    launch: "The family decides when the child can initiate, complete, check and adapt this responsibility.",
    
    cardIllustrationId: 34,
  },
  {
    id: "counters", category: "meals", title: "Wipe kitchen counters", outcome: "Wipe an approved surface with safe materials.",
    typicalAge: { from: 7 }, finishLine: "Wipe an approved surface with safe materials.",
    cueSuggestions: ["After meal cleanup"], naturalPayoff: "The surface is visibly clean.",
    watchVariations: ["Handle crumbs around a different counter setup."], seasons: ['everyday'],
    model: "Show how to wipe kitchen counters and point out the finish line.",
    assist: "Do wipe kitchen counters together, then let the child take over the steps.",
    watch: "Observe the child's initiation and quality; practice a variation: Handle crumbs around a different counter setup.",
    launch: "The family decides when the child can initiate, complete, check and adapt this responsibility.",
    safety: "Adult approves safe materials and surface; avoid chemicals and hot items.", requiresAdultSupervision: true,
    cardIllustrationId: 36,
  },
  {
    id: "dishwasher", category: "meals", title: "Unload safe dishwasher items", outcome: "Put approved unbreakable items in their places.",
    typicalAge: { from: 8 }, finishLine: "Put approved unbreakable items in their places.",
    cueSuggestions: ["After dishwasher finishes"], naturalPayoff: "The approved dishes are put away.",
    watchVariations: ["Unload when the usual shelves are reorganized."], seasons: ['everyday'],
    model: "Show how to unload safe dishwasher items and point out the finish line.",
    assist: "Do unload safe dishwasher items together, then let the child take over the steps.",
    watch: "Observe the child's initiation and quality; practice a variation: Unload when the usual shelves are reorganized.",
    launch: "The family decides when the child can initiate, complete, check and adapt this responsibility.",
    safety: "Adult removes sharp or breakable items and checks heat first.", requiresAdultSupervision: true,
    
  },
  {
    id: "kitchen", category: "home-care", title: "Own the kitchen reset after dinner", outcome: "Coordinate and finish agreed safe kitchen tasks.",
    typicalAge: { from: 14 }, finishLine: "Coordinate and finish agreed safe kitchen tasks.",
    cueSuggestions: ["After dinner"], naturalPayoff: "The agreed kitchen reset is complete.",
    watchVariations: ["Handle a meal with unusual cleanup needs."], seasons: ['everyday'],
    model: "Show how to own the kitchen reset after dinner and point out the finish line.",
    assist: "Do own the kitchen reset after dinner together, then let the child take over the steps.",
    watch: "Observe the child's initiation and quality; practice a variation: Handle a meal with unusual cleanup needs.",
    launch: "The family decides when the child can initiate, complete, check and adapt this responsibility.",
    safety: "Adult retains responsibility for dangerous equipment and chemicals.", requiresAdultSupervision: true,
    
  },
  {
    id: "pet", category: "caring", title: "Feed pets with adult checks", outcome: "Provide adult-approved food and water safely.",
    typicalAge: { from: 5 }, finishLine: "Provide adult-approved food and water safely.",
    cueSuggestions: ["At pet feeding time"], naturalPayoff: "The pet has the approved portion.",
    watchVariations: ["Adapt when the family is away from home."], seasons: ['everyday'],
    model: "Show how to feed pets with adult checks and point out the finish line.",
    assist: "Do feed pets with adult checks together, then let the child take over the steps.",
    watch: "Observe the child's initiation and quality; practice a variation: Adapt when the family is away from home.",
    launch: "The family decides when the child can initiate, complete, check and adapt this responsibility.",
    safety: "Adult approves portions and supervises animal safety.", requiresAdultSupervision: true,
    cardIllustrationId: 41,
  },
  {
    id: "pet-care", category: "caring", title: "Care for a pet responsibly", outcome: "Follow a pet's agreed daily care plan with adult oversight.",
    typicalAge: { from: 12 }, finishLine: "Follow a pet's agreed daily care plan with adult oversight.",
    cueSuggestions: ["After the family's pet-care cue"], naturalPayoff: "The approved care plan is completed.",
    watchVariations: ["Respond appropriately when normal pet routine changes."], seasons: ['everyday'],
    model: "Show how to care for a pet responsibly and point out the finish line.",
    assist: "Do care for a pet responsibly together, then let the child take over the steps.",
    watch: "Observe the child's initiation and quality; practice a variation: Respond appropriately when normal pet routine changes.",
    launch: "The family decides when the child can initiate, complete, check and adapt this responsibility.",
    safety: "Adult is accountable for animal welfare and all unsafe handling.", requiresAdultSupervision: true,
    
  },
  {
    id: "shared", category: "home-care", title: "Put away shared-space items", outcome: "Return shared items to their normal homes.",
    typicalAge: { from: 5 }, finishLine: "Return shared items to their normal homes.",
    cueSuggestions: ["Before the family evening reset"], naturalPayoff: "The shared space is clear.",
    watchVariations: ["Handle a room with unfamiliar guest items."], seasons: ['everyday'],
    model: "Show how to put away shared-space items and point out the finish line.",
    assist: "Do put away shared-space items together, then let the child take over the steps.",
    watch: "Observe the child's initiation and quality; practice a variation: Handle a room with unfamiliar guest items.",
    launch: "The family decides when the child can initiate, complete, check and adapt this responsibility.",
    
    cardIllustrationId: 38,
  },
  {
    id: "sort", category: "laundry", title: "Sort clean laundry", outcome: "Group clean clothes with help as appropriate.",
    typicalAge: { from: 3 }, finishLine: "Group clean clothes with help as appropriate.",
    cueSuggestions: ["When laundry is folded"], naturalPayoff: "The sorted clothes are ready to put away.",
    watchVariations: ["Sort a new clothing type with guidance."], seasons: ['everyday'],
    model: "Show how to sort clean laundry and point out the finish line.",
    assist: "Do sort clean laundry together, then let the child take over the steps.",
    watch: "Observe the child's initiation and quality; practice a variation: Sort a new clothing type with guidance.",
    launch: "The family decides when the child can initiate, complete, check and adapt this responsibility.",
    safety: "Adult checks for hazards and supervises as needed.", requiresAdultSupervision: true,
    
  },
  {
    id: "fold", category: "laundry", title: "Fold and put away my clothes", outcome: "Fold and return own clean clothes to their storage.",
    typicalAge: { from: 7 }, finishLine: "Fold and return own clean clothes to their storage.",
    cueSuggestions: ["When the clean basket arrives"], naturalPayoff: "Clothes are stored where they belong.",
    watchVariations: ["Manage a larger basket or a different clothing type."], seasons: ['everyday'],
    model: "Show how to fold and put away my clothes and point out the finish line.",
    assist: "Do fold and put away my clothes together, then let the child take over the steps.",
    watch: "Observe the child's initiation and quality; practice a variation: Manage a larger basket or a different clothing type.",
    launch: "The family decides when the child can initiate, complete, check and adapt this responsibility.",
    
    cardIllustrationId: 30,
  },
  {
    id: "load", category: "laundry", title: "Do a laundry load with supervision", outcome: "Use agreed machine steps with adult instruction.",
    typicalAge: { from: 11 }, finishLine: "Use agreed machine steps with adult instruction.",
    cueSuggestions: ["On the agreed laundry day"], naturalPayoff: "Clothes are washed according to the safe plan.",
    watchVariations: ["Choose settings for different fabrics with adult check."], seasons: ['everyday'],
    model: "Show how to do a laundry load with supervision and point out the finish line.",
    assist: "Do do a laundry load with supervision together, then let the child take over the steps.",
    watch: "Observe the child's initiation and quality; practice a variation: Choose settings for different fabrics with adult check.",
    launch: "The family decides when the child can initiate, complete, check and adapt this responsibility.",
    safety: "Adult trains and supervises machine use and chemicals; never assume independent access.", requiresAdultSupervision: true,
    cardIllustrationId: 35,
  },
  {
    id: "own-laundry", category: "laundry", title: "Manage my laundry start to finish", outcome: "Plan, wash, dry, fold and store own laundry safely.",
    typicalAge: { from: 14 }, finishLine: "Plan, wash, dry, fold and store own laundry safely.",
    cueSuggestions: ["On the agreed laundry day"], naturalPayoff: "Clean clothes are stored and supplies are safe.",
    watchVariations: ["Adjust the laundry plan when the schedule changes."], seasons: ['everyday'],
    model: "Show how to manage my laundry start to finish and point out the finish line.",
    assist: "Do manage my laundry start to finish together, then let the child take over the steps.",
    watch: "Observe the child's initiation and quality; practice a variation: Adjust the laundry plan when the schedule changes.",
    launch: "The family decides when the child can initiate, complete, check and adapt this responsibility.",
    safety: "Household adult confirms appliance, detergent and fabric safety before independent use.", requiresAdultSupervision: true,
    cardIllustrationId: 35,
  },
  {
    id: "dust", category: "home-care", title: "Dust bedroom furniture", outcome: "Dust approved low, stable surfaces with safe tools.",
    typicalAge: { from: 6 }, finishLine: "Dust approved low, stable surfaces with safe tools.",
    cueSuggestions: ["On room reset day"], naturalPayoff: "Approved surfaces are dust-free.",
    watchVariations: ["Notice a newly cluttered surface and clean safely."], seasons: ['everyday'],
    model: "Show how to dust bedroom furniture and point out the finish line.",
    assist: "Do dust bedroom furniture together, then let the child take over the steps.",
    watch: "Observe the child's initiation and quality; practice a variation: Notice a newly cluttered surface and clean safely.",
    launch: "The family decides when the child can initiate, complete, check and adapt this responsibility.",
    safety: "Avoid unstable furniture and unsafe cleaning products.", requiresAdultSupervision: true,
    
  },
  {
    id: "vacuum", category: "home-care", title: "Vacuum my bedroom", outcome: "Use the vacuum safely on an approved floor.",
    typicalAge: { from: 8 }, finishLine: "Use the vacuum safely on an approved floor.",
    cueSuggestions: ["On room reset day"], naturalPayoff: "The agreed floor areas are clean.",
    watchVariations: ["Navigate a furniture rearrangement safely."], seasons: ['everyday'],
    model: "Show how to vacuum my bedroom and point out the finish line.",
    assist: "Do vacuum my bedroom together, then let the child take over the steps.",
    watch: "Observe the child's initiation and quality; practice a variation: Navigate a furniture rearrangement safely.",
    launch: "The family decides when the child can initiate, complete, check and adapt this responsibility.",
    safety: "Adult checks appliance handling and cords.", requiresAdultSupervision: true,
    
  },
  {
    id: "trash-small", category: "home-care", title: "Empty small trash bins", outcome: "Empty approved bins without touching unsafe waste.",
    typicalAge: { from: 6 }, finishLine: "Empty approved bins without touching unsafe waste.",
    cueSuggestions: ["Before household trash collection"], naturalPayoff: "The agreed bins are empty and relined.",
    watchVariations: ["Notice a full bin on a different day."], seasons: ['everyday'],
    model: "Show how to empty small trash bins and point out the finish line.",
    assist: "Do empty small trash bins together, then let the child take over the steps.",
    watch: "Observe the child's initiation and quality; practice a variation: Notice a full bin on a different day.",
    launch: "The family decides when the child can initiate, complete, check and adapt this responsibility.",
    safety: "Adult handles sharp, medical, chemical or heavy waste.", requiresAdultSupervision: true,
    
  },
  {
    id: "trash", category: "home-care", title: "Take out household trash", outcome: "Collect and move approved household trash safely.",
    typicalAge: { from: 10 }, finishLine: "Collect and move approved household trash safely.",
    cueSuggestions: ["Before collection day"], naturalPayoff: "The agreed bags are in the collection area.",
    watchVariations: ["Handle a changed collection schedule."], seasons: ['everyday'],
    model: "Show how to take out household trash and point out the finish line.",
    assist: "Do take out household trash together, then let the child take over the steps.",
    watch: "Observe the child's initiation and quality; practice a variation: Handle a changed collection schedule.",
    launch: "The family decides when the child can initiate, complete, check and adapt this responsibility.",
    safety: "Adult handles heavy bags, unsafe waste and road exposure.", requiresAdultSupervision: true,
    cardIllustrationId: 37,
  },
  {
    id: "bath-sink", category: "home-care", title: "Wipe bathroom sink", outcome: "Clean an approved sink using safe supplies.",
    typicalAge: { from: 7 }, finishLine: "Clean an approved sink using safe supplies.",
    cueSuggestions: ["After bathroom reset cue"], naturalPayoff: "The sink and tap are visibly clean.",
    watchVariations: ["Adjust to a messier sink without chemicals."], seasons: ['everyday'],
    model: "Show how to wipe bathroom sink and point out the finish line.",
    assist: "Do wipe bathroom sink together, then let the child take over the steps.",
    watch: "Observe the child's initiation and quality; practice a variation: Adjust to a messier sink without chemicals.",
    launch: "The family decides when the child can initiate, complete, check and adapt this responsibility.",
    safety: "Use only adult-approved nonhazardous materials.", requiresAdultSupervision: true,
    cardIllustrationId: 40,
  },
  {
    id: "bath", category: "home-care", title: "Clean an assigned bathroom", outcome: "Complete agreed safe bathroom care tasks.",
    typicalAge: { from: 11 }, finishLine: "Complete agreed safe bathroom care tasks.",
    cueSuggestions: ["On the household cleaning day"], naturalPayoff: "The approved bathroom checklist is done.",
    watchVariations: ["Plan cleanup when a bathroom is occupied."], seasons: ['everyday'],
    model: "Show how to clean an assigned bathroom and point out the finish line.",
    assist: "Do clean an assigned bathroom together, then let the child take over the steps.",
    watch: "Observe the child's initiation and quality; practice a variation: Plan cleanup when a bathroom is occupied.",
    launch: "The family decides when the child can initiate, complete, check and adapt this responsibility.",
    safety: "Adults manage chemical cleaners, sharp tools and hazardous waste.", requiresAdultSupervision: true,
    
  },
  {
    id: "sweep", category: "home-care", title: "Sweep kitchen floor", outcome: "Sweep approved floor areas into the dustpan.",
    typicalAge: { from: 7 }, finishLine: "Sweep approved floor areas into the dustpan.",
    cueSuggestions: ["After dinner cleanup"], naturalPayoff: "Crumbs are collected and disposed.",
    watchVariations: ["Sweep around a changed table layout."], seasons: ['everyday'],
    model: "Show how to sweep kitchen floor and point out the finish line.",
    assist: "Do sweep kitchen floor together, then let the child take over the steps.",
    watch: "Observe the child's initiation and quality; practice a variation: Sweep around a changed table layout.",
    launch: "The family decides when the child can initiate, complete, check and adapt this responsibility.",
    
    cardIllustrationId: 32,
  },
  {
    id: "dinner-help", category: "meals", title: "Help prepare family dinner", outcome: "Complete one safe food-preparation step.",
    typicalAge: { from: 7 }, finishLine: "Complete one safe food-preparation step.",
    cueSuggestions: ["When dinner preparation starts"], naturalPayoff: "The agreed ingredient or step is ready.",
    watchVariations: ["Find a safe alternative when an ingredient is missing."], seasons: ['everyday'],
    model: "Show how to help prepare family dinner and point out the finish line.",
    assist: "Do help prepare family dinner together, then let the child take over the steps.",
    watch: "Observe the child's initiation and quality; practice a variation: Find a safe alternative when an ingredient is missing.",
    launch: "The family decides when the child can initiate, complete, check and adapt this responsibility.",
    safety: "Adult supervises sharp tools, food hygiene, heat and appliances.", requiresAdultSupervision: true,
    
  },
  {
    id: "dinner", category: "meals", title: "Prepare one family meal", outcome: "Plan and prepare an approved meal with appropriate supervision.",
    typicalAge: { from: 14 }, finishLine: "Plan and prepare an approved meal with appropriate supervision.",
    cueSuggestions: ["Before the planned meal"], naturalPayoff: "Meal and safe cleanup are completed.",
    watchVariations: ["Adjust when a meal must be prepared more quickly."], seasons: ['everyday'],
    model: "Show how to prepare one family meal and point out the finish line.",
    assist: "Do prepare one family meal together, then let the child take over the steps.",
    watch: "Observe the child's initiation and quality; practice a variation: Adjust when a meal must be prepared more quickly.",
    launch: "The family decides when the child can initiate, complete, check and adapt this responsibility.",
    safety: "Adult determines readiness and supervises all food and kitchen hazards.", requiresAdultSupervision: true,
    
  },
  {
    id: "plants", category: "caring", title: "Water plants", outcome: "Give approved plants the correct amount of water.",
    typicalAge: { from: 4 }, finishLine: "Give approved plants the correct amount of water.",
    cueSuggestions: ["After the family's plant-check cue"], naturalPayoff: "The plants have the approved amount.",
    watchVariations: ["Check whether a plant needs less water."], seasons: ['everyday'],
    model: "Show how to water plants and point out the finish line.",
    assist: "Do water plants together, then let the child take over the steps.",
    watch: "Observe the child's initiation and quality; practice a variation: Check whether a plant needs less water.",
    launch: "The family decides when the child can initiate, complete, check and adapt this responsibility.",
    
    
  },
  {
    id: "outdoor", category: "personal-space", title: "Put away outdoor toys", outcome: "Return outdoor toys and supplies to storage.",
    typicalAge: { from: 5 }, finishLine: "Return outdoor toys and supplies to storage.",
    cueSuggestions: ["When outdoor play ends"], naturalPayoff: "The play area is ready for next time.",
    watchVariations: ["Put things away when weather changes."], seasons: ['summer-transition','everyday'],
    model: "Show how to put away outdoor toys and point out the finish line.",
    assist: "Do put away outdoor toys together, then let the child take over the steps.",
    watch: "Observe the child's initiation and quality; practice a variation: Put things away when weather changes.",
    launch: "The family decides when the child can initiate, complete, check and adapt this responsibility.",
    
    
  },
  {
    id: "yard", category: "home-care", title: "Tidy an assigned outdoor area", outcome: "Care for an approved outdoor space safely.",
    typicalAge: { from: 12 }, finishLine: "Care for an approved outdoor space safely.",
    cueSuggestions: ["Before outdoor family time"], naturalPayoff: "The assigned space meets its finish line.",
    watchVariations: ["Adapt to wet weather or unexpected debris."], seasons: ['summer-transition','everyday'],
    model: "Show how to tidy an assigned outdoor area and point out the finish line.",
    assist: "Do tidy an assigned outdoor area together, then let the child take over the steps.",
    watch: "Observe the child's initiation and quality; practice a variation: Adapt to wet weather or unexpected debris.",
    launch: "The family decides when the child can initiate, complete, check and adapt this responsibility.",
    safety: "Adults handle tools, chemicals, heavy objects and unsafe debris.", requiresAdultSupervision: true,
    
  },
  {
    id: "school-bag", category: "school-prep", title: "Pack my backpack", outcome: "Prepare the bag for tomorrow's actual plan.",
    typicalAge: { from: 6 }, finishLine: "Prepare the bag for tomorrow's actual plan.",
    cueSuggestions: ["After homework or dinner"], naturalPayoff: "Necessary supplies are packed and by the door.",
    watchVariations: ["Pack for a special schedule or earlier start."], seasons: ['school-start','everyday'],
    model: "Show how to pack my backpack and point out the finish line.",
    assist: "Do pack my backpack together, then let the child take over the steps.",
    watch: "Observe the child's initiation and quality; practice a variation: Pack for a special schedule or earlier start.",
    launch: "The family decides when the child can initiate, complete, check and adapt this responsibility.",
    
    cardIllustrationId: 25,
  },
  {
    id: "school-day-prep", category: "school-prep", title: "Manage tomorrow's school things", outcome: "Check tomorrow's plan and prepare needed items.",
    typicalAge: { from: 10 }, finishLine: "Check tomorrow's plan and prepare needed items.",
    cueSuggestions: ["During the evening check-in"], naturalPayoff: "Necessary items and requests for help are handled.",
    watchVariations: ["Adapt to an early departure or unusual activity."], seasons: ['school-start','everyday'],
    model: "Show how to manage tomorrow's school things and point out the finish line.",
    assist: "Do manage tomorrow's school things together, then let the child take over the steps.",
    watch: "Observe the child's initiation and quality; practice a variation: Adapt to an early departure or unusual activity.",
    launch: "The family decides when the child can initiate, complete, check and adapt this responsibility.",
    
    cardIllustrationId: 27,
  },
  {
    id: "after-school", category: "routines", title: "Unpack backpack and lunchbox", outcome: "Put school papers, bag and lunchbox in agreed homes.",
    typicalAge: { from: 6 }, finishLine: "Put school papers, bag and lunchbox in agreed homes.",
    cueSuggestions: ["When arriving home"], naturalPayoff: "Everything is ready for the next school day.",
    watchVariations: ["Follow the routine after a late return."], seasons: ['school-start','everyday'],
    model: "Show how to unpack backpack and lunchbox and point out the finish line.",
    assist: "Do unpack backpack and lunchbox together, then let the child take over the steps.",
    watch: "Observe the child's initiation and quality; practice a variation: Follow the routine after a late return.",
    launch: "The family decides when the child can initiate, complete, check and adapt this responsibility.",
    
    
  },
  {
    id: "teeth", category: "self-care", title: "Brush my teeth", outcome: "Complete the family's dentist-guided brushing routine.",
    typicalAge: { from: 4 }, finishLine: "Complete the family's dentist-guided brushing routine.",
    cueSuggestions: ["After breakfast and before bed"], naturalPayoff: "Teeth are brushed with age-appropriate help.",
    watchVariations: ["Keep the routine on an overnight trip."], seasons: ['everyday'],
    model: "Show how to brush my teeth and point out the finish line.",
    assist: "Do brush my teeth together, then let the child take over the steps.",
    watch: "Observe the child's initiation and quality; practice a variation: Keep the routine on an overnight trip.",
    launch: "The family decides when the child can initiate, complete, check and adapt this responsibility.",
    safety: "Adult assists or supervises brushing as appropriate to the child's needs.", requiresAdultSupervision: true,
    cardIllustrationId: 22,
  },
  {
    id: "dressed", category: "self-care", title: "Get dressed", outcome: "Choose and put on suitable clothes with needed help.",
    typicalAge: { from: 4 }, finishLine: "Choose and put on suitable clothes with needed help.",
    cueSuggestions: ["After waking"], naturalPayoff: "Child is dressed for the planned day.",
    watchVariations: ["Choose appropriate clothes for changed weather."], seasons: ['everyday'],
    model: "Show how to get dressed and point out the finish line.",
    assist: "Do get dressed together, then let the child take over the steps.",
    watch: "Observe the child's initiation and quality; practice a variation: Choose appropriate clothes for changed weather.",
    launch: "The family decides when the child can initiate, complete, check and adapt this responsibility.",
    
    cardIllustrationId: 23,
  },
  {
    id: "snack", category: "food-independence", title: "Prepare an approved snack", outcome: "Choose, assemble and clean up a safe snack.",
    typicalAge: { from: 7 }, finishLine: "Choose, assemble and clean up a safe snack.",
    cueSuggestions: ["When the usual snack time begins"], naturalPayoff: "A safe snack is made and the space is reset.",
    watchVariations: ["Find an approved alternative if an ingredient runs out."], seasons: ['summer-transition','everyday'],
    model: "Show how to prepare an approved snack and point out the finish line.",
    assist: "Do prepare an approved snack together, then let the child take over the steps.",
    watch: "Observe the child's initiation and quality; practice a variation: Find an approved alternative if an ingredient runs out.",
    launch: "The family decides when the child can initiate, complete, check and adapt this responsibility.",
    safety: "Adult defines approved foods and supervises choking, allergy, knife and heat hazards.", requiresAdultSupervision: true,
    
  },
  {
    id: "independent-play", category: "initiative", title: "Choose and start an activity", outcome: "Select a suitable activity and begin without needing an adult to invent it.",
    typicalAge: { from: 6 }, finishLine: "Select a suitable activity and begin without needing an adult to invent it.",
    cueSuggestions: ["After the family's daily quiet or free-time cue"], naturalPayoff: "An activity is chosen, started, and materials are put away.",
    watchVariations: ["Choose something different when the usual supplies aren't available."], seasons: ['summer-transition','everyday'],
    model: "Show how to choose and start an activity and point out the finish line.",
    assist: "Do choose and start an activity together, then let the child take over the steps.",
    watch: "Observe the child's initiation and quality; practice a variation: Choose something different when the usual supplies aren't available.",
    launch: "The family decides when the child can initiate, complete, check and adapt this responsibility.",
    
    
  },
  {
    id: "family-meeting", category: "family-team", title: "Participate in our weekly family meeting", outcome: "Contribute one observation or decision to the weekly conversation.",
    typicalAge: { from: 4 }, finishLine: "Contribute one observation or decision to the weekly conversation.",
    cueSuggestions: ["At our agreed weekly family meeting"], naturalPayoff: "The child has participated in an age-fitting way.",
    watchVariations: ["Contribute when the family's schedule changes."], seasons: ['new-year','everyday'],
    model: "Show how to participate in our weekly family meeting and point out the finish line.",
    assist: "Do participate in our weekly family meeting together, then let the child take over the steps.",
    watch: "Observe the child's initiation and quality; practice a variation: Contribute when the family's schedule changes.",
    launch: "The family decides when the child can initiate, complete, check and adapt this responsibility.",
    
    
  },
  {
    id: "morning-rhythm", category: "routines", title: "Own one morning routine step", outcome: "Notice and complete one agreed morning responsibility.",
    typicalAge: { from: 5 }, finishLine: "Notice and complete one agreed morning responsibility.",
    cueSuggestions: ["After an existing morning action"], naturalPayoff: "The chosen step is complete without escalating reminders.",
    watchVariations: ["Keep it going on a rushed school morning."], seasons: ['school-start','everyday'],
    model: "Show how to own one morning routine step and point out the finish line.",
    assist: "Do own one morning routine step together, then let the child take over the steps.",
    watch: "Observe the child's initiation and quality; practice a variation: Keep it going on a rushed school morning.",
    launch: "The family decides when the child can initiate, complete, check and adapt this responsibility.",
    
    
  },
  {
    id: "evening-rhythm", category: "routines", title: "Own one evening routine step", outcome: "Notice and complete one agreed evening responsibility.",
    typicalAge: { from: 5 }, finishLine: "Notice and complete one agreed evening responsibility.",
    cueSuggestions: ["After dinner or brushing teeth"], naturalPayoff: "The chosen step is complete before bedtime.",
    watchVariations: ["Follow the cue on a late evening."], seasons: ['new-year','everyday'],
    model: "Show how to own one evening routine step and point out the finish line.",
    assist: "Do own one evening routine step together, then let the child take over the steps.",
    watch: "Observe the child's initiation and quality; practice a variation: Follow the cue on a late evening.",
    launch: "The family decides when the child can initiate, complete, check and adapt this responsibility.",
    
    
  }
] as const satisfies readonly CuratedSkill[];

/** Alias crosswalk for the newer public chore chart. An alias can describe a
 * more specific/complex version of another skill; never merge records without
 * the family's explicit approval. */
export const CHORE_CHOICE_TO_SKILL: Readonly<Record<string, string>> = Object.freeze({
  "toys": "toys",
  "hamper": "hamper",
  "bed-help": "bed-help",
  "bed": "bed",
  "floor": "floor",
  "room": "room",
  "table": "table",
  "dishes": "dishes",
  "counters": "counters",
  "dishwasher": "dishwasher",
  "kitchen": "kitchen",
  "pet": "pet",
  "pet-care": "pet-care",
  "shared": "shared",
  "sort": "sort",
  "fold": "fold",
  "load": "load",
  "own-laundry": "own-laundry",
  "dust": "dust",
  "vacuum": "vacuum",
  "trash-small": "trash-small",
  "trash": "trash",
  "bath-sink": "bath-sink",
  "bath": "bath",
  "sweep": "sweep",
  "dinner-help": "dinner-help",
  "dinner": "dinner",
  "plants": "plants",
  "outdoor": "outdoor",
  "yard": "yard",
});

const byId = new Map<string, CuratedSkill>(skills.map(s => [s.id, s]));
export function skillById(id: string): CuratedSkill | null { return byId.get(id) ?? null; }
export function skillForChoreChoice(choiceId: string): CuratedSkill | null {
  const id = CHORE_CHOICE_TO_SKILL[choiceId];
  return id ? skillById(id) : null;
}

/** Seasonal relevance ranks candidate skills; it does not remove a chosen
 * family goal or imply every family follows the same school calendar. */
export function skillsForContext(input: {
  season: SeasonContext;
  age?: number | null;
  categories?: readonly SkillCategory[];
  limit?: number;
}): CuratedSkill[] {
  const limit = Math.max(0, Math.min(input.limit ?? 8, skills.length));
  const age = input.age ?? null;
  const categories = input.categories ? new Set(input.categories) : null;
  return skills
    .filter(s => !categories || categories.has(s.category))
    .map((s, index) => ({
      s, index,
      ageMatch: age !== null && Number.isFinite(age) && (s.typicalAge?.from ?? 0) <= age ? 1 : 0,
      seasonMatch: s.seasons.includes(input.season) ? 1 : 0,
    }))
    .sort((a,b) => b.seasonMatch - a.seasonMatch || b.ageMatch - a.ageMatch || a.index - b.index)
    .slice(0, limit)
    .map(x => x.s);
}

/** Confirmed source mappings, not an inference based on display-name matching. */
export const AGE_GUIDE_CARD_IMAGE_TO_SKILL: Readonly<Record<number, string>> = Object.freeze({
  22: 'teeth', 23: 'dressed', 25: 'school-bag', 27: 'school-day-prep',
  28: 'bed', 29: 'toys', 30: 'fold', 32: 'sweep',
  33: 'table', 34: 'dishes', 35: 'load', 36: 'counters',
  37: 'trash', 38: 'shared', 40: 'bath-sink', 41: 'pet',
});
/** No card print-text mapping is claimed: only age-guide artwork references. */
export function skillForCardIllustration(id: number): CuratedSkill | null {
  const key = AGE_GUIDE_CARD_IMAGE_TO_SKILL[id];
  return key ? skillById(key) : null;
}

/** Importing chore choices is deliberate: validate, don't mutate the tool. */
export function unmappedChoreChoiceIds(): string[] {
  return choreChoices.filter(c => !skillForChoreChoice(c.id)).map(c => c.id);
}
