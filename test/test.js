'use strict';

const assert = require('assert');
const { MongoClient } = require('mongodb');
const { MongoFS } = require('../mongodb-filesystem');

const URL = 'mongodb://localhost:27017';
const DB = 'mongofs-testdb';

describe('MongoFS', function () {
  let client = null;
  let mfs = null;

  before(async function () {
    client = new MongoClient(URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    await client.connect();
    const db = client.db(DB);
    mfs = new MongoFS(db);
    await mfs.deleteFolder('/');
  });

  describe('createFile', function () {
    before(async function () {
      await mfs.createFile('/a/b/c/x', 'test');
    });
    it('should create a file', async function () {
      const files = await mfs.getFiles('/a/b/c');
      assert.equal(files.length, 1);
    });
    it('should not allow us to create a duplicate file', async function () {
      await assert.rejects(mfs.createFile('/a/b/c/x', 'test'));
    });
    it('should not allow us to create a file where there is already a folder', async function () {
      await assert.rejects(mfs.createFile('/a/b', 'test'));
    });
    it('should not allow us to create a folder where there is already a file', async function () {
      await assert.rejects(mfs.createFile('/a/b/c/x/y/z', 'test'));
    });
    it('should not allow us to create a file with an empty name', async function () {
      await assert.rejects(mfs.createFile(' ', 'test'));
    });
  });

  describe('createOrUpdateFile', function () {
    it('should create a file and return true', async function () {
      const created = await mfs.createOrUpdateFile('/a/b/c/new', 'test');
      assert(created);
    });
    it('should update a file and return false', async function () {
      const created = await mfs.createOrUpdateFile('/a/b/c/x', 'test');
      assert(!created);
    });
    after(async function () {
      await mfs.deleteFile('/a/b/c/new');
    });
  });

  describe('updateFile', function () {
    it('should update a file', async function () {
      await mfs.updateFile('/a/b/c/x', 'new data');
    });
    it('should fail if the file does not exist', async function () {
      await assert.rejects(mfs.updateFile('/not/found', 'new data'));
    });
  });

  describe('deleteFile', function () {
    it('should delete a file', async function () {
      await mfs.deleteFile('/a/b/c/x');
      await assert.rejects(mfs.getFile('/a/b/c/x'));
    });
  });

  describe('deleteFolder', function () {
    before(async function () {
      await mfs.createFile('/dir/file1', 'test');
      await mfs.createFile('/dir/file2', 'test');
      await mfs.createFile('/dir/file3', 'test');
    });
    it('should delete a folder', async function () {
      const files = await mfs.getFiles('/dir');
      assert.equal(files.length, 3);
      await mfs.deleteFolder('/dir');
      const empty = await mfs.getFiles('/dir');
      assert.equal(empty.length, 0);
    });
    it('should return zero the folder is a file', async function () {
      await mfs.createFile('/dir/sub/file', 'test', { type: 'A' });
      const deleted = await mfs.deleteFolder('/dir/sub/file');
      assert.equal(deleted, 0);
    });
    it('should return zero if the folder does not exist', async function () {
      const n = await mfs.deleteFolder('/nosuchfolder');
      assert.equal(n, 0);
    });
    after(async function () {
      await mfs.deleteFolder('/dir');
    });
  });

  describe('getFile', function () {
    before(async function () {
      await mfs.createFile('/dir/file', 'test', { type: 'A' });
    });
    it('should retrieve a file', async function () {
      const file = await mfs.getFile('/dir/file');
      assert.deepEqual(file.metadata, { type: 'A' });
      assert.equal(file.content.toString(), 'test');
    });
    it('should fail if the file does not exist', async function () {
      await mfs.deleteFile('/dir/file');
      await assert.rejects(mfs.getFile('/dir/file'));
    });
  });

  describe('getFiles', function () {
    before(async function () {
      await mfs.createFile('/files/file1', 'test');
      await mfs.createFile('/files/file2', 'test');
      await mfs.createFile('/files/file3', 'test');
    });
    it('should retrieve any files contained in a folder', async function () {
      const files = await mfs.getFiles('/files');
      assert.equal(files.length, 3);
    });
    it('should not retrieve any files if the folder does not exist', async function () {
      const files = await mfs.getFiles('/files/file1');
      assert.equal(files.length, 0);
    });
    after(async function () {
      await mfs.deleteFolder('/files');
    });
  });

  describe('getFolders', function () {
    it('should retrieve the folders contained in a parent folder', async function () {
      await mfs.createFile('/a/x/test', 'test');
      await mfs.createFile('/a/y/test', 'test');
      await mfs.createFile('/a/z/test', 'test');
      await mfs.createFile('/a/z/test1', 'test');
      const folders = await mfs.getFolders('/a');
      assert.equal(folders.length, 3);
    });
    it('should return an empty array if the folder is not a folder', async function () {
      const folders = await mfs.getFolders('/a/x/test');
      assert.equal(folders.length, 0);
    });
    it('should return an empty array if the folder does not exist', async function () {
      await mfs.deleteFolder('/a');
      const folders = await mfs.getFolders('/a');
      assert.equal(folders.length, 0);
    });
    after(async function () {
      await mfs.deleteFolder('/a');
    });
  });

  describe('isFile', function () {
    before(async function () {
      await mfs.createFile('/files/file1', 'test');
      await mfs.createFile('/files/file2', 'test');
      await mfs.createFile('/files/file3', 'test');
    });
    it('should resolve true for a file that exists', async function () {
      const flag = await mfs.isFile('/files/file1');
      assert.equal(flag, true);
    });
    it('should resolve false for a file that does not exists', async function () {
      const flag = await mfs.isFile('/files/file4');
      assert.equal(flag, false);
    });
    it('should resolve false is passed a folder and not a file', async function () {
      const flag = await mfs.isFile('/files');
      assert.equal(flag, false);
    });
    after(async function () {
      await mfs.deleteFolder('/files');
    });
  });

  describe('isFolder', function () {
    before(async function () {
      await mfs.createFile('/files/file1', 'test');
      await mfs.createFile('/files/file2', 'test');
      await mfs.createFile('/files/file3', 'test');
    });
    it('should resolve true for a folder that exists', async function () {
      const flag = await mfs.isFolder('/files');
      assert.equal(flag, true);
    });
    it('should resolve false for a folder that does not exists', async function () {
      const flag = await mfs.isFolder('/notfound');
      assert.equal(flag, false);
    });
    it('should resolve false is passed a file and not a folder', async function () {
      const flag = await mfs.isFolder('/files/file1');
      assert.equal(flag, false);
    });
    after(async function () {
      await mfs.deleteFolder('/files');
    });
  });

  describe('getMetadata', function () {
    before(async function () {
      await mfs.createFile('/dir/file', 'test', { type: 'A' });
    });
    it('should retrieve the metadata of a file', async function () {
      const metadata = await mfs.getMetadata('/dir/file');
      assert.deepEqual(metadata, { type: 'A' });
    });
    it('should fail if the file does not exist', async function () {
      await mfs.deleteFile('/dir/file');
      await assert.rejects(mfs.getMetadata('/dir/file'));
    });
  });

  describe('findFiles', function () {
    before(async function () {
      await mfs.createFile('/dir/file1', 'test', { name: 'Jack' });
      await mfs.createFile('/dir/file2', 'test', { name: 'Jackie' });
    });
    it('should retrieve files based on a query', async function () {
      const files = await mfs.findFiles({ 'metadata.name': 'Jack' });
      assert.equal(files.length, 1);
    });
    it('should retrieve files based on a regex query', async function () {
      const files = await mfs.findFiles({ 'metadata.name': { $regex: '^Jack' } });
      assert.equal(files.length, 2);
    });
    it('should retrieve no files based on a bad query', async function () {
      const files = await mfs.findFiles({ 'metadata.name': 'Bill' });
      assert.equal(files.length, 0);
    });
    after(async function () {
      await mfs.deleteFolder('/dir');
    });
  });

  describe('renameFile', function () {
    before(async function () {
      await mfs.createFile('/dir/myfile', 'test');
      await mfs.createFile('/dir/otherfile', 'test');
      await mfs.createFile('/dir/folder/myfile', 'test');
    });
    it('should rename a file', async function () {
      await mfs.renameFile('/dir/myfile', 'yourfile');
      await mfs.getFile('/dir/yourfile');
      await assert.rejects(mfs.getFile('/dir/myfile'));
    });
    it('should not allow us to rename it to an existing file', async function () {
      await assert.rejects(mfs.renameFile('/dir/yourfile', 'otherfile'));
    });
    it('should not allow us to rename it to an existing folder', async function () {
      await assert.rejects(mfs.renameFile('/dir/yourfile', 'folder'));
    });
    after(async function () {
      await mfs.deleteFolder('/dir');
    });
  });

  describe('renameFolder', function () {
    before(async function () {
      await mfs.createFile('/dir/myfile', 'test');
      await mfs.createFile('/dir/otherfile', 'test');
      await mfs.createFile('/otherdir/myfile', 'test');
    });
    it('should rename a folder', async function () {
      await mfs.renameFolder('/dir/', '/newdir/');
      const files = await mfs.getFiles('/newdir');
      assert.equal(files.length, 2);
    });
    it('should not allow us to rename it to an existing folder', async function () {
      await assert.rejects(mfs.renameFolder('/newdir/', '/otherdir/'));
    });
    after(async function () {
      await mfs.deleteFolder('/newdir');
      await mfs.deleteFolder('/otherdir');
    });
  });

  describe('updateMetadata', function () {
    before(async function () {
      await mfs.createFile('/m', 'test', { a: 'a' });
    });
    it('should update the metadata of a file', async function () {
      await mfs.updateMetadata('/m', { a: 'b' });
      const metadata = await mfs.getMetadata('/m');
      assert.deepEqual(metadata, { a: 'b' });
    });
    it('should fail if the file does not exist', async function () {
      await assert.rejects(mfs.updateMetadata('/not/found', {}));
    });
    after(async function () {
      await mfs.deleteFile('/m');
    });
  });

  after(async function () {
    await client.close();
  });
});
