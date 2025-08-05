import { FunctionCall } from './types';
import { Schema as S } from 'effect';

// ============================================
// Function Argument Schemas
// ============================================

// FROM_TODAY function argument schemas
const DateUnitSchema = S.Literal('DAYS', 'WEEKS', 'MONTHS', 'YEARS');
const DaysSchema = S.Number.pipe(
  S.int(),
  S.between(-365, 365) // Reasonable range for date calculations
);

export const FromTodayArgsSchema = S.Struct({
  days: DaysSchema,
  unit: S.optional(DateUnitSchema)
});

// Export types for better IDE support
export type DateUnit = S.Schema.Type<typeof DateUnitSchema>;
export type FromTodayArgs = S.Schema.Type<typeof FromTodayArgsSchema>;

/**
 * Creates a TODAY() function call for kintone queries.
 * Returns the current date (without time).
 * 
 * @returns {FunctionCall} A function call object representing TODAY()
 * @example
 * ```typescript
 * // Query for records created today
 * query(schema => schema.CreatedDate.equals(TODAY()))
 * ```
 */
export function TODAY(): FunctionCall {
  return {
    type: 'function',
    name: 'TODAY',
  };
}

/**
 * Creates a NOW() function call for kintone queries.
 * Returns the current date and time.
 * 
 * @returns {FunctionCall} A function call object representing NOW()
 * @example
 * ```typescript
 * // Query for records updated in the last hour
 * query(schema => schema.UpdatedTime.greaterThan(FROM_TODAY(-1, 'HOURS')))
 * ```
 */
export function NOW(): FunctionCall {
  return {
    type: 'function',
    name: 'NOW',
  };
}

/**
 * Creates a YESTERDAY() function call for kintone queries.
 * Returns yesterday's date.
 * 
 * @returns {FunctionCall} A function call object representing YESTERDAY()
 * @example
 * ```typescript
 * // Query for records created yesterday
 * query(schema => schema.CreatedDate.equals(YESTERDAY()))
 * ```
 */
export function YESTERDAY(): FunctionCall {
  return {
    type: 'function',
    name: 'YESTERDAY',
  };
}

/**
 * Creates a TOMORROW() function call for kintone queries.
 * Returns tomorrow's date.
 * 
 * @returns {FunctionCall} A function call object representing TOMORROW()
 * @example
 * ```typescript
 * // Query for records with due date tomorrow
 * query(schema => schema.DueDate.equals(TOMORROW()))
 * ```
 */
export function TOMORROW(): FunctionCall {
  return {
    type: 'function',
    name: 'TOMORROW',
  };
}

/**
 * Creates a FROM_TODAY() function call for kintone queries.
 * Calculates a date relative to today.
 * 
 * @param {number} days - Number of days from today (-365 to 365)
 * @param {DateUnit} [unit] - Optional time unit ('DAYS', 'WEEKS', 'MONTHS', 'YEARS')
 * @returns {FunctionCall} A function call object representing FROM_TODAY(days, unit?)
 * @throws {Error} When arguments are invalid (out of range or wrong type)
 * 
 * @example
 * ```typescript
 * // Query for records created in the last 7 days
 * query(schema => schema.CreatedDate.greaterThan(FROM_TODAY(-7)))
 * 
 * // Query for records due in the next 2 weeks
 * query(schema => schema.DueDate.lessThan(FROM_TODAY(2, 'WEEKS')))
 * 
 * // Query for records from 1 month ago
 * query(schema => schema.Date.equals(FROM_TODAY(-1, 'MONTHS')))
 * ```
 */
