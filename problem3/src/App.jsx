import { useEffect, useRef, useState } from "react";
import { CartProvider, useCart } from "./CartContext";
import "./App.css";

// Mock API provided for the assessment
function fetchProducts(query, page) {
  return new Promise((resolve) => {
    const delay = Math.floor(Math.random() * 700) + 100;

    setTimeout(() => {
      const allProducts = Array.from({ length: 25 }, (_, index) => ({
        id: index + 1,
        name: `Product ${index + 1}`,
        price: (index + 1) * 10,
      }));

      const filtered = allProducts.filter((product) =>
        product.name.toLowerCase().includes(query.toLowerCase())
      );

      const pageSize = 5;
      const start = (page - 1) * pageSize;

      resolve({
        products: filtered.slice(start, start + pageSize),
        total: filtered.length,
      });
    }, delay);
  });
}

function ProductSearch() {
  const { cart, dispatch, total } = useCart();

  const [query, setQuery] = useState("");
  const [products, setProducts] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const requestId = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const currentRequest = ++requestId.current;

    setLoading(true);

    fetchProducts(query, page)
      .then((result) => {
        if (currentRequest !== requestId.current) {
          return;
        }

        setProducts(result.products);
      })
      .catch(() => {
        if (currentRequest === requestId.current) {
          setProducts([]);
        }
      })
      .finally(() => {
        if (currentRequest === requestId.current) {
          setLoading(false);
        }
      });
  }, [query, page]);

  const handleSearch = (e) => {
    setQuery(e.target.value);
    setPage(1);
  };

  return (
    <div className="app">
      <h1>Product Search & Cart</h1>

      <input
        data-testid="search-input"
        type="text"
        placeholder="Search products..."
        value={query}
        onChange={handleSearch}
      />

      {loading && <p>Loading...</p>}

      {!loading && products.length === 0 && (
        <p>No results</p>
      )}

      <div className="products">
        {products.map((product) => (
          <div
            key={product.id}
            data-testid="product-item"
            className="product"
          >
            <h3>{product.name}</h3>
            <p>₹{product.price}</p>

            <button
              data-testid="add-btn"
              onClick={() =>
                dispatch({
                  type: "ADD",
                  product,
                })
              }
            >
              Add to cart
            </button>
          </div>
        ))}
      </div>

      <div className="pagination">
        <button
          disabled={page === 1}
          onClick={() => setPage((p) => p - 1)}
        >
          Previous
        </button>

        <span> Page {page} </span>

        <button
          data-testid="next-btn"
          disabled={products.length === 0}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </button>
      </div>

      <div className="cart">
        <h2>Cart</h2>

        {cart.length === 0 && <p>Cart is empty</p>}

        {cart.map((item) => (
          <div key={item.id} className="cart-item">
            <span>
              {item.name} × {item.quantity}
            </span>

            <button
              onClick={() =>
                dispatch({
                  type: "DEC",
                  id: item.id,
                })
              }
            >
              -
            </button>

            <button
              onClick={() =>
                dispatch({
                  type: "INC",
                  id: item.id,
                })
              }
            >
              +
            </button>

            <button
              onClick={() =>
                dispatch({
                  type: "REMOVE",
                  id: item.id,
                })
              }
            >
              Remove
            </button>
          </div>
        ))}

        <h3 data-testid="cart-total">
          Cart Total: ₹{total}
        </h3>
      </div>
    </div>
  );
}

function App() {
  return (
    <CartProvider>
      <ProductSearch />
    </CartProvider>
  );
}

export default App;