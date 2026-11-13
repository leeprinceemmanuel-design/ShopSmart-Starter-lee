// File: frontend/src/pages/OrderDetailsPage.jsx
// One order. If it belongs to someone else, the API answers 404 and we show "not found".
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import StatusMessage from '../components/StatusMessage.jsx';
import { api } from '../services/api.js';
import { formatPeso } from '../utils/format.js';

export default function OrderDetailsPage() {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setOrder(null);
    setError('');
    api.getMyOrder(orderId)
      .then((data) => { if (active) setOrder(data); })
      .catch((caught) => { if (active) setError(caught.status === 404 ? 'This order could not be found in your account.' : caught.message); });
    return () => { active = false; };
  }, [orderId]);

  if (error) return <section><StatusMessage type="error">{error}</StatusMessage><Link className="button secondary" to="/orders">Back to my orders</Link></section>;
  if (!order) return <StatusMessage>Loading order…</StatusMessage>;

  return (
    <section className="narrow-page">
      <div className="summary">
        <p className="eyebrow">SIMULATED ORDER</p>
        <h1>Order #{order.id}</h1>
        <p><span>Placed</span><span>{new Date(order.createdAt).toLocaleString('en-PH')}</span></p>
        <p><span>Status</span><span>{order.status}</span></p>
        {order.items.map((item) => (
          <p key={item.id}><span>{item.product?.emoji} {item.product?.name ?? `Product #${item.productId}`} × {item.quantity}</span><strong>{formatPeso(item.unitPrice * item.quantity)}</strong></p>
        ))}
        <p className="summary-total"><span>Total</span><strong>{formatPeso(order.total)}</strong></p>
      </div>
      <Link className="button secondary" to="/orders">Back to my orders</Link>
    </section>
  );
}
