import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateWalletTables1762294800000 implements MigrationInterface {
  name = 'CreateWalletTables1762294800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if user_wallets table already exists
    const userWalletsTableExists = await queryRunner.hasTable('user_wallets');
    
    // Create user_wallets table if it doesn't exist
    if (!userWalletsTableExists) {
      await queryRunner.createTable(
        new Table({
          name: 'user_wallets',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'userId',
            type: 'uuid',
            isUnique: true,
          },
          {
            name: 'ethAddress',
            type: 'varchar',
            length: '42',
            isUnique: true,
          },
          {
            name: 'avaxAddress',
            type: 'varchar',
            length: '42',
            isUnique: true,
          },
          {
            name: 'encryptedMnemonic',
            type: 'text',
          },
          {
            name: 'encryptedPrivateKey',
            type: 'text',
          },
          {
            name: 'derivationPath',
            type: 'varchar',
            default: "$$m/44'/60'/0'/0/0$$",
          },
          {
            name: 'nextChildIndex',
            type: 'int',
            default: 0,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
      true,
    );
    }

    // Check if company_wallets table already exists
    const companyWalletsTableExists = await queryRunner.hasTable('company_wallets');
    
    // Create company_wallets table if it doesn't exist
    if (!companyWalletsTableExists) {
      await queryRunner.createTable(
        new Table({
          name: 'company_wallets',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'companyId',
            type: 'uuid',
            isUnique: true,
          },
          {
            name: 'parentWalletId',
            type: 'uuid',
          },
          {
            name: 'ethAddress',
            type: 'varchar',
            length: '42',
            isUnique: true,
          },
          {
            name: 'avaxAddress',
            type: 'varchar',
            length: '42',
            isUnique: true,
          },
          {
            name: 'encryptedPrivateKey',
            type: 'text',
          },
          {
            name: 'derivationPath',
            type: 'varchar',
          },
          {
            name: 'childIndex',
            type: 'int',
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
      true,
    );
    }

    // Add foreign keys only if they don't exist
    const userWalletsTable = await queryRunner.getTable('user_wallets');
    if (userWalletsTable) {
      const userFkExists = userWalletsTable.foreignKeys.find(
        fk => fk.columnNames.indexOf('userId') !== -1,
      );
      
      if (!userFkExists) {
        await queryRunner.createForeignKey(
          'user_wallets',
          new TableForeignKey({
            columnNames: ['userId'],
            referencedColumnNames: ['id'],
            referencedTableName: 'users',
            onDelete: 'CASCADE',
          }),
        );
      }
    }

    const companyWalletsTable = await queryRunner.getTable('company_wallets');
    if (companyWalletsTable) {
      const companyFkExists = companyWalletsTable.foreignKeys.find(
        fk => fk.columnNames.indexOf('companyId') !== -1,
      );
      
      if (!companyFkExists) {
        await queryRunner.createForeignKey(
          'company_wallets',
          new TableForeignKey({
            columnNames: ['companyId'],
            referencedColumnNames: ['id'],
            referencedTableName: 'companies',
            onDelete: 'CASCADE',
          }),
        );
      }

      const parentWalletFkExists = companyWalletsTable.foreignKeys.find(
        fk => fk.columnNames.indexOf('parentWalletId') !== -1,
      );
      
      if (!parentWalletFkExists) {
        await queryRunner.createForeignKey(
          'company_wallets',
          new TableForeignKey({
            columnNames: ['parentWalletId'],
            referencedColumnNames: ['id'],
            referencedTableName: 'user_wallets',
            onDelete: 'CASCADE',
          }),
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign keys
    const companyWalletsTable = await queryRunner.getTable('company_wallets');
    if (companyWalletsTable) {
      const companyFk = companyWalletsTable.foreignKeys.find(
        fk => fk.columnNames.indexOf('companyId') !== -1,
      );
      const parentWalletFk = companyWalletsTable.foreignKeys.find(
        fk => fk.columnNames.indexOf('parentWalletId') !== -1,
      );
      if (companyFk) await queryRunner.dropForeignKey('company_wallets', companyFk);
      if (parentWalletFk) await queryRunner.dropForeignKey('company_wallets', parentWalletFk);
    }

    const userWalletsTable = await queryRunner.getTable('user_wallets');
    if (userWalletsTable) {
      const userFk = userWalletsTable.foreignKeys.find(
        fk => fk.columnNames.indexOf('userId') !== -1,
      );
      if (userFk) await queryRunner.dropForeignKey('user_wallets', userFk);
    }

    // Drop tables
    await queryRunner.dropTable('company_wallets', true);
    await queryRunner.dropTable('user_wallets', true);
  }
}
