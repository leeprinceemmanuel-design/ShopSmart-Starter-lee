// frontend/src/pages/CartPage.jsx
import { Link } from 'react-router-dom';
import StatusMessage from '../components/StatusMessage.jsx';
import { useCart } from '../context/CartContext.jsx';

// Small inline styles so the minus button, number box and plus button sit in one row.
const stepperStyle = { display: 'flex', alignItems: 'center', gap: '0.5rem' };
const stepButtonStyle = { padding: '0.25rem 0.75rem', minWidth: '2.25rem' };
const quantityInputStyle = { width: '4.5rem', textAlign: 'center' };

export default function CartPage() {
  const { cart, itemCount, total, cartMessage, setQuantity, removeFromCart } = useCart();

  return (
    <section>
      <div className="page-heading"><p className="eyebrow">YOUR ORDER</p><h1>Shopping cart</h1></div>
      <StatusMessage type={cartMessage.startsWith('Only') ? 'error' : 'info'}>{cartMessage}</StatusMessage>
      {cart.length === 0 ? (
        <div className="empty-state"><h2>Your cart is empty</h2><Link className="button" to="/">Browse products</Link></div>
      ) : (
        <div className="cart-layout">
          <div className="cart-items">
            {cart.map((item) => {
              // These two checks decide when a button is switched off.
              const atMinimum = item.quantity <= 1;        // cannot go below 1
              const atStockLimit = item.quantity >= item.stock; // cannot go above stock
              const inputId = `quantity-${item.productId}`;

              return (
                <article className="cart-item" key={item.productId}>
                  <div><h2>{item.name}</h2><p>₱{item.price.toLocaleString('en-PH')} each</p></div>
                  <div className="quantity-control">
                    <label htmlFor={inputId}>Quantity</label>
                    <div style={stepperStyle}>
                      {/* Minus: asks the cart for "current quantity minus 1".
                          It uses the same setQuantity as the number box. */}
                      <button
                        type="button"
                        style={stepButtonStyle}
                        aria-label={`Remove one ${item.name}`}
                        disabled={atMinimum}
                        onClick={() => setQuantity(item.productId, item.quantity - 1)}
                      >
                        −
                      </button>
                      <input
                        id={inputId}
                        type="number"
                        min="1"
                        max={item.stock}
                        style={quantityInputStyle}
                        value={item.quantity}
                        onChange={(event) => setQuantity(item.productId, Number(event.target.value))}
                      />
                      {/* Plus: asks the cart for "current quantity plus 1". */}
                      <button
                        type="button"
                        style={stepButtonStyle}
                        aria-label={`Add one ${item.name}`}
                        disabled={atStockLimit}
                        onClick={() => setQuantity(item.productId, item.quantity + 1)}
                      >
                        +
                      </button>
                    </div>
                    {/* Tells the shopper WHY the plus button is switched off. */}
                    {atStockLimit && <small>Stock limit reached ({item.stock} available).</small>}
                  </div>
                  <strong>₱{(item.price * item.quantity).toLocaleString('en-PH')}</strong>
                  <button className="danger" onClick={() => removeFromCart(item.productId)}>Remove</button>
                </article>
              );
            })}
          </div>
          <aside className="summary">
            <h2>Order summary</h2>
            <p><span>Items</span><strong>{itemCount}</strong></p>
            <p className="summary-total"><span>Total</span><strong>₱{total.toLocaleString('en-PH')}</strong></p>
            <Link className="button full" to="/checkout">Proceed to checkout</Link>
          </aside>
        </div>
      )}
    </section>
  );
}
