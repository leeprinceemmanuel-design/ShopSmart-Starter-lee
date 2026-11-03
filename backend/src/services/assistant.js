// File: backend/src/services/assistant.js
// ShopSmart code decides which products qualify and checks every AI answer.
// Order of work: pick products -> ask the AI for a draft -> check the draft ->
// return it, or return the rule-based answer if anything goes wrong.
import { z } from 'zod';
import { AiProviderError, requestDraft } from './aiProvider.js';

const MAX_PRODUCTS = 3;

// ---------- 1. Reading the question ----------

// Words that say nothing about which product is wanted.
const STOP_WORDS = new Set(`the and for you your our are can could would should will which what whats that this these those
with from have has any some something anything thing item product buy get need want looking look find show recommend suggest
best good great cheap cheapest affordable budget price cost below under above over less more than within least most max maximum
min minimum around about between peso pesos php stock available sell store shop shopsmart please there how much does not may might
tell give one all only just like also use using help choose pick option`.split(/\s+/));

const AMOUNT = String.raw`(?:₱|php\s*|p(?=\d))?\s*(\d+(?:\.\d{1,2})?)(k)?(?!\d|\.\d|[a-z])(?!\s*(?:inch|inches|in\b|cm|mm|hz|gb|tb|mp|watt|hour|month))`;
const MAX_WORDS = String.raw`below|under|less than|cheaper than|up to|at most|maximum|max|within|budget of|budget is|budget|not more than|no more than|not over`;
const MIN_WORDS = String.raw`above|over|more than|at least|minimum|min`;

function toAmount(match, valueIndex = 1, kIndex = 2) {
  return Number(match[valueIndex]) * (match[kIndex] ? 1000 : 1);
}

function normalize(question) {
  return question.toLowerCase().replace(/(\d),(?=\d)/g, '$1');
}

// Finds a price range only when the words show it is a price. "1080p webcam" and
// "up to 16 inches" must not turn into a budget of 1080 or 16.
export function parsePriceLimits(question) {
  const text = normalize(question);

  const between = text.match(new RegExp(String.raw`between\s+${AMOUNT}\s+(?:and|to)\s+${AMOUNT}`));
  if (between) return { min: toAmount(between), max: toAmount(between, 3, 4) };

  const limits = { min: null, max: null };
  const maxMatch = text.match(new RegExp(String.raw`(?:${MAX_WORDS})\s+${AMOUNT}`))
    || text.match(new RegExp(String.raw`${AMOUNT}\s+(?:or less|or below|or under|and below|and under|budget)`));
  if (maxMatch) limits.max = toAmount(maxMatch);

  // "no more than" also contains "more than", so remove the max phrase before looking for a minimum.
  const rest = maxMatch ? text.replace(maxMatch[0], ' ') : text;
  const minMatch = rest.match(new RegExp(String.raw`(?:${MIN_WORDS})\s+${AMOUNT}`));
  if (minMatch) limits.min = toAmount(minMatch);

  if (limits.max === null && limits.min === null) {
    const bare = text.match(/(?:₱|php\s*|\bp(?=\d))\s*(\d+(?:\.\d{1,2})?)(k)?(?!\d)/) || text.match(/(\d+(?:\.\d{1,2})?)(k)?\s*(?:pesos?|php)\b/);
    if (bare) limits.max = toAmount(bare);
  }
  return limits;
}

export function parseBudget(question) {
  return parsePriceLimits(question).max;
}

// Words are compared whole, and "keyboards" is treated the same as "keyboard".
function toWord(word) {
  if (word === 'mice') return 'mouse';
  return word.length > 3 && word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word;
}

