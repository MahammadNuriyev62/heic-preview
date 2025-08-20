import * as vscode from "vscode";
import { HeicPreviewProvider } from "./heicPreviewProvider";

export function activate(context: vscode.ExtensionContext) {
  console.log("HEIC Preview extension is now active!");

  // Register the custom editor provider
  const provider = new HeicPreviewProvider(context);

  const providerRegistration = vscode.window.registerCustomEditorProvider(
    "heicPreview.heicViewer",
    provider,
    {
      webviewOptions: {
        retainContextWhenHidden: true,
      },
    }
  );

  // Register command to open preview
  const openPreviewCommand = vscode.commands.registerCommand(
    "heicPreview.openPreview",
    async () => {
      const fileUri = await vscode.window.showOpenDialog({
        canSelectMany: false,
        openLabel: "Open HEIC Image",
        filters: {
          "HEIC Images": ["heic", "heif", "HEIC", "HEIF"],
        },
      });

      if (fileUri && fileUri[0]) {
        await vscode.commands.executeCommand(
          "vscode.openWith",
          fileUri[0],
          "heicPreview.heicViewer"
        );
      }
    }
  );

  context.subscriptions.push(providerRegistration, openPreviewCommand);
}

export function deactivate() {}
