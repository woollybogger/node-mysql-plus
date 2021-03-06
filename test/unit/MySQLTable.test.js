'use strict';

const CallbackManager = require('es6-callback-manager');
const MySQLTable = require('../../lib/MySQLTable');
const MySQLPlus = require('../../lib/MySQLPlus');

const config = require('../config');
const should = require('should');
const sinon = require('sinon');

const expect = should;

should.Assertion.addChain('to');
should.config.checkProtoEql = false;

describe('MySQLTable', () => {

  const pool = MySQLPlus.createPool(config);

  const mockTableSchema = {};
  const testTable = new MySQLTable('mysql_table_test_table', mockTableSchema, pool);

  function resetTable(cb) {
    testTable.delete((err) => {
      if (err) throw err;
      pool.query('ALTER TABLE `mysql_table_test_table` AUTO_INCREMENT=1', cb);
    });
  }

  before((done) => {
    pool.query(`
      CREATE TABLE \`mysql_table_test_table\` (
        \`id\` BIGINT UNSIGNED NOT NULL PRIMARY KEY AUTO_INCREMENT,
        \`email\` VARCHAR(255) NOT NULL UNIQUE,
        \`letter\` CHAR(1)
      )
    `, done);
  });

  after((done) => {
    pool.end(done);
  });


  describe('#name', () => {

    it('should be the name of the table', () => {
      testTable.name.should.equal('mysql_table_test_table');
    });

  });


  describe('#schema', () => {

    it('should be the original table schema', () => {
      testTable.schema.should.equal(mockTableSchema);
    });

  });


  describe('#pool', () => {

    it('should be the pool that was passed to the constructor', () => {
      testTable.pool.should.equal(pool);
    });

  });


  describe('#trxn', () => {


    it('should be undefined if not passed to the constructor', () => {
      expect(testTable.trxn).to.be.undefined();
    });


    it('should be the transaction connection that was passed to the constructor', () => {
      return pool.transaction((trxn, done) => {
        const trxnTable = new MySQLTable('mysql_table_test_table', mockTableSchema, pool, trxn);
        trxnTable.trxn.should.equal(trxn);
        done();
      });
    });

  });


  describe('#select()', () => {

    before((done) => {
      const insertSQL = 'INSERT INTO `mysql_table_test_table` (`email`) VALUES ' +
        "('one@email.com'), ('two@email.com'), ('three@email.com')";
      testTable.query(insertSQL, done);
    });

    after(resetTable);

    describe('with a callback', () => {

      it('should be able to select all data from the table', (done) => {
        testTable.select('*', (err, rows) => {
          if (err) throw err;
          rows.should.have.length(3);
          done();
        });
      });

      it('should be able to select certain columns of data from the table', (done) => {
        testTable.select('email', (err, rows) => {
          if (err) throw err;
          rows.should.have.length(3);
          rows.forEach((row) => {
            row.should.not.have.property('id');
            row.should.have.property('email');
          });
          done();
        });
      });

      it('should be able to select specific columns and rows from the table', (done) => {
        testTable.select(['id', 'email'], 'WHERE `id` > 1 ORDER BY `id`', (err, rows) => {
          if (err) throw err;
          rows.should.have.length(2);
          rows[0].id.should.equal(2);
          rows[0].email.should.equal('two@email.com');
          rows[1].id.should.equal(3);
          rows[1].email.should.equal('three@email.com');
          done();
        });
      });

      it('should be able to use SQL formatted with placeholders', (done) => {
        testTable.select('??', 'WHERE ?? > ? ORDER BY ??', [['id', 'email'], 'id', 1, 'id'], (err, rows) => {
          if (err) throw err;
          rows.should.have.length(2);
          rows[0].id.should.equal(2);
          rows[0].email.should.equal('two@email.com');
          rows[1].id.should.equal(3);
          rows[1].email.should.equal('three@email.com');
          done();
        });
      });

      it('should be able to select columns using aliases', (done) => {
        testTable.select('`id`, `email` AS `eml`', 'WHERE `id` = 1', (err, rows) => {
          if (err) throw err;
          rows.should.deepEqual([{id: 1, eml: 'one@email.com'}]);
          done();
        });
      });

      it('should be able to select using a function', (done) => {
        testTable.select('COUNT(*) AS `everyoneElse`', 'WHERE `id` <> 1', (err, rows) => {
          if (err) throw err;
          rows.should.deepEqual([{everyoneElse: 2}]);
          done();
        });
      });

    });


    describe('with a promise', () => {

      it('should be able to select all data from the table', () => {
        return testTable.select('*')
          .then((rows) => {
            rows.should.have.length(3);
          });
      });

      it('should be able to select certain columns of data from the table', () => {
        return testTable.select('email')
          .then((rows) => {
            rows.should.have.length(3);
            rows.forEach((row) => {
              row.should.not.have.property('id');
              row.should.have.property('email');
            });
          });
      });

      it('should be able to select specific columns and rows from the table', () => {
        return testTable.select(['id', 'email'], 'WHERE `id` > 1 ORDER BY `id`')
          .then((rows) => {
            rows.should.have.length(2);
            rows[0].id.should.equal(2);
            rows[0].email.should.equal('two@email.com');
            rows[1].id.should.equal(3);
            rows[1].email.should.equal('three@email.com');
          });
      });

      it('should be able to use SQL formatted with placeholders', () => {
        return testTable.select('??', 'WHERE ?? > ? ORDER BY ??', [['id', 'email'], 'id', 1, 'id'])
          .then((rows) => {
            rows.should.have.length(2);
            rows[0].id.should.equal(2);
            rows[0].email.should.equal('two@email.com');
            rows[1].id.should.equal(3);
            rows[1].email.should.equal('three@email.com');
          });
      });

      it('should be able to select columns using aliases', () => {
        return testTable.select('`id`, `email` AS `eml`', 'WHERE `id` = 1')
          .then((rows) => {
            rows.should.deepEqual([{id: 1, eml: 'one@email.com'}]);
          });
      });

      it('should be able to select using a function', () => {
        return testTable.select('COUNT(*) AS `everyoneElse`', 'WHERE `id` <> 1')
          .then((rows) => {
            rows.should.deepEqual([{everyoneElse: 2}]);
          });
      });

    });

  });


  describe('#insert()', () => {

    describe('with a callback', () => {

      after(resetTable);

      it('should insert the specified data into the table', (done) => {
        testTable.insert({email: 'one@email.com'}, (err, result) => {
          if (err) throw err;
          result.affectedRows.should.equal(1);
          result.insertId.should.equal(1);
          done();
        });
      });

      it('should insert the specified data into the table with an ON DUPLICATE KEY UPDATE clause', (done) => {
        const data = {id: 1, email: 'one@email.com'};
        const onDuplicateKey1 = "ON DUPLICATE KEY UPDATE `email` = 'one2@email.com'";

        testTable.insert(data, onDuplicateKey1, (err, result1) => {
          if (err) throw err;
          result1.affectedRows.should.equal(2); // Updated rows are affected twice
          result1.insertId.should.equal(1);

          const columns = Object.keys(data);
          const rows = [
            [data[columns[0]], data[columns[1]]],
          ];
          const onDuplicateKey2 = "ON DUPLICATE KEY UPDATE `email` = 'one2b@email.com'";

          testTable.insert([columns, rows], onDuplicateKey2, (err, result2) => {
            if (err) throw err;
            result2.affectedRows.should.equal(2);
            result2.insertId.should.equal(1);
            done();
          });
        });
      });

      it('should insert data with question marks into the table when using the `sqlString` and `values` parameters', (done) => {
        const data = {id: 1, email: '??one?@email.com'};
        const onDuplicateKey = 'ON DUPLICATE KEY UPDATE ?? = ?';

        testTable.insert(data, onDuplicateKey, ['email', 'one3@email.com'], (err, result1) => {
          if (err) throw err;
          result1.affectedRows.should.equal(2); // Updated rows are affected twice
          result1.insertId.should.equal(1);

          const columns = Object.keys(data);
          const rows = [
            [data[columns[0]], data[columns[1]]],
          ];
          testTable.insert([columns, rows], onDuplicateKey, ['email', 'one4@email.com'], (err, result2) => {
            if (err) throw err;
            result2.affectedRows.should.equal(2);
            result2.insertId.should.equal(1);
            done();
          });
        });
      });

      it('should be able to perform bulk inserts', (done) => {
        const data = [
          [2, 'two@email.com', null],
          [3, 'three@email.com', null],
        ];
        testTable.insert([data], (err, result) => {
          if (err) throw err;
          result.affectedRows.should.equal(2);
          done();
        });
      });

      it('should be able to perform bulk inserts with specified columns', (done) => {
        const data = [
          [null, 'four@email.com'],
          [null, 'five@email.com'],
        ];
        testTable.insert([['letter', 'email'], data], (err, result) => {
          if (err) throw err;
          result.affectedRows.should.equal(2);
          done();
        });
      });

      it('should allow the first parameter to be a string', (done) => {
        testTable.insert("(`email`) VALUES ('six@email.com'), ('seven@email.com')", (err, result1) => {
          if (err) throw err;
          result1.affectedRows.should.equal(2);

          testTable.insert('SET ?? = ?', ['email', 'eight@email.com'], (err, result2) => {
            if (err) throw err;
            result2.affectedRows.should.equal(1);
            done();
          });
        });
      });

    });


    describe('with a promise', () => {

      after(resetTable);

      it('should insert the specified data into the table', () => {
        return testTable.insert({email: 'one@email.com'})
          .then((result) => {
            result.affectedRows.should.equal(1);
            result.insertId.should.equal(1);
          });
      });

      it('should insert the specified data into the table with an ON DUPLICATE KEY UPDATE clause', () => {
        const data = {id: 1, email: 'one@email.com'};
        const columns = Object.keys(data);
        const rows = [
          [data[columns[0]], data[columns[1]]],
        ];
        const onDuplicateKey1 = "ON DUPLICATE KEY UPDATE `email` = 'one2@email.com'";
        const onDuplicateKey2 = "ON DUPLICATE KEY UPDATE `email` = 'one2b@email.com'";

        return Promise.all([
          testTable.insert(data, onDuplicateKey1),
          testTable.insert([columns, rows], onDuplicateKey2),
        ]).then((results) => {
          results[0].affectedRows.should.equal(2); // Updated rows are affected twice
          results[0].insertId.should.equal(1);
          results[1].affectedRows.should.equal(2);
          results[1].insertId.should.equal(1);
        });
      });

      it('should insert data with question marks into the table when using the `sqlString` and `values` parameters', () => {
        const data = {id: 1, email: '??one?@email.com'};
        const columns = Object.keys(data);
        const rows = [
          [data[columns[0]], data[columns[1]]],
        ];
        const onDuplicateKey = 'ON DUPLICATE KEY UPDATE ?? = ?';

        return Promise.all([
          testTable.insert(data, onDuplicateKey, ['email', 'one3@email.com']),
          testTable.insert([columns, rows], onDuplicateKey, ['email', 'one3b@email.com']),
        ]).then((results) => {
          results[0].affectedRows.should.equal(2); // Updated rows are affected twice
          results[0].insertId.should.equal(1);
          results[1].affectedRows.should.equal(2);
          results[1].insertId.should.equal(1);
        });
      });

      it('should be able to perform bulk inserts', () => {
        const data = [
          [2, 'two@email.com', null],
          [3, 'three@email.com', null],
        ];

        return testTable.insert([data])
          .then((result) => {
            result.affectedRows.should.equal(2);
          });
      });

      it('should be able to perform bulk inserts with specified columns', () => {
        const data = [
          [null, 'four@email.com'],
          [null, 'five@email.com'],
        ];

        return testTable.insert([['letter', 'email'], data])
          .then((result) => {
            result.affectedRows.should.equal(2);
          });
      });

      it('should allow the first parameter to be a string', () => {
        return Promise.all([
          testTable.insert("(`email`) VALUES ('six@email.com'), ('seven@email.com')"),
          testTable.insert('SET ?? = ?', ['email', 'eight@email.com']),
        ]).then((results) => {
          results[0].affectedRows.should.equal(2);
          results[1].affectedRows.should.equal(1);
        });
      });

    });

  });


  describe('#insertIfNotExists()', () => {

    describe('with a callback', () => {

      before((done) => {
        testTable.insertIfNotExists({email: 'one@email.com'}, ['email'], done);
      });

      after(resetTable);

      it('should not insert anything and not change the table if a row with the same key already exists', (done) => {
        testTable.insertIfNotExists({email: 'one@email.com'}, ['email'], (err, result) => {
          if (err) throw err;
          result.affectedRows.should.equal(0);

          testTable.query('SHOW CREATE TABLE ' + testTable.name, (err, rows) => {
            if (err) throw err;
            rows[0]['Create Table'].should.match(/ AUTO_INCREMENT=2 /);
            done();
          });
        });
      });

      it('should insert the specified data into the table', (done) => {
        testTable.insertIfNotExists({email: 'two@email.com'}, ['email'], (err, result) => {
          if (err) throw err;
          result.affectedRows.should.equal(1);
          result.insertId.should.equal(2);
          done();
        });
      });

      it('should accept raw data to insert and not escape it', (done) => {
        const cbManager = new CallbackManager(done);
        const doneOnlyRaw = cbManager.registerCallback();
        const doneDataAndRaw = cbManager.registerCallback();
        const doneRowExists = cbManager.registerCallback();

        testTable.insertIfNotExists({email: MySQLPlus.raw('"three@email.com"')}, ['email'], (err, result) => {
          if (err) throw err;
          result.affectedRows.should.equal(1);
          result.insertId.should.equal(3);

          testTable.select('email', 'WHERE id = 3', (err, rows) => {
            if (err) throw err;
            rows[0].email.should.equal('three@email.com');
            doneOnlyRaw();
          });

          testTable.insertIfNotExists({id: 5, email: MySQLPlus.raw('"five@email.com"')}, ['id', 'email'], (err, result2) => {
            if (err) throw err;
            result2.affectedRows.should.equal(1);
            result2.insertId.should.equal(5);
            doneDataAndRaw();
          });
        });

        testTable.insertIfNotExists({email: MySQLPlus.raw('"one@email.com"')}, ['email'], (err, result) => {
          if (err) throw err;
          result.affectedRows.should.equal(0);
          doneRowExists();
        });
      });

    });


    describe('with a promise', () => {

      before(
        () => testTable.insertIfNotExists({email: 'one@email.com'}, ['email'])
      );

      after(resetTable);

      it('should not insert anything and not change the table if a row with the same key already exists', () => {
        return testTable.insertIfNotExists({email: 'one@email.com'}, ['email'])
          .then((result) => {
            result.affectedRows.should.equal(0);
            return testTable.query('SHOW CREATE TABLE ' + testTable.name);
          })
          .then((result) => {
            result[0]['Create Table'].should.match(/ AUTO_INCREMENT=2 /);
          });
      });

      it('should insert the specified data into the table', () => {
        return testTable.insertIfNotExists({email: 'two@email.com'}, ['email'])
          .then((result) => {
            result.affectedRows.should.equal(1);
            result.insertId.should.equal(2);
          });
      });

      it('should accept raw data to insert and not escape it', () => {
        const promiseNewRow = testTable.insertIfNotExists({email: MySQLPlus.raw('"three@email.com"')}, ['email'])
          .then((result) => {
            result.affectedRows.should.equal(1);
            result.insertId.should.equal(3);

            return Promise.all([
              testTable.select('email', 'WHERE id = 3'),
              testTable.insertIfNotExists({id: 5, email: MySQLPlus.raw('"five@email.com"')}, ['id', 'email']),
            ]);
          })
          .then((results) => {
            results[0][0].email.should.equal('three@email.com');

            results[1].affectedRows.should.equal(1);
            results[1].insertId.should.equal(5);
          });

        const promiseRowExists = testTable.insertIfNotExists({email: MySQLPlus.raw('"one@email.com"')}, ['email'])
          .then((result) => {
            result.affectedRows.should.equal(0);
          });

        return Promise.all([promiseNewRow, promiseRowExists]);
      });

    });

  });


  describe('#update()', () => {

    describe('with a callback', () => {

      before((done) => {
        const insertSQL = 'INSERT INTO `mysql_table_test_table` (`email`) VALUES ' +
          "('one@email.com'), ('two@email.com'), ('three@email.com')";
        testTable.query(insertSQL, done);
      });

      after(resetTable);

      it('should be able to update all rows in the table with only the `data` argument', (done) => {
        testTable.update({letter: '?'}, (err, result) => {
          if (err) throw err;
          result.affectedRows.should.equal(3);
          result.changedRows.should.equal(3);
          done();
        });
      });

      it('should be able to update all rows in the table with only the `sqlString` argument', (done) => {
        testTable.update("`email` = CONCAT('updated_', `email`)", (err, result) => {
          if (err) throw err;
          result.affectedRows.should.equal(3);
          result.changedRows.should.equal(3);
          done();
        });
      });

      it('should be able to update specific rows in the table', (done) => {
        testTable.update({email: 'updated@email.com'}, 'WHERE `id` = 3', (err, result) => {
          if (err) throw err;
          result.affectedRows.should.equal(1);
          result.changedRows.should.equal(1);
          done();
        });
      });

      it('should be able to update rows using SQL formatted with placeholders', (done) => {
        testTable.update({email: 'updated2@email.com'}, 'WHERE `id` = ?', [3], (err, result) => {
          if (err) throw err;
          result.affectedRows.should.equal(1);
          result.changedRows.should.equal(1);
          done();
        });
      });

      it('should accept the `sqlString` argument without using the `data` argument', (done) => {
        testTable.update("`email` = 'updated3@email.com' WHERE `id` = ?", [3], (err, result) => {
          if (err) throw err;
          result.affectedRows.should.equal(1);
          result.changedRows.should.equal(1);
          done();
        });
      });

      it('should accept the `sqlString` argument without the `data` or `values` arguments', (done) => {
        testTable.update("`email` = 'updated4@email.com' WHERE `id` = 3", (err, result) => {
          if (err) throw err;
          result.affectedRows.should.equal(1);
          result.changedRows.should.equal(1);
          done();
        });
      });

      it('should work with `data` objects that contain question marks', (done) => {
        testTable.update({email: 'updated?@email.com'}, 'WHERE `id` = ?', [3], (err, result) => {
          if (err) throw err;
          result.affectedRows.should.equal(1);
          result.changedRows.should.equal(1);
          done();
        });
      });

    });


    describe('with a promise', () => {

      before((done) => {
        const insertSQL = 'INSERT INTO `mysql_table_test_table` (`email`) VALUES ' +
          "('one@email.com'), ('two@email.com'), ('three@email.com')";
        testTable.query(insertSQL, done);
      });

      after(resetTable);

      it('should be able to update all rows in the table with only the `data` argument', () => {
        return testTable.update({letter: '?'})
          .then((result) => {
            result.affectedRows.should.equal(3);
            result.changedRows.should.equal(3);
          });
      });

      it('should be able to update all rows in the table with only the `sqlString` argument', () => {
        return testTable.update("`email` = CONCAT('updated_', `email`)")
          .then((result) => {
            result.affectedRows.should.equal(3);
            result.changedRows.should.equal(3);
          });
      });

      it('should be able to update specific rows in the table', () => {
        return testTable.update({email: 'updated@email.com'}, 'WHERE `id` = 3')
          .then((result) => {
            result.affectedRows.should.equal(1);
            result.changedRows.should.equal(1);
          });
      });

      it('should be able to update rows using SQL formatted with placeholders', () => {
        return testTable.update({email: 'updated2@email.com'}, 'WHERE `id` = ?', [3])
          .then((result) => {
            result.affectedRows.should.equal(1);
            result.changedRows.should.equal(1);
          });
      });

      it('should accept the `sqlString` argument without using the `data` argument', () => {
        return testTable.update("`email` = 'updated3@email.com' WHERE `id` = ?", [3])
          .then((result) => {
            result.affectedRows.should.equal(1);
            result.changedRows.should.equal(1);
          });
      });

      it('should accept the `sqlString` argument without the `data` or `values` arguments', () => {
        return testTable.update("`email` = 'updated4@email.com' WHERE `id` = 3")
          .then((result) => {
            result.affectedRows.should.equal(1);
            result.changedRows.should.equal(1);
          });
      });

      it('should work with `data` objects that contain question marks', () => {
        return testTable.update({email: 'updated?@email.com'}, 'WHERE `id` = ?', [3])
          .then((result) => {
            result.affectedRows.should.equal(1);
            result.changedRows.should.equal(1);
          });
      });

    });

  });


  describe('#delete()', () => {

    describe('with a callback', () => {

      before((done) => {
        const insertSQL = 'INSERT INTO `mysql_table_test_table` (`email`) VALUES ' +
          "('one@email.com'), ('two@email.com'), ('three@email.com'), ('four@email.com'), ('five@email.com')," +
          "('six@email.com'), ('seven@email.com'), ('eight@email.com'), ('nine@email.com')";
        testTable.query(insertSQL, done);
      });

      after(resetTable);

      it('should delete specific rows from the table', (done) => {
        testTable.delete('WHERE `id` > 3', (err, result) => {
          if (err) throw err;
          result.affectedRows.should.equal(6);
          done();
        });
      });

      it('should delete rows using SQL formatted with placeholders', (done) => {
        testTable.delete('WHERE ?? > ?', ['id', 2], (err, result) => {
          if (err) throw err;
          result.affectedRows.should.equal(1);
          done();
        });
      });

      it('should delete all rows from the table', (done) => {
        testTable.delete((err, result) => {
          if (err) throw err;
          result.affectedRows.should.equal(2);
          done();
        });
      });

    });


    describe('with a promise', () => {

      before((done) => {
        const insertSQL = 'INSERT INTO `mysql_table_test_table` (`email`) VALUES ' +
          "('one@email.com'), ('two@email.com'), ('three@email.com'), ('four@email.com'), ('five@email.com')," +
          "('six@email.com'), ('seven@email.com'), ('eight@email.com'), ('nine@email.com')";
        testTable.query(insertSQL, done);
      });

      after(resetTable);

      it('should delete specific rows from the table', () => {
        return testTable.delete('WHERE `id` > 3')
          .then((result) => {
            result.affectedRows.should.equal(6);
          });
      });

      it('should delete rows using SQL formatted with placeholders', () => {
        return testTable.delete('WHERE ?? > ?', ['id', 2])
          .then((result) => {
            result.affectedRows.should.equal(1);
          });
      });

      it('should delete all rows from the table', () => {
        return testTable.delete()
          .then((result) => {
            result.affectedRows.should.equal(2);
          });
      });

    });

  });


  describe('#exists()', () => {

    before((done) => {
      const insertSQL = 'INSERT INTO `mysql_table_test_table` (`email`) VALUES ("one@email.com")';
      testTable.query(insertSQL, done);
    });

    after(resetTable);

    describe('with a callback', () => {

      it('should resolve with `true` if rows exist (without using the `values` argument)', (done) => {
        testTable.exists('WHERE `id` < 3', (err, exists) => {
          if (err) throw err;
          exists.should.be.true();
          done();
        });
      });

      it('should resolve with `true` if rows exist (with using the `values` argument)', (done) => {
        testTable.exists('WHERE `email` = ?', ['one@email.com'], (err, exists) => {
          if (err) throw err;
          exists.should.be.true();
          done();
        });
      });

      it('should resolve with `false` if rows exist (without using the `values` argument)', (done) => {
        testTable.exists('WHERE `id` > 3', (err, exists) => {
          if (err) throw err;
          exists.should.be.false();
          done();
        });
      });

      it('should resolve with `false` if rows exist (with using the `values` argument)', (done) => {
        testTable.exists('WHERE `email` = ?', ['two@email.com'], (err, exists) => {
          if (err) throw err;
          exists.should.be.false();
          done();
        });
      });

      it('should resolve with an error if an error occurrs', (done) => {
        const error = new Error('exists error');
        sinon.stub(pool, 'query').yieldsAsync(error);

        testTable.exists('WHERE `email` = 1', (err, exists) => {
          err.should.equal(error);
          expect(exists).to.be.undefined();

          pool.query.restore();
          done();
        });
      });

    });


    describe('with a promise', () => {

      it('should resolve with `true` if rows exist (without using the `values` argument)', () => {
        return testTable.exists('WHERE `id` < 3').then((exists) => {
          exists.should.be.true();
        });
      });

      it('should resolve with `true` if rows exist (with using the `values` argument)', () => {
        return testTable.exists('WHERE `email` = ?', ['one@email.com']).then((exists) => {
          exists.should.be.true();
        });
      });

      it('should resolve with `false` if rows exist (without using the `values` argument)', () => {
        return testTable.exists('WHERE `id` > 3').then((exists) => {
          exists.should.be.false();
        });
      });

      it('should resolve with `false` if rows exist (with using the `values` argument)', () => {
        return testTable.exists('WHERE `email` = ?', ['two@email.com']).then((exists) => {
          exists.should.be.false();
        });
      });

    });

  });


  describe('#query()', () => {

    beforeEach(() => {
      sinon.spy(pool, 'pquery');
    });

    afterEach(() => {
      pool.pquery.restore();
    });

    it('should just directly call the pool\'s pquery() function', (done) => {
      testTable.query('SELECT 1 + 1 AS solution', function callback(err, rows) {
        if (err) throw err;
        rows.should.have.length(1);
        rows[0].solution.should.equal(2);
        pool.pquery.should.be.calledOnce().and.be.calledWith('SELECT 1 + 1 AS solution', callback);
        done();
      });
    });

    it('should return a promise if the callback is omitted', () => {
      return testTable.query('SELECT 1 + 1 AS solution')
        .then((rows) => {
          rows.should.have.length(1);
          rows[0].solution.should.equal(2);
          pool.pquery.should.be.calledOnce().and.be.calledWith('SELECT 1 + 1 AS solution');
        });
    });

  });


  describe('#transacting()', () => {

    after(resetTable);

    it('should return a new MySQLTable instance that is almost identical to the original', () => {
      return pool.transaction((trxn, done) => {
        const trxnTestTable = testTable.transacting(trxn);
        trxnTestTable.name.should.equal(testTable.name);
        trxnTestTable.schema.should.equal(testTable.schema);
        trxnTestTable.pool.should.equal(testTable.pool);
        trxnTestTable.trxn.should.equal(trxn);
        done();
      });
    });

    it('should create a new MySQLTable instance that makes queries using the provided transaction connection', () => {
      const goodError = new Error('Good error');

      return pool.transaction((trxn) => {
        const trxnTestTable = testTable.transacting(trxn);

        return trxnTestTable.insert({email: 'transacting@email.com'})
          .then(result => trxnTestTable.insert({email: 'meh', letter: result.insertId}))
          .then(() => trxnTestTable.select('*'))
          .then((rows) => {
            rows.should.have.length(2);
            rows[0].id.should.equal(1);
            rows[0].email.should.equal('transacting@email.com');
            rows[1].id.should.equal(2);
            rows[1].email.should.equal('meh');
            rows[1].letter.should.equal('1');

            throw goodError;
          });
      }).then(() => {
        throw new Error('Bad error');
      }).catch((err) => {
        err.should.equal(goodError);
        return testTable.select('*')
          .then((rows) => {
            rows.should.be.empty();
          });
      });
    });

  });

});
