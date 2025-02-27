import Chance from 'chance';
import {
  open,
  OPSQLiteConnection,
  SQLBatchTuple,
} from '@op-engineering/op-sqlite';
import {beforeEach, describe, it} from './MochaRNAdapter';
import chai from 'chai';

const expect = chai.expect;
const chance = new Chance();
let db: OPSQLiteConnection;

export function queriesTests() {
  beforeEach(() => {
    try {
      if (db) {
        db.close();
        db.delete();
      }

      db = open({
        name: 'test',
      });

      db.execute('DROP TABLE IF EXISTS User;');
      db.execute(
        'CREATE TABLE User ( id INT PRIMARY KEY, name TEXT NOT NULL, age INT, networth REAL) STRICT;',
      );
    } catch (e) {
      console.warn('error on before each', e);
    }
  });

  describe('Queries tests', () => {
    it('Insert', async () => {
      const id = chance.integer();
      const name = chance.name();
      const age = chance.integer();
      const networth = chance.floating();
      const res = db.execute(
        'INSERT INTO "User" (id, name, age, networth) VALUES(?, ?, ?, ?)',
        [id, name, age, networth],
      );

      expect(res.rowsAffected).to.equal(1);
      expect(res.insertId).to.equal(1);
      expect(res.metadata).to.eql([]);
      expect(res.rows?._array).to.eql([]);
      expect(res.rows?.length).to.equal(0);
      expect(res.rows?.item).to.be.a('function');
    });

    it('Query without params', async () => {
      const id = chance.integer();
      const name = chance.name();
      const age = chance.integer();
      const networth = chance.floating();
      db.execute(
        'INSERT INTO User (id, name, age, networth) VALUES(?, ?, ?, ?)',
        [id, name, age, networth],
      );

      const res = db.execute('SELECT * FROM User');

      expect(res.rowsAffected).to.equal(1);
      expect(res.insertId).to.equal(1);
      expect(res.rows?._array).to.eql([
        {
          id,
          name,
          age,
          networth,
        },
      ]);
    });

    it('Query with params', async () => {
      const id = chance.integer();
      const name = chance.name();
      const age = chance.integer();
      const networth = chance.floating();
      db.execute(
        'INSERT INTO User (id, name, age, networth) VALUES(?, ?, ?, ?)',
        [id, name, age, networth],
      );

      const res = db.execute('SELECT * FROM User WHERE id = ?', [id]);

      expect(res.rowsAffected).to.equal(1);
      expect(res.insertId).to.equal(1);
      expect(res.rows?._array).to.eql([
        {
          id,
          name,
          age,
          networth,
        },
      ]);
    });

    it('Query with sqlite functions', async () => {
      const id = chance.integer();
      const name = chance.name();
      const age = chance.integer();
      const networth = chance.floating();

      // COUNT(*)
      db.execute(
        'INSERT INTO User (id, name, age, networth) VALUES(?, ?, ?, ?)',
        [id, name, age, networth],
      );

      const countRes = db.execute('SELECT COUNT(*) as count FROM User');

      expect(countRes.metadata?.[0].type).to.equal('UNKNOWN');
      expect(countRes.rows?._array.length).to.equal(1);
      expect(countRes.rows?.item(0).count).to.equal(1);

      // SUM(age)
      const id2 = chance.integer();
      const name2 = chance.name();
      const age2 = chance.integer();
      const networth2 = chance.floating();

      db.execute(
        'INSERT INTO User (id, name, age, networth) VALUES(?, ?, ?, ?)',
        [id2, name2, age2, networth2],
      );

      const sumRes = db.execute('SELECT SUM(age) as sum FROM User;');

      expect(sumRes.metadata?.[0].type).to.equal('UNKNOWN');
      expect(sumRes.rows?.item(0).sum).to.equal(age + age2);

      // MAX(networth), MIN(networth)
      const maxRes = db.execute('SELECT MAX(networth) as `max` FROM User;');
      const minRes = db.execute('SELECT MIN(networth) as `min` FROM User;');
      expect(maxRes.metadata?.[0].type).to.equal('UNKNOWN');
      expect(minRes.metadata?.[0].type).to.equal('UNKNOWN');
      const maxNetworth = Math.max(networth, networth2);
      const minNetworth = Math.min(networth, networth2);

      expect(maxRes.rows?.item(0).max).to.equal(maxNetworth);
      expect(minRes.rows?.item(0).min).to.equal(minNetworth);
    });

    it('Executes all the statements in a single string', async () => {
      db.execute(
        `CREATE TABLE T1 ( id INT PRIMARY KEY) STRICT;
        CREATE TABLE T2 ( id INT PRIMARY KEY) STRICT;`,
      );

      let t1name = db.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='T1';",
      );

      expect(t1name.rows?._array[0].name).to.equal('T1');

      let t2name = db.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='T2';",
      );

      expect(t2name.rows?._array[0].name).to.equal('T2');
    });

    it('Failed insert', async () => {
      const id = chance.string();
      const name = chance.name();
      const age = chance.string();
      const networth = chance.string();
      // expect(
      try {
        db.execute(
          'INSERT INTO User (id, name, age, networth) VALUES(?, ?, ?, ?)',
          [id, name, age, networth],
        );
      } catch (e: any) {
        expect(typeof e).to.equal('object');

        expect(e.message).to.include(
          `cannot store TEXT value in INT column User.id`,
        );
      }
    });

    it('Transaction, auto commit', async () => {
      const id = chance.integer();
      const name = chance.name();
      const age = chance.integer();
      const networth = chance.floating();

      await db.transaction(async tx => {
        const res = tx.execute(
          'INSERT INTO "User" (id, name, age, networth) VALUES(?, ?, ?, ?)',
          [id, name, age, networth],
        );

        expect(res.rowsAffected).to.equal(1);
        expect(res.insertId).to.equal(1);
        expect(res.metadata).to.eql([]);
        expect(res.rows?._array).to.eql([]);
        expect(res.rows?.length).to.equal(0);
        expect(res.rows?.item).to.be.a('function');
      });

      const res = db.execute('SELECT * FROM User');
      expect(res.rows?._array).to.eql([
        {
          id,
          name,
          age,
          networth,
        },
      ]);
    });

    it('Transaction, manual commit', async () => {
      const id = chance.integer();
      const name = chance.name();
      const age = chance.integer();
      const networth = chance.floating();

      await db.transaction(async tx => {
        const res = tx.execute(
          'INSERT INTO "User" (id, name, age, networth) VALUES(?, ?, ?, ?)',
          [id, name, age, networth],
        );

        expect(res.rowsAffected).to.equal(1);
        expect(res.insertId).to.equal(1);
        expect(res.metadata).to.eql([]);
        expect(res.rows?._array).to.eql([]);
        expect(res.rows?.length).to.equal(0);
        expect(res.rows?.item).to.be.a('function');

        tx.commit();
      });

      const res = db.execute('SELECT * FROM User');
      expect(res.rows?._array).to.eql([
        {
          id,
          name,
          age,
          networth,
        },
      ]);
    });

    it('Transaction, executed in order', async () => {
      // ARRANGE: Setup for multiple transactions
      const iterations = 10;
      const actual: unknown[] = [];

      // ARRANGE: Generate expected data
      const id = chance.integer();
      const name = chance.name();
      const age = chance.integer();

      // ACT: Start multiple transactions to upsert and select the same record
      const promises = [];
      for (let iteration = 1; iteration <= iterations; iteration++) {
        const promised = db.transaction(async tx => {
          // ACT: Upsert statement to create record / increment the value
          tx.execute(
            `
              INSERT OR REPLACE INTO [User] ([id], [name], [age], [networth])
              SELECT ?, ?, ?,
                IFNULL((
                  SELECT [networth] + 1000
                  FROM [User]
                  WHERE [id] = ?
                ), 0)
          `,
            [id, name, age, id],
          );

          // ACT: Select statement to get incremented value and store it for checking later
          const results = tx.execute(
            'SELECT [networth] FROM [User] WHERE [id] = ?',
            [id],
          );

          actual.push(results.rows?._array[0].networth);
        });

        promises.push(promised);
      }

      // ACT: Wait for all transactions to complete
      await Promise.all(promises);

      // ASSERT: That the expected values where returned
      const expected = Array(iterations)
        .fill(0)
        .map((_, index) => index * 1000);
      expect(actual).to.eql(
        expected,
        'Each transaction should read a different value',
      );
    });

    it('Transaction, cannot execute after commit', async () => {
      const id = chance.integer();
      const name = chance.name();
      const age = chance.integer();
      const networth = chance.floating();

      await db.transaction(async tx => {
        const res = tx.execute(
          'INSERT INTO "User" (id, name, age, networth) VALUES(?, ?, ?, ?)',
          [id, name, age, networth],
        );

        expect(res.rowsAffected).to.equal(1);
        expect(res.insertId).to.equal(1);
        expect(res.metadata).to.eql([]);
        expect(res.rows?._array).to.eql([]);
        expect(res.rows?.length).to.equal(0);
        expect(res.rows?.item).to.be.a('function');

        tx.commit();

        try {
          tx.execute('SELECT * FROM "User"');
        } catch (e) {
          expect(!!e).to.equal(true);
        }
      });

      const res = db.execute('SELECT * FROM User');
      expect(res.rows?._array).to.eql([
        {
          id,
          name,
          age,
          networth,
        },
      ]);
    });

    it('Incorrect transaction, manual rollback', async () => {
      const id = chance.string();
      const name = chance.name();
      const age = chance.integer();
      const networth = chance.floating();

      await db.transaction(async tx => {
        try {
          tx.execute(
            'INSERT INTO "User" (id, name, age, networth) VALUES(?, ?, ?, ?)',
            [id, name, age, networth],
          );
        } catch (e) {
          tx.rollback();
        }
      });

      const res = db.execute('SELECT * FROM User');
      expect(res.rows?._array).to.eql([]);
    });

    it('Correctly throws', () => {
      const id = chance.string();
      const name = chance.name();
      const age = chance.integer();
      const networth = chance.floating();
      try {
        db.execute(
          'INSERT INTO "User" (id, name, age, networth) VALUES(?, ?, ?, ?)',
          [id, name, age, networth],
        );
      } catch (e: any) {
        expect(!!e).to.equal(true);
      }
    });

    it('Rollback', async () => {
      const id = chance.integer();
      const name = chance.name();
      const age = chance.integer();
      const networth = chance.floating();

      await db.transaction(async tx => {
        tx.execute(
          'INSERT INTO "User" (id, name, age, networth) VALUES(?, ?, ?, ?)',
          [id, name, age, networth],
        );
        tx.rollback();
        const res = db.execute('SELECT * FROM User');
        expect(res.rows?._array).to.eql([]);
      });
    });

    it('Transaction, rejects on callback error', async () => {
      const promised = db.transaction(tx => {
        throw new Error('Error from callback');
      });

      // ASSERT: should return a promise that eventually rejects
      expect(promised).to.have.property('then').that.is.a('function');
      try {
        await promised;
        expect.fail('Should not resolve');
      } catch (e) {
        expect(e).to.be.a.instanceof(Error);
        expect((e as Error)?.message).to.equal('Error from callback');
      }
    });

    it('Transaction, rejects on invalid query', async () => {
      const promised = db.transaction(async tx => {
        console.log('execute bad start');
        tx.execute('SELECT * FROM [tableThatDoesNotExist];');
        console.log('execute bad done');
      });

      // ASSERT: should return a promise that eventually rejects
      expect(promised).to.have.property('then').that.is.a('function');
      try {
        await promised;
        expect.fail('Should not resolve');
      } catch (e) {
        expect(e).to.be.a.instanceof(Error);
        expect((e as Error)?.message).to.include(
          'no such table: tableThatDoesNotExist',
        );
      }
    });

    it('Transaction, handle async callback', async () => {
      let ranCallback = false;
      const promised = db.transaction(async tx => {
        await new Promise<void>(done => {
          setTimeout(() => done(), 50);
        });
        tx.execute('SELECT * FROM [User];');
        ranCallback = true;
      });

      // ASSERT: should return a promise that eventually rejects
      expect(promised).to.have.property('then').that.is.a('function');
      await promised;
      expect(ranCallback).to.equal(true, 'Should handle async callback');
    });

    it('Async transaction, auto commit', async () => {
      const id = chance.integer();
      const name = chance.name();
      const age = chance.integer();
      const networth = chance.floating();

      await db.transaction(async tx => {
        const res = await tx.executeAsync(
          'INSERT INTO "User" (id, name, age, networth) VALUES(?, ?, ?, ?)',
          [id, name, age, networth],
        );

        expect(res.rowsAffected).to.equal(1);
        expect(res.insertId).to.equal(1);
        expect(res.metadata).to.eql([]);
        expect(res.rows?._array).to.eql([]);
        expect(res.rows?.length).to.equal(0);
        expect(res.rows?.item).to.be.a('function');
      });

      const res = db.execute('SELECT * FROM User');
      expect(res.rows?._array).to.eql([
        {
          id,
          name,
          age,
          networth,
        },
      ]);
    });

    it('Async transaction, auto rollback', async () => {
      const id = chance.string(); // Causes error because it should be an integer
      const name = chance.name();
      const age = chance.integer();
      const networth = chance.floating();

      try {
        await db.transaction(async tx => {
          await tx.executeAsync(
            'INSERT INTO "User" (id, name, age, networth) VALUES(?, ?, ?, ?)',
            [id, name, age, networth],
          );
        });
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
        expect((error as Error).message)
          .to.include('execution error')
          .and.to.include('cannot store TEXT value in INT column User.id');

        const res = db.execute('SELECT * FROM User');
        expect(res.rows?._array).to.eql([]);
      }
    });

    it('Async transaction, manual commit', async () => {
      const id = chance.integer();
      const name = chance.name();
      const age = chance.integer();
      const networth = chance.floating();

      await db.transaction(async tx => {
        await tx.executeAsync(
          'INSERT INTO "User" (id, name, age, networth) VALUES(?, ?, ?, ?)',
          [id, name, age, networth],
        );
        tx.commit();
      });

      const res = db.execute('SELECT * FROM User');
      expect(res.rows?._array).to.eql([
        {
          id,
          name,
          age,
          networth,
        },
      ]);
    });

    it('Async transaction, manual rollback', async () => {
      const id = chance.integer();
      const name = chance.name();
      const age = chance.integer();
      const networth = chance.floating();

      await db.transaction(async tx => {
        await tx.executeAsync(
          'INSERT INTO "User" (id, name, age, networth) VALUES(?, ?, ?, ?)',
          [id, name, age, networth],
        );
        tx.rollback();
      });

      const res = db.execute('SELECT * FROM User');
      expect(res.rows?._array).to.eql([]);
    });

    it('Async transaction, executed in order', async () => {
      // ARRANGE: Setup for multiple transactions
      const iterations = 10;
      const actual: unknown[] = [];

      // ARRANGE: Generate expected data
      const id = chance.integer();
      const name = chance.name();
      const age = chance.integer();

      // ACT: Start multiple async transactions to upsert and select the same record
      const promises = [];
      for (let iteration = 1; iteration <= iterations; iteration++) {
        const promised = db.transaction(async tx => {
          // ACT: Upsert statement to create record / increment the value
          await tx.executeAsync(
            `
              INSERT OR REPLACE INTO [User] ([id], [name], [age], [networth])
              SELECT ?, ?, ?,
                IFNULL((
                  SELECT [networth] + 1000
                  FROM [User]
                  WHERE [id] = ?
                ), 0)
          `,
            [id, name, age, id],
          );

          // ACT: Select statement to get incremented value and store it for checking later
          const results = await tx.executeAsync(
            'SELECT [networth] FROM [User] WHERE [id] = ?',
            [id],
          );

          actual.push(results.rows?._array[0].networth);
        });

        promises.push(promised);
      }

      // ACT: Wait for all transactions to complete
      await Promise.all(promises);

      // ASSERT: That the expected values where returned
      const expected = Array(iterations)
        .fill(0)
        .map((_, index) => index * 1000);
      expect(actual).to.eql(
        expected,
        'Each transaction should read a different value',
      );
    });

    it('Async transaction, rejects on callback error', async () => {
      const promised = db.transaction(async tx => {
        throw new Error('Error from callback');
      });

      // ASSERT: should return a promise that eventually rejects
      expect(promised).to.have.property('then').that.is.a('function');
      try {
        await promised;
        expect.fail('Should not resolve');
      } catch (e) {
        expect(e).to.be.a.instanceof(Error);
        expect((e as Error)?.message).to.equal('Error from callback');
      }
    });

    it('Async transaction, rejects on invalid query', async () => {
      const promised = db.transaction(async tx => {
        await tx.executeAsync('SELECT * FROM [tableThatDoesNotExist];');
      });

      // ASSERT: should return a promise that eventually rejects
      expect(promised).to.have.property('then').that.is.a('function');
      try {
        await promised;
        expect.fail('Should not resolve');
      } catch (e) {
        expect(e).to.be.a.instanceof(Error);
        expect((e as Error)?.message).to.include(
          'no such table: tableThatDoesNotExist',
        );
      }
    });

    it('Batch execute', () => {
      const id1 = chance.integer();
      const name1 = chance.name();
      const age1 = chance.integer();
      const networth1 = chance.floating();

      const id2 = chance.integer();
      const name2 = chance.name();
      const age2 = chance.integer();
      const networth2 = chance.floating();

      const commands: SQLBatchTuple[] = [
        [
          'INSERT INTO "User" (id, name, age, networth) VALUES(?, ?, ?, ?)',
          [id1, name1, age1, networth1],
        ],
        [
          'INSERT INTO "User" (id, name, age, networth) VALUES(?, ?, ?, ?)',
          [id2, name2, age2, networth2],
        ],
      ];

      db.executeBatch(commands);

      const res = db.execute('SELECT * FROM User');
      expect(res.rows?._array).to.eql([
        {id: id1, name: name1, age: age1, networth: networth1},
        {
          id: id2,
          name: name2,
          age: age2,
          networth: networth2,
        },
      ]);
    });

    it('Async batch execute', async () => {
      const id1 = chance.integer();
      const name1 = chance.name();
      const age1 = chance.integer();
      const networth1 = chance.floating();

      const id2 = chance.integer();
      const name2 = chance.name();
      const age2 = chance.integer();
      const networth2 = chance.floating();

      const commands: SQLBatchTuple[] = [
        [
          'INSERT INTO "User" (id, name, age, networth) VALUES(?, ?, ?, ?)',
          [id1, name1, age1, networth1],
        ],
        [
          'INSERT INTO "User" (id, name, age, networth) VALUES(?, ?, ?, ?)',
          [id2, name2, age2, networth2],
        ],
      ];

      await db.executeBatchAsync(commands);

      const res = db.execute('SELECT * FROM User');
      expect(res.rows?._array).to.eql([
        {id: id1, name: name1, age: age1, networth: networth1},
        {
          id: id2,
          name: name2,
          age: age2,
          networth: networth2,
        },
      ]);
    });
  });
}
