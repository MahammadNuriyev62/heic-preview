# HEIC Image Preview for VSCode

Preview HEIC/HEIF images directly in Visual Studio Code with powerful viewing controls and no external tools required.

## Features

- 🖼️ **Preview HEIC and HEIF images** directly in VSCode
- 🔍 **Advanced zoom controls** - zoom in, zoom out, fit to screen, actual size (1:1)
- 🔄 **Image rotation** - rotate left/right in 90-degree increments
- 🖱️ **Interactive navigation** - mouse wheel zoom, click and drag to pan
- 📱 **Touch support** - pinch-to-zoom and drag gestures for mobile/touchscreen devices
- ⌨️ **Keyboard shortcuts** - quick access to all controls
- 📊 **Display image metadata** - dimensions, format, file size
- 🎨 **Automatic JPEG conversion** for optimal display performance
- 🌙 **Theme support** - works seamlessly with light and dark VSCode themes
- 🎯 **Smart zoom-to-point** - zoom towards cursor/touch position
- 🖼️ **Boundary constraints** - prevents over-panning when zoomed

## Usage

1. **Open any `.heic` or `.heif` file** in VSCode
2. The image will **automatically open** in the enhanced preview panel
3. Use the **toolbar controls** or **keyboard shortcuts** to navigate:

### Toolbar Controls

- **Rotate Left/Right** - Rotate image in 90° increments
- **Zoom In/Out** - Increase or decrease magnification
- **Fit to Screen** - Scale image to fit viewport
- **Actual Size** - Display at 100% scale

### Keyboard Shortcuts

- `R` - Rotate image clockwise
- `+` / `=` - Zoom in
- `-` - Zoom out
- `0` - Fit to screen
- `1` - Actual size (100%)

### Mouse/Touch Controls

- **Mouse wheel** - Zoom in/out (towards cursor position)
- **Click and drag** - Pan around image when zoomed
- **Pinch gesture** - Zoom on touch devices
- **Touch drag** - Pan on mobile devices

4. **View image metadata** in the panel below the image

## Requirements

- VSCode 1.102.0 or higher
- Node.js runtime

## Installation

Install from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=nuriyev.heic-preview), or search for "HEIC Image Preview" in the Extensions view (`Ctrl+Shift+X`).

## Supported File Types

- `.heic` - High Efficiency Image Container
- `.heif` - High Efficiency Image Format

## Known Issues

- Large HEIC files may take a moment to convert and display
- Some rare HEIC variants or corrupted files may not be supported
- Performance may vary based on image size and system capabilities

## Tips

- **Zoom to specific area**: Use mouse wheel while hovering over the area you want to zoom into
- **Quick navigation**: Use keyboard shortcuts for faster workflow
- **Mobile viewing**: Fully supports touch gestures on tablets and touch-enabled laptops
- **Large images**: Use "Fit to Screen" for initial overview, then zoom to examine details
