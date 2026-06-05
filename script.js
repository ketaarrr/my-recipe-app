// Импортируем функции Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// !!! ВСТАВЬ СЮДА СВОИ НАСТРОЙКИ FIREBASE !!!
const firebaseConfig = {
  apiKey: "AIzaSyC9fOeRLDpFjRxZE04EEXot5ri5OVxosLY",
  authDomain: "recipe-app-my.firebaseapp.com",
  projectId: "recipe-app-my",
  storageBucket: "recipe-app-my.firebasestorage.app",
  messagingSenderId: "1060591216940",
  appId: "1:1060591216940:web:d161cc2d20fa83c133e489"
};

// Запускаем базу данных
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Находим элементы на странице
const recipeList = document.getElementById('recipe-list');
const shoppingList = document.getElementById('shopping-list');
const recipeNameInput = document.getElementById('recipe-name');
const addRecipeBtn = document.getElementById('add-recipe-btn');
const copyBtn = document.getElementById('copy-btn');
const ingNameInput = document.getElementById('ing-name');
const ingSuggestions = document.getElementById('ing-suggestions');
const ingAmountInput = document.getElementById('ing-amount');
const ingUnitInput = document.getElementById('ing-unit');
const addIngBtn = document.getElementById('add-ing-btn');
const tempIngList = document.getElementById('temp-ing-list');

// Массивы для данных
let recipes = [];
let currentIngredients = []; 

// === НОВОЕ: ТЕПЕРЬ ЭТО СЛОВАРЬ { 'id_рецепта': количество_порций } ===
let selectedRecipes = {}; 

// === 1. ЗАГРУЗКА ИЗ ОБЛАКА ===
async function loadRecipes() {
    const querySnapshot = await getDocs(collection(db, "recipes"));
    recipes = []; 
    querySnapshot.forEach((doc) => {
        let recipeData = doc.data();
        recipeData.id = doc.id;
        recipes.push(recipeData);
    });
    displayRecipes();
    updateIngredientSuggestions();
}


// === ФУНКЦИЯ ДЛЯ ОБНОВЛЕНИЯ ПОДСКАЗОК ИНГРЕДИЕНТОВ ===
function updateIngredientSuggestions() {
    let uniqueIngredients = new Set(); // Set - это специальный массив, который автоматически удаляет дубликаты

    // Проходим по всем загруженным рецептам
    recipes.forEach(function(recipe) {
        if (recipe.ingredients) {
            recipe.ingredients.forEach(function(ing) {
                // Делаем первую букву заглавной, а остальные строчными (Молоко), чтобы всё было красиво
                let formattedName = ing.name.charAt(0).toUpperCase() + ing.name.slice(1).toLowerCase();
                uniqueIngredients.add(formattedName);
            });
        }
    });

    // Очищаем старые подсказки
    ingSuggestions.innerHTML = '';

    // Добавляем новые подсказки в HTML
    uniqueIngredients.forEach(function(ingName) {
        const option = document.createElement('option');
        option.value = ingName;
        ingSuggestions.appendChild(option);
    });
}

// === 2. ВРЕМЕННЫЙ СПИСОК ИНГРЕДИЕНТОВ ===

// Функция, которая рисует список перед сохранением
function renderTempIngredients() {
    tempIngList.innerHTML = ''; // Очищаем экран

    currentIngredients.forEach(function(ing, index) {
        const li = document.createElement('li');
        
        const textSpan = document.createElement('span');
        textSpan.textContent = `${ing.name} — ${ing.amount} ${ing.unit}`;

        // Контейнер для кнопок
        const btnContainer = document.createElement('div');
        btnContainer.style.display = 'flex';
        btnContainer.style.gap = '5px';

        // Кнопка редактирования
        const editBtn = document.createElement('button');
        editBtn.textContent = '✏️';
        editBtn.className = 'icon-btn';
        editBtn.title = 'Редактировать';
        editBtn.addEventListener('click', function() {
            // 1. Возвращаем данные обратно в поля ввода
            ingNameInput.value = ing.name;
            ingAmountInput.value = ing.amount;
            ingUnitInput.value = ing.unit;
            
            // 2. Удаляем этот элемент из копилки
            currentIngredients.splice(index, 1);
            
            // 3. Перерисовываем список (он исчезнет с экрана)
            renderTempIngredients();
        });

        // Кнопка удаления
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = '❌';
        deleteBtn.className = 'icon-btn';
        deleteBtn.title = 'Удалить';
        deleteBtn.addEventListener('click', function() {
            // Просто удаляем из копилки и перерисовываем
            currentIngredients.splice(index, 1);
            renderTempIngredients();
        });

        btnContainer.appendChild(editBtn);
        btnContainer.appendChild(deleteBtn);

        li.appendChild(textSpan);
        li.appendChild(btnContainer);
        tempIngList.appendChild(li);
    });
}

