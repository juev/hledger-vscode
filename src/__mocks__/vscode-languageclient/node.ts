export enum State {
  Stopped = 1,
  Starting = 2,
  Running = 3,
}

export class LanguageClient {
  private _state: State = State.Stopped;
  private _onDidChangeStateCallbacks: Array<(e: { oldState: State; newState: State }) => void> = [];

  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly serverOptions: ServerOptions,
    public readonly clientOptions: LanguageClientOptions
  ) {}

  get state(): State {
    return this._state;
  }

  onDidChangeState(callback: (e: { oldState: State; newState: State }) => void): { dispose: () => void } {
    this._onDidChangeStateCallbacks.push(callback);
    return { dispose: () => {} };
  }

  async start(): Promise<void> {
    const oldState = this._state;
    this._state = State.Running;
    this._onDidChangeStateCallbacks.forEach(cb => cb({ oldState, newState: this._state }));
  }

  async stop(): Promise<void> {
    const oldState = this._state;
    this._state = State.Stopped;
    this._onDidChangeStateCallbacks.forEach(cb => cb({ oldState, newState: this._state }));
  }

  sendRequest<R>(_method: string, _params?: unknown): Promise<R> {
    return Promise.resolve({} as R);
  }

  sendNotification(_method: string, _params?: unknown): Promise<void> {
    return Promise.resolve();
  }
}

export interface Executable {
  command: string;
  args?: string[];
  options?: object;
}

export type ServerOptions = Executable;

export interface DocumentSelector {
  language?: string;
  scheme?: string;
  pattern?: string;
}

export interface LanguageClientOptions {
  documentSelector?: DocumentSelector[];
  synchronize?: {
    configurationSection?: string;
    fileEvents?: unknown;
  };
  outputChannel?: unknown;
  middleware?: unknown;
}
