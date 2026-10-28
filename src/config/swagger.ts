export const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'Confluencr Transaction Ledger API',
    version: '1.0.0',
    description:
      'High-reliability, ACID-compliant transaction ledger REST API with row-level locking, concurrency control, and deadlock-safe money transfers.',
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Local Server',
    },
  ],
  paths: {
    '/health': {
      get: {
        summary: 'Service Health Check',
        tags: ['Health'],
        responses: {
          '200': {
            description: 'Service is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    timestamp: { type: 'string', example: '2026-10-28T15:00:00.000Z' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/accounts': {
      post: {
        summary: 'Create a new account',
        tags: ['Accounts'],
        description: 'Creates a new account. The initial balance is always strictly 0.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreateAccountInput',
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Account successfully created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/Account' },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Validation error (e.g. missing name)',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/v1/accounts/{id}': {
      get: {
        summary: 'Get account balance and details',
        tags: ['Accounts'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
            description: 'The unique account ID',
          },
        ],
        responses: {
          '200': {
            description: 'Account balance returned successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        account_id: { type: 'string', format: 'uuid' },
                        name: { type: 'string' },
                        balance: { type: 'string', example: '120.0000' },
                        created_at: { type: 'string', format: 'date-time' },
                      },
                    },
                  },
                },
              },
            },
          },
          '404': {
            description: 'Account not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/v1/accounts/{id}/transactions': {
      post: {
        summary: 'Add a credit or debit transaction',
        tags: ['Transactions'],
        description:
          'Adds an atomic transaction with row-level locking. Rejects debits if balance is insufficient (422) and duplicate reference IDs (409).',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
            description: 'Account ID to transact against',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AddTransactionInput' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Transaction recorded and balance updated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/Transaction' },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Invalid input payload',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '404': {
            description: 'Account not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '409': {
            description: 'Duplicate reference_id for this account',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '422': {
            description: 'Insufficient balance for debit',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
      get: {
        summary: 'Get paginated transaction history',
        tags: ['Transactions'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
            description: 'The unique account ID',
          },
          {
            name: 'type',
            in: 'query',
            required: false,
            schema: { type: 'string', enum: ['credit', 'debit'] },
            description: 'Filter by credit or debit (omitted returns both)',
          },
          {
            name: 'page',
            in: 'query',
            required: false,
            schema: { type: 'integer', default: 1, minimum: 1 },
            description: 'Page number',
          },
          {
            name: 'limit',
            in: 'query',
            required: false,
            schema: { type: 'integer', default: 10, minimum: 1, maximum: 100 },
            description: 'Page size',
          },
        ],
        responses: {
          '200': {
            description: 'Paginated transaction history returned',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        transactions: {
                          type: 'array',
                          items: { $ref: '#/components/schemas/Transaction' },
                        },
                        pagination: { $ref: '#/components/schemas/Pagination' },
                      },
                    },
                  },
                },
              },
            },
          },
          '404': {
            description: 'Account not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/v1/transfers': {
      post: {
        summary: 'Transfer funds between accounts (Bonus)',
        tags: ['Transfers'],
        description:
          'Transfers money from source account to destination account atomically with deadlock prevention.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/TransferInput' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Transfer completed successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/TransferResult' },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Self-transfer or invalid input',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '404': {
            description: 'Source or destination account not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '422': {
            description: 'Insufficient balance in source account',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      CreateAccountInput: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', example: 'Alice Smith' },
        },
      },
      Account: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid', example: 'e6a7138b-d748-4cb2-8356-d743a6b85fa1' },
          name: { type: 'string', example: 'Alice Smith' },
          balance: { type: 'string', example: '0.0000' },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      AddTransactionInput: {
        type: 'object',
        required: ['type', 'amount', 'description', 'reference_id'],
        properties: {
          type: { type: 'string', enum: ['credit', 'debit'], example: 'credit' },
          amount: { type: 'number', minimum: 0.01, example: 50.0 },
          description: { type: 'string', example: 'Grocery shopping' },
          reference_id: { type: 'string', example: 'ref-tx-001' },
        },
      },
      Transaction: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          account_id: { type: 'string', format: 'uuid' },
          type: { type: 'string', enum: ['credit', 'debit'] },
          amount: { type: 'string', example: '50.0000' },
          description: { type: 'string' },
          reference_id: { type: 'string' },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      Pagination: {
        type: 'object',
        properties: {
          currentPage: { type: 'integer', example: 1 },
          pageSize: { type: 'integer', example: 10 },
          totalRecords: { type: 'integer', example: 25 },
          totalPages: { type: 'integer', example: 3 },
        },
      },
      TransferInput: {
        type: 'object',
        required: ['source_account_id', 'destination_account_id', 'amount', 'description', 'reference_id'],
        properties: {
          source_account_id: { type: 'string', format: 'uuid' },
          destination_account_id: { type: 'string', format: 'uuid' },
          amount: { type: 'number', minimum: 0.01, example: 30.0 },
          description: { type: 'string', example: 'Dinner payment' },
          reference_id: { type: 'string', example: 'tr-001' },
        },
      },
      TransferResult: {
        type: 'object',
        properties: {
          source_account_id: { type: 'string', format: 'uuid' },
          destination_account_id: { type: 'string', format: 'uuid' },
          amount: { type: 'string', example: '30' },
          source_transaction_id: { type: 'string', format: 'uuid' },
          destination_transaction_id: { type: 'string', format: 'uuid' },
          status: { type: 'string', example: 'completed' },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'INSUFFICIENT_BALANCE' },
              message: { type: 'string', example: 'Insufficient balance.' },
              details: { nullable: true },
            },
          },
        },
      },
    },
  },
};

