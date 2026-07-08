import { MenuItem } from './types';

export const MENU_ITEMS: MenuItem[] = [
  // Starters
  {
    id: 'starter-1',
    name: 'Truffle Garlic Bread',
    description: 'Freshly baked sourdough baguettes toasted with truffle-infused garlic butter, rosemary, and aged parmesan.',
    price: 8.50,
    category: 'starters',
    image: 'https://images.unsplash.com/photo-1573140247632-f8fd74997d5c?auto=format&fit=crop&q=80&w=400',
    tags: ['Vegetarian', 'Popular'],
    inStock: true,
    station: 'starters'
  },
  {
    id: 'starter-2',
    name: 'Spicy Crispy Calamari',
    description: 'Golden fried calamari rings tossed in togarashi pepper spice, served with lime wedges and sweet sriracha aioli.',
    price: 12.00,
    category: 'starters',
    image: 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?auto=format&fit=crop&q=80&w=400',
    tags: ['Spicy', 'Seafood'],
    inStock: true,
    station: 'starters'
  },
  {
    id: 'starter-3',
    name: 'Tomato Basil Bruschetta',
    description: 'Heirloom cherry tomatoes, fresh basil, garlic, and cold-pressed olive oil served on grilled garlic sourdough.',
    price: 7.50,
    category: 'starters',
    image: 'https://images.unsplash.com/photo-1572656631137-7935297eff55?auto=format&fit=crop&q=80&w=400',
    tags: ['Vegetarian', 'Vegan Friendly'],
    inStock: true,
    station: 'starters'
  },

  // Mains
  {
    id: 'main-1',
    name: 'Wagyu Beef Burger',
    description: '6oz premium Wagyu beef patty, sharp cheddar, caramelized onions, butter lettuce, and truffle mayo on a toasted brioche bun, served with crispy hand-cut fries.',
    price: 18.00,
    category: 'mains',
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=400',
    tags: ['Popular', 'Chef Special'],
    inStock: true,
    station: 'grill'
  },
  {
    id: 'main-2',
    name: 'Wild Mushroom Truffle Risotto',
    description: 'Creamy Arborio rice slow-cooked with a blend of wild chanterelle and cremini mushrooms, topped with shaved black truffle and aged parmesan.',
    price: 19.50,
    category: 'mains',
    image: 'https://images.unsplash.com/photo-1476124369491-e7addf5db371?auto=format&fit=crop&q=80&w=400',
    tags: ['Vegetarian', 'Gluten-Free'],
    inStock: true,
    station: 'grill'
  },
  {
    id: 'main-3',
    name: 'Slow-Cooked Salmon Fillet',
    description: 'Pan-seared Atlantic salmon fillet on a bed of garlic parsnip puree, buttered asparagus, topped with fresh dill lemon-butter sauce.',
    price: 22.00,
    category: 'mains',
    image: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&q=80&w=400',
    tags: ['Gluten-Free', 'Seafood'],
    inStock: true,
    station: 'grill'
  },
  {
    id: 'main-4',
    name: 'Wood-Fired Margherita Pizza',
    description: 'House-made neapolitan crust, San Marzano tomato sauce, fresh buffalo mozzarella, fragrant basil leaves, and a drizzle of extra virgin olive oil.',
    price: 14.00,
    category: 'mains',
    image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&q=80&w=400',
    tags: ['Vegetarian', 'Classic'],
    inStock: true,
    station: 'grill'
  },

  // Desserts
  {
    id: 'dessert-1',
    name: 'Lava Cake with Gelato',
    description: 'Decadent dark chocolate soufflé cake with a rich molten center, served hot with a scoop of organic vanilla bean gelato.',
    price: 9.50,
    category: 'desserts',
    image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&q=80&w=400',
    tags: ['Popular', 'Dessert'],
    inStock: true,
    station: 'dessert'
  },
  {
    id: 'dessert-2',
    name: 'Classic Tiramisu',
    description: 'Layers of espresso-soaked ladyfingers, velvety mascarpone cream, finished with a generous dusting of premium cocoa powder.',
    price: 8.00,
    category: 'desserts',
    image: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?auto=format&fit=crop&q=80&w=400',
    tags: ['Dessert'],
    inStock: true,
    station: 'dessert'
  },

  // Drinks
  {
    id: 'drink-1',
    name: 'Passionfruit Lemonade',
    description: 'Freshly squeezed lemon juice, organic cane sugar, muddled mint, and real passionfruit pulp over crushed ice.',
    price: 5.00,
    category: 'drinks',
    image: 'https://images.unsplash.com/photo-1536935338788-846bb9981813?auto=format&fit=crop&q=80&w=400',
    tags: ['Refreshing', 'Non-Alcoholic'],
    inStock: true,
    station: 'bar'
  },
  {
    id: 'drink-2',
    name: 'Iced Vanilla Latte',
    description: 'Double shot of signature espresso, cold whole milk, and house-made organic vanilla bean syrup, served over ice.',
    price: 4.50,
    category: 'drinks',
    image: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&q=80&w=400',
    tags: ['Caffeine'],
    inStock: true,
    station: 'bar'
  },
  {
    id: 'drink-3',
    name: 'Craft Cabernet Sauvignon',
    description: 'A full-bodied red wine with notes of dark blackberry, cherry, and vanilla, sourced from local vineyards.',
    price: 10.00,
    category: 'drinks',
    image: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&q=80&w=400',
    tags: ['Alcoholic', 'Wine'],
    inStock: true,
    station: 'bar'
  }
];
