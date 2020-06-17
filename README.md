<a name="module_mongodb-filesystem"></a>

# mongodb-filesystem
Exports the MongoFS class that implements a filesystem using GridFS.

**Example** *(Installation)*  
```js
npm install --save mongodb-filesystem
```
**Example** *(Usage)*  
```js
const { MongoFS } = require('mongodb-filesystem');
const mongofs = new MongoFS(db);
```

* [mongodb-filesystem](#module_mongodb-filesystem)
    * [MongoFS](#exp_module_mongodb-filesystem--MongoFS) ⏏
        * [new MongoFS(db, [options], [modified])](#new_module_mongodb-filesystem--MongoFS_new)
        * [.createFile(pathname, buf, [metadata], [contentType])](#module_mongodb-filesystem--MongoFS+createFile) ⇒ <code>Promise</code>
        * [.createOrUpdateFile(pathname, buf, [metadata], [contentType])](#module_mongodb-filesystem--MongoFS+createOrUpdateFile) ⇒ <code>Promise</code>
        * [.deleteFile(pathname)](#module_mongodb-filesystem--MongoFS+deleteFile) ⇒ <code>Promise</code>
        * [.deleteFolder(folder)](#module_mongodb-filesystem--MongoFS+deleteFolder) ⇒ <code>Promise</code>
        * [.findFiles(query)](#module_mongodb-filesystem--MongoFS+findFiles) ⇒ <code>Promise</code>
        * [.getFile(pathname)](#module_mongodb-filesystem--MongoFS+getFile) ⇒ <code>Promise</code>
        * [.getFiles(folder, filenamesOnly)](#module_mongodb-filesystem--MongoFS+getFiles) ⇒ <code>Promise</code>
        * [.getFolders(parent)](#module_mongodb-filesystem--MongoFS+getFolders) ⇒ <code>Promise</code>
        * [.getMetadata(pathname)](#module_mongodb-filesystem--MongoFS+getMetadata) ⇒ <code>Promise</code>
        * [.isFile(pathname)](#module_mongodb-filesystem--MongoFS+isFile) ⇒ <code>Promise</code>
        * [.isFolder(pathname)](#module_mongodb-filesystem--MongoFS+isFolder) ⇒ <code>Promise</code>
        * [.renameFile(oldPathname, newPathname)](#module_mongodb-filesystem--MongoFS+renameFile) ⇒ <code>Promise</code>
        * [.renameFolder(oldFolder, newFolder)](#module_mongodb-filesystem--MongoFS+renameFolder) ⇒ <code>Promise</code>
        * [.updateFile(pathname, buf, [metadata], [contentType])](#module_mongodb-filesystem--MongoFS+updateFile) ⇒ <code>Promise</code>
        * [.updateMetadata(pathname, metadata)](#module_mongodb-filesystem--MongoFS+updateMetadata) ⇒ <code>Promise</code>


* * *

<a name="exp_module_mongodb-filesystem--MongoFS"></a>

## MongoFS ⏏
Implements a basic filesystem using the MongoDB GridFS interface.
In GridFS, everything is a file so the concept of folders containing files
must be artifically created by giving each file a pathname as the filename.

This approach has two consequences:

First, there is no concept of moving a file (or folder) into another folder.
In Unix, `mv myfile.txt mydir` moves the file into the `mydir` folder if it
is a directory. Otherwise, `myfile.txt` is renamed to `mydir`. In this
module, the only option is renaming a file (or folder).

Second, the concept of an empty directory also does not exist. Folders are
implicitly defined by one or more files having the same folder prefix.
If no files have a specific folder prefix, then `deleteFolder` performs
no action and `getFiles` and `getFolders` return an empty array.

Please note that all write operations are checked for conflicts.
For example, when renaming '/my/dir/myfile.txt' to '/my/dir/yourfile.txt'
and '/my/dir/yourfile.txt' aready exists, the promise is rejected.
This comparison is case-insensitive, meaning that it would fail even if
the existing file was named '/My/Dir/YourFile.txt'. This conflict test
also applies to creating or renaming files to existing file or folder
names and renaming folders to existing folder or file names.

**Kind**: Exported class  

* * *

<a name="new_module_mongodb-filesystem--MongoFS_new"></a>

### new MongoFS(db, [options], [modified])
Creates a new MongoFS instance by creating a GridFSBucket using the
specified (optional) options. The modified function, if specified,
is called for all actions that perform a mutation. The function is
passed a single string argument identifying the mutation.

**Params**

- db <code>object</code> - A database handle.
- [options] <code>object</code> - The options passed to the GridFSBucket constructor.
- [modified] <code>function</code> - A function called for all mutation actions.


* * *

<a name="module_mongodb-filesystem--MongoFS+createFile"></a>

### mongoFS.createFile(pathname, buf, [metadata], [contentType]) ⇒ <code>Promise</code>
Creates a new file from the specified buffer.

**Kind**: instance method of [<code>MongoFS</code>](#exp_module_mongodb-filesystem--MongoFS)  
**Returns**: <code>Promise</code> - Resolved if successful.  
**Params**

- pathname <code>string</code> - The pathname of the file to create.
- buf <code>string</code> | <code>Buffer</code> - The file data.
- [metadata] <code>object</code> - Optional metadata.
- [contentType] <code>string</code> - Optional content type.


* * *

<a name="module_mongodb-filesystem--MongoFS+createOrUpdateFile"></a>

### mongoFS.createOrUpdateFile(pathname, buf, [metadata], [contentType]) ⇒ <code>Promise</code>
Creates a new file or updates an existing file from the specified buffer.
On update, if the metadata is not specified, then the existing metadata
is used.

**Kind**: instance method of [<code>MongoFS</code>](#exp_module_mongodb-filesystem--MongoFS)  
**Returns**: <code>Promise</code> - Resolved with true if created, false if updated.  
**Params**

- pathname <code>string</code> - The pathname of the file to create or update.
- buf <code>string</code> | <code>Buffer</code> - The file data.
- [metadata] <code>object</code> - Optional metadata.
- [contentType] <code>string</code> - Optional content type.


* * *

<a name="module_mongodb-filesystem--MongoFS+deleteFile"></a>

### mongoFS.deleteFile(pathname) ⇒ <code>Promise</code>
Deletes the file specified by the pathname. The promise is rejected
if the file does not exist.

**Kind**: instance method of [<code>MongoFS</code>](#exp_module_mongodb-filesystem--MongoFS)  
**Returns**: <code>Promise</code> - Resolved with the number of files deleted (always 1).  
**Params**

- pathname <code>string</code> - The pathname of the file to delete.


* * *

<a name="module_mongodb-filesystem--MongoFS+deleteFolder"></a>

### mongoFS.deleteFolder(folder) ⇒ <code>Promise</code>
Deletes all files and folders in the specified folder. Essentially,
this method performs an `rm -rf` operation.

**Kind**: instance method of [<code>MongoFS</code>](#exp_module_mongodb-filesystem--MongoFS)  
**Returns**: <code>Promise</code> - Resolved with the number of files deleted.  
**Params**

- folder <code>string</code> - The folder to delete.


* * *

<a name="module_mongodb-filesystem--MongoFS+findFiles"></a>

### mongoFS.findFiles(query) ⇒ <code>Promise</code>
Finds all files matching the specified query. The query is a standard
MongoDB query.

**Kind**: instance method of [<code>MongoFS</code>](#exp_module_mongodb-filesystem--MongoFS)  
**Returns**: <code>Promise</code> - - Resolved with an array of descriptor objects.  
**Params**

- query <code>object</code> - The MongoDB query.

**Example** *(Find files authored by Smith)*  
```js
{ 'metadata.author.name.last': 'Smith' }
```

* * *

<a name="module_mongodb-filesystem--MongoFS+getFile"></a>

### mongoFS.getFile(pathname) ⇒ <code>Promise</code>
Gets the specified file and its content. The returned promise is resolved
with a descriptor object that has the following structure:
```
{
  filename: '/myfile.txt',
  pathname: '/myfolder/myfile.txt',
  metadata: { author: 'John Smith' },
  content: <Buffer 74 65 78 74>,
  contentType: 'text/plain',
  contentLength: 4,
  lastModified: '2020-06-05T12:53:03.128Z'
}
```

**Kind**: instance method of [<code>MongoFS</code>](#exp_module_mongodb-filesystem--MongoFS)  
**Returns**: <code>Promise</code> - Resolved with a descriptor that includes content.  
**Params**

- pathname <code>string</code> - The pathname of the file to get.


* * *

<a name="module_mongodb-filesystem--MongoFS+getFiles"></a>

### mongoFS.getFiles(folder, filenamesOnly) ⇒ <code>Promise</code>
Gets a list of the files in the specified folder. If the filenamesOnly
flag is true, then an array of filenames is returned instead of an array
of descriptor objects. The content is not included in the returned array.

**Kind**: instance method of [<code>MongoFS</code>](#exp_module_mongodb-filesystem--MongoFS)  
**Returns**: <code>Promise</code> - Resolved with an array of descriptor objects or filenames.  
**Params**

- folder <code>string</code> - The folder of which to list the files.
- filenamesOnly <code>boolean</code> - True to return only filenames.


* * *

<a name="module_mongodb-filesystem--MongoFS+getFolders"></a>

### mongoFS.getFolders(parent) ⇒ <code>Promise</code>
Gets a list of folders contained within the specified parent folder.

**Kind**: instance method of [<code>MongoFS</code>](#exp_module_mongodb-filesystem--MongoFS)  
**Returns**: <code>Promise</code> - Resolved with an array of subfolder names.  
**Params**

- parent <code>string</code> - The folder of which to list the subfolders.


* * *

<a name="module_mongodb-filesystem--MongoFS+getMetadata"></a>

### mongoFS.getMetadata(pathname) ⇒ <code>Promise</code>
Gets the metadata of the file specified by the pathname.

**Kind**: instance method of [<code>MongoFS</code>](#exp_module_mongodb-filesystem--MongoFS)  
**Returns**: <code>Promise</code> - - Resolved with the metadata of the file.  
**Params**

- pathname <code>string</code> - The pathname of the file to retrieve.


* * *

<a name="module_mongodb-filesystem--MongoFS+isFile"></a>

### mongoFS.isFile(pathname) ⇒ <code>Promise</code>
Determines if the pathname identifies an existing file.

**Kind**: instance method of [<code>MongoFS</code>](#exp_module_mongodb-filesystem--MongoFS)  
**Returns**: <code>Promise</code> - - Resolved with a boolean.  
**Params**

- pathname <code>string</code> - The pathname of the file to check.


* * *

<a name="module_mongodb-filesystem--MongoFS+isFolder"></a>

### mongoFS.isFolder(pathname) ⇒ <code>Promise</code>
Determines if the pathname identifies an existing folder. Since the
concept of folders is somewhat artificial, this method simply checks
if there are any files having the folder prefix.

**Kind**: instance method of [<code>MongoFS</code>](#exp_module_mongodb-filesystem--MongoFS)  
**Returns**: <code>Promise</code> - - Resolved with a boolean.  
**Params**

- pathname <code>string</code> - The pathname of the folder to check.


* * *

<a name="module_mongodb-filesystem--MongoFS+renameFile"></a>

### mongoFS.renameFile(oldPathname, newPathname) ⇒ <code>Promise</code>
Renames a file specified by the oldPathname with the newPathname. The promise
is rejected if the file does not exist, a file by that name already exists,
or the newPathname is actually a folder already containing other files.

**Kind**: instance method of [<code>MongoFS</code>](#exp_module_mongodb-filesystem--MongoFS)  
**Returns**: <code>Promise</code> - Resolved with the number of files renamed (always 1).  
**Params**

- oldPathname <code>string</code> - The absolute pathname of the file to rename.
- newPathname <code>string</code> - The relative or absolute target pathname.


* * *

<a name="module_mongodb-filesystem--MongoFS+renameFolder"></a>

### mongoFS.renameFolder(oldFolder, newFolder) ⇒ <code>Promise</code>
Renames a folder by finding all files where the filename begins with the
specified oldFolder and replacing that part of the filename with the
prefix specified by the newFolder. The promise is rejected if the
newFolder already exists.

**Kind**: instance method of [<code>MongoFS</code>](#exp_module_mongodb-filesystem--MongoFS)  
**Returns**: <code>Promise</code> - Resolved with the number of files renamed.  
**Params**

- oldFolder <code>string</code> - The old absolute folder path.
- newFolder <code>string</code> - The new relative or absolute folder path.


* * *

<a name="module_mongodb-filesystem--MongoFS+updateFile"></a>

### mongoFS.updateFile(pathname, buf, [metadata], [contentType]) ⇒ <code>Promise</code>
Updates an existing file from the specified buffer. If the metadata
is not specified, then the existing metadata is used.

**Kind**: instance method of [<code>MongoFS</code>](#exp_module_mongodb-filesystem--MongoFS)  
**Returns**: <code>Promise</code> - Resolved if successful.  
**Params**

- pathname <code>string</code> - The pathname of the file to update.
- buf <code>string</code> | <code>Buffer</code> - The file data.
- [metadata] <code>object</code> - Optional metadata.
- [contentType] <code>string</code> - Optional content type.


* * *

<a name="module_mongodb-filesystem--MongoFS+updateMetadata"></a>

### mongoFS.updateMetadata(pathname, metadata) ⇒ <code>Promise</code>
Updates the metadata of the file specified by the pathname to the
specified metadata. This replaces the current metadata object.

**Kind**: instance method of [<code>MongoFS</code>](#exp_module_mongodb-filesystem--MongoFS)  
**Returns**: <code>Promise</code> - Resolved with the number of files updated (always 1).  
**Params**

- pathname <code>string</code> - The pathname of the file to update.
- metadata <code>object</code> - The new metadata object.


* * *

