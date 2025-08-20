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
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin:0; padding:20px; background: var(--vscode-editor-background); color: var(--vscode-editor-foreground); }
  #image-container { text-align:center; margin-bottom:20px; }
  #image-container img { max-width:100%; max-height:80vh; width:auto; height:auto; border:1px solid var(--vscode-editorWidget-border); border-radius:4px; }
  #metadata { max-width:600px; margin:0 auto; }
  #metadata h3 { margin-top:0; font-size:1.2em; }
  #metadata ul { list-style:none; padding:0; }
  #metadata li { margin-bottom:8px; padding:8px; background: var(--vscode-editorHoverWidget-background); border:1px solid var(--vscode-editorHoverWidget-border); border-radius:4px; }
  #error { color: var(--vscode-errorForeground); text-align:center; font-weight:bold; }
  #loading { text-align:center; font-style:italic; }
</style>
</head>
<body>
  <div id="loading">Loading HEIC image...</div>
  <div id="image-container" style="display:none;"></div>
  <div id="metadata" style="display:none;"></div>
  <div id="error" style="display:none;"></div>

  <script>
    (function () {
      const loading = document.getElementById('loading');
      const imageContainer = document.getElementById('image-container');
      const metadataDiv = document.getElementById('metadata');
      const errorDiv = document.getElementById('error');

      window.addEventListener('message', (event) => {
        const message = event.data;
        loading.style.display = 'none';

        if (message.type === 'update') {
          const img = new Image();
          img.src = message.image;
          img.onload = () => {
            imageContainer.innerHTML = '';
            imageContainer.appendChild(img);
            imageContainer.style.display = 'block';

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
