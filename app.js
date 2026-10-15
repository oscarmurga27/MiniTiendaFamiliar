const PAGE_SIZE = 10;
const state = { all: [], filtered: [], visible: PAGE_SIZE, store: null };
const els = {
  grid: document.querySelector('#productGrid'), search: document.querySelector('#searchInput'),
  count: document.querySelector('#resultsCount'), total: document.querySelector('#productCount'),
  empty: document.querySelector('#emptyState'), clear: document.querySelector('#clearSearch'),
  loader: document.querySelector('#loader'), sentinel: document.querySelector('#scrollSentinel')
};

const normalize = value => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const escapeHTML = value => String(value).replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const money = value => new Intl.NumberFormat(state.store.locale, { style:'currency', currency:state.store.currency, maximumFractionDigits:2 }).format(value);

function card(product, index) {
  return `<article class="card" style="animation-delay:${(index % PAGE_SIZE) * 45}ms">
    <div class="image-wrap">
      <img src="${escapeHTML(product.image)}" alt="${escapeHTML(product.name)}" loading="lazy" width="720" height="900">
      ${product.badge ? `<span class="badge">${escapeHTML(product.badge)}</span>` : ''}
    </div>
    <div class="card-info">
      <div class="card-top"><h2>${escapeHTML(product.name)}</h2><span class="price">${money(product.price)}</span></div>
      <p class="category">${escapeHTML(product.category)}</p>
      <p class="card-desc">${escapeHTML(product.description)}</p>
    </div>
  </article>`;
}

function render() {
  const shown = state.filtered.slice(0, state.visible);
  els.grid.innerHTML = shown.map(card).join('');
  els.empty.hidden = state.filtered.length > 0;
  els.count.textContent = state.filtered.length === state.all.length ? `${state.all.length} productos` : `${state.filtered.length} resultado${state.filtered.length === 1 ? '' : 's'}`;
  els.loader.hidden = shown.length >= state.filtered.length;
}

function search() {
  const query = normalize(els.search.value.trim());
  state.filtered = query ? state.all.filter(p => normalize(`${p.name} ${p.category} ${p.description}`).includes(query)) : [...state.all];
  state.visible = query ? state.filtered.length : PAGE_SIZE;
  render();
}

function applyStore(store) {
  state.store = store;
  document.title = `${store.name} — Catálogo contemporáneo`;
  document.querySelector('#brand').textContent = store.name;
  document.querySelector('#footerBrand').textContent = store.name;
  document.querySelector('#eyebrow').textContent = store.eyebrow;
  document.querySelector('#headline').textContent = store.headline;
  document.querySelector('#description').textContent = store.description;
  const message = encodeURIComponent(store.whatsappMessage);
  document.querySelector('#whatsapp').href = `https://wa.me/${store.whatsapp}?text=${message}`;
}

async function init() {
  try {
    const response = await fetch('data.json');
    if (!response.ok) throw new Error('No se pudo abrir el catálogo');
    const data = await response.json();
    applyStore(data.store);
    state.all = data.products;
    state.filtered = [...state.all];
    els.total.textContent = `${state.all.length} piezas seleccionadas`;
    render();
  } catch (error) {
    els.loader.hidden = true;
    els.grid.innerHTML = '<p>No fue posible cargar el catálogo. Intenta actualizar la página.</p>';
  }
}

els.search.addEventListener('input', search);
els.clear.addEventListener('click', () => { els.search.value = ''; search(); els.search.focus(); });
document.addEventListener('keydown', event => { if (event.key === '/' && document.activeElement !== els.search) { event.preventDefault(); els.search.focus(); } });

new IntersectionObserver(entries => {
  if (entries[0].isIntersecting && state.visible < state.filtered.length && !els.search.value) {
    state.visible += PAGE_SIZE;
    render();
  }
}, { rootMargin: '500px 0px' }).observe(els.sentinel);

document.querySelector('#year').textContent = new Date().getFullYear();
init();
