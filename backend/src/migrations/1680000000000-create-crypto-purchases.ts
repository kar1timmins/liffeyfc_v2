import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCryptoPurchases1680000000000 implements MigrationInterface {
  name = 'CreateCryptoPurchases1680000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "crypto_purchases" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid,
        "currency" character varying(32) NOT NULL,
        "network" character varying(32) NOT NULL,
        "amount" numeric(24,10) NOT NULL,
        "status" character varying(32) NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_crypto_purchases" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(`
      ALTER TABLE "crypto_purchases"
      ADD CONSTRAINT "FK_crypto_purchases_user" FOREIGN KEY ("user_id")
      REFERENCES "users"("id") ON DELETE CASCADE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "crypto_purchases"`);
  }
}
