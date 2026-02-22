import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cross-chain contributions support
 *
 * - Makes escrowDeploymentId, contractAddress, amountWei, amountEth nullable so
 *   that non-EVM (SOL/XLM/BTC) manual contributions can be stored without a
 *   corresponding smart-contract deployment.
 * - Adds currencySymbol, nativeAmount, and amountEur columns for storing the
 *   native amount and its EUR equivalent at the time of contribution.
 */
export class CrossChainContributions1771000000002 implements MigrationInterface {
  name = 'CrossChainContributions1771000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Make previously NOT NULL columns nullable
    await queryRunner.query(`ALTER TABLE "contributions" ALTER COLUMN "escrowDeploymentId" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "contributions" ALTER COLUMN "amountWei" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "contributions" ALTER COLUMN "amountEth" DROP NOT NULL`);

    // Widen contractAddress to 66 chars and make nullable (was VARCHAR(42) NOT NULL)
    await queryRunner.query(`ALTER TABLE "contributions" ALTER COLUMN "contractAddress" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "contributions" ALTER COLUMN "contractAddress" TYPE VARCHAR(66)`);

    // New columns for cross-chain tracking
    await queryRunner.query(`ALTER TABLE "contributions" ADD COLUMN IF NOT EXISTS "currencySymbol" VARCHAR(10)`);
    await queryRunner.query(`ALTER TABLE "contributions" ADD COLUMN IF NOT EXISTS "nativeAmount"   DECIMAL(18,8)`);
    await queryRunner.query(`ALTER TABLE "contributions" ADD COLUMN IF NOT EXISTS "amountEur"      DECIMAL(14,2)`);

    // Back-fill currencySymbol for existing ETH / AVAX rows
    await queryRunner.query(`
      UPDATE "contributions"
      SET "currencySymbol" = CASE
        WHEN chain = 'ethereum'  THEN 'ETH'
        WHEN chain = 'avalanche' THEN 'AVAX'
        ELSE NULL
      END
      WHERE "currencySymbol" IS NULL
    `);

    // Back-fill nativeAmount from amountEth for existing rows
    await queryRunner.query(`
      UPDATE "contributions"
      SET "nativeAmount" = "amountEth"
      WHERE "nativeAmount" IS NULL AND "amountEth" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "contributions" DROP COLUMN IF EXISTS "amountEur"`);
    await queryRunner.query(`ALTER TABLE "contributions" DROP COLUMN IF EXISTS "nativeAmount"`);
    await queryRunner.query(`ALTER TABLE "contributions" DROP COLUMN IF EXISTS "currencySymbol"`);

    // Revert nullable changes — only safe if no NULL rows exist
    await queryRunner.query(`ALTER TABLE "contributions" ALTER COLUMN "contractAddress" TYPE VARCHAR(42)`);
    await queryRunner.query(`ALTER TABLE "contributions" ALTER COLUMN "amountEth" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "contributions" ALTER COLUMN "amountWei" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "contributions" ALTER COLUMN "escrowDeploymentId" SET NOT NULL`);
  }
}
