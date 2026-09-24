export interface TransactionContext {
  readonly __brand: 'TransactionContext';
}

export interface UnitOfWork {
  run<T>(work: (tx: TransactionContext) => Promise<T>): Promise<T>;
}
