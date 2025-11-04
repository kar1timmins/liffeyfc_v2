export const Web3ServiceMock = {
  generateSignInMessage: jest.fn((address: string) => `message-for-${address}`),
  verifySignature: jest.fn(async (dto) => ({ isValid: true, address: dto.address, message: dto.message })),
};
