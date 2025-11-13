import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMissingUserColumns1762295000000 implements MigrationInterface {
    name = 'AddMissingUserColumns1762295000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create enum type for role
        await queryRunner.query(`CREATE TYPE "public"."users_role_enum" AS ENUM('user', 'investor', 'staff')`);
        
        // Add role column with default value
        await queryRunner.query(`ALTER TABLE "users" ADD "role" "public"."users_role_enum" NOT NULL DEFAULT 'user'`);
        
        // Add company fields (for regular users/founders)
        await queryRunner.query(`ALTER TABLE "users" ADD "companyName" character varying`);
        await queryRunner.query(`ALTER TABLE "users" ADD "companyWebsite" character varying`);
        await queryRunner.query(`ALTER TABLE "users" ADD "industry" character varying`);
        
        // Add investor fields
        await queryRunner.query(`ALTER TABLE "users" ADD "investorCompany" character varying`);
        await queryRunner.query(`ALTER TABLE "users" ADD "investmentFocus" character varying`);
        await queryRunner.query(`ALTER TABLE "users" ADD "linkedinUrl" character varying`);
        await queryRunner.query(`ALTER TABLE "users" ADD "isAccredited" boolean NOT NULL DEFAULT false`);
        
        // Add staff fields
        await queryRunner.query(`ALTER TABLE "users" ADD "department" character varying`);
        await queryRunner.query(`ALTER TABLE "users" ADD "phoneNumber" character varying`);
        await queryRunner.query(`ALTER TABLE "users" ADD "isActive" boolean NOT NULL DEFAULT true`);
        
        // Add OAuth fields
        await queryRunner.query(`ALTER TABLE "users" ADD "provider" character varying`);
        await queryRunner.query(`ALTER TABLE "users" ADD "providerId" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove OAuth fields
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "providerId"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "provider"`);
        
        // Remove staff fields
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "isActive"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "phoneNumber"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "department"`);
        
        // Remove investor fields
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "isAccredited"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "linkedinUrl"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "investmentFocus"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "investorCompany"`);
        
        // Remove company fields
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "industry"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "companyWebsite"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "companyName"`);
        
        // Remove role column
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "role"`);
        
        // Drop enum type
        await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
    }
}