export function FROM_TODAY(days: number, unit?: DateUnit): FunctionCall {
  // Validate arguments using Effect-TS schema
  try {
    const validatedArgs = S.decodeUnknownSync(FromTodayArgsSchema)({ days, unit });
    return {
      type: 'function',
      name: 'FROM_TODAY',
      args: validatedArgs.unit ? [validatedArgs.days, validatedArgs.unit] : [validatedArgs.days],
    };
  } catch (error) {
    throw new Error(`FROM_TODAY validation error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Creates a THIS_WEEK() function call for kintone queries.
 * Returns the current week's date range.
 * 
 * @returns {FunctionCall} A function call object representing THIS_WEEK()
 * @example
 * ```typescript
 * // Query for records created this week
 * query(schema => schema.CreatedDate.equals(THIS_WEEK()))
 * ```
 */
export function THIS_WEEK(): FunctionCall {
  return {
    type: 'function',
    name: 'THIS_WEEK',
  };
}

/**
 * Creates a LAST_WEEK() function call for kintone queries.
 * Returns the previous week's date range.
 * 
 * @returns {FunctionCall} A function call object representing LAST_WEEK()
 * @example
 * ```typescript
 * // Query for records created last week
 * query(schema => schema.CreatedDate.equals(LAST_WEEK()))
 * ```
 */
export function LAST_WEEK(): FunctionCall {
  return {
    type: 'function',
    name: 'LAST_WEEK',
  };
}

/**
 * Creates a NEXT_WEEK() function call for kintone queries.
 * Returns the next week's date range.
 * 
 * @returns {FunctionCall} A function call object representing NEXT_WEEK()
 * @example
 * ```typescript
 * // Query for records due next week
 * query(schema => schema.DueDate.equals(NEXT_WEEK()))
 * ```
 */
export function NEXT_WEEK(): FunctionCall {
  return {
    type: 'function',
    name: 'NEXT_WEEK',
  };
}

/**
 * Creates a THIS_MONTH() function call for kintone queries.
 * Returns the current month's date range.
 * 
 * @returns {FunctionCall} A function call object representing THIS_MONTH()
 * @example
 * ```typescript
 * // Query for records created this month
 * query(schema => schema.CreatedDate.equals(THIS_MONTH()))
 * ```
 */
export function THIS_MONTH(): FunctionCall {
  return {
    type: 'function',
    name: 'THIS_MONTH',
  };
}

/**
 * Creates a LAST_MONTH() function call for kintone queries.
 * Returns the previous month's date range.
 * 
 * @returns {FunctionCall} A function call object representing LAST_MONTH()
 * @example
 * ```typescript
 * // Query for records created last month
 * query(schema => schema.CreatedDate.equals(LAST_MONTH()))
 * ```
 */
export function LAST_MONTH(): FunctionCall {
  return {
    type: 'function',
    name: 'LAST_MONTH',
  };
}

/**
 * Creates a NEXT_MONTH() function call for kintone queries.
 * Returns the next month's date range.
 * 
 * @returns {FunctionCall} A function call object representing NEXT_MONTH()
 * @example
 * ```typescript
 * // Query for records due next month
 * query(schema => schema.DueDate.equals(NEXT_MONTH()))
 * ```
 */
export function NEXT_MONTH(): FunctionCall {
  return {
    type: 'function',
    name: 'NEXT_MONTH',
  };
}

/**
 * Creates a THIS_YEAR() function call for kintone queries.
 * Returns the current year's date range.
 * 
 * @returns {FunctionCall} A function call object representing THIS_YEAR()
 * @example
 * ```typescript
 * // Query for records created this year
 * query(schema => schema.CreatedDate.equals(THIS_YEAR()))
 * ```
 */
export function THIS_YEAR(): FunctionCall {
  return {
    type: 'function',
    name: 'THIS_YEAR',
  };
}

/**
 * Creates a LOGINUSER() function call for kintone queries.
 * Returns the login name of the current user.
 * 
 * @returns {FunctionCall} A function call object representing LOGINUSER()
 * @example
 * ```typescript
 * // Query for records assigned to the current user
 * query(schema => schema.Assignee.equals(LOGINUSER()))
 * ```
 */
export function LOGINUSER(): FunctionCall {
  return {
    type: 'function',
    name: 'LOGINUSER',
  };
}

/**
 * Creates a PRIMARY_ORGANIZATION() function call for kintone queries.
 * Returns the primary organization code of the current user.
 * 
 * @returns {FunctionCall} A function call object representing PRIMARY_ORGANIZATION()
 * @example
 * ```typescript
 * // Query for records from the current user's primary organization
 * query(schema => schema.Organization.equals(PRIMARY_ORGANIZATION()))
 * ```
 */
export function PRIMARY_ORGANIZATION(): FunctionCall {
  return {
    type: 'function',
    name: 'PRIMARY_ORGANIZATION',
  };
}