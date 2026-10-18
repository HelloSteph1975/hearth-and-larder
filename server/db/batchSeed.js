// The twelve built-in batch weeks. Each day is [kind, task, ready, ingredients].
// ready is [min, max, unit] for things that need time before they are ready, or null.
// Ingredient names match common pantry names, so stock on the shelves counts against the list.
const BIG = 'big';
const JAR = 'jar';
const REFILL = 'refill';

export const BATCH_MONTHS = [
  {
    title: 'Month 1: Mexican foundations',
    note: 'Beans, masa, salsas and a sourdough starter. Everything else builds on these.',
    weeks: [
      {
        title: 'Beans, stock and a starter',
        cook: 'Frijoles de olla, sopa de fideo, a pot of soup from the stock.',
        days: [
          [BIG, 'A big pot of black beans and a pot of chicken stock, side by side. Freeze both in portions.', null,
            ['Black beans', 'Chicken backs and feet for stock', 'Onions (yellow, red, white)', 'Garlic heads', 'Carrots', 'Mexican oregano']],
          [JAR, 'A sourdough starter: rye or einkorn flour and water.', [7, 14, 'days'], ['Whole rye berries', 'Einkorn berries']],
          [REFILL, 'Plain yogurt. Save two spoonfuls to start the next batch.', null, ['Whole milk, grass-fed', 'Plain yogurt']],
        ],
      },
      {
        title: 'Masa and tortillas',
        cook: 'Tacos, quesadillas with epazote, enfrijoladas with last week\'s beans.',
        days: [
          [JAR, 'Chiles en escabeche: jalapeños, carrots and onion (fridge pickle). That evening, simmer dent corn with cal and leave it to soak overnight.', [2, 2, 'days'],
            ['Fresh chiles: jalapeño, serrano, poblano', 'Carrots', 'Onions (yellow, red, white)', 'Distilled white vinegar, 5%', 'Heirloom dent corn', 'Cal (food-grade slaked lime)']],
          [BIG, 'Rinse and grind the corn into fresh masa. Press tortillas and freeze half.', null, ['Fine sea salt']],
          [REFILL, 'Salsa roja and salsa verde for the week.', null,
            ['Whole and crushed tomatoes', 'Tomatillos', 'Fresh chiles: jalapeño, serrano, poblano', 'Chile de árbol', 'Garlic heads', 'Onions (yellow, red, white)', 'Limes, lots of them']],
        ],
      },
      {
        title: 'Pie dough, first loaf and curtido',
        cook: 'Apple pie from one dough disc. Pupusas with curtido at the end of the week.',
        days: [
          [BIG, 'Four pie dough discs for the freezer. Mix your first sourdough dough that evening and let it rise overnight.', null,
            ['Unbleached bread and all-purpose flour, organic', 'Cultured butter, unsalted for baking', 'Leaf lard', 'Spelt berries', 'Einkorn berries']],
          [JAR, 'Bake the loaf in the morning (half spelt, half einkorn). Then start curtido, the Salvadoran spiced cabbage.', [3, 5, 'days'],
            ['Cabbage', 'Carrots', 'Onions (yellow, red, white)', 'Mexican oregano', 'Unrefined sea salt for ferments']],
          [REFILL, 'Ghee.', null, ['Cultured butter, unsalted for baking']],
        ],
      },
      {
        title: 'Tamales',
        cook: 'Tamales, pozole from dried hominy. Take stock of the month and restock.',
        days: [
          [REFILL, 'Chile adobo (guajillo and ancho) and a pork filling for tamales. Freeze extra adobo in cubes.', null,
            ['Guajillo chiles', 'Ancho chiles', 'Pork shoulder and belly', 'Garlic heads', 'Cumin seed', 'Mexican oregano']],
          [JAR, 'Vanilla extract: split beans in vodka.', [2, 6, 'months'], ['Vanilla beans', 'Vodka']],
          [BIG, 'About 18 tamales from masa and the filling. Freeze what you won\'t eat this week.', null,
            ['Corn husks (hojas para tamal)', 'Rendered lard and tallow', 'Fresh masa']],
        ],
      },
    ],
  },
  {
    title: 'Month 2: Korea and Japan',
    note: 'Kimchi season. Learn dashi, koji and dumplings.',
    weeks: [
      {
        title: 'Kimchi, kombucha and dashi',
        cook: 'Miso soup, onigiri, scallion pancakes.',
        days: [
          [BIG, 'Salt a napa cabbage in the morning, rinse and season it into kimchi in the afternoon.', [3, 5, 'days'],
            ['Napa and green cabbage', 'Korean coarse sea salt', 'Gochugaru', 'Traditional fish sauce', 'Garlic heads', 'Fresh ginger and turmeric root', 'Scallions', 'Daikon and winter radishes']],
          [JAR, 'Start kombucha.', [7, 10, 'days'], ['Loose black and green tea', 'Organic cane sugar', 'Kombucha with a spare SCOBY']],
          [REFILL, 'Dashi from kombu and katsuobushi. Freeze in cubes.', null, ['Kombu', 'Katsuobushi']],
        ],
      },
      {
        title: 'Spelt loaf and shio koji',
        cook: 'Bibimbap, japchae, kimchi jjigae with the older kimchi.',
        days: [
          [BIG, 'A spelt sandwich loaf, plus two cookie dough logs for the freezer.', null,
            ['Spelt berries', 'Active dry or instant yeast', 'Cultured butter, unsalted for baking', 'Organic cane sugar', 'Pasture-raised eggs']],
          [JAR, 'Shio koji: rice koji, salt and water.', [7, 10, 'days'], ['Koji spores (Aspergillus oryzae) or dried rice koji', 'Fine sea salt']],
          [REFILL, 'Quick pickled daikon and cucumber.', null, ['Daikon and winter radishes', 'Cucumbers', 'Unseasoned rice vinegar', 'Organic cane sugar']],
        ],
      },
      {
        title: 'Dumplings and kefir',
        cook: 'Soba with dashi, chicken marinated in shio koji.',
        days: [
          [BIG, 'Mandu or gyoza: make the filling, then fold a few trays and freeze them.', null,
            ['Pork shoulder and belly', 'Napa and green cabbage', 'Scallions', 'Fresh ginger and turmeric root', 'Garlic heads', 'Dumpling wrappers', 'Toasted sesame oil', 'Tamari']],
          [JAR, 'Milk kefir or water kefir.', [1, 2, 'days'], ['Milk kefir grains', 'Water kefir grains', 'Whole milk, grass-fed']],
          [REFILL, 'Toasted sesame dressing.', null, ['Sesame seeds, white and black', 'Toasted sesame oil', 'Unseasoned rice vinegar', 'Tamari']],
        ],
      },
      {
        title: 'Miso',
        cook: 'Dumpling night from the freezer. Take stock and restock.',
        days: [
          [REFILL, 'Soak soybeans overnight for miso. Bone broth on the stove the same day.', null,
            ['Soybeans', 'Beef marrow and knuckle bones', 'Onions (yellow, red, white)', 'Carrots']],
          [BIG, 'Cook the soybeans until soft (mostly hands-off), mash with rice koji and salt, and pack into a crock.', [6, 10, 'months'],
            ['Koji spores (Aspergillus oryzae) or dried rice koji', 'Unrefined sea salt for ferments']],
          [JAR, 'No new jar this week. Feed the starter and check your ferments.', null, []],
        ],
      },
    ],
  },
  {
    title: 'Month 3: Levant, Persia and North Africa',
    note: 'Flatbreads, spice blends and your first water-bath canning.',
    weeks: [
      {
        title: 'Flatbreads, labneh and preserved lemons',
        cook: 'Mujadara with your lentils, shakshuka, fattoush.',
        days: [
          [BIG, 'Pita and flatbreads. Set yogurt to strain overnight for labneh.', null,
            ['Unbleached bread and all-purpose flour, organic', 'Active dry or instant yeast', 'Plain yogurt', 'Extra virgin olive oil']],
          [JAR, 'Preserved lemons in salt.', [3, 4, 'weeks'], ['Lemons', 'Kosher salt']],
          [REFILL, 'Za\'atar, baharat and ras el hanout blends.', null,
            ['Sumac', 'Dried thyme', 'Sesame seeds, white and black', 'Cumin seed', 'Coriander seed', 'Black peppercorns', 'Green cardamom pods', 'True cinnamon (canela)', 'Whole cloves', 'Whole nutmeg and mace', 'Ground ginger', 'Ground turmeric']],
        ],
      },
      {
        title: 'Harissa and apple butter',
        cook: 'Harissa chicken, hummus, falafel from dried chickpeas.',
        days: [
          [REFILL, 'Harissa and tahini sauce. Cook down the apples for apple butter and chill overnight.', null,
            ['Guajillo chiles', 'Caraway seed', 'Coriander seed', 'Cumin seed', 'Garlic heads', 'Tahini', 'Lemons', 'Apples', 'Organic cane sugar', 'Cassia cinnamon']],
          [BIG, 'Your first canning day: reheat the apple butter, fill jars and process in a water bath. Follow a tested recipe.', null,
            ['Canning jars: half-pint, pint, quart, wide-mouth', 'New flat lids for every batch', 'Bottled lemon juice']],
          [JAR, 'No new jar this week. Check that every lid sealed.', null, []],
        ],
      },
      {
        title: 'Cookie day and hot sauce',
        cook: 'Fesenjan, Persian rice with barberries.',
        days: [
          [BIG, 'Cookie day: ma\'amoul with mahlab and Mexican wedding cookies. Freeze extra dough.', null,
            ['Fine semolina (durum)', 'Mahlab', 'Dates (Medjool and Deglet Noor)', 'Walnuts', 'Pecans', 'Powdered Sugar', 'Rose water', 'Cultured butter, unsalted for baking']],
          [JAR, 'Fermented hot sauce from fresh chiles.', [1, 2, 'weeks'],
            ['Fresh chiles: jalapeño, serrano, poblano', 'Thai chiles and Scotch bonnets', 'Garlic heads', 'Unrefined sea salt for ferments']],
          [REFILL, 'Advieh and dried lime powder.', null,
            ['Dried rose petals', 'Green cardamom pods', 'True cinnamon (canela)', 'Cumin seed', 'Dried black limes (loomi)']],
        ],
      },
      {
        title: 'Rough puff and a second ferment',
        cook: 'Chicken tagine with your preserved lemons. Look back: which new dishes became favorites? Pick next quarter\'s cuisines.',
        days: [
          [BIG, 'Rough puff pastry for the freezer. If you have a pressure canner, can beans or stock on another day.', null,
            ['Unbleached bread and all-purpose flour, organic', 'Cultured butter, unsalted for baking']],
          [JAR, 'A second sauerkraut, or refresh your kombucha.', [3, 6, 'weeks'], ['Cabbage', 'Unrefined sea salt for ferments', 'Caraway seed']],
          [REFILL, 'Fresh yogurt and ghee.', null, ['Whole milk, grass-fed', 'Cultured butter, unsalted for baking']],
        ],
      },
    ],
  },
];
