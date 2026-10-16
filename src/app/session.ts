import { ApiClient } from '@api/api';
import { Session } from '@features/auth';
import { config } from './config';
import { queryClient } from './router';

const apiClient = new ApiClient(import.meta.env.DEV ? '' : config.apiOrigin);
export const session = new Session(apiClient, queryClient);
