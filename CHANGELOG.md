# Changelog

## [2.2.0] - 2025-08-26

### Fixed
- Zoom now clamped to [1%, 5000%] to prevent unusable zoom levels
- Rotation normalized to [0, 360) to prevent unbounded accumulation
- Fixed potential XSS in error message rendering

### Added
- Comprehensive test suite (106 tests, 100% coverage)

### Changed
- Optimized extension package size (6.6MB to 2.4MB)
- Removed unused dependencies (`image-size`, `copy-webpack-plugin`)

## [2.1.0] - 2025-08-20

### Changed
- Made toolbar controls and metadata panel more compact

## [2.0.0] - 2025-08-20

### Added
- Image rotation (left/right in 90 degree increments)
- Zoom controls (in, out, fit to screen, actual size)
- Click and drag panning with boundary constraints
- Mouse wheel zoom toward cursor position
- Touch support (pinch to zoom, drag to pan)
- Keyboard shortcuts (R, +/-, 0, 1)
- Image metadata display (dimensions, format, file size)

## [1.7.0] - 2025-08-19

### Fixed
- VS Code 1.102+ compatibility

## [1.6.1] - 2025-08-17

### Changed
- More precise README documentation

## [1.6.0] - 2025-08-15

### Fixed
- Windows compatibility fix

## [1.5.0] - 2025-08-15

### Changed
- Updated extension icon

## [1.4.0] - 2025-08-14

### Fixed
- Webpack bundling issues

## [1.3.0] - 2025-08-14

### Fixed
- Webpack configuration fixes

## [1.2.0] - 2025-08-13

### Fixed
- Correct activation events for custom editor

## [1.1.0] - 2025-08-13

### Changed
- Simplified preview interface
- Fixed production preview rendering

## [1.0.0] - 2025-08-13

### Added
- Initial release
- Preview HEIC/HEIF images directly in VS Code
- Automatic JPEG conversion for display
- Light and dark theme support
