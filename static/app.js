document.addEventListener("DOMContentLoaded", () => {
    // --- State Variables ---
    let latestPrediction = null;
    let predictionHistory = JSON.parse(localStorage.getItem("concrete_history")) || [];
    let debounceTimer = null;
    
    // --- UI Elements ---
    const form = document.getElementById("predictor-form");
    const cementSlider = document.getElementById("cement");
    const cementInput = document.getElementById("cement-val");
    const slagSlider = document.getElementById("slag");
    const slagInput = document.getElementById("slag-val");
    const ashSlider = document.getElementById("ash");
    const ashInput = document.getElementById("ash-val");
    const waterSlider = document.getElementById("water");
    const waterInput = document.getElementById("water-val");
    const superplasticSlider = document.getElementById("superplastic");
    const superplasticInput = document.getElementById("superplastic-val");
    const coarseaggSlider = document.getElementById("coarseagg");
    const coarseaggInput = document.getElementById("coarseagg-val");
    const fineaggSlider = document.getElementById("fineagg");
    const fineaggInput = document.getElementById("fineagg-val");
    const ageSlider = document.getElementById("age");
    const ageInput = document.getElementById("age-val");
    
    const binderDisplay = document.getElementById("ratio-binder");
    const wcDisplay = document.getElementById("ratio-wc");
    
    const gaugeArc = document.getElementById("gauge-arc");
    const strengthDisplay = document.getElementById("strength-display");
    const classTitle = document.getElementById("class-title");
    const classDesc = document.getElementById("class-desc");
    
    const logBtn = document.getElementById("log-prediction-btn");
    const clearHistoryBtn = document.getElementById("clear-history-btn");
    const historyBody = document.getElementById("history-body");
    
    const tabButtons = document.querySelectorAll(".tab-btn");
    const tabImportances = document.getElementById("tab-importances");
    const tabMetrics = document.getElementById("tab-metrics");
    const importanceList = document.getElementById("importance-list");
    
    const r2Metric = document.getElementById("metric-r2");
    const maeMetric = document.getElementById("metric-mae");
    const rmseMetric = document.getElementById("metric-rmse");

    // Map ingredients to their slider/numeric input pairs
    const inputs = [
        { id: "cement", slider: cementSlider, input: cementInput },
        { id: "slag", slider: slagSlider, input: slagInput },
        { id: "ash", slider: ashSlider, input: ashInput },
        { id: "water", slider: waterSlider, input: waterInput },
        { id: "superplastic", slider: superplasticSlider, input: superplasticInput },
        { id: "coarseagg", slider: coarseaggSlider, input: coarseaggInput },
        { id: "fineagg", slider: fineaggSlider, input: fineaggInput },
        { id: "age", slider: ageSlider, input: ageInput }
    ];

    // Colors for concrete classifications
    const themeColors = {
        low: "#ef4444",        // Red
        residential: "#f59e0b",// Amber
        commercial: "#10b981", // Emerald
        heavy: "#3b82f6"       // Blue
    };

    // --- Startup Initialization ---
    init();

    function init() {
        setupSyncListeners();
        fetchModelInfo();
        renderHistoryTable();
        calculateRatios();
        triggerPrediction();
    }

    // --- Set up Input and Slider Sync ---
    function setupSyncListeners() {
        inputs.forEach(pair => {
            // Slider changes -> update input and predict
            pair.slider.addEventListener("input", () => {
                pair.input.value = pair.slider.value;
                calculateRatios();
                debouncedPredict();
            });

            // Input changes -> update slider and predict
            pair.input.addEventListener("input", () => {
                let val = parseFloat(pair.input.value);
                const min = parseFloat(pair.slider.min);
                const max = parseFloat(pair.slider.max);
                
                // Clamp input to min/max range
                if (isNaN(val)) val = min;
                if (val < min) val = min;
                if (val > max) val = max;
                
                pair.slider.value = val;
                calculateRatios();
                debouncedPredict();
            });
            
            // Re-clamp on blur to ensure clean values
            pair.input.addEventListener("blur", () => {
                if (pair.input.value === "") {
                    pair.input.value = pair.slider.value;
                }
            });
        });

        // Tab Switching
        tabButtons.forEach(btn => {
            btn.addEventListener("click", () => {
                tabButtons.forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                
                const tabName = btn.getAttribute("data-tab");
                if (tabName === "importances") {
                    tabImportances.classList.remove("hidden");
                    tabMetrics.classList.add("hidden");
                } else {
                    tabImportances.classList.add("hidden");
                    tabMetrics.classList.remove("hidden");
                }
            });
        });

        // Log Prediction Button
        logBtn.addEventListener("click", logCurrentPrediction);
        
        // Clear History Button
        clearHistoryBtn.addEventListener("click", () => {
            predictionHistory = [];
            localStorage.removeItem("concrete_history");
            renderHistoryTable();
        });
    }

    // --- Fetch Model Info (Metrics + Importances) ---
    async function fetchModelInfo() {
        try {
            const res = await fetch("/api/info");
            if (!res.ok) throw new Error("Failed to load model metadata");
            const data = await res.json();
            
            // Update stats
            r2Metric.textContent = data.metrics.r2_score.toFixed(4);
            maeMetric.textContent = `${data.metrics.mae_mpa.toFixed(2)} MPa`;
            rmseMetric.textContent = `${data.metrics.rmse_mpa.toFixed(2)} MPa`;
            
            // Populate feature importances list
            importanceList.innerHTML = "";
            const maxImp = Math.max(...data.feature_importances.map(f => f.importance));
            
            data.feature_importances.forEach(item => {
                const cleanName = item.name.replace(/_/g, " ");
                const pct = item.importance * 100;
                const barWidth = (item.importance / maxImp) * 100;
                
                const itemHtml = `
                    <div class="importance-item">
                        <div class="importance-label-row">
                            <span class="importance-name">${cleanName}</span>
                            <span class="importance-value">${pct.toFixed(1)}%</span>
                        </div>
                        <div class="importance-bar-track">
                            <div class="importance-bar-fill" style="width: ${barWidth}%"></div>
                        </div>
                    </div>
                `;
                importanceList.insertAdjacentHTML("beforeend", itemHtml);
            });
        } catch (error) {
            console.error("Error loading model info:", error);
        }
    }

    // --- Live Ratio Computations ---
    function calculateRatios() {
        const cement = parseFloat(cementSlider.value);
        const slag = parseFloat(slagSlider.value);
        const ash = parseFloat(ashSlider.value);
        const water = parseFloat(waterSlider.value);

        const totalBinder = cement + slag + ash;
        const wcRatio = water / cement;

        // Update Binder display
        binderDisplay.innerHTML = `${totalBinder.toFixed(1)} <span class="ratio-unit">kg/m³</span>`;

        // Update W/C Ratio display & styling warnings
        wcDisplay.textContent = wcRatio.toFixed(2);
        
        wcDisplay.className = "ratio-value"; // Reset classes
        if (wcRatio < 0.35) {
            wcDisplay.classList.add("ratio-warning");
            wcDisplay.title = "Warning: Concrete might be too dry and difficult to work with.";
        } else if (wcRatio > 0.60) {
            wcDisplay.classList.add("ratio-danger");
            wcDisplay.title = "Warning: High water-cement ratio reduces compressive strength significantly.";
        } else {
            wcDisplay.title = "Optimal range for strong concrete structure.";
        }
    }

    // --- Debounced API Calls ---
    function debouncedPredict() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(triggerPrediction, 150);
    }

    // --- Send Prediction request ---
    async function triggerPrediction() {
        const payload = {
            cement: parseFloat(cementSlider.value),
            slag: parseFloat(slagSlider.value),
            ash: parseFloat(ashSlider.value),
            water: parseFloat(waterSlider.value),
            superplastic: parseFloat(superplasticSlider.value),
            coarseagg: parseFloat(coarseaggSlider.value),
            fineagg: parseFloat(fineaggSlider.value),
            age: parseFloat(ageSlider.value)
        };

        try {
            const res = await fetch("/api/predict", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.message || "Failed to retrieve prediction");
            }

            const data = await res.json();
            if (data.status === "success") {
                latestPrediction = {
                    inputs: payload,
                    strength: data.predicted_strength_mpa,
                    classification: data.classification,
                    description: data.description,
                    totalBinder: data.total_binder_kg_m3,
                    wcRatio: data.water_cement_ratio
                };
                updateUI(latestPrediction);
                logBtn.removeAttribute("disabled");
            }
        } catch (error) {
            console.error("Prediction Error:", error);
            strengthDisplay.textContent = "Error";
            classTitle.textContent = "Failed to Predict";
            classDesc.textContent = error.message || "An error occurred while calling the server.";
            logBtn.setAttribute("disabled", "true");
        }
    }

    // --- Update Dashboard with Results ---
    function updateUI(prediction) {
        const strength = prediction.strength;
        strengthDisplay.textContent = strength.toFixed(1);
        
        // Ceiling at 85 MPa for gauge representation (as max in dataset is 82.6)
        const ceiling = 85.0;
        const pct = Math.min((strength / ceiling) * 100, 100);
        
        // Gauge stroke animation (radius is 50, circumference is 2 * pi * 50 = 314.16)
        const circumference = 314.16;
        const offset = circumference - (pct / 100) * circumference;
        gaugeArc.style.strokeDashoffset = offset;
        
        // Determine theme color and apply
        let colorClass = "";
        let colorHex = "";
        
        if (strength < 20) {
            colorClass = "text-low-strength";
            colorHex = themeColors.low;
        } else if (strength >= 20 && strength < 30) {
            colorClass = "text-residential-strength";
            colorHex = themeColors.residential;
        } else if (strength >= 30 && strength < 50) {
            colorClass = "text-commercial-strength";
            colorHex = themeColors.commercial;
        } else {
            colorClass = "text-heavy-strength";
            colorHex = themeColors.heavy;
        }
        
        gaugeArc.style.stroke = colorHex;
        classTitle.className = `class-title ${colorClass}`;
        classTitle.textContent = prediction.classification;
        classDesc.textContent = prediction.description;
    }

    // --- Session History / Logging ---
    function logCurrentPrediction() {
        if (!latestPrediction) return;
        
        // Prevent duplicate logs if ingredients are identical to the last logged mix
        if (predictionHistory.length > 0) {
            const lastLog = predictionHistory[0];
            const isMatch = Object.keys(latestPrediction.inputs).every(key => 
                latestPrediction.inputs[key] === lastLog.inputs[key]
            );
            if (isMatch) return; // Skip duplicate
        }

        predictionHistory.unshift({
            timestamp: new Date().toISOString(),
            ...latestPrediction
        });

        // Cap history at 15 items
        if (predictionHistory.length > 15) {
            predictionHistory.pop();
        }

        localStorage.setItem("concrete_history", JSON.stringify(predictionHistory));
        renderHistoryTable();
    }

    function renderHistoryTable() {
        historyBody.innerHTML = "";

        if (predictionHistory.length === 0) {
            const emptyHtml = `
                <tr class="empty-row">
                    <td colspan="13">No formulations logged yet. Predict and click "Log Formulation" to compare models.</td>
                </tr>
            `;
            historyBody.insertAdjacentHTML("beforeend", emptyHtml);
            return;
        }

        predictionHistory.forEach((log, index) => {
            let badgeClass = "";
            const str = log.strength;
            
            if (str < 20) badgeClass = "bg-low-strength";
            else if (str >= 20 && str < 30) badgeClass = "bg-residential-strength";
            else if (str >= 30 && str < 50) badgeClass = "bg-commercial-strength";
            else badgeClass = "bg-heavy-strength";

            const rowHtml = `
                <tr>
                    <td><strong>${predictionHistory.length - index}</strong></td>
                    <td>${log.inputs.cement.toFixed(0)}</td>
                    <td>${log.inputs.slag.toFixed(0)}</td>
                    <td>${log.inputs.ash.toFixed(0)}</td>
                    <td>${log.inputs.water.toFixed(0)}</td>
                    <td>${log.inputs.superplastic.toFixed(1)}</td>
                    <td>${log.inputs.coarseagg.toFixed(0)}</td>
                    <td>${log.inputs.fineagg.toFixed(0)}</td>
                    <td>${log.inputs.age.toFixed(0)}</td>
                    <td>${log.wcRatio.toFixed(2)}</td>
                    <td>${log.totalBinder.toFixed(1)}</td>
                    <td><strong>${log.strength.toFixed(1)} MPa</strong></td>
                    <td><span class="history-badge ${badgeClass}">${log.classification}</span></td>
                </tr>
            `;
            historyBody.insertAdjacentHTML("beforeend", rowHtml);
        });
    }
});
