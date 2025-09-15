from fastapi import FastAPI, UploadFile, File, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
import face_recognition
import cv2
import numpy as np
import base64
import os
import glob
from io import BytesIO
from PIL import Image

app = FastAPI()

# Load known faces at startup
known_face_encodings = []
known_face_names = []

def load_known_faces():
    global known_face_encodings, known_face_names
    known_face_encodings = []
    known_face_names = []

    # Load all images from images directory
    image_files = glob.glob("images/*.jpg") + glob.glob("images/*.jpeg") + glob.glob("images/*.png")

    for image_path in image_files:
        try:
            # Get name from filename (without extension)
            name = os.path.splitext(os.path.basename(image_path))[0]

            # Load and encode face
            image = face_recognition.load_image_file(image_path)
            face_encodings = face_recognition.face_encodings(image)

            if face_encodings:  # If at least one face found
                known_face_encodings.append(face_encodings[0])
                known_face_names.append(name)
                print(f"Loaded face: {name}")
            else:
                print(f"No face found in {image_path}")

        except Exception as e:
            print(f"Error loading {image_path}: {e}")

# Load faces when app starts
load_known_faces()

@app.get("/", response_class=HTMLResponse)
async def root():
    return """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Face Recognition Web App</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                max-width: 800px;
                margin: 0 auto;
                padding: 20px;
                text-align: center;
            }
            #video {
                border: 2px solid #ccc;
                border-radius: 10px;
                margin: 20px 0;
            }
            #canvas {
                display: none;
            }
            button {
                background-color: #4CAF50;
                color: white;
                padding: 15px 30px;
                font-size: 16px;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                margin: 10px;
            }
            button:hover {
                background-color: #45a049;
            }
            button:disabled {
                background-color: #cccccc;
                cursor: not-allowed;
            }
            #result {
                margin-top: 20px;
                padding: 20px;
                border-radius: 10px;
                min-height: 50px;
            }
            .success {
                background-color: #d4edda;
                border: 1px solid #c3e6cb;
                color: #155724;
            }
            .error {
                background-color: #f8d7da;
                border: 1px solid #f5c6cb;
                color: #721c24;
            }
            .info {
                background-color: #d1ecf1;
                border: 1px solid #bee5eb;
                color: #0c5460;
            }
        </style>
    </head>
    <body>
        <h1>Face Recognition Web App</h1>

        <video id="video" width="640" height="480" autoplay></video>
        <canvas id="canvas" width="640" height="480"></canvas>

        <br>
        <button onclick="captureAndSubmit()" id="submitBtn">Submit Frame</button>

        <div id="result"></div>

        <script>
            const video = document.getElementById('video');
            const canvas = document.getElementById('canvas');
            const ctx = canvas.getContext('2d');
            const submitBtn = document.getElementById('submitBtn');
            const result = document.getElementById('result');

            // Access webcam
            navigator.mediaDevices.getUserMedia({ video: true })
                .then(stream => {
                    video.srcObject = stream;
                })
                .catch(err => {
                    console.error('Error accessing webcam:', err);
                    result.innerHTML = '<div class="error">Error: Could not access webcam</div>';
                });

            async function captureAndSubmit() {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Processing...';
                result.innerHTML = '<div class="info">Processing frame...</div>';

                try {
                    // Draw current video frame to canvas
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

                    // Convert canvas to blob
                    canvas.toBlob(async (blob) => {
                        const formData = new FormData();
                        formData.append('file', blob, 'frame.jpg');

                        try {
                            const response = await fetch('/recognize', {
                                method: 'POST',
                                body: formData
                            });

                            const data = await response.json();

                            if (response.ok) {
                                if (data.faces && data.faces.length > 0) {
                                    let resultText = `<div class="success"><strong>Faces detected:</strong><br>`;
                                    data.faces.forEach(face => {
                                        resultText += `• ${face.name} (confidence: ${(face.confidence * 100).toFixed(1)}%)<br>`;
                                    });
                                    resultText += `</div>`;
                                    result.innerHTML = resultText;
                                } else {
                                    result.innerHTML = '<div class="info">No known faces detected</div>';
                                }
                            } else {
                                result.innerHTML = `<div class="error">Error: ${data.detail}</div>`;
                            }
                        } catch (error) {
                            result.innerHTML = `<div class="error">Network error: ${error.message}</div>`;
                        }
                    }, 'image/jpeg', 0.8);

                } catch (error) {
                    result.innerHTML = `<div class="error">Capture error: ${error.message}</div>`;
                } finally {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Submit Frame';
                }
            }
        </script>
    </body>
    </html>
    """

@app.post("/recognize")
async def recognize_face(file: UploadFile = File(...)):
    try:
        # Read uploaded image
        contents = await file.read()

        # Convert to numpy array
        nparr = np.frombuffer(contents, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if image is None:
            return {"error": "Could not decode image"}

        # Convert BGR to RGB
        rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

        # Find faces in the image
        face_locations = face_recognition.face_locations(rgb_image)
        face_encodings = face_recognition.face_encodings(rgb_image, face_locations)

        detected_faces = []

        for face_encoding in face_encodings:
            # Compare with known faces
            matches = face_recognition.compare_faces(known_face_encodings, face_encoding)
            face_distances = face_recognition.face_distance(known_face_encodings, face_encoding)

            name = "Unknown"
            confidence = 0.0

            if True in matches:
                best_match_index = np.argmin(face_distances)
                if matches[best_match_index]:
                    name = known_face_names[best_match_index]
                    # Convert distance to confidence (lower distance = higher confidence)
                    confidence = 1.0 - face_distances[best_match_index]

            detected_faces.append({
                "name": name,
                "confidence": float(confidence)
            })

        return {
            "faces": detected_faces,
            "total_faces": len(detected_faces)
        }

    except Exception as e:
        return {"error": f"Processing error: {str(e)}"}

@app.get("/reload-faces")
async def reload_faces():
    """Endpoint to reload known faces from images directory"""
    try:
        load_known_faces()
        return {
            "message": "Faces reloaded successfully",
            "loaded_faces": len(known_face_names),
            "names": known_face_names
        }
    except Exception as e:
        return {"error": f"Error reloading faces: {str(e)}"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)