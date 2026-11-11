/** Shared age-specific responsibility-card selection for landing pages and print PDFs.
 * Every asset is an original high-resolution transparent PNG from the approved deck.
 * Keep titles and image IDs identical on the site and in the downloadable printables.
 */
export const higherQualityIcon = id =>
  '/assets/responsibility-cards/illustrations/higher-quality/My Responsibility Cards - 4x6 inches (4.25 x 6.25 in) ('+id+').png';

export const ageCardGuides = {
  'chores-for-4-5-year-olds': {
    title:'CHORES FOR 4-5 YEAR-OLDS',
    subtitle:'Choose one or two jobs to practice together.',
    intro:'Little Helpers',
    categoryIcons:[29,30,24],
    jobs:[
      {title:'Wash my hands',image:24},
      {title:'Put my toys away',image:29},
      {title:'Brush my teeth',image:22},
      {title:'Get dressed',image:23},
      {title:'Make my bed',image:28},
      {title:'Put my clothes away',image:30},
      {title:'Set the table',image:33},
      {title:'Feed the pet with help',image:41},
      {title:'Put things in a basket',image:38}
    ]
  },
  'chores-for-6-7-year-olds': {
    title:'CHORES FOR 6-7 YEAR-OLDS',
    subtitle:'Choose two jobs you can start doing on your own.',
    intro:'Growing Independence',
    categoryIcons:[25,39,33],
    jobs:[
      {title:'Pack my backpack',image:25},
      {title:'Tidy the entryway',image:39},
      {title:'Set the table',image:33},
      {title:'Clear the table',image:34},
      {title:'Wipe the counters',image:36},
      {title:'Help with laundry',image:35},
      {title:'Tidy my desk',image:31},
      {title:'Put things back',image:38},
      {title:'Put clothes away',image:30}
    ]
  },
  'chores-for-10-12-year-olds': {
    title:'CHORES FOR 10-12 YEAR-OLDS',
    subtitle:'Choose two responsibilities you can own from start to finish.',
    intro:'Taking Ownership',
    categoryIcons:[27,40,34],
    jobs:[
      {title:'Manage my school things',image:27},
      {title:'Keep my desk organized',image:31},
      {title:'Take care of my laundry',image:35},
      {title:'Sweep my floor',image:32},
      {title:'Clean the bathroom sink',image:40},
      {title:'Take out the trash',image:37},
      {title:'Wipe the counters',image:36},
      {title:'Clear the table',image:34},
      {title:'Keep the entryway tidy',image:39}
    ]
  }
};
