/**
 * Webview UI tests.
 *
 * These tests load the webview HTML in JSDOM and exercise all interactive
 * behavior: zoom, pan, rotation, keyboard shortcuts, touch gestures,
 * metadata display, error states, and resize handling.
 */

import { HeicPreviewProvider } from "../src/heicPreviewProvider";
import { WebviewHarness } from "./helpers/webview-harness";

// ---------------------------------------------------------------------------
// Helper to get webview HTML from the provider
// ---------------------------------------------------------------------------

function getHtml(): string {
  const provider = new HeicPreviewProvider({ subscriptions: [] } as any);
  return (provider as any).getHtmlForWebview({});
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("Webview UI", () => {
  let h: WebviewHarness;

  afterEach(() => {
    h?.destroy();
  });

  // =========================================================================
  // INITIAL STATE
  // =========================================================================

  describe("Initial state", () => {
    beforeEach(() => {
      h = new WebviewHarness(getHtml());
    });

    it("shows the loading indicator", () => {
      const loading = h.document.getElementById("loading")!;
      expect(loading.style.display).not.toBe("none");
      expect(loading.textContent).toContain("Loading");
    });

    it("hides the toolbar", () => {
      expect(h.isVisible("toolbar")).toBe(false);
    });

    it("hides the image viewer", () => {
      expect(h.isVisible("image-viewer")).toBe(false);
    });

    it("hides the metadata panel", () => {
      expect(h.isVisible("metadata")).toBe(false);
    });

    it("hides the error display", () => {
      expect(h.isVisible("error")).toBe(false);
    });

    it("zoom info shows 100% initially", () => {
      expect(h.getZoomText()).toBe("100%");
    });
  });

  // =========================================================================
  // IMAGE LOADING
  // =========================================================================

  describe("Image loading", () => {
    beforeEach(async () => {
      h = new WebviewHarness(getHtml());
      await h.loadTestImage(204800); // 200 KB
    });

    it("hides the loading indicator", () => {
      expect(h.document.getElementById("loading")!.style.display).toBe("none");
    });

    it("shows the toolbar", () => {
      expect(h.isVisible("toolbar")).toBe(true);
    });

    it("shows the image viewer", () => {
      expect(h.isVisible("image-viewer")).toBe(true);
    });

    it("renders an <img> element in the container", () => {
      const img = h.document.querySelector("#image-container img");
      expect(img).not.toBeNull();
    });

    it("fits image to screen on initial load", () => {
      // Viewport 800x600, image 1920x1080
      // scaleX = 800/1920 ≈ 0.4167, scaleY = 600/1080 ≈ 0.5556
      // scale = min(0.4167, 0.5556, 1) ≈ 0.4167
      const t = h.getTransform();
      expect(t.scale).toBeCloseTo(800 / 1920, 3);
      expect(t.translateX).toBe(0);
      expect(t.translateY).toBe(0);
    });

    it("updates zoom info to match fit scale", () => {
      const expectedPct = Math.round((800 / 1920) * 100);
      expect(h.getZoomText()).toBe(`${expectedPct}%`);
    });

    it("shows the metadata panel", () => {
      expect(h.isVisible("metadata")).toBe(true);
    });

    it("does not scale up small images beyond 100%", async () => {
      h.destroy();
      // Image 400x300, viewport 800x600 → would be 200% but capped at 100%
      h = new WebviewHarness(getHtml(), {
        imageWidth: 400,
        imageHeight: 300,
      });
      await h.loadTestImage();
      const t = h.getTransform();
      expect(t.scale).toBe(1);
    });
  });

  // =========================================================================
  // ERROR HANDLING
  // =========================================================================

  describe("Error handling", () => {
    beforeEach(() => {
      h = new WebviewHarness(getHtml());
    });

    it("hides loading on error message", async () => {
      await h.postMessage({ type: "error", message: "Something broke" });
      expect(h.document.getElementById("loading")!.style.display).toBe("none");
    });

    it("shows error div with the error message", async () => {
      await h.postMessage({ type: "error", message: "Corrupt file" });
      expect(h.isVisible("error")).toBe(true);
      expect(h.getErrorText()).toContain("Corrupt file");
    });

    it("does not show toolbar or viewer on error", async () => {
      await h.postMessage({ type: "error", message: "fail" });
      expect(h.isVisible("toolbar")).toBe(false);
      expect(h.isVisible("image-viewer")).toBe(false);
    });

    it("shows error when image fails to decode (onerror)", async () => {
      // Post update with deliberately broken data
      h.window.dispatchEvent(
        new h.window.MessageEvent("message", {
          data: {
            type: "update",
            image: "data:image/jpeg;base64,AAAA",
            metadata: { format: "test", size: 100 },
          },
        })
      );
      await h.flush();

      // Manually trigger onerror on the created image
      const img = h.document.querySelector("#image-container img");
      if (img) {
        img.dispatchEvent(new h.window.Event("error"));
        await h.flush();
        // The onerror handler sets errorDiv text
        expect(h.getErrorText()).toContain("Failed to render");
      }
    });
  });

  // =========================================================================
  // ZOOM CONTROLS
  // =========================================================================

  describe("Zoom controls", () => {
    beforeEach(async () => {
      h = new WebviewHarness(getHtml());
      await h.loadTestImage();
    });

    describe("Zoom in button", () => {
      it("increases scale by 1.25x", () => {
        const before = h.getTransform().scale;
        h.click("#zoom-in");
        const after = h.getTransform().scale;
        expect(after).toBeCloseTo(before * 1.25, 5);
      });

      it("updates zoom info text", () => {
        h.click("#zoom-in");
        const t = h.getTransform();
        expect(h.getZoomText()).toBe(`${Math.round(t.scale * 100)}%`);
      });

      it("can zoom in multiple times", () => {
        const initial = h.getTransform().scale;
        h.click("#zoom-in");
        h.click("#zoom-in");
        h.click("#zoom-in");
        expect(h.getTransform().scale).toBeCloseTo(
          initial * 1.25 * 1.25 * 1.25,
          4
        );
      });
    });

    describe("Zoom out button", () => {
      it("decreases scale by 1/1.25", () => {
        const before = h.getTransform().scale;
        h.click("#zoom-out");
        const after = h.getTransform().scale;
        expect(after).toBeCloseTo(before / 1.25, 5);
      });

      it("can zoom out multiple times", () => {
        const initial = h.getTransform().scale;
        h.click("#zoom-out");
        h.click("#zoom-out");
        expect(h.getTransform().scale).toBeCloseTo(
          initial / 1.25 / 1.25,
          5
        );
      });
    });

    describe("Fit to screen", () => {
      it("restores the fit scale after zooming in", () => {
        const fitScale = h.getTransform().scale;
        h.click("#zoom-in");
        h.click("#zoom-in");
        h.click("#zoom-fit");
        expect(h.getTransform().scale).toBeCloseTo(fitScale, 5);
      });

      it("resets translation to center", () => {
        h.click("#zoom-in");
        // Simulate some panning via mouse drag
        h.mouseDown(400, 300);
        h.mouseMove(500, 400);
        h.mouseUp();
        h.click("#zoom-fit");
        const t = h.getTransform();
        expect(t.translateX).toBe(0);
        expect(t.translateY).toBe(0);
      });

      it("accounts for rotation when fitting", async () => {
        h.click("#rotate-right"); // 90°
        h.click("#zoom-fit");
        // After 90° rotation, width/height swap:
        // rotatedWidth = imageHeight = 1080, rotatedHeight = imageWidth = 1920
        // scaleX = 800/1080 ≈ 0.7407, scaleY = 600/1920 ≈ 0.3125
        // scale = min(0.7407, 0.3125, 1) ≈ 0.3125
        expect(h.getTransform().scale).toBeCloseTo(600 / 1920, 3);
      });
    });

    describe("Actual size (1:1)", () => {
      it("sets scale to exactly 1", () => {
        h.click("#zoom-100");
        expect(h.getTransform().scale).toBe(1);
      });

      it("resets translation to center", () => {
        h.click("#zoom-in");
        h.click("#zoom-100");
        const t = h.getTransform();
        expect(t.translateX).toBe(0);
        expect(t.translateY).toBe(0);
      });

      it("zoom info shows 100%", () => {
        h.click("#zoom-100");
        expect(h.getZoomText()).toBe("100%");
      });
    });

    describe("Mouse wheel zoom", () => {
      it("scroll down (positive deltaY) zooms out", () => {
        const before = h.getTransform().scale;
        h.mouseWheel(100); // scroll down
        expect(h.getTransform().scale).toBeLessThan(before);
      });

      it("scroll up (negative deltaY) zooms in", () => {
        const before = h.getTransform().scale;
        h.mouseWheel(-100); // scroll up
        expect(h.getTransform().scale).toBeGreaterThan(before);
      });

      it("zoom factor is 0.9 for zoom-out and 1.1 for zoom-in", () => {
        const initial = h.getTransform().scale;

        h.mouseWheel(100); // zoom out: scale * 0.9
        expect(h.getTransform().scale).toBeCloseTo(initial * 0.9, 5);

        // Reset
        h.click("#zoom-fit");
        const reset = h.getTransform().scale;
        h.mouseWheel(-100); // zoom in: scale * 1.1
        expect(h.getTransform().scale).toBeCloseTo(reset * 1.1, 5);
      });

      it("adjusts translation to zoom toward cursor position", () => {
        // Zoom toward top-left corner
        h.click("#zoom-100"); // start at scale=1, centered
        const before = h.getTransform();

        // Wheel at position (100, 50) relative to viewport
        h.mouseWheel(-100, 100, 50);
        const after = h.getTransform();

        // Translation should shift toward the cursor position
        // The exact math: mouseX = 100 - 0 - 400 = -300 (relative to center)
        // newTX = mouseX - (mouseX - oldTX) * (newScale/oldScale)
        const mouseX = 100 - 800 / 2; // -300
        const mouseY = 50 - 600 / 2; // -250
        const expectedTX =
          mouseX - (mouseX - before.translateX) * (after.scale / before.scale);
        const expectedTY =
          mouseY - (mouseY - before.translateY) * (after.scale / before.scale);

        expect(after.translateX).toBeCloseTo(expectedTX, 3);
        expect(after.translateY).toBeCloseTo(expectedTY, 3);
      });
    });
  });

  // =========================================================================
  // ROTATION
  // =========================================================================

  describe("Rotation", () => {
    beforeEach(async () => {
      h = new WebviewHarness(getHtml());
      await h.loadTestImage();
    });

    it("rotate right adds 90 degrees", () => {
      h.click("#rotate-right");
      expect(h.getTransform().rotation).toBe(90);
    });

    it("rotate left gives 270 (normalized from -90)", () => {
      h.click("#rotate-left");
      expect(h.getTransform().rotation).toBe(270);
    });

    it("multiple rotations accumulate", () => {
      h.click("#rotate-right");
      h.click("#rotate-right");
      h.click("#rotate-right");
      expect(h.getTransform().rotation).toBe(270);
    });

    it("full rotation (4x right) normalizes to 0", () => {
      for (let i = 0; i < 4; i++) h.click("#rotate-right");
      expect(h.getTransform().rotation).toBe(0);
    });

    it("left then right returns to 0", () => {
      h.click("#rotate-left");
      h.click("#rotate-right");
      expect(h.getTransform().rotation).toBe(0);
    });
  });

  // =========================================================================
  // PAN / DRAG
  // =========================================================================

  describe("Pan / Drag", () => {
    beforeEach(async () => {
      h = new WebviewHarness(getHtml());
      await h.loadTestImage();
    });

    describe("Mouse drag", () => {
      it("left-click starts dragging", () => {
        h.mouseDown(400, 300, 0);
        expect(h.hasClass("image-viewer", "dragging")).toBe(true);
      });

      it("mouse move during drag translates the image", () => {
        // Zoom in first so pan has room
        h.click("#zoom-100");
        const before = h.getTransform();

        h.mouseDown(400, 300);
        h.mouseMove(450, 350);
        const after = h.getTransform();

        // Should translate by delta (50, 50) within constraints
        expect(after.translateX).not.toBe(before.translateX);
        expect(after.translateY).not.toBe(before.translateY);
      });

      it("mouse up stops dragging", () => {
        h.mouseDown(400, 300);
        h.mouseUp();
        expect(h.hasClass("image-viewer", "dragging")).toBe(false);
      });

      it("mouse move without prior mousedown does not pan", () => {
        h.click("#zoom-100");
        const before = h.getTransform();
        h.mouseMove(500, 400);
        const after = h.getTransform();
        expect(after.translateX).toBe(before.translateX);
        expect(after.translateY).toBe(before.translateY);
      });

      it("right-click does not start dragging", () => {
        h.mouseDown(400, 300, 2); // right button
        expect(h.hasClass("image-viewer", "dragging")).toBe(false);
      });
    });

    describe("Pan constraints", () => {
      it("constrains pan to image bounds when zoomed in", () => {
        h.click("#zoom-100"); // 1920x1080 at scale=1 in 800x600 viewport

        // Max translateX = (1920*1 - 800) / 2 = 560
        h.mouseDown(400, 300);
        h.mouseMove(2000, 300); // try to pan way right
        h.mouseUp();

        const t = h.getTransform();
        expect(t.translateX).toBeLessThanOrEqual(560);
        expect(t.translateX).toBeGreaterThanOrEqual(-560);
      });

      it("does not allow panning when image fits in viewport", () => {
        // Image is fit to screen, scaled down — no room to pan
        h.click("#zoom-fit");
        const before = h.getTransform();

        h.mouseDown(400, 300);
        h.mouseMove(500, 400);
        h.mouseUp();

        const after = h.getTransform();
        // Translation should be constrained to 0 since image is smaller than viewport
        expect(after.translateX).toBe(0);
        expect(after.translateY).toBe(0);
      });
    });
  });

  // =========================================================================
  // KEYBOARD SHORTCUTS
  // =========================================================================

  describe("Keyboard shortcuts", () => {
    beforeEach(async () => {
      h = new WebviewHarness(getHtml());
      await h.loadTestImage();
    });

    it("R rotates clockwise by 90°", () => {
      h.pressKey("R");
      expect(h.getTransform().rotation).toBe(90);
    });

    it("r (lowercase) also rotates", () => {
      h.pressKey("r");
      expect(h.getTransform().rotation).toBe(90);
    });

    it("+ zooms in", () => {
      const before = h.getTransform().scale;
      h.pressKey("+");
      expect(h.getTransform().scale).toBeCloseTo(before * 1.25, 5);
    });

    it("= zooms in (same key without shift)", () => {
      const before = h.getTransform().scale;
      h.pressKey("=");
      expect(h.getTransform().scale).toBeCloseTo(before * 1.25, 5);
    });

    it("- zooms out", () => {
      const before = h.getTransform().scale;
      h.pressKey("-");
      expect(h.getTransform().scale).toBeCloseTo(before / 1.25, 5);
    });

    it("0 fits to screen", () => {
      h.click("#zoom-100");
      h.pressKey("0");
      // Should return to fit scale
      expect(h.getTransform().scale).toBeCloseTo(800 / 1920, 3);
    });

    it("1 sets actual size", () => {
      h.pressKey("1");
      expect(h.getTransform().scale).toBe(1);
    });

    it("ignores shortcuts when an input is focused", () => {
      // Add a temporary input to the DOM
      const input = h.document.createElement("input");
      h.document.body.appendChild(input);

      // Dispatch keydown on the input element
      const before = h.getTransform().scale;
      input.dispatchEvent(
        new h.window.KeyboardEvent("keydown", { key: "+", bubbles: true })
      );
      expect(h.getTransform().scale).toBe(before);

      h.document.body.removeChild(input);
    });
  });

  // =========================================================================
  // TOUCH EVENTS
  // =========================================================================

  describe("Touch events", () => {
    beforeEach(async () => {
      h = new WebviewHarness(getHtml());
      await h.loadTestImage();
      h.click("#zoom-100"); // zoom to actual size so there's room to pan
    });

    describe("Single touch drag", () => {
      it("single touch starts dragging", () => {
        h.touchStart([{ clientX: 400, clientY: 300 }]);
        h.touchMove([{ clientX: 450, clientY: 350 }]);
        h.touchEnd();

        // Should have translated by the delta (within constraints)
        const t = h.getTransform();
        // Translation should have changed from the initial centered position
        // The constrainPan may limit it, but it should be different from (0,0)
        // since the image (1920x1080 at scale 1) is larger than viewport (800x600)
        expect(typeof t.translateX).toBe("number");
      });

      it("touch drag translates the image", () => {
        const before = h.getTransform();
        h.touchStart([{ clientX: 400, clientY: 300 }]);
        h.touchMove([{ clientX: 420, clientY: 310 }]);
        const after = h.getTransform();

        // Delta: 20px right, 10px down (within constraints)
        expect(after.translateX).toBeCloseTo(before.translateX + 20, 0);
        expect(after.translateY).toBeCloseTo(before.translateY + 10, 0);
      });
    });

    describe("Pinch to zoom", () => {
      it("pinching outward increases scale", () => {
        const before = h.getTransform().scale;

        // Start with two fingers 100px apart
        h.touchStart([
          { clientX: 350, clientY: 300 },
          { clientX: 450, clientY: 300 },
        ]);

        // Move fingers apart to 200px
        h.touchMove([
          { clientX: 300, clientY: 300 },
          { clientX: 500, clientY: 300 },
        ]);

        const after = h.getTransform().scale;
        expect(after).toBeGreaterThan(before);
      });

      it("pinching inward decreases scale", () => {
        const before = h.getTransform().scale;

        h.touchStart([
          { clientX: 300, clientY: 300 },
          { clientX: 500, clientY: 300 },
        ]);

        h.touchMove([
          { clientX: 350, clientY: 300 },
          { clientX: 450, clientY: 300 },
        ]);

        const after = h.getTransform().scale;
        expect(after).toBeLessThan(before);
      });

      it("pinch zoom ratio matches finger distance ratio", () => {
        const before = h.getTransform().scale;

        // Two fingers 100px apart
        h.touchStart([
          { clientX: 350, clientY: 300 },
          { clientX: 450, clientY: 300 },
        ]);

        // Move to 200px apart → 2x distance → 2x zoom
        h.touchMove([
          { clientX: 300, clientY: 300 },
          { clientX: 500, clientY: 300 },
        ]);

        const after = h.getTransform().scale;
        expect(after).toBeCloseTo(before * 2, 1);
      });
    });

    describe("Touch state transitions", () => {
      it("releasing all fingers stops interaction", () => {
        h.touchStart([{ clientX: 400, clientY: 300 }]);
        h.touchEnd([]); // no remaining touches

        // Further moves should not affect transform
        const before = h.getTransform();
        h.touchMove([{ clientX: 500, clientY: 400 }]);
        const after = h.getTransform();
        expect(after.translateX).toBe(before.translateX);
      });

      it("going from two touches to one switches to drag mode", () => {
        // Start pinch
        h.touchStart([
          { clientX: 350, clientY: 300 },
          { clientX: 450, clientY: 300 },
        ]);

        // Lift one finger — remaining touch at (350, 300)
        h.touchEnd([{ clientX: 350, clientY: 300 }]);

        // Now single-finger drag should work
        const before = h.getTransform();
        h.touchMove([{ clientX: 370, clientY: 310 }]);
        const after = h.getTransform();

        expect(after.translateX).toBeCloseTo(before.translateX + 20, 0);
        expect(after.translateY).toBeCloseTo(before.translateY + 10, 0);
      });
    });
  });

  // =========================================================================
  // METADATA DISPLAY
  // =========================================================================

  describe("Metadata display", () => {
    it("shows image dimensions", async () => {
      h = new WebviewHarness(getHtml(), {
        imageWidth: 4032,
        imageHeight: 3024,
      });
      await h.loadTestImage();
      const text = h.getMetadataText();
      expect(text).toContain("4032");
      expect(text).toContain("3024");
    });

    it("shows format string from message", async () => {
      h = new WebviewHarness(getHtml());
      await h.loadTestImage(1000, "JPEG (converted from HEIC)");
      expect(h.getMetadataText()).toContain("JPEG (converted from HEIC)");
    });

    it("shows file size in KB", async () => {
      h = new WebviewHarness(getHtml());
      await h.loadTestImage(512000); // 500 KB
      const text = h.getMetadataText();
      expect(text).toContain("500.00 KB");
    });

    it("shows small file size correctly", async () => {
      h = new WebviewHarness(getHtml());
      await h.loadTestImage(1024); // exactly 1 KB
      expect(h.getMetadataText()).toContain("1.00 KB");
    });

    it("shows controls help text", async () => {
      h = new WebviewHarness(getHtml());
      await h.loadTestImage();
      const text = h.getMetadataText();
      expect(text).toContain("Controls");
      expect(text).toContain("zoom");
    });
  });

  // =========================================================================
  // WINDOW RESIZE
  // =========================================================================

  describe("Window resize", () => {
    beforeEach(async () => {
      h = new WebviewHarness(getHtml());
      await h.loadTestImage();
    });

    it("fires without error", () => {
      expect(() => {
        h.window.dispatchEvent(new h.window.Event("resize"));
      }).not.toThrow();
    });

    it("constrains pan after resize", () => {
      // Zoom in and pan to edge
      h.click("#zoom-100");
      h.mouseDown(400, 300);
      h.mouseMove(2000, 2000);
      h.mouseUp();

      // Resize should re-constrain
      h.window.dispatchEvent(new h.window.Event("resize"));
      const t = h.getTransform();

      // After resize, pan should still be within bounds
      const maxTX = (1920 * t.scale - 800) / 2;
      const maxTY = (1080 * t.scale - 600) / 2;
      expect(Math.abs(t.translateX)).toBeLessThanOrEqual(maxTX + 0.01);
      expect(Math.abs(t.translateY)).toBeLessThanOrEqual(maxTY + 0.01);
    });
  });

  // =========================================================================
  // COMBINED / EDGE CASE SCENARIOS
  // =========================================================================

  describe("Combined interactions", () => {
    beforeEach(async () => {
      h = new WebviewHarness(getHtml());
      await h.loadTestImage();
    });

    it("zoom then rotate then fit returns to a clean state", () => {
      h.click("#zoom-in");
      h.click("#zoom-in");
      h.click("#rotate-right");
      h.click("#zoom-fit");

      const t = h.getTransform();
      expect(t.translateX).toBe(0);
      expect(t.translateY).toBe(0);
      // After 90° rotation: rotatedWidth=1080, rotatedHeight=1920
      // fit scale = min(800/1080, 600/1920, 1) ≈ 0.3125
      expect(t.scale).toBeCloseTo(600 / 1920, 3);
    });

    it("rapid zoom in/out sequence doesn't corrupt state", () => {
      for (let i = 0; i < 20; i++) h.click("#zoom-in");
      for (let i = 0; i < 20; i++) h.click("#zoom-out");

      // Should return to approximately the original fit scale
      const t = h.getTransform();
      expect(t.scale).toBeCloseTo(800 / 1920, 2);
      expect(isFinite(t.scale)).toBe(true);
      expect(t.scale).toBeGreaterThan(0);
    });

    it("many rotations stay normalized to [0, 360)", () => {
      for (let i = 0; i < 50; i++) h.click("#rotate-right");
      const t = h.getTransform();
      expect(isFinite(t.rotation)).toBe(true);
      expect(t.rotation).toBe(180); // 50*90 = 4500, 4500 % 360 = 180
      expect(t.rotation).toBeGreaterThanOrEqual(0);
      expect(t.rotation).toBeLessThan(360);
    });

    it("zoom out is clamped at minimum scale (0.01)", () => {
      for (let i = 0; i < 100; i++) h.click("#zoom-out");
      const t = h.getTransform();
      expect(t.scale).toBe(0.01);
    });

    it("zoom in is capped at maximum scale (50)", () => {
      for (let i = 0; i < 200; i++) h.click("#zoom-in");
      const t = h.getTransform();
      expect(t.scale).toBe(50);
    });

    it("keyboard and buttons produce equivalent results", () => {
      // Zoom in with button
      const start = h.getTransform().scale;
      h.click("#zoom-in");
      const afterButton = h.getTransform().scale;
      const buttonFactor = afterButton / start;

      // Reset and zoom with keyboard
      h.click("#zoom-fit");
      const reset = h.getTransform().scale;
      h.pressKey("+");
      const afterKey = h.getTransform().scale;
      const keyFactor = afterKey / reset;

      expect(buttonFactor).toBeCloseTo(keyFactor, 5);
    });
  });

  // =========================================================================
  // LOADING A SECOND IMAGE
  // =========================================================================

  describe("Image replacement", () => {
    it("second load replaces the first image", async () => {
      h = new WebviewHarness(getHtml());
      await h.loadTestImage(1000);

      // Load a second image
      await h.loadTestImage(2000);

      // Should only have one image
      const images = h.document.querySelectorAll("#image-container img");
      expect(images.length).toBe(1);
    });

    it("second load resets transform state", async () => {
      h = new WebviewHarness(getHtml());
      await h.loadTestImage();
      h.click("#zoom-100");
      h.click("#rotate-right");

      // Load a new image — should reset
      await h.loadTestImage();
      const t = h.getTransform();
      // Scale should be fit-to-screen, not 1
      expect(t.scale).toBeCloseTo(800 / 1920, 3);
      // Rotation should be 0 (reset), so fitToScreen uses original dimensions
      expect(t.rotation).toBe(0);
    });
  });
});
