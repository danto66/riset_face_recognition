from fastapi import FastAPI, UploadFile, File, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import face_recognition
import cv2
import numpy as np
import os
import glob

app = FastAPI()

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Setup templates
templates = Jinja2Templates(directory="templates")

# Load known faces at startup
known_face_encodings = []
known_face_names = []

def load_known_faces(id = ""):
    global known_face_encodings, known_face_names
    known_face_encodings = []
    known_face_names = []

    if id:
        image_files = glob.glob(f"images/{id}/*.jpg") + glob.glob(f"images/{id}/*.jpeg") + glob.glob(f"images/{id}/*.png")
        if not image_files:
            raise ValueError(f"No images found for ID '{id}'")
    else:
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
# load_known_faces()

@app.get("/", response_class=HTMLResponse)
async def root(request: Request):
    return templates.TemplateResponse(
        "index.html",
        {
            "request": request,
            "known_faces": known_face_names
        }
    )

@app.get("/live", response_class=HTMLResponse)
async def live_detection(request: Request):
    return templates.TemplateResponse(
        "live.html",
        {
            "request": request,
            "known_faces": known_face_names
        }
    )

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

@app.post("/recognize/{id}")
async def recognize_face_by_id(id: str, file: UploadFile = File(...)):
    global known_face_encodings, known_face_names

    try:
        dir_path = f"images/{id}"

        if not os.path.exists(dir_path) or not os.path.isdir(dir_path):
            return {"error": f"ID '{id}' does not exist."}

        # Load known faces for the given ID
        load_known_faces(id)

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

        # Return only the face with highest confidence
        if not detected_faces:
            return {
                "matched": False,
                "name": "",
                "confidence": 0.0
            }

        best_face = max(detected_faces, key=lambda x: x["confidence"])
        if best_face["confidence"] == 0.0:
            return {
                "matched": False,
                "name": "",
                "confidence": 0.0
            }

        return {
            "matched": True,
            "name": best_face["name"],
            "confidence": best_face["confidence"]
        }

    except Exception as e:
        return {"error": f"Processing error: {str(e)}"}
    
    finally:
        known_face_encodings = []
        known_face_names = []

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
    uvicorn.run(app, host="0.0.0.0", port=80)