// Sample wig data
const WIG_DATA = [
    { id: 'wig1', name: 'Royal Curls', thumbnail: 'https://blog.turbosquid.com/wp-content/uploads/sites/2/2022/08/curly-2k-scaled.jpg?w=862', overlay: 'wig1-overlay' },
    { id: 'wig2', name: 'Silky Straight', thumbnail: 'https://alurewigs.com/cdn/shop/files/Untitleddesign-2.png?v=1687202037', overlay: 'wig2-overlay' },
    { id: 'wig3', name: 'Kinky Coils', thumbnail: 'https://www.privatelabelextensions.com/cdn/shop/files/afro-kinky-2x6-hd-closure-wig.jpg?v=1735327739', overlay: 'wig3-overlay' },
    { id: 'wig4', name: 'Bouncy Bob', thumbnail: 'https://www.mycrownedwigs.com/1881-thickbox_default/brazilian-virgin-bounce-wave-bob-136-lace-frontal-wig-lf394-.jpg', overlay: 'wig4-overlay' }
];

// DOM Elements
const videoElement = document.getElementById('video');
const canvasElement = document.getElementById('canvas');
const canvasCtx = canvasElement.getContext('2d');
const uploadOverlay = document.getElementById('upload-overlay');
const photoUpload = document.getElementById('photo-upload');
const toggleModeBtn = document.getElementById('toggle-mode');
const wigGrid = document.getElementById('wig-grid');
const captureBtn = document.getElementById('capture-btn');
const shareBtn = document.getElementById('share-btn');
const returnBtn = document.getElementById('return-btn');

// State
let selectedWig = WIG_DATA[0];
let isCameraMode = false;
let faceMesh;
let camera;
let currentImage = null;

// Initialize the application
async function init() {
    setupWigSelection();
    setupEventListeners();
    initializeFaceMesh();
    
    // Start in photo upload mode by default
    switchToUploadMode();
}

// Set up wig selection UI
function setupWigSelection() {
    wigGrid.innerHTML = '';
    
    WIG_DATA.forEach(wig => {
        const wigElement = document.createElement('div');
        wigElement.className = 'wig-thumbnail';
        wigElement.dataset.wigId = wig.id;
        
        const img = document.createElement('img');
        img.src = wig.thumbnail;
        img.alt = wig.name;
        img.title = wig.name;
        
        wigElement.appendChild(img);
        wigElement.addEventListener('click', () => selectWig(wig));
        
        wigGrid.appendChild(wigElement);
    });
    
    // Select first wig by default
    if (WIG_DATA.length > 0) {
        selectWig(WIG_DATA[0]);
    }
}

// Select a wig
function selectWig(wig) {
    selectedWig = wig;
    
    // Update UI
    document.querySelectorAll('.wig-thumbnail').forEach(el => {
        el.classList.remove('active');
    });
    
    const selectedEl = document.querySelector(`.wig-thumbnail[data-wig-id="${wig.id}"]`);
    if (selectedEl) {
        selectedEl.classList.add('active');
    }
}

// Set up event listeners
function setupEventListeners() {
    toggleModeBtn.addEventListener('click', toggleMode);
    photoUpload.addEventListener('change', handlePhotoUpload);
    captureBtn.addEventListener('click', captureLook);
    shareBtn.addEventListener('click', shareLook);
    returnBtn.addEventListener('click', () => {
        alert('Returning to shop - this would navigate in a real implementation');
    });
}

// Initialize FaceMesh
function initializeFaceMesh() {
    faceMesh = new FaceMesh({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
        }
    });
    
    faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });
    
    faceMesh.onResults(onFaceMeshResults);
}

// Handle FaceMesh results
function onFaceMeshResults(results) {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
    // Draw camera feed or uploaded image
    if (isCameraMode || currentImage) {
        canvasCtx.drawImage(
            isCameraMode ? results.image : currentImage,
            0, 0,
            canvasElement.width,
            canvasElement.height
        );
    }
    
    // Apply wig overlay if face detected
    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0 && selectedWig) {
        const landmarks = results.multiFaceLandmarks[0];
        const wigOverlay = document.getElementById(selectedWig.overlay);
        
        if (wigOverlay) {
            // Get forehead points for positioning
            const foreheadTop = landmarks[10];  // Forehead top center
            const foreheadLeft = landmarks[234];  // Left temple
            const foreheadRight = landmarks[454];  // Right temple
            
            // Calculate wig position and size
            const wigWidth = Math.abs(foreheadLeft.x - foreheadRight.x) * canvasElement.width * 1.2;
            const wigHeight = wigWidth * (wigOverlay.height / wigOverlay.width);
            
            const wigX = foreheadTop.x * canvasElement.width - (wigWidth / 2);
            const wigY = foreheadTop.y * canvasElement.height - (wigHeight * 0.2);
            
            // Draw wig overlay
            canvasCtx.drawImage(
                wigOverlay,
                wigX, wigY,
                wigWidth, wigHeight
            );
        }
    }
    
    canvasCtx.restore();
}

