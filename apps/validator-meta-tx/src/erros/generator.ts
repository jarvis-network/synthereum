export const ErrorGenerator = {
  /**
   * Return Error message
   * `key`: must be at least `length` characters
   * @template T Model
   * @param {keyof T} key Model Key
   * @param {number} length
   * @returns {string}
   */
  MiniLength: <T>(key: keyof T, length: number): string =>
    `${key.toString()}: must be at least ${length} characters`,

  /**
   * Return Error message
   * `key`: must not be longer than `length` characters
   * @template T Model
   * @param {keyof T} key Model Key
   * @param {number} length
   * @returns {string}
   */
  MaxLength: <T>(key: keyof T, length: number): string =>
    `${key.toString()}: must not be longer than ${length} characters`,

  /**
   * Return Error message
   * `key`: is required
   * @template T Model
   * @param {keyof T} key Model Key
   * @returns {string}
   */
  Required: <T>(key: keyof T): string => `${key.toString()}: is required`,
  NotValiad: <T>(key: keyof T, message: string): string =>
    `${key.toString()}: is not valid ${message}`,

  /**
   * Return Error message
   * `key`: must be greater than or equal to `value`
   * @template T Model
   * @param {keyof T} key Model Key
   * @param {number} value
   * @returns {string}
   */
  MinValue: <T>(key: keyof T, value: number): string =>
    `${key.toString()}:  must be greater than or equal to ${value}`,
  /**
   * Return Error message
   * `key`: must be less than or equal to `value`
   * @template T Model
   * @param {keyof T} key Model Key
   * @param {number} value
   * @returns {string}
   */
  MaxValue: <T>(key: keyof T, value: number): string =>
    `${key.toString()}:  must be less than or equal to ${value}`,
  /**
   * Return Error message
   * No `modelName` found
   * @param {string} modelName
   * @returns {string}
   */
  NotFound: (modelName: string): string => `No ${modelName} found`,
};
