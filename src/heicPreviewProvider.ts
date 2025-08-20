import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

const heicConvert = require("heic-convert");
const sharp = require("sharp");

export class HeicPreviewProvider
  implements vscode.CustomReadonlyEditorProvider
{
  constructor(private readonly context: vscode.ExtensionContext) {}

  async openCustomDocument(
    uri: vscode.Uri,
    openContext: vscode.CustomDocumentOpenContext,
    token: vscode.CancellationToken
  ): Promise<vscode.CustomDocument> {
    return { uri, dispose: () => {} };
  }

  async resolveCustomEditor(
    document: vscode.CustomDocument,
    webviewPanel: vscode.WebviewPanel,
    token: vscode.CancellationToken
  ): Promise<void> {
    webviewPanel.webview.options = {
      enableScripts: true,
    };

    webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

    // Convert HEIC to viewable format
    try {
      const imageData = await this.convertHeicImage(document.uri);

      webviewPanel.webview.postMessage({
        type: "update",
        image: imageData.base64,
        metadata: imageData.metadata,
      });
    } catch (error) {
      webviewPanel.webview.postMessage({
        type: "error",
        message: `Failed to load HEIC image: ${error}`,
      });
    }
  }

  private async convertHeicImage(
    uri: vscode.Uri
  ): Promise<{ base64: string; metadata: any }> {
    const inputBuffer = await fs.promises.readFile(uri.fsPath);

    // Convert HEIC to JPEG
    const outputBuffer = await heicConvert({
      buffer: inputBuffer,
      format: "JPEG",
      quality: 0.9,
    });

    // Get image metadata using sharp
    const metadata = await sharp(outputBuffer).metadata();

    // Convert to base64 for display in webview
    const base64 = outputBuffer.toString("base64");

    return {
      base64: `data:image/jpeg;base64,${base64}`,
      metadata: {
        width: metadata.width,
        height: metadata.height,
        format: "JPEG (converted from HEIC)",
        size: inputBuffer.length,
        channels: metadata.channels,
        density: metadata.density,
      },
    };
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>HEIC Image Preview</title>
            <style>
                body {
                    margin: 0;
                    padding: 20px;
                    background: var(--vscode-editor-background);
                    color: var(--vscode-editor-foreground);
                    font-family: var(--vscode-font-family);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }
                
                #container {
                    max-width: 100%;
                    text-align: center;
                }
                
                #image {
                    max-width: 100%;
                    height: auto;
                    border: 1px solid var(--vscode-panel-border);
                    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                }
                
                #metadata {
                    margin-top: 20px;
                    padding: 10px;
                    background: var(--vscode-editor-inactiveSelectionBackground);
                    border-radius: 4px;
                    text-align: left;
                    display: inline-block;
                }
                
                #metadata h3 {
                    margin-top: 0;
                    color: var(--vscode-editor-foreground);
                }
                
                #metadata p {
                    margin: 5px 0;
                    color: var(--vscode-descriptionForeground);
                }
                
                #loading {
                    padding: 20px;
                    font-size: 16px;
                }
                
                #error {
                    color: var(--vscode-errorForeground);
                    padding: 20px;
                    background: var(--vscode-inputValidation-errorBackground);
                    border: 1px solid var(--vscode-inputValidation-errorBorder);
                    border-radius: 4px;
                }
                
                .zoom-controls {
                    margin: 20px 0;
                }
                
                button {
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 6px 14px;
                    margin: 0 5px;
                    cursor: pointer;
                    border-radius: 2px;
                }
                
                button:hover {
                    background: var(--vscode-button-hoverBackground);
                }
            </style>
        </head>
        <body>
            <div id="container">
                <div id="loading">Loading HEIC image...</div>
                <div id="error" style="display: none;"></div>
                <div id="preview" style="display: none;">
                    <div class="zoom-controls">
                        <button onclick="zoomIn()">Zoom In</button>
                        <button onclick="zoomOut()">Zoom Out</button>
                        <button onclick="resetZoom()">Reset</button>
                        <button onclick="fitToWindow()">Fit to Window</button>
                    </div>
                    <img id="image" />
                    <div id="metadata"></div>
                </div>
            </div>
            
            <script>
                const vscode = acquireVsCodeApi();
                let currentZoom = 1;
                
                window.addEventListener('message', event => {
                    const message = event.data;
                    
                    switch (message.type) {
                        case 'update':
                            displayImage(message.image, message.metadata);
                            break;
                        case 'error':
                            showError(message.message);
                            break;
                    }
                });
                
                function displayImage(imageSrc, metadata) {
                    document.getElementById('loading').style.display = 'none';
                    document.getElementById('error').style.display = 'none';
                    document.getElementById('preview').style.display = 'block';
                    
                    const img = document.getElementById('image');
                    img.src = imageSrc;
                    
                    if (metadata) {
                        const metadataHtml = \`
                            <h3>Image Information</h3>
                            <p><strong>Dimensions:</strong> \${metadata.width} × \${metadata.height} pixels</p>
                            <p><strong>Format:</strong> \${metadata.format}</p>
                            <p><strong>File Size:</strong> \${formatBytes(metadata.size)}</p>
                            <p><strong>Channels:</strong> \${metadata.channels}</p>
                            \${metadata.density ? \`<p><strong>Density:</strong> \${metadata.density} DPI</p>\` : ''}
                        \`;
                        document.getElementById('metadata').innerHTML = metadataHtml;
                    }
                }
                
                function showError(message) {
                    document.getElementById('loading').style.display = 'none';
                    document.getElementById('preview').style.display = 'none';
                    document.getElementById('error').style.display = 'block';
                    document.getElementById('error').textContent = message;
                }
                
                function formatBytes(bytes) {
                    if (bytes === 0) return '0 Bytes';
                    const k = 1024;
                    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
                    const i = Math.floor(Math.log(bytes) / Math.log(k));
                    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
                }
                
                function zoomIn() {
                    currentZoom *= 1.2;
                    applyZoom();
                }
                
                function zoomOut() {
                    currentZoom *= 0.8;
                    applyZoom();
                }
                
                function resetZoom() {
                    currentZoom = 1;
                    applyZoom();
                }
                
                function fitToWindow() {
                    const img = document.getElementById('image');
                    img.style.transform = '';
                    img.style.maxWidth = '100%';
                    currentZoom = 1;
                }
                
                function applyZoom() {
                    const img = document.getElementById('image');
                    img.style.transform = \`scale(\${currentZoom})\`;
                    img.style.maxWidth = 'none';
                }
            </script>
        </body>
        </html>`;
  }
}
