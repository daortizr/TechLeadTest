import { DataSource, EntityManager } from 'typeorm';
import { UnitOfWork, TransactionContext } from '../outputPorts';
import { translatePgError } from '../utilities/pgErrors';
import { logger } from '../utilities/logger';

class PostgresTransactionContext implements TransactionContext {
  readonly __brand = 'TransactionContext' as const;

  constructor(readonly manager: EntityManager) {}
}

export class UnitOfWorkImpl implements UnitOfWork {
  constructor(private dataSource: DataSource) {}

  async run<T>(work: (tx: TransactionContext) => Promise<T>): Promise<T> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const result = await work(new PostgresTransactionContext(queryRunner.manager));
      await queryRunner.commitTransaction();
      return result;
    } catch (error) {
      try {
        await queryRunner.rollbackTransaction();
      } catch (rollbackError) {
        // The connection may be gone; the original error is the one that gets thrown
        logger.warn('Rollback failed', { error: String(rollbackError) });
      }
      throw translatePgError(error);
    } finally {
      await queryRunner.release();
    }
  }

  static getManager(context: TransactionContext): EntityManager {
    if (!(context instanceof PostgresTransactionContext)) {
      throw new Error('Invalid transaction context');
    }
    return context.manager;
  }
}
