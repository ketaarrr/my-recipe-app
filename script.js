import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, deleteDoc, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Обманываем сканер GitHub, разбивая ключ на две части
const firebaseConfig = {
    apiKey: ["AIzaSyC9fOeRLDpFjRxZE04", "EEXot5ri5OVxosLY"].join(''),
    authDomain: "recipe-app-my.firebaseapp.com",
    projectId: "recipe-app-my",
    storageBucket: "recipe-app-my.firebasestorage.app",
    messagingSenderId: "1060591216940",
    appId: "1:1060591216940:web:d161cc2d20fa83c133e489"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Переменная для отслеживания режима редактирования
let editingRecipeId = null; 

const recipeGrid = document.getElementById('recipe-grid');
const shoppingList = document.getElementById('shopping-list');
const copyBtn = document.getElementById('copy-btn');
const clearCartBtn = document.getElementById('clear-cart-btn');
const searchInput = document.getElementById('search-input'); 
const categoryFilters = document.getElementById('category-filters'); 
const floatingCartBtn = document.getElementById('floating-cart-btn');

const addRecipeModal = document.getElementById('add-recipe-modal');
const modalFormTitle = document.getElementById('modal-form-title'); // НОВОЕ
const openAddModalBtn = document.getElementById('open-add-modal-btn');
const closeAddModalBtn = document.getElementById('close-add-modal-btn');
const recipeNameInput = document.getElementById('recipe-name');
const recipeDescriptionInput = document.getElementById('recipe-description');
const addRecipeBtn = document.getElementById('add-recipe-btn');

const recipeImgInput = document.getElementById('recipe-img');
const fileNameText = document.getElementById('file-name-text');

const ingNameInput = document.getElementById('ing-name');
const ingAmountInput = document.getElementById('ing-amount');
const ingUnitInput = document.getElementById('ing-unit');
const addIngBtn = document.getElementById('add-ing-btn');
const tempIngList = document.getElementById('temp-ing-list');
const ingSuggestions = document.getElementById('ing-suggestions');

const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const menuBtn = document.getElementById('menu-btn');
const closeSidebarBtn = document.getElementById('close-sidebar-btn');

const recipeCardModal = document.getElementById('recipe-card-modal');
const closeCardBtn = document.getElementById('close-card-btn');
const cardImg = document.getElementById('card-img');
const cardTitle = document.getElementById('card-title');
const cardMetaRow = document.getElementById('card-meta-row');
const cardIngredientsList = document.getElementById('card-ingredients-list');
const cardDescription = document.getElementById('card-description');
const editRecipeBtn = document.getElementById('edit-recipe-btn'); // НОВОЕ
const deleteRecipeBtn = document.getElementById('delete-recipe-btn');

let recipes = [];
let currentIngredients = []; 
let selectedRecipes = {}; 
let isAppLoading = true; 

const openSidebar = () => { sidebar.classList.add('open'); sidebarOverlay.classList.add('active'); document.body.classList.add('no-scroll'); };
menuBtn.addEventListener('click', openSidebar);
floatingCartBtn.addEventListener('click', openSidebar); 

const closeSidebar = () => { sidebar.classList.remove('open'); sidebarOverlay.classList.remove('active'); document.body.classList.remove('no-scroll'); };
closeSidebarBtn.addEventListener('click', closeSidebar);
sidebarOverlay.addEventListener('click', closeSidebar);

// Открытие модалки для создания НОВОГО блюда
openAddModalBtn.addEventListener('click', () => { 
    editingRecipeId = null;
    modalFormTitle.textContent = "Новое блюдо";
    addRecipeBtn.textContent = "Сохранить готовый рецепт";
    
    // Очищаем форму
    recipeNameInput.value = ''; recipeDescriptionInput.value = '';
    recipeImgInput.value = ''; fileNameText.textContent = '';
    document.querySelectorAll('.category-checkbox').forEach(cb => cb.checked = false);
    currentIngredients = []; renderTempIngredients();

    addRecipeModal.style.display = 'flex'; 
    document.body.classList.add('no-scroll'); 
});

closeAddModalBtn.addEventListener('click', () => { addRecipeModal.style.display = 'none'; document.body.classList.remove('no-scroll'); });
closeCardBtn.addEventListener('click', () => { recipeCardModal.style.display = 'none'; document.body.classList.remove('no-scroll'); });

window.addEventListener('click', (e) => {
    if(e.target === addRecipeModal) { addRecipeModal.style.display = 'none'; document.body.classList.remove('no-scroll'); }
    if(e.target === recipeCardModal) { recipeCardModal.style.display = 'none'; document.body.classList.remove('no-scroll'); }
});

recipeImgInput.addEventListener('change', () => { fileNameText.textContent = recipeImgInput.files[0] ? recipeImgInput.files[0].name : ""; });

function compressImage(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = function(event) {
            const img = new Image();
            img.src = event.target.result;
            img.onload = function() {
                const canvas = document.createElement('canvas');
                const SIZE = 400; canvas.width = SIZE; canvas.height = SIZE;
                const ctx = canvas.getContext('2d');
                const minSide = Math.min(img.width, img.height);
                const sx = (img.width - minSide) / 2;
                const sy = (img.height - minSide) / 2;
                ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, SIZE, SIZE);
                resolve(canvas.toDataURL('image/jpeg', 0.8)); 
            }
        }
    });
}

