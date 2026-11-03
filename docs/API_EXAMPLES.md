# ShopSmart API examples

Start the application with `npm run dev`, then send these requests through Bruno or another authorized API client.

## Health check

```http
GET http://localhost:3000/api/health
```

## Product list

```http
GET http://localhost:3000/api/products
```

## One product

```http
GET http://localhost:3000/api/products/1
```

## Create a simulated order

```http
POST http://localhost:3000/api/orders
Content-Type: application/json

{
  "customerName": "Ana Reyes",
  "email": "ana@example.com",
  "address": "Angeles City, Pampanga",
  "items": [
    { "productId": 1, "quantity": 1 },
    { "productId": 2, "quantity": 1 }
  ]
}
```

The server ignores prices from the browser and reads authoritative prices from PostgreSQL.

## Ask the assistant

```http
POST http://localhost:3000/api/assistant/questions
Content-Type: application/json

{
  "question": "Which keyboard is below ₱2,000?"
}
```

Example response:

```json
{
  "answer": "The Compact Mechanical Keyboard (₱1,850) is in stock and is below your ₱2,000 budget.",
  "recommendedProducts": [{ "id": 2, "name": "Compact Mechanical Keyboard", "price": 1850, "category": "Accessories" }],
  "sources": [{ "type": "product", "id": 2, "name": "Compact Mechanical Keyboard" }],
  "answerSource": "ai"
}
```

`answerSource` is `ai` for a checked AI draft, `rules` for the rule-based fallback (this also includes a `notice`), and `catalog` for a no match answer, where the provider is not called.
