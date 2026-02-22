import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEscrowTrackingTables1734000000000
  implements MigrationInterface
{
  name = 'AddEscrowTrackingTables1734000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create escrow_deployments table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "escrow_deployments" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "contractAddress" varchar(42) NOT NULL,
        "chain" varchar(20) NOT NULL,
        "network" varchar(20) NOT NULL,
        "deploymentTxHash" varchar(66),
        "targetAmountEth" decimal(18,8) NOT NULL,
        "durationInDays" integer NOT NULL,
        "deadline" timestamp NOT NULL,
        "deployedById" uuid,
        "wishlistItemId" uuid NOT NULL,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "status" varchar(20) NOT NULL DEFAULT 'active',
        CONSTRAINT "FK_escrow_deployment_deployed_by" FOREIGN KEY ("deployedById") REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_escrow_deployment_wishlist_item" FOREIGN KEY ("wishlistItemId") REFERENCES "wishlist_items"("id") ON DELETE CASCADE
      )
    `);

    // Create contributions table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "contributions" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "contributorAddress" varchar(42) NOT NULL,
        "userId" uuid,
        "escrowDeploymentId" uuid NOT NULL,
        "wishlistItemId" uuid NOT NULL,
        "contractAddress" varchar(42) NOT NULL,
        "chain" varchar(20) NOT NULL,
        "transactionHash" varchar(66),
        "amountWei" varchar NOT NULL,
        "amountEth" decimal(18,8) NOT NULL,
        "amountUsd" decimal(10,2),
        "contributedAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        "isRefunded" boolean NOT NULL DEFAULT false,
        "refundedAt" timestamp,
        "refundTxHash" varchar(66),
        CONSTRAINT "FK_contribution_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_contribution_escrow_deployment" FOREIGN KEY ("escrowDeploymentId") REFERENCES "escrow_deployments"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_contribution_wishlist_item" FOREIGN KEY ("wishlistItemId") REFERENCES "wishlist_items"("id") ON DELETE CASCADE
      )
    `);

    // Create indexes for better query performance
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_escrow_deployment_contract_address" ON "escrow_deployments" ("contractAddress")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_escrow_deployment_wishlist_item" ON "escrow_deployments" ("wishlistItemId")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_contribution_contributor_address" ON "contributions" ("contributorAddress")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_contribution_wishlist_item" ON "contributions" ("wishlistItemId")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_contribution_escrow_deployment" ON "contributions" ("escrowDeploymentId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_contribution_escrow_deployment"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_contribution_wishlist_item"`,
    );
    await queryRunner.query(
      `DROP INDEX IF NOT EXISTS "IDX_contribution_contributor_address"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_escrow_deployment_wishlist_item"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_escrow_deployment_contract_address"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "contributions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "escrow_deployments"`);
  }
}
