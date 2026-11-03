import { useState } from 'react';
import { Link } from 'react-router-dom';
import StatusMessage from '../components/StatusMessage.jsx';
import { api } from '../services/api.js';

export default function AssistantPage() {
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function ask(event) {
    event.preventDefault(); setError(''); setResult(null); setLoading(true);
    try { setResult(await api.askAssistant(question)); }
    // Errors from the server have a status and a readable message. Anything else means no answer arrived.
    catch (caught) { setError(caught.status ? caught.message : 'ShopSmart could not be reached. Please check your connection and try again.'); }
    finally { setLoading(false); }
  }

  return (
    <section className="assistant-layout">
      <div>
        <p className="eyebrow">PRODUCT ASSISTANT</p>
        <h1>Find a product</h1>
        <p>Ask about products in the ShopSmart catalog. Prices and stock in the answer are checked against the current catalog.</p>
        <form onSubmit={ask}>
          <label>Your question<textarea value={question} onChange={(event) => setQuestion(event.target.value)} minLength="3" maxLength="300" placeholder="Which keyboard is below ₱2,000?" required /></label>
          <button disabled={loading}>{loading ? 'Searching…' : 'Ask ShopSmart'}</button>
        </form>
      </div>
      <div className="assistant-answer" aria-busy={loading}>
        <h2>Assistant response</h2>
        <StatusMessage type="error">{error}</StatusMessage>
        {loading && <StatusMessage>Checking the catalog and preparing your answer…</StatusMessage>}
        {!result && !error && !loading && <p>Your answer will appear here.</p>}
        {result && <>
          <StatusMessage>{result.notice}</StatusMessage>
          <p>{result.answer}</p>
          <div className="recommendations">
            {result.recommendedProducts.map((product) => (
              <Link key={product.id} to={`/products/${product.id}`}>{product.name} — ₱{Number(product.price).toLocaleString('en-PH')}</Link>
            ))}
          </div>
          {result.sources.length > 0 && (
            <div className="answer-sources">
              <h3>Sources</h3>
              <ul>
                {result.sources.map((source) => (
                  <li key={source.id}><Link to={`/products/${source.id}`}>Catalog product #{source.id}: {source.name}</Link></li>
                ))}
              </ul>
            </div>
          )}
        </>}
      </div>
    </section>
  );
}
