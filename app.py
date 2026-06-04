import os
import json
import pickle
import pandas as pd
from flask import Flask, request, jsonify, send_from_directory

app = Flask(__name__, static_folder='static')

# Load the saved model artifacts
MODEL_PATH = "model.pkl"
SCALER_PATH = "scaler.pkl"
META_PATH = "model_meta.json"

if not os.path.exists(MODEL_PATH) or not os.path.exists(SCALER_PATH) or not os.path.exists(META_PATH):
    raise FileNotFoundError("Model artifacts not found. Please run the cells in your Jupyter Notebook first.")

with open(MODEL_PATH, "rb") as f:
    model = pickle.load(f)

with open(SCALER_PATH, "rb") as f:
    scaler = pickle.load(f)

with open(META_PATH, "r") as f:
    model_meta = json.load(f)

# Serve the index.html from static folder
@app.route('/')
def index():
    return app.send_static_file('index.html')

# Endpoint to serve static files if needed (Flask does this automatically for '/static/<path:filename>')

# Endpoint for model metadata
@app.route('/api/info', methods=['GET'])
def get_info():
    return jsonify(model_meta)

# Endpoint for prediction
@app.route('/api/predict', methods=['POST'])
def predict():
    data = request.get_json()
    if not data:
        return jsonify({"status": "error", "message": "No JSON payload provided"}), 400
        
    required_fields = ['cement', 'slag', 'ash', 'water', 'superplastic', 'coarseagg', 'fineagg', 'age']
    
    # Validation
    for field in required_fields:
        if field not in data:
            return jsonify({"status": "error", "message": f"Missing required field: {field}"}), 400
        try:
            data[field] = float(data[field])
        except (ValueError, TypeError):
            return jsonify({"status": "error", "message": f"Field '{field}' must be a numeric value"}), 400
            
    # Domain validation checks
    if data['cement'] <= 0:
        return jsonify({"status": "error", "message": "Cement content must be greater than zero"}), 400
    if data['water'] <= 0:
        return jsonify({"status": "error", "message": "Water content must be greater than zero"}), 400
    if data['coarseagg'] <= 0:
        return jsonify({"status": "error", "message": "Coarse aggregate must be greater than zero"}), 400
    if data['fineagg'] <= 0:
        return jsonify({"status": "error", "message": "Fine aggregate must be greater than zero"}), 400
    if data['age'] < 1 or data['age'] > 365:
        return jsonify({"status": "error", "message": "Age must be between 1 and 365 days"}), 400
    for field in ['slag', 'ash', 'superplastic']:
        if data[field] < 0:
            return jsonify({"status": "error", "message": f"{field.capitalize()} content cannot be negative"}), 400
            
    # Feature Engineering
    total_binder = data['cement'] + data['slag'] + data['ash']
    water_cement_ratio = data['water'] / data['cement']
    
    # Construct input dataframe matching exact training columns
    input_df = pd.DataFrame([{
        'cement': data['cement'],
        'slag': data['slag'],
        'ash': data['ash'],
        'water': data['water'],
        'superplastic': data['superplastic'],
        'coarseagg': data['coarseagg'],
        'fineagg': data['fineagg'],
        'age': data['age'],
        'Total_Binder': total_binder,
        'Water_Cement_Ratio': water_cement_ratio
    }])
    
    # Scale input
    try:
        scaled_input = scaler.transform(input_df)
    except Exception as e:
        return jsonify({"status": "error", "message": f"Error during scaling: {str(e)}"}), 500
        
    # Predict
    try:
        predicted_strength = model.predict(scaled_input)[0]
    except Exception as e:
        return jsonify({"status": "error", "message": f"Error during prediction: {str(e)}"}), 500
        
    # Classify strength
    if predicted_strength < 20:
        classification = "Low Strength"
        description = "Low strength concrete, not suitable for structural applications. Best used for light paths, borders, or non-load-bearing elements."
    elif 20 <= predicted_strength < 30:
        classification = "Residential Strength"
        description = "Standard residential grade. Ideal for residential driveways, foundations, slabs, and light building constructions."
    elif 30 <= predicted_strength < 50:
        classification = "Commercial Strength"
        description = "High structural grade. Suitable for commercial structures, high-load columns, industrial flooring, and heavy-duty slabs."
    else:
        classification = "Heavy Infrastructure Strength"
        description = "Ultra-high performance structural concrete. Used for heavy civil engineering works, bridges, highway structures, and massive load support."
        
    return jsonify({
        "status": "success",
        "predicted_strength_mpa": float(predicted_strength),
        "classification": classification,
        "description": description,
        "total_binder_kg_m3": float(total_binder),
        "water_cement_ratio": float(water_cement_ratio)
    })


if __name__ == "__main__":
    app.run(debug=True) 