/*
MIT License

Copyright (c) 2020 Frank Hellwig

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

'use strict';

const { GridFSBucket } = require('mongodb');

/**
 * Exports the MongoFS class that implements a filesystem using GridFS.
 *
 * @module mongodb-filesystem
 *
 * @example <caption>Installation</caption>
 * npm install --save mongodb-filesystem
 *
 * @example <caption>Usage</caption>
 * const { MongoFS } = require('mongodb-filesystem');
 * const mongofs = new MongoFS(db);
 */

/**
 * Implements a basic filesystem using the MongoDB GridFS interface.
 * In GridFS, everything is a file so the concept of folders containing files
 * must be artifically created by giving each file a pathname as the filename.
 *
 * This approach has two consequences:
 *
 * First, there is no concept of moving a file (or folder) into another folder.
 * In Unix, `mv myfile.txt mydir` moves the file into the `mydir` folder if it
 * is a directory. Otherwise, `myfile.txt` is renamed to `mydir`. In this
 * module, the only option is renaming a file (or folder).
 *
 * Second, the concept of an empty directory also does not exist. Folders are
 * implicitly defined by one or more files having the same folder prefix.
 * If no files have a specific folder prefix, then `deleteFolder` performs
 * no action and `getFiles` and `getFolders` return an empty array.
 *
 * Please note that all write operations are checked for conflicts.
 * For example, when renaming '/my/dir/myfile.txt' to '/my/dir/yourfile.txt'
 * and '/my/dir/yourfile.txt' aready exists, the promise is rejected.
 * This comparison is case-insensitive, meaning that it would fail even if
 * the existing file was named '/My/Dir/YourFile.txt'. This conflict test
 * also applies to creating or renaming files to existing file or folder
 * names and renaming folders to existing folder or file names.
 *
 * @alias module:mongodb-filesystem
 */
class MongoFS {
  /**
   * Creates a new MongoFS instance by creating a GridFSBucket using the
   * specified (optional) options. The modified function, if specified,
   * is called for all actions that perform a mutation. The function is
   * passed a single string argument identifying the mutation.
   * @param {object} db - A database handle.
   * @param {object} [options] - The options passed to the GridFSBucket constructor.
   * @param {function} [modified] - A function called for all mutation actions.
   */
  constructor(db, options, modified) {
    if (typeof options === 'function') {
      modified = options;
      options = {};
    }
    this._modified = typeof modified === 'function' ? modified : () => {};
    this._db = db;
    this._bucket = new GridFSBucket(db, options);
    if (options != null && typeof options.bucketName === 'string') {
      this._collectionName = options.bucketName + '.files';
    } else {
      this._collectionName = 'fs.files';
    }
  }

  /**
   * Creates a new file from the specified buffer.
   * @param {string} pathname - The pathname of the file to create.
   * @param {string|Buffer} buf - The file data.
   * @param {object} [metadata] - Optional metadata.
   * @param {string} [contentType] - Optional content type.
   * @returns {Promise} Resolved if successful.
   */
  async createFile(pathname, buf, metadata, contentType) {
    let isString = false;
    if (typeof buf === 'string') {
      buf = Buffer.from(buf);
      isString = true;
    }
    if (!Buffer.isBuffer(buf)) {
      throw new Error('Expected a string or buffer as the second argument');
    }
    if (metadata == null) {
      metadata = {}; // metadata is null or undefined
    } else if (typeof metadata === 'string') {
      contentType = metadata;
      metadata = {};
    } else if (typeof metadata !== 'object') {
      throw new Error('Expected an object for metadata');
    }
    if (typeof contentType !== 'string') {
      contentType = isString ? 'text/plain' : 'application/octet-stream';
    }
    pathname = resolve(pathname); // normalize
    await this._checkForConflict(pathname, 'Create File');
    const stream = this._bucket.openUploadStream(pathname, { metadata, contentType });
    return new Promise((resolve, reject) => {
      stream.write(buf);
      stream.end((err) => {
        if (err) {
          reject(err);
        } else {
          this._modified(`createFile: ${pathname}`);
          resolve(1);
        }
      });
    });
  }

  /**
   * Creates a new file or updates an existing file from the specified buffer.
   * On update, if the metadata is not specified, then the existing metadata
   * is used.
   * @param {string} pathname - The pathname of the file to create or update.
   * @param {string|Buffer} buf - The file data.
   * @param {object} [metadata] - Optional metadata.
   * @param {string} [contentType] - Optional content type.
   * @returns {Promise} Resolved with true if created, false if updated.
   */
  async createOrUpdateFile(pathname, buf, metadata, contentType) {
    const exists = await this.isFile(pathname);
    if (exists) {
      await this.updateFile(pathname, buf, metadata, contentType);
    } else {
      await this.createFile(pathname, buf, metadata, contentType);
    }
    return !exists;
  }

