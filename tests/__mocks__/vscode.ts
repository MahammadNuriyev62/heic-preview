// Minimal VS Code API mock for unit testing

export const Uri = {
  file: (path: string) => ({ fsPath: path, scheme: "file", path }),
  parse: (str: string) => ({ fsPath: str, scheme: "file", path: str }),
};

export const window = {
  registerCustomEditorProvider: jest
    .fn()
    .mockReturnValue({ dispose: jest.fn() }),
  showOpenDialog: jest.fn(),
};

export const commands = {
  registerCommand: jest.fn().mockReturnValue({ dispose: jest.fn() }),
  executeCommand: jest.fn(),
};

export const workspace = {};

export enum ViewColumn {
  One = 1,
  Two = 2,
  Three = 3,
}
