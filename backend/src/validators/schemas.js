import { z } from 'zod';

export const orderSchema = z.object({
  customerName: z.string().trim().min(2).max(80),
  email: z.email(),
  address: z.string().trim().min(10).max(300),
  items: z.array(z.object({
    productId: z.coerce.number().int().positive(),
    quantity: z.coerce.number().int().min(1).max(20)
  })).min(1).max(20).refine(
    (items) => new Set(items.map((item) => item.productId)).size === items.length,
    { message: 'Each product may appear only once in an order.' }
  )
});

// Emails are compared in lower case, so "Ana.Demo@Example.com" finds the same account.
// The password length cap stops someone from sending a huge string to the hash function.
export const signInSchema = z.object({
  email: z.email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(200)
});

export const assistantQuestionSchema = z.object({
  question: z.string().trim().min(3).max(300)
});
