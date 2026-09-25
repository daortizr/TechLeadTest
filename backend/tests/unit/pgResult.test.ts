import { describe, it, expect } from 'vitest';
import { returningRows } from '../../src/infraestructure/utilities/pgResult';
import { translatePgError } from '../../src/infraestructure/utilities/pgErrors';
import { TransientDatabaseError, UniqueViolationError } from '../../src/infraestructure/outputPorts';

describe('returningRows', () => {
  it('takes the rows out of the [rows, affectedCount] shape of UPDATE ... RETURNING', () => {
    expect(returningRows([[{ version: 4 }], 1])).toEqual([{ version: 4 }]);
  });

  it('keeps an empty UPDATE result empty instead of reporting it as two rows', () => {
    expect(returningRows([[], 0])).toEqual([]);
  });

  it('returns SELECT and INSERT ... RETURNING results as they are', () => {
    expect(returningRows([{ id: 'a' }, { id: 'b' }])).toEqual([{ id: 'a' }, { id: 'b' }]);
    expect(returningRows([])).toEqual([]);
  });
});

describe('translatePgError', () => {
  it('turns deadlocks and serialization failures into a transient error', () => {
    expect(translatePgError({ driverError: { code: '40P01' } })).toBeInstanceOf(TransientDatabaseError);
    expect(translatePgError({ code: '40001' })).toBeInstanceOf(TransientDatabaseError);
  });

  it('turns unique violations into UniqueViolationError', () => {
    expect(translatePgError({ driverError: { code: '23505' } })).toBeInstanceOf(UniqueViolationError);
  });

  it('leaves any other error untouched', () => {
    const error = new Error('boom');
    expect(translatePgError(error)).toBe(error);
  });
});
