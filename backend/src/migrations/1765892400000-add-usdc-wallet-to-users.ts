import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUsdcWalletToUsers1765892400000 implements MigrationInterface {
  name = 'AddUsdcWalletToUsers1765892400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "users" 
            ADD COLUMN IF NOT EXISTS "usdcWalletAddress" varchar
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "users" 
            DROP COLUMN IF EXISTS "usdcWalletAddress"
        `);
  }
}
