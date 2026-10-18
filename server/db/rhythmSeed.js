// Starter staples for the rhythm list: [name, every, months, crops].
// every is [min, max, unit] for things made on a repeat, or null for things made once a season.
// months are the in-season months (1 = January), for the northern hemisphere; change them to suit.
const WEEK = [1, 1, 'weeks'];
const FEW_WEEKS = [2, 4, 'weeks'];
const MONTH_OR_TWO = [1, 2, 'months'];
const SPRING = [4, 5, 6];
const SUMMER = [6, 7, 8, 9];
const AUTUMN = [9, 10, 11];
const WINTER = [12, 1, 2];

export const RHYTHM_SEED = [
  ['Bread', WEEK, null, null],
  ['Yogurt', WEEK, null, null],
  ['Tortillas', WEEK, null, null],
  ['A pot of beans', WEEK, null, null],
  ['Stock', WEEK, null, null],
  ['Salsa', WEEK, null, 'Tomatoes, Tomatillos, Chiles'],
  ['Kefir', WEEK, null, null],
  ['Ghee', FEW_WEEKS, null, null],
  ['Harissa', FEW_WEEKS, null, 'Chiles'],
  ['Chile adobo', FEW_WEEKS, null, null],
  ['Nut butter', FEW_WEEKS, null, null],
  ['Mustard', FEW_WEEKS, null, null],
  ['Kombucha', FEW_WEEKS, null, null],
  ['Cookie dough', FEW_WEEKS, null, null],
  ['Pie dough', FEW_WEEKS, null, null],
  ['Sauerkraut', MONTH_OR_TWO, null, 'Cabbage'],
  ['Kimchi', MONTH_OR_TWO, null, 'Napa cabbage, Daikon'],
  ['Curtido', MONTH_OR_TWO, null, 'Cabbage'],
  ['Spice blends', MONTH_OR_TWO, null, null],
  ['Tamales', MONTH_OR_TWO, null, null],
  ['Dumplings', MONTH_OR_TWO, null, null],
  ['Puff pastry', MONTH_OR_TWO, null, null],
  ['Pesto', null, SUMMER, 'Basil'],
  ['Dried herb bundles', null, SUMMER, 'Oregano, Thyme, Sage, Mint, Rosemary'],
  ['Jam', null, SPRING, 'Strawberries, Rhubarb'],
  ['Canned tomatoes', null, SUMMER, 'Tomatoes'],
  ['Pickles', null, SUMMER, 'Cucumbers'],
  ['Apple butter', null, AUTUMN, 'Apples'],
  ['Preserved lemons', null, WINTER, 'Lemons'],
  ['Vanilla extract', [3, 4, 'months'], null, null],
  ['Miso', null, WINTER, null],
  ['Membrillo', null, [10, 11], 'Quince'],
  ['Marmalade', null, [1, 2], 'Seville oranges'],
  ['Umeboshi', null, [6, 7], 'Ume plums'],
  ['Fruit vinegar', [12, 12, 'months'], null, null],
];
