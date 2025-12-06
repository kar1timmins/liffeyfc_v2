import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveDeprecatedCompanyFieldsFromUsers1733508000000 implements MigrationInterface {
    name = 'RemoveDeprecatedCompanyFieldsFromUsers1733508000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Check if columns exist before attempting to drop them (idempotent)
        const table = await queryRunner.getTable('users');
        
        if (table?.findColumnByName('companyName')) {
            await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "companyName"`);
        }
        
        if (table?.findColumnByName('companyWebsite')) {
            await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "companyWebsite"`);
        }
        
        if (table?.findColumnByName('industry')) {
            await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "industry"`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Restore columns if needed (though data will be lost)
        await queryRunner.query(`ALTER TABLE "users" ADD "companyName" character varying`);
        await queryRunner.query(`ALTER TABLE "users" ADD "companyWebsite" character varying`);
        await queryRunner.query(`ALTER TABLE "users" ADD "industry" character varying`);
    }
}
