      document.addEventListener("DOMContentLoaded", async function () {
        // --- Елементи от DOM ---
        const questionnaireContainer = document.querySelector(
          ".questionnaire-container",
        );
        const loadingContainer = document.getElementById("loading-container");
        const resultsContainer = document.getElementById("results-container");
        const form = document.getElementById("questionnaire-form");
        const steps = Array.from(form.querySelectorAll(".form-step"));
        const nextBtn = document.getElementById("next-btn");
        const backBtn = document.getElementById("back-btn");
        const progressBar = document.getElementById("progress-bar");
        const resetBtn = document.getElementById("reset-btn");
        const formErrorContainer = document.getElementById(
          "form-error-container",
        );
        const formErrorText = document.getElementById("form-error-text");

        // --- Конфигурация ---
        const BASE_URL = "https://port.radilov-k.workers.dev";
        const WORKER_SUBMIT_URL = `${BASE_URL}/quest-submit`;
        const PAGE_CONTENT_URL = `${BASE_URL}/page_content.json`;

        // --- Глобално състояние ---
        let currentStepIndex = 0;
        const totalSteps = steps.length;
        let allProductsData = []; // Тук ще пазим данните за всички продукти

        // --- НОВА ЛОГИКА: Извличане на данните за продуктите при зареждане ---
        async function fetchAndProcessProductData() {
          try {
            const response = await fetch(PAGE_CONTENT_URL);
            if (!response.ok)
              throw new Error(`HTTP error! status: ${response.status}`);
            const pageContent = await response.json();

            // Извличаме и "сплескваме" продуктите от всички категории в един масив
            allProductsData = pageContent.page_content
              .filter(
                (component) =>
                  component.type === "product_category" && component.products,
              )
              .flatMap((category) => category.products);

            console.log("Product data loaded successfully:", allProductsData);
            nextBtn.disabled = false; // Активираме бутона след успешно зареждане
          } catch (error) {
            console.error("Failed to load product data:", error);
            formErrorText.textContent =
              "Неуспешно зареждане на продуктовата информация. Моля, презаредете страницата.";
            formErrorContainer.classList.remove("hidden");
            nextBtn.disabled = true; // Деактивираме бутоните, ако данните не са заредени
            backBtn.disabled = true;
          }
        }



        // --- Мобилно меню ---
        const menuToggle = document.querySelector(".menu-toggle");
        const navLinksContainer = document.querySelector(".nav-links");
        const navOverlay = document.querySelector(".nav-overlay");
        function closeMenu() {
          if (menuToggle) menuToggle.classList.remove("active");
          if (navLinksContainer) navLinksContainer.classList.remove("active");
          if (navOverlay) navOverlay.classList.remove("active");
          document.body.classList.remove("nav-open");
        }
        if (menuToggle) {
          menuToggle.addEventListener("click", () => {
            menuToggle.classList.toggle("active");
            if (navLinksContainer) navLinksContainer.classList.toggle("active");
            if (navOverlay) navOverlay.classList.toggle("active");
            document.body.classList.toggle("nav-open");
          });
        }
        if (navOverlay) {
          navOverlay.addEventListener("click", closeMenu);
        }
        if (navLinksContainer) {
          navLinksContainer.addEventListener("click", (e) => {
            if (e.target.tagName === "A" || e.target.closest("button")) {
              closeMenu();
            }
          });
        }
        // --- Навигация и Валидация на Формата (остава почти непроменена) ---
        function updateForm() {
          steps.forEach((step, index) =>
            step.classList.toggle("active", index === currentStepIndex),
          );
          progressBar.style.width = `${(currentStepIndex / (totalSteps - 1)) * 100}%`;
          backBtn.style.display = "block";
          nextBtn.textContent =
            currentStepIndex === totalSteps - 1
              ? "Генерирай Протокол"
              : "Напред";
        }

        function showError(inputElement, message) {
          inputElement.classList.add("input-error");
          const errorContainer =
            inputElement.parentElement.querySelector(".error-message");
          if (errorContainer) {
            errorContainer.textContent = message;
            errorContainer.style.display = "block";
          }
        }

        function clearError(inputElement) {
          inputElement.classList.remove("input-error");
          const errorContainer =
            inputElement.parentElement.querySelector(".error-message");
          if (errorContainer) {
            errorContainer.textContent = "";
            errorContainer.style.display = "none";
          }
        }

        function validateCurrentStep() {
          const currentStep = steps[currentStepIndex];
          currentStep
            .querySelectorAll(".input-error")
            .forEach((el) => clearError(el));
          currentStep.querySelectorAll(".error-message").forEach((el) => {
            el.textContent = "";
            el.style.display = "none";
          });
          let isValid = true;
          const inputs = currentStep.querySelectorAll("input, textarea");
          for (const input of inputs) {
            const name = input.name;
            const value = input.value.trim();
            if (
              input.hasAttribute("id") &&
              ![
                "gender",
                "goals",
                "activity",
                "duration",
                "consent",
                "main_goal",
                "conditions",
                "medications",
                "allergies",
              ].includes(name) &&
              value === ""
            ) {
              isValid = false;
              showError(input, "Това поле е задължително.");
              continue;
            }
            switch (input.id) {
              case "age":
                if (isNaN(value) || +value < 18 || +value > 100) {
                  isValid = false;
                  showError(input, "Моля, въведете валидна възраст (18-100).");
                }
                break;
              case "height":
                if (isNaN(value) || +value < 100 || +value > 250) {
                  isValid = false;
                  showError(
                    input,
                    "Моля, въведете валиден ръст в см (100-250).",
                  );
                }
                break;
              case "weight":
                if (isNaN(value) || +value < 30 || +value > 300) {
                  isValid = false;
                  showError(
                    input,
                    "Моля, въведете валидно тегло в кг (30-300).",
                  );
                }
                break;
              case "main-goal":
                if (value.length > 0 && value.length < 10) {
                  isValid = false;
                  showError(input, "Моля, опишете целта си с поне 10 символа.");
                }
                break;
              case "conditions":
              case "medications":
              case "allergies":
                if (value.length > 0 && value.length < 3) {
                  isValid = false;
                  showError(
                    input,
                    "Моля, опишете по-подробно или въведете 'Нямам'/'Не'.",
                  );
                }
                break;
              case "sleep":
                if (isNaN(value) || +value < 1 || +value > 16) {
                  isValid = false;
                  showError(
                    input,
                    "Моля, въведете валиден брой часове (1-16).",
                  );
                }
                break;
              case "stress":
                if (isNaN(value) || +value < 1 || +value > 10) {
                  isValid = false;
                  showError(input, "Моля, въведете число от 1 до 10.");
                }
                break;
              case "email":
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(value)) {
                  isValid = false;
                  showError(input, "Моля, въведете валиден имейл адрес.");
                }
                break;
              case "phone":
                const phoneRegex = /^[0-9\s+()-]{9,}$/;
                if (!phoneRegex.test(value)) {
                  isValid = false;
                  showError(input, "Моля, въведете валиден телефонен номер.");
                }
                break;
            }
          }
          const checkGroups = (name, message) => {
            const group = currentStep.querySelector(`input[name="${name}"]`);
            if (group && !form.querySelector(`input[name="${name}"]:checked`)) {
              isValid = false;
              const errorContainer = group
                .closest(".form-group")
                .querySelector(".error-message");
              if (errorContainer) {
                errorContainer.textContent = message;
                errorContainer.style.display = "block";
              }
            }
          };
          if (currentStepIndex === 0)
            checkGroups("gender", "Моля, изберете пол.");
          if (currentStepIndex === 1)
            checkGroups("goals", "Моля, изберете поне една цел.");
          if (currentStepIndex === 3)
            checkGroups("activity", "Моля, изберете ниво на активност.");
          if (currentStepIndex === 4) {
            checkGroups("duration", "Моля, изберете период на прием.");
            checkGroups("consent", "Трябва да се съгласите с условието.");
          }
          return isValid;
        }

        form
          .querySelectorAll("input, textarea")
          .forEach((input) =>
            input.addEventListener("input", () => clearError(input)),
          );
        form
          .querySelectorAll('input[type="radio"], input[type="checkbox"]')
          .forEach((input) => {
            input.addEventListener("change", () => {
              const groupContainer = input
                .closest(".form-group")
                .querySelector(".error-message");
              if (groupContainer) {
                groupContainer.textContent = "";
                groupContainer.style.display = "none";
              }
            });
          });

        nextBtn.addEventListener("click", () => {
          if (!validateCurrentStep()) return;
          if (currentStepIndex < totalSteps - 1) {
            currentStepIndex++;
            updateForm();
            window.scrollTo(0, 0);
          } else {
            submitForm();
          }
        });

        backBtn.addEventListener("click", () => {
          if (currentStepIndex > 0) {
            currentStepIndex--;
            updateForm();
            window.scrollTo(0, 0);
          } else {
            try {
              if (
                window.parent &&
                typeof window.parent.closeQuestModal === "function"
              ) {
                window.parent.closeQuestModal();
              } else {
                throw new Error("closeQuestModal not available");
              }
            } catch (error) {
              window.location.href = "index.html";
            }
          }
        });

        // --- Изпращане на данните (остава почти непроменено) ---
        async function submitForm() {
          nextBtn.disabled = true;
          backBtn.disabled = true;
          nextBtn.textContent = "Анализираме...";
          formErrorContainer.classList.add("hidden");

          const formData = new FormData(form);
          const data = {};
          for (const [key, value] of formData.entries()) {
            if (key === "goals") continue;
            data[key] = value;
          }
          data.goals = formData.getAll("goals");
          const fieldsToSanitize = [
            "name",
            "main_goal",
            "conditions",
            "medications",
            "allergies",
          ];
          fieldsToSanitize.forEach((fieldName) => {
            if (data[fieldName]) {
              data[fieldName] = data[fieldName]
                .replace(/"/g, "'")
                .replace(/\\/g, "");
            }
          });

          questionnaireContainer.classList.add("hidden");
          loadingContainer.classList.remove("hidden");
          window.scrollTo(0, 0);

          try {
            const response = await fetch(WORKER_SUBMIT_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(data),
            });
            const results = await response.json();
            if (!response.ok || results.error) {
              throw new Error(
                results.error || "Възникна неочаквана грешка от сървъра.",
              );
            }
            displayResults(results, data.name);
          } catch (error) {
            console.error("Submission failed:", error);
            formErrorText.textContent = `Грешка при генериране на резултатите: ${error.message}. Моля, проверете връзката си и опитайте отново.`;
            formErrorContainer.classList.remove("hidden");
            loadingContainer.classList.add("hidden");
            questionnaireContainer.classList.remove("hidden");
            nextBtn.disabled = false;
            backBtn.disabled = false;
            updateForm();
          }
        }

        // --- НОВА ЛОГИКА: Показване на по-богати резултати ---
        function displayResults(results, name) {
          document.getElementById("results-name").textContent = name;
          document.getElementById("analysis-text").textContent =
            results.analysis;
          document.getElementById("protocol-details").textContent =
            results.protocol_details;
          document.getElementById("results-disclaimer").textContent =
            results.disclaimer;

          const productsList = document.getElementById("products-list");
          productsList.innerHTML = ""; // Изчистваме старите резултати

          results.recommended_products.forEach((rec) => {
            // Намираме пълната информация за продукта по ID
            const productDetails = allProductsData.find(
              (p) => p.product_id === rec.product_id,
            );
            if (!productDetails) {
              console.warn(
                `Product with ID ${rec.product_id} not found in local data.`,
              );
              return; // Пропускаме, ако продуктът не е намерен
            }

            // Генерираме HTML за ефектите
            const effectsHtml = productDetails.public_data.effects
              .map(
                (effect) => `
                    <div class="effect-bar-container">
                        <span class="effect-label">${effect.label}</span>
                        <div class="effect-bar-background">
                            <div class="effect-bar-fill" style="width: ${effect.value}%;"></div>
                        </div>
                    </div>
                `,
              )
              .join("");

            // Генерираме HTML за вариантите
            const variantsHtml = productDetails.public_data.variants
              .map(
                (variant) => `
                    <li>
                        <a href="${variant.url}" target="_blank" rel="noopener noreferrer">
                            ${variant.title} <small>- ${variant.description}${variant.price ? ` - ${variant.price} €` : ""}</small>
                        </a>
                    </li>
                `,
              )
              .join("");

            // Сглобяваме цялата карта на продукта
            const productCardHtml = `
                    <div class="product-result-card">
                        <div class="product-header">
                            <img src="${productDetails.public_data.image_url}" alt="${productDetails.public_data.name}" onerror="this.style.display='none'">
                            <div class="product-title">
                                <h2>${productDetails.public_data.name}</h2>
                                <p class="tagline">${productDetails.public_data.tagline}</p>
                            </div>
                        </div>

                        <div class="ai-reason">
                            <h3>Защо го препоръчваме за Вас?</h3>
                            <p>${rec.reason}</p>
                        </div>
                        
                        <div class="effects-section">
                            <h3>Ключови ефекти</h3>
                            ${effectsHtml}
                        </div>
                        
                        <div class="variants-section">
                            <h3>Налични варианти за покупка</h3>
                            <ul>${variantsHtml}</ul>
                        </div>
                        
                        <div class="research-link-container">
                             <a href="${productDetails.public_data.research_note.url}" target="_blank" rel="noopener noreferrer">
                                Виж научното изследване (${productDetails.public_data.research_note.text})
                             </a>
                        </div>
                    </div>
                `;
            productsList.innerHTML += productCardHtml;
          });

          const tipsList = document.getElementById("tips-list");
          tipsList.innerHTML = "";
          results.lifestyle_tips.forEach((tip) => {
            const tipLi = document.createElement("li");
            tipLi.textContent = tip;
            tipsList.appendChild(tipLi);
          });

          loadingContainer.classList.add("hidden");
          resultsContainer.classList.remove("hidden");

          const resultCards = resultsContainer.querySelectorAll(
            ".result-card, .product-result-card",
          );
          resultCards.forEach((card, index) => {
            card.style.animationDelay = `${index * 0.1}s`;
          });
        }

        resetBtn.addEventListener("click", () => {
          location.reload();
        });

        // --- Инициализация ---
        async function initialize() {
          nextBtn.disabled = true; // Деактивираме бутона, докато данните се зареждат
          nextBtn.textContent = "Зареждане...";
          await fetchAndProcessProductData();
          updateForm();
        }

        initialize();
      });
