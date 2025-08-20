import * as vscode from "vscode";
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
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>HEIC Preview</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
        }
        #image-container {
            text-align: center;
            margin-bottom: 20px;
        }
        #image-container img {
            max-width: 100%;
            max-height: 80vh;
            width: auto;
            height: auto;
            border: 1px solid var(--vscode-editorWidget-border);
            border-radius: 4px;
        }
        #metadata {
            max-width: 600px;
            margin: 0 auto;
        }
        #metadata h3 {
            margin-top: 0;
            font-size: 1.2em;
        }
        #metadata ul {
            list-style-type: none;
            padding: 0;
        }
        #metadata li {
            margin-bottom: 8px;
            padding: 8px;
            background-color: var(--vscode-editorHoverWidget-background);
            border: 1px solid var(--vscode-editorHoverWidget-border);
            border-radius: 4px;
        }
        #error {
            color: var(--vscode-errorForeground);
            text-align: center;
            font-weight: bold;
        }
        #loading {
            text-align: center;
            font-style: italic;
        }
    </style>
</head>
<body>
    <div id="loading">Loading HEIC image...</div>
    <div id="image-container" style="display: none;"></div>
    <div id="metadata" style="display: none;"></div>
    <div id="error" style="display: none;"></div>

    <script>
        (function() {
            const vscode = acquireVsCodeApi();
            window.addEventListener('message', event => {
                const message = event.data;
                const loading = document.getElementById('loading');
                const imageContainer = document.getElementById('image-container');
                const metadataDiv = document.getElementById('metadata');
                const errorDiv = document.getElementById('error');

                loading.style.display = 'none';

                if (message.type === 'update') {
                    imageContainer.innerHTML = \`<img src="\${message.image}" alt="HEIC Image Preview">\`;
                    imageContainer.style.display = 'block';

                    let metaHtml = '<h3>Image Metadata</h3><ul>';
                    for (let key in message.metadata) {
                        let value = message.metadata[key];
                        if (key === 'size') {
                            value = \`\${(value / 1024).toFixed(2)} KB\`;
                        }
                        metaHtml += \`<li><strong>\${key.charAt(0).toUpperCase() + key.slice(1)}:</strong> \${value}</li>\`;
                    }
                    metaHtml += '</ul>';
                    metadataDiv.innerHTML = metaHtml;
                    metadataDiv.style.display = 'block';
                } else if (message.type === 'error') {
                    errorDiv.innerHTML = \`<p>\${message.message}</p>\`;
                    errorDiv.style.display = 'block';
                }
            });
        })();
    </script>
</body>
</html>
    `;
  }
}
