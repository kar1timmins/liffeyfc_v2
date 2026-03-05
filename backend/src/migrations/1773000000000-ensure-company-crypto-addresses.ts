import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnsureCompanyCryptoAddresses1773000000000
  implements MigrationInterface
{
  name = 'EnsureCompanyCryptoAddresses1773000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "solanaAddress" character varying(66)`,
    );
    await queryRunner.query(
      `ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "stellarAddress" character varying(69)`,
    );
    await queryRunner.query(
      `ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "bitcoinAddress" character varying(62)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "companies" DROP COLUMN IF EXISTS "bitcoinAddress"`,
    );
    await queryRunner.query(
      `ALTER TABLE "companies" DROP COLUMN IF EXISTS "stellarAddress"`,
    );
    await queryRunner.query(
      `ALTER TABLE "companies" DROP COLUMN IF EXISTS "solanaAddress"`,
    );
  }
}