// Логика кнопки "+"
addIngBtn.addEventListener('click', function() {
    const name = ingNameInput.value.trim();
    const amount = parseFloat(ingAmountInput.value); 
    const unit = ingUnitInput.value;

    if (name === '' || isNaN(amount) || amount <= 0) {
        alert('Пожалуйста, введите правильное название и количество ингредиента!');
        return;
    }

    // Кладем в копилку
    currentIngredients.push({ name: name, amount: amount, unit: unit });

    // Рисуем обновленный список
    renderTempIngredients();

    // Очищаем поля ввода для следующего продукта
    ingNameInput.value = '';
    ingAmountInput.value = '';
});

// === 3. СОХРАНЕНИЕ ГОТОВОГО РЕЦЕПТА ===
addRecipeBtn.addEventListener('click', async function() {
    const recipeName = recipeNameInput.value.trim();
    if (recipeName === '') {
        alert('Пожалуйста, введите название блюда!');
        return;
    }
    if (currentIngredients.length === 0) {
        alert('Добавьте хотя бы один ингредиент через кнопку "+"!');
        return;
    }

    await addDoc(collection(db, "recipes"), {
        name: recipeName,
        ingredients: currentIngredients
    });

    recipeNameInput.value = '';
    currentIngredients = [];
    tempIngList.innerHTML = '';
    loadRecipes(); 
});

// === 4. ОТОБРАЖЕНИЕ РЕЦЕПТОВ С ПОРЦИЯМИ ===
function displayRecipes() {
    recipeList.innerHTML = '';
    recipes.forEach(function(recipe) {
        const li = document.createElement('li');

        // Обертка для левой части (чтобы элементы стояли в ряд)
        const leftWrap = document.createElement('div');
        leftWrap.className = 'recipe-item-left';

        const label = document.createElement('label');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';

        // Создаем поле ввода порций
        const portionInput = document.createElement('input');
        portionInput.type = 'number';
        portionInput.min = '1';
        portionInput.value = selectedRecipes[recipe.id] || 1;
        portionInput.className = 'portion-input';
        
        // По умолчанию поле выключено, пока не поставят галочку
        portionInput.disabled = !selectedRecipes[recipe.id]; 

        // Восстанавливаем галочку, если рецепт был выбран
        if (selectedRecipes[recipe.id]) {
            checkbox.checked = true;
        }

        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(' ' + recipe.name));

        const portionText = document.createElement('span');
        portionText.textContent = 'порц.';
        portionText.className = 'portion-text';

        // Логика нажатия на галочку
        checkbox.addEventListener('change', function() {
            portionInput.disabled = !checkbox.checked; // Включаем/выключаем поле порций
            
            if (checkbox.checked) {
                selectedRecipes[recipe.id] = parseInt(portionInput.value) || 1;
            } else {
                delete selectedRecipes[recipe.id]; // Удаляем из словаря
            }
            calculateShoppingList();
        });

        // Логика изменения цифры порций
        portionInput.addEventListener('input', function() {
            if (checkbox.checked) {
                let val = parseInt(portionInput.value);
                if (val < 1 || isNaN(val)) val = 1;
                selectedRecipes[recipe.id] = val; // Обновляем количество
                calculateShoppingList(); // Сразу пересчитываем продукты!
            }
        });

        // Запрещаем клику по цифрам случайно нажимать на галочку
        portionInput.addEventListener('click', function(e) {
            e.stopPropagation();
        });

        leftWrap.appendChild(label);
        leftWrap.appendChild(portionInput);
        leftWrap.appendChild(portionText);

        // Кнопка удаления
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Удалить';
        deleteBtn.className = 'delete-btn';

        deleteBtn.addEventListener('click', async function() {
            const isConfirmed = confirm(`Точно удалить рецепт "${recipe.name}"?`);
            if (isConfirmed) {
                await deleteDoc(doc(db, "recipes", recipe.id));
                delete selectedRecipes[recipe.id];
                loadRecipes();
                calculateShoppingList();
            }
        });

        li.appendChild(leftWrap);
        li.appendChild(deleteBtn);
        recipeList.appendChild(li);
    });
}