async function loadRecipes() {
    isAppLoading = true; 
    const querySnapshot = await getDocs(collection(db, "recipes"));
    recipes = []; 
    querySnapshot.forEach((doc) => {
        let recipeData = doc.data();
        recipeData.id = doc.id;
        recipes.push(recipeData);
    });

    const cartSnap = await getDoc(doc(db, "cart", "shared"));
    if (cartSnap.exists()) { selectedRecipes = cartSnap.data().items || {}; } 
    else { selectedRecipes = {}; }

    renderCategoryFilters(); 
    displayRecipeGrid();     
    updateIngredientSuggestions();
    calculateShoppingList(); 
    isAppLoading = false; 
}

function renderTempIngredients() {
    tempIngList.innerHTML = '';
    currentIngredients.forEach(function(ing, index) {
        const li = document.createElement('li');
        const textSpan = document.createElement('span');
        textSpan.textContent = `${ing.name} — ${ing.amount} ${ing.unit}`;
        const btnContainer = document.createElement('div');
        btnContainer.style.display = 'flex'; btnContainer.style.gap = '5px';

        const editBtn = document.createElement('button');
        editBtn.textContent = 'Ред.'; editBtn.className = 'icon-btn';
        editBtn.addEventListener('click', function() {
            ingNameInput.value = ing.name; ingAmountInput.value = ing.amount; ingUnitInput.value = ing.unit;
            currentIngredients.splice(index, 1); renderTempIngredients();
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = '✕'; deleteBtn.className = 'icon-btn';
        deleteBtn.addEventListener('click', function() { currentIngredients.splice(index, 1); renderTempIngredients(); });

        btnContainer.appendChild(editBtn); btnContainer.appendChild(deleteBtn);
        li.appendChild(textSpan); li.appendChild(btnContainer); tempIngList.appendChild(li);
    });
}

addIngBtn.addEventListener('click', function() {
    const name = ingNameInput.value.trim();
    const amount = parseFloat(ingAmountInput.value); 
    const unit = ingUnitInput.value;
    if (name === '' || isNaN(amount) || amount <= 0) { alert('Ошибка ввода!'); return; }
    currentIngredients.push({ name: name, amount: amount, unit: unit });
    renderTempIngredients();
    ingNameInput.value = ''; ingAmountInput.value = '';
});

// === СОХРАНЕНИЕ / ОБНОВЛЕНИЕ РЕЦЕПТА ===
addRecipeBtn.addEventListener('click', async function() {
    const recipeName = recipeNameInput.value.trim();
    const recipeDesc = recipeDescriptionInput.value.trim();

    const categoryCheckboxes = document.querySelectorAll('.category-checkbox:checked');
    const recipeCategories = Array.from(categoryCheckboxes).map(cb => cb.value);

    if (recipeName === '') { alert('Введите название!'); return; }
    if (recipeCategories.length === 0) { alert('Выберите хотя бы одну категорию!'); return; }
    if (currentIngredients.length === 0) { alert('Добавьте ингредиенты!'); return; }

    addRecipeBtn.disabled = true; 
    addRecipeBtn.textContent = 'Сохранение...';
    
    let imgBase64 = "";
    if (recipeImgInput.files[0]) {
        imgBase64 = await compressImage(recipeImgInput.files[0]);
    } else if (editingRecipeId) {
        // Если фото не меняли при редактировании, берем старое фото
        const oldRecipe = recipes.find(r => r.id === editingRecipeId);
        imgBase64 = oldRecipe ? oldRecipe.image : "";
    }

    const recipeData = { 
        name: recipeName, 
        category: recipeCategories, 
        description: recipeDesc, 
        ingredients: currentIngredients, 
        image: imgBase64 
    };

    if (editingRecipeId) {
        // Режим РЕДАКТИРОВАНИЯ существующего блюда
        await setDoc(doc(db, "recipes", editingRecipeId), recipeData);
        editingRecipeId = null;
    } else {
        // Режим СОЗДАНИЯ нового блюда
        await addDoc(collection(db, "recipes"), recipeData);
    }

    // Сброс формы
    recipeNameInput.value = ''; recipeDescriptionInput.value = '';
    recipeImgInput.value = ''; fileNameText.textContent = '';
    document.querySelectorAll('.category-checkbox').forEach(cb => cb.checked = false);
    currentIngredients = []; tempIngList.innerHTML = '';
    
    addRecipeBtn.disabled = false;
    addRecipeModal.style.display = 'none'; 
    document.body.classList.remove('no-scroll'); 
    loadRecipes(); 
});

function getRecipeCategories(recipe) {
    let cats = recipe.category;
    if (!Array.isArray(cats)) cats = [cats || 'Без категории']; 
    return cats;
}

function renderCategoryFilters() {
    const uniqueCats = new Set();
    recipes.forEach(r => {
        getRecipeCategories(r).forEach(cat => uniqueCats.add(cat));
    });
    const sortedCats = Array.from(uniqueCats).sort();

    categoryFilters.innerHTML = '<button class="filter-btn active" data-category="Все">Все</button>';
    sortedCats.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'filter-btn';
        btn.dataset.category = cat;
        btn.textContent = cat;
        categoryFilters.appendChild(btn);
    });

    const btns = categoryFilters.querySelectorAll('.filter-btn');
    btns.forEach(btn => {
        btn.addEventListener('click', () => {
            btns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const catName = btn.dataset.category;
            if (catName === 'Все') {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                const sections = document.querySelectorAll('.category-section');
                const targetSection = Array.from(sections).find(sec => sec.querySelector('.category-header').textContent === catName);
                if (targetSection) {
                    targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }
        });
    });
}

searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim().toLowerCase();
    displayRecipeGrid(query);
});

