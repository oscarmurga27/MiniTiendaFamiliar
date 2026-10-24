'use strict';

const PAGE_SIZE = 10;
const STORAGE_KEY = 'catalogo_whatsapp_carrito_v1';
const MAX_QUANTITY = 99;
const state = {
  all: [], filtered: [], visible: PAGE_SIZE,
  store: null, cart: new Map(), notes: ''
};

const els = {
  grid: document.querySelector('#productGrid'),
  search: document.querySelector('#searchInput'),
  count: document.querySelector('#resultsCount'),
  total: document.querySelector('#productCount'),
  empty: document.querySelector('#emptyState'),
  clear: document.querySelector('#clearSearch'),
  loader: document.querySelector('#loader'),
  sentinel: document.querySelector('#scrollSentinel'),
  cartToggle: document.querySelector('#cartToggle'),
  cartFloat: document.querySelector('#cartFloat'),
  cartCount: document.querySelector('#cartCount'),
  cartFloatCount: document.querySelector('#cartFloatCount'),
  cartLayer: document.querySelector('#cartLayer'),
  cartPanel: document.querySelector('#cartDrawer'),
  closeCart: document.querySelector('#closeCart'),
  cartItems: document.querySelector('#cartItems'),
  cartEmpty: document.querySelector('#cartEmpty'),
  cartTotals: document.querySelector('#cartTotals'),
  cartSubtotalLabel: document.querySelector('#cartSubtotalLabel'),
  cartSubtotal: document.querySelector('#cartSubtotal'),
  cartWarning: document.querySelector('#cartWarning'),
  clearCart: document.querySelector('#clearCart'),
  sendOrder: document.querySelector('#sendOrder'),
  cartNotes: document.querySelector('#cartNotes'),
  cartLive: document.querySelector('#cartLive')
};

const escapeHTML = value => String(value ?? '').replace(/[&<>'"]/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
}[character]));
const normalize = value => String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

// Un precio 0, vacío o inválido se considera sin precio publicado, NO gratuito.
function priceInCents(value) {
  if (value === null || value === undefined || value === '') return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) : null;
}

function moneyFromCents(cents) {
  try {
    return new Intl.NumberFormat(state.store?.locale || 'es-GT', {
      style: 'currency', currency: state.store?.currency || 'GTQ',
      minimumFractionDigits: 2, maximumFractionDigits: 2
    }).format(cents / 100);
  } catch (_) {
    return `Q${(cents / 100).toFixed(2)}`;
  }
}

function productId(product) { return product._cartId; }

function card(product, index) {
  const id = productId(product);
  const price = priceInCents(product.price);
  return `<article class="card" style="animation-delay:${(index % PAGE_SIZE) * 45}ms">
    <div class="image-wrap">
      <img src="${escapeHTML(product.image)}" alt="${escapeHTML(product.name)}" loading="lazy" width="720" height="900">
      ${product.badge ? `<span class="badge">${escapeHTML(product.badge)}</span>` : ''}
    </div>
    <div class="card-info">
      <div class="card-top"><h2>${escapeHTML(product.name)}</h2>${price !== null ? `<span class="price">${moneyFromCents(price)}</span>` : '<span class="price price-empty" aria-hidden="true">&nbsp;</span>'}</div>
      <p class="category">${escapeHTML(product.category)}</p>
      <p class="card-desc">${escapeHTML(product.description)}</p>
      <button type="button" class="add-to-cart" data-action="add" data-id="${id}" aria-label="Agregar ${escapeHTML(product.name)} al carrito">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
        Agregar al carrito
      </button>
    </div>
  </article>`;
}

function render() {
  const shown = state.filtered.slice(0, state.visible);
  els.grid.innerHTML = shown.map(card).join('');
  els.empty.hidden = state.filtered.length > 0;
  els.count.textContent = state.filtered.length === state.all.length
    ? `${state.all.length} productos`
    : `${state.filtered.length} resultado${state.filtered.length === 1 ? '' : 's'}`;
  els.loader.hidden = shown.length >= state.filtered.length;
}

