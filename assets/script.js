// Config
const PAGE_SIZE = 8;
// تم تبسيط إعداد العملة ليتوافق فقط مع الدينار الليبي
const currency = { symbol: 'د.ل', code: 'LYD' };
const DISCOUNT_RATE = 0.10; // 10% خصم للدفع بالحوالة البنكية

const state = {
  products: [],
  collections: [],
  filtered: [],
  page: 1,
  currentCollection: 'all',
  sortProducts: 'featured',
  cart: [],
  // حفظ آخر 8 مشاهدات في الـ localStorage
  recentlyViewed: JSON.parse(localStorage.getItem('marketoo_views') || '[]'),
  isDataLoaded: false,
  selectedPayment: 'cod', // cod: الدفع عند الاستلام, bank: حوالة بنكية
};

document.addEventListener('DOMContentLoaded', async () => {
  renderSkeleton(); // عرض التحميل الوهمي قبل التحميل
  bindHeader();
  bindAccountModals();
  bindCheckoutModals();

  await loadData(); // تحميل البيانات

  state.isDataLoaded = true;
  document.getElementById('productsGrid').innerHTML = ''; // تنظيف أماكن الـ Skeleton
  document.getElementById('collectionsGrid').innerHTML = '';

  renderCollections();
  populateCollectionFilter();
  applyFilters();
  renderProducts();
  renderPagination();
  renderRecentlyViewed();
});

// --- UTILITIES ---

function escapeHtml(s) {
  return (s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c]));
}

// دالة تنسيق السعر لعملة LYD فقط
function formatPrice(lyd) {
  if (typeof lyd !== 'number' || isNaN(lyd)) lyd = 0;
  return `${lyd.toFixed(2)} ${currency.symbol}`;
}

// دالة تتبع المشاهدات (للميزة المتقدمة)
function trackView(id) {
  if (state.recentlyViewed.includes(id)) {
    state.recentlyViewed = state.recentlyViewed.filter(i => i !== id);
  }
  state.recentlyViewed.unshift(id);
  state.recentlyViewed = state.recentlyViewed.slice(0, 8); // حفظ 8 منتجات فقط
  localStorage.setItem('marketoo_views', JSON.stringify(state.recentlyViewed));
  // لا يتم استدعاء renderRecentlyViewed هنا لتجنب وميض الأداء، بل يتم استدعاؤها في onload فقط
}

// --- DATA & LOADING ---

async function loadData() {
  // محاكاة تأخير التحميل لتوضيح تأثير Skeleton
  await new Promise(resolve => setTimeout(resolve, 500)); 

  // يفترض أن الملفات في مسار data/
  const [pRes, cRes] = await Promise.all([
    fetch('data/products.json'),
    fetch('data/collections.json')
  ]);
  state.products = await pRes.json();
  state.collections = await cRes.json();
}

function renderSkeleton() {
  const grid4 = document.getElementById('productsGrid');
  const grid3 = document.getElementById('collectionsGrid');
  // استخدام فئة skeleton من CSS
  const skeletonCard = `<div class="product-card skeleton" style="min-height:300px;"></div>`;
  const skeletonCol = `<div class="collection-card skeleton" style="min-height:200px;"></div>`;

  // عرض 8 بطاقات هيكلية للمنتجات
  grid4.innerHTML = Array(8).fill(skeletonCard).join('');
  // عرض 3 بطاقات هيكلية للمجموعات
  grid3.innerHTML = Array(3).fill(skeletonCol).join('');
}

// --- HEADER & NAVIGATION ---

function bindHeader() {
  const searchToggle = document.getElementById('searchToggle');
  const searchBar = document.getElementById('searchBar');
  const searchInput = document.getElementById('searchInput');
  const searchClear = document.getElementById('searchClear');
  const cartToggle = document.getElementById('cartToggle');
  const cartClose = document.getElementById('cartClose');
  const backdrop = document.getElementById('backdrop');

  searchToggle.addEventListener('click', () => searchBar.classList.toggle('active'));
  searchClear.addEventListener('click', () => { searchInput.value = ''; onSearch(''); });
  // البحث الفوري: تحديث عند كل إدخال
  searchInput.addEventListener('input', (e) => onSearch(e.target.value));

  cartToggle.addEventListener('click', () => openCart());
  cartClose.addEventListener('click', () => closeCart());
  backdrop.addEventListener('click', () => closeModalOrDrawer());
}

