import type { Category, Station } from '../../shared/schemas';
import type { MenuItemInput } from '../../shared/validation';

/**
 * Builds a sample menu from TheMealDB and TheCocktailDB. Imported dishes come
 * with no allergen data (`allergens: null`), so diners are told to ask staff.
 */

interface Meal {
  idMeal: string;
  strMeal: string;
  strCategory?: string;
  strArea?: string;
  strInstructions?: string;
  strMealThumb?: string;
}
interface Drink {
  idDrink: string;
  strDrink: string;
  strInstructions?: string;
  strDrinkThumb?: string;
}

const MEAL_SEARCHES: { term: string; category: Category; station: Station }[] = [
  { term: 'salad', category: 'starters', station: 'pantry' },
  { term: 'burger', category: 'mains', station: 'grill' },
  { term: 'pasta', category: 'mains', station: 'grill' },
  { term: 'cake', category: 'desserts', station: 'pastry' },
];
const DRINK_SEARCHES = ['mojito', 'margarita', 'martini'];

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`${url} responded ${res.status}`);
  return (await res.json()) as T;
}

const firstSentence = (text: string | undefined, fallback: string) => {
  const s = text?.replace(/\s+/g, ' ').split('.')[0]?.trim();
  return s ? `${s}.`.slice(0, 300) : fallback;
};

/** Stable pseudo-price derived from the source id, rounded to 50¢. */
const priceFromId = (id: string, min: number, spread: number) => min + ((parseInt(id, 10) || 0) % spread) * 50;

export async function fetchSampleMenu(): Promise<MenuItemInput[]> {
  const items: MenuItemInput[] = [];

  await Promise.all(
    MEAL_SEARCHES.map(async ({ term, category, station }) => {
      try {
        const data = await fetchJson<{ meals: Meal[] | null }>(`https://www.themealdb.com/api/json/v1/1/search.php?s=${term}`);
        for (const meal of (data.meals ?? []).slice(0, 3)) {
          items.push({
            name: meal.strMeal,
            description: firstSentence(meal.strInstructions, `${meal.strArea ?? 'House'} speciality.`),
            priceCents: priceFromId(meal.idMeal, category === 'desserts' ? 650 : 1100, 20),
            category,
            station,
            imageUrl: meal.strMealThumb ?? null,
            dietary: meal.strCategory?.toLowerCase() === 'vegetarian' ? ['vegetarian'] : [],
            allergens: null,
          });
        }
      } catch (err) {
        console.warn(`[menu-import] meal search "${term}" failed`, err);
      }
    }),
  );

  await Promise.all(
    DRINK_SEARCHES.map(async (term) => {
      try {
        const data = await fetchJson<{ drinks: Drink[] | null }>(
          `https://www.thecocktaildb.com/api/json/v1/1/search.php?s=${term}`,
        );
        for (const drink of (data.drinks ?? []).slice(0, 2)) {
          items.push({
            name: drink.strDrink,
            description: firstSentence(drink.strInstructions, 'Hand-built at the bar.'),
            priceCents: priceFromId(drink.idDrink, 800, 12),
            category: 'drinks',
            station: 'bar',
            imageUrl: drink.strDrinkThumb ?? null,
            dietary: [],
            allergens: null,
          });
        }
      } catch (err) {
        console.warn(`[menu-import] drink search "${term}" failed`, err);
      }
    }),
  );

  return items;
}
