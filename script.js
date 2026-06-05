import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// !!! ТВОИ КЛЮЧИ !!!
const firebaseConfig = {
    apiKey: "AIzaSyC9fOeRLDpFjRxZE04EEXot5ri5OVxosLY",
    authDomain: "recipe-app-my.firebaseapp.com",
    projectId: "recipe-app-my",
    storageBucket: "recipe-app-my.firebasestorage.app",
    messagingSenderId: "1060591216940",
    appId: "1:1060591216940:web:d161cc2d20fa83c133e489"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// === ЭЛЕМЕНТЫ ИНТЕРФЕЙСА ===
const recipeGrid = document.getElementById('recipe-grid');
const shoppingList = document.getElementById('shopping-list');
const copyBtn = document.getElementById('copy-btn');

// Модальное окно добавления
const addRecipeModal = document.getElementById('add-recipe-modal');
const openAddModalBtn = document.getElementById('open-add-modal-btn');
const closeAddModalBtn = document.getElementById('close-add-modal-btn');
const recipeNameInput = document.getElementById('recipe-name');
const recipeCategoryInput = document.getElementById('recipe-category');
const recipeDescriptionInput = document.getElementById('recipe-description');
const addRecipeBtn = document.getElementById('add-recipe-btn');

// Фото
const recipeImgInput = document.getElementById('recipe-img');
const fileNameText = document.getElementById('file-name-text');

// Ингредиенты в форме
const ingNameInput = document.getElementById('ing-name');
const ingAmountInput = document.getElementById('ing-amount');
const ingUnitInput = document.getElementById('ing-unit');
const addIngBtn = document.getElementById('add-ing-btn');
const tempIngList = document.getElementById('temp-ing-list');
const ingSuggestions = document.getElementById('ing-suggestions');

// Корзина (Боковая панель)
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const menuBtn = document.getElementById('menu-btn');
const closeSidebarBtn = document.getElementById('close-sidebar-btn');

// Карточка деталей блюда
const recipeCardModal = document.getElementById('recipe-card-modal');
const closeCardBtn = document.getElementById('close-card-btn');
const cardImg = document.getElementById('card-img');
const cardTitle = document.getElementById('card-title');
const cardCategory = document.getElementById('card-category');
const cardIngredientsList = document.getElementById('card-ingredients-list');
const cardDescription = document.getElementById('card-description');
const deleteRecipeBtn = document.getElementById('delete-recipe-btn');

// Данные
let recipes = [];
let currentIngredients = []; 
let selectedRecipes = {}; 

// === УПРАВЛЕНИЕ ОКНАМИ И ПРОКРУТКОЙ ===
menuBtn.addEventListener('click', () => { 
    sidebar.classList.add('open'); 
    sidebarOverlay.classList.add('active'); 
    document.body.classList.add('no-scroll'); 
});

const closeSidebar = () => { 
    sidebar.classList.remove('open'); 
    sidebarOverlay.classList.remove('active'); 
    document.body.classList.remove('no-scroll'); 
};
closeSidebarBtn.addEventListener('click', closeSidebar);
sidebarOverlay.addEventListener('click', closeSidebar);

openAddModalBtn.addEventListener('click', () => { 
    addRecipeModal.style.display = 'flex'; 
    document.body.classList.add('no-scroll'); 
});

closeAddModalBtn.addEventListener('click', () => { 
    addRecipeModal.style.display = 'none'; 
    document.body.classList.remove('no-scroll'); 
});

closeCardBtn.addEventListener('click', () => { 
    recipeCardModal.style.display = 'none'; 
    document.body.classList.remove('no-scroll'); 
});

window.addEventListener('click', (e) => {
    if(e.target === addRecipeModal) {
        addRecipeModal.style.display = 'none';
        document.body.classList.remove('no-scroll');
    }
    if(e.target === recipeCardModal) {
        recipeCardModal.style.display = 'none';
        document.body.classList.remove('no-scroll');
    }
});

recipeImgInput.addEventListener('change', () => {
    fileNameText.textContent = recipeImgInput.files[0] ? recipeImgInput.files[0].name : "";
});

// === СЖАТИЕ ФОТО ===
function compressImage(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = function(event) {
            const img = new Image();
            img.src = event.target.result;
            img.onload = function() {
                const canvas = document.createElement('canvas');
                const SIZE = 400; 
                canvas.width = SIZE; canvas.height = SIZE;
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

// === ЗАГРУЗКА ИЗ БД ===
async function loadRecipes() {
    const querySnapshot = await getDocs(collection(db, "recipes"));
    recipes = []; 
    querySnapshot.forEach((doc) => {
        let recipeData = doc.data();
        recipeData.id = doc.id;
        recipes.push(recipeData);
    });
    displayRecipeGrid();
    updateIngredientSuggestions();
}

// === ВРЕМЕННЫЙ СПИСОК ИНГРЕДИЕНТОВ ===
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
        deleteBtn.addEventListener('click', function() {
            currentIngredients.splice(index, 1); renderTempIngredients();
        });

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

// === СОХРАНЕНИЕ НОВОГО БЛЮДА ===
addRecipeBtn.addEventListener('click', async function() {
    const recipeName = recipeNameInput.value.trim();
    const recipeCategory = recipeCategoryInput.value;
    const recipeDesc = recipeDescriptionInput.value.trim();

    if (recipeName === '') { alert('Введите название!'); return; }
    if (recipeCategory === '') { alert('Выберите категорию!'); return; }
    if (currentIngredients.length === 0) { alert('Добавьте ингредиенты!'); return; }

    addRecipeBtn.disabled = true; addRecipeBtn.textContent = 'Сохранение...';
    let imgBase64 = "";
    if (recipeImgInput.files[0]) imgBase64 = await compressImage(recipeImgInput.files[0]);

    await addDoc(collection(db, "recipes"), { 
        name: recipeName, 
        category: recipeCategory,
        description: recipeDesc,
        ingredients: currentIngredients, 
        image: imgBase64 
    });

    recipeNameInput.value = ''; recipeCategoryInput.value = ''; recipeDescriptionInput.value = '';
    recipeImgInput.value = ''; fileNameText.textContent = '';
    currentIngredients = []; tempIngList.innerHTML = '';
    addRecipeBtn.disabled = false; addRecipeBtn.textContent = 'Сохранить готовый рецепт';
    
    addRecipeModal.style.display = 'none'; 
    document.body.classList.remove('no-scroll'); 
    loadRecipes(); 
});

// === ОТОБРАЖЕНИЕ ВИТРИНЫ ПО КАТЕГОРИЯМ ===
function displayRecipeGrid() {
    recipeGrid.innerHTML = '';

    const categories = {};
    
    recipes.forEach(function(recipe) {
        const cat = recipe.category || 'Без категории'; 
        if (!categories[cat]) { categories[cat] = []; }
        categories[cat].push(recipe);
    });

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
            categorySpan.textContent = recipe.category || 'Без категории';
            
            const titleSpan = document.createElement('h3');
            titleSpan.className = 'dish-card-title';
            titleSpan.textContent = recipe.name;

            const addToCartBtn = document.createElement('button');
            addToCartBtn.className = 'add-to-cart-btn';
            addToCartBtn.textContent = selectedRecipes[recipe.id] ? 'В корзине' : '+ В корзину';

            addToCartBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (selectedRecipes[recipe.id]) {
                    delete selectedRecipes[recipe.id];
                } else {
                    selectedRecipes[recipe.id] = 1;
                }
                calculateShoppingList();
                displayRecipeGrid();
            });

            // ОТКРЫТИЕ ПОЛНОЙ КАРТОЧКИ
            const openCard = function() {
                cardImg.src = recipe.image || defaultImg;
                cardTitle.textContent = recipe.name;
                cardCategory.textContent = recipe.category || 'Без категории';
                cardIngredientsList.innerHTML = '';
                recipe.ingredients.forEach(function(ing) {
                    const li = document.createElement('li');
                    li.innerHTML = `<span>${ing.name}</span> <span><b>${ing.amount}</b> ${ing.unit}</span>`;
                    cardIngredientsList.appendChild(li);
                });
                cardDescription.textContent = recipe.description || 'Описание отсутствует.';
                
                deleteRecipeBtn.onclick = async function() {
                    const confirmDelete = confirm(`Вы уверены, что хотите навсегда удалить рецепт "${recipe.name}"?`);
                    if (confirmDelete) {
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
            infoDiv.appendChild(addToCartBtn);
            card.appendChild(img);
            card.appendChild(infoDiv);
            
            grid.appendChild(card); 
        });

        section.appendChild(grid);
        recipeGrid.appendChild(section); 
    });
}

// === ПОДСЧЕТ ПРОДУКТОВ В КОРЗИНЕ ===
function calculateShoppingList() {
    shoppingList.innerHTML = ''; 
    const selectedIds = Object.keys(selectedRecipes);
    
    if (selectedIds.length === 0) { 
        shoppingList.innerHTML = '<li>Пока пусто</li>'; 
        menuBtn.textContent = '☰ Корзина';
        return; 
    }

    menuBtn.textContent = `☰ Корзина (${selectedIds.length})`;

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
                <input type="number" class="sidebar-portion-input" value="${selectedRecipes[id]}" min="1">
                <span class="remove-from-cart">✕</span>
            </div>
        `;

        const input = item.querySelector('input');
        input.addEventListener('input', () => {
            let val = parseInt(input.value);
            if (val < 1 || isNaN(val)) val = 1;
            selectedRecipes[id] = val;
            calculateShoppingList(); 
        });

        item.querySelector('.remove-from-cart').addEventListener('click', () => {
            delete selectedRecipes[id];
            calculateShoppingList();
            displayRecipeGrid();
        });

        shoppingList.appendChild(item);

        recipe.ingredients.forEach(ing => {
            let normName = ing.name;
            let normAmount = ing.amount * selectedRecipes[id];
            let normUnit = ing.unit;

            if (normUnit === 'л') { normAmount *= 1000; normUnit = 'мл'; }
            else if (normUnit === 'кг') { normAmount *= 1000; normUnit = 'г'; }

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
        let dAmt = item.amount; let dUnit = item.unit;
        if (item.unit === 'мл' && item.amount >= 1000) { dAmt /= 1000; dUnit = 'л'; }
        else if (item.unit === 'г' && item.amount >= 1000) { dAmt /= 1000; dUnit = 'кг'; }
        li.textContent = `${item.name}: ${dAmt} ${dUnit}`;
        shoppingList.appendChild(li);
    });
}

// === КОПИРОВАНИЕ ===
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

// Автодополнение
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

// Тема
const themeBtn = document.getElementById('theme-btn');
if (localStorage.getItem('app-theme') === 'dark') { document.body.classList.add('dark-theme'); themeBtn.textContent = 'Светлая тема'; }
themeBtn.addEventListener('click', function() {
    document.body.classList.toggle('dark-theme');
    if (document.body.classList.contains('dark-theme')) {
        themeBtn.textContent = 'Светлая тема'; localStorage.setItem('app-theme', 'dark');
    } else { themeBtn.textContent = 'Тёмная тема'; localStorage.setItem('app-theme', 'light'); }
});

// Запуск
loadRecipes();