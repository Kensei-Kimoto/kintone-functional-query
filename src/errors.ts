export class KintoneFunctionalQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class QueryValidationError extends KintoneFunctionalQueryError {}

export class CliUsageError extends KintoneFunctionalQueryError {}
