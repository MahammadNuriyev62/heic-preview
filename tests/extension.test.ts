import * as vscode from "vscode";
import { activate, deactivate } from "../src/extension";

describe("Extension activation", () => {
  let context: any;

  beforeEach(() => {
    jest.clearAllMocks();
    context = { subscriptions: [] };
  });

  it("registers the custom editor provider with correct viewType", () => {
    activate(context);
    expect(vscode.window.registerCustomEditorProvider).toHaveBeenCalledWith(
      "heicPreview.heicViewer",
      expect.any(Object),
      expect.objectContaining({
        webviewOptions: { retainContextWhenHidden: true },
      })
    );
  });

  it("registers the openPreview command", () => {
    activate(context);
    expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
      "heicPreview.openPreview",
      expect.any(Function)
    );
  });

  it("pushes both disposables to context.subscriptions", () => {
    activate(context);
    expect(context.subscriptions).toHaveLength(2);
  });

  it("deactivate does not throw", () => {
    expect(() => deactivate()).not.toThrow();
  });

  describe("openPreview command handler", () => {
    it("opens file dialog with HEIC filters", async () => {
      (vscode.window.showOpenDialog as jest.Mock).mockResolvedValue(null);
      activate(context);

      // Extract the registered handler
      const handler = (vscode.commands.registerCommand as jest.Mock).mock
        .calls[0][1];
      await handler();

      expect(vscode.window.showOpenDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          canSelectMany: false,
          filters: { "HEIC Images": ["heic", "heif", "HEIC", "HEIF"] },
        })
      );
    });

    it("opens file with custom editor when user selects a file", async () => {
      const fakeUri = { fsPath: "/test.heic" };
      (vscode.window.showOpenDialog as jest.Mock).mockResolvedValue([fakeUri]);
      activate(context);

      const handler = (vscode.commands.registerCommand as jest.Mock).mock
        .calls[0][1];
      await handler();

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        "vscode.openWith",
        fakeUri,
        "heicPreview.heicViewer"
      );
    });

    it("does nothing when user cancels file dialog", async () => {
      (vscode.window.showOpenDialog as jest.Mock).mockResolvedValue(null);
      activate(context);

      const handler = (vscode.commands.registerCommand as jest.Mock).mock
        .calls[0][1];
      await handler();

      expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
    });
  });
});
