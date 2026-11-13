// File: frontend/src/pages/OrdersPage.jsx
// "My Orders": the API only returns orders owned by the signed-in customer.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import StatusMessage from '../components/StatusMessage.jsx';
import { api } from '../services/api.js';
import { formatPeso } from '../utils/format.js';

export default function OrdersPage() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true; // ignore the answer if the shopper already left the page
    api.getMyOrders()
      .then((data) => { if (active) setOrders(data.orders); })
      .catch((caught) => { if (active) { setError(caught.message); setOrders([]); } });
    return () => { active = false; };
  }, []);

  return (
    <section>
      <div className="page-heading"><p className="eyebrow">ACCOUNT</p><h1>My orders</h1></div>
      <StatusMessage type="error">{error}</StatusMessage>
      {orders === null && <StatusMessage>Loading your orders…</StatusMessage>}
      {orders?.length === 0 && !error && (
        <div className="empty-state"><h2>No orders yet</h2><Link className="button" to="/">Browse products</Link></div>
      )}
      {orders?.length > 0 && (
        <div className="cart-items">
          {orders.map((order) => (
            <Link key={order.id} className="order-row" to={`/orders/${order.id}`}>
              <strong>Order #{order.id}</strong>
              <span>{new Date(order.createdAt).toLocaleString('en-PH')}</span>
              <span>{order.items.length} item(s)</span>
              <strong>{formatPeso(order.total)}</strong>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
