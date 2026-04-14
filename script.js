document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const imagePreview = document.getElementById('image-preview');
    const controlsBar = document.getElementById('controls-bar');
    const fileCountSpan = document.getElementById('file-count');
    const clearAllBtn = document.getElementById('clear-all-btn');
    const generatePdfBtn = document.getElementById('generate-pdf-btn');
    const loadingOverlay = document.getElementById('loading-overlay');
    
    let imageFiles = []; // Store image objects: { id, file, dataUrl }

    // --- Drag and Drop Events ---
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.add('dragover');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.remove('dragover');
        }, false);
    });

    dropZone.addEventListener('drop', handleDrop, false);
    fileInput.addEventListener('change', handleFileSelect, false);

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    }

    function handleFileSelect(e) {
        const files = e.target.files;
        handleFiles(files);
        // Reset input so the same files can be selected again if removed
        fileInput.value = ""; 
    }

    function handleFiles(files) {
        const validFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
        if (validFiles.length === 0) return;

        validFiles.forEach(file => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (e) => {
                const imgData = e.target.result;
                const id = 'img_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
                
                imageFiles.push({
                    id: id,
                    file: file,
                    dataUrl: imgData
                });
                
                renderPreview();
            };
        });
    }

    // --- Render Previews ---
    function renderPreview() {
        imagePreview.innerHTML = '';
        
        imageFiles.forEach(imgData => {
            const card = document.createElement('div');
            card.className = 'preview-card';
            card.dataset.id = imgData.id;
            
            card.innerHTML = `
                <img src="${imgData.dataUrl}" alt="${imgData.file.name}">
                <div class="info">
                    <span class="filename" title="${imgData.file.name}">${imgData.file.name}</span>
                    <button class="remove-btn" onclick="removeImage('${imgData.id}')" title="Remove">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            `;
            
            imagePreview.appendChild(card);
        });

        updateControls();
    }

    window.removeImage = function(id) {
        imageFiles = imageFiles.filter(img => img.id !== id);
        renderPreview();
    };

    clearAllBtn.addEventListener('click', () => {
        imageFiles = [];
        renderPreview();
    });

    function updateControls() {
        if (imageFiles.length > 0) {
            controlsBar.style.display = 'flex';
            fileCountSpan.textContent = imageFiles.length;
            // Initialize Sortable if not already
            if (!imagePreview.sortableInstance) {
                imagePreview.sortableInstance = new Sortable(imagePreview, {
                    animation: 150,
                    ghostClass: 'sortable-ghost',
                    onEnd: function () {
                        // Re-sync array based on DOM order
                        const newOrderIds = Array.from(imagePreview.children).map(card => card.dataset.id);
                        imageFiles = newOrderIds.map(id => imageFiles.find(img => img.id === id));
                    }
                });
            }
        } else {
            controlsBar.style.display = 'none';
            if (imagePreview.sortableInstance) {
                imagePreview.sortableInstance.destroy();
                imagePreview.sortableInstance = null;
            }
        }
    }

    // --- PDF Generation ---
    generatePdfBtn.addEventListener('click', async () => {
        if (imageFiles.length === 0) return;
        
        loadingOverlay.classList.remove('hidden');
        
        // We use setTimeout to allow UI to update with the loading spinner
        setTimeout(async () => {
            try {
                const { jsPDF } = window.jspdf;
                let doc = null;

                for (let i = 0; i < imageFiles.length; i++) {
                    const imgObj = imageFiles[i];
                    
                    // Get natural image dimensions
                    const img = new Image();
                    img.src = imgObj.dataUrl;
                    
                    await new Promise((resolve) => {
                        img.onload = resolve;
                    });

                    // Define page orientation and dimensions exactly matching the image
                    // This ensures absolute zero quality loss as the PDF maps 1:1 with image pixels
                    const width = img.naturalWidth;
                    const height = img.naturalHeight;
                    const orientation = width > height ? 'l' : 'p';
                    
                    if (i === 0) {
                        // Initialize document with the first image's size
                        doc = new jsPDF({
                            orientation: orientation,
                            unit: 'px',
                            format: [width, height]
                        });
                    } else {
                        // Add new page for subsequent images
                        doc.addPage([width, height], orientation);
                    }

                    // Extract format
                    let format = 'JPEG'; // Default
                    if (imgObj.file.type === 'image/png') format = 'PNG';
                    if (imgObj.file.type === 'image/webp') format = 'WEBP';
                    
                    // Add image covering the entire exact-sized page
                    doc.addImage(imgObj.dataUrl, format, 0, 0, width, height);
                }

                doc.save('PixelPerfect_Converted.pdf');
            } catch (error) {
                console.error("PDF Generation Error:", error);
                alert("An error occurred during PDF generation.");
            } finally {
                loadingOverlay.classList.add('hidden');
            }
        }, 100); // 100ms delay for UI render
    });
});
