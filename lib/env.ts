/**
 * Generic function to get any environment variable with validation
 *
 * @param name - The name of the environment variable
 * @param required - Whether the variable is required (defaults to true)
 * @returns The value of the environment variable, or undefined if not required and not found
 * @throws Error if the variable is required but not defined
 */
export function getEnvVar(name: string, required = true): string | undefined {
  const value = process.env[name];

  if (required && !value) {
    throw new Error(`Environment variable ${name} is not defined`);
  }

  return value;
}

/**
 * Retrieves the database URL from environment variables
 */
export function getDatabaseURL(): string {
  return getEnvVar('DATABASE_URL') as string;
}

/**
 * Retrieves the OpenAI API key from environment variables
 */
export function getOpenAIAPIKey(): string {
  return getEnvVar('OPENAI_API_KEY') as string;
}

/**
 * Retrieves the Vercel Blob public base URL from environment variables
 */
export function getBlobBaseURL(): string {
  return getEnvVar('BLOB_BASE_URL') as string;
}

/**
 * Retrieves the Clerk publishable key (client-safe)
 */
export function getClerkPublishableKey(): string {
  return getEnvVar('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY') as string;
}

/**
 * Retrieves the Clerk secret key (server-only)
 */
export function getClerkSecretKey(): string {
  return getEnvVar('CLERK_SECRET_KEY') as string;
}

/**
 * Clerk user ID of the admin/owner — gates early-access features
 */
export function getAdminUserId(): string {
  return getEnvVar('NEXT_PUBLIC_ADMIN_USER_ID', false) ?? '';
}

/**
 * Retrieves the VAPID public key for web push (client-safe)
 */
export function getVapidPublicKey(): string {
  return getEnvVar('NEXT_PUBLIC_VAPID_PUBLIC_KEY') as string;
}

/**
 * Retrieves the VAPID private key for web push (server-only)
 */
export function getVapidPrivateKey(): string {
  return getEnvVar('VAPID_PRIVATE_KEY') as string;
}

/**
 * Retrieves the VAPID subject (mailto: or https: URL identifying the sender)
 */
export function getVapidSubject(): string {
  return getEnvVar('VAPID_SUBJECT') as string;
}

/**
 * Shared secret protecting /api/cron/* endpoints
 */
export function getCronSecret(): string {
  return getEnvVar('CRON_SECRET') as string;
}