import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddWalletAddressesToCompanies1762294700000 implements MigrationInterface {
  name = 'AddWalletAddressesToCompanies1762294700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if ethAddress column exists before adding
    const ethAddressColumn = await queryRunner.hasColumn('companies', 'ethAddress');
    if (!ethAddressColumn) {
      await queryRunner.addColumn(
        'companies',
        new TableColumn({
          name: 'ethAddress',
          type: 'varchar',
          length: '42',
          isNullable: true,
        }),
      );
    }

    // Check if avaxAddress column exists before adding
    const avaxAddressColumn = await queryRunner.hasColumn('companies', 'avaxAddress');
    if (!avaxAddressColumn) {
      await queryRunner.addColumn(
        'companies',
        new TableColumn({
          name: 'avaxAddress',
          type: 'varchar',
          length: '42',
          isNullable: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Check if ethAddress column exists before dropping
    const ethAddressColumn = await queryRunner.hasColumn('companies', 'ethAddress');
    if (ethAddressColumn) {
      await queryRunner.dropColumn('companies', 'ethAddress');
    }

    // Check if avaxAddress column exists before dropping
    const avaxAddressColumn = await queryRunner.hasColumn('companies', 'avaxAddress');
    if (avaxAddressColumn) {
      await queryRunner.dropColumn('companies', 'avaxAddress');
    }
  }
}
