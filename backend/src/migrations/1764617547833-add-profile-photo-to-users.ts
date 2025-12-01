import { MigrationInterface, QueryRunner } from "typeorm";

export class AddProfilePhotoToUsers1764617547833 implements MigrationInterface {
    name = 'AddProfilePhotoToUsers1764617547833'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "profilePhotoUrl" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "profilePhotoUrl"`);
    }

}
