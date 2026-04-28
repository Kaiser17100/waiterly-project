let menu = [];
let uniqueIngredients = [];
let selectedIngredients = new Set();
let ingredientMap = {}; // Hangi malzemenin hangi kök malzemeye bağlandığını tutar (Örn: "Sıcak Süt" -> "Süt")

// 1. İstenmeyen ve Yoksayılacak Malzemeler (Gereksiz uzamayı önlemek için)
const ignoredIngredients = ["ekmek", "su", "un", "buz", "tuz", "şeker"];

function isIgnored(ingredientName) {
    let lower = ingredientName.toLocaleLowerCase('tr-TR').trim();
    let words = lower.split(/[\s,]+/);
    
    // Ekmek, ekmeği, suyu vb. ek almış varyasyonları da yakalamak için
    for (let word of words) {
        if (ignoredIngredients.includes(word)) return true;
        if (word.startsWith("ekme")) return true; // ekmek, ekmeği
        if (word === "suyu") return true;         // meyve suyu, limon suyu
    }
    return ignoredIngredients.includes(lower);
}

// 2. Menüyü Çekme ve Başlatma
window.addEventListener("load", function () {
    fetch("/api/menu")
        .then(res => res.json())
        .then(data => {
            menu = data;
            extractIngredients();
            renderIngredients();
        })
        .catch(err => console.error("Menü yüklenemedi:", err));
});

// 3. Akıllı Malzeme Çıkarımı ve Kök Kelime Eşleştirme Algoritması
function extractIngredients() {
    let allRawIngredients = new Set();
    
    // Tüm ürünlerin içeriklerini ham haliyle topla
    menu.forEach(item => {
        if (item.icerik) {
            item.icerik.forEach(ing => {
                allRawIngredients.add(ing.trim());
            });
        }
    });

    let rawArray = Array.from(allRawIngredients);

    // KISADAN UZUNA SIRALAMA:
    // Bu sayede "Süt" 3 harfli olduğu için "Sıcak Süt" (9 harf) kelimesinden önce işlenir.
    // Algoritma uzun kelimenin içinde kısa kelimeyi arayacağı için bu sıralama hayatidir.
    rawArray.sort((a, b) => a.length - b.length);

    let rootIngredients = [];
    ingredientMap = {};

    rawArray.forEach(rawIng => {
        // Eğer yoksayılacak bir malzemeyse (un, su, ekmek vb.) direkt atla
        if (isIgnored(rawIng)) {
            ingredientMap[rawIng] = null; 
            return;
        }

        let lowerRaw = rawIng.toLocaleLowerCase('tr-TR');
        let matchedRoot = null;

        // Kendinden daha kısa olan ve daha önce listeye eklenen kök kelimeleri kontrol et
        for (let root of rootIngredients) {
            let lowerRoot = root.toLocaleLowerCase('tr-TR');
            
            // Mevcut uzun kelime (örn: sıcak süt), kök kelimeyi (örn: süt) içeriyor mu?
            // "susam" içindeki "su" gibi hatalı eşleşmeleri önlemek için kelime sınırlarına (\b tarzı boşluklara) dikkat ediyoruz.
            let regex = new RegExp(`(^|\\s)${lowerRoot}($|\\s)`, 'i');
            
            if (regex.test(lowerRaw) || lowerRaw.includes(lowerRoot)) {
                matchedRoot = root;
                break;
            }
        }

        if (matchedRoot) {
            // Sıfatlı/uzun versiyonu kök versiyona bağla (Örn: "Sıcak Süt" artık "Süt" olarak aranacak)
            ingredientMap[rawIng] = matchedRoot;
        } else {
            // Hiçbir kök kelimeyle eşleşmedi, demek ki bu kelimenin kendisi yeni bir kök kelime
            rootIngredients.push(rawIng);
            ingredientMap[rawIng] = rawIng;
        }
    });

    // Ekrana basılacak nihai kök malzeme listesini alfabetik olarak sırala
    uniqueIngredients = rootIngredients.sort((a, b) => a.localeCompare(b, 'tr-TR'));
}

