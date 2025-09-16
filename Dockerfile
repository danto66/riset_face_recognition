# Use Python 3.10 base image
FROM python:3.10-slim

# Set working directory
WORKDIR /app

# Install system dependencies required for face_recognition, dlib, and OpenCV
RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    libopenblas-dev \
    liblapack-dev \
    libx11-dev \
    libgtk-3-dev \
    libboost-python-dev \
    libboost-system-dev \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libavcodec-dev \
    libavformat-dev \
    libswscale-dev \
    libv4l-dev \
    libxvidcore-dev \
    libx264-dev \
    libjpeg-dev \
    libpng-dev \
    libtiff-dev \
    gfortran \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements or install dependencies directly
COPY requirements.txt ./

# Install Python dependencies
# If no requirements.txt exists, install the main dependencies
RUN pip install --no-cache-dir -r requirements.txt; \

# Copy application files
COPY . .

# Create images directory if it doesn't exist
RUN mkdir -p images

# Expose port for FastAPI application
EXPOSE 80

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Default command to run FastAPI app
CMD ["python", "app.py"]