// Config
const PAGE_SIZE = 8;
const currencyRates = {
  LYD: {rate: 1, symbol: 'د.ل'},
  USD: {rate: 0.20, symbol: '$'},  // مثال: 1 LYD ≈ 0.20 USD (غيّره حسب رغبتك)
  EUR: {rate: 0.19, symbol: '€'}
};

const state = {
  products: [],
  collections: [],
  filtered: [],
  page: 1,
  currentCollection: 'all',
  sortProducts: 'featured',
  cart: [],
  currency: 'LYD'
};

document.addEventListener('DOMContentLoaded', async () => {
  bindHeader();
  await loadData();
  renderCollections();
  populateCollectionFilter();
  applyFilters();
  renderProducts();
  renderPagination();
});

// Header interactions
function bindHeader(){
  const searchToggle = document.getElementById('searchToggle');
  const searchBar = document.getElementById('searchBar');
  const searchInput = document.getElementById('searchInput');
  const searchClear = document.getElementById('searchClear');
  const cartToggle = document.getElementById('cartToggle');
  const cartClose = document.getElementById('cartClose');
  const backdrop = document.getElementById('backdrop');
  const currencySelect = document.getElementById('currencySelect');

  searchToggle.addEventListener('click',()=>searchBar.classList.toggle('active'));
  searchClear.addEventListener('click',()=>{searchInput.value=''; onSearch('');});
  searchInput.addEventListener('input',(e)=>onSearch(e.target.value));

  cartToggle.addEventListener('click',()=>openCart());
  cartClose.addEventListener('click',()=>closeCart());
  backdrop.addEventListener('click',()=>closeCart());

  currencySelect.addEventListener('change', (e)=>{
    state.currency = e.target.value;
    renderProducts();
    renderCart();
  });
}

// Data
async function loadData(){
  const [pRes,cRes] = await Promise.all([
    fetch('data/products.json'),
    fetch('data/collections.json')
  ]);
  state.products = await pRes.json();
  state.collections = await cRes.json();
}

// Collections
function renderCollections(){
  const grid = document.getElementById('collectionsGrid');
  grid.innerHTML = '';
  state.collections.forEach(col=>{
    const el = document.createElement('div');
    el.className = 'collection-card';
    el.innerHTML = `
      <img src="${col.image}" alt="${escapeHtml(col.title)}" />
      <div class="info">
        <div class="title">${escapeHtml(col.title)}</div>
        <p class="muted">${escapeHtml(col.description||'')}</p>
        <div class="actions">
          <button class="btn" data-collection="${col.handle}">عرض المنتجات</button>
        </div>
      </div>`;
    grid.appendChild(el);
    el.querySelector('button').addEventListener('click',()=>{
      document.getElementById('filterCollection').value = col.handle;
      onCollectionChange(col.handle);
      window.location.hash = '#products';
    });
  });

  // Sort collections
  document.getElementById('sortCollections').addEventListener('change',(e)=>{
    const val = e.target.value;
    if (val === 'alpha'){
      state.collections.sort((a,b)=>a.title.localeCompare(b.title,'ar'));
    }
    renderCollections();
  });
}

function populateCollectionFilter(){
  const select = document.getElementById('filterCollection');
  state.collections.forEach(col=>{
    const opt = document.createElement('option');
    opt.value = col.handle;
    opt.textContent = col.title;
    select.appendChild(opt);
  });
  select.addEventListener('change',(e)=>onCollectionChange(e.target.value));
}

// Products filtering/sorting
function applyFilters(){
  let list = [...state.products];

  if (state.currentCollection !== 'all') {
    list = list.filter(p=>p.collection === state.currentCollection);
  }

  const q = (document.getElementById('searchInput').value||'').trim().toLowerCase();
  if (q) list = list.filter(p=> (p.title+p.vendor+(p.description||'')).toLowerCase().includes(q));

  switch(state.sortProducts){
    case 'price-asc': list.sort((a,b)=>a.price - b.price); break;
    case 'price-desc': list.sort((a,b)=>b.price - a.price); break;
    case 'alpha': list.sort((a,b)=>a.title.localeCompare(b.title,'ar')); break;
    default: break;
  }

  state.filtered = list;
  state.page = 1;
}

function renderProducts(){
  const grid = document.getElementById('productsGrid');
  grid.innerHTML = '';
  const start = (state.page - 1) * PAGE_SIZE;
  const slice = state.filtered.slice(start, start + PAGE_SIZE);

  slice.forEach(p=>{
    const el = document.createElement('div');
    el.className = 'product-card';
    const hasSale = typeof p.compare_at_price === 'number' && p.compare_at_price > p.price;
    const lowStock = typeof p.inventory === 'number' && p.inventory > 0 && p.inventory <= (p.low_stock_threshold || 3);
    const outOfStock = !p.inventory || p.inventory <= 0;

    el.innerHTML = `
      <img src="${p.image}" alt="${escapeHtml(p.title)}" />
      <div class="info">
        <h3 class="title">${escapeHtml(p.title)}</h3>
        <div class="vendor">${escapeHtml(p.vendor || '')}</div>
        <div class="price">
          <span>${formatPrice(p.price)}</span>
          ${hasSale ? <span class="compare">${formatPrice(p.compare_at_price)}</span><span class="badge-sale">عرض خاص</span> : ''}
        </div>
        ${lowStock ? <div class="stock-note">متوفر بكمية محدودة (${p.inventory})</div> : ''}
        ${outOfStock ? <div class="stock-note">نفد المخزون</div> : ''}
        <div class="actions">
          <button class="btn btn-primary" data-add="${p.id}" ${outOfStock ? 'disabled' : ''}>أضف إلى السلة</button>
          <button class="btn" data-qv="${p.id}">عرض سريع</button>
        </div>
      </div>`;
    grid.appendChild(el);
    el.querySelector('[data-add]')?.addEventListener('click',()=>addToCart(p.id,1));
    el.querySelector('[data-qv]').addEventListener('click',()=>openQuickView(p));
  });

  document.getElementById('sortProducts').addEventListener('change',(e)=>{
    state.sortProducts = e.target.value; applyFilters(); renderProducts(); renderPagination();
  });
}

