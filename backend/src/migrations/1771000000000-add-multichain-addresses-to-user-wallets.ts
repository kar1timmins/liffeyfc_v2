import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMultichainAddressesToUserWallets1771000000000 implements MigrationInterface {
    name = 'AddMultichainAddressesToUserWallets1771000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "user_wallets"
            ADD COLUMN IF NOT EXISTS "solanaAddress"  varchar(64)  NULL DEFAULT NULL,
            ADD COLUMN IF NOT EXISTS "stellarAddress" varchar(64)  NULL DEFAULT NULL,
            ADD COLUMN IF NOT EXISTS "bitcoinAddress" varchar(64)  NULL DEFAULT NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "user_wallets"
            DROP COLUMN IF EXISTS "solanaAddress",
            DROP COLUMN IF EXISTS "stellarAddress",
            DROP COLUMN IF EXISTS "bitcoinAddress"
        `);
    }
}
