import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMultichainToCompanyWallets1771000000001
  implements MigrationInterface
{
  name = 'AddMultichainToCompanyWallets1771000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "company_wallets"
        ADD COLUMN IF NOT EXISTS "solanaAddress"  VARCHAR(66),
        ADD COLUMN IF NOT EXISTS "stellarAddress" VARCHAR(66),
        ADD COLUMN IF NOT EXISTS "bitcoinAddress" VARCHAR(66)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "company_wallets" DROP COLUMN IF EXISTS "solanaAddress"`,
    );
    await queryRunner.query(
      `ALTER TABLE "company_wallets" DROP COLUMN IF EXISTS "stellarAddress"`,
    );
    await queryRunner.query(
      `ALTER TABLE "company_wallets" DROP COLUMN IF EXISTS "bitcoinAddress"`,
    );
  }
}
