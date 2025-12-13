import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCampaignMetadataToEscrowDeployments1769999999999 implements MigrationInterface {
  name = 'AddCampaignMetadataToEscrowDeployments1769999999999';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "escrow_deployments" ADD COLUMN IF NOT EXISTS "campaignName" varchar(255)`);
    await queryRunner.query(`ALTER TABLE "escrow_deployments" ADD COLUMN IF NOT EXISTS "campaignDescription" text`);
    // Add indexes for quick search if desired (optional)
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_escrow_deployment_campaign_name" ON "escrow_deployments" ("campaignName")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_escrow_deployment_campaign_name"`);
    await queryRunner.query(`ALTER TABLE "escrow_deployments" DROP COLUMN IF EXISTS "campaignDescription"`);
    await queryRunner.query(`ALTER TABLE "escrow_deployments" DROP COLUMN IF EXISTS "campaignName"`);
  }
}
