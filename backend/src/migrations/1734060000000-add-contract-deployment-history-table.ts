import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class AddContractDeploymentHistoryTable1734060000000
  implements MigrationInterface
{
  name = 'AddContractDeploymentHistoryTable1734060000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create contract_deployment_history table
    await queryRunner.createTable(
      new Table({
        name: 'contract_deployment_history',
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
          },
          {
            name: 'companyId',
            type: 'uuid',
          },
          {
            name: 'wishlistItemId',
            type: 'uuid',
          },
          {
            name: 'escrowDeploymentId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'contractAddress',
            type: 'varchar',
            length: '42',
            isNullable: true,
          },
          {
            name: 'fromAddress',
            type: 'varchar',
            length: '42',
          },
          {
            name: 'chain',
            type: 'varchar',
            length: '20',
          },
          {
            name: 'network',
            type: 'varchar',
            length: '20',
          },
          {
            name: 'action',
            type: 'enum',
            enum: [
              'deployed',
              'funded',
              'expired',
              'finalized',
              'refund_initiated',
              'contributed',
              'refunded',
            ],
          },
          {
            name: 'transactionHash',
            type: 'varchar',
            length: '66',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
    );

    // Create indexes for performance
    await queryRunner.createIndex(
      'contract_deployment_history',
      new TableIndex({
        name: 'IDX_contract_history_user',
        columnNames: ['userId'],
      }),
    );

    await queryRunner.createIndex(
      'contract_deployment_history',
      new TableIndex({
        name: 'IDX_contract_history_company',
        columnNames: ['companyId'],
      }),
    );

    await queryRunner.createIndex(
      'contract_deployment_history',
      new TableIndex({
        name: 'IDX_contract_history_wishlist',
        columnNames: ['wishlistItemId'],
      }),
    );

    await queryRunner.createIndex(
      'contract_deployment_history',
      new TableIndex({
        name: 'IDX_contract_history_contract',
        columnNames: ['contractAddress'],
      }),
    );

    await queryRunner.createIndex(
      'contract_deployment_history',
      new TableIndex({
        name: 'IDX_contract_history_action',
        columnNames: ['action'],
      }),
    );

    await queryRunner.createIndex(
      'contract_deployment_history',
      new TableIndex({
        name: 'IDX_contract_history_created',
        columnNames: ['createdAt'],
      }),
    );

    // Create foreign key constraints
    await queryRunner.createForeignKey(
      'contract_deployment_history',
      new TableForeignKey({
        columnNames: ['userId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'contract_deployment_history',
      new TableForeignKey({
        columnNames: ['companyId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'companies',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'contract_deployment_history',
      new TableForeignKey({
        columnNames: ['wishlistItemId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'wishlist_items',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'contract_deployment_history',
      new TableForeignKey({
        columnNames: ['escrowDeploymentId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'escrow_deployments',
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign keys first
    const table = await queryRunner.getTable('contract_deployment_history');
    if (table) {
      const foreignKeys = table.foreignKeys;
      for (const foreignKey of foreignKeys) {
        await queryRunner.dropForeignKey(
          'contract_deployment_history',
          foreignKey,
        );
      }
    }

    // Drop indexes
    await queryRunner.dropIndex(
      'contract_deployment_history',
      'IDX_contract_history_user',
    );
    await queryRunner.dropIndex(
      'contract_deployment_history',
      'IDX_contract_history_company',
    );
    await queryRunner.dropIndex(
      'contract_deployment_history',
      'IDX_contract_history_wishlist',
    );
    await queryRunner.dropIndex(
      'contract_deployment_history',
      'IDX_contract_history_contract',
    );
    await queryRunner.dropIndex(
      'contract_deployment_history',
      'IDX_contract_history_action',
    );
    await queryRunner.dropIndex(
      'contract_deployment_history',
      'IDX_contract_history_created',
    );

    // Drop table
    await queryRunner.dropTable('contract_deployment_history');
  }
}