function textToWords(text) {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

export function getSearchTerms(question) {
  const words = textToWords(normalize(question))
    .filter((word) => word.length > 2 && !/^\d+$/.test(word) && !STOP_WORDS.has(word))
    .map(toWord)
    .filter((word) => !STOP_WORDS.has(word));
  return [...new Set(words)];
}

// ---------- 2. Choosing products ----------

function scoreProducts(products, terms) {
  return products.map((product) => {
    const words = new Set(textToWords(`${product.name} ${product.category} ${product.description}`).map(toWord));
    return { ...product, score: terms.filter((term) => words.has(term)).length };
  });
}

function isInRange(product, { min, max }) {
  const price = Number(product.price);
  return (max === null || price <= max) && (min === null || price >= min);
}

const isSellable = (product) => product.active !== false && product.stock > 0;

const byScoreThenPrice = (a, b) => b.score - a.score || Number(a.price) - Number(b.price);

// Returns only products that can really be recommended, best match first.
export function rankProducts(products, question) {
  const terms = getSearchTerms(question);
  const limits = parsePriceLimits(question);
  const ranked = scoreProducts(products, terms)
    .filter((product) => isSellable(product) && isInRange(product, limits) && (terms.length === 0 || product.score > 0))
    .sort(byScoreThenPrice);
  // Drop weak matches: a product must match at least half as many words as the best one.
  const topScore = ranked[0]?.score ?? 0;
  return ranked.filter((product) => product.score * 2 >= topScore);
}

// ---------- 3. Answers built only from catalog facts ----------

export function formatPeso(value) {
  const amount = Number(value);
  const decimals = Number.isInteger(amount) ? 0 : 2;
  return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: decimals, maximumFractionDigits: 2 })}`;
}

function buildResponse(answer, products, answerSource, notice) {
  return {
    answer,
    // Price and name always come from the database record, never from the AI.
    recommendedProducts: products.map(({ id, name, price, category }) => ({ id, name, price: Number(price), category })),
    sources: products.map(({ id, name }) => ({ type: 'product', id, name })),
    answerSource,
    ...(notice ? { notice } : {})
  };
}

// An honest "no" that says why, without recommending anything.
function buildNoMatchAnswer(products, question) {
  const terms = getSearchTerms(question);
  const limits = parsePriceLimits(question);
  const matches = terms.length === 0
    ? []
    : scoreProducts(products.filter((product) => product.active !== false), terms).filter((product) => product.score > 0).sort(byScoreThenPrice);

  const outOfStock = matches.filter((product) => product.stock <= 0 && isInRange(product, limits));
  if (matches.length > 0 && outOfStock.length === matches.length) {
    const names = outOfStock.slice(0, MAX_PRODUCTS).map((product) => product.name);
    return `${names.join(', ')} ${names.length === 1 ? 'is' : 'are'} out of stock right now, so I can't recommend ${names.length === 1 ? 'it' : 'them'}.`;
  }
  const outsideRange = matches.filter((product) => product.stock > 0 && !isInRange(product, limits));
  if (outsideRange.length > 0) {
    const closest = outsideRange[0];
    return `I could not find an in-stock product in that price range. The closest match, ${closest.name}, costs ${formatPeso(closest.price)}.`;
  }
  return 'I could not find an in-stock product matching that request in the current ShopSmart catalog.';
}

export function buildAssistantResponse(products, question) {
  const ranked = rankProducts(products, question).slice(0, MAX_PRODUCTS);
  if (ranked.length === 0) return buildResponse(buildNoMatchAnswer(products, question), [], 'catalog');
  const list = ranked.map((product) => `${product.name} (${formatPeso(product.price)})`).join(', ');
  return buildResponse(`Based on the current ShopSmart catalog, these in-stock products fit your request: ${list}.`, ranked, 'rules');
}

// ---------- 4. Checking an AI draft ----------

const draftSchema = z.object({
  answer: z.string().trim().min(1).max(600),
  productIds: z.array(z.number().int()).min(1).max(MAX_PRODUCTS)
});

// Details the catalog might not support. Each is rejected unless the recommended
// product's own facts contain it.
const CHECKED_CLAIMS = ['warranty', 'guarantee', 'guaranteed', 'free', 'shipping', 'delivery', 'discount', 'sale', 'promo', 'voucher', 'refund',
  'bluetooth', 'wireless', 'rgb', 'backlit', 'waterproof', 'ergonomic', 'gaming', 'noise-cancelling', 'noise-canceling', '4k',
  'best seller', 'best-selling', 'top rated', 'top-rated', 'popular', 'review', 'reviews',
  'logitech', 'razer', 'corsair', 'keychron', 'hyperx', 'anker', 'samsung', 'sony', 'apple'];
const WRONG_AVAILABILITY = /\b(out of stock|sold out|unavailable|not available|not in stock|no stock|pre-?order|back-?order|restock)/i;
const MONEY = /(?:₱\s*|\bphp\s*|\bp(?=\d))(\d+(?:,\d{3})*(?:\.\d+)?)|(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:pesos?|php)\b/gi;
const ANY_NUMBER = /\d+(?:,\d{3})*(?:\.\d+)?/g;

const toCents = (value) => Math.round(Number(String(value).replaceAll(',', '')) * 100);
const hasPhrase = (text, phrase) => new RegExp(String.raw`(^|[^a-z0-9])${phrase}($|[^a-z0-9])`, 'i').test(text);