// 4. Malzemeleri Ekrana Çizme
function renderIngredients() {
    const grid = document.getElementById("ingredients-grid");
    grid.innerHTML = "";

    uniqueIngredients.forEach(ing => {
        let div = document.createElement("div");
        div.className = "ingredient-card";
        
        // İlk harften jenerik bir görsel oluşturur
        let genericPic = `https://placehold.co/100x100/eeeeee/4CAF50?text=${ing.charAt(0)}&font=Montserrat`;

        div.innerHTML = `
            <img src="${genericPic}" class="ingredient-img" alt="${ing}">
            <div class="ingredient-name">${ing}</div>
        `;

        div.onclick = () => toggleIngredient(ing, div);
        grid.appendChild(div);
    });
}

function toggleIngredient(ingredient, element) {
    if (selectedIngredients.has(ingredient)) {
        selectedIngredients.delete(ingredient);
        element.classList.remove("selected");
    } else {
        selectedIngredients.add(ingredient);
        element.classList.add("selected");
    }
}

// 5. Seçilen Malzemelere Göre Ürünleri Gösterme
function showMatchingProducts() {
    if (selectedIngredients.size === 0) {
        alert("Lütfen en az bir malzeme seçin.");
        return;
    }

    const matchedList = document.getElementById("matched-menu-list");
    matchedList.innerHTML = "";

    // Ürünleri Filtrele
    const matchingProducts = menu.filter(item => {
        if (!item.icerik) return false;
        
        // Ürünün malzemelerini kök malzemelere dönüştür
        // Örn: Üründe "Sıcak Süt" varsa, bu diziye "Süt" olarak yansır.
        const itemRoots = item.icerik
            .map(ing => ingredientMap[ing.trim()])
            .filter(root => root !== null); // Yoksayılan malzemeleri (null) çıkar
        
        // Ürünün kök malzemelerinden EN AZ BİRİ, kullanıcının seçtiği malzemelerle eşleşiyor mu?
        return Array.from(selectedIngredients).some(selected => itemRoots.includes(selected));
    });

    if (matchingProducts.length === 0) {
        matchedList.innerHTML = "<p style='color:red;'>Bu içeriklere sahip ürün bulunamadı.</p>";
    } else {
        matchingProducts.forEach(item => renderMenuItem(item, matchedList));
    }

    document.getElementById("products-modal-overlay").style.display = "block";
}

function closeProductsModal(event) {
    if (event && event.target.id !== "products-modal-overlay") return;
    document.getElementById("products-modal-overlay").style.display = "none";
}

// 6. Ürün Kartını Modal İçinde Çizme (Menü sistemiyle aynı görünüm)
function renderMenuItem(item, container) {
    let guncelMiktar = getCartQuantity(item.id);
    let div = document.createElement("div");
    div.className = "menu-item";

    let veganBadge = item.vegan ? `
      <div style="text-align: right; margin-top: 10px;">
        <span style="font-size: 12px; background: #e8f5e9; color: #2e7d32; padding: 3px 10px; border-radius: 12px; font-weight: bold; border: 1px solid #a5d6a7;">🌱 Vegan</span>
      </div>` : "";

    div.innerHTML = `
       <div class="menu-item-top">
           <div style="flex: 1;">
               <div style="font-weight: bold; font-size: 19px; color: #333; margin-bottom: 2px;">
                   ${item.isim}
               </div>
               <div style="font-size: 13px; color: #888; margin-bottom: 8px; line-height: 1.2;">${item.aciklama || ""}</div>
               <div style="font-weight: bold; color: #4CAF50; font-size: 16px;">${item.fiyat} TL</div>
           </div>
           <img src="${item.resim}" class="item-thumbnail" alt="${item.isim}">
       </div>
       
       <div class="item-controls" onclick="event.stopPropagation()">
           <button onclick="handleAddToCartFromIngredients(${item.id}, -1)" style="padding: 5px 20px; font-size: 18px; border-color: #ff4c4c; color: #ff4c4c; font-weight:bold;">-</button>
           <span id="qty-ing-${item.id}" style="font-weight: bold; font-size: 18px; width: 30px; text-align: center; color: #333;">${guncelMiktar}</span>
           <button onclick="handleAddToCartFromIngredients(${item.id}, 1)" style="padding: 5px 20px; font-size: 18px; border-color: #4CAF50; color: #4CAF50; font-weight:bold;">+</button>
       </div>
       ${veganBadge}
    `;

    container.appendChild(div);
}

