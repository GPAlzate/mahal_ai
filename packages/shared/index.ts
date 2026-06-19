/**
 * Barrel for the shared package.
 *
 * Consumers can import the API client + hooks from the root, or reach into
 * schemas/helpers/dtos via subpath imports (e.g. `@mahal/shared/schemas/...`).
 */
export * from './client/api-client';
export * from './client/hooks/useReceipt';
export * from './client/hooks/useParticipants';
export * from './client/hooks/useAssignments';
export * from './helpers/CurrencyHelper';
export * from './helpers/ShareCodeHelper';