function search() {
  const query = normalize(els.search.value.trim());
  state.filtered = query
    ? state.all.filter(p => normalize(`${p.name} ${p.category} ${p.description}`).includes(query))
    : [...state.all];
  state.visible = query ? state.filtered.length : PAGE_SIZE;
  render();
}

function persistCart() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...state.cart.entries()]));
  } catch (_) { /* En navegación privada el almacenamiento puede estar bloqueado. */ }
}

function restoreCart() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(saved)) return;
    const validIds = new Set(state.all.map(productId));
    for (const entry of saved) {
      if (!Array.isArray(entry) || entry.length !== 2) continue;
      const [id, qty] = entry;
      if (validIds.has(id) && Number.isInteger(qty) && qty > 0) {
        state.cart.set(id, Math.min(qty, MAX_QUANTITY));
      }
    }
  } catch (_) { /* Datos antiguos o ilegibles: empezar vacío. */ }
}

function getCartRows() {
  const byId = new Map(state.all.map(product => [productId(product), product]));
  return [...state.cart.entries()].map(([id, quantity]) => ({
    id, quantity, product: byId.get(id)
  })).filter(row => row.product);
}

function cartItem(row) {
  const price = priceInCents(row.product.price);
  return `<li class="cart-item">
    <img src="${escapeHTML(row.product.image)}" alt="" loading="lazy" width="78" height="88">
    <div class="cart-item-detail">
      <h3>${escapeHTML(row.product.name)}</h3>
      <p class="cart-item-price">${price === null ? 'Precio por confirmar' : `${moneyFromCents(price)} c/u`}</p>
      <div class="cart-item-actions">
        <div class="quantity-control" aria-label="Cantidad de ${escapeHTML(row.product.name)}">
          <button type="button" data-action="decrease" data-id="${row.id}" aria-label="Quitar una unidad de ${escapeHTML(row.product.name)}">−</button>
          <span aria-label="Cantidad: ${row.quantity}">${row.quantity}</span>
          <button type="button" data-action="increase" data-id="${row.id}" ${row.quantity >= MAX_QUANTITY ? 'disabled' : ''} aria-label="Agregar una unidad de ${escapeHTML(row.product.name)}">+</button>
        </div>
        <button type="button" class="remove-item" data-action="remove" data-id="${row.id}" aria-label="Eliminar ${escapeHTML(row.product.name)}">Eliminar</button>
      </div>
    </div>
    ${price === null ? '' : `<strong class="cart-item-sum">${moneyFromCents(price * row.quantity)}</strong>`}
  </li>`;
}

function createOrderMessage(rows, subtotal, unpriced) {
  const lines = [
    `Hola, quiero hacer un pedido${state.store?.name ? ` en ${state.store.name}` : ''}:`,
    '', '*Productos:*'
  ];
  rows.forEach((row, index) => {
    const price = priceInCents(row.product.price);
    const itemTotal = price === null ? 'precio por confirmar' : moneyFromCents(price * row.quantity);
    lines.push(`${index + 1}. ${row.quantity} x ${row.product.name} — ${itemTotal}`);
  });
  lines.push('');
  if (unpriced) {
    if (subtotal > 0) lines.push(`Subtotal de productos con precio: ${moneyFromCents(subtotal)}`);
    lines.push('El total final queda por confirmar porque algunos productos no tienen precio publicado.');
  } else {
    lines.push(`*Total: ${moneyFromCents(subtotal)}*`);
  }
  if (state.notes.trim()) lines.push('', `*Indicaciones:* ${state.notes.trim()}`);
  lines.push('', '¿Me confirman disponibilidad y total final?');
  return lines.join('\n');
}

function whatsappNumber() {
  return String(state.store?.whatsapp || '').replace(/\D/g, '');
}

