/**
 * Generic Result type for operations that can succeed or fail.
 *
 * This provides a type-safe way to handle success/error cases without throwing exceptions.
 *
 * @template T - The type of data returned on success
 *
 * @example
 * ```typescript
 * async function fetchUser(id: string): Promise<Result<User>> {
 *   try {
 *     const user = await api.getUser(id);
 *     return { success: true, data: user };
 *   } catch (error) {
 *     return { success: false, error: 'Failed to fetch user' };
 *   }
 * }
 *
 * const result = await fetchUser('123');
 * if (isSuccess(result)) {
 *   console.log(result.data.name); // TypeScript knows data exists
 * } else {
 *   console.error(result.error); // TypeScript knows error exists
 * }
 * ```
 */
export type Result<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Type guard to check if a Result is successful.
 *
 * @param result - The Result to check
 * @returns true if the result is successful
 *
 * @example
 * ```typescript
 * const result = await someOperation();
 * if (isSuccess(result)) {
 *   // TypeScript knows result.data exists here
 *   console.log(result.data);
 * }
 * ```
 */
export function isSuccess<T>(
  result: Result<T>
): result is { success: true; data: T } {
  return result.success === true;
}

/**
 * Type guard to check if a Result is a failure.
 *
 * @param result - The Result to check
 * @returns true if the result is a failure
 *
 * @example
 * ```typescript
 * const result = await someOperation();
 * if (isFailure(result)) {
 *   // TypeScript knows result.error exists here
 *   console.error(result.error);
 * }
 * ```
 */
export function isFailure<T>(
  result: Result<T>
): result is { success: false; error: string } {
  return result.success === false;
}

/**
 * Unwraps a Result, returning the data if successful or throwing if failed.
 *
 * Use this when you want to convert a Result back to exception-based error handling.
 *
 * @param result - The Result to unwrap
 * @returns The data from a successful result
 * @throws Error with the error message if the result is a failure
 *
 * @example
 * ```typescript
 * try {
 *   const data = unwrap(await someOperation());
 *   console.log(data);
 * } catch (error) {
 *   console.error(error.message);
 * }
 * ```
 */
export function unwrap<T>(result: Result<T>): T {
  if (isSuccess(result)) {
    return result.data;
  }
  throw new Error(result.error);
}

/**
 * Maps a successful Result to a new value using a transformation function.
 * If the Result is a failure, returns the failure unchanged.
 *
 * @param result - The Result to map
 * @param fn - Function to transform the success value
 * @returns A new Result with the transformed value or the original error
 *
 * @example
 * ```typescript
 * const userResult = await fetchUser('123');
 * const nameResult = mapResult(userResult, user => user.name);
 * // If userResult was successful, nameResult contains the name
 * // If userResult failed, nameResult contains the same error
 * ```
 */
export function mapResult<T, U>(
  result: Result<T>,
  fn: (data: T) => U
): Result<U> {
  if (isSuccess(result)) {
    return { success: true, data: fn(result.data) };
  }
  return result;
}

/**
 * Chains multiple Result-returning operations together.
 * If any operation fails, the chain stops and returns the failure.
 *
 * @param result - The initial Result
 * @param fn - Function that takes the success value and returns a new Result
 * @returns The Result from the chained operation or the original error
 *
 * @example
 * ```typescript
 * const result = await fetchUser('123')
 *   .then(r => chainResult(r, user => fetchUserPosts(user.id)))
 *   .then(r => chainResult(r, posts => processPost(posts[0])));
 * ```
 */
export function chainResult<T, U>(
  result: Result<T>,
  fn: (data: T) => Result<U>
): Result<U> {
  if (isSuccess(result)) {
    return fn(result.data);
  }
  return result;
}

/**
 * Checks if a value is a Result object.
 *
 * @param val - The value to check
 * @returns true if the value is a Result object
 */
export function isResult(val: any): val is Result<any> {
  return (
    val !== null &&
    typeof val === 'object' &&
    'success' in val &&
    (val.success === true || val.success === false) &&
    ('data' in val || 'error' in val)
  );
}