function closeModalOrDrawer() {
  closeCart();
  closeQuickView();
  closeAccountModal();
  closeCheckoutModal();
}

// --- PRODUCTS & COLLECTIONS ---

function renderCollections() {
  const grid = document.getElementById('collectionsGrid');
  if (!state.isDataLoaded) return;

  grid.innerHTML = '';
  state.collections.forEach(col => {
    const el = document.createElement('div');
    el.className = 'collection-card';
    el.innerHTML = `
      <img src="${col.image}" alt="${escapeHtml(col.title)}" loading="lazy" />
      <div class="info">
        <div class="title">${escapeHtml(col.title)}</div>
        <p class="muted">${escapeHtml(col.description || '')}</p>
        <div class="actions">
          <button class="btn" data-collection="${col.handle}">عرض المنتجات</button>
        </div>
      </div>`;
    grid.appendChild(el);
    el.querySelector('button').addEventListener('click', () => {
      document.getElementById('filterCollection').value = col.handle;
      onCollectionChange(col.handle);
      window.location.hash = '#products';
    });
  });

  document.getElementById('sortCollections').addEventListener('change', (e) => {
    const val = e.target.value;
    if (val === 'alpha') {
      state.collections.sort((a, b) => a.title.localeCompare(b.title, 'ar'));
    }
    renderCollections();
  });
}

function populateCollectionFilter() {
  const select = document.getElementById('filterCollection');
  if (!state.isDataLoaded) return;

  state.collections.forEach(col => {
    const opt = document.createElement('option');
    opt.value = col.handle;
    opt.textContent = col.title;
    select.appendChild(opt);
  });
  select.addEventListener('change', (e) => onCollectionChange(e.target.value));
}

function applyFilters() {
  let list = [...state.products];

  if (state.currentCollection !== 'all') {
    list = list.filter(p => p.collection === state.currentCollection);
  }

  const q = (document.getElementById('searchInput').value || '').trim().toLowerCase();
  if (q) list = list.filter(p => (p.title + p.vendor + (p.description || '')).toLowerCase().includes(q));

  switch (state.sortProducts) {
    case 'price-asc': list.sort((a, b) => a.price - b.price); break;
    case 'price-desc': list.sort((a, b) => b.price - a.price); break;
    case 'alpha': list.sort((a, b) => a.title.localeCompare(b.title, 'ar')); break;
    default:
      // تثبيت ترتيب المنتجات المختارة (Featured) افتراضيا
      break;
  }

  state.filtered = list;
  state.page = 1;
}

function renderProducts() {
  const grid = document.getElementById('productsGrid');
  if (!state.isDataLoaded) return; // لا تعرض إلا بعد تحميل البيانات

  grid.innerHTML = '';
  const start = (state.page - 1) * PAGE_SIZE;
  const slice = state.filtered.slice(start, start + PAGE_SIZE);

  slice.forEach(p => {
    const hasSale = typeof p.compare_at_price === 'number' && p.compare_at_price > p.price;
    const lowStock = typeof p.inventory === 'number' && p.inventory > 0 && p.inventory <= (p.low_stock_threshold || 3);
    const outOfStock = !p.inventory || p.inventory <= 0;

    const saleHtml = hasSale
      ? `<span class="compare">${formatPrice(p.compare_at_price)}</span><span class="badge-sale">عرض خاص</span>`
      : '';
    const stockNoteHtml = outOfStock
      ? `<div class="stock-note">نفد المخزون</div>`
      : (lowStock ? `<div class="stock-note">متوفر بكمية محدودة (${p.inventory})</div>` : '');

    const el = document.createElement('div');
    el.className = 'product-card';
    el.innerHTML = `
      <img src="${p.image}" alt="${escapeHtml(p.title)}" loading="lazy" />
      <div class="info">
        <h3 class="title">${escapeHtml(p.title)}</h3>
        <div class="vendor">${escapeHtml(p.vendor || '')}</div>
        <div class="price">
          <span>${formatPrice(p.price)}</span>
          ${saleHtml}
        </div>
        ${stockNoteHtml}
        <div class="actions">
          <button class="btn btn-primary" data-add="${p.id}" ${outOfStock ? 'disabled' : ''} aria-label="أضف ${p.title} إلى السلة">أضف إلى السلة</button>
          <button class="btn" data-qv="${p.id}" aria-label="عرض سريع لـ ${p.title}">عرض سريع</button>
        </div>
      </div>`;

    grid.appendChild(el);
    el.querySelector('[data-add]')?.addEventListener('click', () => addToCart(p.id, 1));
    el.querySelector('[data-qv]').addEventListener('click', () => openQuickView(p));

    // تتبع المشاهدات عند النقر على البطاقة (للميزة المتقدمة)
    el.addEventListener('click', () => trackView(p.id));
  });

  document.getElementById('sortProducts').addEventListener('change', (e) => {
    state.sortProducts = e.target.value; applyFilters(); renderProducts(); renderPagination();
  });
}

