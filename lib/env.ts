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