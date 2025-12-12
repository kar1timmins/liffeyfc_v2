import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEscrowFieldsToWishlistItems1733990400000 implements MigrationInterface {
    name = 'AddEscrowFieldsToWishlistItems1733990400000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add ethereum escrow address column
        await queryRunner.query(`
            ALTER TABLE "wishlist_items" 
            ADD COLUMN IF NOT EXISTS "ethereumEscrowAddress" VARCHAR(42)
        `);

        // Add avalanche escrow address column
        await queryRunner.query(`
            ALTER TABLE "wishlist_items" 
            ADD COLUMN IF NOT EXISTS "avalancheEscrowAddress" VARCHAR(42)
        `);

        // Add campaign deadline column
        await queryRunner.query(`
            ALTER TABLE "wishlist_items" 
            ADD COLUMN IF NOT EXISTS "campaignDeadline" TIMESTAMP
        `);

        // Add campaign duration days column
        await queryRunner.query(`
            ALTER TABLE "wishlist_items" 
            ADD COLUMN IF NOT EXISTS "campaignDurationDays" INTEGER
        `);

        // Add isEscrowActive column
        await queryRunner.query(`
            ALTER TABLE "wishlist_items" 
            ADD COLUMN IF NOT EXISTS "isEscrowActive" BOOLEAN DEFAULT false NOT NULL
        `);

        // Add isEscrowFinalized column
        await queryRunner.query(`
            ALTER TABLE "wishlist_items" 
            ADD COLUMN IF NOT EXISTS "isEscrowFinalized" BOOLEAN DEFAULT false NOT NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "wishlist_items" 
            DROP COLUMN IF EXISTS "ethereumEscrowAddress"
        `);

        await queryRunner.query(`
            ALTER TABLE "wishlist_items" 
            DROP COLUMN IF EXISTS "avalancheEscrowAddress"
        `);

        await queryRunner.query(`
            ALTER TABLE "wishlist_items" 
            DROP COLUMN IF EXISTS "campaignDeadline"
        `);

        await queryRunner.query(`
            ALTER TABLE "wishlist_items" 
            DROP COLUMN IF EXISTS "campaignDurationDays"
        `);

        await queryRunner.query(`
            ALTER TABLE "wishlist_items" 
            DROP COLUMN IF EXISTS "isEscrowActive"
        `);

        await queryRunner.query(`
            ALTER TABLE "wishlist_items" 
            DROP COLUMN IF EXISTS "isEscrowFinalized"
        `);
    }
}
