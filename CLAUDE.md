# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a real-time face recognition system using Python that captures video from a webcam and identifies known faces against a database of reference images. The system uses the `face_recognition` library built on top of dlib's face recognition capabilities.

## Environment Setup

The project uses a Python 3.10.0 virtual environment with the following key dependencies:
- `face-recognition==1.3.0` - Core face recognition functionality
- `opencv-python==4.12.0.88` - Video capture and image processing
- `dlib==20.0.0` - Face detection and feature extraction
- `numpy==2.2.6` - Numerical operations

## Common Commands

### Environment Activation
```bash
source venv/Scripts/activate  # Windows (Git Bash/MSYS)
# or
venv\Scripts\activate.bat     # Windows (cmd)
```

### Running the Application
```bash
python facerec.py
```
Press 'q' to quit the application.

### Dependency Management
```bash
pip freeze > requirements.txt  # Generate requirements file
pip install -r requirements.txt  # Install from requirements
```

## Architecture

### Core Components

**facerec.py** - Main application file containing:
- Webcam video capture loop using OpenCV
- Face detection and encoding using face_recognition library
- Real-time face matching against known faces database
- Live video display with bounding boxes and name labels

**images/** - Reference photo database:
- Contains .jpg/.jpeg images of known individuals
- Each image should contain a clear, front-facing photo
- Filenames are used as the basis for person identification

### Face Recognition Flow

1. **Initialization**: Load reference images from `images/` directory and generate face encodings
2. **Video Capture**: Continuous frame capture from default camera (index 0)
3. **Face Detection**: Locate faces in each frame using HOG-based detector
4. **Encoding**: Generate 128-dimensional face encodings for detected faces
5. **Matching**: Compare detected face encodings against known face database
6. **Display**: Draw bounding boxes and labels on recognized faces

### Key Technical Details

- Color space conversion from BGR (OpenCV) to RGB (face_recognition) is required
- Face encodings are 128-dimensional vectors representing facial features
- Matching uses Euclidean distance comparison with configurable tolerance
- The system processes every frame in real-time, which may be CPU intensive

## Adding New People

To add recognition for new individuals:
1. Add clear, front-facing photos to the `images/` directory
2. Update the face loading code in `facerec.py` to include new images
3. Add corresponding names to the `known_face_names` array

## Performance Considerations

- Processing every frame is computationally expensive
- Consider processing every nth frame for better performance
- Image resolution affects both accuracy and processing speed
- dlib face detection works best with well-lit, front-facing images