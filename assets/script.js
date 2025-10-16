function generateOrderSummary(event, action) {
  event.preventDefault();

  const form = document.getElementById('shippingForm');
  // التحقق من صحة النموذج أولاً
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  // 1. حساب الإجماليات
  const totals = cartTotalWithDiscount(cartSubtotalLYD());
  const paymentMethod = state.selectedPayment === 'bank' ? 'حوالة مصرفية (خصم 10%)' : 'الدفع عند الاستلام';

  // 2. جمع بيانات الشحن
  const shippingData = {
    name: document.getElementById('shipName').value,
    phone: document.getElementById('shipPhone').value,
    city: document.getElementById('shipCity').value,
    address: document.getElementById('shipAddress').value,
    notes: document.getElementById('shipNotes').value,
  };

  // 3. توليد ملخص الطلب (Summary)
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
  
  // 4. تنفيذ الإجراء
  if (action === 'confirm') {
    alert(`تم تأكيد الطلب بنجاح. سيتم التواصل معكم عبر الهاتف.\n\n${summary}`);
    // **ملاحظة:** هنا يجب أن يتم إرسال الطلب عبر نظامك الخلفي.
  } else if (action === 'whatsapp') {
    const whatsappText = encodeURIComponent(summary);
    
    // 📢 الرقم الصحيح المُدمج
    const whatsappNumber = '218945890862'; 
    window.open(`https://wa.me/${whatsappNumber}?text=${whatsappText}`, '_blank');
  } 
  
  // 5. مسح السلة والإغلاق (لجميع الإجراءات باستثناء إرسال واتساب الذي يفتح نافذة جديدة)
  if (action !== 'whatsapp') {
      closeCheckoutModal();
      state.cart = []; 
      renderCart();
  }
}