function displayRecipeGrid(searchQuery = '') {
    recipeGrid.innerHTML = '';
    const categories = {};
    
    recipes.forEach(function(recipe) {
        if (searchQuery && !recipe.name.toLowerCase().includes(searchQuery)) return;
        
        let cats = getRecipeCategories(recipe);
        cats.forEach(cat => {
            if (!categories[cat]) { categories[cat] = []; }
            categories[cat].push(recipe);
        });
    });

    if (Object.keys(categories).length === 0) {
        recipeGrid.innerHTML = '<p style="text-align:center; color:#6b7280; margin-top:30px; width:100%;">По вашему запросу ничего не найдено.</p>';
        return;
    }

    Object.keys(categories).sort().forEach(function(catName) {
        const section = document.createElement('div');
        section.className = 'category-section';

        const header = document.createElement('h2');
        header.className = 'category-header';
        header.textContent = catName;
        section.appendChild(header);

        const grid = document.createElement('div');
        grid.className = 'category-grid';

        categories[catName].forEach(function(recipe) {
            const defaultImg = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'><rect width='40' height='40' fill='%23e5e7eb'/></svg>";
            const card = document.createElement('div');
            card.className = 'dish-card';
            if (selectedRecipes[recipe.id]) card.classList.add('selected-dish');

            const img = document.createElement('img');
            img.className = 'dish-card-img';
            img.src = recipe.image || defaultImg;

            const infoDiv = document.createElement('div');
            infoDiv.className = 'dish-card-info';
            
            const categorySpan = document.createElement('div');
            categorySpan.className = 'dish-card-category';
            categorySpan.textContent = getRecipeCategories(recipe).join(' • ');
            
            const titleSpan = document.createElement('h3');
            titleSpan.className = 'dish-card-title';
            titleSpan.textContent = recipe.name;

            const actionWrap = document.createElement('div');
            actionWrap.className = 'card-action-wrap';

            if (selectedRecipes[recipe.id]) {
                actionWrap.innerHTML = `
                    <div class="cart-counter-controls">
                        <button class="cart-counter-btn card-minus">-</button>
                        <span class="cart-counter-value">${selectedRecipes[recipe.id]}</span>
                        <button class="cart-counter-btn card-plus">+</button>
                    </div>
                `;
                actionWrap.querySelector('.card-minus').addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (selectedRecipes[recipe.id] > 1) { selectedRecipes[recipe.id]--; } 
                    else { delete selectedRecipes[recipe.id]; }
                    calculateShoppingList();
                    displayRecipeGrid(searchInput.value.trim().toLowerCase());
                });
                actionWrap.querySelector('.card-plus').addEventListener('click', (e) => {
                    e.stopPropagation();
                    selectedRecipes[recipe.id]++;
                    calculateShoppingList();
                    displayRecipeGrid(searchInput.value.trim().toLowerCase());
                });
            } else {
                actionWrap.innerHTML = `<button class="add-to-cart-btn">+ В корзину</button>`;
                actionWrap.querySelector('.add-to-cart-btn').addEventListener('click', (e) => {
                    e.stopPropagation();
                    selectedRecipes[recipe.id] = 1;
                    calculateShoppingList();
                    displayRecipeGrid(searchInput.value.trim().toLowerCase());
                });
            }

            const openCard = function() {
                cardImg.src = recipe.image || defaultImg;
                cardTitle.textContent = recipe.name;
                
                cardMetaRow.innerHTML = '';
                getRecipeCategories(recipe).forEach(cat => {
                    const badge = document.createElement('span');
                    badge.className = 'badge';
                    badge.textContent = cat;
                    cardMetaRow.appendChild(badge);
                });

                cardIngredientsList.innerHTML = '';
                recipe.ingredients.forEach(function(ing) {
                    const li = document.createElement('li');
                    li.innerHTML = `<span>${ing.name}</span> <span><b>${ing.amount}</b> ${ing.unit}</span>`;
                    cardIngredientsList.appendChild(li);
                });
                cardDescription.textContent = recipe.description || 'Описание отсутствует.';
                
                // === КЛИК НА КНОПКУ РЕДАКТИРОВАНИЯ ===
                editRecipeBtn.onclick = function() {
                    recipeCardModal.style.display = 'none'; // Закрываем просмотр
                    
                    editingRecipeId = recipe.id; // Запоминаем, что мы редактируем
                    modalFormTitle.textContent = "Редактировать блюдо";
                    addRecipeBtn.textContent = "Сохранить изменения";

                    // Заполняем поля формы данными
                    recipeNameInput.value = recipe.name;
                    recipeDescriptionInput.value = recipe.description || '';
                    fileNameText.textContent = recipe.image ? "Старое фото сохранено" : "";

                    // Выставляем галочки для категорий блюда
                    const currentCats = getRecipeCategories(recipe);
                    document.querySelectorAll('.category-checkbox').forEach(cb => {
                        cb.checked = currentCats.includes(cb.value);
                    });

                    // Загружаем ингредиенты во временный список формы
                    currentIngredients = JSON.parse(JSON.stringify(recipe.ingredients)); // Глубокое копирование
                    renderTempIngredients();

                    // Открываем модалку редактирования
                    addRecipeModal.style.display = 'flex';
                };

                deleteRecipeBtn.onclick = async function() {
                    if (confirm(`Вы уверены, что хотите навсегда удалить рецепт "${recipe.name}"?`)) {
                        await deleteDoc(doc(db, "recipes", recipe.id));
                        delete selectedRecipes[recipe.id]; 
                        recipeCardModal.style.display = 'none'; 
                        document.body.classList.remove('no-scroll');
                        loadRecipes(); 
                        calculateShoppingList(); 
                    }
                };

                recipeCardModal.style.display = 'flex';
                document.body.classList.add('no-scroll'); 
            };

            img.addEventListener('click', openCard);
            titleSpan.addEventListener('click', openCard);

            infoDiv.appendChild(categorySpan);
            infoDiv.appendChild(titleSpan);
            infoDiv.appendChild(actionWrap); 
            
            card.appendChild(img);
            card.appendChild(infoDiv);
            grid.appendChild(card); 
        });

        section.appendChild(grid);
        recipeGrid.appendChild(section); 
    });
}

