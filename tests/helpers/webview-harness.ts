/**
 * Test harness for the HEIC Preview webview.
 *
 * Creates a JSDOM instance from the webview HTML, mocks browser APIs that
 * JSDOM doesn't support (Image loading, getBoundingClientRect), and exposes
 * helpers for dispatching user interactions and reading transform state.
 */

import { JSDOM } from "jsdom";

export interface HarnessOptions {
  viewportWidth?: number;
  viewportHeight?: number;
  imageWidth?: number;
  imageHeight?: number;
}

export interface TransformState {
  translateX: number;
  translateY: number;
  scale: number;
  rotation: number;
}

export class WebviewHarness {
  dom: JSDOM;
  window: any;
  document: Document;

  private vpWidth: number;
  private vpHeight: number;

  constructor(html: string, options: HarnessOptions = {}) {
    this.vpWidth = options.viewportWidth ?? 800;
    this.vpHeight = options.viewportHeight ?? 600;
    const imgWidth = options.imageWidth ?? 1920;
    const imgHeight = options.imageHeight ?? 1080;
    const vpW = this.vpWidth;
    const vpH = this.vpHeight;

    this.dom = new JSDOM(html, {
      runScripts: "dangerously",
      pretendToBeVisual: true,
      url: "https://localhost",
      beforeParse(window: any) {
        // Mock Image so that setting .src triggers onload with known dimensions.
        // We return a real <img> element so appendChild works normally.
        window.Image = function MockImage() {
          const img = window.document.createElement("img");
          let _src = "";
          Object.defineProperty(img, "src", {
            get() {
              return _src;
            },
            set(val: string) {
              _src = val;
              Object.defineProperty(img, "naturalWidth", {
                value: imgWidth,
                writable: true,
                configurable: true,
              });
              Object.defineProperty(img, "naturalHeight", {
                value: imgHeight,
                writable: true,
                configurable: true,
              });
              // Defer so that img.onload is assigned before we fire it.
              setTimeout(() => {
                if (img.onload)
                  img.onload(new window.Event("load") as Event);
              }, 0);
            },
            configurable: true,
          });
          return img;
        };

        // Mock getBoundingClientRect globally (JSDOM returns all zeros).
        const origGetBCR =
          window.HTMLElement.prototype.getBoundingClientRect;
        window.HTMLElement.prototype.getBoundingClientRect = function () {
          if (this.id === "image-viewer") {
            return {
              x: 0,
              y: 0,
              width: vpW,
              height: vpH,
              top: 0,
              left: 0,
              right: vpW,
              bottom: vpH,
              toJSON() {
                return this;
              },
            };
          }
          return origGetBCR.call(this);
        };
      },
    });

    this.window = this.dom.window;
    this.document = this.dom.window.document;
  }

  // ---------------------------------------------------------------------------
  //  Message helpers
  // ---------------------------------------------------------------------------

  /** Post a message to the webview and wait for all async effects. */
  async postMessage(data: any): Promise<void> {
    this.window.dispatchEvent(
      new this.window.MessageEvent("message", { data })
    );
    await this.flush();
  }

  /** Wait long enough for setTimeout(0) and setTimeout(10) in webview code. */
  async flush(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  /** Convenience: post a standard update message with a test image. */
  async loadTestImage(
    sizeBytes = 102400,
    format = "JPEG (converted from HEIC)"
  ): Promise<void> {
    await this.postMessage({
      type: "update",
      image: "data:image/jpeg;base64,AAAA",
      metadata: { format, size: sizeBytes },
    });
  }

  // ---------------------------------------------------------------------------
  //  Interaction helpers
  // ---------------------------------------------------------------------------

  click(selector: string): void {
    const el = this.document.querySelector(selector);
    if (!el) throw new Error(`Element not found: ${selector}`);
    el.dispatchEvent(new this.window.MouseEvent("click", { bubbles: true }));
  }

  pressKey(key: string): void {
    // Dispatch on body so e.target.tagName exists (document node has none).
    this.document.body.dispatchEvent(
      new this.window.KeyboardEvent("keydown", { key, bubbles: true })
    );
  }

  mouseWheel(deltaY: number, clientX = 400, clientY = 300): void {
    const viewer = this.document.getElementById("image-viewer")!;
    viewer.dispatchEvent(
      new this.window.WheelEvent("wheel", {
        deltaY,
        clientX,
        clientY,
        bubbles: true,
        cancelable: true,
      })
    );
  }

  mouseDown(clientX: number, clientY: number, button = 0): void {
    const viewer = this.document.getElementById("image-viewer")!;
    viewer.dispatchEvent(
      new this.window.MouseEvent("mousedown", {
        button,
        clientX,
        clientY,
        bubbles: true,
      })
    );
  }

  mouseMove(clientX: number, clientY: number): void {
    this.document.dispatchEvent(
      new this.window.MouseEvent("mousemove", {
        clientX,
        clientY,
        bubbles: true,
      })
    );
  }

  mouseUp(): void {
    this.document.dispatchEvent(
      new this.window.MouseEvent("mouseup", { bubbles: true })
    );
  }

  /** Dispatch a synthetic touch event (JSDOM has no native TouchEvent). */
  private dispatchTouch(
    type: string,
    touches: Array<{ clientX: number; clientY: number }>
  ): void {
    const viewer = this.document.getElementById("image-viewer")!;
    const event = new this.window.Event(type, {
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(event, "touches", { value: touches });
    event.preventDefault = () => {};
    viewer.dispatchEvent(event);
  }

  touchStart(touches: Array<{ clientX: number; clientY: number }>): void {
    this.dispatchTouch("touchstart", touches);
  }

  touchMove(touches: Array<{ clientX: number; clientY: number }>): void {
    this.dispatchTouch("touchmove", touches);
  }

  touchEnd(
    touches: Array<{ clientX: number; clientY: number }> = []
  ): void {
    this.dispatchTouch("touchend", touches);
  }

  // ---------------------------------------------------------------------------
  //  State readers
  // ---------------------------------------------------------------------------

  /** Parse the CSS transform on the rendered image into numeric values. */
  getTransform(): TransformState {
    const img = this.document.querySelector(
      "#image-container img"
    ) as HTMLElement | null;
    if (!img) return { translateX: 0, translateY: 0, scale: 1, rotation: 0 };

    const t = img.style.transform;
    const tr = t.match(/translate\(([-\d.e+]+)px,\s*([-\d.e+]+)px\)/);
    const sc = t.match(/scale\(([-\d.e+]+)\)/);
    const ro = t.match(/rotate\(([-\d.e+]+)deg\)/);

    return {
      translateX: tr ? parseFloat(tr[1]) : 0,
      translateY: tr ? parseFloat(tr[2]) : 0,
      scale: sc ? parseFloat(sc[1]) : 1,
      rotation: ro ? parseFloat(ro[1]) : 0,
    };
  }

  getZoomText(): string {
    return this.document.getElementById("zoom-info")!.textContent || "";
  }

  isVisible(id: string): boolean {
    const el = this.document.getElementById(id);
    return el ? el.style.display !== "none" : false;
  }

  hasClass(id: string, className: string): boolean {
    const el = this.document.getElementById(id);
    return el ? el.classList.contains(className) : false;
  }

  getMetadataText(): string {
    return this.document.getElementById("metadata")!.textContent || "";
  }

  getErrorText(): string {
    return this.document.getElementById("error")!.textContent || "";
  }

  // ---------------------------------------------------------------------------

  destroy(): void {
    this.dom.window.close();
  }
}
