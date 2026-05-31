import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  it('should be defined', () => {
    const config = { get: () => 'test-secret' } as unknown as ConfigService;
    expect(new JwtStrategy(config)).toBeDefined();
  });
});
