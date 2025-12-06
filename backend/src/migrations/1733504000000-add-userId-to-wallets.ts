import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserIdToWallets1733504000000 implements MigrationInterface {
  name = 'AddUserIdToWallets1733504000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add userId column to wallets table
    await queryRunner.query(
      `ALTER TABLE "wallets" ADD "userId" uuid`,
    );

    // Add foreign key constraint
    await queryRunner.query(
      `ALTER TABLE "wallets" ADD CONSTRAINT "FK_wallets_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    // Create index on userId for better query performance
    await queryRunner.query(
      `CREATE INDEX "IDX_wallets_userId" ON "wallets" ("userId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop index
    await queryRunner.query(`DROP INDEX "IDX_wallets_userId"`);

    // Drop foreign key constraint
    await queryRunner.query(
      `ALTER TABLE "wallets" DROP CONSTRAINT "FK_wallets_user"`,
    );

    // Drop userId column
    await queryRunner.query(`ALTER TABLE "wallets" DROP COLUMN "userId"`);
  }
}
