document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const imagePreview = document.getElementById('image-preview');
    const controlsBar = document.getElementById('controls-bar');
    const fileCountSpan = document.getElementById('file-count');
    const clearAllBtn = document.getElementById('clear-all-btn');
    const generatePdfBtn = document.getElementById('generate-pdf-btn');
    const loadingOverlay = document.getElementById('loading-overlay');
    
    const pdfFilenameInput = document.getElementById('pdf-filename');
    const pdfTargetSizeSelect = document.getElementById('pdf-target-size');
    const autoConvertToggle = document.getElementById('auto-convert-toggle');
    
    // PDF Compressor Elements
    const pdfDropZone = document.getElementById('pdf-drop-zone');
    const pdfFileInput = document.getElementById('pdf-file-input');
    const pdfControlsBar = document.getElementById('pdf-controls-bar');
    const pdfFileNameDisplay = document.getElementById('pdf-file-name-display');
    const pdfClearBtn = document.getElementById('pdf-clear-btn');
    const compressPdfBtn = document.getElementById('compress-pdf-btn');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    let imageFiles = []; // Store image objects: { id, file, dataUrl }
    let currentPdfFile = null; // Store single PDF file

    // --- Tab Switching Events ---
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(btn.dataset.target).classList.add('active');
        });
    });

    // --- Drag and Drop Events (Images) ---
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
        pdfDropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'), false);
        pdfDropZone.addEventListener(eventName, () => pdfDropZone.classList.add('dragover'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false);
        pdfDropZone.addEventListener(eventName, () => pdfDropZone.classList.remove('dragover'), false);
    });

    dropZone.addEventListener('drop', handleDrop, false);
    fileInput.addEventListener('change', handleFileSelect, false);
    pdfDropZone.addEventListener('drop', handlePdfDrop, false);
    pdfFileInput.addEventListener('change', handlePdfSelect, false);

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

    // --- PDF Compressor Logic ---
    function handlePdfDrop(e) {
        const dt = e.dataTransfer;
        handlePdfFiles(dt.files);
    }

    function handlePdfSelect(e) {
        handlePdfFiles(e.target.files);
        pdfFileInput.value = "";
    }

    function handlePdfFiles(files) {
        const validPdf = Array.from(files).find(file => file.type === 'application/pdf');
        if (!validPdf) {
            alert('Please select a valid PDF file.');
            return;
        }

        currentPdfFile = validPdf;
        pdfFileNameDisplay.textContent = validPdf.name;
        pdfControlsBar.style.display = 'flex';
        
        // Auto-convert applies here too
        if (autoConvertToggle.checked) {
            compressPdfBtn.click();
        }
    }

    pdfClearBtn.addEventListener('click', () => {
        currentPdfFile = null;
        pdfFileNameDisplay.textContent = 'No file selected';
        pdfControlsBar.style.display = 'none';
    });

    compressPdfBtn.addEventListener('click', async () => {
        if (!currentPdfFile) return;

        loadingOverlay.classList.remove('hidden');
        document.getElementById('loading-text').textContent = "Compressing PDF...";

        setTimeout(async () => {
            try {
                // 1. Read PDF file as ArrayBuffer
                const arrayBuffer = await currentPdfFile.arrayBuffer();
                
                // 2. Load PDF with PDF.js
                const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
                const numPages = pdf.numPages;

                // 3. Initialize jsPDF (A4 Portrait default, but we'll adapt per page if needed)
                const { jsPDF } = window.jspdf;
                let doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
                
                const targetSizeMB = pdfTargetSizeSelect.value;
                let filename = pdfFilenameInput.value.trim();
                if (!filename.toLowerCase().endsWith('.pdf')) filename += '.pdf';
                if (filename === '.pdf') filename = 'Compressed_' + currentPdfFile.name;

                // Create a temporary array of simulated image files to trick compressImage into allocating budget correctly
                // We fake `imageFiles.length` so `compressImage` accurately portions the Target Size per page.
                const tempImageFilesStore = imageFiles;
                imageFiles = { length: numPages }; 

                for (let pageNum = 1; pageNum <= numPages; pageNum++) {
                    const page = await pdf.getPage(pageNum);
                    const viewport = page.getViewport({ scale: 2.0 }); // High scale for initial render quality

                    // 4. Render PDF page to canvas
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    canvas.width = viewport.width;
                    canvas.height = viewport.height;

                    await page.render({ canvasContext: ctx, viewport: viewport }).promise;

                    // 5. Convert rendered canvas to an Image object for our compressor function
                    const tempImg = new Image();
                    tempImg.src = canvas.toDataURL('image/jpeg', 1.0);
                    await new Promise(resolve => tempImg.onload = resolve);

                    // 6. Pass through strict compression
                    const compressedDataUrl = await compressImage(tempImg, targetSizeMB, 'JPEG');
                    
                    // 7. Add to jsPDF
                    if (pageNum > 1) {
                        doc.addPage('a4', 'p');
                    }
                    
                    // Fit strictly to A4 (210x297mm)
                    const a4Width = 210;
                    const a4Height = 297;
                    const imgRatio = tempImg.naturalWidth / tempImg.naturalHeight;
                    const a4Ratio = a4Width / a4Height;
                    
                    let drawWidth = a4Width;
                    let drawHeight = a4Height;
                    if (imgRatio > a4Ratio) drawHeight = a4Width / imgRatio;
                    else drawWidth = a4Height * imgRatio;
                    
                    const x = (a4Width - drawWidth) / 2;
                    const y = (a4Height - drawHeight) / 2;

                    doc.addImage(compressedDataUrl, 'JPEG', x, y, drawWidth, drawHeight);
                }

                // Restore image files
                imageFiles = tempImageFilesStore;
                doc.save(filename);

            } catch (error) {
                console.error("PDF Compression Error:", error);
                alert("An error occurred during PDF compression.");
            } finally {
                loadingOverlay.classList.add('hidden');
                document.getElementById('loading-text').textContent = "Generating your PDF...";
            }
        }, 100);
    });
});
