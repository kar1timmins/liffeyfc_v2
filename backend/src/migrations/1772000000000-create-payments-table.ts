import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePaymentsTable1772000000000 implements MigrationInterface {
  name = 'CreatePaymentsTable1772000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enums (ignore error if they already exist)
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."payments_chain_enum" AS ENUM ('ethereum', 'avalanche');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."payments_status_enum" AS ENUM ('pending', 'confirmed', 'deployed', 'failed', 'refunded');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payments" (
        "id"                  uuid              NOT NULL DEFAULT uuid_generate_v4(),
        "userId"              uuid              NOT NULL,
        "wishlistItemId"      uuid              NOT NULL,
        "usdcTxHash"          character varying(66),
        "usdcAmount"          numeric(18,6)     NOT NULL,
        "chain"               "public"."payments_chain_enum" NOT NULL,
        "fromAddress"         character varying(42),
        "toAddress"           character varying(42),
        "paymentMethod"       character varying(32) NOT NULL DEFAULT 'usdc',
        "status"              "public"."payments_status_enum" NOT NULL DEFAULT 'pending',
        "confirmedAt"         TIMESTAMP,
        "deployedAt"          TIMESTAMP,
        "errorMessage"        text,
        "deploymentChains"    text,
        "deployedContracts"   text,
        "deploymentTxHashes"  text,
        "createdAt"           TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"           TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payments_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_payments_user" FOREIGN KEY ("userId")
          REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_payments_wishlistItem" FOREIGN KEY ("wishlistItemId")
          REFERENCES "wishlist_items"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "payments"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."payments_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."payments_chain_enum"`);
  }
}
