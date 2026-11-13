// File: backend/src/routes/orders.js
// Every route here needs a signed-in customer (requireUser, added in app.js).
// POST /api/orders      place a simulated order owned by the signed-in customer
// GET  /api/orders      list MY orders only
// GET  /api/orders/:id  one order, only if it is MINE (otherwise 404)
import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { orderSchema } from '../validators/schemas.js';
const router = Router();

// Prisma returns money as Decimal objects; the browser needs plain numbers.
function toOrderJson(order) {
  return {
    ...order,
    total: Number(order.total),
    items: (order.items ?? []).map((item) => ({ ...item, unitPrice: Number(item.unitPrice) }))
  };
}

// The ownership rule in one place: an order is found only when BOTH the id and the owner match.
// Another customer's order therefore looks exactly like a missing order.
export function ownedOrderWhere(orderId, userId) {
  return { id: orderId, userId };
}

router.post('/', async (request, response, next) => {
  try {
    const parsed = orderSchema.safeParse(request.body);
    if (!parsed.success) return response.status(422).json({ error: { code: 'INVALID_ORDER', message: 'Check the customer and cart information.', details: parsed.error.flatten() } });

    const productIds = [...new Set(parsed.data.items.map((item) => item.productId))];
    const products = await prisma.product.findMany({ where: { id: { in: productIds }, active: true } });
    if (products.length !== productIds.length) return response.status(422).json({ error: { code: 'PRODUCT_UNAVAILABLE', message: 'One or more products are unavailable.' } });

    const productMap = new Map(products.map((product) => [product.id, product]));
    const normalizedItems = parsed.data.items.map((item) => ({ ...item, product: productMap.get(item.productId) }));
    const unavailable = normalizedItems.find((item) => item.quantity > item.product.stock);
    if (unavailable) return response.status(409).json({ error: { code: 'INSUFFICIENT_STOCK', message: `Only ${unavailable.product.stock} unit(s) of ${unavailable.product.name} are available.` } });

    const total = normalizedItems.reduce((sum, item) => sum.plus(new Prisma.Decimal(item.product.price).times(item.quantity)), new Prisma.Decimal(0));
    const order = await prisma.$transaction(async (transaction) => {
      for (const item of normalizedItems) {
        const updated = await transaction.product.updateMany({
          where: { id: item.productId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } }
        });
        if (updated.count !== 1) throw Object.assign(new Error('Stock changed while placing the order.'), { status: 409, code: 'STOCK_CHANGED' });
      }
      return transaction.order.create({
        data: {
          userId: request.user.id, // the owner comes from the session, never from the request body
          customerName: parsed.data.customerName, email: parsed.data.email, address: parsed.data.address, total,
          items: { create: normalizedItems.map((item) => ({ productId: item.productId, quantity: item.quantity, unitPrice: item.product.price })) }
        },
        include: { items: true }
      });
    });
    response.status(201).json(toOrderJson(order));
  } catch (error) { next(error); }
});

router.get('/', async (request, response, next) => {
  try {
    const orders = await prisma.order.findMany({
      where: { userId: request.user.id },
      include: { items: { include: { product: { select: { name: true, emoji: true } } } } },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    response.json({ orders: orders.map(toOrderJson) });
  } catch (error) { next(error); }
});

router.get('/:id', async (request, response, next) => {
  try {
    const id = Number(request.params.id);
    if (!Number.isInteger(id) || id < 1) return response.status(400).json({ error: { code: 'INVALID_ORDER_ID', message: 'Order ID must be a positive integer.' } });
    const order = await prisma.order.findFirst({
      where: ownedOrderWhere(id, request.user.id),
      include: { items: { include: { product: { select: { name: true, emoji: true } } } } }
    });
    // 404, not 403: we do not even confirm that someone else's order number exists.
    if (!order) return response.status(404).json({ error: { code: 'ORDER_NOT_FOUND', message: 'Order could not be found.' } });
    response.json(toOrderJson(order));
  } catch (error) { next(error); }
});

export default router;