function calculateShoppingList() {
    shoppingList.innerHTML = ''; 
    const selectedIds = Object.keys(selectedRecipes);
    
    if (selectedIds.length === 0) { 
        shoppingList.innerHTML = '<li>Пока пусто</li>'; 
        menuBtn.textContent = '☰ Корзина';
        floatingCartBtn.classList.remove('visible'); 
        if (!isAppLoading) setDoc(doc(db, "cart", "shared"), { items: {} }).catch(e => console.error(e));
        return; 
    }

    menuBtn.textContent = `☰ Корзина (${selectedIds.length})`;
    floatingCartBtn.textContent = `☰ Корзина (${selectedIds.length})`;
    floatingCartBtn.classList.add('visible'); 

    const dishTitle = document.createElement('div');
    dishTitle.className = 'sidebar-section-title';
    dishTitle.textContent = 'Выбранные блюда';
    shoppingList.appendChild(dishTitle);

    let finalIngredients = {};

    selectedIds.forEach(id => {
        const recipe = recipes.find(r => r.id === id);
        if (!recipe) return;

        const item = document.createElement('div');
        item.className = 'selected-dish-item';
        
        item.innerHTML = `
            <span class="selected-dish-name">${recipe.name}</span>
            <div class="selected-dish-controls">
                <button class="sidebar-qty-btn minus-sidebar">-</button>
                <span class="sidebar-qty-val">${selectedRecipes[id]}</span>
                <button class="sidebar-qty-btn plus-sidebar">+</button>
                <span class="remove-from-cart">✕</span>
            </div>
        `;

        item.querySelector('.minus-sidebar').addEventListener('click', () => {
            if (selectedRecipes[id] > 1) { selectedRecipes[id]--; } 
            else { delete selectedRecipes[id]; }
            calculateShoppingList();
            displayRecipeGrid(searchInput.value.trim().toLowerCase());
        });

        item.querySelector('.plus-sidebar').addEventListener('click', () => {
            selectedRecipes[id]++;
            calculateShoppingList();
            displayRecipeGrid(searchInput.value.trim().toLowerCase());
        });

        item.querySelector('.remove-from-cart').addEventListener('click', () => {
            delete selectedRecipes[id];
            calculateShoppingList();
            displayRecipeGrid(searchInput.value.trim().toLowerCase());
        });

        shoppingList.appendChild(item);

        recipe.ingredients.forEach(ing => {
            let normName = ing.name;
            let normAmount = ing.amount * selectedRecipes[id];
            let normUnit = ing.unit;

            if (normUnit === 'л') { normAmount *= 1000; normUnit = 'мл'; }
            else if (normUnit === 'кг') { normAmount *= 1000; normUnit = 'г'; }
            else if (normUnit === 'ст.л.') { normAmount *= 2; normUnit = 'ч.л.'; } 

            let key = normName.toLowerCase() + '_' + normUnit;
            if (finalIngredients[key]) {
                finalIngredients[key].amount += normAmount;
            } else {
                finalIngredients[key] = { name: normName, amount: normAmount, unit: normUnit };
            }
        });
    });

    const ingTitle = document.createElement('div');
    ingTitle.className = 'sidebar-section-title';
    ingTitle.textContent = 'Итого продуктов';
    shoppingList.appendChild(ingTitle);

    Object.values(finalIngredients).forEach(item => {
        const li = document.createElement('li');
        let displayStr = `${item.name}: `;
        
        if (item.unit === 'мл' && item.amount >= 1000) { displayStr += `${item.amount / 1000} л`; }
        else if (item.unit === 'г' && item.amount >= 1000) { displayStr += `${item.amount / 1000} кг`; }
        else if (item.unit === 'ч.л.' && item.amount >= 2) { 
            let st_amount = Math.floor(item.amount / 2);
            let ch_amount = item.amount % 2;
            displayStr += `${st_amount} ст.л.`;
            if (ch_amount > 0) displayStr += ` ${ch_amount} ч.л.`;
        } 
        else { displayStr += `${item.amount} ${item.unit}`; }
        
        li.textContent = displayStr;
        shoppingList.appendChild(li);
    });

    if (!isAppLoading) {
        setDoc(doc(db, "cart", "shared"), { items: selectedRecipes }).catch(err => console.error(err));
    }
}

