// Импортируем функции Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Твои настройки FIREBASE
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

// НОВЫЕ элементы для ингредиентов
const ingNameInput = document.getElementById('ing-name');
const ingAmountInput = document.getElementById('ing-amount');
const ingUnitInput = document.getElementById('ing-unit');
const addIngBtn = document.getElementById('add-ing-btn');
const tempIngList = document.getElementById('temp-ing-list');

// Массивы для данных
let recipes = [];
let selectedRecipeIds = [];
let currentIngredients = []; // Временная копилка для ингредиентов создаваемого рецепта

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
}

// === 2. ДОБАВЛЕНИЕ ИНГРЕДИЕНТА В СПИСОК (КНОПКА "+") ===
addIngBtn.addEventListener('click', function() {
    const name = ingNameInput.value.trim();
    const amount = parseFloat(ingAmountInput.value); // Превращаем текст в число
    const unit = ingUnitInput.value;

    // Проверяем, чтобы пользователь ввел правильные данные
    if (name === '' || isNaN(amount) || amount <= 0) {
        alert('Пожалуйста, введите правильное название и количество ингредиента!');
        return;
    }

    // Кладем в копилку
    currentIngredients.push({ name: name, amount: amount, unit: unit });

    // Рисуем на экране, чтобы пользователь видел, что добавил
    const li = document.createElement('li');
    li.textContent = `${name} — ${amount} ${unit}`;
    tempIngList.appendChild(li);

    // Очищаем поля для следующего ингредиента
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

    // Создаем новый документ в облаке с НАСТОЯЩИМИ ингредиентами
    await addDoc(collection(db, "recipes"), {
        name: recipeName,
        ingredients: currentIngredients
    });

    // Полностью очищаем форму
    recipeNameInput.value = '';
    currentIngredients = [];
    tempIngList.innerHTML = '';
    
    loadRecipes(); // Скачиваем обновленный список
});

// === 4. ОТОБРАЖЕНИЕ РЕЦЕПТОВ ===
function displayRecipes() {
    recipeList.innerHTML = '';
    recipes.forEach(function(recipe) {
        const li = document.createElement('li');
        const label = document.createElement('label');
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = recipe.id;
        
        // Запоминаем галочку, если рецепт был выбран до обновления списка
        if (selectedRecipeIds.includes(recipe.id)) {
            checkbox.checked = true;
        }
        
        checkbox.addEventListener('change', function() {
            if (checkbox.checked) {
                selectedRecipeIds.push(checkbox.value);
            } else {
                selectedRecipeIds = selectedRecipeIds.filter(id => id !== checkbox.value);
            }
            calculateShoppingList();
        });

        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(' ' + recipe.name));
        
        // --- НОВОЕ: КНОПКА УДАЛЕНИЯ ---
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Удалить';
        deleteBtn.className = 'delete-btn';
        
        deleteBtn.addEventListener('click', async function() {
            // Спрашиваем подтверждение
            const isConfirmed = confirm(`Точно удалить рецепт "${recipe.name}"?`);
            
            if (isConfirmed) {
                // 1. Удаляем из Firebase
                await deleteDoc(doc(db, "recipes", recipe.id));
                
                // 2. Убираем ID из корзины (чтобы продукты исчезли из списка покупок)
                selectedRecipeIds = selectedRecipeIds.filter(id => id !== recipe.id);
                
                // 3. Обновляем экран
                loadRecipes();
                calculateShoppingList();
            }
        });

        // Кладем всё внутрь <li>
        li.appendChild(label);
        li.appendChild(deleteBtn);
        recipeList.appendChild(li);
    });
}

// === 5. ПОДСЧЕТ ИНГРЕДИЕНТОВ ===
function calculateShoppingList() {
    let finalIngredients = {};

    selectedRecipeIds.forEach(function(id) {
        const recipe = recipes.find(r => r.id === id);
        
        if (recipe && recipe.ingredients) {
            recipe.ingredients.forEach(function(ing) {
                
                let normalizedName = ing.name;
                let normalizedAmount = ing.amount;
                let normalizedUnit = ing.unit;

                // 1. Умная конвертация объемов и весов
                if (normalizedUnit === 'л') {
                    normalizedAmount = normalizedAmount * 1000;
                    normalizedUnit = 'мл';
                } else if (normalizedUnit === 'кг') {
                    normalizedAmount = normalizedAmount * 1000;
                    normalizedUnit = 'г';
                }

                // 2. Делаем имя в нижнем регистре для создания ключа (молоко === Молоко)
                let key = normalizedName.toLowerCase() + '_' + normalizedUnit;
                
                if (finalIngredients[key]) {
                    finalIngredients[key].amount += normalizedAmount;
                } else {
                    // Сохраняем оригинальное имя с заглавной буквы для красоты в списке
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
        // Бонус: если миллилитров больше 1000, показываем их красиво (например, 1.7 л)
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
            copyBtn.style.backgroundColor = '#ff6b6b';
        }, 2000);
    });
});

// === ЗАПУСК ===
loadRecipes();