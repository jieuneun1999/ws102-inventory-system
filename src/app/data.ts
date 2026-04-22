import type { Product } from './store';

export const MENU_ITEMS: Product[] = [
  // Pastry
  {
    id: 'p1',
    name: 'Sansrival Cake',
    category: 'Pastry',
    price: 120,
    description: 'Classic Filipino sansrival with layers of meringue and cashew.',
    image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=500&q=80',
    ingredients: ['All-purpose flour', 'White sugar', 'Powdered sugar', 'Eggs', 'Butter', 'Milk', 'Cashew nuts']
  },
  {
    id: 'p2',
    name: 'Ensaimada',
    category: 'Pastry',
    price: 95,
    description: 'Sweet Filipino pastry roll with cheese and sugar topping.',
    image: 'https://images.unsplash.com/photo-1565958011504-98d6d0f0f3db?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=500&q=80',
    ingredients: ['All-purpose flour', 'White sugar', 'Eggs', 'Butter', 'Milk', 'Yeast']
  },
  {
    id: 'p3',
    name: 'Crinkles',
    category: 'Pastry',
    price: 85,
    description: 'Soft chocolate crackle cookies with powdered sugar coating.',
    image: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=500&q=80',
    ingredients: ['All-purpose flour', 'White sugar', 'Powdered sugar', 'Eggs', 'Cocoa powder', 'Baking powder', 'Vanilla extract']
  },

  // Beverages - Caffeinated
  {
    id: 'b1',
    name: 'Americano',
    category: 'Beverage',
    price: 150,
    description: 'Smooth espresso diluted with hot water.',
    image: 'https://images.unsplash.com/photo-1561758033-d89a0ad7b038?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=500&q=80',
    ingredients: ['Coffee beans (espresso roast)', 'Water']
  },
  {
    id: 'b2',
    name: 'Espresso',
    category: 'Beverage',
    price: 140,
    description: 'Rich and concentrated coffee shot.',
    image: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=500&q=80',
    ingredients: ['Coffee beans (espresso roast)']
  },

  // Beverages - Decaffeinated
  {
    id: 'b3',
    name: 'Hot Chocolate',
    category: 'Beverage',
    price: 150,
    description: 'Creamy hot chocolate with rich cocoa flavor.',
    image: 'https://images.unsplash.com/photo-1542990253-0d0f5be5f0ed?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=500&q=80',
    ingredients: ['Milk', 'Cocoa powder', 'Sugar']
  },
  {
    id: 'b4',
    name: 'Vanilla Milk',
    category: 'Beverage',
    price: 160,
    description: 'Smooth and creamy vanilla-flavored milk.',
    image: 'https://images.unsplash.com/photo-1577788821481-92a9b640e31d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=500&q=80',
    ingredients: ['Milk', 'Vanilla syrup', 'Sugar']
  },

  // Rice Meals
  {
    id: 'r1',
    name: 'Tapsilog',
    category: 'Rice Meal',
    price: 185,
    description: 'Marinated beef, fried egg, and garlic rice served together.',
    image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=500&q=80',
    ingredients: ['Beef', 'Soy sauce', 'Garlic', 'Cooking oil', 'Eggs', 'Rice', 'Salt', 'Pepper']
  },
  {
    id: 'r2',
    name: 'Sizzling Sisig',
    category: 'Rice Meal',
    price: 195,
    description: 'Sizzling pork with onions and chili served with rice and egg.',
    image: 'https://images.unsplash.com/photo-1631453573320-d3a6f9ff86d5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=500&q=80',
    ingredients: ['Pork', 'Onion', 'Chili', 'Soy sauce', 'Cooking oil', 'Eggs', 'Rice', 'Calamansi', 'Salt', 'Pepper', 'Mayonnaise']
  }
];

export const BEST_SELLERS = [MENU_ITEMS[1], MENU_ITEMS[4], MENU_ITEMS[6]];
export const BARISTA_CHOICE = MENU_ITEMS[0];
