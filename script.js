document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const imagePreview = document.getElementById('image-preview');
    const controlsBar = document.getElementById('controls-bar');
    const fileCountSpan = document.getElementById('file-count');
    const clearAllBtn = document.getElementById('clear-all-btn');
    const generatePdfBtn = document.getElementById('generate-pdf-btn');
    const loadingOverlay = document.getElementById('loading-overlay');
    
    // New Settings Elements
    const pdfFilenameInput = document.getElementById('pdf-filename');
    const pdfTargetSizeSelect = document.getElementById('pdf-target-size');
    const autoConvertToggle = document.getElementById('auto-convert-toggle');
    
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

        let loadedCount = 0;

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
                
                loadedCount++;
                renderPreview();

                // If all files are loaded and auto-convert is on, trigger generation
                if (loadedCount === validFiles.length && autoConvertToggle.checked) {
                    generatePdfBtn.click();
                }
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

    // --- Compress Image Helper ---
    function compressImage(img, targetSizeMB, format) {
        return new Promise((resolve) => {
            let canvas = document.createElement('canvas');
            let ctx = canvas.getContext('2d');
            let width = img.naturalWidth;
            let height = img.naturalHeight;
            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);

            // If no limit, return original to avoid quality loss
            if (targetSizeMB === 'none') {
                resolve(img.src);
                return;
            }

            // Target bytes per image with a 25% safety margin for PDF structural overhead
            const targetBytes = (parseFloat(targetSizeMB) * 1024 * 1024 * 0.75) / imageFiles.length;
            let quality = 0.9;
            
            // Force JPEG for effective compression
            let outputFormat = format === 'PNG' ? 'image/jpeg' : `image/${format.toLowerCase()}`;
            if (outputFormat === 'image/png') outputFormat = 'image/jpeg';

            let dataUrl = canvas.toDataURL(outputFormat, quality);
            // Estimate true binary size from base64 string ('data:image/jpeg;base64,' is 23 chars)
            let approxBytes = Math.round((dataUrl.length - 23) * (3 / 4));
            
            // 1. Iteratively reduce quality to hit the target size
            while (approxBytes > targetBytes && quality > 0.1) {
                quality -= 0.1;
                dataUrl = canvas.toDataURL(outputFormat, quality);
                approxBytes = Math.round((dataUrl.length - 23) * (3 / 4));
            }
            
            // 2. If it's STILL too large, scale down the physical dimensions.
            // We scale aggressively (0.7x) and allow it to go down to 50px if needed to guarantee the hard limit.
            while (approxBytes > targetBytes && width > 50) {
                width *= 0.7;
                height *= 0.7;
                canvas.width = width;
                canvas.height = height;
                // Redraw scaled image
                ctx.drawImage(img, 0, 0, width, height);
                dataUrl = canvas.toDataURL(outputFormat, quality);
                approxBytes = Math.round((dataUrl.length - 23) * (3 / 4));
            }
            
            resolve(dataUrl);
        });
    }

    // --- PDF Generation ---
    generatePdfBtn.addEventListener('click', async () => {
        if (imageFiles.length === 0) return;
        
        loadingOverlay.classList.remove('hidden');
        
        setTimeout(async () => {
            try {
                const { jsPDF } = window.jspdf;
                let doc = new jsPDF({
                    orientation: 'p',
                    unit: 'mm',
                    format: 'a4'
                });

                const a4Width = 210;
                const a4Height = 297;
                const targetSizeMB = pdfTargetSizeSelect.value;
                let filename = pdfFilenameInput.value.trim();
                if (!filename.toLowerCase().endsWith('.pdf')) {
                    filename += '.pdf';
                }
                if (filename === '.pdf') filename = 'Converted.pdf';

                for (let i = 0; i < imageFiles.length; i++) {
                    const imgObj = imageFiles[i];
                    
                    const img = new Image();
                    img.src = imgObj.dataUrl;
                    
                    await new Promise((resolve) => {
                        img.onload = resolve;
                    });

                    // Extract format
                    let format = 'JPEG';
                    if (imgObj.file.type === 'image/png') format = 'PNG';
                    if (imgObj.file.type === 'image/webp') format = 'WEBP';

                    // Apply compression if a target size is selected
                    const compressedDataUrl = await compressImage(img, targetSizeMB, format);
                    
                    // Since we might have changed to JPEG during compression:
                    if (targetSizeMB !== 'none') format = 'JPEG'; 

                    // Calculate scale to fit A4
                    const imgRatio = img.naturalWidth / img.naturalHeight;
                    const a4Ratio = a4Width / a4Height;
                    
                    let drawWidth = a4Width;
                    let drawHeight = a4Height;
                    
                    if (imgRatio > a4Ratio) {
                        // Image is wider than A4 proportion
                        drawHeight = a4Width / imgRatio;
                    } else {
                        // Image is taller than A4 proportion
                        drawWidth = a4Height * imgRatio;
                    }
                    
                    // Center the image
                    const x = (a4Width - drawWidth) / 2;
                    const y = (a4Height - drawHeight) / 2;

                    if (i > 0) {
                        doc.addPage('a4', 'p');
                    }

                    doc.addImage(compressedDataUrl, format, x, y, drawWidth, drawHeight);
                }

                doc.save(filename);
            } catch (error) {
                console.error("PDF Generation Error:", error);
                alert("An error occurred during PDF generation.");
            } finally {
                loadingOverlay.classList.add('hidden');
            }
        }, 100); // 100ms delay for UI render
    });
});
