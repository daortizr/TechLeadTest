import { DataSource, EntityManager } from 'typeorm';
import { UnitOfWork, TransactionContext } from '../outputPorts';

const TRANSACTION_CONTEXT_BRAND = Symbol('TransactionContext');

export class UnitOfWorkImpl implements UnitOfWork {
  constructor(private dataSource: DataSource) {}

  async run<T>(work: (tx: TransactionContext) => Promise<T>): Promise<T> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const manager = queryRunner.manager;
      const context = this.createContext(manager);
      const result = await work(context);
      await queryRunner.commitTransaction();
      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private createContext(manager: EntityManager): TransactionContext {
    return {
      __brand: 'TransactionContext',
      manager
    } as any as TransactionContext;
  }

  static getManager(context: TransactionContext): EntityManager {
    return (context as any).manager;
  }
}