  /**
   * Deletes the file specified by the pathname. The promise is rejected
   * if the file does not exist.
   * @param {string} pathname - The pathname of the file to delete.
   * @returns {Promise} Resolved with the number of files deleted (always 1).
   */
  async deleteFile(pathname) {
    pathname = resolve(pathname);
    const file = await this._findOne(pathname);
    await this._bucket.delete(file._id);
    this._modified(`deleteFile: ${pathname}`);
    return 1;
  }

  /**
   * Deletes all files and folders in the specified folder. Essentially,
   * this method performs an `rm -rf` operation.
   * @param {string} folder - The folder to delete.
   * @returns {Promise} Resolved with the number of files deleted.
   */
  async deleteFolder(folder) {
    folder = resolve(folder);
    const files = await this._bucket.find({ filename: { $regex: `^${folder}/` } }).toArray();
    const count = files.length;
    for (let i = 0; i < count; i++) {
      await this._bucket.delete(files[i]._id);
    }
    this._modified(`deleteFolder: ${folder || '/'}`);
    return count;
  }

  /**
   * Finds all files matching the specified query. The query is a standard
   * MongoDB query.
   * @example <caption>Find files authored by Smith</caption>
   * { 'metadata.author.name.last': 'Smith' }
   * @param {object} query - The MongoDB query.
   * @returns {Promise} - Resolved with an array of descriptor objects.
   */
  async findFiles(query) {
    const files = await this._bucket.find(query).toArray();
    return files.map((f) => descriptor(f));
  }

