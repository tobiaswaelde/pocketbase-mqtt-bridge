const app = {
  enableCors: jest.fn(),
  enableShutdownHooks: jest.fn(),
  listen: jest.fn().mockResolvedValue(undefined),
};
const create = jest.fn().mockResolvedValue(app);

jest.mock('@nestjs/core', () => ({ NestFactory: { create } }));
jest.mock('./app.module', () => ({ AppModule: class AppModule {} }));
jest.mock('./config/env', () => ({ ENV: { CORS_ORIGIN: 'https://app.example.test', HOST: '127.0.0.1', PORT: 4321 } }));

import './main';

describe('bootstrap', () => {
  it('configures and starts the Nest application', async () => {
    await new Promise((resolve) => setImmediate(resolve));

    expect(create).toHaveBeenCalled();
    expect(app.enableCors).toHaveBeenCalledWith({ origin: 'https://app.example.test' });
    expect(app.enableShutdownHooks).toHaveBeenCalled();
    expect(app.listen).toHaveBeenCalledWith(4321, '127.0.0.1');
  });
});
