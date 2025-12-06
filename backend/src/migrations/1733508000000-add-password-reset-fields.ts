import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPasswordResetFields1733508000000 implements MigrationInterface {
    name = 'AddPasswordResetFields1733508000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "users" 
            ADD COLUMN IF NOT EXISTS "resetPasswordToken" varchar,
            ADD COLUMN IF NOT EXISTS "resetPasswordExpires" timestamp
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "users" 
            DROP COLUMN IF EXISTS "resetPasswordToken",
            DROP COLUMN IF EXISTS "resetPasswordExpires"
        `);
    }
}
