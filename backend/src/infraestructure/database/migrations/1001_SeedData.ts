import { MigrationInterface, QueryRunner } from 'typeorm';
import { removeSeedAirports, removeSeedFlights, seedDemoData } from '../seed/demoSeed';

export class SeedData1700000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await seedDemoData(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await removeSeedFlights(queryRunner);
    await removeSeedAirports(queryRunner);
  }
}
