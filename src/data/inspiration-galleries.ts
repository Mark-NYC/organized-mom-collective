/**
 * Image-first Pinterest galleries. Set image URLs only after the originals are
 * committed to public/images/inspiration/<slug>/ and visually checked.
 * An unpublished gallery is visible by URL for review but noindexed.
 */
export type GalleryIdea = {
  id: string;
  title: string;
  tip: string;
  tryThis: string;
  alt: string;
  image?: string;
  pinDescription: string;
  category: 'Storage' | 'Hooks & walls' | 'Small spaces' | 'Family routines';
};
export type InspirationGallery = {
  slug: string;
  title: string;
  seoTitle: string;
  description: string;
  deck: string;
  disclosure: string;
  published: boolean;
  ideas: GalleryIdea[];
};
const titles = [
  ['A bench that earns its space','Give everyone a place to sit while shoes and bags stay below the seat.','Choose a bench shallow enough that the door opens freely.','Storage'],
  ['One basket for each child','Separate baskets make it easier for kids to put their own shoes away.','Pick baskets with handles so children can pull them out.','Family routines'],
  ['Hooks instead of hangers','An open row of hooks makes backpacks and coats faster to put away.','Space hooks far enough apart for full school bags.','Hooks & walls'],
  ['Lower hooks for little hands','Put daily belongings where children can reach them without help.','Test hook height with your youngest child.','Family routines'],
  ['A landing spot for school papers','Give incoming permission slips and notices one home.','Use a single upright wall pocket, then empty it weekly.','Family routines'],
  ['A narrow shelf above the hooks','Take advantage of wall space without crowding the floor.','Reserve high storage for adult-only or seasonal items.','Small spaces'],
  ['Shoe storage beneath the seat','Keep the floor clear by using the space under a compact bench.','Measure your tallest everyday boots before buying bins.','Storage'],
  ['A washable entry rug','A low-profile rug helps contain grit at the busiest doorway.','Choose a nonslip backing and confirm door clearance.','Family routines'],
  ['A small-space corner station','An unused corner can hold hooks, a seat, and a small basket.','Start with the wall, not a large furniture purchase.','Small spaces'],
  ['A tray for keys and sunglasses','Keep the small things from disappearing into bags and pockets.','Use a shallow tray at adult height.','Storage'],
  ['Vertical cubbies for busy mornings','A narrow stack of cubbies can give each person a predictable place.','Label locations in your family routine, not on decorative props.','Storage'],
  ['A rail for frequently used bags','Separate the daily backpack from occasional totes and sports gear.','Keep the heaviest items on properly anchored hooks.','Hooks & walls'],
  ['A drop zone beside the door','Use the first few steps inside to catch bags and shoes.','Keep this zone limited to things used every day.','Family routines'],
  ['A simple open-wall setup','A peg rail and one small bench can work without built-in cabinetry.','Install hooks into studs or suitable wall anchors.','Small spaces'],
  ['A five-minute family reset','The best entryway setup is one everyone can reset after school.','Assign each child one hook, one shoe spot, and one small job.','Family routines'],
] as const;
const ideas: GalleryIdea[] = titles.map(([title,tip,tryThis,category], i)=>({
  id: 'idea-'+(i+1),
  title,tip,tryThis,
  alt: 'Mudroom inspiration photograph for '+title.toLowerCase()+'. Replace with an exact description after image review.',
  pinDescription: title+' for a small family mudroom. Practical entryway organization inspiration for backpacks, shoes, coats and busy mornings.',
  category,
}));
export const inspirationGalleries: InspirationGallery[] = [{
  slug:'small-mudroom-ideas',
  title:'30 Small Mudroom Ideas for Busy Families',
  seoTitle:'30 Small Mudroom Ideas for Busy Families',
  description:'Explore 30 small mudroom ideas for families, from storage benches and backpack hooks to shoe baskets and simple entryway routines.',
  deck:'Beautiful, practical entryway ideas for backpacks, shoes, and everything that comes home with the kids.',
  disclosure:'Images in this inspiration collection are AI-generated design concepts, not photographs of documented homes or shoppable product listings.',
  published:false, // flip only when all published images and Save actions are verified
  ideas
}];
