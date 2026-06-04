# ConcreSight 🧱 — AI Concrete Compressive Strength Predictor

An interactive, AI-powered web application for predicting and optimizing the compressive strength of concrete mixes. The application leverages a **Random Forest Regressor** model trained directly from your Jupyter Notebook to provide real-time strength forecasts and concrete classification based on ingredient composition and curing age.

---

## 🚀 Key Features

* **Highly Accurate AI Predictor**: Employs a Random Forest Regressor yielding an **$R^2$ Score of 92%** and a Mean Absolute Error (MAE) of **3.43 MPa**.
* **Modern Glassmorphic UI**: A dark-mode web dashboard featuring smooth animations, responsive grids, and customized input range sliders.
* **Instant Visual Indicators**:
  * **Dynamic Arc Gauge**: Renders the predicted compressive strength instantly.
  * **Suitability Badge**: Categorizes the concrete mix (e.g., Residential, Commercial, Bridges/Heavy Infrastructure) along with engineering recommendations.
  * **Live Ratio Ratios**: Auto-calculates total binder (cement + slag + fly ash) and water-cement ratios, showing visual warnings if the mix is too dry or too wet.
* **Model Insights Dashboard**: Displays training metrics and a horizontal bar chart showing live feature importances (e.g., Curing age and total binder are the most critical factors).
* **Recipe Comparison History**: Save and compare multiple mix designs side-by-side. Logs are persisted locally using browser `localStorage`.
* **Lightweight REST API Backend**: Built with Flask to serve prediction requests.

---

## 📈 Model Performance & Feature Significance

Based on the evaluation of the Random Forest model:
* **$R^2$ Score**: `0.9201`
* **Mean Absolute Error (MAE)**: `3.43 MPa`
* **Root Mean Squared Error (RMSE)**: `4.88 MPa`

### Top Feature Importances:
1. **Age (days)**: `35.8%` importance
2. **Total Binder (Cement + Slag + Ash)**: `33.2%` importance
3. **Water/Cement Ratio**: `15.9%` importance
4. **Water**: `3.2%` importance
5. **Cement**: `2.8%` importance

---

## 📂 Project Structure

```
d:/Concrete Strength/
├── Concrete Strength prediction.ipynb  # Jupyter Notebook containing EDA and training
├── app.py                              # Flask Web Server
├── concrete.csv                        # Raw concrete mix dataset
├── model.pkl                           # Pickled Random Forest model
├── scaler.pkl                          # Pickled RobustScaler
├── model_meta.json                     # Serialized model metrics & importances
├── README.md                           # Project documentation (this file)
├── .gitignore                          # Git tracking exclusions
└── static/
    ├── index.html                      # Frontend structure
    ├── style.css                       # Glassmorphic stylesheet
    └── app.js                          # Frontend interaction logic & API calls
```

---

## 🛠️ Installation & Setup

### Prerequisites
Make sure you have **Python 3.x** installed. You will need the following libraries:
```bash
pip install pandas scikit-learn flask
```

### 1. Model Serialization (Optional)
The notebook is configured to serialize the model. If you want to retrain the model, open **`Concrete Strength prediction.ipynb`** in Jupyter Notebook and run all cells. The final cell will regenerate the pickle files:
* `model.pkl`
* `scaler.pkl`
* `model_meta.json`

### 2. Run the Web Server
Launch the Flask backend server from the workspace root:
```bash
python app.py
```
This will start the local server on `http://127.0.0.1:5000/`.

### 3. Open the Dashboard
Open your web browser and navigate to:
👉 **[http://127.0.0.1:5000/](http://127.0.0.1:5000/)**

---

## 🔌 API Endpoints

The Flask backend exposes the following endpoints for integration:

### 1. `GET /api/info`
Returns the model's metrics and sorted feature importances.
* **Response Example**:
  ```json
  {
      "metrics": {
          "r2_score": 0.92006,
          "mae_mpa": 3.429,
          "rmse_mpa": 4.883
      },
      "features": ["cement", "slag", "ash", "water", "superplastic", "coarseagg", "fineagg", "age", "Total_Binder", "Water_Cement_Ratio"],
      "feature_importances": [
          { "name": "age", "importance": 0.3575 },
          { "name": "Total_Binder", "importance": 0.3316 }
      ]
  }
  ```

### 2. `POST /api/predict`
Calculates engineered ratios, scales features, and predicts strength in MPa.
* **Payload Example**:
  ```json
  {
      "cement": 280,
      "slag": 70,
      "ash": 50,
      "water": 180,
      "superplastic": 6.0,
      "coarseagg": 970,
      "fineagg": 770,
      "age": 28
  }
  ```
* **Response Example**:
  ```json
  {
      "status": "success",
      "predicted_strength_mpa": 35.84,
      "classification": "Commercial Strength",
      "description": "High structural grade. Suitable for commercial structures, high-load columns, industrial flooring, and heavy-duty slabs.",
      "total_binder_kg_m3": 400.0,
      "water_cement_ratio": 0.64
  }
  ```
