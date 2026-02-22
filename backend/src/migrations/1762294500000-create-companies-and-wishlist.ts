import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCompaniesAndWishlist1762294500000
  implements MigrationInterface
{
  name = 'CreateCompaniesAndWishlist1762294500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable uuid-ossp extension if not already enabled
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // Create companies table if it doesn't exist
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "companies" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" varchar(255) NOT NULL,
        "description" text NOT NULL,
        "industry" varchar(100),
        "website" varchar(255),
        "employeeCount" integer NOT NULL DEFAULT 1,
        "stage" varchar(20) NOT NULL DEFAULT 'idea',
        "fundingStage" varchar(20) NOT NULL DEFAULT 'bootstrapped',
        "location" varchar(255),
        "foundedDate" date,
        "logoUrl" varchar(255),
        "linkedinUrl" varchar(255),
        "twitterUrl" varchar(255),
        "tags" text,
        "isActive" boolean NOT NULL DEFAULT true,
        "isPublic" boolean NOT NULL DEFAULT true,
        "ownerId" uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_companies_owner" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // Create wishlist_items table if it doesn't exist
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "wishlist_items" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "title" varchar(255) NOT NULL,
        "description" text,
        "category" varchar(20) NOT NULL DEFAULT 'other',
        "priority" varchar(20) NOT NULL DEFAULT 'medium',
        "isFulfilled" boolean NOT NULL DEFAULT false,
        "companyId" uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_wishlist_company" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE
      )
    `);

    // Create indexes for better query performance (only if they don't exist)
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_companies_ownerId" ON "companies" ("ownerId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_companies_stage" ON "companies" ("stage")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_companies_fundingStage" ON "companies" ("fundingStage")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_companies_isPublic" ON "companies" ("isPublic")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_companies_industry" ON "companies" ("industry")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_wishlist_companyId" ON "wishlist_items" ("companyId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_wishlist_category" ON "wishlist_items" ("category")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX "IDX_wishlist_category"`);
    await queryRunner.query(`DROP INDEX "IDX_wishlist_companyId"`);
    await queryRunner.query(`DROP INDEX "IDX_companies_industry"`);
    await queryRunner.query(`DROP INDEX "IDX_companies_isPublic"`);
    await queryRunner.query(`DROP INDEX "IDX_companies_fundingStage"`);
    await queryRunner.query(`DROP INDEX "IDX_companies_stage"`);
    await queryRunner.query(`DROP INDEX "IDX_companies_ownerId"`);

    // Drop tables
    await queryRunner.query(`DROP TABLE "wishlist_items"`);
    await queryRunner.query(`DROP TABLE "companies"`);
  }
}
