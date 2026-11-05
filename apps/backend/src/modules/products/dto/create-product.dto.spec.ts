import { validate } from 'class-validator';
import { CreateProductDto } from './create-product.dto';

describe('CreateProductDto', () => {
  it('accepts the active flag sent by the catalog form', async () => {
    for (const isActive of [true, false]) {
      const dto = Object.assign(new CreateProductDto(), {
        name: 'Cafe',
        price: 35,
        isActive,
      });
      expect(
        await validate(dto, { whitelist: true, forbidNonWhitelisted: true }),
      ).toEqual([]);
    }
  });
});
