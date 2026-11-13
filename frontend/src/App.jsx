import { NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { useCart } from './context/CartContext.jsx';
import { useAuth } from './context/AuthContext.jsx';
import RequireSignIn from './components/RequireSignIn.jsx';
import ProductsPage from './pages/ProductsPage.jsx';
import ProductDetailsPage from './pages/ProductDetailsPage.jsx';
import CartPage from './pages/CartPage.jsx';
import CheckoutPage from './pages/CheckoutPage.jsx';
import AssistantPage from './pages/AssistantPage.jsx';
import SignInPage from './pages/SignInPage.jsx';
import OrdersPage from './pages/OrdersPage.jsx';
import OrderDetailsPage from './pages/OrderDetailsPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

export default function App() {
  const { itemCount } = useCart();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <NavLink className="brand" to="/">ShopSmart</NavLink>
        <nav aria-label="Primary navigation">
          <NavLink to="/">Products</NavLink>
          <NavLink to="/assistant">AI Assistant</NavLink>
          <NavLink to="/cart">Cart ({itemCount})</NavLink>
          {user ? (
            <>
              <NavLink to="/orders">My Orders</NavLink>
              <button type="button" className="link-button" onClick={handleSignOut}>Sign out ({user.name})</button>
            </>
          ) : (
            <NavLink to="/sign-in">Sign in</NavLink>
          )}
        </nav>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<ProductsPage />} />
          <Route path="/products/:productId" element={<ProductDetailsPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/checkout" element={<RequireSignIn><CheckoutPage /></RequireSignIn>} />
          <Route path="/assistant" element={<AssistantPage />} />
          <Route path="/sign-in" element={<SignInPage />} />
          <Route path="/orders" element={<RequireSignIn><OrdersPage /></RequireSignIn>} />
          <Route path="/orders/:orderId" element={<RequireSignIn><OrderDetailsPage /></RequireSignIn>} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>

      <footer className="site-footer">
        ShopSmart classroom starter • Simulated purchases only • Fictional test accounts only
      </footer>
    </div>
  );
}
