jest.mock("heic-convert", () =>
  jest.fn().mockResolvedValue(Buffer.from("fake-jpeg-data"))
);

jest.mock("fs", () => ({
  promises: {
    readFile: jest.fn().mockResolvedValue(Buffer.from("fake-heic-data")),
  },
}));

import { HeicPreviewProvider } from "../src/heicPreviewProvider";
import * as fs from "fs";

describe("HeicPreviewProvider", () => {
  let provider: HeicPreviewProvider;

  beforeEach(() => {
    provider = new HeicPreviewProvider({ subscriptions: [] } as any);
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // openCustomDocument
  // ---------------------------------------------------------------------------

  describe("openCustomDocument", () => {
    it("returns a document with the given URI", async () => {
      const uri = { fsPath: "/photo.heic", scheme: "file" };
      const doc = await provider.openCustomDocument(
        uri as any,
        {} as any,
        {} as any
      );
      expect(doc.uri).toBe(uri);
    });

    it("returns a document with a no-op dispose", async () => {
      const doc = await provider.openCustomDocument(
        { fsPath: "/x.heic" } as any,
        {} as any,
        {} as any
      );
      expect(typeof doc.dispose).toBe("function");
      expect(() => doc.dispose()).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // convertHeicImage (private — tested via type cast)
  // ---------------------------------------------------------------------------

  describe("convertHeicImage", () => {
    const callConvert = (fsPath = "/test.heic") =>
      (provider as any).convertHeicImage({ fsPath });

    it("reads the file at the URI's fsPath", async () => {
      await callConvert("/photos/sunset.heic");
      expect(fs.promises.readFile).toHaveBeenCalledWith("/photos/sunset.heic");
    });

    it("returns a data:image/jpeg base64 string", async () => {
      const result = await callConvert();
      expect(result.base64).toMatch(/^data:image\/jpeg;base64,/);
    });

    it("base64 payload decodes to the converted buffer", async () => {
      const result = await callConvert();
      const b64 = result.base64.replace("data:image/jpeg;base64,", "");
      expect(Buffer.from(b64, "base64").toString()).toBe("fake-jpeg-data");
    });

    it("returns the original file size (not converted size)", async () => {
      (fs.promises.readFile as jest.Mock).mockResolvedValueOnce(
        Buffer.alloc(54321)
      );
      const result = await callConvert();
      expect(result.size).toBe(54321);
    });

    it("passes correct options to heic-convert", async () => {
      const heicConvert = require("heic-convert");
      await callConvert();
      expect(heicConvert).toHaveBeenCalledWith({
        buffer: expect.any(Buffer),
        format: "JPEG",
        quality: 0.9,
      });
    });

    it("throws when file cannot be read", async () => {
      (fs.promises.readFile as jest.Mock).mockRejectedValueOnce(
        new Error("ENOENT: no such file")
      );
      await expect(callConvert("/missing.heic")).rejects.toThrow("ENOENT");
    });

    it("throws when conversion fails", async () => {
      const heicConvert = require("heic-convert");
      heicConvert.mockRejectedValueOnce(new Error("Corrupt HEIC data"));
      await expect(callConvert()).rejects.toThrow("Corrupt HEIC data");
    });

    it("handles heic-convert that exports { default: fn }", async () => {
      const mockFn = jest.fn().mockResolvedValue(Buffer.from("jpeg-bytes"));
      const heicConvert = require("heic-convert");
      // Simulate: require returns an object, not a function
      heicConvert.mockImplementation(undefined as any); // clear function mock
      // We need to re-mock the module to test the fallback path
      // Since the provider does require() at call time, we can swap the mock
      jest.resetModules();
      jest.doMock("heic-convert", () => ({ default: mockFn }));
      jest.doMock("fs", () => ({
        promises: {
          readFile: jest.fn().mockResolvedValue(Buffer.from("heic")),
        },
      }));

      const {
        HeicPreviewProvider: FreshProvider,
      } = require("../src/heicPreviewProvider");
      const p = new FreshProvider({ subscriptions: [] });
      const result = await (p as any).convertHeicImage({ fsPath: "/x.heic" });
      expect(mockFn).toHaveBeenCalled();
      expect(result.base64).toMatch(/^data:image\/jpeg;base64,/);
    });

    it("handles heic-convert that exports { convert: fn }", async () => {
      const mockFn = jest.fn().mockResolvedValue(Buffer.from("jpeg-bytes"));
      jest.resetModules();
      jest.doMock("heic-convert", () => ({ convert: mockFn }));
      jest.doMock("fs", () => ({
        promises: {
          readFile: jest.fn().mockResolvedValue(Buffer.from("heic")),
        },
      }));

      const {
        HeicPreviewProvider: FreshProvider,
      } = require("../src/heicPreviewProvider");
      const p = new FreshProvider({ subscriptions: [] });
      const result = await (p as any).convertHeicImage({ fsPath: "/x.heic" });
      expect(mockFn).toHaveBeenCalled();
      expect(result.base64).toMatch(/^data:image\/jpeg;base64,/);
    });

    it("throws descriptive error for non-callable export", async () => {
      jest.resetModules();
      jest.doMock("heic-convert", () => ({ version: "2.0" }));
      jest.doMock("fs", () => ({
        promises: {
          readFile: jest.fn().mockResolvedValue(Buffer.from("heic")),
        },
      }));

      const {
        HeicPreviewProvider: FreshProvider,
      } = require("../src/heicPreviewProvider");
      const p = new FreshProvider({ subscriptions: [] });
      await expect(
        (p as any).convertHeicImage({ fsPath: "/x.heic" })
      ).rejects.toThrow("heic-convert export is not callable");
    });
  });

  // ---------------------------------------------------------------------------
  // resolveCustomEditor
  // ---------------------------------------------------------------------------

  describe("resolveCustomEditor", () => {
    let mockPanel: any;

    beforeEach(() => {
      // Re-apply the top-level mocks (may have been cleared by resetModules tests)
      jest.resetModules();
      jest.doMock("heic-convert", () =>
        jest.fn().mockResolvedValue(Buffer.from("fake-jpeg-data"))
      );
      jest.doMock("fs", () => ({
        promises: {
          readFile: jest
            .fn()
            .mockResolvedValue(Buffer.from("fake-heic-data")),
        },
      }));

      const {
        HeicPreviewProvider: FreshProvider,
      } = require("../src/heicPreviewProvider");
      provider = new FreshProvider({ subscriptions: [] });

      mockPanel = {
        webview: {
          options: {} as any,
          html: "",
          postMessage: jest.fn(),
        },
      };
    });

    it("enables scripts on the webview", async () => {
      await provider.resolveCustomEditor(
        { uri: { fsPath: "/t.heic" } } as any,
        mockPanel,
        {} as any
      );
      expect(mockPanel.webview.options.enableScripts).toBe(true);
    });

    it("sets HTML content containing required structure", async () => {
      await provider.resolveCustomEditor(
        { uri: { fsPath: "/t.heic" } } as any,
        mockPanel,
        {} as any
      );
      expect(mockPanel.webview.html).toContain("<!DOCTYPE html>");
      expect(mockPanel.webview.html).toContain("id=\"toolbar\"");
      expect(mockPanel.webview.html).toContain("id=\"image-viewer\"");
    });

    it("posts update message on successful conversion", async () => {
      await provider.resolveCustomEditor(
        { uri: { fsPath: "/photo.heic" } } as any,
        mockPanel,
        {} as any
      );
      expect(mockPanel.webview.postMessage).toHaveBeenCalledWith({
        type: "update",
        image: expect.stringMatching(/^data:image\/jpeg;base64,/),
        metadata: {
          format: "JPEG (converted from HEIC)",
          size: expect.any(Number),
        },
      });
    });

    it("posts error message when conversion fails", async () => {
      const fsMock = require("fs");
      fsMock.promises.readFile.mockRejectedValueOnce(
        new Error("Permission denied")
      );

      await provider.resolveCustomEditor(
        { uri: { fsPath: "/locked.heic" } } as any,
        mockPanel,
        {} as any
      );
      expect(mockPanel.webview.postMessage).toHaveBeenCalledWith({
        type: "error",
        message: expect.stringContaining("Failed to load HEIC image"),
      });
    });

    it("error message includes the original error details", async () => {
      const fsMock = require("fs");
      fsMock.promises.readFile.mockRejectedValueOnce(
        new Error("EACCES: permission denied")
      );

      await provider.resolveCustomEditor(
        { uri: { fsPath: "/locked.heic" } } as any,
        mockPanel,
        {} as any
      );
      const errMsg = mockPanel.webview.postMessage.mock.calls[0][0];
      expect(errMsg.message).toContain("EACCES");
    });

    it("handles non-Error thrown values (no .stack)", async () => {
      const fsMock = require("fs");
      fsMock.promises.readFile.mockRejectedValueOnce("raw string error");

      await provider.resolveCustomEditor(
        { uri: { fsPath: "/bad.heic" } } as any,
        mockPanel,
        {} as any
      );
      const errMsg = mockPanel.webview.postMessage.mock.calls[0][0];
      expect(errMsg.type).toBe("error");
      expect(errMsg.message).toContain("raw string error");
    });
  });

  // ---------------------------------------------------------------------------
  // getHtmlForWebview
  // ---------------------------------------------------------------------------

  describe("getHtmlForWebview", () => {
    const getHtml = () => (provider as any).getHtmlForWebview({});

    it("is valid HTML5", () => {
      const html = getHtml();
      expect(html).toMatch(/^<!DOCTYPE html>/);
      expect(html).toContain("<html");
      expect(html).toContain("</html>");
    });

    it("contains all required DOM element IDs", () => {
      const html = getHtml();
      const requiredIds = [
        "toolbar",
        "loading",
        "image-viewer",
        "image-container",
        "metadata",
        "error",
        "rotate-left",
        "rotate-right",
        "zoom-in",
        "zoom-out",
        "zoom-fit",
        "zoom-100",
        "zoom-info",
      ];
      for (const id of requiredIds) {
        expect(html).toContain(`id="${id}"`);
      }
    });

    it("uses VS Code CSS custom properties for theme integration", () => {
      const html = getHtml();
      expect(html).toContain("var(--vscode-editor-background)");
      expect(html).toContain("var(--vscode-editor-foreground)");
      expect(html).toContain("var(--vscode-button-background)");
      expect(html).toContain("var(--vscode-editorWidget-background)");
    });

    it("contains an inline script for interactivity", () => {
      const html = getHtml();
      expect(html).toContain("<script>");
      expect(html).toContain("addEventListener");
      expect(html).toContain("</script>");
    });

    it("hides toolbar, viewer, metadata, and error initially", () => {
      const html = getHtml();
      expect(html).toMatch(/id="toolbar"[^>]*style="display:none;"/);
      expect(html).toMatch(/id="image-viewer"[^>]*style="display:none;"/);
      expect(html).toMatch(/id="metadata"[^>]*style="display:none;"/);
      expect(html).toMatch(/id="error"[^>]*style="display:none;"/);
    });

    it("shows loading indicator by default", () => {
      const html = getHtml();
      expect(html).toContain("Loading HEIC image...");
      // loading div should NOT have display:none
      expect(html).not.toMatch(/id="loading"[^>]*style="display:none;"/);
    });
  });
});