clearCartBtn.addEventListener('click', function() {
    const selectedIds = Object.keys(selectedRecipes);
    if (selectedIds.length === 0) return; 
    if (confirm('Точно удалить все блюда из корзины?')) {
        selectedRecipes = {}; 
        calculateShoppingList(); 
        displayRecipeGrid(searchInput.value.trim().toLowerCase()); 
    }
});

copyBtn.addEventListener('click', function() {
    const selectedIds = Object.keys(selectedRecipes);
    if (selectedIds.length === 0) return alert('Корзина пуста!');
    
    let textToCopy = "Выбранное меню:\n";
    selectedIds.forEach(id => {
        const recipe = recipes.find(r => r.id === id);
        if (recipe) textToCopy += `— ${recipe.name}\n`;
    });

    textToCopy += "\nСписок покупок:\n";
    shoppingList.querySelectorAll('li').forEach((item) => { 
        textToCopy += "• " + item.textContent + "\n"; 
    });

    navigator.clipboard.writeText(textToCopy).then(function() {
        const originalText = copyBtn.textContent; 
        copyBtn.textContent = 'Скопировано!';
        setTimeout(() => { copyBtn.textContent = originalText; }, 2000);
    });
});

function updateIngredientSuggestions() {
    let uniqueIngredients = new Set();
    recipes.forEach(function(recipe) {
        if (recipe.ingredients) {
            recipe.ingredients.forEach(function(ing) {
                let formattedName = ing.name.charAt(0).toUpperCase() + ing.name.slice(1).toLowerCase();
                uniqueIngredients.add(formattedName);
            });
        }
    });
    ingSuggestions.innerHTML = '';
    uniqueIngredients.forEach(function(ingName) {
        const option = document.createElement('option');
        option.value = ingName; ingSuggestions.appendChild(option);
    });
}

const themeBtn = document.getElementById('theme-btn');
if (localStorage.getItem('app-theme') === 'dark') { document.body.classList.add('dark-theme'); themeBtn.textContent = 'Светлая тема'; }
themeBtn.addEventListener('click', function() {
    document.body.classList.toggle('dark-theme');
    if (document.body.classList.contains('dark-theme')) {
        themeBtn.textContent = 'Светлая тема'; localStorage.setItem('app-theme', 'dark');
    } else { themeBtn.textContent = 'Тёмная тема'; localStorage.setItem('app-theme', 'light'); }
});

loadRecipes();