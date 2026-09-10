class DesktopLogger {
  readonly supported = false;

  initialize(): Promise<string | null> {
    return Promise.resolve(null);
  }

  location(): Promise<string | null> {
    return Promise.resolve(null);
  }

  info(_message: string): Promise<void> {
    return Promise.resolve();
  }

  error(_message: string): Promise<void> {
    return Promise.resolve();
  }
}

export const desktopLogger = new DesktopLogger();
