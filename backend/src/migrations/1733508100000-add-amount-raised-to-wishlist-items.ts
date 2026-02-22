import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAmountRaisedToWishlistItems1733508100000
  implements MigrationInterface
{
  name = 'AddAmountRaisedToWishlistItems1733508100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "wishlist_items" 
            ADD COLUMN IF NOT EXISTS "amountRaised" DECIMAL(10,2) DEFAULT 0 NOT NULL
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "wishlist_items" 
            DROP COLUMN IF EXISTS "amountRaised"
        `);
  }
}
