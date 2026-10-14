/** Directory presentation only. Tool functionality and printable artwork live on their own routes. */
import { routes } from '../routes';
export type ToolCategory = 'everyone' | 'planning' | 'home';
export interface DirectoryPresentation {
  title: string;
  description: string;
  action: string;
  category: ToolCategory;
  slug: string;
  icon: 'leaf' | 'meal' | 'gift' | 'calendar' | 'heart' | 'home' | 'bag';
  onScreen?: boolean;
}
export const directoryTools: Record<string, DirectoryPresentation> = {
  [routes.choreChart]: { title: 'Chore chart by age', description: 'Choose a few jobs, add your child’s name, and make a chart they can follow.', action: 'Make your chore chart', category: 'everyone', slug: 'chore-chart', icon: 'home' },
  [routes.routineChart]: { title: 'Kids’ routine charts', description: 'Put morning, after-school, or bedtime steps where your child can see them.', action: 'Make your routine chart', category: 'everyone', slug: 'routine-chart', icon: 'calendar' },
  [routes.mealPlanner]: { title: 'Weekly dinner planner', description: 'Choose dinners for your real week and keep the grocery list beside them.', action: 'Make your dinner plan', category: 'planning', slug: 'meal-planner', icon: 'meal' },
  [routes.mentalLoad]: { title: 'Share the mental load worksheet', description: 'Get the jobs out of your head and hand over one whole responsibility.', action: 'Open the worksheet', category: 'everyone', slug: 'mental-load-worksheet', icon: 'heart' },
  [routes.tryCalendar]: { title: 'Monthly family calendar', description: 'Give each person a row, then put everyone’s plans in one place.', action: 'Make your family calendar', category: 'planning', slug: 'try-the-calendar', icon: 'calendar' },
  [routes.lunchSnackStation]: { title: 'Lunch & snack station', description: 'Make a simple lunch guide and snack station the kids can use themselves.', action: 'Make your lunch station', category: 'everyone', slug: 'lunch-and-snack-station', icon: 'meal' },
  [routes.laundrySystem]: { title: 'Laundry checklist', description: 'Set up the stations and share the steps from dirty basket to drawer.', action: 'Open the laundry checklist', category: 'home', slug: 'laundry-system', icon: 'home' },
  [routes.backToSchool]: { title: 'Back-to-school checklist', description: 'Get supplies, school forms, and the first-week routine ready together.', action: 'Open the school checklist', category: 'planning', slug: 'back-to-school-checklist', icon: 'bag' },
  [routes.screenTime]: { title: 'Family screen time agreement', description: 'Agree on the jobs, activities, and limits together, then sign your plan.', action: 'Make your agreement', category: 'everyone', slug: 'screen-time-contract', icon: 'heart' },
  [routes.holidayGifts]: { title: 'Holiday gift planner', description: 'Keep gift ideas, your budget, and what you’ve spent on one sheet.', action: 'Plan your gifts', category: 'planning', slug: 'holiday-gift-planner', icon: 'gift' },
  [routes.thanksgivingPlan]: { title: 'Thanksgiving prep plan', description: 'Work back from dinner time, with a timeline and jobs to share.', action: 'Make your Thanksgiving plan', category: 'planning', slug: 'thanksgiving-plan', icon: 'meal' },
  [routes.decemberCountdown]: { title: 'Family December countdown', description: 'Choose 24 small activities and holiday jobs that fit your family.', action: 'Make your countdown', category: 'everyone', slug: 'december-countdown', icon: 'gift' },
  [routes.gratitudeTracker]: { title: 'Family gratitude tracker', description: 'Leave room for one thankful thing from everyone, each day in November.', action: 'Make your gratitude tracker', category: 'everyone', slug: 'gratitude-tracker', icon: 'heart' },
  [routes.fallPantry]: { title: 'Fall pantry stock-up list', description: 'Check your shelves before stocking up for soup nights and holiday baking.', action: 'Open the pantry checklist', category: 'planning', slug: 'fall-pantry-stock-up', icon: 'leaf' },
  [routes.travelChecklist]: { title: 'Family travel checklist', description: 'Plan the packing and preparations, from a week out to the trip home.', action: 'Open the travel checklist', category: 'planning', slug: 'travel-checklist', icon: 'bag' },
  [routes.commandCenterSetup]: { title: 'Command center setup', description: 'Give the calendar, school papers, and family jobs a shared home.', action: 'Open the setup sheet', category: 'planning', slug: 'command-center-setup', icon: 'home' },
  [routes.closetReset]: { title: 'Closet reset checklist', description: 'Sort what stays, what goes, and what needs a better place.', action: 'Open the closet checklist', category: 'home', slug: 'closet-reset', icon: 'home' },
  [routes.paperBlitz]: { title: 'Paper clutter reset', description: 'Work through the paper pile in small sessions, with a timer to help you stop.', action: 'Start the paper reset', category: 'home', slug: 'paper-clutter-blitz', icon: 'home', onScreen: true },
  [routes.newYearDeclutter]: { title: 'New Year declutter plan', description: 'Take one small area at a time over eight weeks.', action: 'Open the declutter plan', category: 'home', slug: 'new-year-declutter', icon: 'home', onScreen: true },
  [routes.fallCleaning]: { title: 'Fall cleaning checklist', description: 'Put summer away and get ready for colder days, one room at a time.', action: 'Open the fall checklist', category: 'home', slug: 'fall-cleaning-checklist', icon: 'leaf', onScreen: true },
  [routes.springCleaning]: { title: 'Spring cleaning checklist', description: 'Choose one room and tick off the jobs as you go.', action: 'Open the spring checklist', category: 'home', slug: 'spring-cleaning-checklist', icon: 'leaf', onScreen: true },
  [routes.homeschoolRhythm]: { title: 'Homeschool weekly rhythm', description: 'Build a school week around time blocks, with room to adjust.', action: 'Make your weekly rhythm', category: 'planning', slug: 'homeschool-rhythm', icon: 'calendar' },
  [routes.planner]: { title: 'Weekly family planner', description: 'Put the week’s plans, meals, and priorities on one page.', action: 'Make your weekly plan', category: 'planning', slug: 'planner', icon: 'calendar' },
  [routes.pantry]: { title: 'Pantry inventory', description: 'See what’s already there, what needs using, and what to buy.', action: 'Make your pantry inventory', category: 'planning', slug: 'pantry', icon: 'meal' },
};
/** Editorially selected starter tools; 'Popular' is a navigation label, not a measured ranking. */
export const popularPaths: string[] = [routes.choreChart, routes.mealPlanner, routes.tryCalendar, routes.mentalLoad, routes.lunchSnackStation, routes.laundrySystem];
export const seasonalSelections = [
  { months: [8, 9, 10], paths: [routes.fallCleaning, routes.thanksgivingPlan, routes.holidayGifts] },
  { months: [11], paths: [routes.decemberCountdown, routes.holidayGifts, routes.gratitudeTracker] },
  { months: [0, 1], paths: [routes.newYearDeclutter, routes.mentalLoad, routes.laundrySystem] },
  { months: [2, 3, 4], paths: [routes.springCleaning, routes.closetReset, routes.mentalLoad] },
  { months: [5, 6, 7], paths: [routes.travelChecklist, routes.lunchSnackStation, routes.tryCalendar] },
];