  /**
   * Gets the specified file and its content. The returned promise is resolved
   * with a descriptor object that has the following structure:
   * ```
   * {
   *   filename: '/myfile.txt',
   *   pathname: '/myfolder/myfile.txt',
   *   metadata: { author: 'John Smith' },
   *   content: <Buffer 74 65 78 74>,
   *   contentType: 'text/plain',
   *   contentLength: 4,
   *   lastModified: '2020-06-05T12:53:03.128Z'
   * }
   * ```
   * @param {string} pathname - The pathname of the file to get.
   * @returns {Promise} Resolved with a descriptor that includes content.
   */
  async getFile(pathname) {
    pathname = resolve(pathname);
    const file = await this._findOne(pathname);
    const retval = descriptor(file);
    const stream = this._bucket.openDownloadStream(file._id);
    return new Promise((resolve, reject) => {
      const chunks = [];
      stream.on('data', (data) => {
        chunks.push(data);
      });
      stream.on('end', (data) => {
        retval.content = Buffer.concat(chunks);
        resolve(retval);
      });
      stream.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * Gets a list of the files in the specified folder. If the filenamesOnly
   * flag is true, then an array of filenames is returned instead of an array
   * of descriptor objects. The content is not included in the returned array.
   * @param {string} folder - The folder of which to list the files.
   * @param {boolean} filenamesOnly - True to return only filenames.
   * @returns {Promise} Resolved with an array of descriptor objects or filenames.
   */
  async getFiles(folder, filenamesOnly) {
    folder = resolve(folder);
    const files = await this._bucket.find({ filename: { $regex: `^${folder}/[^/]+$` } }).toArray();
    if (filenamesOnly) {
      return files.map((f) => basename(f.filename));
    } else {
      return files.map((f) => descriptor(f));
    }
  }

  /**
   * Gets a list of folders contained within the specified parent folder.
   * @param {string} parent - The folder of which to list the subfolders.
   * @returns {Promise} Resolved with an array of subfolder names.
   */
  async getFolders(parent) {
    parent = resolve(parent);
    const folders = await this._bucket
      .find({ filename: { $regex: `^${parent}/.+/.+$` } })
      .toArray();
    const names = folders.map((f) => {
      const name = f.filename.substring(parent.length + 1);
      return name.substring(0, name.indexOf('/'));
    });
    return names.filter((name, i) => names.indexOf(name) === i);
  }

  /**
   * Gets the metadata of the file specified by the pathname.
   * @param {string} pathname - The pathname of the file to retrieve.
   * @returns {Promise} - Resolved with the metadata of the file.
   */
  async getMetadata(pathname) {
    pathname = resolve(pathname);
    const file = await this._findOne(pathname);
    return file.metadata;
  }

  /**
   * Determines if the pathname identifies an existing file.
   * @param {string} pathname - The pathname of the file to check.
   * @returns {Promise} - Resolved with a boolean.
   */
  async isFile(pathname) {
    pathname = resolve(pathname);
    const file = await this._files().findOne({ filename: pathname });
    return !!file;
  }

  /**
   * Determines if the pathname identifies an existing folder. Since the
   * concept of folders is somewhat artificial, this method simply checks
   * if there are any files having the folder prefix.
   * @param {string} pathname - The pathname of the folder to check.
   * @returns {Promise} - Resolved with a boolean.
   */
  async isFolder(pathname) {
    pathname = resolve(pathname);
    const files = await this._files()
      .find({ filename: { $regex: `^${pathname}/` } })
      .toArray();
    return files.length > 0;
  }

  /**
   * Renames a file specified by the oldPathname with the newPathname. The promise
   * is rejected if the file does not exist, a file by that name already exists,
   * or the newPathname is actually a folder already containing other files.
   * @param {string} oldPathname - The absolute pathname of the file to rename.
   * @param {string} newPathname - The relative or absolute target pathname.
   * @returns {Promise} Resolved with the number of files renamed (always 1).
   */
  async renameFile(oldPathname, newPathname) {
    [oldPathname, newPathname] = resolve(oldPathname, newPathname);
    const file = await this._findOne(oldPathname);
    await this._checkForConflict(newPathname, 'Rename File');
    await this._bucket.rename(file._id, newPathname);
    this._modified(`renameFile: ${oldPathname} to ${newPathname}`);
    return 1;
  }

  /**
   * Renames a folder by finding all files where the filename begins with the
   * specified oldFolder and replacing that part of the filename with the
   * prefix specified by the newFolder. The promise is rejected if the
   * newFolder already exists.
   * @param {string} oldFolder - The old absolute folder path.
   * @param {string} newFolder - The new relative or absolute folder path.
   * @returns {Promise} Resolved with the number of files renamed.
   */
  async renameFolder(oldFolder, newFolder) {
    [oldFolder, newFolder] = resolve(oldFolder, newFolder);
    await this._checkForConflict(newFolder, 'Rename Folder');
    const files = await this._bucket.find({ filename: { $regex: `^${oldFolder}/` } }).toArray();
    const count = files.length;
    for (let i = 0; i < count; i++) {
      const file = files[i];
      const newName = newFolder + file.filename.substring(oldFolder.length);
      await this._bucket.rename(file._id, newName);
    }
    this._modified(`renameFolder: ${oldFolder} to ${newFolder}`);
    return count;
  }

  /**
   * Updates an existing file from the specified buffer. If the metadata
   * is not specified, then the existing metadata is used.
   * @param {string} pathname - The pathname of the file to update.
   * @param {string|Buffer} buf - The file data.
   * @param {object} [metadata] - Optional metadata.
   * @param {string} [contentType] - Optional content type.
   * @returns {Promise} Resolved if successful.
   */
  async updateFile(pathname, buf, metadata, contentType) {
    if (typeof metadata === 'string') {
      contentType = metadata;
      metadata = null;
    }
    if (metadata == null) {
      metadata = await this.getMetadata(pathname);
    }
    await this.deleteFile(pathname);
    await this.createFile(pathname, buf, metadata, contentType);
  }

  /**
   * Updates the metadata of the file specified by the pathname to the
   * specified metadata. This replaces the current metadata object.
   * @param {string} pathname - The pathname of the file to update.
   * @param {object} metadata - The new metadata object.
   * @returns {Promise} Resolved with the number of files updated (always 1).
   */
  async updateMetadata(pathname, metadata) {
    pathname = resolve(pathname);
    const file = await this._findOne(pathname);
    await this._files().updateOne({ _id: file._id }, { $set: { metadata } });
    this._modified(`updateMetadata: ${pathname}`);
    return 1;
  }

  //----------------------------------------------------------------------------
  // Private methods
  //----------------------------------------------------------------------------

  // Gets the underlying files collection
  _files() {
    return this._db.collection(this._collectionName);
  }

  // Finds a file. Throws an exception if not found or not unique.
  async _findOne(name) {
    const files = await this._bucket.find({ filename: name }).toArray();
    const count = files.length;
    if (count === 0) {
      throw new Error('File not found: ' + name);
    }
    if (count > 1) {
      // This shouldn't happen.
      throw new Error('Not unique: ' + name);
    }
    return files[0];
  }

  // Checks for conflits by performing a bidirectional regex comparison.
  //
  // Target Name          In Database         Result
  // --------------------------------------------------------------------
  // /a                   /a/b                Conflict (already a folder)
  // /a/b                 /a/b                Conflict (duplicate)
  // /b                   /a/b                OK
  // /a/b/c               /a/b                Conflict (already a file)
  // /a/c                 /a/b                OK
  async _checkForConflict(name, op) {
    op = op || 'MongoFS';
    if (!name) {
      throw new Error(`${op}: The name must not be empty`);
    }
    name = name.toLowerCase() + '/';
    const files = await this._files().find({}).project({ _id: 0, filename: 1 }).toArray();
    const filenames = files.map((f) => f.filename.toLowerCase() + '/');

    filenames.forEach((filename) => {
      if (filename.startsWith(name) || name.startsWith(filename)) {
        const a = name.substring(0, name.length - 1);
        const b = filename.substring(0, filename.length - 1);
        throw new Error(`${op}: '${a}' conflicts with '${b}'`);
      }
    });
  }
}

//------------------------------------------------------------------------------
// Private utility functions
//------------------------------------------------------------------------------

// Returns the filename portion of the specified pathname.
function basename(pathname) {
  return pathname.substring(pathname.lastIndexOf('/') + 1);
}

// Creates a descriptor from the specified file.
function descriptor(file) {
  return {
    filename: basename(file.filename),
    pathname: file.filename,
    metadata: file.metadata,
    contentType: file.contentType,
    contentLength: file.length,
    lastModified: file.uploadDate,
  };
}

// Takes a path and splits it on path delimiters (slashes). Returns a
// two-element array in the form [components, isAbsolute] where the
// components is an array of path components and the isAbsolute flag
// indicates whether or not the path started with a slash.
function split(path) {
  // Ensure that path is a string.
  path = path == null ? '' : path.toString();
  // Normalize the path so it only has forward slashes and no leading spaces.
  path = path.replace(/\\/g, '/').trimStart();
  // Determine if the path is absolute.
  const isAbsolute = path.startsWith('/');
  // Parse the path into components.
  const components = path
    .split('/')
    .map((c) => c.trim())
    .filter((c) => !!c);
  // Return the results as a two-element array.
  return [components, isAbsolute];
}

// Normalizes an array of path components by handling . and .. sequences.
// Returns a normalized array.
function normalize(components) {
  const retval = [];
  components.forEach((c) => {
    if (c === '..') {
      retval.pop();
    } else if (c != '.') {
      retval.push(c);
    }
  });
  return retval;
}

// When called with one argument, normalizes that argument and returns an
// absolute path. The argument is assumed to be an absolute path, even if
// it does not start with a slash. For example, with called as follows...
//
//   resolve('a/../../b\\   c  \\ . \\ d/e')refer to an
//
// ...returns the absolute path '/b/c/d/e'.
//
// When called with two arguments, source and target, resolves the target
// path against a source path and returns a two-element array in the form
// [source, target] where source is the normalized source path and target
// is the original target resolved against the source.
//
// Ex 1: resolve('/a/b/old', 'new') -> ['/a/b/old', '/a/b/new']
//       (a simple filename replacement)
//
// Ex 2: resolve('/a/b/old', '../new') -> ['/a/b/old', '/a/new']
//       (a filename replacement in the parent directory)
//
// Ex 3: resolve('/a/b/old', '/dir/new') -> ['/a/b/old', '/dir/new']
//       (an absolute target where the source is not considered)
//
// This function losely follows the concept in section 5.2 of RFC 3986.
// There, they call the source the base and the target the reference.
// Note that trailing slashes are ignored and the returned values will
// always start with a slash and never end with one.
//
// In all cases (one- or two-argument variants), a root-only path ('/')
// returns an empty string. This is done so that substring operations
// work and that an absolute path with an appended slash will not result
// in a double-slash for the root folder.
function resolve(source, target) {
  // Split and validate the source pathname.
  let [sourceComponents, _] = split(source);
  sourceComponents = normalize(sourceComponents);
  // Single argument variant.
  if (target === undefined) {
    sourceComponents.unshift(''); // ensure a leading slash
    return sourceComponents.join('/');
  }
  // Split the target. Resolve first and then validate.
  let [targetComponents, targetIsAbsolute] = split(target);
  if (!targetIsAbsolute) {
    targetComponents = [...sourceComponents.slice(0, -1), ...targetComponents];
  }
  targetComponents = normalize(targetComponents);
  sourceComponents.unshift(''); // ensure a leading slash
  targetComponents.unshift(''); // ensure a leading slash
  return [sourceComponents.join('/'), targetComponents.join('/')];
}

module.exports = { MongoFS };