function updateCheckoutLink(rows, subtotal, unpriced) {
  const number = whatsappNumber();
  if (!rows.length || !number) {
    els.sendOrder.removeAttribute('href');
    els.sendOrder.setAttribute('aria-disabled', 'true');
    els.sendOrder.title = !number ? 'Falta configurar el WhatsApp en data.json' : 'Agrega al menos un producto';
    return;
  }
  els.sendOrder.href = `https://wa.me/${number}?text=${encodeURIComponent(createOrderMessage(rows, subtotal, unpriced))}`;
  els.sendOrder.setAttribute('aria-disabled', 'false');
  els.sendOrder.removeAttribute('title');
}

function renderCart() {
  const rows = getCartRows();
  const quantity = rows.reduce((sum, row) => sum + row.quantity, 0);
  const subtotal = rows.reduce((sum, row) => sum + (priceInCents(row.product.price) || 0) * row.quantity, 0);
  const unpriced = rows.some(row => priceInCents(row.product.price) === null);

  els.cartCount.textContent = String(quantity);
  els.cartFloatCount.textContent = String(quantity);
  els.cartToggle.setAttribute('aria-label', `Abrir carrito, ${quantity} productos`);
  els.cartFloat.setAttribute('aria-label', `Abrir carrito, ${quantity} productos`);
  els.cartEmpty.hidden = rows.length > 0;
  els.cartItems.hidden = rows.length === 0;
  els.cartItems.innerHTML = rows.map(cartItem).join('');
  els.clearCart.hidden = rows.length === 0;
  els.cartTotals.hidden = rows.length === 0;
  els.cartSubtotalLabel.textContent = unpriced
    ? (subtotal > 0 ? 'Subtotal parcial' : 'Total por confirmar')
    : 'Total';
  els.cartSubtotal.textContent = subtotal > 0 || !unpriced ? moneyFromCents(subtotal) : '—';
  els.cartWarning.hidden = !unpriced;
  updateCheckoutLink(rows, subtotal, unpriced);
}

function changeQuantity(id, delta) {
  if (!state.all.some(product => productId(product) === id)) return;
  const oldQuantity = state.cart.get(id) || 0;
  const next = Math.max(0, Math.min(MAX_QUANTITY, oldQuantity + delta));
  if (!next) state.cart.delete(id);
  else state.cart.set(id, next);
  persistCart();
  renderCart();
}

let lastCartTrigger = null;
let closingTimeout = null;

function openCart(trigger) {
  clearTimeout(closingTimeout);
  lastCartTrigger = trigger || document.activeElement;
  els.cartLayer.hidden = false;
  document.body.classList.add('cart-open');
  els.cartToggle.setAttribute('aria-expanded', 'true');
  els.cartFloat.setAttribute('aria-expanded', 'true');
  requestAnimationFrame(() => els.cartLayer.classList.add('is-open'));
  els.closeCart.focus();
}

function closeCart() {
  els.cartLayer.classList.remove('is-open');
  document.body.classList.remove('cart-open');
  els.cartToggle.setAttribute('aria-expanded', 'false');
  els.cartFloat.setAttribute('aria-expanded', 'false');
  closingTimeout = setTimeout(() => { els.cartLayer.hidden = true; }, 240);
  if (lastCartTrigger?.isConnected) lastCartTrigger.focus();
}

function applyStore(store) {
  state.store = store;
  document.title = `${store.name || 'Catálogo'} — Pedidos por WhatsApp`;
  document.querySelector('#brand').textContent = store.name || 'Catálogo';
  document.querySelector('#footerBrand').textContent = store.name || 'Catálogo';
  document.querySelector('#eyebrow').textContent = store.eyebrow || '';
  document.querySelector('#headline').textContent = store.headline || 'Nuestro catálogo';
  document.querySelector('#description').textContent = store.description || '';
  const number = whatsappNumber();
  const direct = document.querySelector('#whatsapp');
  if (number) {
    direct.href = `https://wa.me/${number}?text=${encodeURIComponent(store.whatsappMessage || 'Hola, quisiera más información.')}`;
  } else {
    direct.hidden = true;
  }
}

