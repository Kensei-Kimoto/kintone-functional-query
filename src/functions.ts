import { FunctionCall } from './types';

export function TODAY(): FunctionCall {
  return {
    type: 'function',
    name: 'TODAY',
  };
}

export function NOW(): FunctionCall {
  return {
    type: 'function',
    name: 'NOW',
  };
}

export function YESTERDAY(): FunctionCall {
  return {
    type: 'function',
    name: 'YESTERDAY',
  };
}

export function TOMORROW(): FunctionCall {
  return {
    type: 'function',
    name: 'TOMORROW',
  };
}

export function FROM_TODAY(days: number, unit?: string): FunctionCall {
  return {
    type: 'function',
    name: 'FROM_TODAY',
    args: unit ? [days, unit] : [days],
  };
}

export function THIS_WEEK(): FunctionCall {
  return {
    type: 'function',
    name: 'THIS_WEEK',
  };
}

export function LAST_WEEK(): FunctionCall {
  return {
    type: 'function',
    name: 'LAST_WEEK',
  };
}

export function NEXT_WEEK(): FunctionCall {
  return {
    type: 'function',
    name: 'NEXT_WEEK',
  };
}

export function THIS_MONTH(): FunctionCall {
  return {
    type: 'function',
    name: 'THIS_MONTH',
  };
}

export function LAST_MONTH(): FunctionCall {
  return {
    type: 'function',
    name: 'LAST_MONTH',
  };
}

export function NEXT_MONTH(): FunctionCall {
  return {
    type: 'function',
    name: 'NEXT_MONTH',
  };
}

export function THIS_YEAR(): FunctionCall {
  return {
    type: 'function',
    name: 'THIS_YEAR',
  };
}

export function LOGINUSER(): FunctionCall {
  return {
    type: 'function',
    name: 'LOGINUSER',
  };
}

export function PRIMARY_ORGANIZATION(): FunctionCall {
  return {
    type: 'function',
    name: 'PRIMARY_ORGANIZATION',
  };
}