// 7. Sepet İşlemleri (Tüm siteyle entegre çalışır)
function getSafeCart() {
    try {
        let cart = JSON.parse(localStorage.getItem("cart"));
        if (!Array.isArray(cart)) return [];
        return cart;
    } catch (e) {
        return [];
    }
}

function getCartQuantity(id) {
    let cart = getSafeCart();
    let item = cart.find(c => c.id === id);
    return item ? item.quantity : 0;
}

function handleAddToCartFromIngredients(id, change) {
    let cart = getSafeCart();
    let existingItem = cart.find(c => c.id === id);

    if (change > 0) {
        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            let menuItem = menu.find(m => m.id === id);
            cart.push({ ...menuItem, quantity: 1 });
        }
    } else if (change < 0 && existingItem) {
        existingItem.quantity -= 1;
        if (existingItem.quantity <= 0) {
            cart = cart.filter(c => c.id !== id);
        }
    }

    localStorage.setItem("cart", JSON.stringify(cart));
    document.getElementById(`qty-ing-${id}`).innerText = getCartQuantity(id);
}let menu = [];
let uniqueIngredients = [];
let selectedIngredients = new Set();

// 1. Normalization Dictionary
// This groups similar ingredients into one generic category.
const ingredientDictionary = {
    "Sıcak Süt": "Süt",
    "Süt Köpüğü": "Süt",
    "Double Espresso": "Espresso",
    "Taze Sıkım Limon": "Limon",
    "Kola Özütü": "Kola",
    "Tam Buğday Ekmeği": "Ekmek"
};

// Function to normalize an ingredient name
function normalize(ingredient) {
    return ingredientDictionary[ingredient] || ingredient;
}

// 2. Fetch Menu and Extract Unique Ingredients
window.addEventListener("load", function () {
    fetch("/api/menu")
        .then(res => res.json())
        .then(data => {
            menu = data;
            extractIngredients();
            renderIngredients();
        })
        .catch(err => console.error("Menü yüklenemedi:", err));
});

function extractIngredients() {
    let allIngredients = new Set();
    
    menu.forEach(item => {
        if (item.icerik) {
            item.icerik.forEach(ing => {
                allIngredients.add(normalize(ing));
            });
        }
    });

    uniqueIngredients = Array.from(allIngredients).sort();
}

// 3. Render Ingredients Grid
function renderIngredients() {
    const grid = document.getElementById("ingredients-grid");
    grid.innerHTML = "";

    uniqueIngredients.forEach(ing => {
        let div = document.createElement("div");
        div.className = "ingredient-card";
        
        // Generate a generic placeholder picture with the first letter of the ingredient
        let genericPic = `https://placehold.co/100x100/eeeeee/4CAF50?text=${ing.charAt(0)}&font=Montserrat`;

        div.innerHTML = `
            <img src="${genericPic}" class="ingredient-img" alt="${ing}">
            <div class="ingredient-name">${ing}</div>
        `;

        div.onclick = () => toggleIngredient(ing, div);
        grid.appendChild(div);
    });
}

function toggleIngredient(ingredient, element) {
    if (selectedIngredients.has(ingredient)) {
        selectedIngredients.delete(ingredient);
        element.classList.remove("selected");
    } else {
        selectedIngredients.add(ingredient);
        element.classList.add("selected");
    }
}

