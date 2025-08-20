import * as vscode from "vscode";
import * as fs from "fs";

export class HeicPreviewProvider
  implements vscode.CustomReadonlyEditorProvider
{
  constructor(private readonly context: vscode.ExtensionContext) {}

  async openCustomDocument(
    uri: vscode.Uri,
    _openContext: vscode.CustomDocumentOpenContext,
    _token: vscode.CancellationToken
  ): Promise<vscode.CustomDocument> {
    return { uri, dispose: () => {} };
  }

  async resolveCustomEditor(
    document: vscode.CustomDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    webviewPanel.webview.options = { enableScripts: true };
    webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

    try {
      const result = await this.convertHeicImage(document.uri); // returns { base64, size }
      webviewPanel.webview.postMessage({
        type: "update",
        image: result.base64,
        metadata: {
          // we only know size here; width/height will be filled in by webview script
          format: "JPEG (converted from HEIC)",
          size: result.size,
        },
      });
    } catch (error: any) {
      webviewPanel.webview.postMessage({
        type: "error",
        message: `Failed to load HEIC image: ${error?.stack || error}`,
      });
    }
  }

  private async convertHeicImage(
    uri: vscode.Uri
  ): Promise<{ base64: string; size: number }> {
    const inputBuffer = await fs.promises.readFile(uri.fsPath);

    // Robust load that works whether the module is CJS or ESM-wrapped
    const mod = require("heic-convert");
    const convert =
      (typeof mod === "function" && mod) ||
      (mod && typeof mod.default === "function" && mod.default) ||
      (mod && typeof mod.convert === "function" && mod.convert);

    if (typeof convert !== "function") {
      throw new Error(
        `heic-convert export is not callable (got: ${Object.prototype.toString.call(
          mod
        )})`
      );
    }

    const outputBuffer: Buffer = await convert({
      buffer: inputBuffer,
      format: "JPEG",
      quality: 0.9,
    });

    return {
      base64: `data:image/jpeg;base64,${outputBuffer.toString("base64")}`,
      size: inputBuffer.length,
    };
  }

  private getHtmlForWebview(_webview: vscode.Webview): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>HEIC Preview</title>
<style>
  body { 
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; 
    margin: 0; 
    padding: 0; 
    background: var(--vscode-editor-background); 
    color: var(--vscode-editor-foreground); 
    overflow: hidden;
    height: 100vh;
  }
  
  #toolbar {
    position: fixed;
    top: 10px;
    left: 10px;
    background: var(--vscode-editorWidget-background);
    border: 1px solid var(--vscode-editorWidget-border);
    border-radius: 4px;
    display: flex;
    align-items: center;
    padding: 4px;
    gap: 2px;
    z-index: 1000;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    backdrop-filter: blur(4px);
  }
  
  #toolbar button {
    padding: 4px 6px;
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: 1px solid var(--vscode-button-border);
    border-radius: 2px;
    cursor: pointer;
    font-size: 11px;
    min-width: 24px;
    height: 24px;
  }
  
  #toolbar button:hover {
    background: var(--vscode-button-hoverBackground);
  }
  
  #zoom-info {
    margin-left: 4px;
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    min-width: 35px;
    padding: 0 4px;
  }

  #image-viewer {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    overflow: hidden;
    cursor: grab;
    background: var(--vscode-editor-background);
  }
  
  #image-viewer.dragging {
    cursor: grabbing;
  }
  
  #image-container {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }
  
  #image-container img {
    max-width: none;
    max-height: none;
    border: 1px solid var(--vscode-editorWidget-border);
    border-radius: 4px;
    transition: transform 0.1s ease-out;
    user-select: none;
    -webkit-user-drag: none;
  }
  
  #metadata {
    position: fixed;
    bottom: 10px;
    right: 10px;
    max-width: 280px;
    background: var(--vscode-editorWidget-background);
    border: 1px solid var(--vscode-editorWidget-border);
    border-radius: 4px;
    padding: 8px;
    z-index: 1000;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    backdrop-filter: blur(4px);
    font-size: 11px;
    opacity: 0.95;
  }
  
  #metadata h3 { 
    margin: 0 0 6px 0; 
    font-size: 12px; 
  }
  
  #metadata ul { 
    list-style: none; 
    padding: 0; 
    margin: 0;
  }
  
  #metadata li { 
    margin-bottom: 2px; 
    padding: 3px 4px; 
    background: var(--vscode-editorHoverWidget-background); 
    border: 1px solid var(--vscode-editorHoverWidget-border); 
    border-radius: 2px; 
    font-size: 10px;
  }
  
  #metadata .controls {
    margin: 6px 0 0 0; 
    font-size: 9px; 
    color: var(--vscode-descriptionForeground);
    line-height: 1.2;
  }
  
  #error { 
    color: var(--vscode-errorForeground); 
    text-align: center; 
    font-weight: bold; 
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }
  
  #loading { 
    text-align: center; 
    font-style: italic; 
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }
</style>
</head>
<body>
  <div id="toolbar" style="display:none;">
    <button id="rotate-left">↺</button>
    <button id="rotate-right">↻</button>
    <button id="zoom-in">+</button>
    <button id="zoom-out">-</button>
    <button id="zoom-fit">Fit</button>
    <button id="zoom-100">1:1</button>
    <span id="zoom-info">100%</span>
  </div>
  
  <div id="loading">Loading HEIC image...</div>
  
  <div id="image-viewer" style="display:none;">
    <div id="image-container"></div>
  </div>
  
  <div id="metadata" style="display:none;"></div>
  <div id="error" style="display:none;"></div>

  <script>
    (function () {
      const loading = document.getElementById('loading');
      const toolbar = document.getElementById('toolbar');
      const imageViewer = document.getElementById('image-viewer');
      const imageContainer = document.getElementById('image-container');
      const metadataDiv = document.getElementById('metadata');
      const errorDiv = document.getElementById('error');
      const zoomInfo = document.getElementById('zoom-info');

      // Transform state
      let rotation = 0; // degrees
      let scale = 1;
      let translateX = 0;
      let translateY = 0;
      
      // Image and viewport dimensions
      let imageWidth = 0;
      let imageHeight = 0;
      let viewportWidth = 0;
      let viewportHeight = 0;
      
      // Interaction state
      let isDragging = false;
      let lastMouseX = 0;
      let lastMouseY = 0;
      let lastTouchDistance = 0;
      let lastTouchCenterX = 0;
      let lastTouchCenterY = 0;

      let currentImage = null;

      function updateTransform() {
        if (!currentImage) return;
        
        const transform = \`translate(\${translateX}px, \${translateY}px) scale(\${scale}) rotate(\${rotation}deg)\`;
        currentImage.style.transform = transform;
        zoomInfo.textContent = \`\${Math.round(scale * 100)}%\`;
      }

      function fitToScreen() {
        if (!currentImage) return;
        
        updateViewportSize();
        
        // Calculate the scale needed to fit the image
        const rotatedWidth = rotation % 180 === 0 ? imageWidth : imageHeight;
        const rotatedHeight = rotation % 180 === 0 ? imageHeight : imageWidth;
        
        const scaleX = viewportWidth / rotatedWidth;
        const scaleY = viewportHeight / rotatedHeight;
        scale = Math.min(scaleX, scaleY, 1); // Don't scale up beyond 100%
        
        // Center the image
        translateX = 0;
        translateY = 0;
        
        updateTransform();
      }

      function zoomToActualSize() {
        scale = 1;
        translateX = 0;
        translateY = 0;
        updateTransform();
      }

      function updateViewportSize() {
        const rect = imageViewer.getBoundingClientRect();
        viewportWidth = rect.width;
        viewportHeight = rect.height;
      }

      function constrainPan() {
        if (!currentImage) return;
        
        updateViewportSize();
        
        const rotatedWidth = rotation % 180 === 0 ? imageWidth : imageHeight;
        const rotatedHeight = rotation % 180 === 0 ? imageHeight : imageWidth;
        
        const scaledWidth = rotatedWidth * scale;
        const scaledHeight = rotatedHeight * scale;
        
        // Calculate max translation to keep image visible
        const maxTranslateX = Math.max(0, (scaledWidth - viewportWidth) / 2);
        const maxTranslateY = Math.max(0, (scaledHeight - viewportHeight) / 2);
        
        translateX = Math.max(-maxTranslateX, Math.min(maxTranslateX, translateX));
        translateY = Math.max(-maxTranslateY, Math.min(maxTranslateY, translateY));
      }

      // Event handlers
      document.getElementById('rotate-left').addEventListener('click', () => {
        rotation -= 90;
        updateTransform();
      });

      document.getElementById('rotate-right').addEventListener('click', () => {
        rotation += 90;
        updateTransform();
      });

      document.getElementById('zoom-in').addEventListener('click', () => {
        scale *= 1.25;
        constrainPan();
        updateTransform();
      });

      document.getElementById('zoom-out').addEventListener('click', () => {
        scale /= 1.25;
        constrainPan();
        updateTransform();
      });

      document.getElementById('zoom-fit').addEventListener('click', fitToScreen);
      document.getElementById('zoom-100').addEventListener('click', zoomToActualSize);

      // Mouse wheel zoom
      imageViewer.addEventListener('wheel', (e) => {
        e.preventDefault();
        
        const rect = imageViewer.getBoundingClientRect();
        const mouseX = e.clientX - rect.left - viewportWidth / 2;
        const mouseY = e.clientY - rect.top - viewportHeight / 2;
        
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = scale * zoomFactor;
        
        // Adjust translation to zoom towards mouse position
        translateX = mouseX - (mouseX - translateX) * (newScale / scale);
        translateY = mouseY - (mouseY - translateY) * (newScale / scale);
        
        scale = newScale;
        constrainPan();
        updateTransform();
      });

      // Mouse drag
      imageViewer.addEventListener('mousedown', (e) => {
        if (e.button === 0) { // Left mouse button
          isDragging = true;
          lastMouseX = e.clientX;
          lastMouseY = e.clientY;
          imageViewer.classList.add('dragging');
          e.preventDefault();
        }
      });

      document.addEventListener('mousemove', (e) => {
        if (isDragging) {
          const deltaX = e.clientX - lastMouseX;
          const deltaY = e.clientY - lastMouseY;
          
          translateX += deltaX;
          translateY += deltaY;
          
          constrainPan();
          updateTransform();
          
          lastMouseX = e.clientX;
          lastMouseY = e.clientY;
        }
      });

      document.addEventListener('mouseup', () => {
        isDragging = false;
        imageViewer.classList.remove('dragging');
      });

      // Touch events for mobile
      imageViewer.addEventListener('touchstart', (e) => {
        e.preventDefault();
        
        if (e.touches.length === 1) {
          // Single touch - start dragging
          isDragging = true;
          lastMouseX = e.touches[0].clientX;
          lastMouseY = e.touches[0].clientY;
        } else if (e.touches.length === 2) {
          // Two touches - start pinch zoom
          isDragging = false;
          const touch1 = e.touches[0];
          const touch2 = e.touches[1];
          
          lastTouchDistance = Math.sqrt(
            Math.pow(touch2.clientX - touch1.clientX, 2) +
            Math.pow(touch2.clientY - touch1.clientY, 2)
          );
          
          lastTouchCenterX = (touch1.clientX + touch2.clientX) / 2;
          lastTouchCenterY = (touch1.clientY + touch2.clientY) / 2;
        }
      });

      imageViewer.addEventListener('touchmove', (e) => {
        e.preventDefault();
        
        if (e.touches.length === 1 && isDragging) {
          // Single touch drag
          const deltaX = e.touches[0].clientX - lastMouseX;
          const deltaY = e.touches[0].clientY - lastMouseY;
          
          translateX += deltaX;
          translateY += deltaY;
          
          constrainPan();
          updateTransform();
          
          lastMouseX = e.touches[0].clientX;
          lastMouseY = e.touches[0].clientY;
        } else if (e.touches.length === 2) {
          // Pinch zoom
          const touch1 = e.touches[0];
          const touch2 = e.touches[1];
          
          const currentDistance = Math.sqrt(
            Math.pow(touch2.clientX - touch1.clientX, 2) +
            Math.pow(touch2.clientY - touch1.clientY, 2)
          );
          
          const currentCenterX = (touch1.clientX + touch2.clientX) / 2;
          const currentCenterY = (touch1.clientY + touch2.clientY) / 2;
          
          if (lastTouchDistance > 0) {
            const zoomFactor = currentDistance / lastTouchDistance;
            const rect = imageViewer.getBoundingClientRect();
            const centerX = currentCenterX - rect.left - viewportWidth / 2;
            const centerY = currentCenterY - rect.top - viewportHeight / 2;
            
            const newScale = scale * zoomFactor;
            
            // Adjust translation to zoom towards touch center
            translateX = centerX - (centerX - translateX) * (newScale / scale);
            translateY = centerY - (centerY - translateY) * (newScale / scale);
            
            scale = newScale;
            constrainPan();
            updateTransform();
          }
          
          lastTouchDistance = currentDistance;
          lastTouchCenterX = currentCenterX;
          lastTouchCenterY = currentCenterY;
        }
      });

      imageViewer.addEventListener('touchend', (e) => {
        if (e.touches.length === 0) {
          isDragging = false;
          lastTouchDistance = 0;
        } else if (e.touches.length === 1) {
          // Switch back to single touch mode
          isDragging = true;
          lastMouseX = e.touches[0].clientX;
          lastMouseY = e.touches[0].clientY;
          lastTouchDistance = 0;
        }
      });

      // Keyboard shortcuts
      document.addEventListener('keydown', (e) => {
        if (e.target.tagName.toLowerCase() === 'input') return;
        
        switch(e.key) {
          case 'r':
          case 'R':
            rotation += 90;
            updateTransform();
            e.preventDefault();
            break;
          case '+':
          case '=':
            scale *= 1.25;
            constrainPan();
            updateTransform();
            e.preventDefault();
            break;
          case '-':
            scale /= 1.25;
            constrainPan();
            updateTransform();
            e.preventDefault();
            break;
          case '0':
            fitToScreen();
            e.preventDefault();
            break;
          case '1':
            zoomToActualSize();
            e.preventDefault();
            break;
        }
      });

      // Window resize handler
      window.addEventListener('resize', () => {
        updateViewportSize();
        constrainPan();
        updateTransform();
      });

      // Message handler
      window.addEventListener('message', (event) => {
        const message = event.data;
        loading.style.display = 'none';

        if (message.type === 'update') {
          const img = new Image();
          img.src = message.image;
          img.onload = () => {
            currentImage = img;
            imageWidth = img.naturalWidth;
            imageHeight = img.naturalHeight;
            
            imageContainer.innerHTML = '';
            imageContainer.appendChild(img);
            
            // Reset transform state
            rotation = 0;
            scale = 1;
            translateX = 0;
            translateY = 0;
            
            // Show UI elements
            toolbar.style.display = 'flex';
            imageViewer.style.display = 'block';
            
            // Fit to screen initially
            setTimeout(() => {
              fitToScreen();
            }, 10);

            const sizeKB = (message.metadata.size / 1024).toFixed(2) + ' KB';
            const meta = {
              width: img.naturalWidth,
              height: img.naturalHeight,
              format: message.metadata.format,
              size: sizeKB
            };

            let metaHtml = '<h3>Image Metadata</h3><ul>';
            for (const [k, v] of Object.entries(meta)) {
              const key = k.charAt(0).toUpperCase() + k.slice(1);
              metaHtml += '<li><strong>' + key + ':</strong> ' + v + '</li>';
            }
            metaHtml += '</ul>';
            metaHtml += '<div class="controls"><strong>Controls:</strong> Wheel/pinch zoom, drag pan, R rotate, +/- zoom, 0 fit, 1 actual</div>';
            
            metadataDiv.innerHTML = metaHtml;
            metadataDiv.style.display = 'block';
          };
          img.onerror = () => {
            errorDiv.textContent = 'Failed to render converted image';
            errorDiv.style.display = 'block';
          };
        } else if (message.type === 'error') {
          errorDiv.innerHTML = '<p>' + message.message + '</p>';
          errorDiv.style.display = 'block';
        }
      });
    })();
  </script>
</body>
</html>`;
  }
}
