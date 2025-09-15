// Global variables
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const submitBtn = document.getElementById('submitBtn');
const result = document.getElementById('result');

// Initialize webcam on page load
document.addEventListener('DOMContentLoaded', function() {
    initWebcam();
});

// Initialize webcam
function initWebcam() {
    navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
            video.srcObject = stream;
            console.log('Webcam initialized successfully');
        })
        .catch(err => {
            console.error('Error accessing webcam:', err);
            showResult('error', 'Error: Could not access webcam. Please check your camera permissions.');
        });
}

// Capture frame and submit for recognition
async function captureAndSubmit() {
    if (!video.srcObject) {
        showResult('error', 'Webcam is not available');
        return;
    }

    setButtonState(true, 'Processing...');
    showResult('info', 'Processing frame...');

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
                        displayRecognitionResults(data.faces);
                    } else {
                        showResult('info', 'No known faces detected in the frame');
                    }
                } else {
                    showResult('error', `Error: ${data.detail || data.error || 'Unknown error'}`);
                }
            } catch (error) {
                showResult('error', `Network error: ${error.message}`);
            }
        }, 'image/jpeg', 0.8);

    } catch (error) {
        showResult('error', `Capture error: ${error.message}`);
    } finally {
        setButtonState(false, 'Submit Frame');
    }
}

// Display recognition results
function displayRecognitionResults(faces) {
    let resultHtml = '<div class="success">';
    resultHtml += `<strong>🎉 ${faces.length} face(s) detected!</strong><br><br>`;

    faces.forEach((face, index) => {
        const confidence = (face.confidence * 100).toFixed(1);
        const confidenceClass = face.confidence > 0.6 ? 'high-confidence' : 'low-confidence';

        resultHtml += `<div class="face-result ${confidenceClass}">`;
        resultHtml += `<strong>${index + 1}. ${face.name}</strong><br>`;
        resultHtml += `Confidence: ${confidence}% `;
        resultHtml += face.confidence > 0.6 ? '✅' : '⚠️';
        resultHtml += `</div>`;

        if (index < faces.length - 1) {
            resultHtml += '<br>';
        }
    });

    resultHtml += '</div>';
    result.innerHTML = resultHtml;
}

// Show result message
function showResult(type, message) {
    result.innerHTML = `<div class="${type}">${message}</div>`;
}

// Set button state
function setButtonState(disabled, text) {
    submitBtn.disabled = disabled;
    submitBtn.textContent = text;
}

// Reload faces database
async function reloadFaces() {
    try {
        showResult('info', 'Reloading faces database...');

        const response = await fetch('/reload-faces');
        const data = await response.json();

        if (response.ok) {
            showResult('success',
                `✅ Faces reloaded successfully!<br>` +
                `Loaded ${data.loaded_faces} faces: ${data.names.join(', ')}`
            );

            // Update known faces display if available
            updateKnownFacesDisplay(data.names);
        } else {
            showResult('error', `Error reloading faces: ${data.error}`);
        }
    } catch (error) {
        showResult('error', `Network error: ${error.message}`);
    }
}

// Update known faces display
function updateKnownFacesDisplay(names) {
    const knownFacesContainer = document.querySelector('.known-faces');
    if (knownFacesContainer) {
        knownFacesContainer.innerHTML = names.map(name =>
            `<div class="face-card"><span class="face-name">${name}</span></div>`
        ).join('');
    }
}

// Handle keyboard shortcuts
document.addEventListener('keydown', function(event) {
    // Space or Enter to capture frame
    if ((event.code === 'Space' || event.code === 'Enter') && !submitBtn.disabled) {
        event.preventDefault();
        captureAndSubmit();
    }

    // R key to reload faces
    if (event.code === 'KeyR' && event.ctrlKey) {
        event.preventDefault();
        reloadFaces();
    }
});

// Add visual feedback for camera status
video.addEventListener('loadedmetadata', function() {
    console.log('Video metadata loaded');
});

video.addEventListener('playing', function() {
    console.log('Video is playing');
});

// Handle camera errors
video.addEventListener('error', function(e) {
    console.error('Video error:', e);
    showResult('error', 'Video playback error occurred');
});