import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';

const API_BASE_PATH = '/api/v1';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly retryAt = 0,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class SessionCancelled extends Error {
  constructor() {
    super('This request belongs to a closed session.');
    this.name = 'SessionCancelled';
  }
}

const messages: Record<number, string> = {
  400: 'Check the submitted information and try again.',
  401: 'Your session has ended. Sign in again.',
  403: 'You do not have permission to perform this action.',
  404: 'The requested record is not available.',
  409: 'This action conflicts with the current state. Refresh and try again.',
  429: 'Too many attempts. Wait before trying again.',
};

export function safeError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (!axios.isAxiosError(error))
    return new ApiError(0, 'Unable to complete the request. Try again.');
  const status = error.response?.status ?? 0;
  const retryAfter = error.response?.headers['retry-after'];
  const seconds = Number(retryAfter);
  const retryAt =
    status === 429
      ? Math.max(
          Date.now() + 1_000,
          Number.isFinite(seconds) && retryAfter != null
            ? Date.now() + seconds * 1_000
            : Date.parse(String(retryAfter)) || Date.now() + 60_000,
        )
      : 0;
  return new ApiError(
    status,
    messages[status] ??
      (status === 0
        ? 'Cannot reach the server. Check your connection and try again.'
        : 'The server could not complete the request. Try again.'),
    retryAt,
  );
}

type Request = Omit<AxiosRequestConfig, 'baseURL' | 'withCredentials' | 'signal' | 'auth'> & {
  signal?: AbortSignal;
  auth?: boolean;
  mapError?: (status: number, body: unknown) => ApiError | undefined;
};

/** A generation boundary covers mutations as well as Query-managed reads. */
export class ApiClient {
  private generation = 0;
  private controller = new AbortController();
  onRequestError?: (
    error: unknown,
    details: { method?: string; route?: string; status: number; failedRequestId?: string },
  ) => void;
  onAuthError?: (status: number) => void;
  readonly http: AxiosInstance;
  readonly baseUrl: string;

  constructor(readonly origin: string) {
    this.baseUrl = `${origin}${API_BASE_PATH}`;
    this.http = axios.create({ baseURL: this.baseUrl, withCredentials: true, timeout: 15_000 });
  }

  reset() {
    this.generation += 1;
    this.controller.abort();
    this.controller = new AbortController();
  }

  async request<T = unknown>({ signal, auth = false, mapError, ...config }: Request): Promise<T> {
    const generation = this.generation;
    const combined = signal
      ? AbortSignal.any([signal, this.controller.signal])
      : this.controller.signal;
    try {
      const response = await this.http.request<T>({ ...config, signal: combined });
      if (generation !== this.generation || combined.aborted) throw new SessionCancelled();
      return response.status === 204 ? (undefined as T) : response.data;
    } catch (error) {
      if (generation !== this.generation || combined.aborted || axios.isCancel(error)) {
        throw new SessionCancelled();
      }
      const normalized = safeError(error);
      try {
        this.onRequestError?.(error, {
          method: config.method ?? 'GET',
          route: config.url,
          status: normalized.status,
          failedRequestId: axios.isAxiosError(error)
            ? error.response?.headers['x-request-id']
            : undefined,
        });
      } catch {
        /* Diagnostics must not interfere with session handling. */
      }
      if (!auth && (normalized.status === 401 || normalized.status === 403)) {
        this.onAuthError?.(normalized.status);
      }
      throw (
        (axios.isAxiosError(error)
          ? mapError?.(normalized.status, error.response?.data)
          : undefined) ?? normalized
      );
    }
  }
}
