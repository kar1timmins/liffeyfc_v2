import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddValueToWishlistItems1762294900000 implements MigrationInterface {
  name = 'AddValueToWishlistItems1762294900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'wishlist_items',
      new TableColumn({
        name: 'value',
        type: 'decimal',
        precision: 10,
        scale: 2,
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('wishlist_items', 'value');
  }
}
