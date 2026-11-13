# ShopSmart API examples

Start the application with `npm run dev`, then send these requests through Bruno or another authorized API client.

## Health check

```http
GET http://localhost:3000/api/health
```

## Readiness (also checks PostgreSQL)

```http
GET http://localhost:3000/api/health/ready
```

`200 {"status":"ok","database":"ok"}`, or `503 {"status":"error","database":"unreachable"}` when the database cannot be reached.

## Sign in (fictional test customer)

```http
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{
  "email": "ana.demo@example.com",
  "password": "<demo password printed by npm run users:demo>"
}
```

`200 {"user":{"id":1,"name":"Ana Demo","email":"ana.demo@example.com"}}` plus a `Set-Cookie: shopsmart_session=…; Path=/api; HttpOnly; SameSite=Lax` header. A wrong email or password gets `401 INVALID_CREDENTIALS` (same message for both). Bruno keeps the cookie for the next requests.

```http
GET http://localhost:3000/api/auth/me
POST http://localhost:3000/api/auth/logout
```

## My orders (sign-in required)

```http
GET http://localhost:3000/api/orders
GET http://localhost:3000/api/orders/12
```

- No cookie → `401 SIGN_IN_REQUIRED`
- Your own order → `200`
- Someone else's order → `404 ORDER_NOT_FOUND` (the API does not even confirm that it exists)

`POST /api/orders` (below) also requires sign-in now. The owner is taken from the session, never from the body.

## Product list

```http
GET http://localhost:3000/api/products
```

## Search products

Matches the product name or description, ignoring upper and lower case.

```http
GET http://localhost:3000/api/products?search=privacy
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

Common error replies:

| Status | Code | When |
| --- | --- | --- |
| 400 | `INVALID_JSON` | The body is not valid JSON. The body is never logged or echoed back. |
| 409 | `INSUFFICIENT_STOCK` | A quantity is above the current stock. Nothing is saved. |
| 422 | `INVALID_ORDER` | A field is missing or wrong; `details.fieldErrors` names the fields. |
| 422 | `PRODUCT_UNAVAILABLE` | A product does not exist or is inactive. |

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