function parseDraft(text) {
  let data;
  try {
    data = JSON.parse(text.trim().replace(/^```(?:json)?\s*|\s*```$/g, ''));
  } catch {
    throw new AiProviderError('ai_invalid_format');
  }
  const parsed = draftSchema.safeParse(data);
  if (!parsed.success) throw new AiProviderError('ai_invalid_format');
  return parsed.data;
}

// Each peso amount must be the price of the product it is written next to, or the customer's own budget.
function checkPrices(answer, recommended, limits) {
  const budgetCents = [limits.min, limits.max].filter((value) => value !== null).map(toCents);
  const lower = answer.toLowerCase();
  const positions = recommended
    .map((product) => ({ product, start: lower.indexOf(product.name.toLowerCase()) }))
    .sort((a, b) => a.start - b.start);

  for (const match of answer.matchAll(MONEY)) {
    const cents = toCents(match[1] ?? match[2]);
    if (budgetCents.includes(cents)) continue;
    const owner = positions.filter(({ start }) => start <= match.index).at(-1) ?? positions[0];
    if (cents !== toCents(owner.product.price)) throw new AiProviderError('ai_unsupported_price');
  }
}

// Any other number must appear in the facts of a recommended product.
function checkNumbers(answer, recommended, limits) {
  const allowed = new Set([limits.min, limits.max].filter((value) => value !== null).map(toCents));
  for (const product of recommended) {
    allowed.add(toCents(product.price));
    allowed.add(toCents(product.stock));
    for (const number of `${product.name} ${product.description}`.match(ANY_NUMBER) ?? []) allowed.add(toCents(number));
  }
  for (const number of answer.match(ANY_NUMBER) ?? []) {
    if (!allowed.has(toCents(number))) throw new AiProviderError('ai_unsupported_number');
  }
}

// Returns the checked answer and products, or throws with a reason.
export function verifyDraft(text, selected, catalog, question) {
  const draft = parseDraft(text);
  const selectedById = new Map(selected.map((product) => [product.id, product]));

  // An id the server did not select means the whole draft is rejected.
  const ids = [...new Set(draft.productIds)];
  if (ids.some((id) => !selectedById.has(id))) throw new AiProviderError('ai_unknown_product');
  const recommended = ids.map((id) => selectedById.get(id));

  const lower = draft.answer.toLowerCase();
  if (recommended.some((product) => !lower.includes(product.name.toLowerCase()))) throw new AiProviderError('ai_missing_product_name');
  const otherProducts = catalog.filter((product) => !selectedById.has(product.id));
  if (otherProducts.some((product) => lower.includes(product.name.toLowerCase()))) throw new AiProviderError('ai_unknown_product');
  if (/https?:\/\/|www\./i.test(draft.answer)) throw new AiProviderError('ai_unsupported_claim');
  if (WRONG_AVAILABILITY.test(draft.answer)) throw new AiProviderError('ai_unsupported_availability');

  const facts = recommended.map((product) => `${product.name} ${product.category} ${product.description}`).join(' ');
  if (CHECKED_CLAIMS.some((claim) => hasPhrase(draft.answer, claim) && !hasPhrase(facts, claim))) throw new AiProviderError('ai_unsupported_claim');

  const limits = parsePriceLimits(question);
  checkPrices(draft.answer, recommended, limits);
  checkNumbers(draft.answer, recommended, limits);
  return { answer: draft.answer, recommended };
}

// ---------- 5. The full flow, used by the route ----------

const FALLBACK_NOTICE = 'The AI helper could not be used for this answer, so it comes straight from the catalog.';

export async function answerQuestion(products, question, { draftProvider = requestDraft, logger = console } = {}) {
  const selected = rankProducts(products, question).slice(0, MAX_PRODUCTS);

  // Nothing qualifies: answer honestly and do not call the provider at all.
  if (selected.length === 0) return buildAssistantResponse(products, question);

  try {
    const text = await draftProvider(question, selected);
    const { answer, recommended } = verifyDraft(text, selected, products, question);
    return buildResponse(answer, recommended, 'ai');
  } catch (error) {
    // Log only the reason code. Never the question, the provider's text or the key.
    const reason = error instanceof AiProviderError ? error.reason : 'ai_unexpected_error';
    const status = error instanceof AiProviderError && error.status ? ` status=${error.status}` : '';
    logger.warn(`[assistant] using rule-based answer, reason=${reason}${status}`);
    return { ...buildAssistantResponse(products, question), notice: FALLBACK_NOTICE };
  }
}