function renderPagination(){
  const pag = document.getElementById('pagination');
  pag.innerHTML = '';
  const pages = Math.ceil(state.filtered.length / PAGE_SIZE);
  if (pages <= 1) return;
  for (let i=1;i<=pages;i++){
    const btn = document.createElement('button');
    btn.className = 'page' + (i===state.page ? ' active':'');
    btn.textContent = i;
    btn.addEventListener('click',()=>{state.page=i; renderProducts(); renderPagination(); window.scrollTo({top:0,behavior:'smooth'});});
    pag.appendChild(btn);
  }
}

// Search / Collection change
function onSearch(){ applyFilters(); renderProducts(); renderPagination(); }
function onCollectionChange(handle){
  state.currentCollection = handle;
  applyFilters(); renderProducts(); renderPagination();
}

// Currency
function convertPrice(lyd){
  const r = currencyRates[state.currency];
  return lyd * r.rate;
}
function formatPrice(lyd){
  const r = currencyRates[state.currency];
  return ${convertPrice(lyd).toFixed(2)} ${r.symbol};
}

// Cart
function openCart(){
  document.getElementById('cartDrawer').classList.add('open');
  document.getElementById('backdrop').classList.add('visible');
  renderCart();
}
function closeCart(){
  document.getElementById('cartDrawer').classList.remove('open');
  document.getElementById('backdrop').classList.remove('visible');
}
function addToCart(id, qty=1){
  const product = state.products.find(p=>p.id===id);
  if (!product || !product.inventory || product.inventory<=0) return;
  const existing = state.cart.find(i=>i.id===id);
  if (existing) existing.qty = Math.min(existing.qty + qty, product.inventory);
  else state.cart.push({id, qty: Math.min(qty, product.inventory)});
  document.getElementById('cartCount').textContent = totalQty();
  openCart();
  renderCart();
}
function totalQty(){ return state.cart.reduce((s,i)=>s+i.qty,0); }
function cartTotal(){
  return state.cart.reduce((s,i)=>{
    const p = state.products.find(x=>x.id===i.id);
    return s + (p ? i.qty * convertPrice(p.price) : 0);
  },0);
}
function renderCart(){
  const box = document.getElementById('cartItems');
  box.innerHTML = '';
  state.cart.forEach((i,idx)=>{
    const p = state.products.find(x=>x.id===i.id);
    const el = document.createElement('div');
    el.className = 'cart-item';
    el.innerHTML = `
      <img src="${p.image}" alt="${escapeHtml(p.title)}" />
      <div style="flex:1">
        <div><strong>${escapeHtml(p.title)}</strong></div>
        <div class="muted">${formatPrice(p.price)}</div>
        <div class="qty-row">
          <label>الكمية</label>
          <input type="number" min="1" max="${p.inventory}" value="${i.qty}" data-idx="${idx}" class="qty-input" />
        </div>
      </div>
      <button class="icon-btn" data-del="${idx}" aria-label="حذف">🗑</button>`;
    box.appendChild(el);
    el.querySelector('[data-del]').addEventListener('click',()=>{state.cart.splice(idx,1); document.getElementById('cartCount').textContent = totalQty(); renderCart();});
    el.querySelector('.qty-input').addEventListener('change',(e)=>{
      const v = Math.max(1, Math.min(parseInt(e.target.value||'1',10), p.inventory));
      state.cart[e.target.dataset.idx].qty = v;
      document.getElementById('cartCount').textContent = totalQty();
      renderCart();
    });
  });
  document.getElementById('cartTotal').textContent = ${cartTotal().toFixed(2)} ${currencyRates[state.currency].symbol};
  document.getElementById('checkoutBtn').onclick = ()=>{
    alert('هذا متجر استاتيكي بدون بوابات دفع. اربط الزر بصفحة تواصل أو نموذج طلب.');
  };
}

// Quick view
function openQuickView(p){
  const modal = document.getElementById('quickView');
  document.getElementById('qvImage').src = p.image;
  document.getElementById('qvTitle').textContent = p.title;
  document.getElementById('qvPrice').textContent = formatPrice(p.price);
  const compareEl = document.getElementById('qvCompare');
  const badgeEl = document.getElementById('qvBadge');
  if (typeof p.compare_at_price === 'number' && p.compare_at_price > p.price){
    compareEl.textContent = formatPrice(p.compare_at_price);
    badgeEl.style.display = 'inline-block';
  } else {
    compareEl.textContent = '';
    badgeEl.style.display = 'none';
  }
  document.getElementById('qvDesc').textContent = p.description || '';
  document.getElementById('qvQty').value = 1;
  modal.classList.add('open');
  document.getElementById('qvAdd').onclick = ()=>{
    const qty = Math.max(1, parseInt(document.getElementById('qvQty').value||'1',10));
    addToCart(p.id, qty);
    closeQuickView();
  };
  document.getElementById('quickViewClose').onclick = closeQuickView;
}
function closeQuickView(){ document.getElementById('quickView').classList.remove('open'); }

// Utils
function escapeHtml(s){ return (s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c])); }