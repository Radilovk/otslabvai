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
        const WORKER_AI_FOLLOWUP_URL = `${BASE_URL}/quest-ai-followup`;
        const PAGE_CONTENT_URL = `${BASE_URL}/page_content.json`;

        // --- Глобално състояние ---
        let currentStepIndex = 0;
        const totalSteps = steps.length;
        let allProductsData = [];
        let aiFollowupLoaded = false;
        // Index of the AI follow-up step (last step)
        const AI_FOLLOWUP_STEP_INDEX = totalSteps - 1;
        // Index of the contact step (second to last)
        const CONTACT_STEP_INDEX = totalSteps - 2;

        // --- Извличане на данните за продуктите при зареждане ---
        async function fetchAndProcessProductData() {
          try {
            const response = await fetch(PAGE_CONTENT_URL);
            if (!response.ok)
              throw new Error(`HTTP error! status: ${response.status}`);
            const pageContent = await response.json();
            allProductsData = pageContent.page_content
              .filter(
                (component) =>
                  component.type === "product_category" && component.products,
              )
              .flatMap((category) => category.products);
            console.log("Product data loaded successfully:", allProductsData);
            nextBtn.disabled = false;
          } catch (error) {
            console.error("Failed to load product data:", error);
            formErrorText.textContent =
              "Неуспешно зареждане на продуктовата информация. Моля, презаредете страницата.";
            formErrorContainer.classList.remove("hidden");
            nextBtn.disabled = true;
            backBtn.disabled = true;
          }
        }

        // --- "Друго" поле toggle логика ---
        function setupOtherToggles() {
          form.querySelectorAll('[data-other-toggle]').forEach((input) => {
            const targetId = input.getAttribute('data-other-toggle');
            const targetField = document.getElementById(targetId);
            if (!targetField) return;

            input.addEventListener('change', () => {
              if (input.checked) {
                targetField.classList.remove('hidden');
                targetField.focus();
              } else {
                targetField.classList.add('hidden');
                targetField.value = '';
              }
            });

            // For radio buttons: hide on sibling change
            if (input.type === 'radio') {
              const siblings = form.querySelectorAll(`input[name="${input.name}"]`);
              siblings.forEach((sibling) => {
                if (sibling !== input) {
                  sibling.addEventListener('change', () => {
                    targetField.classList.add('hidden');
                    targetField.value = '';
                  });
                }
              });
            }
          });
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

        // --- Навигация и Валидация ---
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

        // Определя кои radio/checkbox групи са задължителни на всяка стъпка
        const requiredRadioGroups = {
          0: ['gender'],
          2: ['goals'],
          4: ['meals_per_day', 'skip_breakfast', 'water_intake', 'sugary_drinks', 'special_diet'],
          6: ['activity', 'work_type', 'daily_steps'],
          7: ['sleep_quality'],
          8: ['smoking', 'alcohol', 'caffeine'],
          9: ['previous_diets', 'support'],
          10: ['duration', 'consent'],
        };

        // Имена, които не се третират като задължителни текстови полета
        const optionalFieldNames = [
          'gender', 'goals', 'health_conditions', 'activity', 'duration',
          'consent', 'main_goal', 'conditions_detail', 'medications',
          'allergies', 'typical_diet', 'additional_info',
          'meals_per_day', 'skip_breakfast', 'water_intake', 'sugary_drinks',
          'special_diet', 'cellulite', 'problem_zones', 'exercise_types',
          'work_type', 'daily_steps', 'sleep_quality', 'stress_coping',
          'smoking', 'alcohol', 'caffeine', 'previous_diets', 'support',
          'health_conditions_other_text', 'goals_other_text',
          'special_diet_other_text', 'waist',
        ];

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

          // Skip validation for AI follow-up step (dynamic content)
          if (currentStepIndex === AI_FOLLOWUP_STEP_INDEX) {
            return true;
          }

          const inputs = currentStep.querySelectorAll("input, textarea");
          for (const input of inputs) {
            const name = input.name;
            const value = input.value.trim();

            // Skip hidden "other" fields, checkboxes, radios
            if (input.classList.contains('other-text-input') && input.classList.contains('hidden')) continue;
            if (input.type === 'radio' || input.type === 'checkbox') continue;

            // Determine required text inputs
            if (input.hasAttribute("id") && !optionalFieldNames.includes(name) && value === "") {
              isValid = false;
              showError(input, "Това поле е задължително.");
              continue;
            }

            // Specific validation
            switch (input.id) {
              case "age":
                if (value !== "" && (isNaN(value) || +value < 18 || +value > 100)) {
                  isValid = false;
                  showError(input, "Моля, въведете валидна възраст (18-100).");
                }
                break;
              case "height":
                if (value !== "" && (isNaN(value) || +value < 100 || +value > 250)) {
                  isValid = false;
                  showError(input, "Моля, въведете валиден ръст в см (100-250).");
                }
                break;
              case "weight":
                if (value !== "" && (isNaN(value) || +value < 30 || +value > 300)) {
                  isValid = false;
                  showError(input, "Моля, въведете валидно тегло в кг (30-300).");
                }
                break;
              case "target_weight":
                if (value !== "" && (isNaN(value) || +value < 30 || +value > 200)) {
                  isValid = false;
                  showError(input, "Моля, въведете валидно целево тегло (30-200).");
                }
                break;
              case "waist":
                if (value !== "" && (isNaN(value) || +value < 40 || +value > 200)) {
                  isValid = false;
                  showError(input, "Моля, въведете валидна стойност (40-200).");
                }
                break;
              case "main-goal":
                if (value.length > 0 && value.length < 10) {
                  isValid = false;
                  showError(input, "Моля, опишете целта си с поне 10 символа.");
                }
                break;
              case "conditions_detail":
              case "medications":
              case "allergies":
                if (value.length > 0 && value.length < 3) {
                  isValid = false;
                  showError(input, "Моля, опишете по-подробно или въведете 'Нямам'/'Не'.");
                }
                break;
              case "sleep":
                if (value !== "" && (isNaN(value) || +value < 1 || +value > 16)) {
                  isValid = false;
                  showError(input, "Моля, въведете валиден брой часове (1-16).");
                }
                break;
              case "stress":
              case "motivation":
                if (value !== "" && (isNaN(value) || +value < 1 || +value > 10)) {
                  isValid = false;
                  showError(input, "Моля, въведете число от 1 до 10.");
                }
                break;
              case "email":
                if (value !== "") {
                  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                  if (!emailRegex.test(value)) {
                    isValid = false;
                    showError(input, "Моля, въведете валиден имейл адрес.");
                  }
                }
                break;
              case "phone":
                if (value !== "") {
                  const phoneRegex = /^[0-9\s+()-]{9,}$/;
                  if (!phoneRegex.test(value)) {
                    isValid = false;
                    showError(input, "Моля, въведете валиден телефонен номер.");
                  }
                }
                break;
            }
          }

          // Validate required radio/checkbox groups for this step
          const groups = requiredRadioGroups[currentStepIndex] || [];
          groups.forEach((groupName) => {
            const group = currentStep.querySelector(`input[name="${groupName}"]`);
            if (group && !form.querySelector(`input[name="${groupName}"]:checked`)) {
              isValid = false;
              const errorContainer = group
                .closest(".form-group")
                .querySelector(".error-message");
              if (errorContainer) {
                const messages = {
                  'gender': 'Моля, изберете пол.',
                  'goals': 'Моля, изберете поне една цел.',
                  'activity': 'Моля, изберете ниво на активност.',
                  'duration': 'Моля, изберете период.',
                  'consent': 'Трябва да се съгласите с условието.',
                  'meals_per_day': 'Моля, изберете отговор.',
                  'skip_breakfast': 'Моля, изберете отговор.',
                  'water_intake': 'Моля, изберете отговор.',
                  'sugary_drinks': 'Моля, изберете отговор.',
                  'special_diet': 'Моля, изберете отговор.',
                  'work_type': 'Моля, изберете отговор.',
                  'daily_steps': 'Моля, изберете отговор.',
                  'sleep_quality': 'Моля, изберете отговор.',
                  'smoking': 'Моля, изберете отговор.',
                  'alcohol': 'Моля, изберете отговор.',
                  'caffeine': 'Моля, изберете отговор.',
                  'previous_diets': 'Моля, изберете отговор.',
                  'support': 'Моля, изберете отговор.',
                };
                errorContainer.textContent = messages[groupName] || 'Моля, изберете отговор.';
                errorContainer.style.display = "block";
              }
            }
          });

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

        // --- Събиране на данни от формата ---
        function collectFormData() {
          const formDataObj = new FormData(form);
          const data = {};

          // Multi-value checkbox groups
          const multiGroups = ['goals', 'health_conditions', 'problem_zones', 'exercise_types', 'stress_coping'];

          for (const [key, value] of formDataObj.entries()) {
            if (multiGroups.includes(key)) continue;
            data[key] = value;
          }

          multiGroups.forEach((group) => {
            data[group] = formDataObj.getAll(group);
          });

          // Sanitize text fields
          const fieldsToSanitize = [
            'name', 'main_goal', 'conditions_detail', 'medications',
            'allergies', 'typical_diet', 'additional_info',
            'health_conditions_other_text', 'goals_other_text',
            'special_diet_other_text',
          ];
          fieldsToSanitize.forEach((fieldName) => {
            if (data[fieldName]) {
              data[fieldName] = data[fieldName]
                .replace(/"/g, "'")
                .replace(/\\/g, "");
            }
          });

          // Collect AI follow-up answers
          const aiAnswers = [];
          document.querySelectorAll('.ai-followup-answer').forEach((textarea) => {
            const question = textarea.getAttribute('data-question');
            const answer = textarea.value.trim();
            if (question && answer) {
              aiAnswers.push({ question, answer });
            }
          });
          if (aiAnswers.length > 0) {
            data.ai_followup_answers = aiAnswers;
          }

          return data;
        }

        // --- AI Follow-up: зареждане на допълнителни въпроси ---
        async function loadAIFollowupQuestions() {
          if (aiFollowupLoaded) return;

          const loadingEl = document.getElementById('ai-followup-loading');
          const questionsEl = document.getElementById('ai-followup-questions');
          const errorEl = document.getElementById('ai-followup-error');

          loadingEl.classList.remove('hidden');
          questionsEl.classList.add('hidden');
          errorEl.classList.add('hidden');

          const data = collectFormData();

          try {
            const response = await fetch(WORKER_AI_FOLLOWUP_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data),
            });
            const result = await response.json();

            if (!response.ok || result.error) {
              throw new Error(result.error || 'Грешка при генериране на въпросите.');
            }

            const questions = result.questions || [];
            questionsEl.innerHTML = '';

            if (questions.length === 0) {
              questionsEl.innerHTML = '<p>Няма допълнителни въпроси. Можете да продължите.</p>';
            } else {
              questions.forEach((q, i) => {
                const div = document.createElement('div');
                div.className = 'form-group';
                div.innerHTML = `
                  <label for="ai-q-${i}">${q}</label>
                  <textarea id="ai-q-${i}" class="ai-followup-answer" data-question="${q.replace(/"/g, '&quot;')}" placeholder="Вашият отговор..."></textarea>
                  <div class="error-message"></div>
                `;
                questionsEl.appendChild(div);
              });
            }

            loadingEl.classList.add('hidden');
            questionsEl.classList.remove('hidden');
            aiFollowupLoaded = true;
          } catch (error) {
            console.error('AI followup error:', error);
            loadingEl.classList.add('hidden');
            errorEl.textContent = `Не успяхме да генерираме допълнителни въпроси: ${error.message}. Можете да продължите без тях.`;
            errorEl.classList.remove('hidden');
            questionsEl.innerHTML = '';
            questionsEl.classList.remove('hidden');
            aiFollowupLoaded = true; // Allow proceeding even on error
          }
        }

        // --- Навигация ---
        nextBtn.addEventListener("click", async () => {
          if (!validateCurrentStep()) return;

          // When leaving the contact step, load AI follow-up questions
          if (currentStepIndex === CONTACT_STEP_INDEX) {
            currentStepIndex++;
            updateForm();
            window.scrollTo(0, 0);
            await loadAIFollowupQuestions();
            return;
          }

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

        // --- Изпращане на данните ---
        async function submitForm() {
          nextBtn.disabled = true;
          backBtn.disabled = true;
          nextBtn.textContent = "Анализираме...";
          formErrorContainer.classList.add("hidden");

          const data = collectFormData();

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

        // --- Показване на резултати ---
        function displayResults(results, name) {
          document.getElementById("results-name").textContent = name;
          document.getElementById("analysis-text").textContent =
            results.analysis;
          document.getElementById("protocol-details").textContent =
            results.protocol_details;
          document.getElementById("results-disclaimer").textContent =
            results.disclaimer;

          const productsList = document.getElementById("products-list");
          productsList.innerHTML = "";

          results.recommended_products.forEach((rec) => {
            const productDetails = allProductsData.find(
              (p) => p.product_id === rec.product_id,
            );
            if (!productDetails) {
              console.warn(
                `Product with ID ${rec.product_id} not found in local data.`,
              );
              return;
            }

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
          nextBtn.disabled = true;
          nextBtn.textContent = "Зареждане...";
          setupOtherToggles();
          await fetchAndProcessProductData();
          updateForm();
        }

        initialize();
      });