async function init() {
  try {
    const response = await fetch('data.json');
    if (!response.ok) throw new Error('No se pudo abrir el catálogo');
    const data = await response.json();
    if (!Array.isArray(data.products) || !data.store) throw new Error('Formato de catálogo inválido');
    applyStore(data.store);
    state.all = data.products.map((product, index) => ({ ...product, _cartId: `p${index}` }));
    state.filtered = [...state.all];
    els.total.textContent = `${state.all.length} piezas seleccionadas`;
    restoreCart();
    render();
    renderCart();
  } catch (error) {
    els.loader.hidden = true;
    els.grid.innerHTML = '<p>No fue posible cargar el catálogo. Verifica que data.json esté en la misma carpeta.</p>';
    console.error('Error del catálogo:', error);
  }
}

els.search.addEventListener('input', search);
els.clear.addEventListener('click', () => {
  els.search.value = '';
  search();
  els.search.focus();
});
els.grid.addEventListener('click', event => {
  const button = event.target.closest('button[data-action="add"]');
  if (!button) return;
  changeQuantity(button.dataset.id, 1);
  const name = state.all.find(product => productId(product) === button.dataset.id)?.name || 'Producto';
  els.cartLive.textContent = `${name} agregado al carrito`;
  button.classList.add('added');
  button.innerHTML = '✓ Agregado';
  setTimeout(() => {
    if (button.isConnected) {
      button.classList.remove('added');
      button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg> Agregar al carrito';
    }
  }, 1000);
});
els.cartItems.addEventListener('click', event => {
  const button = event.target.closest('button[data-action][data-id]');
  if (!button) return;
  const { action, id } = button.dataset;
  if (action === 'increase') changeQuantity(id, 1);
  if (action === 'decrease') changeQuantity(id, -1);
  if (action === 'remove') {
    state.cart.delete(id);
    persistCart();
    renderCart();
  }
});
els.cartToggle.addEventListener('click', () => openCart(els.cartToggle));
els.cartFloat.addEventListener('click', () => openCart(els.cartFloat));
els.closeCart.addEventListener('click', closeCart);
els.cartLayer.querySelector('.cart-backdrop').addEventListener('click', closeCart);
els.clearCart.addEventListener('click', () => {
  if (!window.confirm('¿Vaciar todos los productos del carrito?')) return;
  state.cart.clear();
  persistCart();
  renderCart();
});
els.sendOrder.addEventListener('click', () => {
  if (els.sendOrder.getAttribute('aria-disabled') === 'true') return;

  setTimeout(() => {
    state.cart.clear();
    state.notes = '';
    els.cartNotes.value = '';
    persistCart();
    renderCart();
  }, 300);
});
els.cartNotes.addEventListener('input', event => {
  state.notes = event.target.value;
  const rows = getCartRows();
  const subtotal = rows.reduce((sum, row) => sum + (priceInCents(row.product.price) || 0) * row.quantity, 0);
  updateCheckoutLink(rows, subtotal, rows.some(row => priceInCents(row.product.price) === null));
});
// Mantener el foco dentro del carrito para navegación con teclado.
document.addEventListener('keydown', event => {
  if (!els.cartLayer.hidden) {
    if (event.key === 'Escape') { event.preventDefault(); closeCart(); return; }
    if (event.key === 'Tab') {
      const focusables = [...els.cartPanel.querySelectorAll('a[href],button:not(:disabled):not([hidden]),textarea:not(:disabled)')]
        .filter(element => element.getClientRects().length && element.getAttribute('aria-disabled') !== 'true');
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    return;
  }
  if (event.key === '/' && document.activeElement !== els.search && !['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)) {
    event.preventDefault(); els.search.focus();
  }
});
new IntersectionObserver(entries => {
  if (entries[0].isIntersecting && state.visible < state.filtered.length && !els.search.value) {
    state.visible += PAGE_SIZE;
    render();
  }
}, { rootMargin: '500px 0px' }).observe(els.sentinel);

document.querySelector('#year').textContent = new Date().getFullYear();
renderCart();
init();