function renderPagination() {
  const pag = document.getElementById('pagination');
  if (!state.isDataLoaded) return;

  pag.innerHTML = '';
  const pages = Math.ceil(state.filtered.length / PAGE_SIZE);
  if (pages <= 1) return;
  for (let i = 1; i <= pages; i++) {
    const btn = document.createElement('button');
    btn.className = 'page' + (i === state.page ? ' active' : '');
    btn.textContent = i;
    btn.addEventListener('click', () => { state.page = i; renderProducts(); renderPagination(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
    pag.appendChild(btn);
  }
}

function onSearch() { applyFilters(); renderProducts(); renderPagination(); }
function onCollectionChange(handle) {
  state.currentCollection = handle;
  applyFilters(); renderProducts(); renderPagination();
}

// --- RECENTLY VIEWED & RECOMMENDATIONS ---

function renderRecentlyViewed() {
    const section = document.getElementById('recentlyViewedSection');
    const grid = document.getElementById('recentlyViewedGrid');
    grid.innerHTML = '';

    const recentlyViewedProducts = state.recentlyViewed
        .map(id => state.products.find(p => p.id === id))
        .filter(p => p !== undefined)
        .slice(0, 4); // عرض 4 منتجات فقط

    if (recentlyViewedProducts.length === 0) {
        section.style.display = 'none';
        return;
    }

    recentlyViewedProducts.forEach(p => {
        const el = document.createElement('div');
        el.className = 'product-card';
        el.innerHTML = `
            <img src="${p.image}" alt="${escapeHtml(p.title)}" loading="lazy" />
            <div class="info">
                <h3 class="title">${escapeHtml(p.title)}</h3>
                <div class="price">${formatPrice(p.price)}</div>
                <div class="actions">
                    <button class="btn" data-qv="${p.id}">عرض سريع</button>
                </div>
            </div>`;
        grid.appendChild(el);
        el.querySelector('[data-qv]').addEventListener('click', () => openQuickView(p));
    });

    section.style.display = 'block';
}

function getRelatedProducts(currentProduct) {
  // التوصية: عرض منتجات من نفس المجموعة وليست المنتج الحالي
  return state.products
    .filter(p => p.collection === currentProduct.collection && p.id !== currentProduct.id)
    .sort(() => 0.5 - Math.random()) // ترتيب عشوائي للتنوع
    .slice(0, 3); // عرض 3 توصيات
}

// --- CART LOGIC ---

function openCart() {
  document.getElementById('cartDrawer').classList.add('open');
  document.getElementById('backdrop').classList.add('visible');
  renderCart();
  // ربط أحداث تغيير الدفع (لضمان تحديث الخصم فوراً)
  document.querySelectorAll('input[name="paymentMethod"]').forEach(radio => {
    radio.onchange = (e) => {
      state.selectedPayment = e.target.value;
      renderCart();
    };
  });
}

function closeCart() {
  document.getElementById('cartDrawer').classList.remove('open');
  document.getElementById('backdrop').classList.remove('visible');
}

function addToCart(id, qty = 1) {
  const product = state.products.find(p => p.id === id);
  if (!product || !product.inventory || product.inventory <= 0) return;
  const existing = state.cart.find(i => i.id === id);

  let newQty = qty;
  if (existing) newQty = existing.qty + qty;

  if (newQty > product.inventory) {
    newQty = product.inventory;
    showToast(`لا يمكن إضافة ${qty}؛ الكمية المتبقية هي ${product.inventory}، تم إضافة المتوفر فقط.`);
  }

  if (existing) existing.qty = newQty;
  else state.cart.push({ id, qty: newQty });

  document.getElementById('cartCount').textContent = totalQty();
  document.getElementById('cartCountHeader').textContent = totalQty();

  showToast(`تمت إضافة ${newQty} × ${product.title} إلى السلة.`);
  openCart();
}

function totalQty() { return state.cart.reduce((s, i) => s + i.qty, 0); }

// حساب الإجمالي الفرعي بالدينار الليبي
function cartSubtotalLYD() {
  return state.cart.reduce((s, i) => {
    const p = state.products.find(x => x.id === i.id);
    return s + (p ? i.qty * p.price : 0);
  }, 0);
}

// حساب الخصم والإجمالي الكلي
function cartTotalWithDiscount(subtotal) {
  if (state.selectedPayment === 'bank') {
    const discount = subtotal * DISCOUNT_RATE;
    const total = subtotal - discount;
    return { subtotal, discount, total };
  }
  return { subtotal, discount: 0, total: subtotal };
}

// دالة renderCart المُصلحة بالكامل
function renderCart() {
  const box = document.getElementById('cartItems');
  box.innerHTML = '';

  const subtotalLYD = cartSubtotalLYD();
  const totals = cartTotalWithDiscount(subtotalLYD);

  state.cart.forEach((i, idx) => {
    const p = state.products.find(x => x.id === i.id);
    if (!p) return; 

    const el = document.createElement('div');
    el.className = 'cart-item';
    el.innerHTML = `
      <img src="${p.image}" alt="${escapeHtml(p.title)}" loading="lazy" />
      <div style="flex:1">
        <div><strong>${escapeHtml(p.title)}</strong></div>
        <div class="muted">${formatPrice(p.price)}</div>
        <div class="qty-row">
          <label for="qty-${p.id}">الكمية</label>
          <input type="number" id="qty-${p.id}" min="1" max="${p.inventory}" value="${i.qty}" data-idx="${idx}" class="qty-input" aria-label="تغيير كمية ${p.title}" />
        </div>
      </div>
      <button class="icon-btn" data-del="${idx}" aria-label="حذف">🗑</button>`;
    box.appendChild(el);

    el.querySelector('[data-del]').onclick = () => {
      state.cart.splice(idx, 1);
      renderCart();
    };

    el.querySelector('.qty-input').onchange = (e) => {
      const v = Math.max(1, Math.min(parseInt(e.target.value || '1', 10), p.inventory));
      state.cart[e.target.dataset.idx].qty = v;
      renderCart();
    };
  });

  // تحديث حالة أزرار الدفع
  document.getElementById('radioBank').checked = (state.selectedPayment === 'bank');
  document.getElementById('radioCod').checked = (state.selectedPayment === 'cod');

  // تحديث ملخص السلة (الإصلاح الحاسم)
  document.getElementById('cartSubtotal').textContent = formatPrice(totals.subtotal);
  document.getElementById('cartDiscount').textContent = formatPrice(-totals.discount);
  document.getElementById('cartTotal').textContent = formatPrice(totals.total);
  document.getElementById('discountRow').style.display = totals.discount > 0.01 ? 'flex' : 'none'; // عرض الخصم إذا كان > 0

  // تحديث عدادات الكمية
  document.getElementById('cartCount').textContent = totalQty();
  document.getElementById('cartCountHeader').textContent = totalQty();

  // تفعيل زر إتمام الشراء
  const checkoutBtn = document.getElementById('checkoutBtn');
  checkoutBtn.disabled = state.cart.length === 0;
  checkoutBtn.onclick = () => {
    if (state.cart.length > 0) openCheckoutModal(totals);
  };

  if (state.cart.length === 0) {
    box.innerHTML = '<p class="muted" style="text-align:center;padding-top:20px;">سلة المشتريات فارغة.</p>';
  }
}

// --- QUICK VIEW (RECOMMENDATIONS) ---

function openQuickView(p) {
  const modal = document.getElementById('quickView');
  const relatedProducts = getRelatedProducts(p);

  document.getElementById('qvImage').src = p.image;
  document.getElementById('qvImage').alt = p.title;
  document.getElementById('qvTitle').textContent = p.title;
  document.getElementById('qvPrice').textContent = formatPrice(p.price);

  const compareEl = document.getElementById('qvCompare');
  const badgeEl = document.getElementById('qvBadge');
  if (typeof p.compare_at_price === 'number' && p.compare_at_price > p.price) {
    compareEl.textContent = formatPrice(p.compare_at_price);
    badgeEl.style.display = 'inline-block';
  } else {
    compareEl.textContent = '';
    badgeEl.style.display = 'none';
  }

  document.getElementById('qvDesc').textContent = p.description || '';
  document.getElementById('qvQty').value = 1;
  document.getElementById('qvQty').max = p.inventory;
  document.getElementById('qvAdd').disabled = p.inventory === 0;

  // إظهار التوصيات (You Might Also Like)
  const recommendationsDiv = document.createElement('div');
  recommendationsDiv.id = 'qvRecommendations';
  recommendationsDiv.innerHTML = relatedProducts.length > 0 ?
    `<h4>منتجات قد تعجبك أيضاً:</h4>
     <div class="grid grid-3" style="margin-top:10px;">
       ${relatedProducts.map(rp => `
         <div class="product-card" style="border:none;padding:5px;box-shadow:none;">
           <img src="${rp.image}" alt="${escapeHtml(rp.title)}" style="height:auto;aspect-ratio:1/1;" loading="lazy" />
           <div class="info" style="padding:5px 0;">
             <div class="title" style="font-size:.9rem;">${rp.title}</div>
             <div class="price" style="font-size:.8rem;">${formatPrice(rp.price)}</div>
           </div>
         </div>`).join('')}
     </div>` : '';

  const modalInfo = document.querySelector('#quickView .modal-info');
  modalInfo.appendChild(recommendationsDiv);

  modal.classList.add('open');
  document.getElementById('qvAdd').onclick = () => {
    const qty = Math.max(1, parseInt(document.getElementById('qvQty').value || '1', 10));
    addToCart(p.id, qty);
    closeQuickView();
  };
  document.getElementById('quickViewClose').onclick = closeQuickView;
  trackView(p.id); // تتبع المشاهدة
}

function closeQuickView() {
  document.getElementById('quickView').classList.remove('open');
  // تنظيف التوصيات بعد الإغلاق
  const recs = document.getElementById('qvRecommendations');
  if (recs) recs.remove();
}


// --- ACCOUNT MODAL ---

function bindAccountModals() {
  const modal = document.getElementById('accountModal');
  const tabs = document.querySelectorAll('.tabs .tab');
  const panels = document.querySelectorAll('.panels section');
  const accountToggle = document.getElementById('accountToggle');
  const accountClose = document.getElementById('accountClose');
  const goResetFromLogin = document.getElementById('goResetFromLogin');

  accountToggle.addEventListener('click', () => modal.classList.add('open'));
  accountClose.addEventListener('click', () => modal.classList.remove('open'));
  goResetFromLogin.addEventListener('click', (e) => { e.preventDefault(); activateTab('resetTab'); });

  function activateTab(tabId) {
    tabs.forEach(tab => {
      tab.classList.remove('active');
      tab.setAttribute('aria-selected', 'false');
    });
    panels.forEach(panel => panel.setAttribute('hidden', ''));

    const targetTab = document.getElementById(tabId);
    if(targetTab) {
        targetTab.classList.add('active');
        targetTab.setAttribute('aria-selected', 'true');
        document.getElementById(targetTab.getAttribute('aria-controls')).removeAttribute('hidden');
    }
  }

  tabs.forEach(tab => tab.addEventListener('click', (e) => activateTab(e.target.id)));

  // Placeholder for form submissions
  document.getElementById('loginForm').onsubmit = (e) => {
    e.preventDefault(); showToast('تمت محاولة تسجيل الدخول بنجاح (تجربة).');
  };
  document.getElementById('registerForm').onsubmit = (e) => {
    e.preventDefault(); showToast('تم إنشاء الحساب بنجاح (تجربة).');
  };
  document.getElementById('resetForm').onsubmit = (e) => {
    e.preventDefault(); showToast('تم إرسال رابط استعادة كلمة المرور (تجربة).');
  };
}

function closeAccountModal() { document.getElementById('accountModal').classList.remove('open'); }
function showToast(message) {
  const toast = document.getElementById('accountToast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// --- CHECKOUT MODAL ---

function bindCheckoutModals() {
  const checkoutModal = document.getElementById('checkoutModal');
  const checkoutClose = document.getElementById('checkoutClose');
  const backToCart = document.getElementById('backToCart');
  const form = document.getElementById('shippingForm');

  checkoutClose.addEventListener('click', closeCheckoutModal);
  backToCart.addEventListener('click', () => { closeCheckoutModal(); openCart(); });
  
  // تفعيل زر تأكيد الطلب
  form.onsubmit = (e) => { generateOrderSummary(e, 'confirm'); };
  document.getElementById('sendWhatsApp').onclick = (e) => { generateOrderSummary(e, 'whatsapp'); };
}

function openCheckoutModal(totals) {
  const modal = document.getElementById('checkoutModal');
  const paymentMethod = state.selectedPayment === 'bank' ? 'حوالة مصرفية (خصم 10%)' : 'الدفع عند الاستلام';

  document.getElementById('checkoutSummaryText').textContent =
    `إجمالي طلبك هو ${formatPrice(totals.total)}، وطريقة الدفع المختارة هي: ${paymentMethod}. يرجى إدخال بيانات الشحن لتأكيد الطلب.`;

  modal.classList.add('open');
}

function closeCheckoutModal() { document.getElementById('checkoutModal').classList.remove('open'); }

function generateOrderSummary(event, action) {
  event.preventDefault();

  const form = document.getElementById('shippingForm');
  // التحقق من صحة النموذج أولاً
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const totals = cartTotalWithDiscount(cartSubtotalLYD());
  const paymentMethod = state.selectedPayment === 'bank' ? 'حوالة مصرفية (خصم 10%)' : 'الدفع عند الاستلام';

  // جمع بيانات الشحن
  const shippingData = {
    name: document.getElementById('shipName').value,
    phone: document.getElementById('shipPhone').value,
    city: document.getElementById('shipCity').value,
    address: document.getElementById('shipAddress').value,
    notes: document.getElementById('shipNotes').value,
  };

  let summary = `*ملخص طلب Marketoo*\n`;
  summary += `------------------------\n`;
  state.cart.forEach(item => {
    const p = state.products.find(x => x.id === item.id);
    if (p) summary += `${p.title} (${formatPrice(p.price)}) × ${item.qty}\n`;
  });
  summary += `------------------------\n`;
  summary += `الإجمالي الفرعي: ${formatPrice(totals.subtotal)}\n`;
  if (totals.discount > 0.01) {
    summary += `الخصم (10%): ${formatPrice(-totals.discount)}\n`;
  }
  summary += `*المجموع الكلي: ${formatPrice(totals.total)}*\n`;
  summary += `طريقة الدفع: ${paymentMethod}\n`;
  summary += `------------------------\n`;
  summary += `*بيانات الشحن:*\n`;
  summary += `الاسم: ${shippingData.name}\n`;
  summary += `الهاتف: ${shippingData.phone}\n`;
  summary += `العنوان: ${shippingData.city}, ${shippingData.address}\n`;
  if (shippingData.notes) {
    summary += `ملاحظات: ${shippingData.notes}\n`;
  }

  if (action === 'confirm') {
    alert(`تم تأكيد الطلب بنجاح. سيتم التواصل معكم عبر الهاتف.\n\n${summary}`);
    // **ملاحظة:** هنا يجب أن يتم إرسال الطلب عبر نظامك الخلفي.
    // يمكن مسح السلة بعد التأكيد: state.cart = []; renderCart(); closeCheckoutModal();
  } else if (action === 'whatsapp') {
    const whatsappText = encodeURIComponent(summary);
    // استبدل 1234567890 برقم هاتف التاجر (مع مفتاح الدولة)
    window.open(`https://wa.me/2189xxyyyyyy?text=${whatsappText}`, '_blank');
  } 
  
  if (action !== 'whatsapp') {
      closeCheckoutModal();
  }
}