// Live Detection Module - Namespaced to avoid conflicts
const LiveDetection = {
    // Configuration
    isDetecting: false,
    detectionInterval: null,
    detectionIntervalMs: 2000,
    showUnknownFaces: true,
    confidenceThreshold: 0.6,
    frameCount: 0,
    lastFpsTime: Date.now(),
    fps: 0,

    // DOM elements
    video: null,
    canvas: null,
    ctx: null,
    toggleBtn: null,
    captureBtn: null,
    result: null,
    statusDot: null,
    statusText: null,
    fpsCounter: null,
    intervalSelect: null,
    showUnknownCheckbox: null,
    confidenceSlider: null,
    confidenceValue: null,

    // Initialize the module
    init() {
        // Get DOM elements
        this.video = document.getElementById('video');
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.toggleBtn = document.getElementById('toggleBtn');
        this.captureBtn = document.getElementById('captureBtn');
        this.result = document.getElementById('result');
        this.statusDot = document.getElementById('statusDot');
        this.statusText = document.getElementById('statusText');
        this.fpsCounter = document.getElementById('fpsCounter');
        this.intervalSelect = document.getElementById('intervalSelect');
        this.showUnknownCheckbox = document.getElementById('showUnknown');
        this.confidenceSlider = document.getElementById('confidenceThreshold');
        this.confidenceValue = document.getElementById('confidenceValue');

        // Initialize webcam and settings
        this.initWebcam();
        this.updateConfidenceDisplay();
        this.setupEventListeners();
    },

    // Initialize webcam
    initWebcam() {
        navigator.mediaDevices.getUserMedia({ video: true })
            .then(stream => {
                this.video.srcObject = stream;
                console.log('Webcam initialized for live detection');
            })
            .catch(err => {
                console.error('Error accessing webcam:', err);
                this.showResult('error', 'Error: Could not access webcam. Please check your camera permissions.');
            });
    },

    // Setup event listeners
    setupEventListeners() {
        // Keyboard shortcuts
        document.addEventListener('keydown', (event) => {
            // Space to toggle detection
            if (event.code === 'Space' && !event.target.matches('input, select, textarea')) {
                event.preventDefault();
                this.toggleDetection();
            }

            // C key to capture frame
            if (event.code === 'KeyC' && this.isDetecting) {
                event.preventDefault();
                this.captureFrame();
            }

            // R key to reload faces
            if (event.code === 'KeyR' && event.ctrlKey) {
                event.preventDefault();
                this.reloadFaces();
            }

            // Escape to stop detection
            if (event.code === 'Escape' && this.isDetecting) {
                event.preventDefault();
                this.stopDetection();
            }
        });

        // Page visibility changes
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.isDetecting) {
                console.log('Page hidden, pausing detection');
            } else if (!document.hidden && this.isDetecting) {
                console.log('Page visible, resuming detection');
            }
        });

        // Clean up when page is unloaded
        window.addEventListener('beforeunload', () => {
            if (this.isDetecting) {
                this.stopDetection();
            }
        });

        // Settings change listener
        if (this.confidenceSlider) {
            this.confidenceSlider.addEventListener('input', () => this.updateSettings());
        }
    },

    // Toggle live detection
    toggleDetection() {
        if (!this.video.srcObject) {
            this.showResult('error', 'Webcam is not available');
            return;
        }

        if (this.isDetecting) {
            this.stopDetection();
        } else {
            this.startDetection();
        }
    },

    // Start live detection
    startDetection() {
        this.isDetecting = true;
        this.frameCount = 0;
        this.lastFpsTime = Date.now();

        // Update UI
        this.toggleBtn.textContent = 'Stop Detection';
        this.toggleBtn.classList.remove('btn-primary');
        this.toggleBtn.classList.add('btn-danger');
        this.captureBtn.disabled = false;
        this.statusDot.className = 'status-dot running';
        this.statusText.textContent = 'Detection Running';

        this.showResult('info', 'Live detection started. Analyzing frames every ' + (this.detectionIntervalMs / 1000) + ' seconds...');

        // Start detection loop
        this.detectionInterval = setInterval(() => this.detectFaces(), this.detectionIntervalMs);

        console.log('Live detection started');
    },

    // Stop live detection
    stopDetection() {
        this.isDetecting = false;

        if (this.detectionInterval) {
            clearInterval(this.detectionInterval);
            this.detectionInterval = null;
        }

        // Update UI
        this.toggleBtn.textContent = 'Start Live Detection';
        this.toggleBtn.classList.remove('btn-danger');
        this.toggleBtn.classList.add('btn-primary');
        this.captureBtn.disabled = true;
        this.statusDot.className = 'status-dot stopped';
        this.statusText.textContent = 'Detection Stopped';
        this.fpsCounter.textContent = 'FPS: 0';

        this.showResult('info', 'Live detection stopped');

        console.log('Live detection stopped');
    },

    // Detect faces in current frame
    async detectFaces() {
        if (!this.isDetecting || !this.video.srcObject) {
            return;
        }

        try {
            // Update FPS counter
            this.frameCount++;
            const now = Date.now();
            if (now - this.lastFpsTime >= 1000) {
                this.fps = this.frameCount;
                this.frameCount = 0;
                this.lastFpsTime = now;
                this.fpsCounter.textContent = `FPS: ${this.fps}`;
            }

            // Capture frame
            this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);

            // Convert to blob and send for recognition
            this.canvas.toBlob(async (blob) => {
                const formData = new FormData();
                formData.append('file', blob, 'live_frame.jpg');

                try {
                    const response = await fetch('/recognize', {
                        method: 'POST',
                        body: formData
                    });

                    const data = await response.json();

                    if (response.ok) {
                        this.processDetectionResult(data);
                    } else {
                        console.error('Detection error:', data.error);
                    }
                } catch (error) {
                    console.error('Network error during detection:', error);
                }
            }, 'image/jpeg', 0.7);

        } catch (error) {
            console.error('Error during face detection:', error);
        }
    },

    // Process detection results
    processDetectionResult(data) {
        if (!data.faces || data.faces.length === 0) {
            this.updateResult('No faces detected', 'info');
            return;
        }

        // Filter faces based on settings
        const filteredFaces = data.faces.filter(face => {
            const meetsConfidence = face.confidence >= this.confidenceThreshold;
            const isKnown = face.name !== 'Unknown';

            if (isKnown) {
                return meetsConfidence;
            } else {
                return this.showUnknownFaces;
            }
        });

        if (filteredFaces.length === 0) {
            this.updateResult('No faces meet the detection criteria', 'info');
            return;
        }

        // Display results
        this.displayLiveResults(filteredFaces);
    },

    // Display live detection results
    displayLiveResults(faces) {
        const timestamp = new Date().toLocaleTimeString();
        let resultHtml = '';

        faces.forEach((face, index) => {
            const confidence = (face.confidence * 100).toFixed(1);
            const isKnown = face.name !== 'Unknown';
            const resultClass = isKnown ? 'known' : 'unknown';

            resultHtml += `
            <div class="detection-result ${resultClass}">
                <div class="face-info">
                    <span class="face-name">
                        ${isKnown ? '✅' : '❓'} ${face.name}
                    </span>
                    <span class="face-confidence">${confidence}%</span>
                </div>
                <div class="timestamp">${timestamp}</div>
            </div>
            `;
        });

        // Keep only last 5 results for performance
        const existingResults = this.result.querySelectorAll('.detection-result');
        if (existingResults.length >= 5) {
            // Remove oldest results
            for (let i = 0; i < existingResults.length - 4; i++) {
                existingResults[i].remove();
            }
        }

        // Add new results at the top
        const newDiv = document.createElement('div');
        newDiv.innerHTML = resultHtml;
        this.result.insertBefore(newDiv, this.result.firstChild);
    },

    // Capture current frame manually
    async captureFrame() {
        if (!this.isDetecting) {
            this.showResult('error', 'Live detection must be running to capture frames');
            return;
        }

        const originalBtn = this.captureBtn.textContent;
        this.captureBtn.disabled = true;
        this.captureBtn.textContent = '📸 Capturing...';

        try {
            // Force an immediate detection
            await this.detectFaces();

            setTimeout(() => {
                this.captureBtn.disabled = false;
                this.captureBtn.textContent = originalBtn;
            }, 1000);

        } catch (error) {
            console.error('Error capturing frame:', error);
            this.captureBtn.disabled = false;
            this.captureBtn.textContent = originalBtn;
        }
    },

    // Update detection interval
    updateInterval() {
        const newInterval = parseInt(this.intervalSelect.value);
        this.detectionIntervalMs = newInterval;

        if (this.isDetecting) {
            // Restart detection with new interval
            this.stopDetection();
            setTimeout(() => this.startDetection(), 100);
        }

        console.log('Detection interval updated to:', this.detectionIntervalMs, 'ms');
    },

    // Update settings
    updateSettings() {
        this.showUnknownFaces = this.showUnknownCheckbox.checked;
        this.confidenceThreshold = parseFloat(this.confidenceSlider.value);
        this.updateConfidenceDisplay();

        console.log('Settings updated:', {
            showUnknownFaces: this.showUnknownFaces,
            confidenceThreshold: this.confidenceThreshold
        });
    },

    // Update confidence display
    updateConfidenceDisplay() {
        const percentage = Math.round(this.confidenceThreshold * 100);
        this.confidenceValue.textContent = percentage + '%';
    },

    // Update result with single message
    updateResult(message, type) {
        const timestamp = new Date().toLocaleTimeString();
        this.result.innerHTML = `
            <div class="detection-result ${type}">
                <div class="face-info">
                    <span class="face-name">${message}</span>
                </div>
                <div class="timestamp">${timestamp}</div>
            </div>
        `;
    },

    // Show result message (for errors and info)
    showResult(type, message) {
        this.result.innerHTML = `<div class="${type}">${message}</div>`;
    },

    // Reload faces database
    async reloadFaces() {
        const wasDetecting = this.isDetecting;

        if (wasDetecting) {
            this.stopDetection();
        }

        try {
            this.showResult('info', 'Reloading faces database...');

            const response = await fetch('/reload-faces');
            const data = await response.json();

            if (response.ok) {
                this.showResult('success',
                    `✅ Faces reloaded successfully!<br>` +
                    `Loaded ${data.loaded_faces} faces: ${data.names.join(', ')}`
                );

                // Update known faces display
                this.updateKnownFacesDisplay(data.names);

                // Restart detection if it was running
                if (wasDetecting) {
                    setTimeout(() => this.startDetection(), 2000);
                }
            } else {
                this.showResult('error', `Error reloading faces: ${data.error}`);
            }
        } catch (error) {
            this.showResult('error', `Network error: ${error.message}`);
        }
    },

    // Update known faces display
    updateKnownFacesDisplay(names) {
        const knownFacesContainer = document.querySelector('.known-faces');
        if (knownFacesContainer) {
            knownFacesContainer.innerHTML = names.map(name =>
                `<div class="face-card"><span class="face-name">${name}</span></div>`
            ).join('');
        }
    }
};

// Global functions for HTML onclick handlers
function toggleDetection() {
    LiveDetection.toggleDetection();
}

function captureFrame() {
    LiveDetection.captureFrame();
}

function updateInterval() {
    LiveDetection.updateInterval();
}

function updateSettings() {
    LiveDetection.updateSettings();
}

function reloadFaces() {
    LiveDetection.reloadFaces();
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    LiveDetection.init();
});