import { createContext, useContext, useEffect, useReducer } from "react";

const CartContext = createContext();

const initialState = JSON.parse(localStorage.getItem("cart") || "[]");

function cartReducer(state, action) {
  switch (action.type) {
    case "ADD": {
      const existing = state.find(
        (item) => item.id === action.product.id
      );

      if (existing) {
        return state.map((item) =>
          item.id === action.product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [
        ...state,
        {
          ...action.product,
          quantity: 1
        }
      ];
    }

    case "INC":
      return state.map((item) =>
        item.id === action.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      );

    case "DEC":
      return state
        .map((item) =>
          item.id === action.id
            ? { ...item, quantity: item.quantity - 1 }
            : item
        )
        .filter((item) => item.quantity > 0);

    case "REMOVE":
      return state.filter((item) => item.id !== action.id);

    default:
      return state;
  }
}

export function CartProvider({ children }) {
  const [cart, dispatch] = useReducer(cartReducer, initialState);

  useEffect(() => {
    localStorage.setItem("cart", JSON.stringify(cart));
  }, [cart]);

  const total = cart.reduce(
    (sum, item) => sum + Number(item.price) * item.quantity,
    0
  );

  return (
    <CartContext.Provider value={{ cart, dispatch, total }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}