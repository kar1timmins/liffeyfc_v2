import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNonEvmEscrowAddresses1771000000003
  implements MigrationInterface
{
  name = 'AddNonEvmEscrowAddresses1771000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Solana escrow address
    await queryRunner.query(`
            ALTER TABLE "wishlist_items" 
            ADD COLUMN IF NOT EXISTS "solanaEscrowAddress" VARCHAR(128)
        `);

    // Stellar escrow address
    await queryRunner.query(`
            ALTER TABLE "wishlist_items" 
            ADD COLUMN IF NOT EXISTS "stellarEscrowAddress" VARCHAR(128)
        `);

    // Bitcoin escrow address
    await queryRunner.query(`
            ALTER TABLE "wishlist_items" 
            ADD COLUMN IF NOT EXISTS "bitcoinEscrowAddress" VARCHAR(128)
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "wishlist_items" 
            DROP COLUMN IF EXISTS "solanaEscrowAddress"
        `);

    await queryRunner.query(`
            ALTER TABLE "wishlist_items" 
            DROP COLUMN IF EXISTS "stellarEscrowAddress"
        `);

    await queryRunner.query(`
            ALTER TABLE "wishlist_items" 
            DROP COLUMN IF EXISTS "bitcoinEscrowAddress"
        `);
  }
}