// === 5. ПОДСЧЕТ ИНГРЕДИЕНТОВ С УМНОЖЕНИЕМ НА ПОРЦИИ ===
function calculateShoppingList() {
    let finalIngredients = {};

    // Проходим по ключам (ID) в нашем словаре
    Object.keys(selectedRecipes).forEach(function(id) {
        const portions = selectedRecipes[id]; // Достаем количество порций
        const recipe = recipes.find(r => r.id === id);
        
        if (recipe && recipe.ingredients) {
            recipe.ingredients.forEach(function(ing) {
                
                let normalizedName = ing.name;
                // САМОЕ ГЛАВНОЕ: Умножаем базовое количество на порции!
                let normalizedAmount = ing.amount * portions; 
                let normalizedUnit = ing.unit;

                if (normalizedUnit === 'л') {
                    normalizedAmount = normalizedAmount * 1000;
                    normalizedUnit = 'мл';
                } else if (normalizedUnit === 'кг') {
                    normalizedAmount = normalizedAmount * 1000;
                    normalizedUnit = 'г';
                }

                let key = normalizedName.toLowerCase() + '_' + normalizedUnit;
                
                if (finalIngredients[key]) {
                    finalIngredients[key].amount += normalizedAmount;
                } else {
                    finalIngredients[key] = { name: normalizedName, amount: normalizedAmount, unit: normalizedUnit };
                }
            });
        }
    });

    shoppingList.innerHTML = ''; 
    const items = Object.values(finalIngredients);
    
    if (items.length === 0) {
        shoppingList.innerHTML = '<li>Пока пусто</li>';
        return;
    }

    items.forEach(function(item) {
        const li = document.createElement('li');
        let displayAmount = item.amount;
        let displayUnit = item.unit;
        
        if (item.unit === 'мл' && item.amount >= 1000) {
            displayAmount = item.amount / 1000;
            displayUnit = 'л';
        } else if (item.unit === 'г' && item.amount >= 1000) {
            displayAmount = item.amount / 1000;
            displayUnit = 'кг';
        }

        li.textContent = `${item.name}: ${displayAmount} ${displayUnit}`;
        shoppingList.appendChild(li);
    });
}

// === 6. КОПИРОВАНИЕ ===
copyBtn.addEventListener('click', function() {
    if (shoppingList.innerText === 'Пока пусто' || shoppingList.innerText.trim() === '') {
        alert('Список покупок пуст!');
        return;
    }
    let textToCopy = "🛒 Мой список покупок:\n\n";
    const items = shoppingList.querySelectorAll('li');
    items.forEach(function(item) {
        textToCopy += "• " + item.textContent + "\n";
    });

    navigator.clipboard.writeText(textToCopy).then(function() {
        const originalText = copyBtn.textContent;
        copyBtn.textContent = '✅ Скопировано!';
        copyBtn.style.backgroundColor = '#4caf50';
        setTimeout(function() {
            copyBtn.textContent = originalText;
            copyBtn.style.backgroundColor = '#3b82f6'; // Возвращаем наш новый голубой цвет
        }, 2000);
    });
});

// === 7. СМЕНА ТЕМЫ (DARK MODE) ===
const themeBtn = document.getElementById('theme-btn');

if (localStorage.getItem('app-theme') === 'dark') {
    document.body.classList.add('dark-theme');
    themeBtn.textContent = '☀️ Светлая тема';
}

themeBtn.addEventListener('click', function() {
    document.body.classList.toggle('dark-theme');
    if (document.body.classList.contains('dark-theme')) {
        themeBtn.textContent = '☀️ Светлая тема';
        localStorage.setItem('app-theme', 'dark');
    } else {
        themeBtn.textContent = '🌙 Тёмная тема';
        localStorage.setItem('app-theme', 'light');
    }
});

// === ЗАПУСК ===
loadRecipes();