// Toggle between camera and photo upload modes
function toggleMode() {
    if (isCameraMode) {
        switchToUploadMode();
    } else {
        switchToCameraMode();
    }
}

// Switch to camera mode
async function switchToCameraMode() {
    try {
        // First stop any existing stream
        if (videoElement.srcObject) {
            videoElement.srcObject.getTracks().forEach(track => track.stop());
        }

        // Get camera access with better error handling
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'user',
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false
        }).catch(err => {
            console.error('Camera access error:', err);
            throw err;
        });

        videoElement.srcObject = stream;
        
        // Wait for video metadata to load
        await new Promise((resolve) => {
            videoElement.onloadedmetadata = () => {
                canvasElement.width = videoElement.videoWidth;
                canvasElement.height = videoElement.videoHeight;
                resolve();
            };
            videoElement.onerror = () => {
                throw new Error('Video error occurred');
            };
        });

        videoElement.play();
        isCameraMode = true;
        uploadOverlay.style.display = 'none';
        toggleModeBtn.textContent = 'Upload Photo Instead';
        currentImage = null;
        
        // Start face detection
        startFaceDetection();
        
    } catch (error) {
        console.error('Camera initialization failed:', error);
        uploadOverlay.style.display = 'flex';
        isCameraMode = false;
        toggleModeBtn.textContent = 'Switch to Camera';
        
        // Show user-friendly error message
        const errorMessage = getCameraErrorMessage(error);
        alert(`Camera access failed: ${errorMessage}\n\nPlease try uploading a photo instead.`);
    }
}

// Helper function to translate camera errors
function getCameraErrorMessage(error) {
    switch(error.name) {
        case 'NotAllowedError':
            return 'Permission denied. Please allow camera access in your browser settings.';
        case 'NotFoundError':
            return 'No camera found. Please check your device has a camera.';
        case 'NotReadableError':
            return 'Camera is already in use by another application.';
        case 'OverconstrainedError':
            return 'Camera doesn\'t support requested settings.';
        default:
            return 'Unknown error occurred.';
    }
}

// Switch to upload mode
function switchToUploadMode() {
    if (camera) {
        camera.stop();
        const stream = videoElement.srcObject;
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
    }
    
    isCameraMode = false;
    uploadOverlay.style.display = 'flex';
    toggleModeBtn.textContent = 'Switch to Camera';
    videoElement.srcObject = null;
}

// Start face detection
function startFaceDetection() {
    camera = new Camera(videoElement, {
        onFrame: async () => {
            await faceMesh.send({ image: videoElement });
        },
        width: canvasElement.width,
        height: canvasElement.height
    });
    camera.start();
}

// Handle photo upload
function handlePhotoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            // Set canvas dimensions to match image
            canvasElement.width = img.width;
            canvasElement.height = img.height;
            
            // Draw image to canvas
            canvasCtx.drawImage(img, 0, 0);
            currentImage = img;
            
            // Process image for face detection
            faceMesh.send({ image: img });
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

// Capture the current look
function captureLook() {
    // Create a temporary canvas to add watermark
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvasElement.width;
    tempCanvas.height = canvasElement.height;
    const tempCtx = tempCanvas.getContext('2d');
    
    // Copy current canvas
    tempCtx.drawImage(canvasElement, 0, 0);
    
    // Add watermark
    tempCtx.font = '20px "Playfair Display", serif';
    tempCtx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    const textWidth = tempCtx.measureText('Crown Wigs By Nila').width;
    tempCtx.fillRect(canvasElement.width - textWidth - 30, canvasElement.height - 40, textWidth + 20, 30);
    tempCtx.fillStyle = '#333';
    tempCtx.fillText('Crown Wigs By Nila', canvasElement.width - textWidth - 20, canvasElement.height - 20);
    
    // Create download link
    const link = document.createElement('a');
    link.download = 'crown-wigs-try-on.png';
    link.href = tempCanvas.toDataURL('image/png');
    link.click();
    
    // Show feedback
    const originalText = captureBtn.textContent;
    captureBtn.textContent = 'Saved!';
    setTimeout(() => {
        captureBtn.textContent = originalText;
    }, 2000);
}

// Share the current look
async function shareLook() {
    if (navigator.share) {
        try {
            // Convert canvas to blob
            canvasElement.toBlob(async (blob) => {
                const file = new File([blob], 'crown-wigs-try-on.png', { type: 'image/png' });
                
                await navigator.share({
                    title: 'My New Look from Crown Wigs By Nila',
                    text: 'Check out this wig I tried on virtually!',
                    files: [file]
                });
            });
        } catch (error) {
            console.log('Sharing cancelled', error);
        }
    } else {
        // Fallback for browsers without Web Share API
        alert('Sharing is not supported in your browser. You can save the image and share it manually.');
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', init);