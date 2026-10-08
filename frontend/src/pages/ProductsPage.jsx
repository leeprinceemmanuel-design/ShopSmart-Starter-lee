// frontend/src/pages/ProductsPage.jsx
import { useEffect, useMemo, useState } from 'react';
import ProductCard from '../components/ProductCard.jsx';
import StatusMessage from '../components/StatusMessage.jsx';
import { useCart } from '../context/CartContext.jsx';
import { api } from '../services/api.js';

// The choices shown in the Sort dropdown.
// "value" is what we keep in state, "label" is the text the shopper reads.
const SORT_OPTIONS = [
  { value: 'default', label: 'Default' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'name-asc', label: 'Name: A to Z' }
];

// Returns the list in the order the shopper picked.
// It never changes the list it receives: it sorts a COPY ([...list]).
// This matters because .sort() rearranges the array it is called on.
function sortProducts(list, sort) {
  // Default = leave the order exactly as the catalog gave it.
  if (sort === 'default') return list;

  const copy = [...list];

  // Number() is used because the price can arrive from the backend as text
  // like "1299.00". Comparing text would put "1000" before "999".
  if (sort === 'price-asc') return copy.sort((a, b) => Number(a.price) - Number(b.price));
  if (sort === 'price-desc') return copy.sort((a, b) => Number(b.price) - Number(a.price));

  // localeCompare compares words alphabetically, ignoring upper/lower case here.
  if (sort === 'name-asc') {
    return copy.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
  }

  return list;
}

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  // The sort choice lives here, beside search and category.
  const [sort, setSort] = useState('default');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { addToCart, cartMessage } = useCart();

  useEffect(() => {
    let active = true;
    api.getProducts()
      .then((data) => active && setProducts(data.products))
      .catch((caught) => active && setError(caught.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const categories = useMemo(
    () => ['All', ...new Set(products.map((product) => product.category))],
    [products]
  );

  // Clean the search text once: remove extra spaces and make it lower case.
  // Before, this was done again for every product inside filter.
  const query = search.trim().toLowerCase();

  // Step 1: FILTER. Keep only the products that match the search and category.
  // filter() gives back a new array, so "products" is not changed.
  const filteredProducts = products.filter((product) => {
    // A product matches if the query is in its name OR its description.
    // Both are lower-cased so "Privacy" and "privacy" match the same way.
    const matchesSearch =
      product.name.toLowerCase().includes(query) ||
      product.description.toLowerCase().includes(query);
    const matchesCategory = category === 'All' || product.category === category;
    // Show the product only if BOTH the search and the category match
    return matchesSearch && matchesCategory;
  });

  // Step 2: SORT. Put the filtered products in the chosen order.
  // Sorting comes after filtering, so only matching products are sorted and shown.
  const visibleProducts = sortProducts(filteredProducts, sort);

  return (
    <section>
      <div className="hero">
        <div>
          <p className="eyebrow">BSIT FULL-STACK PROJECT</p>
          <h1>Technology for study, work and play</h1>
          <p>Browse the starter catalog, build a cart and complete a simulated order.</p>
        </div>
      </div>

      <div className="toolbar">
        <label>
          <span>Search products</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Try keyboard" />
        </label>
        <label>
          <span>Category</span>
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            {categories.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label>
          <span>Sort</span>
          <select value={sort} onChange={(event) => setSort(event.target.value)}>
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>

      <StatusMessage>{cartMessage}</StatusMessage>
      {loading && <StatusMessage>Loading products…</StatusMessage>}
      {error && <StatusMessage type="error">{error} Make sure the backend is running.</StatusMessage>}
      {!loading && !error && visibleProducts.length === 0 && <StatusMessage>No products match your filters.</StatusMessage>}

      <div className="product-grid">
        {visibleProducts.map((product) => (
          <ProductCard key={product.id} product={product} onAddToCart={addToCart} />
        ))}
      </div>
    </section>
  );
}
