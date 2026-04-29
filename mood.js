document.addEventListener('DOMContentLoaded', () => {
    // 1. Load Moods created by Admin
    // Since we don't have a DB yet, we grab it from localStorage where admin.js saved it, 
    // or use defaults if empty.
    const defaultMoods = [
        { id: 1, isim: "Enerjik Hissetmek", emoji: "⚡", tags: ["enerjik", "soguk", "kafein"] },
        { id: 2, isim: "Rahatlamak İstiyorum", emoji: "🧘‍♀️", tags: ["rahatlatici", "sicak"] }
    ];
    const moodsData = JSON.parse(localStorage.getItem('moodsDB')) || defaultMoods;
    
    const container = document.getElementById('mood-buttons-container');

    // Render Mood Buttons
    moodsData.forEach(mood => {
        const btn = document.createElement('button');
        btn.className = 'mood-btn';
        btn.innerHTML = `<span>${mood.emoji}</span> ${mood.isim}`;
        btn.onclick = () => selectMood(mood, btn);
        container.appendChild(btn);
    });
});

let menuData = [];

// Fetch menu data from your existing backend API
fetch('/api/menu')
    .then(res => res.json())
    .then(data => {
        menuData = data;
    })
    .catch(err => console.error("Menü yüklenemedi:", err));

function selectMood(mood, clickedBtn) {
    // Check if the button is already active
    const isActive = clickedBtn.classList.contains('active');
    
    // UI Update: Remove active class from all buttons
    document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('active'));

    const resultsContainer = document.getElementById('results-container');
    const title = document.getElementById('results-title');

    // If it was already active, we unselect it and clear the page
    if (isActive) {
        resultsContainer.innerHTML = '<p style="grid-column: 1/-1; color:#888;">Lütfen bir ruh hali seçin.</p>';
        title.style.display = 'none';
        return; 
    }

    // Otherwise, activate the clicked button
    clickedBtn.classList.add('active');

    // Filter Logic
    const moodTagsArray = mood.tags || mood.etiketler || [];
    const targetTags = moodTagsArray.map(t => t.toLowerCase());
    
    const matchedProducts = menuData.filter(product => {
        const productTagsArray = product.tags || product.etiketler;
        if (!productTagsArray || !Array.isArray(productTagsArray)) return false;
        
        const productTags = productTagsArray.map(t => t.toLowerCase());
        return productTags.some(tag => targetTags.includes(tag));
    });

    renderResults(matchedProducts);
}

function renderResults(products) {
    const resultsContainer = document.getElementById('results-container');
    const title = document.getElementById('results-title');
    
    resultsContainer.innerHTML = '';
    title.style.display = 'block';

    if (products.length === 0) {
        resultsContainer.innerHTML = '<p style="grid-column: 1/-1; color:#888;">Bu ruh haline uygun ürün bulunamadı. Lütfen başka bir ruh hali seçin.</p>';
        return;
    }

    products.forEach(product => {
        const imgSrc = product.resim || "/images/americano.jpg";
        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <img src="${imgSrc}" class="product-img" alt="${product.isim}" onerror="this.src='/images/americano.jpg'">
            <div class="product-info">
                <h3 class="product-title">${product.isim}</h3>
                <p class="product-desc">${product.aciklama || "Harika bir tercih."}</p>
                <div class="product-price">${product.fiyat} TL</div>
                <button class="add-to-cart-btn" onclick="addToCart(${product.id})" style="margin-top: 10px; width: 100%; padding: 10px; background: #ff9800; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: bold;">Sepete Ekle</button>
            </div>
        `;
        resultsContainer.appendChild(card);
    });
}

function addToCart(productId) {
    // Find the product in our fetched menu data
    const product = menuData.find(p => p.id === productId);
    if (!product) return;
    
    // Grab the current cart, or start a new empty one
    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    
    // Check if item already exists in cart to increase quantity
    let existingItem = cart.find(item => item.id === productId);
    if (existingItem) {
        existingItem.quantity = (existingItem.quantity || 1) + 1;
    } else {
        cart.push({ ...product, quantity: 1 });
    }
    
    // Save it back to storage so cart.html can see it
    localStorage.setItem('cart', JSON.stringify(cart));
    
    alert(product.isim + " sepete eklendi! 🛒");
}