// 4. Show Matching Products
function showMatchingProducts() {
    if (selectedIngredients.size === 0) {
        alert("Lütfen en az bir malzeme seçin.");
        return;
    }

    const matchedList = document.getElementById("matched-menu-list");
    matchedList.innerHTML = "";

    // Filter products: product must contain AT LEAST ONE of the selected ingredients
    const matchingProducts = menu.filter(item => {
        if (!item.icerik) return false;
        const normalizedItemIngredients = item.icerik.map(ing => normalize(ing));
        return normalizedItemIngredients.some(ing => selectedIngredients.has(ing));
    });

    if (matchingProducts.length === 0) {
        matchedList.innerHTML = "<p style='color:red;'>Bu içeriklere sahip ürün bulunamadı.</p>";
    } else {
        matchingProducts.forEach(item => renderMenuItem(item, matchedList));
    }

    document.getElementById("products-modal-overlay").style.display = "block";
}

function closeProductsModal(event) {
    if (event && event.target.id !== "products-modal-overlay") return;
    document.getElementById("products-modal-overlay").style.display = "none";
}

// 5. Render Individual Menu Items inside the Modal (Identical to menu_script.js)
function renderMenuItem(item, container) {
    let guncelMiktar = getCartQuantity(item.id);
    let div = document.createElement("div");
    div.className = "menu-item";

    let veganBadge = item.vegan ? `
      <div style="text-align: right; margin-top: 10px;">
        <span style="font-size: 12px; background: #e8f5e9; color: #2e7d32; padding: 3px 10px; border-radius: 12px; font-weight: bold; border: 1px solid #a5d6a7;">🌱 Vegan</span>
      </div>` : "";

    div.innerHTML = `
       <div class="menu-item-top">
           <div style="flex: 1;">
               <div style="font-weight: bold; font-size: 19px; color: #333; margin-bottom: 2px;">
                   ${item.isim}
               </div>
               <div style="font-size: 13px; color: #888; margin-bottom: 8px; line-height: 1.2;">${item.aciklama || ""}</div>
               <div style="font-weight: bold; color: #4CAF50; font-size: 16px;">${item.fiyat} TL</div>
           </div>
           <img src="${item.resim}" class="item-thumbnail" alt="${item.isim}">
       </div>
       
       <div class="item-controls" onclick="event.stopPropagation()">
           <button onclick="handleAddToCartFromIngredients(${item.id}, -1)" style="padding: 5px 20px; font-size: 18px; border-color: #ff4c4c; color: #ff4c4c; font-weight:bold;">-</button>
           <span id="qty-ing-${item.id}" style="font-weight: bold; font-size: 18px; width: 30px; text-align: center; color: #333;">${guncelMiktar}</span>
           <button onclick="handleAddToCartFromIngredients(${item.id}, 1)" style="padding: 5px 20px; font-size: 18px; border-color: #4CAF50; color: #4CAF50; font-weight:bold;">+</button>
       </div>
       ${veganBadge}
    `;

    container.appendChild(div);
}

// 6. Cart Logic (Shared behavior with menu_script.js)
function getSafeCart() {
    try {
        let cart = JSON.parse(localStorage.getItem("cart"));
        if (!Array.isArray(cart)) return [];
        return cart;
    } catch (e) {
        return [];
    }
}

function getCartQuantity(id) {
    let cart = getSafeCart();
    let item = cart.find(c => c.id === id);
    return item ? item.quantity : 0;
}

function handleAddToCartFromIngredients(id, change) {
    let cart = getSafeCart();
    let existingItem = cart.find(c => c.id === id);

    if (change > 0) {
        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            let menuItem = menu.find(m => m.id === id);
            cart.push({ ...menuItem, quantity: 1 });
        }
    } else if (change < 0 && existingItem) {
        existingItem.quantity -= 1;
        if (existingItem.quantity <= 0) {
            cart = cart.filter(c => c.id !== id);
        }
    }

    localStorage.setItem("cart", JSON.stringify(cart));
    document.getElementById(`qty-ing-${id}`).innerText = getCartQuantity(id);
}
